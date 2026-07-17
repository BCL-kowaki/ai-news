"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * 月間カレンダーのグリッド＋選択日の予定表示（クライアント側）
 *
 * 月のデータはサーバーからまとめて受け取り、日付のクリックは
 * ページ遷移なしで即座に切り替える（useState）。月の移動だけサーバー再取得。
 */

export type CalendarEvent = {
  id: string;
  title: string;
  allDay: boolean;
  startLabel: string; // "12:30"（終日は使わない）
  endLabel: string | null; // "13:30" など
  sourceLabel: string;
  colorHex: string;
  href?: string; // 会議記録は詳細ページへ
};

export type CalendarDay = {
  key: string; // "2026-07-17"
  inMonth: boolean;
  isToday: boolean;
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/** "7月18日（土）" 形式（クライアントでもJST固定で整形） */
function formatDayHeading(dateKey: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
    weekday: "short",
  })
    .format(new Date(`${dateKey}T12:00:00+09:00`))
    .replace("(", "（")
    .replace(")", "）");
}

export function CalendarView({
  monthLabel,
  gridDays,
  eventsByDay,
  todayKey,
  initialSelectedDay,
}: {
  monthLabel: string;
  gridDays: CalendarDay[];
  eventsByDay: Record<string, CalendarEvent[]>;
  todayKey: string;
  initialSelectedDay: string;
}) {
  const [selectedDay, setSelectedDay] = useState(initialSelectedDay);
  const selectedEvents = eventsByDay[selectedDay] ?? [];

  /** 日付選択（遷移なし）。URLだけ静かに更新してリロードや共有にも耐える */
  function selectDay(key: string) {
    setSelectedDay(key);
    const url = new URL(window.location.href);
    url.searchParams.set("day", key);
    window.history.replaceState(null, "", url.toString());
  }

  return (
    <>
      {/* 月間グリッド */}
      <section className="card mt-4 overflow-hidden" aria-label={monthLabel}>
        <h2 className="border-b-2 border-line px-4 py-3 text-base font-bold">{monthLabel}</h2>
        <div className="grid grid-cols-7 border-b border-line text-center">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={`py-1.5 text-xs font-bold ${
                i === 0 ? "text-accent" : i === 6 ? "text-[#4A6B7A]" : "text-muted"
              }`}
            >
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {gridDays.map((day) => {
            const events = eventsByDay[day.key] ?? [];
            const selected = day.key === selectedDay;
            return (
              <button
                key={day.key}
                type="button"
                onClick={() => selectDay(day.key)}
                aria-label={`${day.key}の予定${events.length > 0 ? `（${events.length}件）` : ""}`}
                aria-pressed={selected}
                className={`min-h-16 cursor-pointer border-b border-r border-line/60 p-1 text-left align-top transition-colors duration-150 hover:bg-bg sm:min-h-20 ${
                  day.inMonth ? "" : "opacity-35"
                } ${selected ? "bg-accent-soft/60" : ""}`}
              >
                <span
                  className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold sm:mx-0 ${
                    day.isToday ? "bg-accent text-card" : ""
                  }`}
                >
                  {Number(day.key.slice(8))}
                </span>
                {/* 予定：PCはタイトル・スマホはドットで表示 */}
                <span className="mt-0.5 hidden sm:block">
                  {events.slice(0, 3).map((e) => (
                    <span
                      key={e.id}
                      className="mb-0.5 block truncate rounded px-1 text-[10px] font-semibold leading-4"
                      style={{ backgroundColor: `${e.colorHex}22`, color: e.colorHex }}
                    >
                      {e.title}
                    </span>
                  ))}
                  {events.length > 3 && (
                    <span className="block px-1 text-[10px] text-faint">
                      +{events.length - 3}件
                    </span>
                  )}
                </span>
                <span className="mt-1 flex flex-wrap justify-center gap-0.5 sm:hidden">
                  {events.slice(0, 4).map((e) => (
                    <span
                      key={e.id}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: e.colorHex }}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 選択した日の予定（クリックで即切り替え） */}
      <section className="card mt-4 p-5">
        <h2 className="card-title">
          {formatDayHeading(selectedDay)}
          {selectedDay === todayKey && <span className="chip bg-accent-soft text-accent">今日</span>}
        </h2>
        {selectedEvents.length === 0 ? (
          <p className="mt-2 text-sm text-muted">この日の予定はありません。</p>
        ) : (
          <ul className="mt-1 divide-y divide-line">
            {selectedEvents.map((event) => (
              <li key={event.id} className="flex items-center gap-2.5 py-2 text-sm">
                <span className="w-14 shrink-0 text-right font-bold tabular-nums">
                  {event.allDay ? "終日" : event.startLabel}
                </span>
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
                {!event.allDay && event.endLabel && (
                  <span className="shrink-0 text-xs text-faint">〜{event.endLabel}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
