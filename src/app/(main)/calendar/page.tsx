import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CALENDAR_DAYS_AHEAD } from "@/lib/config";
import { getJstDateKey } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";
import { listUpcomingEvents, type TodayEvent } from "@/lib/google/calendar";
import { EventRow } from "@/components/EventRow";

/**
 * カレンダーページ（/calendar）
 * 全連携アカウントの予定を今日から2週間分、日付ごとにまとめて表示する。
 */

export const dynamic = "force-dynamic";

/** "7月18日（土）" 形式（JST） */
function formatDayHeading(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
    weekday: "short",
  })
    .format(date)
    .replace("(", "（")
    .replace(")", "）");
}

export default async function CalendarPage() {
  const now = new Date();
  const [events, accountCount] = await Promise.all([
    listUpcomingEvents(CALENDAR_DAYS_AHEAD, now).catch((e): TodayEvent[] => {
      console.error("[カレンダー] 取得失敗:", e);
      return [];
    }),
    prisma.googleAccount.count().catch(() => 0),
  ]);

  // 日付キー（JST）ごとにグループ化。日付順は元配列の時系列を保つ
  const groups = new Map<string, { date: Date; events: TodayEvent[] }>();
  for (const event of events) {
    const key = getJstDateKey(event.start);
    const group = groups.get(key) ?? { date: event.start, events: [] };
    group.events.push(event);
    groups.set(key, group);
  }
  const todayKey = getJstDateKey(now);
  const tomorrowKey = getJstDateKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const sortedKeys = Array.from(groups.keys()).sort();

  return (
    <main>
      <h1 className="large-title">カレンダー</h1>
      <p className="mt-1 text-[13px] text-muted">
        今日から{CALENDAR_DAYS_AHEAD}日分の予定（連携した全アカウント・選択したカレンダー）。
      </p>

      {accountCount === 0 ? (
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
      ) : sortedKeys.length === 0 ? (
        <p className="mt-6 px-1 text-sm text-muted">この期間の予定はありません。</p>
      ) : (
        <div className="mt-4 space-y-4">
          {sortedKeys.map((key) => {
            const group = groups.get(key)!;
            const badge = key === todayKey ? "今日" : key === tomorrowKey ? "明日" : null;
            return (
              <section key={key} className="card p-5">
                <h2 className="card-title">
                  {formatDayHeading(group.date)}
                  {badge && <span className="chip bg-accent-soft text-accent">{badge}</span>}
                </h2>
                <ul className="mt-1 divide-y divide-line">
                  {group.events.map((event) => (
                    <EventRow key={event.id} event={event} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
