import { describe, it, expect } from "vitest";
import {
  appendMemoTableColumn, appendMemoTableRow, createMemoTable, deleteMemoTableColumn,
  deleteMemoTableRow, isMemoTableContent, memoTableJson, parseMemoTable, renameMemoTableColumn,
  serializeMemoTable, setMemoTableCell, validateMemoTable,
} from "./memoTable";
import type { MemoTable } from "./memoTable";
import { getMemoGroups, getMemoRows, toggleMemoBoundary } from "./structuredMemo";

describe("editable memo table", () => {
  it("only recognizes a marked table; switching reads without changing ordinary text", () => {
    const text = "  だいこん\r\n\n鉛筆\n";
    expect(parseMemoTable(text)).toBeNull();
    expect(parseMemoTable("|項目|\n|---|\n|だいこん|")).toBeNull();
    expect(createMemoTable(text)).toEqual({ columns: ["項目"], rows: [["  だいこん"], [""], ["鉛筆"], [""]] });
    expect(text).toBe("  だいこん\r\n\n鉛筆\n");
  });

  it("round-trips one column, empty cells, whitespace, pipes, backslashes and multiline cells", () => {
    const model: MemoTable = { columns: ["自由|列\\名"], rows: [[""], ["  値  "], ["\n改行\r\n区切り|\\末"], ["\\"], ["|"], ["\\n"], ["　"]] };
    const content = serializeMemoTable(model);
    expect(isMemoTableContent(content)).toBe(true);
    expect(parseMemoTable(content)).toEqual(model);
    expect(serializeMemoTable(parseMemoTable(content)!)).toBe(content);
    expect(parseMemoTable(content.replace(/\n/g, "\r\n") + "\r\n")).toEqual(model);
  });

  it("supports header-only tables and does not invent empty cells", () => {
    const table = { columns: ["列1", "列2"], rows: [] };
    expect(parseMemoTable(serializeMemoTable(table))).toEqual(table);
    expect(JSON.parse(memoTableJson("空の表", table)!)).toEqual({ title: "空の表", rows: [] });
  });

  it("rejects malformed marked formats without silently repairing", () => {
    const marker = "<!-- trace-memo-table:v1 -->";
    expect(parseMemoTable(marker + "\n|a|b|\n|---|---|\n|only one|")).toBeNull();
    expect(parseMemoTable(marker + "\n|a|\n|--|\n|b|")).toBeNull();
    expect(parseMemoTable(marker + "\n|a|\n|---|\n|bad\\q|")).toBeNull();
    expect(parseMemoTable(marker + "\n|a|\n|---|\n|bad\\|")).toBeNull();
  });

  it("disables JSON on empty or duplicated headers but keeps invalid drafts editable", () => {
    const table = { columns: ["", "名前", " 名前 "], rows: [["a", "b", "c"]] };
    expect(validateMemoTable(table)).toHaveLength(2);
    expect(memoTableJson("タイトル", table)).toBeNull();
    expect(parseMemoTable(serializeMemoTable(table))).toEqual(table);
    expect(validateMemoTable({ columns: ["一列"], rows: [["a", "b"]] })).toHaveLength(1);
  });

  it("exports exactly named string keys and empty/multiline values, including __proto__", () => {
    const table = { columns: ["__proto__", "タイトル", " 空白 "], rows: [["", "001", "改行\nあり"]] };
    const result = JSON.parse(memoTableJson("表", table)!);
    expect(result.title).toBe("表");
    expect(Object.keys(result.rows[0])).toEqual(["__proto__", "タイトル", " 空白 "]);
    expect(result.rows[0]["__proto__"]).toBe("");
    expect(result.rows[0]["タイトル"]).toBe("001");
    expect(result.rows[0][" 空白 "]).toBe("改行\nあり");
  });

  it("adds/deletes rows or columns and edits only the chosen cell or name", () => {
    const original: MemoTable = { columns: ["項目"], rows: [["だいこん"]] };
    const added = appendMemoTableRow(appendMemoTableColumn(original));
    expect(added).toEqual({ columns: ["項目", "列2"], rows: [["だいこん", ""], ["", ""]] });
    const edited = setMemoTableCell(renameMemoTableColumn(added, 1, "金額"), 0, 1, "100");
    expect(edited).toEqual({ columns: ["項目", "金額"], rows: [["だいこん", "100"], ["", ""]] });
    expect(deleteMemoTableRow(edited, 1)).toEqual({ columns: ["項目", "金額"], rows: [["だいこん", "100"]] });
    expect(deleteMemoTableColumn(edited, 0)).toEqual({ columns: ["金額"], rows: [["100"], [""]] });
    expect(deleteMemoTableColumn(original, 0)).toBe(original);
    expect(original).toEqual({ columns: ["項目"], rows: [["だいこん"]] });
  });

  it("chooses a free column name even when the next default name is already used", () => {
    const table = { columns: ["列2"], rows: [[""]] };
    expect(appendMemoTableColumn(table).columns).toEqual(["列2", "列3"]);
  });

  it("keeps the original seven-item group workflow intact", () => {
    const sample = "だいこん\nにんじん\nじゃがいも\n鉛筆\n消しゴム\nシャンプー\nリンス";
    expect(createMemoTable(sample).rows).toHaveLength(7);
    expect(getMemoGroups(sample)).toHaveLength(1);
    const first = toggleMemoBoundary(sample, 2, 3);
    const rows = getMemoRows(first);
    const grouped = toggleMemoBoundary(first, rows[4].lineIndex, rows[5].lineIndex);
    expect(getMemoGroups(grouped)).toEqual([["だいこん", "にんじん", "じゃがいも"], ["鉛筆", "消しゴム"], ["シャンプー", "リンス"]]);
  });
});
