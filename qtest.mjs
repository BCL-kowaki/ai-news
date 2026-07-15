import Parser from "rss-parser";
const p = new Parser({ timeout: 10000, headers: { "User-Agent": "ai-news/1.0" } });
const now = Date.now();
const urls = [
  ["Google AI Blog", "https://blog.google/technology/ai/rss/"],
  ["Hugging Face Blog", "https://huggingface.co/blog/feed.xml"],
  ["The Decoder", "https://the-decoder.com/feed/"],
  ["ITmedia AI+", "https://rss.itmedia.co.jp/rss/2.0/aiplus.xml"],
];
for (const [name, url] of urls) {
  try {
    const f = await p.parseURL(url);
    const newest = f.items[0] ? Math.round((now - new Date(f.items[0].isoDate ?? f.items[0].pubDate).getTime())/3600000) : "?";
    console.log(`OK  ${name} (${f.items.length}件, 最新${newest}h前) "${f.items[0]?.title?.slice(0,45)}"`);
  } catch(e){ console.log(`NG  ${name} => ${e.message}`); }
}
