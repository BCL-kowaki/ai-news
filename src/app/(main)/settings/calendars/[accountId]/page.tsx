import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { listCalendars, selectedCalendarIds } from "@/lib/google/calendar";
import { SubmitButton } from "@/components/SubmitButton";
import { saveCalendarSelection } from "../../google-actions";

/**
 * 表示するカレンダーの選択ページ（/settings/calendars/[accountId]）
 *
 * そのアカウントが購読している全カレンダー（家族共用カレンダー含む）を一覧し、
 * ダッシュボードに表示するものをチェックボックスで選ぶ。
 */

export const dynamic = "force-dynamic";

export default async function CalendarSelectPage({
  params,
}: {
  params: { accountId: string };
}) {
  const account = await prisma.googleAccount
    .findUnique({ where: { id: params.accountId } })
    .catch(() => null);
  if (!account) notFound();

  const calendars = await listCalendars(account);
  const selected = new Set(selectedCalendarIds(account));

  return (
    <main>
      {/* iOSの「戻る」リンク風 */}
      <Link
        href="/settings"
        className="inline-flex items-center gap-0.5 text-[15px] text-accent active:opacity-60"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        設定
      </Link>

      <h1 className="large-title mt-2">カレンダーを選ぶ</h1>
      <p className="mt-1 text-[13px] text-muted">
        {account.label}（{account.email}）の予定として表示するカレンダーを選んでください。
        家族共用カレンダーもここに表示されます。
      </p>

      {calendars === null ? (
        <div className="card mt-4 p-5">
          <p className="text-sm leading-relaxed text-red-600">
            カレンダー一覧を取得できませんでした。連携の有効期限が切れている可能性があります。
            設定画面から「再連携」を試してください。
          </p>
        </div>
      ) : (
        <form action={saveCalendarSelection} className="card mt-4 p-5">
          <input type="hidden" name="accountId" value={account.id} />
          <ul className="divide-y divide-line">
            {calendars.map((calendar) => (
              <li key={calendar.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    name="calendarId"
                    value={calendar.id}
                    defaultChecked={
                      selected.has(calendar.id) || (calendar.primary && selected.has("primary"))
                    }
                    className="h-5 w-5 rounded accent-[#C85E47]"
                  />
                  <span className="min-w-0 flex-1 truncate">{calendar.name}</span>
                  {calendar.primary && (
                    <span className="chip shrink-0 bg-accent-soft text-accent">メイン</span>
                  )}
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-end">
            <SubmitButton pendingLabel="保存中…">保存</SubmitButton>
          </div>
        </form>
      )}
    </main>
  );
}
