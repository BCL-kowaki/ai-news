import type { GoogleAccount } from "@prisma/client";
import { googleApiGetJson, listGoogleAccounts } from "./api";

/**
 * Gmailの取得（読み取り専用・メタデータのみ）
 *
 * 受信トレイの最新メールを「件名・差出人・抜粋・未読か」だけ取得する。
 * 本文はDBにもどこにも保存しない（表示のたびにAPIから取得。セキュリティ優先）。
 * 1アカウントの失敗は全体を止めない（フェイルセーフ）。
 */

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export type MailItem = {
  id: string;
  threadId: string;
  subject: string;
  from: string; // 表示名だけに整形済み
  snippet: string;
  date: Date;
  unread: boolean;
  accountLabel: string;
  accountEmail: string;
  colorHex: string;
  gmailUrl: string; // Gmail本体で開くリンク
};

type MessageListResponse = { messages?: { id: string; threadId: string }[] };
type MessageMetadata = {
  id: string;
  threadId: string;
  snippet?: string;
  labelIds?: string[];
  internalDate?: string; // epoch millis（文字列）
  payload?: { headers?: { name: string; value: string }[] };
};

/** "山田 太郎 <taro@example.com>" → "山田 太郎" に整形する */
function displayName(from: string): string {
  const match = from.match(/^\s*"?([^"<]+?)"?\s*</);
  return (match?.[1] ?? from).trim();
}

/** 1アカウントの受信トレイから最新メールを取得する。失敗時は空配列 */
export async function listRecentMail(
  account: GoogleAccount,
  count: number,
): Promise<MailItem[]> {
  // 1. 受信トレイの最新メッセージIDを取得
  const list = await googleApiGetJson<MessageListResponse>(
    account,
    `${BASE}/messages?labelIds=INBOX&maxResults=${count}`,
  );
  if (!list?.messages?.length) return [];

  // 2. 各メッセージのメタデータ（件名・差出人・日時・未読）を並列取得
  const details = await Promise.all(
    list.messages.map((m) =>
      googleApiGetJson<MessageMetadata>(
        account,
        `${BASE}/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
      ),
    ),
  );

  return details
    .filter((d): d is MessageMetadata => d !== null)
    .map((d) => {
      const headers = d.payload?.headers ?? [];
      const header = (name: string) =>
        headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
      return {
        id: d.id,
        threadId: d.threadId,
        subject: header("Subject") || "（件名なし）",
        from: displayName(header("From")),
        snippet: (d.snippet ?? "").trim(),
        date: new Date(Number(d.internalDate ?? Date.now())),
        unread: (d.labelIds ?? []).includes("UNREAD"),
        accountLabel: account.label,
        accountEmail: account.email,
        colorHex: account.colorHex ?? "#709BAD",
        // アカウント指定つきでGmail本体のスレッドを開くURL
        gmailUrl: `https://mail.google.com/mail/u/${encodeURIComponent(account.email)}/#all/${d.threadId}`,
      };
    });
}

/** 全連携アカウントの最新メールをまとめて新しい順に返す */
export async function listAllRecentMail(countPerAccount: number): Promise<MailItem[]> {
  const accounts = await listGoogleAccounts();
  if (accounts.length === 0) return [];
  const results = await Promise.all(accounts.map((a) => listRecentMail(a, countPerAccount)));
  return results.flat().sort((a, b) => b.date.getTime() - a.date.getTime());
}
