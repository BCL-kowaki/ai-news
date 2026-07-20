import Link from "next/link";
import { Bookmark, Check, Sparkles, Star } from "lucide-react";
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
 * 既定は「受信箱」＝まだ片付けていない記事だけを表示する。
 * ★お気に入り／🔖後で見る／✓既読 のいずれかを選ぶと受信箱から隠れ（アーカイブ）、
 * それぞれのタブから見返せる（削除ではない）。
 * - `?filter=fav`  … お気に入り
 * - `?filter=save` … 後で見る
 * - `?filter=read` … 既読
 * - `?filter=reco` … おすすめ（お気に入りの傾向に近い、受信箱の記事）
 */

/** 受信箱の条件：3つの片付けフラグがどれも立っていない記事 */
const INBOX_WHERE = { favoritedAt: null, savedAt: null, readAt: null } as const;

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
        毎時自動収集。★お気に入り・🔖後で見る・✓既読 のどれかを選ぶと受信箱から片付きます（削除ではなく各タブで見返せます）。
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
              受信箱
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

            <Link
              href={filter === "save" ? "/news" : "/news?filter=save"}
              className={`chip cursor-pointer transition-opacity duration-200 hover:opacity-80 ${
                filter === "save" ? "bg-[#709BAD] !text-card" : "bg-card"
              }`}
              style={filter === "save" ? undefined : { color: "#4A6B7A" }}
            >
              <Bookmark
                className="h-3 w-3"
                fill={filter === "save" ? "currentColor" : "#709BAD"}
                aria-hidden="true"
              />
              後で見る
              <span className="opacity-70">{data.savedCount}</span>
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
                : filter === "save"
                  ? "「後で見る」はまだありません。記事の🔖を押すと、ここに入ります。"
                  : filter === "read"
                    ? "既読の記事はまだありません。"
                    : filter === "reco"
                      ? "おすすめに合う記事がありません。「今すぐ取得」で新着を集めてみてください。"
                      : "受信箱は空です。すべて片付きました 🎉"}
            </p>
          ) : (
            <ArticleTable
              articles={data.articles}
              view={
                filter === "fav"
                  ? "fav"
                  : filter === "save"
                    ? "save"
                    : filter === "read"
                      ? "read"
                      : "inbox"
              }
            />
          )}
        </>
      )}
    </main>
  );
}

async function loadNews(filter: string | undefined) {
  try {
    const favOnly = filter === "fav";
    const savedOnly = filter === "save";
    const readOnly = filter === "read";
    const recoOnly = filter === "reco";

    const [preference, favoriteCount, savedCount, unreadCount, readCount, genreCounts] =
      await Promise.all([
        getNewsPreference(),
        prisma.article.count({ where: { favoritedAt: { not: null } } }),
        prisma.article.count({ where: { savedAt: { not: null } } }),
        // 受信箱の件数（まだ片付けていない記事）
        prisma.article.count({ where: INBOX_WHERE }),
        prisma.article.count({ where: { readAt: { not: null } } }),
        Promise.all(
          CATEGORIES.map(async (c) => ({
            name: c.name,
            bg: c.bg,
            fg: c.fg,
            // ジャンル件数は受信箱ベース（片付けた分は減る）
            count: await prisma.article.count({
              where: { category: c.name, ...INBOX_WHERE },
            }),
          })),
        ),
      ]);

    // 絞り込み条件：各タブはその状態の記事／既定は受信箱（3つとも未設定）
    const where = favOnly
      ? { favoritedAt: { not: null } }
      : savedOnly
        ? { savedAt: { not: null } }
        : readOnly
          ? { readAt: { not: null } }
          : INBOX_WHERE;

    const articles = await prisma.article.findMany({
      where,
      orderBy: favOnly
        ? { favoritedAt: "desc" }
        : savedOnly
          ? { savedAt: "desc" }
          : readOnly
            ? { readAt: "desc" }
            : { publishedAt: "desc" },
      // おすすめは広めに取ってスコア順に絞る
      take: recoOnly ? 200 : favOnly || savedOnly || readOnly ? 100 : NEWS_LIST_COUNT,
      include: { source: { select: { name: true, category: true } } },
    });

    const toRow = (a: (typeof articles)[number]): ArticleRow => ({
      id: a.id,
      title: a.titleJa ?? a.title, // 日本語訳があれば訳を、なければ原文
      url: a.url,
      sourceName: a.source.name,
      category: a.category,
      categoryStyle:
        CATEGORIES.find((c) => c.name === a.category) ?? CATEGORY_STYLE_FALLBACK,
      publishedLabel: formatJstDateTime(a.publishedAt),
      hasContent: Boolean(a.contentText),
      favorite: a.favoritedAt !== null,
      saved: a.savedAt !== null,
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

    return {
      articles: rows,
      favoriteCount,
      savedCount,
      unreadCount,
      readCount,
      genres: genreCounts,
      preference,
    };
  } catch (error) {
    console.error("[ニュース一覧] 取得失敗:", error);
    return null;
  }
}
