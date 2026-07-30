/**
 * メモの表示ロジック（純粋関数のみ）
 *
 * iPhoneメモ帳と同じく「本文の1行目がタイトル」という方式にしたため、
 * タイトル・プレビューの取り出しは毎回同じ結果になる決定論的な処理としてここに置く。
 * 画面側で個別に切り出すと、一覧・詳細・検索で表示がずれるので必ずこれを使う。
 */

import { MEMO_PREVIEW_LENGTH } from "./config";

/** Markdownの装飾記号を落として素の文章にする（一覧のタイトル・プレビュー用） */
function stripMarkdown(line: string): string {
  return line
    .replace(/^#{1,6}\s+/, "") // 見出し
    .replace(/^>\s?/, "") // 引用
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/, "") // チェックリスト
    .replace(/^\s*[-*+]\s+/, "") // 箇条書き
    .replace(/^\s*\d+\.\s+/, "") // 番号付き
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // 画像 → 代替テキスト
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // リンク → ラベル
    .replace(/(\*\*|__)(.*?)\1/g, "$2") // 太字
    .replace(/(\*|_)(.*?)\1/g, "$2") // 斜体
    .replace(/`([^`]*)`/g, "$1") // インラインコード
    .trim();
}

/**
 * メモのタイトル（本文の最初の中身がある行）。
 * 空メモは「新規メモ」と表示する（iPhoneメモ帳の挙動に合わせる）。
 */
export function memoTitle(body: string): string {
  for (const line of body.split("\n")) {
    const text = stripMarkdown(line);
    if (text) return text;
  }
  return "新規メモ";
}

/**
 * 一覧に出すプレビュー（タイトルに使った行より後ろを1行にまとめる）。
 * 中身が無ければ空文字を返す（呼び出し側で「追加のテキストなし」を出す）。
 */
export function memoPreview(body: string): string {
  const lines = body.split("\n");

  // タイトルに使った行を探し、その次の行から拾う
  let titleIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (stripMarkdown(lines[i])) {
      titleIndex = i;
      break;
    }
  }
  if (titleIndex === -1) return "";

  const rest = lines
    .slice(titleIndex + 1)
    .map(stripMarkdown)
    .filter(Boolean)
    .join(" ");

  return rest.length > MEMO_PREVIEW_LENGTH ? `${rest.slice(0, MEMO_PREVIEW_LENGTH)}…` : rest;
}

/** チェックリストの行（GFMのタスクリスト記法）。1つ目の括弧までが接頭辞 */
const TASK_LINE_PATTERN = /^(\s*[-*+]\s+\[)([ xX])(\]\s*)/;

/**
 * 上から index 番目（0始まり）のチェックリストのON/OFFを切り替えた本文を返す。
 *
 * プレビュー表示のチェックボックスをタップしたときに使う。
 * 行番号で指定できないのは、remark-gfmがチェックボックスの `input` を後から作る合成ノードで、
 * 元のMarkdownの位置情報を持たないため。代わりに「表示上の何番目か」で対応させる。
 * Markdownは上から順に描画されるので、画面のチェックボックスの並び順と
 * 本文のチェックリスト行の並び順は必ず一致する。
 */
export function toggleTaskAtIndex(body: string, index: number): string {
  const lines = body.split("\n");
  let seen = -1;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(TASK_LINE_PATTERN);
    if (!match) continue;
    seen++;
    if (seen !== index) continue;

    const checked = match[2].toLowerCase() === "x";
    lines[i] = lines[i].replace(TASK_LINE_PATTERN, `$1${checked ? " " : "x"}$3`);
    return lines.join("\n");
  }
  return body; // 見つからなければ何も変えない
}

/**
 * 指定行（1始まり）の先頭が本文の何文字目かを返す。
 *
 * 整形表示のある行をタップしたとき、編集に切り替えてその行にカーソルを置くために使う。
 * 範囲外の行番号は本文の末尾を返す（タップ位置が取れなくても編集は始められるようにする）。
 */
export function lineStartOffset(body: string, line: number): number {
  const lines = body.split("\n");
  if (line <= 1) return 0;
  if (line > lines.length) return body.length;

  let offset = 0;
  for (let i = 0; i < line - 1; i++) offset += lines[i].length + 1; // +1 は改行ぶん
  return offset;
}

/**
 * 指定行（1始まり）の末尾が本文の何文字目かを返す。
 *
 * 整形表示をタップして編集に入るとき、そのかたまりの終わりにカーソルを置くために使う。
 * 先頭に置くと「続きを書きたいのに文頭へ飛ぶ」ので、末尾のほうが使いやすい。
 */
export function lineEndOffset(body: string, line: number): number {
  const lines = body.split("\n");
  if (line < 1) return 0;
  if (line >= lines.length) return body.length;

  let offset = 0;
  for (let i = 0; i < line; i++) offset += lines[i].length + 1; // +1 は改行ぶん
  return offset - 1; // 改行の手前（＝その行の末尾）
}

/**
 * 箇条書き・番号付き・チェックリストの行から「次の行に引き継ぐ接頭辞」を求める。
 *
 * Enterキーでリストを自動継続するために使う（iPhoneメモ帳と同じ挙動）。
 * - リスト行でなければ null
 * - 中身が空のリスト行（`- ` だけ）は空文字を返す → 呼び出し側でリストを終了させる
 */
export function listContinuation(line: string): string | null {
  // チェックリスト（済みでも次は未チェックで始める）
  const task = line.match(/^(\s*)([-*+])\s+\[[ xX]\]\s+(.*)$/);
  if (task) return task[3].trim() ? `${task[1]}${task[2]} [ ] ` : "";

  // 番号付き（次の番号に進める）
  const ordered = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
  if (ordered) return ordered[3].trim() ? `${ordered[1]}${Number(ordered[2]) + 1}. ` : "";

  // 箇条書き
  const bullet = line.match(/^(\s*)([-*+])\s+(.*)$/);
  if (bullet) return bullet[3].trim() ? `${bullet[1]}${bullet[2]} ` : "";

  return null;
}
