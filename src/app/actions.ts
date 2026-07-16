"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { prisma } from "@/lib/prisma";
import { summarizeToJa } from "@/lib/summarize";
import { translateOneToJa } from "@/lib/translate";

/**
 * 記事のサーバーアクション（翻訳・要約。どちらもオンデマンド）
 *
 * "use server" 宣言により、この関数はサーバー側でのみ実行される。
 * APIキー等の秘密情報はブラウザに一切渡らない。
 * ログイン中のユーザーからの実行だけを許可する（多層防御）。
 */

async function assertLoggedIn(): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("ログインが必要です");
}

/**
 * 1記事の本文抜粋を日本語に翻訳する（オンデマンド）。
 * DeepLの無料枠を守るため、押した記事だけを処理する。
 */
export async function translateArticle(
  articleId: string,
): Promise<{ ok: boolean; text: string }> {
  await assertLoggedIn();

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
 * 1記事を日本語で要約する（オンデマンド・Claude Haiku）。
 */
export async function summarizeArticle(
  articleId: string,
): Promise<{ ok: boolean; text: string }> {
  await assertLoggedIn();

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { title: true, titleJa: true, contentText: true },
  });
  if (!article) {
    return { ok: false, text: "記事が見つかりませんでした。" };
  }
  return summarizeToJa(article.titleJa ?? article.title, article.contentText ?? "");
}
