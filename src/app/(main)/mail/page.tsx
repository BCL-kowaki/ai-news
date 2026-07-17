import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { MAIL_LIST_COUNT } from "@/lib/config";
import { formatJstDateTime } from "@/lib/datetime";
import { listGoogleAccounts } from "@/lib/google/api";
import { listRecentMail, type MailItem } from "@/lib/google/gmail";
import { MailLink } from "@/components/MailLink";

/**
 * メール一覧ページ（/mail）
 *
 * 連携済みの各Gmailアカウントの受信トレイ最新メールをアカウント別に表示する。
 * 本文はどこにも保存せず、開くのはGmail本体（リンク遷移）。
 */

export const dynamic = "force-dynamic";

export default async function MailPage() {
  const accounts = await listGoogleAccounts();

  // アカウントごとに並列取得（1つの失敗が他を止めないよう個別にcatch）
  const mailByAccount = await Promise.all(
    accounts.map(async (account) => ({
      account,
      mail: await listRecentMail(account, MAIL_LIST_COUNT).catch((e): MailItem[] => {
        console.error(`[メール] 取得失敗（${account.email}）:`, e);
        return [];
      }),
    })),
  );

  return (
    <main>
      <h1 className="large-title">メール</h1>
      <p className="mt-1 text-[13px] text-muted">
        各アカウントの受信トレイの最新{MAIL_LIST_COUNT}件。タイトルを押すとGmailで開きます。
      </p>

      {accounts.length === 0 ? (
        <div className="card mt-4 p-5">
          <p className="text-sm leading-relaxed text-muted">
            Gmailアカウントがまだ連携されていません。
          </p>
          <Link
            href="/settings"
            className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
          >
            設定で連携する
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          {mailByAccount.map(({ account, mail }) => (
            <section key={account.id}>
              <h2 className="flex items-center gap-2 px-1 text-[13px] font-semibold text-muted">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: account.colorHex ?? "#709BAD" }}
                  aria-hidden="true"
                />
                {account.label}
                <span className="font-normal text-faint">{account.email}</span>
              </h2>

              <div className="card mt-2 overflow-hidden">
                {account.status === "expired" ? (
                  <p className="p-4 text-sm text-red-600">
                    連携の有効期限が切れています。
                    <Link href="/settings" className="underline">
                      設定から再連携してください
                    </Link>
                    。
                  </p>
                ) : mail.length === 0 ? (
                  <p className="p-4 text-sm text-muted">メールを取得できませんでした。</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {mail.map((m) => (
                      <li key={m.id}>
                        <MailLink
                          webUrl={m.gmailUrl}
                          threadId={m.threadId}
                          accountEmail={m.accountEmail}
                          className="block px-4 py-3 transition-colors duration-150 hover:bg-bg active:opacity-60"
                        >
                          <span className="flex items-baseline justify-between gap-3">
                            <span
                              className={`min-w-0 flex-1 truncate text-sm ${
                                m.unread ? "font-semibold" : "text-muted"
                              }`}
                            >
                              {m.subject}
                            </span>
                            <span className="shrink-0 text-xs tabular-nums text-faint">
                              {formatJstDateTime(m.date)}
                            </span>
                          </span>
                          <span className="mt-0.5 flex items-center gap-1 text-xs text-faint">
                            <span className="min-w-0 truncate">{m.from}</span>
                            {m.unread && (
                              <span className="chip shrink-0 bg-accent-soft text-accent">未読</span>
                            )}
                          </span>
                          {m.snippet && (
                            <span className="mt-1 block truncate text-xs leading-relaxed text-muted">
                              {m.snippet}
                            </span>
                          )}
                        </MailLink>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <a
                href={`https://mail.google.com/mail/u/${encodeURIComponent(account.email)}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 px-1 text-xs font-semibold text-muted hover:text-ink"
              >
                Gmailで開く
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
