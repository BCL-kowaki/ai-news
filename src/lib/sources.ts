/**
 * RSSソースの定義（単一定義元）
 *
 * ソースを増やしたいときは、この配列に1行足すだけでよい。
 * DBのマイグレーションは不要 —— 収集ジョブ（/api/cron/fetch）の実行時に
 * この定義がDBの Source テーブルへ自動で同期される（syncSources）。
 * 定義から消したソースは自動で active=false になり、収集対象から外れる。
 *
 * active: false にすると、定義を消さずに収集だけ止められる。
 * maxPerFetch: 1回の収集で取り込む最大件数（新しい順）。大量フィード（arXiv等）が
 *              他ソースを埋め尽くさないための上限。省略＝無制限。
 *
 * 【方針】一次情報・技術中心。
 *   Google News（q=AI）は日本語のPR記事・重複・芸能ノイズが多かったため2026-07に除外した。
 *   宣伝ではなく技術・製品・研究・論文のニュースを届けることを優先する。
 */
export type SourceDefinition = {
  name: string;
  url: string;
  category: string;
  active: boolean;
  maxPerFetch?: number;
};

export const SOURCE_DEFINITIONS: SourceDefinition[] = [
  // ── ニュースメディア（技術系） ──
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

  // ── 一次情報（企業・研究機関の公式） ──
  {
    name: "OpenAI News",
    url: "https://openai.com/news/rss.xml",
    category: "プロダクト",
    active: true,
  },
  {
    name: "Google AI Blog",
    url: "https://blog.google/technology/ai/rss/",
    category: "プロダクト",
    active: true,
    maxPerFetch: 10, // アーカイブ含め件数が多いフィードのため上限を設ける
  },
  {
    name: "Google DeepMind",
    // 一流AIラボの公式ブログ（研究の一次情報）
    url: "https://deepmind.google/blog/rss.xml",
    category: "研究",
    active: true,
    maxPerFetch: 10,
  },
  {
    name: "MIT News AI",
    // MITの公式ニュース（AIトピック）
    url: "https://news.mit.edu/rss/topic/artificial-intelligence2",
    category: "研究",
    active: true,
    maxPerFetch: 10,
  },

  // ── 論文（arXiv） ──
  // 1日数百件出るため maxPerFetch で「最新◯件」に強く絞る。
  // 全部は追わず、最新の研究を毎日ピックアップする用途と割り切る。
  {
    name: "arXiv cs.AI（AI全般）",
    url: "https://rss.arxiv.org/rss/cs.AI",
    category: "論文",
    active: true,
    maxPerFetch: 8,
  },
  {
    name: "arXiv cs.CL（言語処理/LLM）",
    url: "https://rss.arxiv.org/rss/cs.CL",
    category: "論文",
    active: true,
    maxPerFetch: 8,
  },
];
