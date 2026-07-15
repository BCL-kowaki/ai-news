/**
 * RSSソースの定義（単一定義元）
 *
 * ソースを増やしたいときは、この配列に1行足すだけでよい。
 * DBのマイグレーションは不要 —— 収集ジョブ（/api/cron/fetch）の実行時に
 * この定義がDBの Source テーブルへ自動で同期される（syncSources）。
 * 定義から消したソースは自動で active=false になり、収集対象から外れる。
 *
 * active: false にすると、定義を消さずに収集だけ止められる。
 *
 * 【方針】一次情報・技術中心。
 *   Google News（q=AI）は日本語のPR記事・重複・芸能ノイズが多かったため2026-07に除外した。
 *   宣伝ではなく技術・製品・研究のニュースを届けることを優先する。
 */
export type SourceDefinition = {
  name: string;
  url: string;
  category: string;
  active: boolean;
};

export const SOURCE_DEFINITIONS: SourceDefinition[] = [
  {
    name: "TechCrunch AI",
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
    category: "AI全般",
    active: true,
  },
  {
    name: "The Verge AI",
    url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
    category: "AI全般",
    active: true,
  },
  {
    name: "The Decoder",
    // AI専門のニュースメディア（英語）。一次情報の要点を拾いやすい
    url: "https://the-decoder.com/feed/",
    category: "AI全般",
    active: true,
  },
  {
    name: "MIT Tech Review",
    url: "https://www.technologyreview.com/feed/",
    category: "研究",
    active: true,
  },
  {
    name: "OpenAI News",
    url: "https://openai.com/news/rss.xml",
    category: "プロダクト",
    active: true,
  },
  {
    name: "Google AI Blog",
    // Google公式のAI関連発表（一次情報）
    url: "https://blog.google/technology/ai/rss/",
    category: "プロダクト",
    active: true,
  },
  {
    name: "Ars Technica",
    url: "https://feeds.arstechnica.com/arstechnica/technology-lab",
    category: "AI全般",
    active: true,
  },
  {
    name: "ITmedia AI+",
    // 数少ない日本語の技術系AIソース（PRではなく編集記事が中心）
    url: "https://rss.itmedia.co.jp/rss/2.0/aiplus.xml",
    category: "国内",
    active: true,
  },
];
