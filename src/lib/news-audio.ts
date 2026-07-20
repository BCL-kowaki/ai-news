import Anthropic from "@anthropic-ai/sdk";
import { head } from "@vercel/blob";
import { getReadableAudioUrl } from "@/lib/blob";
import { CATEGORY_SLUG, NEWS_AUDIO_DIGEST_COUNT } from "@/lib/config";
import { getJstDateKey } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";
import { markdownToSpeechText, synthesizeToBlob } from "@/lib/tts";

/**
 * ニュースの音声化（通勤中に聞く用）
 *
 * 3つの単位に対応する:
 *   - article  … 記事1本を要約して読み上げる
 *   - category … そのジャンルの受信箱をまとめて読み上げる（ダイジェスト）
 *   - inbox    … 受信箱ぜんぶをまとめて読み上げる（ダイジェスト）
 *
 * 流れ: 対象記事を集める → Haikuが読み上げ用の原稿を書く → Gemini TTSで音声化 → Blobへ保存。
 *
 * 【作り直しの考え方】
 * - 記事1本は内容が変わらないので、一度作ったら使い回す（Blobに同名で残っていれば再生成しない）
 * - ダイジェストは片付けるたびに中身が変わるため、その日ぶんを毎回作り直す
 */

const SCRIPT_MODEL = "claude-haiku-4-5";

export type NewsAudioScope =
  | { type: "article"; articleId: string }
  | { type: "category"; category: string }
  | { type: "inbox" };

export type NewsAudioResult = { ok: boolean; url?: string; title?: string; error?: string };

/** 受信箱の条件（片付けフラグがどれも立っていない） */
const INBOX_WHERE = { favoritedAt: null, savedAt: null, readAt: null } as const;

export async function generateNewsAudio(scope: NewsAudioScope): Promise<NewsAudioResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "ANTHROPIC_API_KEY が未設定です" };
  }

  if (scope.type === "article") return generateArticleAudio(scope.articleId);
  return generateDigestAudio(scope);
}

/** 記事1本の読み上げ（内容が変わらないので作ったら使い回す） */
async function generateArticleAudio(articleId: string): Promise<NewsAudioResult> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { title: true, titleJa: true, contentText: true },
  });
  if (!article) return { ok: false, error: "記事が見つかりませんでした" };

  const title = article.titleJa ?? article.title;
  const pathname = `news/article-${articleId}.wav`;

  // すでに作ってあれば再利用（AI・TTSを呼ばずに済む）
  const cached = await findExistingAudio(pathname);
  if (cached) return { ok: true, url: cached, title };

  if (!article.contentText) {
    return { ok: false, error: "この記事には読み上げる本文（抜粋）がありません" };
  }

  const script = await writeScript(
    "1本のニュース記事",
    `タイトル: ${title}\n本文抜粋: ${article.contentText}`,
    "この記事の内容を、通勤中に聞いて分かるように150〜300字で説明してください。",
  );
  if (!script.ok) return { ok: false, error: script.error };

  return synthesize(script.text, pathname, title);
}

/** ジャンル別／受信箱ぜんぶのダイジェスト（中身が変わるので毎回作り直す） */
async function generateDigestAudio(
  scope: Exclude<NewsAudioScope, { type: "article" }>,
): Promise<NewsAudioResult> {
  const isCategory = scope.type === "category";
  const where = isCategory ? { category: scope.category, ...INBOX_WHERE } : INBOX_WHERE;

  const articles = await prisma.article.findMany({
    where,
    orderBy: { publishedAt: "desc" },
    take: NEWS_AUDIO_DIGEST_COUNT,
    select: { title: true, titleJa: true, contentText: true, category: true },
  });

  if (articles.length === 0) {
    return { ok: false, error: "読み上げる記事がありません（受信箱は空です）" };
  }

  const label = isCategory ? `${scope.category}のニュース` : "今日のニュース";
  const material = articles
    .map((a, i) => {
      const excerpt = (a.contentText ?? "").replace(/\s+/g, " ").slice(0, 200);
      const cat = !isCategory && a.category ? `[${a.category}] ` : "";
      return `${i + 1}. ${cat}${a.titleJa ?? a.title}${excerpt ? `\n   抜粋: ${excerpt}` : ""}`;
    })
    .join("\n");

  const instruction = isCategory
    ? `${scope.category}ジャンルの${articles.length}本から、特に注目すべきものを選んで紹介してください。`
    : `${articles.length}本のニュースを、カテゴリ（経済・研究・技術・エンタメ・動画）ごとにまとめて紹介してください。`;

  const script = await writeScript(label, material, instruction);
  if (!script.ok) return { ok: false, error: script.error };

  // その日ぶんを上書きする（片付けるたびに中身が変わるため）
  // ファイル名はASCIIにする（日本語だと署名付きURLの照合に失敗して403になる）
  const key = isCategory ? `category-${CATEGORY_SLUG[scope.category] ?? "other"}` : "inbox";
  const pathname = `news/${key}-${getJstDateKey()}.wav`;
  return synthesize(script.text, pathname, label);
}

/** 読み上げ原稿をAIに書かせる（耳で聞いて分かる文章にする） */
async function writeScript(
  label: string,
  material: string,
  instruction: string,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const system = [
    "あなたはニュース番組の原稿を書く担当です。日本語で、耳で聞いて分かる原稿を書いてください。",
    instruction,
    "",
    "# ルール",
    "- 与えられた情報だけを使う。推測で事実を作らない",
    "- 記号・箇条書き・マークダウンは使わず、話し言葉の地の文で書く",
    "- URLや英字の羅列は読み上げない。専門用語は簡単に言い換える",
    "- 全体で1200字以内。です・ます調",
    "- 原稿本文だけを出力する（前置き・後書き不要）",
  ].join("\n");

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: SCRIPT_MODEL,
      max_tokens: 2048,
      system,
      messages: [{ role: "user", content: `${label}\n\n${material}` }],
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return text ? { ok: true, text } : { ok: false, error: "原稿を作成できませんでした" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    console.error("[ニュース音声] 原稿作成に失敗:", message);
    return { ok: false, error: `原稿の作成に失敗しました: ${message}` };
  }
}

/** 原稿を音声にしてBlobへ保存し、再生用の署名付きURLを返す */
async function synthesize(
  script: string,
  pathname: string,
  title: string,
): Promise<NewsAudioResult> {
  const audio = await synthesizeToBlob(markdownToSpeechText(script), pathname);
  if (!audio.ok || !audio.url) return { ok: false, error: audio.error ?? "音声化に失敗しました" };
  return { ok: true, url: await getReadableAudioUrl(audio.url), title };
}

/** 既に同名の音声がBlobにあれば、その再生用URLを返す（無ければ null） */
async function findExistingAudio(pathname: string): Promise<string | null> {
  try {
    const existing = await head(pathname);
    return existing?.url ? await getReadableAudioUrl(existing.url) : null;
  } catch {
    // 見つからない場合は例外になる（＝未作成）ので、作りに行く
    return null;
  }
}
