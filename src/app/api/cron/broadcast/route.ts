import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/auth";
import {
  FETCH_WINDOW_HOURS,
  MAX_ARTICLES_PER_BROADCAST,
  SLACK_MESSAGE_INTERVAL_MS,
} from "@/lib/config";
import { getMonthKey } from "@/lib/datetime";
import { buildBroadcastMessages } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { postToSlack } from "@/lib/slack";

/**
 * Slack配信ジョブ（1日3回：日本時間 8時 / 13時 / 19時）
 *
 * 未送信（pending）の記事をまとめてSlackに投稿する。
 * Slackは無料枠の上限が無いため、LINE版にあった月次/日次の送信数ガードは持たない。
 * 代わりに「1回に流しすぎない」よう MAX_ARTICLES_PER_BROADCAST で件数を絞る。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // 分割送信＋待機を見込む（秒）

export async function GET(request: Request) {
  // ガード節：認証が通らないリクエストは何もせず終了する
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "認証されていないリクエストです" }, { status: 401 });
  }

  const now = new Date();

  try {
    // 未送信の記事を新しい順に取得する（情報元の名前も一緒に取る）
    const pending = await prisma.article.findMany({
      where: { status: "pending" },
      orderBy: { publishedAt: "desc" },
      include: { source: { select: { name: true } } },
    });

    if (pending.length === 0) {
      console.log("[配信] 送る記事がないためスキップしました");
      return NextResponse.json({ ok: true, skipped: true, reason: "未送信の記事がありません" });
    }

    // 1回で流す上限まで選ぶ。溢れた古い記事は skipped にして捨てる（滞留・大量通知を防ぐ）
    const selected = pending.slice(0, MAX_ARTICLES_PER_BROADCAST);
    const overflow = pending.slice(MAX_ARTICLES_PER_BROADCAST);

    // 表示用に整形：日本語訳があれば訳を、なければ原文を使う。情報元名も渡す
    const messages = buildBroadcastMessages(
      selected.map((article) => ({
        title: article.titleJa ?? article.title,
        url: article.url,
        sourceName: article.source.name,
      })),
      now,
    );

    // Slackへ順に投稿する（レート制限に配慮して少し間隔を空ける）
    for (let i = 0; i < messages.length; i++) {
      await postToSlack(messages[i]);
      if (i < messages.length - 1) {
        await sleep(SLACK_MESSAGE_INTERVAL_MS);
      }
    }

    // 送信できた記事を sent に更新
    const selectedIds = selected.map((article) => article.id);
    await prisma.article.updateMany({
      where: { id: { in: selectedIds } },
      data: { status: "sent", sentAt: now },
    });

    // 上限を超えて今回見送った記事のうち、鮮度切れ（48時間より古い）を skipped にする
    const staleBefore = new Date(now.getTime() - FETCH_WINDOW_HOURS * 60 * 60 * 1000);
    const expired = await prisma.article.updateMany({
      where: { status: "pending", publishedAt: { lt: staleBefore } },
      data: { status: "skipped" },
    });

    // 配信実績を記録（統計・稼働確認用）
    await prisma.sendLog.create({
      data: { count: selected.length, monthKey: getMonthKey(now) },
    });

    const leftover = await prisma.article.count({ where: { status: "pending" } });

    console.log(
      `[配信] ${selected.length}件を${messages.length}メッセージで投稿しました（残りの未送信 ${leftover}件 / 鮮度切れ ${expired.count}件 / 上限超過で見送り ${overflow.length}件）`,
    );

    return NextResponse.json({
      ok: true,
      sent: selected.length,
      messages: messages.length,
      pendingLeft: leftover,
      expired: expired.count,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[配信] 失敗しました:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 手動テストや外部cronサービスからの実行を想定し、POSTでも同じ処理を受け付ける
export const POST = GET;
