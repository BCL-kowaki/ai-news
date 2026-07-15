import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIニュース配信システム",
  description: "AI関連ニュースを収集し、Slackへ自動配信する個人用システム",
  robots: { index: false, follow: false }, // 個人用のため検索エンジンには載せない
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
