import { describe, expect, it } from "vitest";
import { makeKanpePayload, parseKanpeTime } from "./kanpeAdapter";

describe("Kanpe native JSON export", () => {
  const valid: [string, number][] = [["0:00",0],["1:30",90],["1:02:03",3723],["1分30秒",90],["90秒",90],["2",120],["２：３０",150]];
  it.each(valid)("converts %s to seconds", (input, seconds) => {
    expect(parseKanpeTime(input)).toBe(seconds);
  });
  it.each(["", "-1", "abc", "0:60", "1:60:00", "0:00:60", "1.5"])("rejects invalid time %s", input => {
    expect(parseKanpeTime(input)).toBeNull();
  });
  it("exports a native payload without mutating the table or adding a new envelope", () => {
    const table = { columns: ["時間", "本文", "補足"], rows: [["0:00", "01 開始", "skip"], ["1:30", "02 デモ", "skip"], ["3:00", "03 終了", ""], ["", "", ""]] };
    const before = JSON.stringify(table);
    expect(makeKanpePayload("発表", table, "時間", "本文")).toEqual({ ok: true, data: { title: "発表", cues: [{ at:0, text:"01 開始" }, { at:90, text:"02 デモ" }, { at:180, text:"03 終了" }] } });
    expect(JSON.stringify(table)).toBe(before);
  });
  it("fails closed on duplicate or missing selected columns", () => {
    expect(makeKanpePayload("発表", { columns:["時間","時間","本文"],rows:[["0:00","0:30","開始"]] }, "時間", "本文").ok).toBe(false);
    expect(makeKanpePayload("発表", { columns:["時間"],rows:[["0:00"]] }, "時間", "本文").ok).toBe(false);
  });
  const invalidRows = [[["0:00","開始"],["0:00","重複"]],[["1:00","開始"],["0:00","逆順"]],[["bad","開始"]],[["0:00",""]],[["","本文だけ"]],[["",""]]].map(rows => ({ rows }));
  it.each(invalidRows)("rejects invalid/incomplete rows $rows", ({ rows }) => {
    expect(makeKanpePayload("発表", { columns:["時間","本文"], rows }, "時間", "本文").ok).toBe(false);
  });
});
