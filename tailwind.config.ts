import type { Config } from "tailwindcss";

/**
 * デザイントークン（ベントグリッド・スタイル）
 *
 * 白カード＋薄グレー背景＋Indigoアクセントの「Bento Box Grid」体系。
 * 色の実体は globals.css の CSS変数（:root）にあり、ここでは名前を割り当てるだけ。
 * → ダークモード対応や配色変更は globals.css の変数を書き換えれば全体に効く。
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)", // ページ背景（薄いグレー）
        card: "var(--card)", // カード背景（白）
        ink: "var(--ink)", // 本文（ほぼ黒）
        muted: "var(--muted)", // 補助テキスト（グレー）
        faint: "var(--faint)", // さらに薄いテキスト（日付など）
        line: "var(--line)", // 枠線・区切り
        accent: "var(--accent)", // アクセント（Indigo）
        "accent-soft": "var(--accent-soft)", // アクセントの淡色背景
      },
      fontFamily: {
        sans: ["var(--font-inter)", "var(--font-noto-sans-jp)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        // カードの浮遊感（近距離の輪郭 + 遠距離のぼかし）
        card: "0 1px 2px rgba(24, 24, 27, 0.04), 0 8px 24px -12px rgba(24, 24, 27, 0.12)",
        "card-hover": "0 2px 4px rgba(24, 24, 27, 0.05), 0 16px 32px -12px rgba(24, 24, 27, 0.18)",
      },
      borderRadius: {
        card: "1.25rem", // 20px。ベントカードの標準角丸
      },
    },
  },
  plugins: [],
};

export default config;
