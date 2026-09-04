import { describe, expect, it } from "vitest";
import type { Note } from "../shared/types";
import { noteToEnvelope } from "./envelope";
import { uuid7 } from "./id";

describe("noteToEnvelope", () => {
  it("keeps the common envelope separate from the memo payload", () => {
    const note: Note = {
      id: uuid7(),
      projectId: uuid7(),
      title: "共通外枠を決める",
      content: "ツール固有データはpayloadに残す",
      status: "active",
      createdAt: "2026-09-04T00:00:00.000Z",
      updatedAt: "2026-09-04T01:00:00.000Z",
    };

    const envelope = noteToEnvelope(note, [
      { relation_type: "references", target_id: "mock-exam:question-42" },
    ]);

    expect(envelope).toEqual({
      schemaVersion: "0.1.0",
      id: note.id,
      type: "memo.note",
      origin: { tool: "trace-memo", localId: note.id },
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      relations: [
        { type: "belongs-to", targetId: note.projectId },
        { type: "references", targetId: "mock-exam:question-42" },
      ],
      payload: {
        projectId: note.projectId,
        title: note.title,
        content: note.content,
        status: note.status,
      },
    });
  });
});
