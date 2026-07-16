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
  { name: "AI全般", bg: "#EEF2FF", fg: "#4338CA" }, // インディゴ
  { name: "研究", bg: "#ECFEFF", fg: "#0E7490" }, // シアン
  { name: "プロダクト", bg: "#FFF7ED", fg: "#C2410C" }, // オレンジ
  { name: "国内", bg: "#F0FDF4", fg: "#15803D" }, // グリーン
  { name: "論文", bg: "#FAF5FF", fg: "#7E22CE" }, // パープル
  { name: "動画", bg: "#FFF1F2", fg: "#BE123C" }, // ローズ
];

/** カテゴリ名 → チップ配色。定義外のカテゴリはグレーにフォールバックする。 */
export const CATEGORY_STYLE: Record<string, { bg: string; fg: string }> = Object.fromEntries(
  CATEGORIES.map((c) => [c.name, { bg: c.bg, fg: c.fg }]),
);

/** 定義外カテゴリ用のチップ配色 */
export const CATEGORY_STYLE_FALLBACK = { bg: "#F4F4F5", fg: "#52525B" };

/**
 * タスクの優先度定義（単一定義元）
 * value はDBに保存する数値（大きいほど優先）。
 */
export const TASK_PRIORITIES: { value: number; label: string; bg: string; fg: string }[] = [
  { value: 2, label: "高", bg: "#FEF2F2", fg: "#DC2626" },
  { value: 1, label: "中", bg: "#FFFBEB", fg: "#B45309" },
  { value: 0, label: "低", bg: "#F4F4F5", fg: "#52525B" },
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

/** ニュース一覧（/news）で1ページに表示する件数 */
export const NEWS_LIST_COUNT = 30;
