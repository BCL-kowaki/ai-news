import Link from "next/link";
import { Check, Sparkles, Star } from "lucide-react";
import { CATEGORIES, CATEGORY_STYLE_FALLBACK, NEWS_LIST_COUNT } from "@/lib/config";
import { formatJstDateTime } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";
import { getNewsPreference } from "@/lib/news-preference";
import { ArticleTable, type ArticleRow } from "@/components/ArticleTable";
import { FetchNewsButton } from "./FetchNewsButton";
import { LearnPreferenceButton } from "./LearnPreferenceButton";
import { MarkAllReadButton } from "./MarkAllReadButton";

/**
 * ニュース一覧ページ（/news）
 *
 * 既定は「未読のみ」表示。チェックボタンで既読にすると一覧から隠れる（削除ではない）。
 * - `?filter=read` … 既読の記事を見返す
 * - `?filter=fav`  … お気に入り（★）だけ表示（既読・未読を問わない）
 * - `?filter=reco` … おすすめ（お気に入りの傾向に近い未読記事）
 */

export const dynamic = "force-dynamic";

/** 記事がキーワードにいくつ当てはまるか数える（タイトル＋本文抜粋を対象・大小文字無視） */
function matchScore(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.filter((k) => lower.includes(k.toLowerCase())).length;
}

export default async function NewsPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const filter = searchParams.filter;
  const data = await loadNews(filter);

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="large-title">ニュース</h1>
        <FetchNewsButton />
      </div>
      <p className="mt-1 text-[13px] text-muted">
        毎時自動収集。読み終わったらチェック（✓）で片付け、★は保存。既読はいつでも見返せます。
      </p>

      {data === null ? (
        <p className="card mt-6 p-4 text-sm text-red-600">DBに接続できませんでした。</p>
      ) : (
        <>
          {/* 絞り込みチップ（未読・お気に入り・おすすめ・既読・ジャンル） */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/news"
              className={`chip cursor-pointer transition-opacity duration-200 hover:opacity-80 ${
                !filter ? "bg-ink !text-card" : "bg-card text-muted"
              }`}
            >
              未読
              <span className="opacity-70">{data.unreadCount}</span>
            </Link>

            <Link
              href={filter === "fav" ? "/news" : "/news?filter=fav"}
              className={`chip cursor-pointer transition-opacity duration-200 hover:opacity-80 ${
                filter === "fav" ? "bg-[#DF923F] !text-card" : "bg-card"
              }`}
              style={filter === "fav" ? undefined : { color: "#8A5A1F" }}
            >
              <Star
                className="h-3 w-3"
                fill={filter === "fav" ? "currentColor" : "#DF923F"}
                aria-hidden="true"
              />
              お気に入り
              <span className="opacity-70">{data.favoriteCount}</span>
            </Link>

            {/* おすすめ（好みを学習済みのときだけ出す） */}
            {data.preference && (
              <Link
                href={filter === "reco" ? "/news" : "/news?filter=reco"}
                className={`chip cursor-pointer transition-opacity duration-200 hover:opacity-80 ${
                  filter === "reco" ? "bg-accent !text-card" : "bg-card text-accent"
                }`}
              >
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                おすすめ
              </Link>
            )}

            <Link
              href={filter === "read" ? "/news" : "/news?filter=read"}
              className={`chip cursor-pointer transition-opacity duration-200 hover:opacity-80 ${
                filter === "read" ? "bg-ink !text-card" : "bg-card text-muted"
              }`}
            >
              <Check className="h-3 w-3" aria-hidden="true" />
              既読
              <span className="opacity-70">{data.readCount}</span>
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

          {/* 一括既読＋好みの学習 */}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {filter !== "read" && (
              <MarkAllReadButton articleIds={data.articles.filter((a) => !a.read).map((a) => a.id)} />
            )}
            <LearnPreferenceButton hasPreference={Boolean(data.preference)} />
          </div>
          {data.preference && (
            <p className="mt-1.5 text-xs leading-relaxed text-faint">
              学習済みの傾向：{data.preference.summary}（お気に入り{data.preference.favoriteCount}件から）
            </p>
          )}

          {data.articles.length === 0 ? (
            <p className="mt-8 text-sm text-muted">
              {filter === "fav"
                ? "お気に入りはまだありません。記事の★を押すと、ここに保存されます。"
                : filter === "read"
                  ? "既読の記事はまだありません。"
                  : filter === "reco"
                    ? "おすすめに合う未読記事がありません。「今すぐ取得」で新着を集めてみてください。"
                    : "未読の記事はありません。すべて読み終わりました 🎉"}
            </p>
          ) : (
            <ArticleTable articles={data.articles} />
          )}
        </>
      )}
    </main>
  );
}

async function loadNews(filter: string | undefined) {
  try {
    const favOnly = filter === "fav";
    const readOnly = filter === "read";
    const recoOnly = filter === "reco";

    const [preference, favoriteCount, unreadCount, readCount, genreCounts] = await Promise.all([
      getNewsPreference(),
      prisma.article.count({ where: { favoritedAt: { not: null } } }),
      prisma.article.count({ where: { readAt: null } }),
      prisma.article.count({ where: { readAt: { not: null } } }),
      Promise.all(
        CATEGORIES.map(async (c) => ({
          name: c.name,
          bg: c.bg,
          fg: c.fg,
          // ジャンル件数は未読ベース（片付けた分は減る）
          count: await prisma.article.count({
            where: { source: { category: c.name }, readAt: null },
          }),
        })),
      ),
    ]);

    // 絞り込み条件：お気に入りは既読も含む／それ以外は未読のみ
    const where = favOnly
      ? { favoritedAt: { not: null } }
      : readOnly
        ? { readAt: { not: null } }
        : { readAt: null };

    const articles = await prisma.article.findMany({
      where,
      orderBy: favOnly
        ? { favoritedAt: "desc" }
        : readOnly
          ? { readAt: "desc" }
          : { publishedAt: "desc" },
      // おすすめは広めに取ってスコア順に絞る
      take: recoOnly ? 200 : favOnly || readOnly ? 100 : NEWS_LIST_COUNT,
      include: { source: { select: { name: true, category: true } } },
    });

    const toRow = (a: (typeof articles)[number]): ArticleRow => ({
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
      read: a.readAt !== null,
    });

    let rows: ArticleRow[];
    if (recoOnly && preference) {
      // 好みキーワードに当てはまる記事だけを、当てはまり度→新着順で並べる
      rows = articles
        .map((a) => ({
          article: a,
          score: matchScore(
            `${a.titleJa ?? ""} ${a.title} ${a.contentText ?? ""}`,
            preference.keywords,
          ),
        }))
        .filter((x) => x.score > 0)
        .sort(
          (x, y) =>
            y.score - x.score || y.article.publishedAt.getTime() - x.article.publishedAt.getTime(),
        )
        .slice(0, NEWS_LIST_COUNT)
        .map((x) => toRow(x.article));
    } else {
      rows = articles.map(toRow);
    }

    return { articles: rows, favoriteCount, unreadCount, readCount, genres: genreCounts, preference };
  } catch (error) {
    console.error("[ニュース一覧] 取得失敗:", error);
    return null;
  }
}
