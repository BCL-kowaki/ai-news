import { ARTICLES_PER_MESSAGE, CATEGORIES, CATEGORY_EMOJI } from "./config";
import { formatJstTime } from "./datetime";

/**
 * Slackに送るメッセージの整形
 *
 * 要約はしない。タイトル（英語は日本語訳）とURLを箇条書きにする。
 * ジャンル（カテゴリ）ごとに見出しを分けて、1ジャンル＝1メッセージ（多ければ分割）で出す。
 * 出力は「毎回同じ入力なら同じ結果」になる純粋なロジックにしてある（AIに任せない）。
 */

export type ArticleForMessage = {
  title: string; // 表示するタイトル（日本語訳があれば訳、なければ原文）
  url: string;
  sourceName: string; // 情報元の名前（【】で前置する）
  category: string; // ジャンル（見出しのグルーピングに使う）
};

/**
 * 配信用のメッセージ群を作る。
 *
 * ジャンルごとにまとめ、CATEGORIES の並び順で見出しを付ける。
 * 1ジャンルの記事が多いときは ARTICLES_PER_MESSAGE 件ごとに分割する
 * （Slackは無料なので分割してもコストは増えない。1メッセージが長すぎるのを防ぐ）。
 *
 * @returns 投稿する順のメッセージ文字列の配列（空配列＝送るものなし）
 */
export function buildBroadcastMessages(
  articles: ArticleForMessage[],
  now: Date = new Date(),
): string[] {
  if (articles.length === 0) return [];

  const messages: string[] = [];

  for (const { category, items } of groupByCategory(articles)) {
    const emoji = CATEGORY_EMOJI[category] ?? "📰";
    const chunks = chunk(items, ARTICLES_PER_MESSAGE);

    chunks.forEach((group, page) => {
      // 1ページ目は時刻＋ジャンル名＋件数、2ページ目以降は「続き」表示
      const header =
        page === 0
          ? `${emoji} *AIニュース（${formatJstTime(now)}更新）｜${category}（${items.length}件）*`
          : `${emoji} *${category}（続き ${page + 1}/${chunks.length}）*`;

      // 番号はジャンル内の通し番号（前ページまでの件数を足す）
      const baseIndex = page * ARTICLES_PER_MESSAGE;
      const lines = group.map((article, i) => toSlackLine(article, baseIndex + i));

      messages.push([header, "", ...lines].join("\n"));
    });
  }

  return messages;
}

/**
 * 記事をジャンルごとにまとめる。
 * CATEGORIES の順で並べ、定義外のカテゴリがあれば最後に回す（取りこぼさない）。
 */
function groupByCategory(
  articles: ArticleForMessage[],
): { category: string; items: ArticleForMessage[] }[] {
  const byCategory = new Map<string, ArticleForMessage[]>();
  for (const article of articles) {
    const list = byCategory.get(article.category) ?? [];
    list.push(article);
    byCategory.set(article.category, list);
  }

  const orderedNames = CATEGORIES.map((c) => c.name);
  // 定義済みカテゴリ → 定義順、その他 → 出現順で末尾に
  const extras = Array.from(byCategory.keys()).filter((name) => !orderedNames.includes(name));
  const order = [...orderedNames, ...extras];

  return order
    .filter((name) => byCategory.has(name))
    .map((name) => ({ category: name, items: byCategory.get(name)! }));
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
