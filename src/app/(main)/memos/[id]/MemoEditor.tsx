"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
// メモは「書いた通りの改行」で見えないと使いものにならない。
// Markdownの既定では1回の改行が無視されて前の行とつながってしまうため、改行をそのまま反映させる。
import remarkBreaks from "remark-breaks";
import {
  Bold,
  Check,
  CheckSquare,
  Heading,
  Image as ImageIcon,
  List,
  ListOrdered,
  Mic,
  Paperclip,
  Quote,
  Square,
} from "lucide-react";
import { MEMO_BODY_MAX_LENGTH } from "@/lib/config";
import { lineEndOffset, listContinuation, toggleTaskAtIndex } from "@/lib/memo";
import { addMemoAttachments, saveMemoBody, type NewAttachment } from "../actions";

/**
 * メモの本文（iPhoneメモ帳方式）
 *
 * 「編集モード / プレビューモード」を切り替える作りをやめ、**普段は整形された状態で表示**し、
 * 文字をタップしたらその行から書き始められるようにしている（iPhoneメモ帳と同じ動き）。
 * - チェックリストは整形表示のままタップで完了にできる（編集に入らない）
 * - 保存ボタンは無い。入力が止まって少し経つと自動保存し、画面を離れるときにも保存する
 * - 1行目がタイトル。表示側で本文から取り出すので、タイトル専用の入力は持たない
 */

/** 入力が止まってから保存するまでの待ち時間（打つたびに保存しないための間） */
const AUTOSAVE_DELAY_MS = 800;

/** アップロード＋登録が済んだ添付（本文への差し込みと文字起こしに使う） */
type UploadedAttachment = {
  id: string;
  name: string;
  mime: string;
  url: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

export function MemoEditor({ memoId, initialBody }: { memoId: string; initialBody: string }) {
  const router = useRouter();
  const [body, setBody] = useState(initialBody);
  /** 空のメモ（新規作成直後）はそのまま書き始められるように編集状態で開く */
  const [editing, setEditing] = useState(initialBody.trim() === "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [busy, setBusy] = useState<"idle" | "recording" | "transcribing" | "uploading">("idle");
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  /** 整形表示の入れ物。チェックボックスが上から何番目かを数えるのに使う */
  const viewRef = useRef<HTMLDivElement | null>(null);
  /**
   * 直前のカーソル位置（選択範囲）。
   * ツールバーのボタンを押すとブラウザが入力欄の選択範囲を 0 に戻してしまうことがあり、
   * そのままだと「2回目以降の操作が必ず1行目に適用される」不具合になる。
   * 入力欄側で位置を控えておき、ボタン処理はこの控えを使う。
   */
  const selectionRef = useRef({ start: 0, end: 0 });
  /** 編集に切り替えた直後に置きたいカーソル位置（タップした行の先頭） */
  const pendingCaretRef = useRef<number | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 最後に保存が完了した本文。これと違うときだけ保存する（無駄な通信を防ぐ） */
  const savedBodyRef = useRef(initialBody);
  /** 保存対象の最新の本文（画面を離れるときの駆け込み保存で使う） */
  const bodyRef = useRef(initialBody);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  /** 実際に保存する（変更が無ければ何もしない） */
  const save = useCallback(async () => {
    const next = bodyRef.current;
    if (next === savedBodyRef.current) return;

    setSaveState("saving");
    const result = await saveMemoBody(memoId, next).catch(() => ({
      ok: false as const,
      error: "通信に失敗しました",
    }));

    if (result.ok) {
      savedBodyRef.current = next;
      setSaveState("saved");
      setError(null);
    } else {
      setSaveState("error");
      setError(result.error ?? "保存できませんでした");
    }
  }, [memoId]);

  /** 本文を更新して自動保存の時計を巻き直す */
  const updateBody = useCallback((next: string) => {
    const clipped = next.slice(0, MEMO_BODY_MAX_LENGTH);
    bodyRef.current = clipped;
    setBody(clipped);
    setSaveState("idle");
  }, []);

  // 入力が止まったら保存
  useEffect(() => {
    if (body === savedBodyRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void save(), AUTOSAVE_DELAY_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [body, save]);

  /*
   * 取りこぼし防止の保存。
   * 自動保存は「入力が止まって0.8秒後」なので、書いた直後に画面を離れると消える恐れがある。
   * - 画面を離れる / タブを隠す ときに即保存する
   * - アンマウント時にも保存する（一覧へ戻る・別メモを開く場合）
   */
  useEffect(() => {
    const flush = () => void save();
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      if (timerRef.current) clearTimeout(timerRef.current);
      flush();
    };
  }, [save]);

  // 画面を離れるときにマイクを解放
  useEffect(() => {
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  // 編集に切り替わったら、タップした行にカーソルを置いて入力を始められるようにする
  useEffect(() => {
    if (!editing) return;
    const el = textareaRef.current;
    if (!el) return;

    const caret = pendingCaretRef.current ?? body.length;
    pendingCaretRef.current = null;
    el.focus();
    el.setSelectionRange(caret, caret);
    selectionRef.current = { start: caret, end: caret };
    // body は初回の値だけ使えばよく、依存に入れると入力ごとにカーソルが飛ぶ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  /** 整形表示から編集へ切り替える（caret=本文の何文字目にカーソルを置くか） */
  function enterEditing(caret: number) {
    pendingCaretRef.current = caret;
    setEditing(true);
  }

  /** 書き終わり（整形表示に戻す） */
  function finishEditing() {
    setEditing(false);
    void save();
  }

  // -------------------------------------------------------------------------
  // 整形表示
  // -------------------------------------------------------------------------

  /**
   * 整形表示のどこかを押したとき。
   * リンクとチェックボックスはそのまま働かせ、それ以外は押した行から編集を始める。
   * 行の特定には、各ブロックに埋めた data-line（元のMarkdownの行番号）を使う。
   */
  function handleViewPointerUp(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target.closest("a, input, button")) return;

    // 押したかたまりの「終わりの行」を使う（先頭だと続きを書きたいのに文頭へ飛ぶ）
    const block = target.closest("[data-line-end]");
    const line = block ? Number(block.getAttribute("data-line-end")) : NaN;
    enterEditing(Number.isFinite(line) ? lineEndOffset(body, line) : body.length);
  }

  /** 整形表示の各ブロックに元の行番号を埋める（タップした行を特定するため） */
  const markdownComponents: Components = {
    p: ({ node, children, ...props }) => (
      <p
        data-line={node?.position?.start.line}
        data-line-end={node?.position?.end.line}
        {...props}
      >
        {children}
      </p>
    ),
    li: ({ node, children, ...props }) => (
      <li
        data-line={node?.position?.start.line}
        data-line-end={node?.position?.end.line}
        {...props}
      >
        {children}
      </li>
    ),
    h1: ({ node, children, ...props }) => (
      <h1
        data-line={node?.position?.start.line}
        data-line-end={node?.position?.end.line}
        {...props}
      >
        {children}
      </h1>
    ),
    h2: ({ node, children, ...props }) => (
      <h2
        data-line={node?.position?.start.line}
        data-line-end={node?.position?.end.line}
        {...props}
      >
        {children}
      </h2>
    ),
    h3: ({ node, children, ...props }) => (
      <h3
        data-line={node?.position?.start.line}
        data-line-end={node?.position?.end.line}
        {...props}
      >
        {children}
      </h3>
    ),
    blockquote: ({ node, children, ...props }) => (
      <blockquote
        data-line={node?.position?.start.line}
        data-line-end={node?.position?.end.line}
        {...props}
      >
        {children}
      </blockquote>
    ),
    // リンクは別タブで開く（本文のURLを踏んでもメモから離れないように）
    a: ({ children, ...props }) => (
      <a {...props} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ),
    /*
     * チェックボックスはタップで本文のMarkdownを書き換える（編集に入らずその場で完了にできる）。
     * remark-gfmは既定で disabled を付けるので、それを外して操作できるようにする。
     * どのチェックリストかは、表示上のチェックボックスの並び順で判定する
     * （描画途中でカウンタを進める方式は再描画で崩れるため使わない）。
     */
    input: ({ checked, type, ...props }) => {
      if (type !== "checkbox") return <input type={type} {...props} />;
      return (
        <input
          type="checkbox"
          checked={Boolean(checked)}
          onChange={(e) => {
            const boxes = Array.from(
              viewRef.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]') ?? [],
            );
            const index = boxes.indexOf(e.currentTarget);
            if (index >= 0) updateBody(toggleTaskAtIndex(body, index));
          }}
          className="mt-0.5 mr-1.5 h-5 w-5 shrink-0 cursor-pointer accent-[color:var(--accent)]"
        />
      );
    },
  };

  // -------------------------------------------------------------------------
  // Markdownツールバー
  // -------------------------------------------------------------------------

  /** 入力欄が持っている位置を控えに反映する（カーソル移動のたびに呼ぶ） */
  function rememberSelection(el: HTMLTextAreaElement) {
    selectionRef.current = { start: el.selectionStart, end: el.selectionEnd };
  }

  /**
   * 操作対象の位置を返す。
   * 入力欄にフォーカスがあるときは今の位置、外れているときは控えた位置を使う。
   */
  function currentSelection(el: HTMLTextAreaElement) {
    if (document.activeElement === el) return { start: el.selectionStart, end: el.selectionEnd };
    const { start, end } = selectionRef.current;
    const max = body.length;
    return { start: Math.min(start, max), end: Math.min(end, max) };
  }

  /** カーソル位置（または選択範囲）に文字を挿入する */
  function insertAtCursor(text: string) {
    const el = textareaRef.current;
    if (!el) {
      updateBody(body + text);
      return;
    }
    const { start, end } = currentSelection(el);
    const next = `${body.slice(0, start)}${text}${body.slice(end)}`;
    updateBody(next);
    // Reactの再描画後にカーソルを挿入した文字の後ろへ置く
    const caret = start + text.length;
    selectionRef.current = { start: caret, end: caret };
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }

  /** 選択範囲を記号で囲む（太字など）。未選択ならその場に記号だけ置く */
  function wrapSelection(marker: string) {
    const el = textareaRef.current;
    if (!el) return;
    const { start, end } = currentSelection(el);
    const selected = body.slice(start, end);
    const next = `${body.slice(0, start)}${marker}${selected}${marker}${body.slice(end)}`;
    updateBody(next);
    // 未選択なら記号の内側、選択済みなら囲んだ範囲の後ろへ
    const caret = selected ? end + marker.length * 2 : start + marker.length;
    selectionRef.current = { start: caret, end: caret };
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }

  /** 選択している行（未選択ならカーソル行）の先頭に接頭辞を付ける／外す */
  function toggleLinePrefix(prefix: string) {
    const el = textareaRef.current;
    if (!el) return;
    const { start, end } = currentSelection(el);

    // 選択範囲を含む行の範囲へ広げる
    const lineStart = body.lastIndexOf("\n", start - 1) + 1;
    const lineEndRaw = body.indexOf("\n", end);
    const lineEnd = lineEndRaw === -1 ? body.length : lineEndRaw;

    const target = body.slice(lineStart, lineEnd);
    // すべての行が既に付いていれば外す（トグル）
    const lines = target.split("\n");
    const allPrefixed = lines.every((l) => l.startsWith(prefix));
    const converted = lines
      .map((l) => (allPrefixed ? l.slice(prefix.length) : `${prefix}${l}`))
      .join("\n");

    const next = `${body.slice(0, lineStart)}${converted}${body.slice(lineEnd)}`;
    updateBody(next);
    const caret = lineStart + converted.length;
    selectionRef.current = { start: caret, end: caret };
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }

  /** Enterで箇条書き・番号・チェックリストを自動継続する */
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;

    const el = e.currentTarget;
    const start = el.selectionStart;
    if (start !== el.selectionEnd) return; // 範囲選択中は通常動作

    const lineStart = body.lastIndexOf("\n", start - 1) + 1;
    const currentLine = body.slice(lineStart, start);
    const continuation = listContinuation(currentLine);
    if (continuation === null) return; // リスト行ではない

    e.preventDefault();
    if (continuation === "") {
      /*
       * 中身が空のリスト項目でEnter → 記号を消してリストを終了する。
       * このとき空行を1つ挟むのが重要。挟まないと、次に書いた行がMarkdownの決まりで
       * 直前のリスト項目の続きとして扱われ、箇条書きの中に飲み込まれてしまう。
       */
      const next = `${body.slice(0, lineStart)}\n${body.slice(start)}`;
      const caret = lineStart + 1;
      updateBody(next);
      selectionRef.current = { start: caret, end: caret };
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(caret, caret);
      });
      return;
    }
    insertAtCursor(`\n${continuation}`);
  }

  // -------------------------------------------------------------------------
  // 録音・添付
  // -------------------------------------------------------------------------

  /** ファイルをBlobへアップロードして、このメモの添付として登録する */
  async function uploadAndAttach(
    data: Blob,
    name: string,
    mime: string,
  ): Promise<UploadedAttachment | null> {
    // "audio/webm;codecs=opus" のようなコーデック付きは許可リストに合わないため素の形式に正規化
    const baseMime = mime.split(";")[0].trim();
    const uploaded = await upload(`memos/${name}`, data, {
      access: "private",
      handleUploadUrl: "/api/uploads",
      contentType: baseMime,
    });
    const attachment: NewAttachment = {
      url: uploaded.url,
      mime: baseMime,
      name,
      bytes: data.size,
    };
    const result = await addMemoAttachments(memoId, [attachment]);
    if (!result.ok || !result.added?.length) {
      setError(result.error ?? "添付の登録に失敗しました");
      return null;
    }
    return { ...result.added[0], url: uploaded.url };
  }

  /** 録音の開始・停止 */
  async function toggleRecording() {
    if (busy === "recording") {
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      return;
    }
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 48_000 });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      recorder.onstop = () => void finishRecording(recorder.mimeType || "audio/webm");
      recorderRef.current = recorder;
      streamRef.current = stream;
      recorder.start(10_000);
      setBusy("recording");
    } catch {
      setError("マイクを使用できません。ブラウザの設定を確認してください。");
    }
  }

  /** 録音停止後: アップロード→文字起こし→本文に挿入 */
  async function finishRecording(mime: string) {
    setBusy("transcribing");
    try {
      const blob = new Blob(chunksRef.current, { type: mime });
      const ext = mime.includes("mp4") ? "m4a" : "webm";
      const attachment = await uploadAndAttach(blob, `voice-memo.${ext}`, mime);
      if (!attachment) return;
      router.refresh(); // 下の添付欄に音声プレーヤーを出す

      const transcribeRes = await fetch("/api/memos/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioUrl: attachment.url, mime }),
      });
      const json = (await transcribeRes.json().catch(() => ({}))) as {
        text?: string;
        error?: string;
      };
      if (transcribeRes.ok && json.text) {
        // 文字起こしは本文の末尾に足す（録音中はカーソル位置が定まらないため）
        const separator = body && !body.endsWith("\n") ? "\n" : "";
        updateBody(`${body}${separator}${json.text}`);
      } else {
        setError(json.error ?? "文字起こしに失敗しました（音声は添付済み）");
      }
    } catch {
      setError(
        "録音の保存に失敗しました。Vercel Blob（BLOB_READ_WRITE_TOKEN）の設定を確認してください。",
      );
    } finally {
      setBusy("idle");
    }
  }

  /**
   * ファイル添付。
   * 画像はカーソル位置に `![名前](中継URL)` を差し込んで本文の途中に表示できるようにする。
   * それ以外（PDF・動画・音声）は本文の下の添付欄に並ぶ。
   */
  async function handleFiles(files: FileList | null, inline: boolean) {
    if (!files?.length) return;
    setError(null);
    setBusy("uploading");
    try {
      for (const file of Array.from(files).slice(0, 5)) {
        const attachment = await uploadAndAttach(
          file,
          file.name,
          file.type || "application/octet-stream",
        );
        if (!attachment) break;
        if (inline && attachment.mime.startsWith("image/")) {
          insertAtCursor(`\n![${attachment.name}](/api/memos/file/${attachment.id})\n`);
        } else {
          router.refresh(); // 下の添付欄に反映する
        }
      }
    } catch {
      setError(
        "添付のアップロードに失敗しました。Vercel Blob（BLOB_READ_WRITE_TOKEN）の設定を確認してください。",
      );
    } finally {
      setBusy("idle");
    }
  }

  // -------------------------------------------------------------------------
  // 表示
  // -------------------------------------------------------------------------

  const toolbarDisabled = busy !== "idle";

  return (
    // Macのメモ帳は本文に枠が無いので、囲みを持たせず紙のように見せる
    <div className="mt-1">
      {/* Macのメモ帳は本文の上に何も置かないので、保存状態は控えめに右端へ */}
      <div className="flex min-h-6 flex-wrap items-center justify-end gap-2">
        <SaveIndicator state={saveState} />
        {editing && (
          <button
            type="button"
            onClick={finishEditing}
            className="btn-primary !min-h-8 !px-4 !py-1 !text-[13px]"
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            完了
          </button>
        )}
      </div>

      {editing ? (
        <>
          {/* Markdownツールバー */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <ToolButton label="見出し" onClick={() => toggleLinePrefix("## ")} disabled={toolbarDisabled}>
              <Heading className="h-3.5 w-3.5" aria-hidden="true" />
            </ToolButton>
            <ToolButton label="太字" onClick={() => wrapSelection("**")} disabled={toolbarDisabled}>
              <Bold className="h-3.5 w-3.5" aria-hidden="true" />
            </ToolButton>
            <ToolButton label="箇条書き" onClick={() => toggleLinePrefix("- ")} disabled={toolbarDisabled}>
              <List className="h-3.5 w-3.5" aria-hidden="true" />
            </ToolButton>
            <ToolButton label="番号付き" onClick={() => toggleLinePrefix("1. ")} disabled={toolbarDisabled}>
              <ListOrdered className="h-3.5 w-3.5" aria-hidden="true" />
            </ToolButton>
            <ToolButton
              label="チェックリスト"
              onClick={() => toggleLinePrefix("- [ ] ")}
              disabled={toolbarDisabled}
            >
              <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />
            </ToolButton>
            <ToolButton label="引用" onClick={() => toggleLinePrefix("> ")} disabled={toolbarDisabled}>
              <Quote className="h-3.5 w-3.5" aria-hidden="true" />
            </ToolButton>
          </div>

          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => {
              updateBody(e.target.value);
              rememberSelection(e.currentTarget);
            }}
            onKeyDown={handleKeyDown}
            // カーソル位置を控える（ツールバーでフォーカスが外れても正しい行に効かせるため）
            onKeyUp={(e) => rememberSelection(e.currentTarget)}
            onClick={(e) => rememberSelection(e.currentTarget)}
            onSelect={(e) => rememberSelection(e.currentTarget)}
            onBlur={() => void save()}
            rows={16}
            maxLength={MEMO_BODY_MAX_LENGTH}
            placeholder="1行目がタイトルになります。そのまま書き始めてください…"
            className="input mt-2 resize-y leading-relaxed"
            aria-label="メモの内容"
          />
          <p className="mt-1 text-right text-xs text-faint">
            {body.length.toLocaleString()} / {MEMO_BODY_MAX_LENGTH.toLocaleString()}字
          </p>
        </>
      ) : (
        <div
          ref={viewRef}
          onClick={handleViewPointerUp}
          // 見た目は文章だが押すと編集に入るので、押せることが分かるようにしておく
          className="report memo-view mt-2 min-h-40 cursor-text"
        >
          {body.trim() ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkBreaks]}
              components={markdownComponents}
            >
              {body}
            </ReactMarkdown>
          ) : (
            <p className="text-sm text-faint">ここを押すと書き始められます。</p>
          )}
        </div>
      )}

      {/* 録音・添付 */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <button
          type="button"
          onClick={toggleRecording}
          disabled={busy === "transcribing" || busy === "uploading"}
          className={busy === "recording" ? "btn-primary !bg-red-600" : "btn-ghost"}
        >
          {busy === "recording" ? (
            <>
              <Square className="h-3.5 w-3.5" aria-hidden="true" />
              停止して文字起こし
            </>
          ) : (
            <>
              <Mic className="h-3.5 w-3.5" aria-hidden="true" />
              録音
            </>
          )}
        </button>

        {/* 画像を本文の途中に差し込む（編集中だけ。位置が決まらないため） */}
        {editing && (
          <label className={`btn-ghost ${toolbarDisabled ? "pointer-events-none opacity-40" : ""}`}>
            <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
            画像を挿入
            <input
              type="file"
              multiple
              accept="image/*"
              className="sr-only"
              disabled={toolbarDisabled}
              onChange={(e) => {
                void handleFiles(e.target.files, true);
                e.target.value = "";
              }}
            />
          </label>
        )}

        {/* その他のファイルは添付欄へ */}
        <label className={`btn-ghost ${toolbarDisabled ? "pointer-events-none opacity-40" : ""}`}>
          <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
          添付
          <input
            type="file"
            multiple
            accept="image/*,video/*,application/pdf,audio/*"
            className="sr-only"
            disabled={toolbarDisabled}
            onChange={(e) => {
              void handleFiles(e.target.files, false);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {busy === "transcribing" && (
        <p className="mt-2 text-sm font-medium text-muted">文字起こし中…（本文の最後に足します）</p>
      )}
      {busy === "uploading" && <p className="mt-2 text-sm font-medium text-muted">アップロード中…</p>}
      {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}

/** ツールバーのボタン（アイコン＋読み上げ用ラベル） */
function ToolButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="btn-ghost !min-h-9 !w-9 !justify-center !px-0"
    >
      {children}
    </button>
  );
}

/**
 * 保存状態の表示（保存ボタンが無いので、ここが唯一の手がかりになる）
 * 何も起きていないときは出さない。常に文字があるとMacのメモ帳の静けさが崩れるため。
 */
function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving") return <span className="text-[11px] text-faint">保存中…</span>;
  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-faint">
        <Check className="h-3 w-3" aria-hidden="true" />
        保存しました
      </span>
    );
  }
  if (state === "error") {
    return <span className="text-[11px] font-bold text-red-600">保存できませんでした</span>;
  }
  return null;
}
