import Link from "next/link";
import { CalendarCheck2, ChevronRight } from "lucide-react";
import { meetingStatusStyle } from "@/lib/config";
import { formatJstDateTime } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";
import { MeetingRecorder } from "./MeetingRecorder";

/**
 * 会議ページ（/meetings）
 * 録音・音声取り込みカード＋会議の一覧（新しい順）。
 */

export const dynamic = "force-dynamic";

/** 12:34 のような長さ表示 */
function formatDuration(sec: number | null): string | null {
  if (sec == null) return null;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}分${String(s).padStart(2, "0")}秒`;
}

export default async function MeetingsPage() {
  const meetings = await loadMeetings();

  return (
    <main>
      <h1 className="large-title">会議</h1>
      <p className="mt-1 text-[13px] text-muted">
        録音または音声ファイルの取り込み → 文字起こし → レポート要約。カレンダーにも自動登録します。
      </p>

      <div className="mt-4">
        <MeetingRecorder />
      </div>

      {meetings === null ? (
        <p className="card mt-4 p-4 text-sm text-red-600">DBに接続できませんでした。</p>
      ) : meetings.length === 0 ? (
        <p className="mt-6 px-1 text-sm text-muted">会議の記録はまだありません。</p>
      ) : (
        <div className="card mt-4 overflow-hidden">
          <ul className="divide-y divide-line">
            {meetings.map((meeting) => {
              const status = meetingStatusStyle(meeting.status);
              return (
                <li key={meeting.id}>
                  <Link
                    href={`/meetings/${meeting.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-bg active:opacity-60"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{meeting.title}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-faint">
                        {formatJstDateTime(meeting.recordedAt)}
                        {formatDuration(meeting.durationSec) && (
                          <span>{formatDuration(meeting.durationSec)}</span>
                        )}
                        {meeting.calendarEventId && (
                          <span className="inline-flex items-center gap-0.5 text-green-700">
                            <CalendarCheck2 className="h-3 w-3" aria-hidden="true" />
                            カレンダー登録済み
                          </span>
                        )}
                      </span>
                    </div>
                    <span
                      className="chip shrink-0"
                      style={{ backgroundColor: status.bg, color: status.fg }}
                    >
                      {status.label}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-faint" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </main>
  );
}

async function loadMeetings() {
  try {
    return await prisma.meeting.findMany({
      orderBy: { recordedAt: "desc" },
      select: {
        id: true,
        title: true,
        recordedAt: true,
        durationSec: true,
        status: true,
        calendarEventId: true,
      },
    });
  } catch (error) {
    console.error("[会議一覧] 取得失敗:", error);
    return null;
  }
}
