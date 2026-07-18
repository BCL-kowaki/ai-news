import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CATEGORIES, CATEGORY_STYLE, CATEGORY_STYLE_FALLBACK } from "@/lib/config";
import { formatJstDateTime } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";
import { ArticleTable, type ArticleRow } from "@/components/ArticleTable";

/**
 * ジャンル別の記事一覧ページ（/news/[category]）
 * そのジャンルの記事を新しい順に一覧する。翻訳・要約はオンデマンド。
 */

export const dynamic = "force-dynamic";

export default async function NewsCategoryPage({
  params,
}: {
  params: { category: string };
}) {
  const category = decodeURIComponent(params.category);

  // 定義済みのジャンルでなければ404（任意の値でのアクセスを防ぐ）
  if (!CATEGORIES.some((c) => c.name === category)) {
    notFound();
  }

  const articles = await loadArticles(category);
  const style = CATEGORY_STYLE[category] ?? CATEGORY_STYLE_FALLBACK;

  return (
    <main>
      {/* iOSの「戻る」リンク風 */}
      <Link
        href="/news"
        className="inline-flex items-center gap-0.5 text-[15px] font-normal text-accent active:opacity-60"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        ニュース
      </Link>

      <h1 className="large-title mt-2 flex items-center gap-2.5">
        {category}
        <span
          className="chip text-sm"
          style={{ backgroundColor: style.bg, color: style.fg }}
        >
          {articles?.length ?? 0} 件
        </span>
      </h1>

      {articles === null ? (
        <p className="card mt-6 p-4 text-sm text-red-600">DBに接続できませんでした。</p>
      ) : articles.length === 0 ? (
        <p className="mt-8 text-sm text-muted">このジャンルの記事はまだありません。</p>
      ) : (
        <ArticleTable articles={articles} />
      )}
    </main>
  );
}

async function loadArticles(category: string): Promise<ArticleRow[] | null> {
  try {
    const articles = await prisma.article.findMany({
      // ジャンル一覧も未読のみ（既読は /news?filter=read から見返す）
      where: { source: { category }, readAt: null },
      orderBy: { publishedAt: "desc" },
      include: { source: { select: { name: true, category: true } } },
    });
    const style = CATEGORY_STYLE[category] ?? CATEGORY_STYLE_FALLBACK;
    return articles.map((a) => ({
      id: a.id,
      title: a.titleJa ?? a.title, // 日本語訳があれば訳を、なければ原文
      url: a.url,
      sourceName: a.source.name,
      category: a.source.category,
      categoryStyle: style,
      publishedLabel: formatJstDateTime(a.publishedAt),
      hasContent: Boolean(a.contentText),
      favorite: a.favoritedAt !== null,
      read: a.readAt !== null,
    }));
  } catch (error) {
    console.error("[ジャンル一覧] 取得失敗:", error);
    return null;
  }
}
