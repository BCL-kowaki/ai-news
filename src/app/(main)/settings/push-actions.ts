"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth";
import { prisma } from "@/lib/prisma";
import { sendPushToAll } from "@/lib/push";

/**
 * プッシュ通知購読のサーバーアクション（保存・解除・テスト送信）
 */

async function assertLoggedIn(): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("ログインが必要です");
}

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

/** 購読を保存する（同じ端末の再購読は上書き） */
export async function savePushSubscription(sub: PushSubscriptionInput): Promise<void> {
  await assertLoggedIn();
  if (!sub.endpoint.startsWith("https://")) return;

  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    update: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
}

/** 購読を解除する */
export async function deletePushSubscription(endpoint: string): Promise<void> {
  await assertLoggedIn();
  await prisma.pushSubscription.delete({ where: { endpoint } }).catch(() => {});
}

/** テスト通知を送る（登録済みの全端末へ） */
export async function sendTestPush(): Promise<{ sent: number }> {
  await assertLoggedIn();
  const sent = await sendPushToAll({
    title: "SERA テスト通知",
    body: "プッシュ通知は正しく設定されています。",
    url: "/",
  });
  return { sent };
}
