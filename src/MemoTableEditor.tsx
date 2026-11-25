import { useId, useState } from "react";
import type { MemoTable } from "./memoTable";
import {
  appendMemoTableColumn, appendMemoTableRow, createMemoTable, deleteMemoTableColumn,
  deleteMemoTableRow, isMemoTableContent, memoTableJson, parseMemoTable,
  renameMemoTableColumn, serializeMemoTable, setMemoTableCell, validateMemoTable,
} from "./memoTable";
import "./memoTableEditor.css";

type Props = { content: string; onChange: (text: string) => void; title: string };

export function MemoTableEditor({ content, onChange, title }: Props) {
  const id = useId();
  const [message, setMessage] = useState("");
  const table = parseMemoTable(content);

  function change(next: MemoTable) {
    setMessage("");
    onChange(serializeMemoTable(next));
  }

  if (!table) {
    if (isMemoTableContent(content)) return <div className="memo-table-intro" role="alert">
      <p>保存された表を読み込めませんでした。本文は変更していません。メモモードで表の記法を確認してください。</p>
    </div>;
    const draft = createMemoTable(content);
    return <div className="memo-table-intro">
      <p>表計算モードで列名、行、セルを自由に編集できます。ここに切り替えただけでは元のメモは変更されません。</p>
      {content && <p>変換すると、本文の各行（空行も含む）が1列の表の {draft.rows.length} 行に取り込まれ、本文は表の記法になります。</p>}
      <button type="button" className="structured-memo-secondary" onClick={() => change(draft)}>
        {content ? "本文を表に変換" : "表を作成"}
      </button>
    </div>;
  }

  const errors = validateMemoTable(table);
  const json = memoTableJson(title, table);
  const currentTable = table;

  async function copyJson() {
    if (json === null) return;
    try {
      await navigator.clipboard.writeText(json);
      setMessage("JSONをコピーしました。");
    } catch {
      setMessage("コピーできませんでした。下のJSONを選択してコピーしてください。");
    }
  }

  function downloadJson() {
    if (json === null) return;
    const url = URL.createObjectURL(new Blob([json], { type: "application/json;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    const filename = title.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 80).trim() || "memo";
    link.download = filename + "-table.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("JSONファイルをダウンロードしました。");
  }

  function removeRow(index: number) {
    if (currentTable.rows[index].some(cell => cell.length > 0) && !window.confirm((index + 1) + "行目を削除しますか？")) return;
    change(deleteMemoTableRow(currentTable, index));
  }

  function removeColumn(index: number) {
    if (currentTable.columns.length === 1) return;
    if (!window.confirm("「" + (currentTable.columns[index] || (index + 1) + "列目") + "」と、その列のすべてのセルを削除しますか？")) return;
    change(deleteMemoTableColumn(currentTable, index));
  }

  return <div className="memo-table-editor">
    <p className="structured-memo-help" id={id + "-help"}>列名とセルを編集し、行や列を増減できます。表の変更は保存前のメモ本文に反映されます。横に表をスクロールできます。</p>
    <div className="memo-table-toolbar">
      <p className="structured-memo-count" role="status">{table.rows.length} 行 / {table.columns.length} 列</p>
      <button type="button" className="structured-memo-secondary" onClick={() => change(appendMemoTableColumn(table))}>＋ 列を追加</button>
      <button type="button" className="structured-memo-secondary" onClick={() => change(appendMemoTableRow(table))}>＋ 行を追加</button>
    </div>
    <div className="memo-table-scroll" role="region" tabIndex={0} aria-label="表計算エリア（横スクロールできます）">
      <table className="memo-table-grid" aria-describedby={id + "-help"} aria-label="メモの表">
        <thead>
          <tr>
            <th scope="col" className="memo-table-index">行</th>
            {table.columns.map((column, columnIndex) => <th scope="col" key={columnIndex}>
              <div className="memo-table-column">
                <input type="text" value={column} aria-label={(columnIndex + 1) + "列目の列名"}
                  placeholder="列名" onChange={event => change(renameMemoTableColumn(table, columnIndex, event.target.value))}
                  onKeyDown={event => { if (event.key === "Enter" && !event.nativeEvent.isComposing) event.preventDefault(); }} />
                <button type="button" className="memo-table-delete" disabled={table.columns.length === 1}
                  aria-label={(columnIndex + 1) + "列目を削除"} onClick={() => removeColumn(columnIndex)}>列削除</button>
              </div>
            </th>)}
            <th scope="col" className="memo-table-row-actions">操作</th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => <tr key={rowIndex}>
            <th scope="row" className="memo-table-index">{rowIndex + 1}</th>
            {row.map((cell, columnIndex) => <td key={columnIndex}>
              <textarea rows={1} value={cell} aria-label={(rowIndex + 1) + "行目、" + (columnIndex + 1) + "列目"}
                onChange={event => change(setMemoTableCell(table, rowIndex, columnIndex, event.target.value))} />
            </td>)}
            <td><button type="button" className="memo-table-delete" aria-label={(rowIndex + 1) + "行目を削除"} onClick={() => removeRow(rowIndex)}>行削除</button></td>
          </tr>)}
          {!table.rows.length && <tr><td colSpan={table.columns.length + 2} className="memo-table-no-rows">行がありません。「行を追加」で入力できます。</td></tr>}
        </tbody>
      </table>
    </div>
    <details className="structured-memo-json" open>
      <summary>表のJSONプレビュー・書き出し</summary>
      <p className="structured-memo-help">列名をキー、セルを文字列の値にした普通のJSONです。Trace Memoの全体バックアップ形式とは別です。</p>
      {errors.length > 0 && <ul className="memo-table-errors" role="alert">{errors.map(error => <li key={error}>{error}</li>)}</ul>}
      <div className="structured-memo-json-actions">
        <button type="button" className="structured-memo-secondary" disabled={json === null} onClick={() => void copyJson()}>コピー</button>
        <button type="button" className="structured-memo-secondary" disabled={json === null} onClick={downloadJson}>ダウンロード</button>
      </div>
      <p className="structured-memo-feedback" role="status">{message}</p>
      <label htmlFor={id + "-json"}>出力するJSON</label>
      <textarea id={id + "-json"} readOnly rows={8} value={json ?? ""} placeholder="重複・空欄の列名を修正するとプレビューできます" className="structured-memo-json-text" />
    </details>
    {/* Per-tool exports can be rendered here with the current table model and title. */}
  </div>;
}

export default MemoTableEditor;
