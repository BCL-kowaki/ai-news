import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

/**
 * ニュースの好み学習（お気に入りの傾向をAIが読み取る）
 *
 * お気に入りに入れた記事のタイトル・本文抜粋をClaude Haikuに渡し、
 * 「関心キーワード」と「傾向の説明」を抽出して NewsPreference に保存する。
 * 保存したキーワードは、新着記事の「おすすめ」判定（news-recommend）に使う。
 *
 * フェイルセーフ：キー未設定・API失敗でも例外を投げず、理由を返すだけ。
 */

const MODEL = "claude-haiku-4-5";

/** 学習の最低件数（少なすぎると傾向が偏るため） */
export const MIN_FAVORITES_TO_LEARN = 3;

const SYSTEM_PROMPT = `あなたはニュースキュレーターです。ユーザーがお気に入りに保存した記事の一覧から、その人の関心の傾向を分析してください。

出力はJSONのみ。次の形式に厳密に従うこと（前置き・コードブロック不要）:
{"keywords": ["キーワード1", "キーワード2", ...], "summary": "傾向の説明（60文字以内）"}

# ルール
- keywords は10〜20個。記事タイトルに実際に現れそうな語を選ぶ（日本語と英語の両方を含めてよい。例: "エージェント", "agent", "強化学習", "RAG"）
- 一般的すぎる語（"AI", "ニュース", "技術"）は避け、その人固有の関心が表れる語を選ぶ
- summary は「〜に関心が高い」といった形で簡潔に`;

export type LearnResult = { ok: boolean; keywords?: string[]; summary?: string; error?: string };

/** お気に入りから好みを学習して保存する */
export async function learnNewsPreference(): Promise<LearnResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "ANTHROPIC_API_KEY が未設定です" };
  }

  const favorites = await prisma.article.findMany({
    where: { favoritedAt: { not: null } },
    orderBy: { favoritedAt: "desc" },
    take: 50, // 直近50件の好みを見る
    select: { title: true, titleJa: true, contentText: true },
  });

  if (favorites.length < MIN_FAVORITES_TO_LEARN) {
    return {
      ok: false,
      error: `お気に入りが${MIN_FAVORITES_TO_LEARN}件以上必要です（現在${favorites.length}件）`,
    };
  }

  const list = favorites
    .map((f, i) => {
      const title = f.titleJa ?? f.title;
      const excerpt = (f.contentText ?? "").slice(0, 200);
      return `${i + 1}. ${title}${excerpt ? `\n   ${excerpt}` : ""}`;
    })
    .join("\n");

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `お気に入り記事:\n${list}` }],
    });

    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    // JSON以外が混ざっても拾えるよう、最初の { } を取り出す
    const json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as {
      keywords?: unknown;
      summary?: unknown;
    };
    const keywords = Array.isArray(json.keywords)
      ? json.keywords.filter((k): k is string => typeof k === "string" && k.length > 0).slice(0, 20)
      : [];
    const summary = typeof json.summary === "string" ? json.summary.slice(0, 100) : "";

    if (keywords.length === 0) {
      return { ok: false, error: "傾向を抽出できませんでした" };
    }

    await prisma.newsPreference.upsert({
      where: { id: "default" },
      create: { id: "default", keywords, summary, favoriteCount: favorites.length },
      update: { keywords, summary, favoriteCount: favorites.length },
    });

    return { ok: true, keywords, summary };
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    console.error("[好み学習] 失敗:", message);
    return { ok: false, error: `学習に失敗しました: ${message}` };
  }
}

/** 保存済みの好み（未学習ならnull） */
export async function getNewsPreference() {
  const pref = await prisma.newsPreference.findUnique({ where: { id: "default" } }).catch(() => null);
  if (!pref) return null;
  const keywords = Array.isArray(pref.keywords)
    ? (pref.keywords as unknown[]).filter((k): k is string => typeof k === "string")
    : [];
  return { keywords, summary: pref.summary, favoriteCount: pref.favoriteCount, updatedAt: pref.updatedAt };
}
