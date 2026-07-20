import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { BRIEFING_MAIL_COUNT, BRIEFING_NEWS_COUNT, CATEGORIES } from "@/lib/config";
import { formatJstTime, getJstDateKey } from "@/lib/datetime";
import { listTodayEvents, type TodayEvent } from "@/lib/google/calendar";
import { listAllRecentMail, type MailItem } from "@/lib/google/gmail";
import { markdownToSpeechText, synthesizeToBlob } from "@/lib/tts";

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
3. "## メール" … 受信メール（最大50件）から、対応が必要そうなもの・重要そうなものを優先度順に最大8件。判断はタイトルと差出人から慎重に。残りは「ほか◯件は宣伝・通知中心」のように1行でまとめる
4. "## タスク" … 未完了タスクを優先度順に。期限切れ・今日期限は強調する
5. "## 今日の注目ニュース" … カテゴリ（経済／研究／技術／エンタメ／動画）ごとに "### カテゴリ名" の小見出しを立て、
   そのカテゴリで特に注目すべき1〜2本を選び、**何が起きたのか・なぜ重要かを2〜3文で要約**する。
   単なるタイトルの列挙にはしない。記事が無いカテゴリは小見出しごと省略する

# ルール
- 与えられた情報だけを使う。推測で予定や事実を作らない。該当がない章は「特にありません」と1行
- 全体で2000文字以内。です・ます調で簡潔に
- 音声で読み上げられることも想定し、記号の多用を避けて自然な文章にする
- ブリーフィング本文だけを出力する（前置き・後書き不要）`;

export type BriefingResult = { ok: boolean; content?: string; error?: string };

/**
 * 注目ニュースの材料を取る。
 * まず直近24時間を狙い、収集が滞って0件のときは期間を広げて最新記事を拾う
 * （「ニュースなし」で章が空になるのを防ぐ）。
 */
async function loadRecentArticles() {
  const select = {
    orderBy: { publishedAt: "desc" as const },
    take: BRIEFING_NEWS_COUNT,
    include: { source: { select: { name: true } } },
  };
  const recent = await prisma.article.findMany({
    where: { publishedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    ...select,
  });
  if (recent.length > 0) return recent;
  return prisma.article.findMany(select);
}

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
    // 各アカウント20件ずつ取得 → 合算で新しい順に最大50件を材料にする
    listAllRecentMail(20)
      .then((m) => m.slice(0, BRIEFING_MAIL_COUNT))
      .catch((): MailItem[] => []),
    // 注目ニュース用：新しい記事を多めに取る（カテゴリごとに要約させるため本文抜粋も渡す）
    loadRecentArticles().catch(() => []),
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

  // カテゴリごとにまとめて渡す（AIがカテゴリ別に注目記事を選んで要約できるように）
  const byCategory = new Map<string, typeof articles>();
  for (const a of articles) {
    const key = a.category ?? "その他";
    byCategory.set(key, [...(byCategory.get(key) ?? []), a]);
  }
  const newsText =
    CATEGORIES.map((c) => {
      const list = byCategory.get(c.name);
      if (!list || list.length === 0) return null;
      const lines = list
        .map((a) => {
          const excerpt = (a.contentText ?? "").replace(/\s+/g, " ").slice(0, 200);
          return `- ${a.titleJa ?? a.title}（${a.source.name}）${excerpt ? `\n  抜粋: ${excerpt}` : ""}`;
        })
        .join("\n");
      return `## ${c.name}\n${lines}`;
    })
      .filter(Boolean)
      .join("\n\n") || "（ニュースなし）";

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

    // 1日1件。再生成は上書き（音声は作り直すのでいったん消す）
    await prisma.briefing.upsert({
      where: { dateKey },
      create: { dateKey, content },
      update: { content, audioUrl: null },
    });

    // 読み上げ音声を作る（失敗してもブリーフィング自体は成功扱い＝止めない）
    const audio = await synthesizeToBlob(
      markdownToSpeechText(content),
      `briefing/${dateKey}.wav`,
    );
    if (audio.ok && audio.url) {
      await prisma.briefing.update({ where: { dateKey }, data: { audioUrl: audio.url } });
    } else if (audio.error) {
      console.warn("[ブリーフィング] 音声生成をスキップ:", audio.error);
    }

    return { ok: true, content };
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    console.error("[ブリーフィング] 生成失敗:", message);
    return { ok: false, error: `生成に失敗しました: ${message}` };
  }
}
