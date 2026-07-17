import Link from "next/link";
import { Star } from "lucide-react";
import { CATEGORIES, CATEGORY_STYLE_FALLBACK, NEWS_LIST_COUNT } from "@/lib/config";
import { formatJstDateTime } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";
import { ArticleTable, type ArticleRow } from "@/components/ArticleTable";

/**
 * ニュース一覧ページ（/news）
 * ジャンルのチップ（件数つき）＋全ジャンル横断の最新記事一覧。
 * ?filter=fav でお気に入り（★を付けた記事）だけを表示する。
 */

export const dynamic = "force-dynamic";

export default async function NewsPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const favOnly = searchParams.filter === "fav";
  const data = await loadNews(favOnly);

  return (
    <main>
      <h1 className="large-title">ニュース</h1>
      <p className="mt-1 text-[13px] text-muted">
        毎時自動収集。タイトルを押すと元記事へ。★で論文などをお気に入り保存できます。
      </p>

      {data === null ? (
        <p className="card mt-6 p-4 text-sm text-red-600">DBに接続できませんでした。</p>
      ) : (
        <>
          {/* お気に入り＋ジャンルへの入口 */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={favOnly ? "/news" : "/news?filter=fav"}
              className={`chip cursor-pointer transition-opacity duration-200 hover:opacity-80 ${
                favOnly ? "bg-[#DF923F] !text-card" : "bg-card"
              }`}
              style={favOnly ? undefined : { color: "#8A5A1F" }}
            >
              <Star className="h-3 w-3" fill={favOnly ? "currentColor" : "#DF923F"} aria-hidden="true" />
              お気に入り
              <span className="opacity-70">{data.favoriteCount}</span>
            </Link>
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
            <p className="mt-8 text-sm text-muted">
              {favOnly
                ? "お気に入りはまだありません。記事の★を押すと、ここに保存されます。"
                : "記事はまだありません。"}
            </p>
          ) : (
            <ArticleTable articles={data.articles} />
          )}
        </>
      )}
    </main>
  );
}

async function loadNews(favOnly: boolean) {
  try {
    const [articles, favoriteCount, genreCounts] = await Promise.all([
      prisma.article.findMany({
        // お気に入り表示は追加した順、通常表示は新着順
        where: favOnly ? { favoritedAt: { not: null } } : {},
        orderBy: favOnly ? { favoritedAt: "desc" } : { publishedAt: "desc" },
        ...(favOnly ? {} : { take: NEWS_LIST_COUNT }),
        include: { source: { select: { name: true, category: true } } },
      }),
      prisma.article.count({ where: { favoritedAt: { not: null } } }),
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
      favorite: a.favoritedAt !== null,
    }));
    return { articles: rows, favoriteCount, genres: genreCounts };
  } catch (error) {
    console.error("[ニュース一覧] 取得失敗:", error);
    return null;
  }
}
