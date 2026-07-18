import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { fetchAllSources } from "@/lib/news-fetch";

/**
 * ニュースの手動取得（POST /api/news/fetch）
 * ニュース画面の「今すぐ取得」ボタンから呼ばれる。ログイン中のユーザーのみ実行できる。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  // ガード節：ログイン必須（ミドルウェアとの二重防御）
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  try {
    const result = await fetchAllSources();
    return NextResponse.json({ ok: true, inserted: result.inserted });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[収集・手動] 失敗しました:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
