import type { MetadataRoute } from "next";

/**
 * Webアプリマニフェスト
 *
 * Android等で「ホーム画面に追加」したときのアイコン・名前・色を定義する。
 * iPhoneのホーム画面アイコンは src/app/apple-icon.png（Next.jsが自動でlinkを出す）。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AIニュース配信システム",
    short_name: "AIニュース",
    description: "AI関連ニュースを収集し、Slackへ自動配信する個人用システム",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
