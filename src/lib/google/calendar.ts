import type { GoogleAccount } from "@prisma/client";
import { TIMEZONE } from "@/lib/config";
import { getJstDateKey } from "@/lib/datetime";
import { googleApiDelete, googleApiGetJson, googleApiPostJson, listGoogleAccounts } from "./api";

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
  /**
   * 画面に出す出どころラベル。
   * 自分のメインカレンダー → アカウントの表示名（"会社" / "個人"）
   * 共有カレンダー（家族共用など） → カレンダー名
   */
  sourceLabel: string;
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

/** 予定の書き込み権限（calendar.events）を持つアカウントを返す。無ければ null */
export async function findWritableAccount(): Promise<GoogleAccount | null> {
  const accounts = await listGoogleAccounts();
  return (
    accounts.find(
      (a) => a.status === "active" && a.scopes.includes("auth/calendar.events"),
    ) ?? null
  );
}

/**
 * メインカレンダーに予定を作成する（会議機能の自動登録用）。
 * 成功時はイベントIDを返す。権限不足（403）は「要再連携」として呼び出し側で案内する。
 */
export async function createCalendarEvent(
  account: GoogleAccount,
  params: { title: string; description?: string; start: Date; end: Date },
): Promise<{ ok: true; eventId: string } | { ok: false; needsRelink: boolean; error: string }> {
  const result = await googleApiPostJson<{ id: string }>(
    account,
    `${BASE}/calendars/primary/events`,
    {
      summary: params.title,
      description: params.description ?? "",
      start: { dateTime: params.start.toISOString(), timeZone: TIMEZONE },
      end: { dateTime: params.end.toISOString(), timeZone: TIMEZONE },
    },
  );
  if (!result.ok) {
    return {
      ok: false,
      // 401/403 = 権限不足かトークン失効 → 再連携すれば直る
      needsRelink: result.status === 401 || result.status === 403,
      error: result.error,
    };
  }
  return { ok: true, eventId: result.data.id };
}

/** メインカレンダーから予定を削除する（会議削除時の後始末用）。成功=true */
export async function deleteCalendarEvent(
  account: GoogleAccount,
  eventId: string,
): Promise<boolean> {
  return googleApiDelete(
    account,
    `${BASE}/calendars/primary/events/${encodeURIComponent(eventId)}`,
  );
}

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
  return listUpcomingEvents(1, now);
}

/** 全連携アカウントから「今日から◯日分（JST）」の予定を集めて開始時刻順に返す */
export async function listUpcomingEvents(
  days: number,
  now: Date = new Date(),
): Promise<TodayEvent[]> {
  const todayKey = getJstDateKey(now);
  const timeMin = new Date(`${todayKey}T00:00:00+09:00`);
  const timeMax = new Date(timeMin.getTime() + days * 24 * 60 * 60 * 1000);
  return listEventsBetween(timeMin, timeMax);
}

/** 全連携アカウントから任意期間の予定を集めて開始時刻順に返す（過去の月表示にも使う） */
export async function listEventsBetween(timeMin: Date, timeMax: Date): Promise<TodayEvent[]> {
  const accounts = await listGoogleAccounts();
  if (accounts.length === 0) return [];

  // アカウント×カレンダーを並列取得。個々の失敗はnullにして握りつぶす
  const perCalendar = accounts.flatMap((account) =>
    selectedCalendarIds(account).map(async (calendarId) => {
      const params = new URLSearchParams({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: "true", // 繰り返し予定を展開する
        orderBy: "startTime",
        maxResults: "250", // 月表示にも耐える上限
        timeZone: TIMEZONE,
        fields: "summary,items(id,summary,status,start,end)",
      });
      const json = await googleApiGetJson<EventsResponse>(
        account,
        `${BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
      );
      if (!json) return [];

      // 自分のメインカレンダーか（"primary" 指定 or カレンダーID=アカウントのメール）
      const isPrimary = calendarId === "primary" || calendarId === account.email;
      const calendarName = json.summary ?? calendarId;

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
            colorHex: account.colorHex ?? "#709BAD",
            calendarName,
            // メイン=アカウント表示名（会社/個人）、共有=カレンダー名（家族共用など）
            sourceLabel: isPrimary ? account.label : calendarName,
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
