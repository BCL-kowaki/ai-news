"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { prisma } from "@/lib/prisma";
import { generateNewsAudio, type NewsAudioScope } from "@/lib/news-audio";
import { learnNewsPreference } from "@/lib/news-preference";
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
 * 記事のお気に入りを切り替える（論文の保存などに使う）。
 * 戻り値は切り替え後の状態（true=お気に入り）。
 */
export async function toggleFavoriteArticle(articleId: string): Promise<{ favorite: boolean }> {
  await assertLoggedIn();

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { favoritedAt: true },
  });
  if (!article) return { favorite: false };

  const favorite = article.favoritedAt === null;
  await prisma.article.update({
    where: { id: articleId },
    data: { favoritedAt: favorite ? new Date() : null },
  });
  revalidatePath("/news");
  revalidatePath("/");
  return { favorite };
}

/**
 * 「後で見る」の切り替え。
 * 入れると未読一覧から隠れ、「後で見る」タブから見返せる（削除ではない）。
 */
export async function toggleSaveArticle(articleId: string): Promise<{ saved: boolean }> {
  await assertLoggedIn();

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { savedAt: true },
  });
  if (!article) return { saved: false };

  const saved = article.savedAt === null;
  await prisma.article.update({
    where: { id: articleId },
    data: { savedAt: saved ? new Date() : null },
  });
  revalidatePath("/news");
  revalidatePath("/");
  return { saved };
}

/**
 * お気に入りの傾向をAIに学習させる（おすすめ判定のキーワードを更新）。
 */
export async function learnPreference(): Promise<{ ok: boolean; message: string }> {
  await assertLoggedIn();

  const result = await learnNewsPreference();
  revalidatePath("/news");
  return result.ok
    ? { ok: true, message: `学習しました：${result.summary ?? ""}` }
    : { ok: false, message: result.error ?? "学習に失敗しました" };
}

/**
 * 記事の既読を切り替える（読み終わったものを一覧から隠す）。
 * 削除ではないので、いつでも「既読」タブから見返せる。
 */
export async function toggleReadArticle(articleId: string): Promise<{ read: boolean }> {
  await assertLoggedIn();

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { readAt: true },
  });
  if (!article) return { read: false };

  const read = article.readAt === null;
  await prisma.article.update({
    where: { id: articleId },
    data: { readAt: read ? new Date() : null },
  });
  revalidatePath("/news");
  revalidatePath("/");
  return { read };
}

/**
 * 表示中の記事をまとめて既読にする（読み終わったらワンタップで片付ける）。
 * お気に入り（★）はそのまま残る（既読にしても一覧では隠れるだけ）。
 */
export async function markArticlesRead(articleIds: string[]): Promise<{ count: number }> {
  await assertLoggedIn();

  const ids = articleIds.filter((id) => typeof id === "string").slice(0, 500);
  if (ids.length === 0) return { count: 0 };

  const result = await prisma.article.updateMany({
    where: { id: { in: ids }, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/news");
  revalidatePath("/");
  return { count: result.count };
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

/**
 * ニュースを音声で聞く（通勤中向け）。
 *
 * 3つの単位に対応:
 *   - article  … 記事1本を要約して読み上げ（一度作れば使い回す）
 *   - category … そのジャンルの受信箱をダイジェストで読み上げ
 *   - inbox    … 受信箱ぜんぶをダイジェストで読み上げ
 *
 * 生成には数秒〜十数秒かかるため、呼び出し側でローディング表示をすること。
 */
export async function speakNews(
  scope: NewsAudioScope,
): Promise<{ ok: boolean; url?: string; title?: string; error?: string }> {
  await assertLoggedIn();
  return generateNewsAudio(scope);
}
