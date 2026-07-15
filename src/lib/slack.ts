/**
 * Slack Incoming Webhook クライアント
 *
 * Slack Appで発行した「Incoming Webhook URL」にJSONをPOSTするだけで、
 * 指定チャンネルにメッセージを投稿できる。トークン管理も署名検証も不要。
 *
 * LINEと違い送信数の無料枠上限は無い（レート制限＝毎秒1通程度のみ）。
 */

function getWebhookUrl(): string {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    throw new Error("SLACK_WEBHOOK_URL が未設定です");
  }
  return url;
}

/**
 * Slackにテキストを投稿する。
 *
 * @param text 投稿本文（Slackの mrkdwn 記法が使える）
 * @param unfurl リンクを自動プレビュー展開するか。記事一覧は件数が多く邪魔になるため既定はfalse
 */
export async function postToSlack(text: string, unfurl = false): Promise<void> {
  const response = await fetch(getWebhookUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      unfurl_links: unfurl,
      unfurl_media: unfurl,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Slack投稿に失敗しました (HTTP ${response.status}): ${body}`);
  }
}
