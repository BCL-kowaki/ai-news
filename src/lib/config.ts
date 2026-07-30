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
 * ニュースのカテゴリ（記事の内容で分類する。単一定義元）
 *
 * ここの並び順が、ニュース一覧やダッシュボードの表示順になる。
 * bg/fg はチップ（タグ）の背景色と文字色。文字色はコントラスト比4.5:1以上を守る。
 *
 * 判定は記事ごとに行い `Article.category` に保存する（src/lib/classify.ts）。
 * - 動画: YouTubeソースの記事は判定せず固定
 * - 研究: arXivソースの記事は判定せず固定
 * - それ以外: AI（Haiku）が 経済 / 研究 / 技術 / エンタメ のどれかを選ぶ
 *
 * description はAI判定時のプロンプトにそのまま渡すため、変えると分類基準が変わる。
 */
export const CATEGORIES: {
  name: string;
  slug: string; // ファイル名・URL用のASCII名（日本語名は署名付きURL等で壊れるため）
  bg: string;
  fg: string;
  description: string;
}[] = [
  // エディトリアル調の暖色パステル（文字は共通の濃茶。枠線は .chip が付ける）
  {
    name: "経済",
    slug: "economy",
    bg: "#F4DFBD",
    fg: "#382C28",
    description: "AIをめぐる経済・金融・投資・資金調達・企業買収・規制や政策・世界情勢",
  },
  {
    name: "研究",
    slug: "research",
    bg: "#E7DDEA",
    fg: "#382C28",
    description: "論文・学術研究・実験結果・ベンチマーク・大学や研究機関の発表",
  },
  {
    name: "技術",
    slug: "tech",
    bg: "#DCE9ED",
    fg: "#382C28",
    description: "モデルやプロダクトのリリース・技術解説・開発ツール・実装や使い方",
  },
  {
    name: "エンタメ",
    slug: "entertainment",
    bg: "#F4D5CD",
    fg: "#382C28",
    description: "映像・音楽・ゲーム・芸能・SNS話題など娯楽寄りの話題",
  },
  {
    name: "動画",
    slug: "video",
    bg: "#F3E0CC",
    fg: "#382C28",
    description: "YouTube等の動画コンテンツ（ソースで自動判定）",
  },
];

/** AIに判定させるカテゴリ（動画はソースで決まるので対象外） */
export const CLASSIFIABLE_CATEGORIES = CATEGORIES.filter((c) => c.name !== "動画");

/** カテゴリ名 → チップ配色。定義外のカテゴリはグレーにフォールバックする。 */
export const CATEGORY_STYLE: Record<string, { bg: string; fg: string }> = Object.fromEntries(
  CATEGORIES.map((c) => [c.name, { bg: c.bg, fg: c.fg }]),
);

/** カテゴリ名 → ASCIIスラッグ。定義外は "other"。 */
export const CATEGORY_SLUG: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.name, c.slug]),
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

/**
 * プロジェクトの色プリセット（タスクに付けるチップの色）
 * 作成順にこの色が割り当てられる。使い切ったら先頭に戻る。
 */
export const PROJECT_COLORS = [
  "#709BAD", // ブルーグレー
  "#8DA377", // セージグリーン
  "#DF923F", // オレンジ
  "#9A7BA8", // パープル
  "#C85E47", // レンガ赤
  "#6E8B8B", // ティール
];

/** ダッシュボードの各カードに表示する件数 */
export const DASHBOARD_TASK_COUNT = 5; // タスクカード
export const DASHBOARD_NEWS_COUNT = 6; // ニュースダイジェスト
export const DASHBOARD_QUICK_MEMO_COUNT = 3; // 突発メモの直近表示
export const DASHBOARD_PINNED_MEMO_COUNT = 4; // よく使うメモ
export const DASHBOARD_MAIL_COUNT = 20; // メールカード（全アカウント横断・スクロール表示）

/** ブリーフィング生成に使う受信メールの件数（全アカウント合算の上限） */
export const BRIEFING_MAIL_COUNT = 50;

/** ニュース音声（ジャンル別・受信箱まとめ）のダイジェストに使う記事数 */
export const NEWS_AUDIO_DIGEST_COUNT = 15;

/** ブリーフィングの「今日の注目ニュース」に渡す記事数（直近24時間・カテゴリ別に要約させる） */
export const BRIEFING_NEWS_COUNT = 40;

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

/**
 * メモ本文の最大文字数（作成・自動保存・編集すべて共通）
 *
 * ここを単一の上限にすること。作成と更新で値がずれると、
 * 長いメモを編集した瞬間に後半が黙って消える（過去に実際に起きた不具合）。
 */
export const MEMO_BODY_MAX_LENGTH = 10_000;

/** 1つのメモに付けられる添付ファイルの数 */
export const MEMO_ATTACHMENT_MAX = 10;

/** ゴミ箱のメモを完全削除するまでの日数（iPhoneメモ帳と同じ30日） */
export const TRASH_RETENTION_DAYS = 30;

/** メモ一覧のプレビューに出す本文の文字数（1行目=タイトルを除いた部分） */
export const MEMO_PREVIEW_LENGTH = 90;

/**
 * メモ一覧のスワイプ操作（iPhoneメモ帳と同じ操作感の調整値）
 *
 * - ACTION_WIDTH … スワイプで顔を出す操作ボタン1つぶんの幅(px)
 * - START_PX     … 横スワイプと判定し始める移動量(px)。小さすぎると縦スクロールを奪う
 * - COMMIT_EXTRA_PX … ボタンを出し切った位置から、さらにこれだけ引っ張ると指を離した瞬間に実行する
 *
 * ※ 実行の判定に「画面幅の◯割」を使ってはいけない。
 *   幅が 0 と報告される場面（描画前・非表示など）があり、その場合に
 *   しきい値も 0 になって「ほんの少し滑らせただけで削除が走る」事故になる。
 *   ボタンの幅を基準にした固定距離なら、幅が取れなくても安全側で動く。
 */
export const MEMO_SWIPE_ACTION_WIDTH = 88;
export const MEMO_SWIPE_START_PX = 12;
export const MEMO_SWIPE_COMMIT_EXTRA_PX = 66;

/** 長押しでメニューを出すまでの時間(ミリ秒) */
export const MEMO_LONG_PRESS_MS = 500;

/** メモ一覧の並び替え（単一定義元。URLの ?sort= の値になる） */
export const MEMO_SORTS = [
  { value: "updated", label: "編集日順" },
  { value: "created", label: "作成日順" },
  { value: "title", label: "タイトル順" },
] as const;

export type MemoSort = (typeof MEMO_SORTS)[number]["value"];

/** ?sort= の文字列を安全な並び替えキーに直す（不正値は編集日順） */
export function toMemoSort(value: string | undefined): MemoSort {
  return MEMO_SORTS.some((s) => s.value === value) ? (value as MemoSort) : "updated";
}

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
