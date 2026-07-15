import { MANUAL_NOTIFY_COUNT } from "./config";
import { buildBroadcastMessages } from "./format";
import { prisma } from "./prisma";
import { postToSlack } from "./slack";

/**
 * 手動ジャンル通知（ダッシュボードのボタンから呼ばれる）
 *
 * 指定ジャンルの最新記事だけをSlackに送る。Reply的な「今すぐ見る」の役割。
 * 記事のstatusは変えない（配信済みかどうかに関わらず、最新を見せるだけ）。
 * Slackは無料なので何回押しても費用は増えない。
 */
export async function notifyByCategory(category: string): Promise<{ count: number }> {
  const articles = await prisma.article.findMany({
    where: {
      status: { in: ["pending", "sent"] },
      source: { category }, // ソースのジャンルで絞り込む
    },
    orderBy: { publishedAt: "desc" },
    take: MANUAL_NOTIFY_COUNT,
    include: { source: { select: { name: true, category: true } } },
  });

  if (articles.length === 0) {
    await postToSlack(`「${category}」の記事はまだありません。`);
    return { count: 0 };
  }

  const messages = buildBroadcastMessages(
    articles.map((article) => ({
      title: article.titleJa ?? article.title,
      url: article.url,
      sourceName: article.source.name,
      category: article.source.category ?? category,
    })),
  );

  for (const message of messages) {
    await postToSlack(message);
  }

  return { count: articles.length };
}
