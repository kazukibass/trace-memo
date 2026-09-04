export type NoteStatus = "active" | "paused" | "done";

export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  noteCount: number;
  eventCount: number;
}

export interface Note {
  id: string;
  projectId: string;
  title: string;
  content: string;
  status: NoteStatus;
  createdAt: string;
  updatedAt: string;
}

export interface NoteRevision {
  id: string;
  noteId: string;
  revisionNumber: number;
  title: string;
  content: string;
  status: NoteStatus;
  createdAt: string;
}

export interface ActivityEvent {
  id: string;
  projectId: string;
  noteId: string | null;
  eventType: string;
  summary: string;
  details: string;
  occurredAt: string;
}

export interface ProjectDetail extends ProjectSummary {
  notes: Note[];
  events: ActivityEvent[];
}

export interface DataEnvelope<TPayload = Record<string, unknown>> {
  schemaVersion: "0.1.0";
  id: string;
  type: string;
  origin: { tool: string; localId?: string };
  createdAt: string;
  updatedAt: string;
  relations: Array<{
    type: "belongs-to" | "derived-from" | "references" | "corresponds-to";
    targetId: string;
  }>;
  payload: TPayload;
}
