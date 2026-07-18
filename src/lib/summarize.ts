import Anthropic from "@anthropic-ai/sdk";

/**
 * 記事の要約（Claude Haiku）
 *
 * 画面の「要約」ボタンから呼ばれる、オンデマンド処理。
 * 記事のRSS抜粋（arXivは要旨）を入力に、日本語2000字程度の解説記事を作る。
 * 文体は「こわっきー」スタイル（難しいことを噛み砕いて語りかける）。
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
const SUMMARY_MAX_CHARS = 2200; // 目標2000字。少し超えても切れないよう余裕を持たせる

/**
 * 要約の文体プロンプト（「こわっきー」スタイル）
 *
 * docs参照元: ~/work/myfolda/こわっきーブログ/kowackey_character_profile_v2.md
 * ただし本用途は「理解のための要約」なので、ブログ用の訴求・CTA・共感フックは意図的に外し、
 * 「難しいことを噛み砕く」語り口だけを取り込んでいる。
 */
const SYSTEM_PROMPT = [
  "あなたは、難しいニュースや論文を経営者・事業主向けに噛み砕いて解説する日本語の書き手です。",
  "与えられたタイトルと本文（抜粋）から、読んだ人が内容を正しく理解できる解説記事を書いてください。",
  "",
  "【目的】",
  "理解が目的です。宣伝・売り込み・行動の促し・煽りは一切書かないこと。",
  "",
  `【長さ】全体で1800〜2000文字（${SUMMARY_MAX_CHARS}文字を超えてはいけません）。`,
  "短すぎる要約は不可。各段落を具体例や言い換えで十分に展開し、指定の分量まで書ききること。",
  "元の抜粋が短い場合も、専門用語の説明・仕組みの噛み砕き・仕事への当てはめを丁寧に展開して補うこと",
  "（ただし、書かれていない事実を創作してはいけない。あくまで説明を厚くする）。",
  "",
  "【構成】",
  "1. 冒頭：何が起きたのかを結論から1〜2文で。前置きや挨拶は書かない",
  "2. 「これって要するに何？」：専門用語や仕組みを噛み砕いて説明する",
  "3. どこが新しいのか・何が変わるのか：以前との違いを具体的に",
  "4. 仕事・現場から見るとどういう話か：身近な作業や業務に置き換えて説明する",
  "5. 締め：短く事実ベースのまとめ（1〜3文）。行動を促さない",
  "重要：見出し・記号は一切使わない（#、■、【】、箇条書きの・や-、番号付きリストすべて禁止）。",
  "記事タイトルを本文の先頭に書き直すこともしない。地の文の段落だけで構成すること。",
  "",
  "【文体】",
  "です・ます調を基本に、語りかける話し言葉を混ぜる（「〜なんですね。」「〜なわけです。」）。",
  "1文は短めに保ち、テンポよく読める流れをつくる。",
  "専門用語は必ず直後に噛み砕く（「つまり〜」「要するに〜」「ざっくり言うと〜」）。",
  "抽象的な話は身近な比喩（日常・仕事の場面）に置き換える。",
  "話題を変えるときは「さて。」などの短い接続で転換する。",
  "問いかけ→答えの構造を使ってよい（「なぜかというと〜」）。",
  "強調したい箇所は「実は」「ポイントは」「だからこそ」を使う。",
  "断定しすぎず「〜と思います」「〜と感じています」で柔らかく着地させてよい。",
  "",
  "【禁止】",
  "宣伝・CTA・問い合わせ誘導、「乗り遅れます」等の煽り、上から目線や説教調、",
  "説明のない専門用語の羅列、根拠のない断言、抜粋にない情報の推測や誇張。",
  "解説本文だけを出力すること（前置き・見出し・自己紹介は不要）。",
].join("\n");

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
      // 日本語2000字は約2000〜3000トークン。途中で切れないよう余裕を持たせる
      model: SUMMARY_MODEL,
      max_tokens: 4096,
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
      .trim()
      // 保険：指示に反して見出し記号が付いた場合は行頭の # を落とす
      .replace(/^#{1,6}\s*/gm, "");

    // 安全側の上限（万一上限を超えた場合はコード側で切り詰める）
    const text =
      raw.length > SUMMARY_MAX_CHARS ? `${raw.slice(0, SUMMARY_MAX_CHARS - 1)}…` : raw;

    return text ? { ok: true, text } : { ok: false, text: "要約を生成できませんでした。" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    console.error("[要約] 失敗:", message);
    return { ok: false, text: `要約に失敗しました：${message}` };
  }
}
