import { describe, expect, it } from "vitest";
import { normalizeLegacyData, sameWorkspace } from "./migration";

describe("legacy migration", () => {
  it("converts legacy notes without modifying the source", () => {
    const source = { name: "旧メモ", notes: [{ id: 3, title: "判断", body: "静的版から始める", status: "done" }] };
    const before = JSON.stringify(source);
    const migrated = normalizeLegacyData(source, "2026-09-12T00:00:00.000Z");
    expect(JSON.stringify(source)).toBe(before);
    expect(migrated?.projects[0].name).toBe("旧メモ");
    expect(migrated?.notes[0]).toMatchObject({ title: "判断", content: "静的版から始める", status: "done" });
    expect(migrated?.revisions[0].revisionNumber).toBe(1);
  });

  it("compares the persisted copy before cleanup", () => {
    const migrated = normalizeLegacyData({ notes: [] });
    expect(migrated && sameWorkspace(migrated, structuredClone(migrated))).toBe(true);
  });
});
