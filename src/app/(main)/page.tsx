import Link from "next/link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getServerSession } from "next-auth";
import {
  Sparkles,
  CalendarDays,
  ListTodo,
  Newspaper,
  Mail,
  ArrowRight,
} from "lucide-react";
import { authOptions } from "@/lib/nextauth";
import {
  CATEGORIES,
  CATEGORY_STYLE_FALLBACK,
  DASHBOARD_MAIL_COUNT,
  DASHBOARD_NEWS_COUNT,
  DASHBOARD_TASK_COUNT,
} from "@/lib/config";
import { formatJstDateTime, getJstDateKey } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";
import { listTodayEvents, type TodayEvent } from "@/lib/google/calendar";
import { listAllRecentMail, type MailItem } from "@/lib/google/gmail";
import { EventRow } from "@/components/EventRow";
import { MailLink } from "@/components/MailLink";
import { TaskItem } from "@/components/TaskItem";
import { SubmitButton } from "@/components/SubmitButton";
import { AutoResetForm } from "@/components/AutoResetForm";
import { createTask } from "./tasks/actions";
import { GenerateBriefingButton } from "./GenerateBriefingButton";

/**
 * ダッシュボード（/）— ベントグリッド
 *
 * 1画面で「今日必要なもの」を一望する秘書デスク。
 * 各カードは独立して失敗できる（DB障害・未連携でも他のカードは生きる）。
 * ※メモはタブ（/memos）に集約し、ここには置かない。
 *
 * グリッド構成（lg=4カラム）:
 *   [ブリーフィング 2] [今日の予定 2]
 *   [タスク 2]         [メール 2（20件・スクロール）]
 *   [ニュース 4]
 */

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [session, data] = await Promise.all([getServerSession(authOptions), loadDashboard()]);
  const now = new Date();

  return (
    <main>
      {/* あいさつヘッダー（iOSラージタイトル風） */}
      <header>
        <p className="text-[13px] font-semibold text-muted">{formatJstFullDate(now)}</p>
        <h1 className="large-title mt-0.5">
          {greeting(now)}
          {firstName(session?.user?.name) && `、${firstName(session?.user?.name)}さん`}
        </h1>
      </header>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* ① AIブリーフィング */}
        <section className="card p-5 sm:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="card-title">
              <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" />
              今日のブリーフィング
            </h2>
            <GenerateBriefingButton hasBriefing={Boolean(data?.briefing)} />
          </div>
          {data?.briefing ? (
            <div className="report mt-3 text-sm">
              <Markdown remarkPlugins={[remarkGfm]}>{data.briefing.content}</Markdown>
            </div>
          ) : (
            <div className="mt-3 rounded-xl bg-accent-soft p-4">
              <p className="text-sm leading-relaxed text-muted">
                予定・メール・タスク・ニュースをAIがまとめます。毎朝7時に自動生成されるほか、
                「今すぐ生成」でいつでも作れます。
              </p>
            </div>
          )}
        </section>

        {/* ② 今日の予定（全アカウント統合・色分け） */}
        <section className="card p-5 sm:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="card-title">
              <CalendarDays className="h-4 w-4 text-accent" aria-hidden="true" />
              今日の予定
              {data && data.events.length > 0 && (
                <span className="chip bg-accent-soft text-accent">{data.events.length}</span>
              )}
            </h2>
            <Link href="/calendar" className="text-xs font-bold text-muted hover:text-ink">
              すべて見る
            </Link>
          </div>

          {data && data.expiredAccounts.length > 0 && (
            <p className="mt-2 text-xs font-medium text-red-600">
              {data.expiredAccounts.join("・")} の連携が切れています。
              <Link href="/settings" className="underline">
                設定から再連携
              </Link>
            </p>
          )}

          {!data || data.googleAccountCount === 0 ? (
            <div className="mt-3 rounded-xl bg-bg p-4">
              <p className="text-sm leading-relaxed text-muted">
                Googleカレンダー（会社・個人・家族共用）を連携すると、ここに今日の予定が並びます。
              </p>
              <Link
                href="/settings"
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
              >
                設定で連携する
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </div>
          ) : data.events.length === 0 ? (
            <p className="mt-3 text-sm text-muted">今日の予定はありません。</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {data.events.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </ul>
          )}
        </section>

        {/* ③ タスク */}
        <section className="card p-5 sm:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="card-title">
              <ListTodo className="h-4 w-4 text-accent" aria-hidden="true" />
              タスク
              {data && data.openTaskCount > 0 && (
                <span className="chip bg-accent-soft text-accent">{data.openTaskCount}</span>
              )}
            </h2>
            <Link href="/tasks" className="text-xs font-semibold text-muted hover:text-ink">
              すべて見る
            </Link>
          </div>

          {/* クイック追加 */}
          <AutoResetForm action={createTask} className="mt-3 flex gap-2">
            <label htmlFor="dash-task" className="sr-only">
              タスクを追加
            </label>
            <input
              id="dash-task"
              name="title"
              required
              maxLength={200}
              placeholder="タスクを追加…"
              className="input flex-1"
            />
            <SubmitButton pendingLabel="…">追加</SubmitButton>
          </AutoResetForm>

          {data === null ? (
            <p className="mt-3 text-sm text-red-600">DBに接続できませんでした。</p>
          ) : data.tasks.length === 0 ? (
            <p className="mt-3 text-sm text-muted">未完了のタスクはありません。</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {data.tasks.map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </ul>
          )}
        </section>

        {/* ④ メール（最新20件・スクロール表示） */}
        <section className="card p-5 sm:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="card-title">
              <Mail className="h-4 w-4 text-accent" aria-hidden="true" />
              メール
            </h2>
            {data && data.googleAccountCount > 0 && (
              <Link href="/mail" className="text-xs font-semibold text-muted hover:text-ink">
                すべて見る
              </Link>
            )}
          </div>
          {!data || data.googleAccountCount === 0 ? (
            <div className="mt-3 rounded-xl bg-bg p-4">
              <p className="text-sm leading-relaxed text-muted">
                Gmail（会社・個人）を連携すると、最新のメールがここに表示されます。
              </p>
              <Link
                href="/settings"
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
              >
                設定で連携する
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </div>
          ) : data.mail.length === 0 ? (
            <p className="mt-3 text-sm text-muted">メールを取得できませんでした。</p>
          ) : (
            <ul className="mt-2 max-h-[26rem] divide-y divide-line overflow-y-auto pr-1">
              {data.mail.map((mail) => (
                <li key={`${mail.accountEmail}:${mail.id}`} className="py-2">
                  <MailLink
                    webUrl={mail.gmailUrl}
                    threadId={mail.threadId}
                    accountEmail={mail.accountEmail}
                    className="block"
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: mail.colorHex }}
                        aria-hidden="true"
                      />
                      <span
                        className={`min-w-0 flex-1 truncate text-sm ${
                          mail.unread ? "font-semibold" : "font-normal text-muted"
                        }`}
                      >
                        {mail.subject}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate pl-3 text-xs text-faint">
                      {mail.from}・{formatJstDateTime(mail.date)}
                    </span>
                  </MailLink>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ⑤ ニュースダイジェスト */}
        <section className="card p-5 sm:col-span-2 lg:col-span-4">
          <div className="flex items-center justify-between">
            <h2 className="card-title">
              <Newspaper className="h-4 w-4 text-accent" aria-hidden="true" />
              最新ニュース
            </h2>
            <Link href="/news" className="text-xs font-semibold text-muted hover:text-ink">
              すべて見る
            </Link>
          </div>
          {data === null ? (
            <p className="mt-3 text-sm text-red-600">DBに接続できませんでした。</p>
          ) : data.articles.length === 0 ? (
            <p className="mt-3 text-sm text-muted">記事はまだありません（毎時自動収集）。</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {data.articles.map((article) => (
                <li key={article.id} className="py-2.5">
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm font-medium leading-snug underline-offset-2 hover:underline"
                  >
                    {article.title}
                  </a>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    {article.category && (
                      <span
                        className="chip"
                        style={{
                          backgroundColor: article.style.bg,
                          color: article.style.fg,
                        }}
                      >
                        {article.category}
                      </span>
                    )}
                    <span className="text-muted">{article.sourceName}</span>
                    <span className="text-faint">{article.publishedLabel}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

      </div>
    </main>
  );
}

/** 時間帯に応じたあいさつ（JST） */
function greeting(now: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      hour: "numeric",
      hour12: false,
    }).format(now),
  );
  if (hour >= 5 && hour < 11) return "おはようございます";
  if (hour >= 11 && hour < 18) return "こんにちは";
  return "こんばんは";
}

/** "7月17日（金）" 形式（JST） */
function formatJstFullDate(now: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
    weekday: "short",
  })
    .format(now)
    .replace("(", "（")
    .replace(")", "）");
}

/** Googleアカウント名から姓を除いた呼び名を作る（"山田 太郎" → "太郎" は難しいので先頭語を使う） */
function firstName(name: string | null | undefined): string | null {
  if (!name) return null;
  return name.split(/\s+/)[0] ?? null;
}

async function loadDashboard() {
  try {
    const todayKey = getJstDateKey();
    const [
      briefing,
      tasks,
      openTaskCount,
      articles,
      googleAccounts,
      events,
      mail,
    ] = await Promise.all([
        prisma.briefing.findUnique({ where: { dateKey: todayKey } }),
        prisma.task.findMany({
          where: { status: "open" },
          orderBy: [
            { priority: "desc" },
            { due: { sort: "asc", nulls: "last" } },
            { createdAt: "desc" },
          ],
          take: DASHBOARD_TASK_COUNT,
          // 所属プロジェクトのチップを出すため
          include: { project: { select: { id: true, name: true, color: true } } },
        }),
        prisma.task.count({ where: { status: "open" } }),
        prisma.article.findMany({
          where: { readAt: null }, // 未読だけ（既読は /news?filter=read で見返す）
          orderBy: { publishedAt: "desc" },
          take: DASHBOARD_NEWS_COUNT,
          include: { source: { select: { name: true, category: true } } },
        }),
        prisma.googleAccount.findMany({ select: { label: true, status: true } }),
        // Google APIの失敗はカード単位で握りつぶす（他のカードを道連れにしない）
        listTodayEvents().catch((e): TodayEvent[] => {
          console.error("[ダッシュボード] 予定の取得に失敗:", e);
          return [];
        }),
        // 各アカウント10件ずつ取得 → 新しい順に最大20件を表示
        listAllRecentMail(10).catch((e): MailItem[] => {
          console.error("[ダッシュボード] メールの取得に失敗:", e);
          return [];
        }),
      ]);

    return {
      briefing,
      tasks,
      openTaskCount,
      googleAccountCount: googleAccounts.length,
      expiredAccounts: googleAccounts.filter((a) => a.status === "expired").map((a) => a.label),
      events,
      mail: mail.slice(0, DASHBOARD_MAIL_COUNT),
      articles: articles.map((a) => ({
        id: a.id,
        title: a.titleJa ?? a.title,
        url: a.url,
        sourceName: a.source.name,
        category: a.source.category,
        style: CATEGORIES.find((c) => c.name === a.source.category) ?? CATEGORY_STYLE_FALLBACK,
        publishedLabel: formatJstDateTime(a.publishedAt),
      })),
    };
  } catch (error) {
    console.error("[ダッシュボード] 取得失敗:", error);
    return null;
  }
}
