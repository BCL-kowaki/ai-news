import Anthropic from "@anthropic-ai/sdk";
import { CATEGORIES, CLASSIFIABLE_CATEGORIES } from "./config";

/**
 * 記事のカテゴリ判定（経済 / 研究 / 技術 / エンタメ）
 *
 * 収集時に新着記事だけをまとめて判定し `Article.category` に保存する。
 * 1回のAI呼び出しで複数記事を判定するのでコストは小さい（Haiku・タイトル中心）。
 *
 * フェイルセーフ:
 *   - ANTHROPIC_API_KEY が未設定／API失敗でも例外は投げず、既定カテゴリを返す
 *   - 判定結果が定義外の名前だった場合も既定カテゴリに寄せる
 */

const CLASSIFY_MODEL = "claude-haiku-4-5";

/** 1回のAI呼び出しで判定する記事数（多すぎると精度と安定性が落ちる） */
const BATCH_SIZE = 25;

/** 判定できなかったときの既定カテゴリ（AIニュースの多数派） */
const DEFAULT_CATEGORY = "技術";

/** ソースの種類から自動で決まるカテゴリ（AI判定を使わない分） */
const SOURCE_FIXED: Record<string, string> = {
  動画: "動画", // YouTube
  論文: "研究", // arXiv
};

export type ClassifyInput = { id: string; title: string; contentText?: string | null };

/** ソース種別だけで決まるカテゴリを返す（決まらなければ null） */
export function fixedCategoryFromSource(sourceCategory: string | null): string | null {
  if (!sourceCategory) return null;
  return SOURCE_FIXED[sourceCategory] ?? null;
}

/**
 * 記事をまとめてカテゴリ判定する。
 * @returns id → カテゴリ名 の対応表（判定できなかった記事は既定カテゴリ）
 */
export async function classifyArticles(
  articles: ClassifyInput[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (articles.length === 0) return result;

  // キー未設定なら全件を既定カテゴリにして終わり（システムは止めない）
  if (!process.env.ANTHROPIC_API_KEY) {
    for (const a of articles) result.set(a.id, DEFAULT_CATEGORY);
    return result;
  }

  const client = new Anthropic();
  const valid = new Set(CLASSIFIABLE_CATEGORIES.map((c) => c.name));

  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    const decided = await classifyBatch(client, batch, valid);
    Array.from(decided).forEach(([id, category]) => result.set(id, category));
  }

  // 取りこぼしは既定カテゴリで埋める
  for (const a of articles) {
    if (!result.has(a.id)) result.set(a.id, DEFAULT_CATEGORY);
  }
  return result;
}

async function classifyBatch(
  client: Anthropic,
  batch: ClassifyInput[],
  valid: Set<string>,
): Promise<Map<string, string>> {
  const decided = new Map<string, string>();

  const categoryGuide = CLASSIFIABLE_CATEGORIES.map(
    (c) => `- ${c.name}: ${c.description}`,
  ).join("\n");

  // 番号で対応付けする（IDをそのまま返させるより崩れにくい）
  const list = batch
    .map((a, idx) => {
      const excerpt = (a.contentText ?? "").slice(0, 150);
      return `${idx + 1}. ${a.title}${excerpt ? `\n   （抜粋: ${excerpt}）` : ""}`;
    })
    .join("\n");

  const system = [
    "あなたはAI関連ニュースを分類する担当です。",
    "各記事を次のカテゴリのどれか1つに分類してください。\n",
    categoryGuide,
    "\n出力は「番号:カテゴリ名」を1行ずつ、記事の数だけ。他の文章は一切書かないこと。",
    "例:\n1:技術\n2:経済",
  ].join("\n");

  try {
    const response = await client.messages.create({
      model: CLASSIFY_MODEL,
      max_tokens: 500,
      system,
      messages: [{ role: "user", content: list }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    // 「番号:カテゴリ」を拾って記事に割り当てる
    for (const line of text.split("\n")) {
      const m = line.match(/(\d+)\s*[:：]\s*(\S+)/);
      if (!m) continue;
      const idx = Number(m[1]) - 1;
      const name = m[2].trim();
      const article = batch[idx];
      if (article && valid.has(name)) decided.set(article.id, name);
    }
  } catch (error) {
    console.error("[分類] 失敗:", error instanceof Error ? error.message : error);
    // 失敗時は空のまま返す（呼び出し側が既定カテゴリで埋める）
  }

  return decided;
}

/** 定義済みカテゴリかどうか（URLパラメータの検証などに使う） */
export function isKnownCategory(name: string): boolean {
  return CATEGORIES.some((c) => c.name === name);
}
