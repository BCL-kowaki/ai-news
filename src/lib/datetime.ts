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

/** "2026-07-17" 形式の日付キー（JST基準）。ブリーフィングの1日1件判定などに使う。 */
export function getJstDateKey(date: Date = new Date()): string {
  const { year, month, day } = getJstParts(date);
  return `${year}-${month}-${day}`;
}

/**
 * タスク期限の表示ラベル（JST基準）。
 * 「今日」「明日」はそのまま、他は "7/20(月)" 形式。overdue=trueなら期限切れ。
 */
export function formatDueLabel(due: Date, now: Date = new Date()): { label: string; overdue: boolean } {
  const dueKey = getJstDateKey(due);
  const todayKey = getJstDateKey(now);
  const tomorrowKey = getJstDateKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));

  if (dueKey === todayKey) return { label: "今日", overdue: false };
  if (dueKey === tomorrowKey) return { label: "明日", overdue: false };

  const label = new Intl.DateTimeFormat("ja-JP", {
    timeZone: TIMEZONE,
    month: "numeric",
    day: "numeric",
    weekday: "short",
  })
    .format(due)
    .replace("(", "（")
    .replace(")", "）");
  return { label, overdue: dueKey < todayKey };
}

/** "7/17 08:30" 形式の日時表示（記事一覧などの汎用フォーマット。JST基準）。 */
export function formatJstDateTime(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: TIMEZONE,
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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
