import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { generateDailyBriefing } from "@/lib/briefing";

/**
 * ブリーフィングのオンデマンド生成（ダッシュボードの「今すぐ生成」ボタン）
 * ログイン中のユーザーのみ実行できる。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST() {
  // ガード節：ログイン必須（ミドルウェアとの二重防御）
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const result = await generateDailyBriefing();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
