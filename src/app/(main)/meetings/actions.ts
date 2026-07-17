"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { del } from "@vercel/blob";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { prisma } from "@/lib/prisma";
import { createCalendarEvent, findWritableAccount } from "@/lib/google/calendar";

/**
 * 会議のサーバーアクション（作成・削除・カレンダー登録）
 * 文字起こし・レポート生成は時間がかかるため、Server Actionではなく
 * 専用ルート（/api/meetings/[id]/transcribe, /summarize）で行う。
 */

async function assertLoggedIn(): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("ログインが必要です");
}

function revalidateMeetingViews(): void {
  revalidatePath("/meetings");
}

export type CreateMeetingInput = {
  title: string;
  recordedAtISO: string; // 録音開始日時（ISO文字列）
  durationSec: number | null;
  audioUrl: string; // Vercel BlobのURL（アップロード済み）
  audioMime: string;
  audioBytes: number;
};

/**
 * 会議を登録する（音声はアップロード済み前提）。
 * あわせてGoogleカレンダーへの自動登録も試みる（失敗しても会議は保存される）。
 */
export async function createMeeting(
  input: CreateMeetingInput,
): Promise<{ ok: boolean; id?: string; calendarMessage: string }> {
  await assertLoggedIn();

  const title = input.title.trim().slice(0, 100) || "会議";
  const recordedAt = new Date(input.recordedAtISO);
  if (Number.isNaN(recordedAt.getTime())) {
    return { ok: false, calendarMessage: "日時が不正です" };
  }
  // 音声URLはBlob以外を受け付けない（外部URLの混入防止）
  if (!/^https:\/\/[^/]+\.blob\.vercel-storage\.com\//.test(input.audioUrl)) {
    return { ok: false, calendarMessage: "音声URLが不正です" };
  }

  const meeting = await prisma.meeting.create({
    data: {
      title,
      recordedAt,
      durationSec: input.durationSec,
      audioUrl: input.audioUrl,
      audioMime: input.audioMime.slice(0, 100),
      audioBytes: input.audioBytes,
    },
  });

  // カレンダー自動登録（書き込み権限のあるアカウントがある場合のみ）
  const calendarMessage = await tryRegisterCalendar(meeting.id);

  revalidateMeetingViews();
  return { ok: true, id: meeting.id, calendarMessage };
}

/**
 * 文字起こしテキストの貼り付けで会議を登録する（音声なし）。
 * 他ツールで文字起こし済みのテキストや議事メモをそのまま取り込み、レポート生成に進める。
 */
export async function createMeetingFromTranscript(formData: FormData): Promise<void> {
  await assertLoggedIn();

  const transcript = String(formData.get("transcript") ?? "").trim();
  if (!transcript) return;

  const title = String(formData.get("title") ?? "").trim().slice(0, 100) || "会議";

  const meeting = await prisma.meeting.create({
    data: {
      title,
      recordedAt: new Date(),
      transcript: transcript.slice(0, 200_000), // 念のための上限（約3時間の会議でも収まる）
      status: "transcribed", // 文字起こし済みとして登録（すぐレポート生成できる）
    },
  });

  await tryRegisterCalendar(meeting.id);
  revalidateMeetingViews();
  redirect(`/meetings/${meeting.id}`);
}

/** カレンダー登録（作成時の自動実行と、詳細画面からの再試行の両方で使う） */
async function tryRegisterCalendar(meetingId: string): Promise<string> {
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting) return "会議が見つかりません";
  if (meeting.calendarEventId) return "カレンダーに登録済みです";

  const account = await findWritableAccount();
  if (!account) {
    return "カレンダー未登録：書き込み権限のあるアカウントがありません（設定から「再連携」で権限を追加できます）";
  }

  const start = meeting.recordedAt;
  // 終了時刻は録音の長さ（不明なら1時間）
  const end = new Date(start.getTime() + (meeting.durationSec ?? 3600) * 1000);

  const result = await createCalendarEvent(account, {
    title: `会議: ${meeting.title}`,
    description: "SERA（AI秘書）の会議記録から自動登録",
    start,
    end,
  });

  if (!result.ok) {
    return result.needsRelink
      ? `カレンダー未登録：${account.label} の権限が不足しています。設定から「再連携」してください`
      : "カレンダー登録に失敗しました";
  }

  await prisma.meeting.update({
    where: { id: meeting.id },
    data: { calendarEventId: result.eventId, calendarAccountEmail: account.email },
  });
  return `${account.label} のカレンダーに登録しました`;
}

/** 詳細画面からのカレンダー登録（再試行） */
export async function registerMeetingCalendar(formData: FormData): Promise<void> {
  await assertLoggedIn();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await tryRegisterCalendar(id);
  revalidatePath(`/meetings/${id}`);
  revalidateMeetingViews();
}

/** 会議の削除（音声ファイルもBlobから消す） */
export async function deleteMeeting(formData: FormData): Promise<void> {
  await assertLoggedIn();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const meeting = await prisma.meeting.findUnique({ where: { id } });
  if (!meeting) return;

  // 音声本体の削除（貼り付け取り込みは音声なし）。失敗してもDBの削除は続行
  if (meeting.audioUrl) {
    await del(meeting.audioUrl).catch((e) => {
      console.error("[会議] 音声ファイルの削除に失敗:", e);
    });
  }
  await prisma.meeting.delete({ where: { id } }).catch(() => {});
  revalidateMeetingViews();
  redirect("/meetings"); // 詳細ページから消した後に404にならないよう一覧へ戻す
}
