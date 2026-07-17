import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { formatJstTime, getJstDateKey } from "@/lib/datetime";
import { listTodayEvents, type TodayEvent } from "@/lib/google/calendar";
import { listAllRecentMail, type MailItem } from "@/lib/google/gmail";

/**
 * 朝のブリーフィング生成（Claude Haiku）
 *
 * 今日の予定・未完了タスク・受信メール・最新ニュースを集めて、
 * 秘書らしい朝のまとめ（Markdown）を作り、Briefingテーブルに保存する（1日1件・上書き可）。
 *
 * 呼び出し元:
 * - /api/cron/briefing … GitHub Actionsが毎朝7時(JST)に実行
 * - /api/briefing      … ダッシュボードの「今すぐ生成」ボタン
 *
 * フェイルセーフ：各データ源の失敗は握りつぶして続行。ANTHROPIC_API_KEY未設定なら生成しない。
 */

const BRIEFING_MODEL = "claude-haiku-4-5";

const SYSTEM_PROMPT = `あなたは有能な秘書「SERA」です。与えられた情報から、日本語で朝のブリーフィングをMarkdownで作成してください。

# 構成
1. 冒頭: 今日の全体像を1〜2文で（予定の数・特に重要そうなこと）。見出しは付けない
2. "## 今日の予定" … 時刻順の箇条書き。移動や準備が必要そうなものには一言添える
3. "## メール" … 対応が必要そうなもの・重要そうなものを2〜4件。判断はタイトルと差出人から慎重に（宣伝メールは「その他は宣伝中心」などまとめてよい）
4. "## タスク" … 未完了タスクを優先度順に。期限切れ・今日期限は強調する
5. "## ニュース" … 目を引く2〜3本を1行ずつ

# ルール
- 与えられた情報だけを使う。推測で予定や事実を作らない。該当がない章は「特にありません」と1行
- 全体で1200文字以内。です・ます調で簡潔に
- ブリーフィング本文だけを出力する（前置き・後書き不要）`;

export type BriefingResult = { ok: boolean; content?: string; error?: string };

/** 今日のブリーフィングを生成して保存する */
export async function generateDailyBriefing(): Promise<BriefingResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "ANTHROPIC_API_KEY が未設定です" };
  }

  const dateKey = getJstDateKey();

  // 各データ源を並列取得（失敗しても他は生かすフェイルセーフ）
  const [events, tasks, mail, articles] = await Promise.all([
    listTodayEvents().catch((): TodayEvent[] => []),
    prisma.task
      .findMany({
        where: { status: "open" },
        orderBy: [{ priority: "desc" }, { due: { sort: "asc", nulls: "last" } }],
        take: 10,
      })
      .catch(() => []),
    listAllRecentMail(5).catch((): MailItem[] => []),
    prisma.article
      .findMany({
        orderBy: { publishedAt: "desc" },
        take: 8,
        include: { source: { select: { name: true } } },
      })
      .catch(() => []),
  ]);

  // AIに渡す材料をテキスト化
  const eventsText =
    events
      .map(
        (e) =>
          `- ${e.allDay ? "終日" : formatJstTime(e.start)}${e.end && !e.allDay ? `〜${formatJstTime(e.end)}` : ""} [${e.sourceLabel}] ${e.title}`,
      )
      .join("\n") || "（予定なし）";

  const tasksText =
    tasks
      .map((t) => {
        const prio = t.priority === 2 ? "高" : t.priority === 1 ? "中" : "低";
        const due = t.due ? `（期限: ${getJstDateKey(t.due)}）` : "";
        return `- [優先度${prio}] ${t.title}${due}`;
      })
      .join("\n") || "（未完了タスクなし）";

  const mailText =
    mail
      .map(
        (m) =>
          `- [${m.accountLabel}]${m.unread ? "[未読]" : ""} ${m.subject}（差出人: ${m.from}）`,
      )
      .join("\n") || "（メールなし）";

  const newsText =
    articles.map((a) => `- ${a.titleJa ?? a.title}（${a.source.name}）`).join("\n") ||
    "（ニュースなし）";

  const userPrompt = `今日: ${dateKey}

# 今日の予定
${eventsText}

# 未完了タスク
${tasksText}

# 受信メール（新しい順）
${mailText}

# 最新ニュース
${newsText}`;

  try {
    const client = new Anthropic(); // ANTHROPIC_API_KEY を自動で読む
    const response = await client.messages.create({
      model: BRIEFING_MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const content = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    if (!content) return { ok: false, error: "ブリーフィングを生成できませんでした" };

    // 1日1件。再生成は上書き
    await prisma.briefing.upsert({
      where: { dateKey },
      create: { dateKey, content },
      update: { content },
    });

    return { ok: true, content };
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    console.error("[ブリーフィング] 生成失敗:", message);
    return { ok: false, error: `生成に失敗しました: ${message}` };
  }
}
