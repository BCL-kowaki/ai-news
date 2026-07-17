import Anthropic from "@anthropic-ai/sdk";

/**
 * 会議のレポート要約（Claude Haiku）
 *
 * 文字起こし全文を入力に、見出し・表つきのMarkdownレポートを生成する。
 * 画面側で react-markdown（GFM対応）を使って整形表示する。
 *
 * フェイルセーフ設計：キー未設定・API失敗でも例外を投げず、エラーメッセージを返す。
 */

const REPORT_MODEL = "claude-haiku-4-5";

const SYSTEM_PROMPT = `あなたは優秀な秘書です。会議の文字起こしから、日本語のレポートをMarkdownで作成してください。

# 構成（この順で。該当が無い章は省いてよい）
1. 冒頭: 会議の概要表（| 項目 | 内容 | の2列。日時・参加者・目的・結論の要旨）
2. "## 要点" … 会議の重要ポイントを箇条書き（5点以内）
3. "## 決定事項" … 決まったことを箇条書き。決定に至った理由も1行で
4. "## TODO・宿題" … 表形式（| タスク | 担当 | 期限 |）。不明な欄は「—」
5. "## 議論の詳細" … 話題ごとに "### 小見出し" を付けて経緯を段落でまとめる
6. "## 次回に向けて" … 持ち越し事項・次回日程（あれば）

# ルール
- Markdownの見出し・表・箇条書きを正しく使う（GFM）
- 文字起こしに無い内容を推測で書かない。不明な点は「—」や「（不明）」とする
- 全体で2500文字以内。です・ます調
- レポート本文だけを出力する（前置き・後書き不要）`;

export type MeetingReportResult = { ok: boolean; text: string };

export async function generateMeetingReport(
  title: string,
  transcript: string,
): Promise<MeetingReportResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, text: "レポート生成には ANTHROPIC_API_KEY の設定が必要です。" };
  }
  if (!transcript.trim()) {
    return { ok: false, text: "文字起こしがまだありません。先に文字起こしを実行してください。" };
  }

  try {
    const client = new Anthropic(); // ANTHROPIC_API_KEY を自動で読む
    const response = await client.messages.create({
      model: REPORT_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `会議名: ${title}\n\n文字起こし:\n${transcript}`,
        },
      ],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    return text ? { ok: true, text } : { ok: false, text: "レポートを生成できませんでした。" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    console.error("[会議レポート] 失敗:", message);
    return { ok: false, text: `レポート生成に失敗しました：${message}` };
  }
}
