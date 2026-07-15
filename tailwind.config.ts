import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 参考サイト（yuji.uk）のエディトリアル調パレット
        paper: "#F8F3E8", // 背景（クリーム）
        panel: "#FFF9EC", // パネル/カードの背景（明るいクリーム）
        ink: "#382C28", // 本文（濃い茶）
        line: "#684C40", // 枠線・区切り（茶）
        muted: "#8A7A70", // 補助テキスト（薄い茶）
        accent: "#C4623D", // アクセント（テラコッタ）
      },
      boxShadow: {
        panel: "4px 4px 0 rgba(104, 76, 64, 0.15)", // 少しずらした硬めの影
      },
    },
  },
  plugins: [],
};

export default config;
