import webpush from "web-push";
import { prisma } from "@/lib/prisma";

/**
 * プッシュ通知の送信（Web Push / VAPID）
 *
 * 購読はブラウザごとに PushSubscription テーブルへ保存されている。
 * フェイルセーフ：鍵未設定なら送らないだけ。無効になった購読（410等）は自動で掃除する。
 */

export function isPushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function setup(): boolean {
  if (!isPushConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:sera@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  return true;
}

/** 登録されている全デバイスへ通知を送る。戻り値は送信成功数 */
export async function sendPushToAll(payload: {
  title: string;
  body: string;
  url?: string;
}): Promise<number> {
  if (!setup()) return 0;

  const subscriptions = await prisma.pushSubscription.findMany().catch(() => []);
  if (subscriptions.length === 0) return 0;

  let sent = 0;
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
        sent++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // 404/410 = 購読が無効化された（アプリ削除・許可取り消し）→ DBから掃除
        if (status === 404 || status === 410) {
          await prisma.pushSubscription
            .delete({ where: { endpoint: sub.endpoint } })
            .catch(() => {});
        } else {
          console.error("[プッシュ通知] 送信失敗:", status ?? error);
        }
      }
    }),
  );
  return sent;
}
