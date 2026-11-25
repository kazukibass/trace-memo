import { describe, expect, it } from "vitest";
import { getMemoGroups, getMemoRows, joinMemoLines, memoGroupsJson, splitMemoLines, toggleMemoBoundary, updateMemoItem } from "./structuredMemo";

describe("structured memo text", () => {
  it.each(["", "\n", "\n\n", "\r\n a  \r\n\t\r\nb\n\r", "first\nsecond", "  ", "first\rsecond\r"])("round-trips %j without normalization", (text) => {
    expect(joinMemoLines(splitMemoLines(text))).toBe(text);
  });

  it("only creates groups for nonblank items and preserves spaces in each item", () => {
    const text = "\n  first  \r\nsecond\n\n \t \nthird\r\nfourth\n\n";
    expect(getMemoGroups(text)).toEqual([["  first  ", "second"], ["third", "fourth"]]);
    expect(getMemoRows(text).map(row => [row.lineNumber, row.groupNumber, row.boundaryBefore])).toEqual([
      [2, 1, false], [3, 1, false], [6, 2, true], [7, 2, false],
    ]);
    expect(getMemoGroups("\n\t\r\n")).toEqual([]);
  });

  it("adds and removes only the requested separator using its existing line ending", () => {
    const text = "\r\n a  \r\nb\r\n\r\nc\r\n\r\n";
    const split = toggleMemoBoundary(text, 1, 2);
    expect(split).toBe("\r\n a  \r\n\r\nb\r\n\r\nc\r\n\r\n");
    expect(getMemoGroups(split)).toEqual([[" a  "], ["b"], ["c"]]);
    expect(toggleMemoBoundary(split, 1, 3)).toBe(text);
  });

  it("merges a boundary with multiple blank lines but leaves other whitespace untouched", () => {
    const text = "\nA\n  \r\n\t\nB\n\nC\n";
    expect(toggleMemoBoundary(text, 1, 4)).toBe("\nA\nB\n\nC\n");
    expect(toggleMemoBoundary(text, 1, 6)).toBe(text); // not successive item rows
    expect(toggleMemoBoundary(text, -1, 1)).toBe(text);
  });

  it("groups the seven-item sample by selecting the third and fifth item gaps", () => {
    const source = "だいこん\nにんじん\nじゃがいも\n鉛筆\n消しゴム\nシャンプー\nリンス";
    expect(getMemoGroups(source)).toHaveLength(1);
    const first = toggleMemoBoundary(source, 2, 3);
    const rows = getMemoRows(first);
    const second = toggleMemoBoundary(first, rows[4].lineIndex, rows[5].lineIndex);
    expect(getMemoGroups(second)).toEqual([["だいこん", "にんじん", "じゃがいも"], ["鉛筆", "消しゴム"], ["シャンプー", "リンス"]]);
    const grouped = getMemoRows(second);
    const merged = toggleMemoBoundary(second, grouped[2].lineIndex, grouped[3].lineIndex);
    expect(getMemoGroups(merged)).toEqual([["だいこん", "にんじん", "じゃがいも", "鉛筆", "消しゴム"], ["シャンプー", "リンス"]]);
  });

  it("updates a single item while protecting blank/invalid drafts", () => {
    const text = "\r\nkeep  \r\n\r\nold\n\t\n";
    expect(updateMemoItem(text, 3, " new ")).toBe("\r\nkeep  \r\n\r\n new \n\t\n");
    expect(updateMemoItem(text, 3, "")).toBe(text);
    expect(updateMemoItem(text, 3, " \t ")).toBe(text);
    expect(updateMemoItem(text, 3, "new\nother")).toBe(text);
    expect(updateMemoItem(text, 2, "new")).toBe(text);
  });

  it("produces an ordinary JSON object and escapes quotes and backslashes", () => {
    const result = JSON.parse(memoGroupsJson('title " \\', 'a\n"b"\n\n<c>'));
    expect(result).toEqual({ title: 'title " \\', groups: [["a", '"b"'], ["<c>"]] });
  });
});
