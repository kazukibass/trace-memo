import { useEffect, useId, useState } from "react";
import type { MemoTable } from "./memoTable";
import {
  findMockExamColumn, makeMockExamPayload, MOCK_EXAM_FIELDS, MOCK_EXAM_FIELD_LABELS,
  type MockExamField,
} from "./mockExamAdapter";
import "./mockExamExport.css";

export default function MockExamExport({ title, table }: { title: string; table: MemoTable }) {
  const id = useId();
  const names = table.columns.filter(name => name.trim() !== "" && table.columns.filter(other => other.trim() === name.trim()).length === 1);
  const [selected, setSelected] = useState<Partial<Record<MockExamField, string>>>({});
  const [message, setMessage] = useState("");
  function column(field: MockExamField): string {
    const selection = selected[field];
    if (selection === undefined) return findMockExamColumn(field, names);
    return names.includes(selection) ? selection : "";
  }
  const mapping = { question: column("question"), choices: column("choices"), answer: column("answer"), code: column("code"), explanation: column("explanation") };
  const result = makeMockExamPayload(title, table, mapping);
  const json = result.ok ? JSON.stringify(result.data, null, 2) : "";
  useEffect(() => { setMessage(""); }, [json]);

  async function copy() {
    if (!result.ok) return;
    try {
      await navigator.clipboard.writeText(json);
      setMessage("Mock Exam用JSONをコピーしました。");
    } catch {
      setMessage("自動コピーできませんでした。JSON欄からコピーしてください。");
    }
  }

  function download() {
    if (!result.ok) return;
    const url = URL.createObjectURL(new Blob([json], { type: "application/json;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    const name = result.data.title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 80).trim() || "mock-exam";
    link.download = name + "-mock-exam.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Mock Exam用JSONをダウンロードしました。");
  }

  return <details className="mock-exam-export">
    <summary>Mock Exam（問題集）へ書き出し</summary>
    <p>表の1行が1問です。問題文・選択肢・正解番号を対応する列から選び、Mock Examの読み込み用JSONに変換します。元メモやその他の列は変えません。</p>
    <div className="mock-exam-export-columns">
      {MOCK_EXAM_FIELDS.map(field => {
        const optional = field === "code" || field === "explanation";
        return <label key={field} htmlFor={id + "-" + field}>{MOCK_EXAM_FIELD_LABELS[field]}列{optional ? "（任意）" : "（必須）"}
          <select id={id + "-" + field} value={mapping[field]} onChange={event => {
            setMessage("");
            setSelected(previous => ({ ...previous, [field]: event.target.value }));
          }}>
            <option value="">{optional ? "使わない" : "列を選ぶ"}</option>
            {names.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>;
      })}
    </div>
    <p>選択肢のセルは、1つの選択肢につき1行（2〜8個、空行なし）で入力します。正解番号は上から1・2・3…の整数です。</p>
    <p>例：選択肢に「東京」「大阪」「京都」を改行して入力し、正解番号に「1」を指定します。入力欄の改行が区切りなので、読点やカンマはそのまま使えます。</p>
    {result.ok ? <>
      <p role="status">{result.data.questions.length}問を出力できます。</p>
      <div className="mock-exam-export-actions">
        <button type="button" onClick={() => void copy()}>コピー</button>
        <button type="button" onClick={download}>ダウンロード</button>
      </div>
      <label htmlFor={id + "-json"}>Mock Exam用JSON<textarea id={id + "-json"} readOnly rows={8} value={json} /></label>
      <p>Mock Examのインポート画面に貼り付けるか、JSONファイルを選択してください。</p>
    </> : <ul className="mock-exam-export-errors" role="status">{result.errors.map((error, index) => <li key={index}>{error}</li>)}</ul>}
    {message && <p role="status">{message}</p>}
  </details>;
}
