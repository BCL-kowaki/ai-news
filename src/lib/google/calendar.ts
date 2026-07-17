import type { GoogleAccount } from "@prisma/client";
import { TIMEZONE } from "@/lib/config";
import { getJstDateKey } from "@/lib/datetime";
import { googleApiGetJson, listGoogleAccounts } from "./api";

/**
 * Googleカレンダーの取得（読み取り専用）
 *
 * 各連携アカウントの「選択されたカレンダー」（家族共用カレンダー含む）から
 * 今日の予定を集め、開始時刻順に統合する。
 * 1アカウント・1カレンダーの失敗は全体を止めない（フェイルセーフ）。
 */

const BASE = "https://www.googleapis.com/calendar/v3";

export type CalendarInfo = {
  id: string;
  name: string;
  primary: boolean;
};

export type TodayEvent = {
  id: string;
  title: string;
  allDay: boolean;
  start: Date; // 終日イベントはその日のJST 0:00
  end: Date | null;
  accountLabel: string;
  accountEmail: string;
  colorHex: string;
  calendarName: string;
};

type CalendarListResponse = {
  items?: { id: string; summary: string; summaryOverride?: string; primary?: boolean }[];
};

type EventsResponse = {
  summary?: string; // カレンダー名
  items?: {
    id: string;
    summary?: string;
    status?: string;
    start?: { date?: string; dateTime?: string };
    end?: { date?: string; dateTime?: string };
  }[];
};

/** アカウントが購読しているカレンダーの一覧（設定画面の選択UI用） */
export async function listCalendars(account: GoogleAccount): Promise<CalendarInfo[] | null> {
  const json = await googleApiGetJson<CalendarListResponse>(
    account,
    `${BASE}/users/me/calendarList?minAccessRole=reader&fields=items(id,summary,summaryOverride,primary)`,
  );
  if (!json) return null;
  return (json.items ?? []).map((c) => ({
    id: c.id,
    name: c.summaryOverride || c.summary,
    primary: Boolean(c.primary),
  }));
}

/** アカウントの表示対象カレンダーID（未設定ならprimaryのみ） */
export function selectedCalendarIds(account: GoogleAccount): string[] {
  const ids = Array.isArray(account.calendarIds)
    ? (account.calendarIds as unknown[]).filter((v): v is string => typeof v === "string")
    : [];
  return ids.length > 0 ? ids : ["primary"];
}

/** 全連携アカウントから「今日（JST）」の予定を集めて開始時刻順に返す */
export async function listTodayEvents(now: Date = new Date()): Promise<TodayEvent[]> {
  const accounts = await listGoogleAccounts();
  if (accounts.length === 0) return [];

  const todayKey = getJstDateKey(now);
  const timeMin = new Date(`${todayKey}T00:00:00+09:00`);
  const timeMax = new Date(timeMin.getTime() + 24 * 60 * 60 * 1000);

  // アカウント×カレンダーを並列取得。個々の失敗はnullにして握りつぶす
  const perCalendar = accounts.flatMap((account) =>
    selectedCalendarIds(account).map(async (calendarId) => {
      const params = new URLSearchParams({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: "true", // 繰り返し予定を展開する
        orderBy: "startTime",
        maxResults: "20",
        timeZone: TIMEZONE,
        fields: "summary,items(id,summary,status,start,end)",
      });
      const json = await googleApiGetJson<EventsResponse>(
        account,
        `${BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
      );
      if (!json) return [];
      return (json.items ?? [])
        .filter((e) => e.status !== "cancelled")
        .map((e): TodayEvent => {
          const allDay = Boolean(e.start?.date);
          const start = allDay
            ? new Date(`${e.start?.date}T00:00:00+09:00`)
            : new Date(e.start?.dateTime ?? timeMin.toISOString());
          const end = allDay
            ? null
            : e.end?.dateTime
              ? new Date(e.end.dateTime)
              : null;
          return {
            id: `${account.id}:${calendarId}:${e.id}`,
            title: e.summary || "（タイトルなし）",
            allDay,
            start,
            end,
            accountLabel: account.label,
            accountEmail: account.email,
            colorHex: account.colorHex ?? "#007AFF",
            calendarName: json.summary ?? calendarId,
          };
        });
    }),
  );

  const settled = await Promise.all(perCalendar);
  const events = settled.flat();

  // 同一予定の重複排除（同じ予定が複数アカウントに共有されているケース）:
  // タイトル＋開始時刻が同じものは最初の1件だけ残す
  const seen = new Set<string>();
  const unique = events.filter((e) => {
    const key = `${e.title}|${e.start.getTime()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 終日イベントを先頭に、あとは開始時刻順
  return unique.sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return a.start.getTime() - b.start.getTime();
  });
}
