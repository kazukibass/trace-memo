import { Fragment, useEffect, useId, useState } from "react";
import type { MemoRow } from "./structuredMemo";
import { getMemoRows, memoGroupsJson, toggleMemoBoundary, updateMemoItem } from "./structuredMemo";
import "./structuredMemoEditor.css";

type Props = { content: string; onChange: (text: string) => void; title: string };

const exampleText = "だいこん\nにんじん\nじゃがいも\n鉛筆\n消しゴム\nシャンプー\nリンス";

function LineInput({ row, onChange }: { row: MemoRow; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(row.text);
  useEffect(() => { setDraft(row.text); }, [row.text]);

  return <input
    type="text"
    aria-label={`${row.lineNumber}行目の項目`}
    value={draft}
    onChange={event => {
      const value = event.target.value;
      setDraft(value);
      if (value.trim()) onChange(value);
    }}
    onBlur={() => { if (!draft.trim()) setDraft(row.text); }}
    onKeyDown={event => {
      if (event.key === "Enter" && !event.nativeEvent.isComposing) {
        event.preventDefault();
        event.currentTarget.blur();
      }
    }}
  />;
}

export function StructuredMemoEditor({ content, onChange, title }: Props) {
  const [mode, setMode] = useState<"memo" | "groups">("memo");
  const [message, setMessage] = useState("");
  const id = useId();
  const rows = getMemoRows(content);
  const groupCount = rows[rows.length - 1]?.groupNumber ?? 0;
  const json = memoGroupsJson(title, content);

  function change(text: string) {
    setMessage("");
    onChange(text);
  }

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(json);
      setMessage("JSONをコピーしました。");
    } catch {
      setMessage("コピーできませんでした。下のJSONを選択してコピーしてください。");
    }
  }

  function downloadJson() {
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const filename = title.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 80).trim() || "memo";
    link.download = `${filename}-groups.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("JSONファイルをダウンロードしました。");
  }

  return <section className="structured-memo" aria-labelledby={`${id}-label`}>
    <div className="structured-memo-heading">
      <span id={`${id}-label`}>本文</span>
      <div className="structured-memo-modes" role="group" aria-label="本文の編集モード">
        <button type="button" aria-pressed={mode === "memo"} onClick={() => setMode("memo")}>メモ</button>
        <button type="button" aria-pressed={mode === "groups"} onClick={() => setMode("groups")}>構造化</button>
      </div>
    </div>

    {mode === "memo" ? <>
      <textarea aria-labelledby={`${id}-label`} aria-describedby={`${id}-help`} rows={10} value={content} onChange={event => change(event.target.value)} />
      <p className="structured-memo-help" id={`${id}-help`}>1行が1項目、空行がグループの区切りになります。自由な文章のままでも保存できます。</p>
      {!content.length && <button type="button" className="structured-memo-secondary" onClick={() => change(exampleText)}>サンプル入力</button>}
    </> : <>
      <p className="structured-memo-help" id={`${id}-help`}>空行以外の各行を項目にします。区切りの追加・解除で本文に空行を反映します。項目の追加や削除はメモモードで編集できます。</p>
      <p className="structured-memo-count" role="status">{rows.length} 項目 / {groupCount} グループ</p>
      {!rows.length ? <div className="structured-memo-empty">
        <p>まだ項目がありません。メモに1行ずつ入力してみましょう。</p>
        {!content.length && <button type="button" className="structured-memo-secondary" onClick={() => change(exampleText)}>サンプル入力</button>}
        <button type="button" className="structured-memo-secondary" onClick={() => setMode("memo")}>メモを入力</button>
      </div> : <table className="structured-memo-table" aria-label="構造化メモの項目" aria-describedby={`${id}-help`}>
        <colgroup><col className="structured-memo-number-col" /><col className="structured-memo-group-col" /><col /></colgroup>
        <thead><tr><th scope="col">行</th><th scope="col">グループ</th><th scope="col">項目</th></tr></thead>
        <tbody>{rows.map((row, index) => {
          const previous = rows[index - 1];
          const boundaryText = row.boundaryBefore ? "区切りを解除" : "ここで区切る";
          return <Fragment key={index}>
            {previous && <tr className={row.boundaryBefore ? "structured-memo-gap is-boundary" : "structured-memo-gap"}>
              <td colSpan={3}><button type="button"
                aria-label={`${previous.lineNumber}行目と${row.lineNumber}行目の間：${boundaryText}`}
                onClick={() => change(toggleMemoBoundary(content, previous.lineIndex, row.lineIndex))}>
                {row.boundaryBefore ? "−" : "＋"} {boundaryText}
              </button></td>
            </tr>}
            <tr><td className="structured-memo-row-number">{row.lineNumber}</td><td><span className="structured-memo-group-number" aria-label={`グループ ${row.groupNumber}`}>{row.groupNumber}</span></td><td><LineInput row={row} onChange={value => change(updateMemoItem(content, row.lineIndex, value))} /></td></tr>
          </Fragment>;
        })}</tbody>
      </table>}

      <details className="structured-memo-json">
        <summary>JSONプレビュー・書き出し</summary>
        <p className="structured-memo-help">項目と区切りだけのJSONです。Trace Memo全体のバックアップ形式ではありません。</p>
        <div className="structured-memo-json-actions">
          <button type="button" className="structured-memo-secondary" onClick={() => void copyJson()}>コピー</button>
          <button type="button" className="structured-memo-secondary" onClick={downloadJson}>ダウンロード</button>
        </div>
        <p className="structured-memo-feedback" role="status">{message}</p>
        <label htmlFor={`${id}-json`}>出力するJSON</label>
        <textarea id={`${id}-json`} rows={8} readOnly value={json} className="structured-memo-json-text" />
      </details>
    </>}
  </section>;
}

export default StructuredMemoEditor;
