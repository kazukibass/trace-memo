import type { DataEnvelope, Note } from "../shared/types";
import { noteEnvelopeSchema } from "./schema";

export interface MemoNotePayload {
  projectId: string;
  title: string;
  content: string;
  status: Note["status"];
}

interface RelationRow {
  relation_type: "belongs-to" | "derived-from" | "references" | "corresponds-to";
  target_id: string;
}

export function noteToEnvelope(
  note: Note,
  relations: RelationRow[] = [],
): DataEnvelope<MemoNotePayload> {
  return noteEnvelopeSchema.parse({
    schemaVersion: "0.1.0",
    id: note.id,
    type: "memo.note",
    origin: { tool: "trace-memo", localId: note.id },
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    relations: [
      { type: "belongs-to", targetId: note.projectId },
      ...relations.map((relation) => ({
        type: relation.relation_type,
        targetId: relation.target_id,
      })),
    ],
    payload: {
      projectId: note.projectId,
      title: note.title,
      content: note.content,
      status: note.status,
    },
  });
}
