import Link from "next/link";
import type { TodayEvent } from "@/lib/google/calendar";
import { formatJstTime } from "@/lib/datetime";

/**
 * 予定1行（時刻＋出どころチップ＋タイトル）。
 * ダッシュボードの「今日の予定」とカレンダーページで共用する。
 * チップはアカウント色の淡色背景（HEXに透過を足して生成）。
 * href付き（会議記録など）はタイトルがリンクになる。
 */
export type EventRowItem = TodayEvent & { href?: string };

export function EventRow({ event }: { event: EventRowItem }) {
  return (
    <li className="flex items-center gap-2.5 py-2 text-sm">
      <span className="w-14 shrink-0 text-right font-bold tabular-nums">
        {event.allDay ? "終日" : formatJstTime(event.start)}
      </span>
      {/* 出どころ（会社/個人/家族カレンダー名/会議）。色はアカウント色、背景はその10%透過 */}
      <span
        className="chip shrink-0"
        style={{ backgroundColor: `${event.colorHex}1A`, color: event.colorHex }}
      >
        {event.sourceLabel}
      </span>
      {event.href ? (
        <Link
          href={event.href}
          className="min-w-0 flex-1 truncate font-medium underline underline-offset-2 hover:opacity-70"
        >
          {event.title}
        </Link>
      ) : (
        <span className="min-w-0 flex-1 truncate">{event.title}</span>
      )}
      {!event.allDay && event.end && (
        <span className="shrink-0 text-xs text-faint">〜{formatJstTime(event.end)}</span>
      )}
    </li>
  );
}
