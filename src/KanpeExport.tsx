import { useEffect, useState, useId } from "react";
import type { MemoTable } from "./memoTable";
import { KANPE_TEXT_COLUMNS, KANPE_TIME_COLUMNS, makeKanpePayload } from "./kanpeAdapter";
import "./kanpeExport.css";

export default function KanpeExport({ title, table }: { title: string; table: MemoTable }) {
  const id = useId();
  const names = table.columns.filter((name) => name.trim() !== "" && table.columns.filter(other => other === name).length === 1);
  const [timeChoice, setTimeChoice] = useState("");
  const [textChoice, setTextChoice] = useState("");
  const [message, setMessage] = useState("");
  const timeColumn = names.includes(timeChoice) ? timeChoice : names.find(name => KANPE_TIME_COLUMNS.includes(name)) ?? "";
  const textColumn = names.includes(textChoice) ? textChoice : names.find(name => KANPE_TEXT_COLUMNS.includes(name)) ?? "";
  const result = makeKanpePayload(title, table, timeColumn, textColumn);
  const json = result.ok ? JSON.stringify(result.data, null, 2) : "";
  useEffect(() => { setMessage(""); }, [json]);

  async function copy() {
    if (!result.ok) return;
    try {
      await navigator.clipboard.writeText(json);
      setMessage("Kanpe用JSONをコピーしました。");
    } catch {
      setMessage("自動コピーできませんでした。JSON欄からコピーしてください。");
    }
  }
  function download() {
    if (!result.ok) return;
    const url = URL.createObjectURL(new Blob([json], { type: "application/json;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = (result.data.title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0,80) || "kanpe") + "-kanpe.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Kanpe用JSONをダウンロードしました。");
  }
  return <details className="kanpe-export">
    <summary>Kanpe（発表台本）へ書き出し</summary>
    <p>時間列と本文列を選ぶと、Kanpeのホーム画面の「読み込み」で使える台本JSONに変換します。その他の列と元メモは変えません。</p>
    <div className="kanpe-export-columns">
      <label htmlFor={id + "-time"}>時間列（例：0:00、1分30秒）<select id={id + "-time"} value={timeColumn} onChange={event => setTimeChoice(event.target.value)}>
        <option value="">列を選ぶ</option>{names.map(name => <option key={name} value={name}>{name}</option>)}
      </select></label>
      <label htmlFor={id + "-text"}>本文列<select id={id + "-text"} value={textColumn} onChange={event => setTextChoice(event.target.value)}>
        <option value="">列を選ぶ</option>{names.map(name => <option key={name} value={name}>{name}</option>)}
      </select></label>
    </div>
    <p>数字だけの時間は分として扱います。時間は上から重複のない昇順にしてください。</p>
    {result.ok ? <>
      <p role="status">{result.data.cues.length}件の台本項目を出力できます。</p>
      <div className="kanpe-export-actions"><button type="button" onClick={() => void copy()}>コピー</button><button type="button" onClick={download}>ダウンロード</button></div>
      <label htmlFor={id+"-json"}>Kanpe用JSON<textarea id={id+"-json"} rows={8} value={json} readOnly /></label>
    </> : <ul className="kanpe-export-errors">{result.errors.map((error, index) => <li key={index}>{error}</li>)}</ul>}
    {message && <p role="status">{message}</p>}
  </details>;
}
