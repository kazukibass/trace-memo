import type { MemoTable } from "./memoTable";
import { validateMemoTable } from "./memoTable";

export type KanpeCue = { at: number; text: string };
export type KanpePayload = { title: string; cues: KanpeCue[] };
export type KanpeExportResult =
  | { ok: true; data: KanpePayload }
  | { ok: false; errors: string[] };

export const KANPE_TIME_COLUMNS = ["時間", "時刻", "開始", "経過", "at", "time", "start", "sec", "seconds", "offset", "開始時刻"];
export const KANPE_TEXT_COLUMNS = ["本文", "内容", "台本", "メモ", "text", "content", "body", "script", "note", "memo"];

export function parseKanpeTime(value: string): number | null {
  const input = value.normalize("NFKC").trim();
  let seconds: number | undefined;
  let match = input.match(/^(\d{1,6}):(\d{1,2}):(\d{1,2})$/);
  if (match) {
    const [, h, m, s] = match;
    if (Number(m) >= 60 || Number(s) >= 60) return null;
    seconds = Number(h) * 3600 + Number(m) * 60 + Number(s);
  } else if ((match = input.match(/^(\d{1,6}):(\d{1,2})$/))) {
    const [, m, s] = match;
    if (Number(s) >= 60) return null;
    seconds = Number(m) * 60 + Number(s);
  } else if ((match = input.match(/^(\d{1,6})\s*分(?:\s*(\d{1,6})\s*秒)?$/))) {
    seconds = Number(match[1]) * 60 + Number(match[2] ?? 0);
  } else if ((match = input.match(/^(\d{1,6})\s*秒$/))) {
    seconds = Number(match[1]);
  } else if ((match = input.match(/^\d{1,6}$/))) {
    // Match Kanpe's existing string importer: plain numbers mean minutes.
    seconds = Number(match[0]) * 60;
  }
  return seconds !== undefined && Number.isSafeInteger(seconds) && seconds >= 0 ? seconds : null;
}

export function makeKanpePayload(
  title: string,
  table: MemoTable,
  timeColumn: string,
  textColumn: string
): KanpeExportResult {
  const tableErrors = validateMemoTable(table);
  if (tableErrors.length) return { ok: false, errors: tableErrors };
  if (!timeColumn || !textColumn || timeColumn === textColumn) {
    return { ok: false, errors: ["時間列と本文列を別々に選びます。"] };
  }
  if (table.columns.filter(column => column === timeColumn).length !== 1 ||
      table.columns.filter(column => column === textColumn).length !== 1) {
    return { ok: false, errors: ["選択した列名が重複しているか、存在しません。列名を確認してください。"] };
  }
  const atIndex = table.columns.indexOf(timeColumn);
  const textIndex = table.columns.indexOf(textColumn);
  const cues: KanpeCue[] = [];
  const errors: string[] = [];
  table.rows.forEach((row, index) => {
    const atValue = row[atIndex] ?? "";
    const text = row[textIndex] ?? "";
    if (!atValue.trim() && !text.trim()) return;
    const at = parseKanpeTime(atValue);
    if (at === null) {
      errors.push(`${index + 1}行目：時間を0:00、1分30秒、90秒などで入力してください。`);
      return;
    }
    if (!text.trim()) {
      errors.push(`${index + 1}行目：本文が空です。`);
      return;
    }
    if (cues.length && at <= cues[cues.length - 1].at) {
      errors.push(`${index + 1}行目：時間を上から重複のない昇順にしてください。`);
      return;
    }
    cues.push({ at, text });
  });
  if (!cues.length && !errors.length) errors.push("時間と本文がある行を1件以上入力してください。");
  return errors.length ? { ok: false, errors } : { ok: true, data: { title: title.trim() || "無題のメモ", cues } };
}
