"use server";

import { notifyByCategory } from "@/lib/notify";

/**
 * サーバーアクション：指定ジャンルの最新記事をSlackへ通知する。
 *
 * "use server" 宣言により、この関数はサーバー側でのみ実行される。
 * SLACK_WEBHOOK_URL 等の秘密情報はブラウザに一切渡らない。
 */
export async function sendGenreNotification(
  category: string,
): Promise<{ ok: boolean; count: number; error?: string }> {
  try {
    const { count } = await notifyByCategory(category);
    return { ok: true, count };
  } catch (error) {
    const message = error instanceof Error ? error.message : "通知に失敗しました";
    console.error("[手動通知] 失敗:", message);
    return { ok: false, count: 0, error: message };
  }
}
