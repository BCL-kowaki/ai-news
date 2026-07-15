import Parser from "rss-parser";
const p = new Parser({ timeout: 12000, headers: { "User-Agent": "ai-news/1.0" } });
const now = Date.now();
const urls = [
  ["arXiv cs.AI (生)", "https://rss.arxiv.org/rss/cs.AI"],
  ["arXiv cs.CL/NLP (生)", "https://rss.arxiv.org/rss/cs.CL"],
  ["HuggingFace Papers(厳選)", "https://huggingface.co/papers/feed"],
  ["Google DeepMind", "https://deepmind.google/blog/rss.xml"],
  ["Stanford HAI", "https://hai.stanford.edu/news/rss.xml"],
  ["Berkeley BAIR", "https://bair.berkeley.edu/blog/feed.xml"],
  ["MIT News AI", "https://news.mit.edu/rss/topic/artificial-intelligence2"],
];
for (const [name, url] of urls) {
  try {
    const f = await p.parseURL(url);
    const newest = f.items[0] ? Math.round((now - new Date(f.items[0].isoDate ?? f.items[0].pubDate).getTime())/3600000) : "?";
    console.log(`OK  ${name}: ${f.items.length}件 最新${newest}h前 | "${(f.items[0]?.title||'').slice(0,42)}"`);
  } catch(e){ console.log(`NG  ${name} => ${String(e.message).slice(0,50)}`); }
}
