import Anthropic from "@anthropic-ai/sdk";

/**
 * 記事の要約（Claude Haiku）
 *
 * 画面の「要約」ボタンから呼ばれる、オンデマンド処理。
 * 記事のRSS抜粋（arXivは要旨）を入力に、日本語で短い箇条書き要約を作る。
 *
 * フェイルセーフ設計：
 *   - ANTHROPIC_API_KEY が未設定なら要約せず、その旨のメッセージを返す（システムは止めない）
 *   - API呼び出しが失敗しても例外を投げず、エラーメッセージを返す
 *
 * コスト: Haikuは安価。オンデマンド（押したときだけ）なので使用量は限定的。
 */

// 要約に使うモデル（ユーザー合意によりコスト重視でHaikuを採用）
const SUMMARY_MODEL = "claude-haiku-4-5";

const SYSTEM_PROMPT = [
  "あなたは日本語でニュース記事や論文を要約するアシスタントです。",
  "与えられたタイトルと本文（抜粋）から、日本語で最大3点の簡潔な箇条書き要約を作成してください。",
  "事実のみを述べ、抜粋に書かれていない情報の推測や誇張はしないこと。",
  "各項目は「・」で始め、1行で簡潔に書くこと。前置きや締めの文は不要です。",
].join("");

export type SummaryResult = { ok: boolean; text: string };

export async function summarizeToJa(title: string, content: string): Promise<SummaryResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, text: "要約を使うには ANTHROPIC_API_KEY の設定が必要です。" };
  }
  if (!content.trim()) {
    return { ok: false, text: "この記事には要約できる本文（抜粋）がありません。" };
  }

  try {
    const client = new Anthropic(); // ANTHROPIC_API_KEY を自動で読む
    const response = await client.messages.create({
      model: SUMMARY_MODEL,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `タイトル: ${title}\n\n本文（抜粋）:\n${content}`,
        },
      ],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    return text ? { ok: true, text } : { ok: false, text: "要約を生成できませんでした。" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    console.error("[要約] 失敗:", message);
    return { ok: false, text: `要約に失敗しました：${message}` };
  }
}
