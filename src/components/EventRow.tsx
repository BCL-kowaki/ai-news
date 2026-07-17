import type { TodayEvent } from "@/lib/google/calendar";
import { formatJstTime } from "@/lib/datetime";

/**
 * 予定1行（時刻＋出どころチップ＋タイトル）。
 * ダッシュボードの「今日の予定」とカレンダーページで共用する。
 * チップはアカウント色の淡色背景（HEXに透過を足して生成）。
 */
export function EventRow({ event }: { event: TodayEvent }) {
  return (
    <li className="flex items-center gap-2.5 py-2 text-sm">
      <span className="w-14 shrink-0 text-right font-bold tabular-nums">
        {event.allDay ? "終日" : formatJstTime(event.start)}
      </span>
      {/* 出どころ（会社/個人/家族カレンダー名）。色はアカウント色、背景はその10%透過 */}
      <span
        className="chip shrink-0"
        style={{ backgroundColor: `${event.colorHex}1A`, color: event.colorHex }}
      >
        {event.sourceLabel}
      </span>
      <span className="min-w-0 flex-1 truncate">{event.title}</span>
      {!event.allDay && event.end && (
        <span className="shrink-0 text-xs text-faint">〜{formatJstTime(event.end)}</span>
      )}
    </li>
  );
}
