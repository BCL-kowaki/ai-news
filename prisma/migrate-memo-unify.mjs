/**
 * メモ統合の一度きりのデータ移行（iPhoneメモ帳方式への切り替え）
 *
 * 実行前に `npx prisma db push` で新しい列（pinned / deletedAt）を作っておくこと。
 * DATABASE_URL は .env から読み込ませる（Prisma Client自体は .env を自動で読まない）。
 *
 *   node --env-file=.env prisma/migrate-memo-unify.mjs
 *
 * やること:
 *   1. 旧「よく使うメモ」(kind='pinned') を pinned=true にする
 *   2. 旧タイトルを本文の1行目に統合する（新方式はタイトル列を使わない）
 *   3. 統合済みの目印として title を空にする
 *
 * 何度実行しても同じ結果になるように作ってある（2で title IS NOT NULL のものだけを扱い、
 * 3で title を消すため、2回目以降は対象0件になる）。
 * 本文は消さず前に足すだけなので、内容が失われることはない。
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. よく使うメモ → ピン留め
  const pinned = await prisma.$executeRaw`
    UPDATE "Memo" SET "pinned" = true WHERE "kind" = 'pinned' AND "pinned" = false
  `;

  // 2. タイトルを本文1行目へ（タイトルと本文が重複しないよう、既に1行目が同じなら足さない）
  const merged = await prisma.$executeRaw`
    UPDATE "Memo"
    SET "body" = "title" || E'\n' || "body"
    WHERE "title" IS NOT NULL
      AND btrim("title") <> ''
      AND split_part("body", E'\n', 1) <> "title"
  `;

  // 3. 移行済みの印としてタイトルを空にする
  const cleared = await prisma.$executeRaw`
    UPDATE "Memo" SET "title" = NULL WHERE "title" IS NOT NULL
  `;

  const total = await prisma.memo.count();
  const pinnedNow = await prisma.memo.count({ where: { pinned: true } });

  console.log("メモの移行が完了しました");
  console.log(`  ピン留めに変換: ${pinned}件`);
  console.log(`  タイトルを本文へ統合: ${merged}件`);
  console.log(`  タイトル列をクリア: ${cleared}件`);
  console.log(`  現在のメモ総数: ${total}件（うちピン留め ${pinnedNow}件）`);
}

main()
  .catch((e) => {
    console.error("移行に失敗しました:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
