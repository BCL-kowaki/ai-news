import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { formatJstTime, getJstDateKey } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";
import { listEventsBetween, type TodayEvent } from "@/lib/google/calendar";
import { CalendarView, type CalendarDay, type CalendarEvent } from "./CalendarView";

/**
 * カレンダーページ（/calendar）— 月間グリッド表示
 *
 * - 前後の月へ移動でき、過去の予定も見られる（?month=YYYY-MM）
 * - Googleカレンダーの予定（全連携アカウント）に加えて、SERAの会議記録も表示
 *   （赤い「会議」チップ。タップで会議詳細＝文字起こし・レポートへ）
 * - 日付の選択はクライアント側で即切り替え（CalendarView）。月の移動だけサーバー再取得
 */

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const MEETING_COLOR = "#C85E47"; // 会議記録のチップ色（アクセント赤）

/** "2026-07" が妥当な月指定か */
function isValidMonth(s: string | undefined): s is string {
  return Boolean(s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s));
}

/** JSTでの曜日（0=日曜）。日付キー "YYYY-MM-DD" から求める */
function jstDayOfWeek(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay(); // 日付部分だけ使うのでUTC扱いでよい
}

/** 月の表示ラベル "2026年7月" */
function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${y}年${Number(m)}月`;
}

/** ym("YYYY-MM") に delta ヶ月足した "YYYY-MM" */
function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: { month?: string; day?: string };
}) {
  const now = new Date();
  const todayKey = getJstDateKey(now);
  const currentMonth = todayKey.slice(0, 7);
  const month = isValidMonth(searchParams.month) ? searchParams.month : currentMonth;

  // グリッドの範囲：月初の週の日曜〜6週間（42日）
  const monthStartKey = `${month}-01`;
  const gridStart = new Date(
    new Date(`${monthStartKey}T00:00:00+09:00`).getTime() - jstDayOfWeek(monthStartKey) * DAY_MS,
  );
  const gridDays: CalendarDay[] = Array.from({ length: 42 }, (_, i) => {
    const key = getJstDateKey(new Date(gridStart.getTime() + i * DAY_MS + 12 * 60 * 60 * 1000)); // 正午基準で揺れを回避
    return { key, inMonth: key.startsWith(month), isToday: key === todayKey };
  });
  const gridEnd = new Date(gridStart.getTime() + 42 * DAY_MS);

  // 選択日の初期値（未指定なら「今日がこの月なら今日、違う月なら1日」）
  const initialSelectedDay =
    searchParams.day && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.day)
      ? searchParams.day
      : month === currentMonth
        ? todayKey
        : monthStartKey;

  // Googleの予定＋SERAの会議記録をグリッド範囲でまとめて取得
  const [googleEvents, meetings, accountCount] = await Promise.all([
    listEventsBetween(gridStart, gridEnd).catch((e): TodayEvent[] => {
      console.error("[カレンダー] 予定の取得に失敗:", e);
      return [];
    }),
    prisma.meeting
      .findMany({
        where: { recordedAt: { gte: gridStart, lt: gridEnd } },
        select: { id: true, title: true, recordedAt: true, durationSec: true },
      })
      .catch(() => []),
    prisma.googleAccount.count().catch(() => 0),
  ]);

  // クライアントへ渡す形に変換（Dateは表示用ラベルへ）
  const toEvent = (e: TodayEvent, href?: string): CalendarEvent & { startMs: number } => ({
    id: e.id,
    title: e.title,
    allDay: e.allDay,
    startLabel: formatJstTime(e.start),
    endLabel: e.end ? formatJstTime(e.end) : null,
    sourceLabel: e.sourceLabel,
    colorHex: e.colorHex,
    href,
    startMs: e.start.getTime(),
  });

  const allEvents = [
    ...googleEvents.map((e) => ({ event: toEvent(e), dateKey: getJstDateKey(e.start) })),
    ...meetings.map((m) => ({
      event: toEvent(
        {
          id: `meeting:${m.id}`,
          title: m.title,
          allDay: false,
          start: m.recordedAt,
          end: m.durationSec ? new Date(m.recordedAt.getTime() + m.durationSec * 1000) : null,
          accountLabel: "会議",
          accountEmail: "",
          colorHex: MEETING_COLOR,
          calendarName: "会議記録",
          sourceLabel: "会議",
        },
        `/meetings/${m.id}`,
      ),
      dateKey: getJstDateKey(m.recordedAt),
    })),
  ];

  // 日付キー → その日の予定（終日→時刻順）
  const eventsByDay: Record<string, CalendarEvent[]> = {};
  for (const { event, dateKey } of allEvents) {
    (eventsByDay[dateKey] ??= []).push(event);
  }
  for (const key of Object.keys(eventsByDay)) {
    eventsByDay[key].sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return (a as CalendarEvent & { startMs: number }).startMs -
        (b as CalendarEvent & { startMs: number }).startMs;
    });
  }

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="large-title">カレンダー</h1>
        {/* 月ナビゲーション */}
        <nav className="flex items-center gap-1" aria-label="月の移動">
          <Link href={`/calendar?month=${addMonths(month, -1)}`} className="btn-ghost" aria-label="前の月">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link href="/calendar" className="btn-ghost">
            今日
          </Link>
          <Link href={`/calendar?month=${addMonths(month, 1)}`} className="btn-ghost" aria-label="次の月">
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </nav>
      </div>
      <p className="mt-1 text-[13px] text-muted">
        Googleカレンダーの予定と、SERAの会議記録（赤い「会議」）をまとめて表示します。
      </p>

      {accountCount === 0 && meetings.length === 0 ? (
        <div className="card mt-4 p-5">
          <p className="text-sm leading-relaxed text-muted">
            Googleカレンダーがまだ連携されていません。
          </p>
          <Link
            href="/settings"
            className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-accent hover:underline"
          >
            設定で連携する
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <CalendarView
          monthLabel={monthLabel(month)}
          gridDays={gridDays}
          eventsByDay={eventsByDay}
          todayKey={todayKey}
          initialSelectedDay={initialSelectedDay}
        />
      )}
    </main>
  );
}
