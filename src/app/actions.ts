"use server";

import { notifyByCategory } from "@/lib/notify";
import { prisma } from "@/lib/prisma";
import { summarizeToJa } from "@/lib/summarize";
import { translateOneToJa } from "@/lib/translate";

/**
 * サーバーアクション：指定ジャンルの最新記事をSlackへ通知する。
 *
 * "use server" 宣言により、この関数はサーバー側でのみ実行される。
 * SLACK_WEBHOOK_URL 等の秘密情報はブラウザに一切渡らない。
 */
export async function sendGenreNotification(
  category: string,
): Promise<{ ok: boolean; count: number; error?: string }> {
  try {
    const { count } = await notifyByCategory(category);
    return { ok: true, count };
  } catch (error) {
    const message = error instanceof Error ? error.message : "通知に失敗しました";
    console.error("[手動通知] 失敗:", message);
    return { ok: false, count: 0, error: message };
  }
}

/**
 * サーバーアクション：1記事の本文抜粋を日本語に翻訳する（オンデマンド）。
 * DeepLの無料枠を守るため、押した記事だけを処理する。
 */
export async function translateArticle(
  articleId: string,
): Promise<{ ok: boolean; text: string }> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { contentText: true },
  });
  if (!article?.contentText) {
    return { ok: false, text: "この記事には翻訳できる本文（抜粋）がありません。" };
  }
  const translated = await translateOneToJa(article.contentText);
  return translated
    ? { ok: true, text: translated }
    : { ok: false, text: "翻訳できませんでした（DeepLの設定・無料枠を確認してください）。" };
}

/**
 * サーバーアクション：1記事を日本語で要約する（オンデマンド・Claude Haiku）。
 */
export async function summarizeArticle(
  articleId: string,
): Promise<{ ok: boolean; text: string }> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { title: true, titleJa: true, contentText: true },
  });
  if (!article) {
    return { ok: false, text: "記事が見つかりませんでした。" };
  }
  return summarizeToJa(article.titleJa ?? article.title, article.contentText ?? "");
}
