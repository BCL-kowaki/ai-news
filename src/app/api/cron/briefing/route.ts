import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/auth";
import { generateDailyBriefing } from "@/lib/briefing";

/**
 * 朝のブリーフィング生成ジョブ（毎朝7時JSTにGitHub Actionsが実行）
 * 認証はCRON_SECRETのBearer（未設定なら常に拒否のフェイルセーフ）。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  // ガード節：認証が通らないリクエストは何もせず終了する
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "認証されていないリクエストです" }, { status: 401 });
  }

  const result = await generateDailyBriefing();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  console.log("[ブリーフィング] 生成しました");
  return NextResponse.json({ ok: true });
}

// 手動テスト用にPOSTでも受け付ける
export const POST = GET;
