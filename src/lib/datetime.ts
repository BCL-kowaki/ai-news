import { TIMEZONE } from "./config";

/**
 * 日本時間（JST）を扱うためのユーティリティ
 *
 * VercelのサーバーはUTCで動くため、「今日」「今月」の判定を素直に書くと
 * 日本時間とズレる（UTC 15:00 = JST 翌日0:00）。集計・表示は必ずここを通す。
 */

/** "2026-07" 形式の月キー（無料枠の月次カウント用）。 */
export function getMonthKey(date: Date = new Date()): string {
  const parts = getJstParts(date);
  return `${parts.year}-${parts.month}`;
}

/** 日本時間での「今日の0時00分」をUTCのDateとして返す（1日の送信回数を数えるため）。 */
export function getJstStartOfToday(date: Date = new Date()): Date {
  const { year, month, day } = getJstParts(date);
  // JSTはUTC+9。JSTの0:00は、その日のUTC 15:00（前日）にあたる。
  return new Date(`${year}-${month}-${day}T00:00:00+09:00`);
}

/** "8:00" のような、日本時間の時刻表示（配信メッセージの見出し用）。 */
export function formatJstTime(date: Date = new Date()): string {
  const { hour, minute } = getJstParts(date);
  return `${Number(hour)}:${minute}`;
}

/** Dateを日本時間の年月日時分に分解する。 */
function getJstParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    // hour12:false でも環境により深夜が "24" になることがあるため "00" に補正する
    hour: parts.hour === "24" ? "00" : parts.hour,
    minute: parts.minute,
  };
}
