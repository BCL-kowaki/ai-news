"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { del } from "@vercel/blob";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { prisma } from "@/lib/prisma";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  findWritableAccount,
} from "@/lib/google/calendar";

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

  // 日付・時刻（任意）。未入力の部分は「今日・現在時刻」（JST）で補う
  const dateRaw = String(formData.get("date") ?? "").trim();
  const timeRaw = String(formData.get("time") ?? "").trim();
  let recordedAt = new Date();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateRaw) || /^\d{2}:\d{2}$/.test(timeRaw)) {
    const jstNow = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Tokyo",
      dateStyle: "short",
      timeStyle: "short",
    })
      .format(recordedAt)
      .split(" "); // ["YYYY-MM-DD", "HH:MM"]
    const date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : jstNow[0];
    const time = /^\d{2}:\d{2}$/.test(timeRaw) ? timeRaw : jstNow[1];
    const combined = new Date(`${date}T${time}:00+09:00`);
    if (!Number.isNaN(combined.getTime())) recordedAt = combined;
  }

  const meeting = await prisma.meeting.create({
    data: {
      title,
      recordedAt,
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

  // カレンダーに自動登録した予定も一緒に消す（登録済みの場合のみ。失敗しても続行）
  if (meeting.calendarEventId && meeting.calendarAccountEmail) {
    const account = await prisma.googleAccount
      .findUnique({ where: { email: meeting.calendarAccountEmail } })
      .catch(() => null);
    if (account) {
      await deleteCalendarEvent(account, meeting.calendarEventId).catch(() => {});
    }
  }
  await prisma.meeting.delete({ where: { id } }).catch(() => {});
  revalidateMeetingViews();
  redirect("/meetings"); // 詳細ページから消した後に404にならないよう一覧へ戻す
}

/**
 * レポートの共有リンクを発行する（ログインしていない相手にも見せる）。
 *
 * 公開されるのは `summaryMd`（レポート本文）だけ。音声・文字起こしは共有されない。
 * すでに発行済みなら作り直さず、同じリンクを使い続ける（相手のブックマークを壊さないため）。
 */
export async function enableMeetingShare(formData: FormData): Promise<void> {
  await assertLoggedIn();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const meeting = await prisma.meeting.findUnique({
    where: { id },
    select: { shareToken: true, summaryMd: true },
  });
  // レポートが無い会議は共有しても中身が空なので発行しない
  if (!meeting || !meeting.summaryMd || meeting.shareToken) {
    revalidatePath(`/meetings/${id}`);
    return;
  }

  await prisma.meeting.update({
    where: { id },
    data: { shareToken: createShareToken() },
  });
  revalidatePath(`/meetings/${id}`);
}

/**
 * 共有を停止する（リンクを無効化）。
 * トークンを消すので、配ったリンクはその場で開けなくなる。
 */
export async function disableMeetingShare(formData: FormData): Promise<void> {
  await assertLoggedIn();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.meeting
    .update({ where: { id }, data: { shareToken: null } })
    .catch(() => {
      // 会議が消えている場合は何もしない
    });
  revalidatePath(`/meetings/${id}`);
}

/**
 * 共有リンクのトークン。
 * 推測されないよう暗号論的乱数から32文字のURL安全な文字列を作る。
 */
function createShareToken(): string {
  return randomBytes(24).toString("base64url"); // 32文字
}
