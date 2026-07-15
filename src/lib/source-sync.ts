import { prisma } from "./prisma";
import { SOURCE_DEFINITIONS } from "./sources";

/**
 * src/lib/sources.ts の定義をDBの Source テーブルへ同期する。
 *
 * 収集ジョブの実行時に毎回呼ぶことで、ソースの増減は sources.ts の編集だけで完結する
 * （DB作業もseedコマンドも不要）:
 *   - 追加/変更: 定義どおりに upsert する
 *   - 削除:      定義から消えたソースは active=false にする（収集対象から自動で外れる）
 *
 * URLを一致キーにするため、URLを書き換えたソースは「別ソースの新規追加＋旧ソースの無効化」になる。
 */
export async function syncSources(): Promise<void> {
  // 1. 定義を upsert（追加・更新）
  await Promise.all(
    SOURCE_DEFINITIONS.map((definition) =>
      prisma.source.upsert({
        where: { url: definition.url },
        create: {
          name: definition.name,
          url: definition.url,
          category: definition.category,
          active: definition.active,
          maxPerFetch: definition.maxPerFetch ?? null,
        },
        update: {
          name: definition.name,
          category: definition.category,
          active: definition.active,
          maxPerFetch: definition.maxPerFetch ?? null,
        },
      }),
    ),
  );

  // 2. 定義に無いのに active のままのソースを無効化（sources.ts から消したものを収集対象から外す）
  const definedUrls = SOURCE_DEFINITIONS.map((d) => d.url);
  await prisma.source.updateMany({
    where: { active: true, url: { notIn: definedUrls } },
    data: { active: false },
  });
}
