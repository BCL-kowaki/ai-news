import Link from "next/link";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, CalendarCheck2, CalendarPlus, Trash2 } from "lucide-react";
import { meetingStatusStyle } from "@/lib/config";
import { formatJstDateTime } from "@/lib/datetime";
import { getReadableAudioUrl } from "@/lib/blob";
import { prisma } from "@/lib/prisma";
import { SubmitButton } from "@/components/SubmitButton";
import { deleteMeeting, registerMeetingCalendar } from "../actions";
import { MeetingProcessButtons } from "./MeetingProcessButtons";

/**
 * 会議の詳細ページ（/meetings/[id]）
 * 音声の再生・文字起こし・レポート要約（Markdownを整形表示）・カレンダー登録状態。
 */

export const dynamic = "force-dynamic";

export default async function MeetingDetailPage({ params }: { params: { id: string } }) {
  const meeting = await prisma.meeting.findUnique({ where: { id: params.id } }).catch(() => null);
  if (!meeting) notFound();

  const status = meetingStatusStyle(meeting.status);
  const isBusy = meeting.status === "transcribing" || meeting.status === "summarizing";
  // Privateストアの音声を再生するための署名付きURL（1時間有効）。貼り付け取り込みは音声なし
  const playableUrl = meeting.audioUrl ? await getReadableAudioUrl(meeting.audioUrl) : null;

  return (
    <main>
      {/* iOSの「戻る」リンク風 */}
      <Link
        href="/meetings"
        className="inline-flex items-center gap-0.5 text-[15px] text-accent active:opacity-60"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        会議
      </Link>

      <div className="mt-2 flex flex-wrap items-center gap-2.5">
        <h1 className="large-title min-w-0">{meeting.title}</h1>
        <span className="chip" style={{ backgroundColor: status.bg, color: status.fg }}>
          {status.label}
        </span>
      </div>
      <p className="mt-1 text-[13px] text-muted">
        {formatJstDateTime(meeting.recordedAt)}
        {meeting.durationSec != null && `・${Math.floor(meeting.durationSec / 60)}分`}
      </p>

      {/* 音声プレーヤー＋処理ボタン */}
      <section className="card mt-4 p-5">
        {playableUrl ? (
          <audio controls preload="metadata" src={playableUrl} className="w-full">
            お使いのブラウザは音声再生に対応していません。
          </audio>
        ) : (
          <p className="text-sm text-muted">
            この会議は文字起こしテキストの取り込みで登録されました（音声なし）。
          </p>
        )}
        <div className="mt-4">
          <MeetingProcessButtons
            meetingId={meeting.id}
            hasAudio={Boolean(meeting.audioUrl)}
            hasTranscript={Boolean(meeting.transcript)}
            isBusy={isBusy}
          />
        </div>
        {meeting.errorMsg && (
          <p className="mt-3 text-sm font-medium text-red-600">{meeting.errorMsg}</p>
        )}
      </section>

      {/* カレンダー登録状態 */}
      <section className="card mt-4 p-5">
        {meeting.calendarEventId ? (
          <p className="flex items-center gap-1.5 text-sm text-green-700">
            <CalendarCheck2 className="h-4 w-4" aria-hidden="true" />
            Googleカレンダーに登録済み（{meeting.calendarAccountEmail}）
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">カレンダーにはまだ登録されていません。</p>
            <form action={registerMeetingCalendar}>
              <input type="hidden" name="id" value={meeting.id} />
              <SubmitButton variant="ghost" pendingLabel="登録中…">
                <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
                カレンダーに登録
              </SubmitButton>
            </form>
          </div>
        )}
      </section>

      {/* レポート要約（Markdown → 整形表示） */}
      {meeting.summaryMd && (
        <section className="card mt-4 p-5 sm:p-6">
          <h2 className="card-title">レポート</h2>
          <div className="report mt-3">
            <Markdown remarkPlugins={[remarkGfm]}>{meeting.summaryMd}</Markdown>
          </div>
        </section>
      )}

      {/* 文字起こし全文（畳んで表示） */}
      {meeting.transcript && (
        <details className="card mt-4">
          <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-accent [&::-webkit-details-marker]:hidden">
            文字起こし全文を表示
          </summary>
          <p className="whitespace-pre-wrap border-t border-line px-5 py-4 text-sm leading-relaxed text-muted">
            {meeting.transcript}
          </p>
        </details>
      )}

      {/* 削除 */}
      <form action={deleteMeeting} className="mt-6 flex justify-end">
        <input type="hidden" name="id" value={meeting.id} />
        <SubmitButton variant="ghost" pendingLabel="削除中…" className="!text-red-600">
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          この会議を削除（音声も消えます）
        </SubmitButton>
      </form>
    </main>
  );
}
