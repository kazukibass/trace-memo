import { z } from "zod";

export const noteStatusSchema = z.enum(["active", "paused", "done"]);

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(10_000).default(""),
});

export const createNoteSchema = z.object({
  title: z.string().trim().min(1).max(120),
  content: z.string().max(1_000_000).default(""),
  status: noteStatusSchema.default("active"),
});

export const updateNoteSchema = createNoteSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "変更内容がありません",
);

export const createEventSchema = z.object({
  eventType: z.enum([
    "work.started",
    "work.progress",
    "decision.made",
    "work.completed",
    "note.observation",
  ]),
  summary: z.string().trim().min(1).max(240),
  details: z.string().max(100_000).default(""),
});

const uuid7Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const noteEnvelopeSchema = z.object({
  schemaVersion: z.literal("0.1.0"),
  id: z.string().regex(uuid7Pattern),
  type: z.literal("memo.note"),
  origin: z.object({ tool: z.literal("trace-memo"), localId: z.string() }).strict(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  relations: z.array(z.object({
    type: z.enum(["belongs-to", "derived-from", "references", "corresponds-to"]),
    targetId: z.string().min(1),
  }).strict()),
  payload: z.object({
    projectId: z.string().regex(uuid7Pattern),
    title: z.string().min(1).max(120),
    content: z.string(),
    status: noteStatusSchema,
  }).strict(),
}).strict();
