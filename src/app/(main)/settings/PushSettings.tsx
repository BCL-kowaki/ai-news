"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Send } from "lucide-react";
import {
  deletePushSubscription,
  savePushSubscription,
  sendTestPush,
} from "./push-actions";

/**
 * プッシュ通知の設定UI（設定ページ）
 *
 * 「有効にする」→ ブラウザの許可 → サービスワーカー登録 → 購読をDBへ保存。
 * 毎朝のブリーフィング完成時に通知が届くようになる。
 * iPhoneは「ホーム画面に追加」したSERAから開いた場合のみ有効（iOSの仕様）。
 */

type Status = "checking" | "nokey" | "unsupported" | "denied" | "on" | "off";

/** VAPID公開鍵をPush API用のバイト列に変換する */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function PushSettings() {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // 現在の購読状態を調べる
  useEffect(() => {
    (async () => {
      // サーバー側の鍵が未設定（Vercelの環境変数＋再デプロイが必要）
      if (!PUBLIC_KEY) {
        setStatus("nokey");
        return;
      }
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      setStatus(subscription ? "on" : "off");
    })().catch(() => setStatus("unsupported"));
  }, []);

  async function enable() {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        setMessage("通知が許可されませんでした。");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY),
      });
      const json = subscription.toJSON();
      await savePushSubscription({
        endpoint: subscription.endpoint,
        keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
      });
      setStatus("on");
      setMessage("この端末への通知を有効にしました。");
    } catch (e) {
      console.error("[プッシュ通知] 有効化失敗:", e);
      setMessage("有効化に失敗しました。ブラウザの通知設定を確認してください。");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await deletePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setStatus("off");
      setMessage("この端末への通知を無効にしました。");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMessage(null);
    try {
      const { sent } = await sendTestPush();
      setMessage(sent > 0 ? `テスト通知を${sent}端末へ送信しました。` : "送信先がありません。");
    } catch {
      setMessage("テスト送信に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  if (status === "checking") {
    return <p className="mt-3 text-sm text-muted">確認中…</p>;
  }
  if (status === "nokey") {
    return (
      <p className="mt-3 text-sm leading-relaxed text-red-600">
        サーバーの通知設定（VAPID鍵）が未設定です。Vercelの環境変数に
        NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT を追加し、
        再デプロイしてください。
      </p>
    );
  }
  if (status === "unsupported") {
    return (
      <p className="mt-3 text-sm leading-relaxed text-muted">
        この環境ではプッシュ通知を使えません。
        iPhoneの場合は、SERAを「ホーム画面に追加」してから開くと有効にできます。
      </p>
    );
  }
  if (status === "denied") {
    return (
      <p className="mt-3 text-sm leading-relaxed text-red-600">
        通知がブロックされています。ブラウザ（またはiOS）の設定でこのサイトの通知を許可してください。
      </p>
    );
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        {status === "on" ? (
          <>
            <span className="chip bg-green-50 text-green-700">この端末は通知オン</span>
            <button type="button" onClick={test} disabled={busy} className="btn-ghost">
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              テスト送信
            </button>
            <button type="button" onClick={disable} disabled={busy} className="btn-ghost">
              <BellOff className="h-3.5 w-3.5" aria-hidden="true" />
              無効にする
            </button>
          </>
        ) : (
          <button type="button" onClick={enable} disabled={busy} className="btn-primary">
            <Bell className="h-4 w-4" aria-hidden="true" />
            この端末で通知を有効にする
          </button>
        )}
      </div>
      {message && <p className="mt-2 text-sm font-medium text-muted">{message}</p>}
      <p className="mt-2 text-xs leading-relaxed text-faint">
        毎朝7時、ブリーフィングの完成時に通知が届きます。iPhoneは「ホーム画面に追加」した
        SERAから開いた場合のみ有効にできます（iOSの仕様）。
      </p>
    </div>
  );
}
