import { redirect } from "next/navigation";
import { FOLDER_TRASH } from "@/lib/config";

/**
 * 旧URL（/memos/trash）の受け皿
 *
 * ゴミ箱はMacのメモ帳と同じく「フォルダの1つ」として中央の一覧に出す形に変えたため、
 * 独立したページは持たない。以前のリンクやブックマークのために転送だけする。
 */
export default function MemoTrashRedirect() {
  redirect(`/memos?folder=${FOLDER_TRASH}`);
}
