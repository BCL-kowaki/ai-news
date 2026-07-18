import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchAllSources } from "@/lib/news-fetch";

/**
 * RSS収集ジョブ（1時間ごとにGitHub Actionsが実行）
 *
 * 収集の本体は src/lib/news-fetch.ts（画面の「今すぐ取得」ボタンと共用）。
 * ここは認証と結果の返却だけを担当する。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // RSS 20本超の取得に余裕を持たせる（秒）

export async function GET(request: Request) {
  // ガード節：認証が通らないリクエストは何もせず終了する
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "認証されていないリクエストです" }, { status: 401 });
  }

  try {
    const result = await fetchAllSources();
    const total = await prisma.article.count();

    console.log(`[収集] 新規${result.inserted}件を追加しました（記事総数: ${total}件）`);

    return NextResponse.json({
      ok: true,
      inserted: result.inserted,
      total,
      details: result.details,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[収集] 失敗しました:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// 手動テストや外部cronサービスからの実行を想定し、POSTでも同じ処理を受け付ける
export const POST = GET;
