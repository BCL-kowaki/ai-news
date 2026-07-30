import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/auth";
import { generateDailyBriefing } from "@/lib/briefing";
import { purgeExpiredTrash } from "@/lib/memo-purge";
import { sendPushToAll } from "@/lib/push";

/**
 * 朝のブリーフィング生成ジョブ（毎朝7時JSTにGitHub Actionsが実行）
 * 認証はCRON_SECRETのBearer（未設定なら常に拒否のフェイルセーフ）。
 *
 * ついでに1日1回の後片付け（メモのゴミ箱の期限切れ削除）も行う。
 * ブリーフィング生成より先に実行し、生成が失敗しても掃除だけは済むようにしている。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  // ガード節：認証が通らないリクエストは何もせず終了する
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "認証されていないリクエストです" }, { status: 401 });
  }

  // 後片付け：保存期限を過ぎたゴミ箱のメモを完全削除（失敗してもブリーフィングは続ける）
  const purged = await purgeExpiredTrash().catch((e) => {
    console.error("[メモ] ゴミ箱の自動削除に失敗:", e);
    return 0;
  });
  if (purged > 0) console.log(`[メモ] ゴミ箱から${purged}件を完全削除しました`);

  const result = await generateDailyBriefing();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  // 登録済みの端末へ「できました」を通知（冒頭を抜粋。失敗しても本処理は成功扱い）
  const excerpt = (result.content ?? "").replace(/[#*\n]/g, " ").trim().slice(0, 90);
  const sent = await sendPushToAll({
    title: "今日のブリーフィングができました",
    body: excerpt,
    url: "/",
  }).catch(() => 0);

  console.log(`[ブリーフィング] 生成しました（通知 ${sent}件）`);
  return NextResponse.json({ ok: true, pushed: sent, memosPurged: purged });
}

// 手動テスト用にPOSTでも受け付ける
export const POST = GET;
