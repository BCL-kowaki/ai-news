import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleTable, type ArticleRow } from "@/app/ArticleTable";
import { SendToSlackButton } from "@/app/SendToSlackButton";
import { CATEGORIES, CATEGORY_EMOJI } from "@/lib/config";
import { prisma } from "@/lib/prisma";

/**
 * ジャンル別の記事一覧ページ（/genre/[category]）
 *
 * そのジャンルの記事を表形式で一覧する。各行を押すと元記事のページへ遷移する。
 * 各行の「翻訳」「要約」で、その記事だけをその場で日本語化・要約できる（オンデマンド）。
 * ページ上部の「Slackに送る」ボタンで、このジャンルの最新記事をSlackに送れる。
 */

export const dynamic = "force-dynamic";

export default async function GenrePage({ params }: { params: { category: string } }) {
  const category = decodeURIComponent(params.category);

  // 定義済みのジャンルでなければ404（任意の値でのアクセスを防ぐ）
  if (!CATEGORIES.some((c) => c.name === category)) {
    notFound();
  }

  const articles = await loadArticles(category);
  const emoji = CATEGORY_EMOJI[category] ?? "📰";

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-blue-600 hover:underline">
        ← ダッシュボードに戻る
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          {emoji} {category}
          <span className="ml-2 text-base font-normal text-slate-500">
            {articles?.length ?? 0} 件
          </span>
        </h1>
        <SendToSlackButton category={category} />
      </div>

      {articles === null ? (
        <p className="mt-8 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          DBに接続できませんでした。
        </p>
      ) : articles.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">このジャンルの記事はまだありません。</p>
      ) : (
        <>
          <p className="mt-4 text-xs text-slate-500">
            タイトルを押すと元記事へ。「翻訳」「要約」は押した記事だけをその場で処理します。
          </p>
          <ArticleTable articles={articles} />
        </>
      )}
    </main>
  );
}

async function loadArticles(category: string): Promise<ArticleRow[] | null> {
  try {
    const articles = await prisma.article.findMany({
      where: { status: { in: ["pending", "sent"] }, source: { category } },
      orderBy: { publishedAt: "desc" },
      include: { source: { select: { name: true } } },
    });
    return articles.map((a) => ({
      id: a.id,
      // 日本語訳があれば訳を、なければ原文を表示
      title: a.titleJa ?? a.title,
      url: a.url,
      sourceName: a.source.name,
      publishedLabel: formatJst(a.publishedAt),
      hasContent: Boolean(a.contentText),
    }));
  } catch (error) {
    console.error("[ジャンル一覧] 取得失敗:", error);
    return null;
  }
}

function formatJst(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
