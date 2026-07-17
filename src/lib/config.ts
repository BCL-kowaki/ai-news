/**
 * システム全体の定数（単一定義元）
 *
 * 数値・分類を変えたいときは必ずこのファイルだけを編集する。
 * 他のファイルにローカル定数を作らないこと（設定が二重管理になるため）。
 */

/** RSS収集で取り込む記事の鮮度（時間）。これより古い記事は無視する。 */
export const FETCH_WINDOW_HOURS = 48;

/** RSSフィード1本あたりの取得タイムアウト（ミリ秒）。 */
export const RSS_TIMEOUT_MS = 10_000;

/** 表示・集計に使うタイムゾーン。 */
export const TIMEZONE = "Asia/Tokyo";

/**
 * ニュースのジャンル（カテゴリ）定義（単一定義元）
 *
 * ここの並び順が、ニュース一覧やダッシュボードの表示順になる。
 * src/lib/sources.ts の各ソースの category は、この name のどれかに一致させること。
 * bg/fg はチップ（タグ）の背景色と文字色。文字色はコントラスト比4.5:1以上を守る。
 */
export const CATEGORIES: { name: string; bg: string; fg: string }[] = [
  // エディトリアル調の暖色パステル（文字は共通の濃茶。枠線は .chip が付ける）
  { name: "AI全般", bg: "#F4DFBD", fg: "#382C28" }, // アンバー
  { name: "研究", bg: "#DCE9ED", fg: "#382C28" }, // ブルーグレー
  { name: "プロダクト", bg: "#F4D5CD", fg: "#382C28" }, // テラコッタ
  { name: "国内", bg: "#E0E7D7", fg: "#382C28" }, // セージ
  { name: "論文", bg: "#E7DDEA", fg: "#382C28" }, // ラベンダー
  { name: "動画", bg: "#F3E0CC", fg: "#382C28" }, // ピーチ
];

/** カテゴリ名 → チップ配色。定義外のカテゴリはグレーにフォールバックする。 */
export const CATEGORY_STYLE: Record<string, { bg: string; fg: string }> = Object.fromEntries(
  CATEGORIES.map((c) => [c.name, { bg: c.bg, fg: c.fg }]),
);

/** 定義外カテゴリ用のチップ配色 */
export const CATEGORY_STYLE_FALLBACK = { bg: "#EFE7D8", fg: "#382C28" };

/**
 * タスクの優先度定義（単一定義元）
 * value はDBに保存する数値（大きいほど優先）。
 */
export const TASK_PRIORITIES: { value: number; label: string; bg: string; fg: string }[] = [
  { value: 2, label: "高", bg: "#F4D5CD", fg: "#A84A36" }, // レンガ赤
  { value: 1, label: "中", bg: "#F4DFBD", fg: "#8A5A1F" }, // アンバー
  { value: 0, label: "低", bg: "#EFE7D8", fg: "#8A7A70" }, // 薄茶
];

/** 優先度の数値 → 表示定義。定義外は「中」にフォールバックする。 */
export function priorityStyle(value: number) {
  return TASK_PRIORITIES.find((p) => p.value === value) ?? TASK_PRIORITIES[1];
}

/** ダッシュボードの各カードに表示する件数 */
export const DASHBOARD_TASK_COUNT = 5; // タスクカード
export const DASHBOARD_NEWS_COUNT = 6; // ニュースダイジェスト
export const DASHBOARD_QUICK_MEMO_COUNT = 3; // 突発メモの直近表示
export const DASHBOARD_PINNED_MEMO_COUNT = 4; // よく使うメモ
export const DASHBOARD_MAIL_COUNT = 3; // メールカード（全アカウント横断）

/** /mail ページで1アカウントあたり表示するメール件数 */
export const MAIL_LIST_COUNT = 10;

/** カレンダーページ（/calendar）で表示する日数（今日から） */
export const CALENDAR_DAYS_AHEAD = 14;

/**
 * Google連携アカウントの色プリセット（予定・メールの色分けに使う）
 * 連携した順にこの色が割り当てられる。エディトリアル調の落ち着いた色。
 */
export const GOOGLE_ACCOUNT_COLORS = [
  "#709BAD", // ブルーグレー（1人目＝個人など）
  "#8DA377", // セージグリーン（2人目＝会社など）
  "#DF923F", // オレンジ
  "#9A7BA8", // パープル
  "#C85E47", // レンガ赤
];

/** ニュース一覧（/news）で1ページに表示する件数 */
export const NEWS_LIST_COUNT = 30;

/** 会議の処理状態 → 表示ラベル・チップ配色（単一定義元） */
export const MEETING_STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  recorded: { label: "未処理", bg: "#EFE7D8", fg: "#8A7A70" },
  transcribing: { label: "文字起こし中…", bg: "#F4DFBD", fg: "#8A5A1F" },
  transcribed: { label: "文字起こし済み", bg: "#DCE9ED", fg: "#4A6B7A" },
  summarizing: { label: "レポート生成中…", bg: "#F4DFBD", fg: "#8A5A1F" },
  done: { label: "レポート済み", bg: "#E0E7D7", fg: "#556844" },
  error: { label: "エラー", bg: "#F4D5CD", fg: "#A84A36" },
};

/** 会議状態の表示定義を返す（未知の状態はグレー） */
export function meetingStatusStyle(status: string) {
  return MEETING_STATUS[status] ?? MEETING_STATUS.recorded;
}
