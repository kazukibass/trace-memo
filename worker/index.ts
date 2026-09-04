import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import type { ActivityEvent, Note, NoteRevision, ProjectDetail, ProjectSummary } from "../shared/types";
import { noteToEnvelope } from "./envelope";
import { uuid7 } from "./id";
import {
  createEventSchema,
  createNoteSchema,
  createProjectSchema,
  updateNoteSchema,
} from "./schema";

type Bindings = { DB: D1Database };
const app = new Hono<{ Bindings: Bindings }>();

interface ProjectRow {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  note_count: number;
  event_count: number;
}

interface NoteRow {
  id: string;
  project_id: string;
  title: string;
  content: string;
  status: "active" | "paused" | "done";
  created_at: string;
  updated_at: string;
}

interface EventRow {
  id: string;
  project_id: string;
  note_id: string | null;
  event_type: string;
  summary: string;
  details: string;
  occurred_at: string;
}

interface RevisionRow {
  id: string;
  note_id: string;
  revision_number: number;
  title: string;
  content: string;
  status: "active" | "paused" | "done";
  created_at: string;
}

const projectFromRow = (row: ProjectRow): ProjectSummary => ({
  id: row.id,
  name: row.name,
  description: row.description,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  noteCount: Number(row.note_count),
  eventCount: Number(row.event_count),
});

const noteFromRow = (row: NoteRow): Note => ({
  id: row.id,
  projectId: row.project_id,
  title: row.title,
  content: row.content,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const eventFromRow = (row: EventRow): ActivityEvent => ({
  id: row.id,
  projectId: row.project_id,
  noteId: row.note_id,
  eventType: row.event_type,
  summary: row.summary,
  details: row.details,
  occurredAt: row.occurred_at,
});

const revisionFromRow = (row: RevisionRow): NoteRevision => ({
  id: row.id,
  noteId: row.note_id,
  revisionNumber: row.revision_number,
  title: row.title,
  content: row.content,
  status: row.status,
  createdAt: row.created_at,
});

app.get("/api/health", (context) => context.json({ ok: true }));

app.get("/api/projects", async (context) => {
  const result = await context.env.DB.prepare(`
    SELECT p.*,
      COUNT(DISTINCT n.id) AS note_count,
      COUNT(DISTINCT e.id) AS event_count
    FROM projects p
    LEFT JOIN notes n ON n.project_id = p.id
    LEFT JOIN activity_events e ON e.project_id = p.id
    GROUP BY p.id
    ORDER BY p.updated_at DESC
  `).all<ProjectRow>();
  return context.json(result.results.map(projectFromRow));
});

app.post("/api/projects", zValidator("json", createProjectSchema), async (context) => {
  const input = context.req.valid("json");
  const id = uuid7();
  const eventId = uuid7();
  const now = new Date().toISOString();
  await context.env.DB.batch([
    context.env.DB.prepare(
      "INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).bind(id, input.name, input.description, now, now),
    context.env.DB.prepare(`
      INSERT INTO activity_events (id, project_id, note_id, event_type, summary, details, occurred_at)
      VALUES (?, ?, NULL, 'project.created', ?, '', ?)
    `).bind(eventId, id, `プロジェクト「${input.name}」を作成`, now),
  ]);
  return context.json({ id }, 201);
});

app.get("/api/projects/:id", async (context) => {
  const id = context.req.param("id");
  const project = await context.env.DB.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM notes WHERE project_id = p.id) AS note_count,
      (SELECT COUNT(*) FROM activity_events WHERE project_id = p.id) AS event_count
    FROM projects p WHERE p.id = ?
  `).bind(id).first<ProjectRow>();
  if (!project) return context.json({ error: "プロジェクトが見つかりません" }, 404);

  const [notes, events] = await context.env.DB.batch([
    context.env.DB.prepare("SELECT * FROM notes WHERE project_id = ? ORDER BY updated_at DESC").bind(id),
    context.env.DB.prepare("SELECT * FROM activity_events WHERE project_id = ? ORDER BY occurred_at DESC").bind(id),
  ]);
  const detail: ProjectDetail = {
    ...projectFromRow(project),
    notes: (notes.results as unknown as NoteRow[]).map(noteFromRow),
    events: (events.results as unknown as EventRow[]).map(eventFromRow),
  };
  return context.json(detail);
});

app.post("/api/projects/:id/notes", zValidator("json", createNoteSchema), async (context) => {
  const projectId = context.req.param("id");
  const project = await context.env.DB.prepare("SELECT id FROM projects WHERE id = ?").bind(projectId).first();
  if (!project) return context.json({ error: "プロジェクトが見つかりません" }, 404);

  const input = context.req.valid("json");
  const noteId = uuid7();
  const revisionId = uuid7();
  const eventId = uuid7();
  const now = new Date().toISOString();
  await context.env.DB.batch([
    context.env.DB.prepare(`
      INSERT INTO notes (id, project_id, title, content, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(noteId, projectId, input.title, input.content, input.status, now, now),
    context.env.DB.prepare(`
      INSERT INTO note_revisions (id, note_id, revision_number, title, content, status, created_at)
      VALUES (?, ?, 1, ?, ?, ?, ?)
    `).bind(revisionId, noteId, input.title, input.content, input.status, now),
    context.env.DB.prepare(`
      INSERT INTO activity_events (id, project_id, note_id, event_type, summary, details, occurred_at)
      VALUES (?, ?, ?, 'note.created', ?, '', ?)
    `).bind(eventId, projectId, noteId, `メモ「${input.title}」を作成`, now),
    context.env.DB.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").bind(now, projectId),
  ]);
  return context.json({ id: noteId }, 201);
});

app.patch("/api/notes/:id", zValidator("json", updateNoteSchema), async (context) => {
  const id = context.req.param("id");
  const currentRow = await context.env.DB.prepare("SELECT * FROM notes WHERE id = ?").bind(id).first<NoteRow>();
  if (!currentRow) return context.json({ error: "メモが見つかりません" }, 404);

  const current = noteFromRow(currentRow);
  const input = context.req.valid("json");
  const next = { ...current, ...input };
  if (next.title === current.title && next.content === current.content && next.status === current.status) {
    return context.json(current);
  }

  const latest = await context.env.DB.prepare(
    "SELECT COALESCE(MAX(revision_number), 0) AS revision_number FROM note_revisions WHERE note_id = ?",
  ).bind(id).first<{ revision_number: number }>();
  const now = new Date().toISOString();
  await context.env.DB.batch([
    context.env.DB.prepare(
      "UPDATE notes SET title = ?, content = ?, status = ?, updated_at = ? WHERE id = ?",
    ).bind(next.title, next.content, next.status, now, id),
    context.env.DB.prepare(`
      INSERT INTO note_revisions (id, note_id, revision_number, title, content, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(uuid7(), id, Number(latest?.revision_number ?? 0) + 1, next.title, next.content, next.status, now),
    context.env.DB.prepare(`
      INSERT INTO activity_events (id, project_id, note_id, event_type, summary, details, occurred_at)
      VALUES (?, ?, ?, 'note.updated', ?, '', ?)
    `).bind(uuid7(), current.projectId, id, `メモ「${next.title}」を更新`, now),
    context.env.DB.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").bind(now, current.projectId),
  ]);
  return context.json({ ...next, updatedAt: now });
});

app.delete("/api/notes/:id", async (context) => {
  const id = context.req.param("id");
  const noteRow = await context.env.DB.prepare("SELECT * FROM notes WHERE id = ?").bind(id).first<NoteRow>();
  if (!noteRow) return context.json({ error: "メモが見つかりません" }, 404);
  const note = noteFromRow(noteRow);
  const now = new Date().toISOString();
  await context.env.DB.batch([
    context.env.DB.prepare("UPDATE activity_events SET note_id = NULL WHERE note_id = ?").bind(id),
    context.env.DB.prepare("DELETE FROM notes WHERE id = ?").bind(id),
    context.env.DB.prepare(`
      INSERT INTO activity_events (id, project_id, note_id, event_type, summary, details, occurred_at)
      VALUES (?, ?, NULL, 'note.deleted', ?, '', ?)
    `).bind(uuid7(), note.projectId, `メモ「${note.title}」を削除`, now),
    context.env.DB.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").bind(now, note.projectId),
  ]);
  return context.body(null, 204);
});

app.get("/api/notes/:id/history", async (context) => {
  const result = await context.env.DB.prepare(
    "SELECT * FROM note_revisions WHERE note_id = ? ORDER BY revision_number DESC",
  ).bind(context.req.param("id")).all<RevisionRow>();
  return context.json(result.results.map(revisionFromRow));
});

app.post("/api/projects/:id/events", zValidator("json", createEventSchema), async (context) => {
  const projectId = context.req.param("id");
  const project = await context.env.DB.prepare("SELECT id FROM projects WHERE id = ?").bind(projectId).first();
  if (!project) return context.json({ error: "プロジェクトが見つかりません" }, 404);
  const input = context.req.valid("json");
  const now = new Date().toISOString();
  await context.env.DB.batch([
    context.env.DB.prepare(`
      INSERT INTO activity_events (id, project_id, note_id, event_type, summary, details, occurred_at)
      VALUES (?, ?, NULL, ?, ?, ?, ?)
    `).bind(uuid7(), projectId, input.eventType, input.summary, input.details, now),
    context.env.DB.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").bind(now, projectId),
  ]);
  return context.json({ ok: true }, 201);
});

app.get("/api/notes/:id/export", async (context) => {
  const id = context.req.param("id");
  const noteRow = await context.env.DB.prepare("SELECT * FROM notes WHERE id = ?").bind(id).first<NoteRow>();
  if (!noteRow) return context.json({ error: "メモが見つかりません" }, 404);
  const note = noteFromRow(noteRow);
  const relationResult = await context.env.DB.prepare(
    "SELECT relation_type, target_id FROM entity_relations WHERE source_id = ? ORDER BY created_at",
  ).bind(id).all<{ relation_type: "belongs-to" | "derived-from" | "references" | "corresponds-to"; target_id: string }>();

  const envelope = noteToEnvelope(note, relationResult.results);
  context.header("Content-Disposition", `attachment; filename="${note.id}.json"`);
  return context.json(envelope);
});

app.onError((error, context) => {
  console.error(JSON.stringify({ message: "request failed", error: error.message, path: context.req.path }));
  return context.json({ error: "処理に失敗しました" }, 500);
});

export default app;
