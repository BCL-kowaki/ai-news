import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchFeed } from "@/lib/rss";
import { syncSources } from "@/lib/source-sync";
import { needsTranslation, translateTitlesToJa } from "@/lib/translate";

/**
 * RSS収集ジョブ（1時間ごとに実行される）
 *
 * 各RSSソースを取得し、新しい記事（＝DBにまだ無いURL）だけを pending として保存する。
 * Slackへの送信は一切しない —— ここは収集だけを行う。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // RSS 6本の取得に余裕を持たせる（秒）

export async function GET(request: Request) {
  // ガード節：認証が通らないリクエストは何もせず終了する
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "認証されていないリクエストです" }, { status: 401 });
  }

  const now = new Date();

  try {
    // sources.ts の定義をDBへ反映（ソース追加をデプロイだけで完結させるため）
    await syncSources();

    const sources = await prisma.source.findMany({ where: { active: true } });

    // 1ソースの障害で全体を止めないよう、各ソースは独立して処理する
    const results = await Promise.all(
      sources.map(async (source) => {
        const fetched = await fetchFeed(source.url, now);

        // 新しい順に並べ替え、ソースごとの上限（maxPerFetch）があれば最新◯件だけに絞る。
        // arXivのような大量フィードが他ソースを埋め尽くすのを防ぐ。
        const sorted = fetched.sort(
          (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime(),
        );
        const items =
          source.maxPerFetch != null ? sorted.slice(0, source.maxPerFetch) : sorted;

        // 既にDBにあるURLを除外し、本当に新しい記事だけに絞る。
        // （翻訳は新規記事にだけ行う。毎時の重複を訳し直すとDeepLの無料枠を無駄に消費するため）
        const existing = await prisma.article.findMany({
          where: { url: { in: items.map((i) => i.url) } },
          select: { url: true },
        });
        const existingUrls = new Set(existing.map((e) => e.url));
        const fresh = items.filter((i) => !existingUrls.has(i.url));

        // 日本語を含まないタイトルだけ抜き出してまとめて翻訳する（日本語ソースはそのまま）
        const toTranslate = fresh.filter((i) => needsTranslation(i.title));
        const translated = await translateTitlesToJa(toTranslate.map((i) => i.title));
        // url → 日本語訳 の対応表を作り、各記事に割り当てる
        const jaByUrl = new Map<string, string | null>();
        toTranslate.forEach((item, idx) => jaByUrl.set(item.url, translated[idx]));

        const created = await prisma.article.createMany({
          data: fresh.map((item) => ({
            sourceId: source.id,
            title: item.title,
            titleJa: jaByUrl.get(item.url) ?? null,
            url: item.url,
            publishedAt: item.publishedAt,
          })),
          skipDuplicates: true, // 同時実行の保険（基本は上でフィルタ済み）
        });

        return { source: source.name, fetched: items.length, inserted: created.count };
      }),
    );

    const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);
    const pendingCount = await prisma.article.count({ where: { status: "pending" } });

    console.log(`[収集] 新規${totalInserted}件を追加しました（未送信の記事: ${pendingCount}件）`);

    return NextResponse.json({
      ok: true,
      inserted: totalInserted,
      pending: pendingCount,
      details: results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[収集] 失敗しました:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// 手動テストや外部cronサービスからの実行を想定し、POSTでも同じ処理を受け付ける
export const POST = GET;
