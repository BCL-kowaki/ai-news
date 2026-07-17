import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { getJstDateKey } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";
import { listEventsBetween, type TodayEvent } from "@/lib/google/calendar";
import { EventRow, type EventRowItem } from "@/components/EventRow";

/**
 * カレンダーページ（/calendar）— 月間グリッド表示
 *
 * - 前後の月へ移動でき、過去の予定も見られる（?month=YYYY-MM）
 * - Googleカレンダーの予定（全連携アカウント）に加えて、SERAの会議記録も表示
 *   （赤い「会議」チップ。タップで会議詳細＝文字起こし・レポートへ）
 * - 日付を押すと、その日の予定一覧を下に表示（?day=YYYY-MM-DD）
 */

export const dynamic = "force-dynamic";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
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
  const gridDays: { key: string; inMonth: boolean; isToday: boolean }[] = Array.from(
    { length: 42 },
    (_, i) => {
      const key = getJstDateKey(new Date(gridStart.getTime() + i * DAY_MS + 12 * 60 * 60 * 1000)); // 正午基準でDST等の揺れを回避
      return { key, inMonth: key.startsWith(month), isToday: key === todayKey };
    },
  );
  const gridEnd = new Date(gridStart.getTime() + 42 * DAY_MS);

  // 選択日（未指定なら「今日がこの月なら今日、違う月なら1日」）
  const selectedDay =
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

  // 会議記録を予定と同じ形に変換（タップで詳細へ）
  const meetingEvents: EventRowItem[] = meetings.map((m) => ({
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
    href: `/meetings/${m.id}`,
  }));

  // 日付キー → その日の予定（時刻順。終日が先頭）
  const byDay = new Map<string, EventRowItem[]>();
  for (const event of [...googleEvents, ...meetingEvents]) {
    const key = getJstDateKey(event.start);
    byDay.set(key, [...(byDay.get(key) ?? []), event]);
  }
  byDay.forEach((events, key) => {
    byDay.set(
      key,
      events.sort((a, b) =>
        a.allDay !== b.allDay ? (a.allDay ? -1 : 1) : a.start.getTime() - b.start.getTime(),
      ),
    );
  });

  const selectedEvents = byDay.get(selectedDay) ?? [];

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
        <>
          {/* 月間グリッド */}
          <section className="card mt-4 overflow-hidden" aria-label={monthLabel(month)}>
            <h2 className="border-b-2 border-line px-4 py-3 text-base font-bold">
              {monthLabel(month)}
            </h2>
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
                const events = byDay.get(day.key) ?? [];
                const selected = day.key === selectedDay;
                return (
                  <Link
                    key={day.key}
                    href={`/calendar?month=${month}&day=${day.key}`}
                    aria-label={`${day.key}の予定${events.length > 0 ? `（${events.length}件）` : ""}`}
                    className={`min-h-16 border-b border-r border-line/60 p-1 align-top transition-colors duration-150 hover:bg-bg sm:min-h-20 ${
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
                  </Link>
                );
              })}
            </div>
          </section>

          {/* 選択した日の予定 */}
          <section className="card mt-4 p-5">
            <h2 className="card-title">
              {formatDayHeading(selectedDay)}
              {selectedDay === todayKey && (
                <span className="chip bg-accent-soft text-accent">今日</span>
              )}
            </h2>
            {selectedEvents.length === 0 ? (
              <p className="mt-2 text-sm text-muted">この日の予定はありません。</p>
            ) : (
              <ul className="mt-1 divide-y divide-line">
                {selectedEvents.map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}

/** "7月18日（土）" 形式 */
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
