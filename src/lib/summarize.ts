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

/** 要約の最大文字数（日本語）。これを超えないよう指示し、コード側でも安全に上限を効かせる。 */
const SUMMARY_MAX_CHARS = 1000;

const SYSTEM_PROMPT = [
  "あなたは日本語でニュース記事や論文を要約するアシスタントです。",
  "与えられたタイトルと本文（抜粋）から、日本語でレポート風の要約を作成してください。",
  `全体で${SUMMARY_MAX_CHARS}文字以内に必ず収めること（超えてはいけません）。`,
  "構成の目安：冒頭に要点を1〜2文で述べ、その後に背景・詳細・意義を段落でまとめる。",
  "自然な文章（です・ます調）で書き、読みやすいよう段落を分けること。箇条書きにはしない。",
  "事実のみを述べ、抜粋に書かれていない情報の推測や誇張はしないこと。前置きや見出しは不要です。",
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
      // 1000文字（日本語）に収まる余裕を持たせる。日本語1文字≒1〜2トークン
      model: SUMMARY_MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `タイトル: ${title}\n\n本文（抜粋）:\n${content}`,
        },
      ],
    });

    const raw = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    // 安全側の上限（万一1000文字を超えた場合はコード側で切り詰める）
    const text =
      raw.length > SUMMARY_MAX_CHARS ? `${raw.slice(0, SUMMARY_MAX_CHARS - 1)}…` : raw;

    return text ? { ok: true, text } : { ok: false, text: "要約を生成できませんでした。" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    console.error("[要約] 失敗:", message);
    return { ok: false, text: `要約に失敗しました：${message}` };
  }
}
