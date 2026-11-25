/** Preserve original line terminators, including CRLF and a trailing newline. */
export type MemoLine = { text: string; eol: string };
export type MemoRow = {
  lineIndex: number;
  lineNumber: number;
  groupNumber: number;
  text: string;
  boundaryBefore: boolean;
};

export function splitMemoLines(content: string): MemoLine[] {
  const parts = content.split(/(\r\n|\n|\r)/);
  const lines: MemoLine[] = [];
  for (let index = 0; index < parts.length; index += 2) {
    lines.push({ text: parts[index], eol: parts[index + 1] ?? "" });
  }
  return lines;
}

export function joinMemoLines(lines: readonly MemoLine[]): string {
  return lines.map(({ text, eol }) => text + eol).join("");
}

const isItem = (text: string) => text.trim().length > 0;

export function getMemoRows(content: string): MemoRow[] {
  const rows: MemoRow[] = [];
  let previousLineIndex = -1;
  let groupNumber = 0;
  splitMemoLines(content).forEach(({ text }, lineIndex) => {
    if (!isItem(text)) return;
    const boundaryBefore = previousLineIndex >= 0 && lineIndex > previousLineIndex + 1;
    if (previousLineIndex < 0 || boundaryBefore) groupNumber += 1;
    rows.push({ lineIndex, lineNumber: lineIndex + 1, groupNumber, text, boundaryBefore });
    previousLineIndex = lineIndex;
  });
  return rows;
}

export function getMemoGroups(content: string): string[][] {
  const groups: string[][] = [];
  for (const row of getMemoRows(content)) {
    if (row.groupNumber > groups.length) groups.push([]);
    groups[row.groupNumber - 1].push(row.text);
  }
  return groups;
}

/** Changes only this item; an empty draft is not implicitly deleted or made a separator. */
export function updateMemoItem(content: string, lineIndex: number, text: string): string {
  if (!isItem(text) || /[\r\n]/.test(text)) return content;
  const lines = splitMemoLines(content);
  if (!lines[lineIndex] || !isItem(lines[lineIndex].text)) return content;
  lines[lineIndex] = { ...lines[lineIndex], text };
  return joinMemoLines(lines);
}

/** Toggle a boundary between two successive item rows without altering other lines. */
export function toggleMemoBoundary(content: string, before: number, after: number): string {
  const lines = splitMemoLines(content);
  if (!Number.isInteger(before) || !Number.isInteger(after) || before < 0 || before >= after ||
      !lines[before] || !lines[after] || !isItem(lines[before].text) || !isItem(lines[after].text) ||
      lines.slice(before + 1, after).some(line => isItem(line.text))) return content;

  if (after === before + 1) {
    lines.splice(after, 0, { text: "", eol: lines[before].eol || "\n" });
  } else {
    lines.splice(before + 1, after - before - 1);
  }
  return joinMemoLines(lines);
}

/** This is plain grouped-text JSON, not a Trace Memo backup/envelope. */
export function memoGroupsJson(title: string, content: string): string {
  return JSON.stringify({ title, groups: getMemoGroups(content) }, null, 2);
}
