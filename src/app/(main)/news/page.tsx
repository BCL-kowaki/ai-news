import Link from "next/link";
import { Newspaper } from "lucide-react";
import { CATEGORIES, CATEGORY_STYLE_FALLBACK, NEWS_LIST_COUNT } from "@/lib/config";
import { formatJstDateTime } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";
import { ArticleTable, type ArticleRow } from "@/components/ArticleTable";

/**
 * ニュース一覧ページ（/news）
 * ジャンルのチップ（件数つき）＋全ジャンル横断の最新記事一覧。
 */

export const dynamic = "force-dynamic";

export default async function NewsPage() {
  const data = await loadNews();

  return (
    <main>
      <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
        <Newspaper className="h-5 w-5 text-accent" aria-hidden="true" />
        ニュース
      </h1>
      <p className="mt-1 text-sm text-muted">
        毎時自動収集。タイトルを押すと元記事へ。「翻訳」「要約」は押した記事だけをその場で処理します。
      </p>

      {data === null ? (
        <p className="card mt-6 p-4 text-sm text-red-600">DBに接続できませんでした。</p>
      ) : (
        <>
          {/* ジャンルへの入口 */}
          <div className="mt-4 flex flex-wrap gap-2">
            {data.genres.map((genre) => (
              <Link
                key={genre.name}
                href={`/news/${encodeURIComponent(genre.name)}`}
                className="chip cursor-pointer transition-opacity duration-200 hover:opacity-80"
                style={{ backgroundColor: genre.bg, color: genre.fg }}
              >
                {genre.name}
                <span className="opacity-70">{genre.count}</span>
              </Link>
            ))}
          </div>

          {data.articles.length === 0 ? (
            <p className="mt-8 text-sm text-muted">記事はまだありません。</p>
          ) : (
            <ArticleTable articles={data.articles} />
          )}
        </>
      )}
    </main>
  );
}

async function loadNews() {
  try {
    const [articles, genreCounts] = await Promise.all([
      prisma.article.findMany({
        orderBy: { publishedAt: "desc" },
        take: NEWS_LIST_COUNT,
        include: { source: { select: { name: true, category: true } } },
      }),
      Promise.all(
        CATEGORIES.map(async (c) => ({
          name: c.name,
          bg: c.bg,
          fg: c.fg,
          count: await prisma.article.count({ where: { source: { category: c.name } } }),
        })),
      ),
    ]);

    const rows: ArticleRow[] = articles.map((a) => ({
      id: a.id,
      title: a.titleJa ?? a.title, // 日本語訳があれば訳を、なければ原文
      url: a.url,
      sourceName: a.source.name,
      category: a.source.category,
      categoryStyle:
        CATEGORIES.find((c) => c.name === a.source.category) ?? CATEGORY_STYLE_FALLBACK,
      publishedLabel: formatJstDateTime(a.publishedAt),
      hasContent: Boolean(a.contentText),
    }));
    return { articles: rows, genres: genreCounts };
  } catch (error) {
    console.error("[ニュース一覧] 取得失敗:", error);
    return null;
  }
}
