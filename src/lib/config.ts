/**
 * システム全体の定数（単一定義元）
 *
 * 数値を変えたいときは必ずこのファイルだけを編集する。
 * 他のファイルにローカル定数を作らないこと（設定が二重管理になるため）。
 */

/**
 * 1回の配信で投稿する記事の上限。
 * Slackは無料で何通でも送れるが、1度に大量投稿すると読みにくく通知もうるさいため上限を設ける。
 * これを超える未送信記事は skipped にして捨てる（古いニュースを延々と流さないため）。
 */
export const MAX_ARTICLES_PER_BROADCAST = 30;

/**
 * 1つのSlackメッセージに載せる記事数。
 * 上限（MAX_ARTICLES_PER_BROADCAST）に達した分は、この件数ごとに分割して複数メッセージで送る。
 * Slackのメッセージは長すぎると折りたたまれるため、程よい塊にする。
 */
export const ARTICLES_PER_MESSAGE = 10;

/** 分割送信するときの、メッセージ間の待ち時間（ミリ秒）。Slackのレート制限（毎秒1通程度）に配慮。 */
export const SLACK_MESSAGE_INTERVAL_MS = 1_100;

/** RSS収集で取り込む記事の鮮度（時間）。これより古い記事は無視する。 */
export const FETCH_WINDOW_HOURS = 48;

/** RSSフィード1本あたりの取得タイムアウト（ミリ秒）。 */
export const RSS_TIMEOUT_MS = 10_000;

/** 表示・集計に使うタイムゾーン。 */
export const TIMEZONE = "Asia/Tokyo";

/**
 * ジャンル（カテゴリ）の定義（単一定義元）
 *
 * 配信の見出しグルーピングと、ダッシュボードのジャンルボタンは、この定義を使う。
 * ここの並び順が、配信メッセージやボタンの表示順になる。
 * src/lib/sources.ts の各ソースの category は、この name のどれかに一致させること。
 */
export const CATEGORIES: { name: string; emoji: string }[] = [
  { name: "AI全般", emoji: "📰" },
  { name: "研究", emoji: "🔬" },
  { name: "プロダクト", emoji: "🚀" },
  { name: "国内", emoji: "🗾" },
  { name: "論文", emoji: "📄" },
];

/** カテゴリ名 → 絵文字。定義外のカテゴリは既定の絵文字にフォールバックする。 */
export const CATEGORY_EMOJI: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.name, c.emoji]),
);

/** 手動ジャンル通知（ダッシュボードのボタン）で1回に送る記事数。 */
export const MANUAL_NOTIFY_COUNT = 15;
