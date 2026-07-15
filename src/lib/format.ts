import { ARTICLES_PER_MESSAGE } from "./config";
import { formatJstTime } from "./datetime";

/**
 * Slackに送るメッセージの整形
 *
 * 要約はしない。タイトルとURLをそのまま箇条書きにする。
 * 出力は「毎回同じ入力なら同じ結果」になる純粋なロジックにしてある（AIに任せない）。
 */

export type ArticleForMessage = {
  title: string; // 表示するタイトル（日本語訳があれば訳、なければ原文）
  url: string;
  sourceName: string; // 情報元の名前（【】で前置する）
};

/**
 * 定期配信用のメッセージ群を作る。
 *
 * 記事が多いときは ARTICLES_PER_MESSAGE 件ごとに分割し、複数メッセージにして返す
 * （Slackは無料なので分割してもコストは増えない。1メッセージが長すぎるのを防ぐ）。
 *
 * @returns 投稿する順のメッセージ文字列の配列（空配列＝送るものなし）
 */
export function buildBroadcastMessages(
  articles: ArticleForMessage[],
  now: Date = new Date(),
): string[] {
  if (articles.length === 0) return [];

  const chunks = chunk(articles, ARTICLES_PER_MESSAGE);
  const totalPages = chunks.length;

  return chunks.map((group, page) => {
    // 1ページ目だけ時刻入りの見出し、2ページ目以降は「(続き 2/3)」を付ける
    const header =
      totalPages === 1
        ? `:newspaper: *AIニュース（${formatJstTime(now)}更新・${articles.length}件）*`
        : page === 0
          ? `:newspaper: *AIニュース（${formatJstTime(now)}更新・${articles.length}件）*`
          : `:newspaper: *AIニュース（続き ${page + 1}/${totalPages}）*`;

    // このページの通し番号は、前ページまでの件数を足して連番にする
    const baseIndex = page * ARTICLES_PER_MESSAGE;
    const lines = group.map((article, i) => toSlackLine(article, baseIndex + i));

    return [header, "", ...lines].join("\n");
  });
}

/** Slackの行：`1. 【情報元】<URL|タイトル>`。リンク化してコンパクトに表示する（unfurlは使わない）。 */
function toSlackLine(article: ArticleForMessage, index: number): string {
  // Slackのリンク記法 <url|text> ではタイトル内の < > & が壊れるためエスケープする
  const safeTitle = escapeSlack(article.title);
  const safeSource = escapeSlack(article.sourceName);
  return `${index + 1}. 【${safeSource}】<${article.url}|${safeTitle}>`;
}

/** Slack mrkdwn で特別扱いされる文字を無害化する。 */
function escapeSlack(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 配列を size 件ずつの塊に分割する。 */
function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}
