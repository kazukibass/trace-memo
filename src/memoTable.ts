/** A standalone table draft. Each row has exactly one string for each column. */
export type MemoTable = { columns: string[]; rows: string[][] };

/** Only our marked format is interpreted as a saved memo table. */
export const MEMO_TABLE_MARKER = "<!-- trace-memo-table:v1 -->";

export function isMemoTableContent(content: string): boolean {
  return content.split(/\r\n|\n|\r/, 1)[0] === MEMO_TABLE_MARKER;
}

/** Explicitly converting a plain memo keeps each original line, including blank lines. */
export function createMemoTable(content: string): MemoTable {
  return { columns: ["項目"], rows: content ? content.split(/\r\n|\n|\r/).map(line => [line]) : [[""]] };
}

function escapeCell(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r/g, "\\r").replace(/\n/g, "\\n");
}

function encodeRow(values: string[]): string {
  return "|" + values.map(escapeCell).join("|") + "|";
}

/** Parse without trimming: meaningful spaces, blank cells and escapes round-trip exactly. */
function decodeRow(line: string): string[] | null {
  if (line.length < 2 || line[0] !== "|" || line[line.length - 1] !== "|") return null;
  const fields: string[] = [];
  let cell = "";
  let endedOnDelimiter = false;
  for (let i = 1; i < line.length; i += 1) {
    const char = line[i];
    endedOnDelimiter = false;
    if (char === "\\") {
      const escaped = line[++i];
      if (escaped === "\\" || escaped === "|") cell += escaped;
      else if (escaped === "n") cell += "\n";
      else if (escaped === "r") cell += "\r";
      else return null;
    } else if (char === "|") {
      fields.push(cell);
      cell = "";
      endedOnDelimiter = true;
    } else {
      cell += char;
    }
  }
  return endedOnDelimiter ? fields : null;
}

/** Encode the editable table in the existing note content, without a storage migration. */
export function serializeMemoTable(table: MemoTable): string {
  if (!table.columns.length || table.rows.some(row => row.length !== table.columns.length)) {
    throw new Error("Invalid memo table shape");
  }
  return [
    MEMO_TABLE_MARKER,
    encodeRow(table.columns),
    encodeRow(table.columns.map(() => "---")),
    ...table.rows.map(encodeRow),
  ].join("\n");
}

/** Returns null for ordinary text or malformed marked content instead of repairing it silently. */
export function parseMemoTable(content: string): MemoTable | null {
  if (!isMemoTableContent(content)) return null;
  const lines = content.split(/\r\n|\n|\r/);
  if (lines[lines.length - 1] === "") lines.pop();
  if (lines.length < 3) return null;
  const columns = decodeRow(lines[1]);
  const separator = decodeRow(lines[2]);
  if (!columns?.length || !separator ||
      separator.length !== columns.length || separator.some(cell => cell !== "---")) return null;
  const rows: string[][] = [];
  for (const line of lines.slice(3)) {
    const row = decodeRow(line);
    if (!row || row.length !== columns.length) return null;
    rows.push(row);
  }
  return { columns, rows };
}

/** Blank and duplicated (including surrounding-space variants) headers cannot produce JSON. */
export function validateMemoTable(table: MemoTable): string[] {
  const errors: string[] = [];
  if (!table.columns.length) errors.push("列を1つ以上作成してください。");
  const used = new Set<string>();
  table.columns.forEach((column, index) => {
    const name = column.trim();
    if (!name) {
      errors.push((index + 1) + "列目の列名を入力してください。");
    } else if (used.has(name)) {
      errors.push((index + 1) + "列目の列名が重複しています。");
    } else {
      used.add(name);
    }
  });
  if (table.rows.some(row => row.length !== table.columns.length)) errors.push("列数と一致しない行があります。");
  return errors;
}

/** Derived plain JSON, not a Trace Memo backup or its shared envelope. */
export function memoTableJson(title: string, table: MemoTable): string | null {
  if (validateMemoTable(table).length) return null;
  const rows = table.rows.map(row => Object.fromEntries(table.columns.map((column, index) => [column, row[index]])));
  return JSON.stringify({ title, rows }, null, 2);
}

export function renameMemoTableColumn(table: MemoTable, index: number, name: string): MemoTable {
  if (index < 0 || index >= table.columns.length || !Number.isInteger(index)) return table;
  return { ...table, columns: table.columns.map((column, i) => i === index ? name : column) };
}

export function setMemoTableCell(table: MemoTable, rowIndex: number, columnIndex: number, value: string): MemoTable {
  if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= table.rows.length ||
      !Number.isInteger(columnIndex) || columnIndex < 0 || columnIndex >= table.columns.length) return table;
  return { ...table, rows: table.rows.map((row, i) => i === rowIndex ? row.map((cell, j) => j === columnIndex ? value : cell) : row) };
}

export function appendMemoTableRow(table: MemoTable): MemoTable {
  return { ...table, rows: [...table.rows, table.columns.map(() => "")] };
}

export function deleteMemoTableRow(table: MemoTable, index: number): MemoTable {
  if (!Number.isInteger(index) || index < 0 || index >= table.rows.length) return table;
  return { ...table, rows: table.rows.filter((_, i) => i !== index) };
}

export function appendMemoTableColumn(table: MemoTable): MemoTable {
  const used = new Set(table.columns.map(column => column.trim()));
  let index = table.columns.length + 1;
  while (used.has("列" + index)) index += 1;
  return { columns: [...table.columns, "列" + index], rows: table.rows.map(row => [...row, ""]) };
}

export function deleteMemoTableColumn(table: MemoTable, index: number): MemoTable {
  if (table.columns.length <= 1 || !Number.isInteger(index) || index < 0 || index >= table.columns.length) return table;
  return {
    columns: table.columns.filter((_, i) => i !== index),
    rows: table.rows.map(row => row.filter((_, i) => i !== index)),
  };
}
