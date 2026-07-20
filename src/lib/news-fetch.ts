import { prisma } from "@/lib/prisma";
import { fetchFeed } from "@/lib/rss";
import { syncSources } from "@/lib/source-sync";
import { classifyArticles, fixedCategoryFromSource } from "@/lib/classify";
import { needsTranslation, translateTitlesToJa } from "@/lib/translate";

/**
 * RSS収集の本体（cronと画面の「今すぐ取得」ボタンで共用）
 *
 * 各RSSソースを取得し、新しい記事（＝DBにまだ無いURL）だけを保存する。
 * 1ソースの障害で全体を止めない（各ソースは独立して処理）。
 */

export type FetchNewsResult = {
  inserted: number;
  details: { source: string; fetched: number; inserted: number }[];
};

export async function fetchAllSources(now: Date = new Date()): Promise<FetchNewsResult> {
  // sources.ts の定義をDBへ反映（ソース追加をデプロイだけで完結させるため）
  await syncSources();

  const sources = await prisma.source.findMany({ where: { active: true } });

  const details = await Promise.all(
    sources.map(async (source) => {
      const fetched = await fetchFeed(source.url, now);

      // 新しい順に並べ替え、ソースごとの上限（maxPerFetch）があれば最新◯件だけに絞る。
      // arXivのような大量フィードが他ソースを埋め尽くすのを防ぐ。
      const sorted = fetched.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
      const items = source.maxPerFetch != null ? sorted.slice(0, source.maxPerFetch) : sorted;

      // 既にDBにあるURLを除外し、本当に新しい記事だけに絞る。
      // （翻訳は新規記事にだけ行う。重複を訳し直すとDeepLの無料枠を無駄に消費するため）
      const existing = await prisma.article.findMany({
        where: { url: { in: items.map((i) => i.url) } },
        select: { url: true },
      });
      const existingUrls = new Set(existing.map((e) => e.url));
      const fresh = items.filter((i) => !existingUrls.has(i.url));

      // 日本語を含まないタイトルだけ抜き出してまとめて翻訳する（日本語ソースはそのまま）
      const toTranslate = fresh.filter((i) => needsTranslation(i.title));
      const translated = await translateTitlesToJa(toTranslate.map((i) => i.title));
      const jaByUrl = new Map<string, string | null>();
      toTranslate.forEach((item, idx) => jaByUrl.set(item.url, translated[idx]));

      // カテゴリ判定：動画（YouTube）・研究（arXiv）はソースで確定、それ以外は後でAIがまとめて判定する
      const fixed = fixedCategoryFromSource(source.category);

      const created = await prisma.article.createMany({
        data: fresh.map((item) => ({
          sourceId: source.id,
          title: item.title,
          titleJa: jaByUrl.get(item.url) ?? null,
          contentText: item.contentText,
          category: fixed, // null のものは下でAI判定して埋める
          url: item.url,
          publishedAt: item.publishedAt,
        })),
        skipDuplicates: true, // 同時実行の保険（基本は上でフィルタ済み）
      });

      return { source: source.name, fetched: items.length, inserted: created.count };
    }),
  );

  // カテゴリ未設定の記事をまとめてAI判定する（1回の収集につき数回のAI呼び出しで済む）
  await classifyPendingArticles();

  return { inserted: details.reduce((sum, d) => sum + d.inserted, 0), details };
}

/**
 * カテゴリ未設定の記事をまとめて判定して保存する。
 * 収集直後に呼ぶほか、過去記事の埋め直しにも使える（AI失敗時も既定カテゴリで必ず埋まる）。
 */
export async function classifyPendingArticles(limit = 200): Promise<number> {
  const targets = await prisma.article.findMany({
    where: { category: null },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: { id: true, title: true, titleJa: true, contentText: true },
  });
  if (targets.length === 0) return 0;

  // 判定は日本語訳があればそれを使う（日本語の方が精度が出やすい）
  const decided = await classifyArticles(
    targets.map((t) => ({ id: t.id, title: t.titleJa ?? t.title, contentText: t.contentText })),
  );

  // カテゴリごとにまとめて更新（1件ずつUPDATEしない）
  const byCategory = new Map<string, string[]>();
  Array.from(decided).forEach(([id, category]) => {
    const list = byCategory.get(category) ?? [];
    list.push(id);
    byCategory.set(category, list);
  });
  await Promise.all(
    Array.from(byCategory.entries()).map(([category, ids]) =>
      prisma.article.updateMany({ where: { id: { in: ids } }, data: { category } }),
    ),
  );

  return targets.length;
}
