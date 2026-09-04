import { describe, expect, it } from "vitest";
import { uuid7 } from "./id";
import { noteEnvelopeSchema } from "./schema";

describe("noteEnvelopeSchema", () => {
  it("accepts a valid memo note envelope", () => {
    const noteId = uuid7();
    expect(noteEnvelopeSchema.parse({
      schemaVersion: "0.1.0",
      id: noteId,
      type: "memo.note",
      origin: { tool: "trace-memo", localId: noteId },
      createdAt: "2026-09-04T00:00:00.000Z",
      updatedAt: "2026-09-04T00:00:00.000Z",
      relations: [{ type: "belongs-to", targetId: uuid7() }],
      payload: { projectId: uuid7(), title: "判断", content: "外枠を先に作る", status: "active" },
    }).id).toBe(noteId);
  });

  it("rejects unknown envelope properties", () => {
    expect(() => noteEnvelopeSchema.parse({
      schemaVersion: "0.1.0",
      id: uuid7(),
      type: "memo.note",
      origin: { tool: "trace-memo", localId: "1" },
      createdAt: "2026-09-04T00:00:00.000Z",
      updatedAt: "2026-09-04T00:00:00.000Z",
      relations: [],
      payload: { projectId: uuid7(), title: "判断", content: "", status: "active" },
      unexpected: true,
    })).toThrow();
  });
});
