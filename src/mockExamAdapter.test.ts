import { describe, expect, it } from "vitest";
import { parseMemoTable, serializeMemoTable, type MemoTable } from "./memoTable";
import { createMockExamTable, findMockExamColumn, makeMockExamPayload, MOCK_EXAM_FIELDS, type MockExamColumnMapping } from "./mockExamAdapter";

const mapping: MockExamColumnMapping = { question: "問題", choices: "選択肢", answer: "正解番号", code: "コード", explanation: "解説" };
function table(rows: string[][]): MemoTable {
  return { columns: [...createMockExamTable().columns, "補足"], rows: rows.map(row => [...row, "", "", ""].slice(0, 6)) };
}
const validRow = ["首都は？", "東京\n大阪\n京都", "1", "", "東京が首都。", "元メモに残す"];

describe("Mock Exam native question set export", () => {
  it("provides a fresh blank template, with every field matched automatically", () => {
    const first = createMockExamTable();
    const second = createMockExamTable();
    expect(first.rows).toEqual([["", "", "", "", ""]]);
    first.rows[0][0] = "編集";
    expect(second.rows[0][0]).toBe("");
    expect(MOCK_EXAM_FIELDS.map(field => findMockExamColumn(field, second.columns))).toEqual(second.columns);
    expect(findMockExamColumn("question", [" Question "])).toBe(" Question ");
    expect(findMockExamColumn("answer", ["不明"])).toBe("");
  });

  it("exports ordered native questions, one-based answers and optional text, without changing the table", () => {
    const input = table([
      validRow,
      ["実行結果は？", " 1,2 \r\n1,3\rエラー", "２", "if True:\n    print(1,3)", "改行\nを維持", "余分"],
      ["", "", "", "", "", "別用途"],
    ]);
    const before = JSON.stringify(input);
    expect(makeMockExamPayload("地理とコード", input, mapping)).toEqual({ ok: true, data: {
      title: "地理とコード", questions: [
        { question: "首都は？", choices: ["東京", "大阪", "京都"], answer: 1, explanation: "東京が首都。" },
        { question: "実行結果は？", choices: ["1,2", "1,3", "エラー"], answer: 2, code: "if True:\n    print(1,3)", explanation: "改行\nを維持" },
      ],
    } });
    expect(JSON.stringify(input)).toBe(before);
    expect(parseMemoTable(serializeMemoTable(input))).toEqual(input);
  });

  it("maps arbitrary reordered column names and can omit optional columns", () => {
    const input = { columns: ["番号", "メモ", "選択", "問い"], rows: [["2", "原文", "ア\nイ", "問題"]] };
    expect(makeMockExamPayload("  ", input, { question: "問い", choices: "選択", answer: "番号" })).toEqual({
      ok: true, data: { title: "無題の問題集", questions: [{ question: "問題", choices: ["ア", "イ"], answer: 2 }] },
    });
  });

  it.each([
    { ...mapping, question: "" },
    { ...mapping, choices: "不存在" },
    { ...mapping, answer: "問題" },
    { ...mapping, code: "選択肢" },
    { ...mapping, explanation: "コード" },
  ])("rejects missing, unknown or duplicate mapping $question/$choices/$answer/$code/$explanation", invalid => {
    expect(makeMockExamPayload("タイトル", table([validRow]), invalid).ok).toBe(false);
  });

  it.each([
    { columns: ["問題", "問題", "正解番号"], rows: [["a", "b", "1"]] },
    { columns: ["問題", " 問題 ", "正解番号"], rows: [["a", "b", "1"]] },
    { columns: ["問題", "選択肢", " "], rows: [["a", "b", "1"]] },
    { columns: ["問題", "選択肢", "正解番号"], rows: [["a", "b"]] },
  ])("rejects invalid table headers or shape", invalid => {
    expect(makeMockExamPayload("タイトル", invalid, mapping).ok).toBe(false);
  });

  it.each(["", "0", "4", "-1", "1.5", "1.0", "1e0", "１番", "②", "01", "NaN"])("rejects invalid answer %s", answer => {
    expect(makeMockExamPayload("タイトル", table([["問い", "a\nb\nc", answer]]), mapping).ok).toBe(false);
  });

  it.each([
    ["問い", "a", "1"],
    ["問い", "a\nb\nc\nd\ne\nf\ng\nh\ni", "1"],
    ["問い", "a\n\nb", "2"],
    ["問い", "a\nb\n", "1"],
    ["問い", "a\n a ", "1"],
    ["  ", "a\nb", "1"],
    ["問い", "", "1"],
    ["", "", "", "code only"],
  ])("rejects invalid/incomplete row %j without returning partial data", (...row) => {
    const result = makeMockExamPayload("タイトル", table([validRow, row]), mapping);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.every(error => error.startsWith("2行目："))).toBe(true);
  });

  it("rejects a question set with no question rows", () => {
    expect(makeMockExamPayload("タイトル", table([["", "", ""]]), mapping).ok).toBe(false);
    expect(makeMockExamPayload("タイトル", table([]), mapping).ok).toBe(false);
  });

  it("accepts exact length and choice-count boundaries from Mock Exam importer", () => {
    const choices = Array.from({ length: 8 }, (_, i) => String(i) + "a".repeat(199)).join("\n");
    const input = table([["問".repeat(500), choices, "8", "x".repeat(2000), "解".repeat(1000)]]);
    expect(makeMockExamPayload("タイトル", input, mapping).ok).toBe(true);
  });

  it.each([
    ["問".repeat(501), "a\nb", "1", "", ""],
    ["問い", "a".repeat(201) + "\nb", "1", "", ""],
    ["問い", "a\nb", "1", "x".repeat(2001), ""],
    ["問い", "a\nb", "1", "", "解".repeat(1001)],
  ])("rejects fields longer than the native importer limits", (...row) => {
    expect(makeMockExamPayload("タイトル", table([row]), mapping).ok).toBe(false);
  });
});
