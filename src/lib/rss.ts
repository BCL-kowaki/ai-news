import Parser from "rss-parser";
import { FETCH_WINDOW_HOURS, RSS_TIMEOUT_MS } from "./config";

/**
 * RSSフィードの取得とパース
 *
 * 収集時はタイトル・URLに加え、本文抜粋（contentText）も取り出して保存する。
 * この抜粋は、あとで画面から「翻訳」「要約」を押したときの入力に使う（収集時は翻訳・要約しない）。
 */

/** 本文抜粋として保存する最大文字数（DeepL/要約の入力を無駄に大きくしないため）。 */
const CONTENT_TEXT_MAX = 2000;

export type FetchedItem = {
  title: string;
  url: string;
  publishedAt: Date;
  contentText: string | null; // RSSの説明/本文抜粋（arXivは要旨）。無い場合はnull
};

const parser = new Parser({
  timeout: RSS_TIMEOUT_MS,
  headers: {
    // User-Agentを付けないと弾くRSSサーバーがあるため明示する
    "User-Agent": "ai-news/1.0 (personal RSS reader)",
  },
});

/**
 * 1つのRSSフィードを取得し、鮮度の条件を満たす記事だけを返す。
 * 失敗しても例外を投げず空配列を返す（1ソースの障害で全体を止めないため）。
 */
export async function fetchFeed(feedUrl: string, now: Date = new Date()): Promise<FetchedItem[]> {
  const cutoff = new Date(now.getTime() - FETCH_WINDOW_HOURS * 60 * 60 * 1000);

  let feed: Parser.Output<Record<string, unknown>>;
  try {
    feed = await parser.parseURL(feedUrl);
  } catch (error) {
    console.error(`[RSS] 取得失敗: ${feedUrl}`, error instanceof Error ? error.message : error);
    return [];
  }

  const items: FetchedItem[] = [];

  for (const item of feed.items ?? []) {
    const title = item.title?.trim();
    const url = normalizeUrl(item.link);
    if (!title || !url) continue;

    // 日付が無い/壊れているフィードもあるため、その場合は「今」とみなして取り込む
    const publishedAt = parseDate(item.isoDate ?? item.pubDate) ?? now;
    if (publishedAt < cutoff) continue;

    items.push({ title, url, publishedAt, contentText: extractContent(item) });
  }

  return items;
}

/**
 * RSSアイテムから本文抜粋を取り出す。
 * contentSnippet（HTMLタグ除去済みの要約）を優先し、無ければ content を使う。
 * arXivは要旨（abstract）がここに入る。長すぎる場合は先頭を切り出す。
 */
function extractContent(item: Record<string, unknown>): string | null {
  const raw =
    (typeof item.contentSnippet === "string" && item.contentSnippet) ||
    (typeof item.content === "string" && item.content) ||
    (typeof item.summary === "string" && item.summary) ||
    "";
  // HTMLタグを除去し、連続する空白を1つにまとめる
  const text = raw
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  return text.length > CONTENT_TEXT_MAX ? `${text.slice(0, CONTENT_TEXT_MAX)}…` : text;
}

/**
 * URLの正規化と検証。
 * セキュリティ: http / https 以外のスキーム（javascript: 等）は受け付けない。
 */
function normalizeUrl(link: string | undefined): string | null {
  if (!link) return null;
  try {
    const parsed = new URL(link.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
