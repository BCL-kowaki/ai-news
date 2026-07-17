import type { MetadataRoute } from "next";

/**
 * Webアプリマニフェスト
 *
 * Android等で「ホーム画面に追加」したときのアイコン・名前・色を定義する。
 * iPhoneのホーム画面アイコンは src/app/apple-icon.png（Next.jsが自動でlinkを出す）。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AI秘書",
    short_name: "AI秘書",
    description: "ニュース・予定・メール・タスク・メモを1画面に集約する個人用秘書ダッシュボード",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f3e8",
    theme_color: "#c85e47",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
