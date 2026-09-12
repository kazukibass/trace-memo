import type { NoteStatus } from "../../shared/types";
import { uuid7 } from "./id";
import { emptyWorkspace, LOCAL_SCHEMA_VERSION, type MigrationReceipt, type WorkspaceData } from "./types";

export const LEGACY_STORAGE_KEYS = ["trace-memo", "traceMemo", "memo-app-data", "my-memo-app"] as const;

const text = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
const status = (value: unknown): NoteStatus => value === "paused" || value === "done" ? value : "active";

export function normalizeLegacyData(raw: unknown, now = new Date().toISOString()): WorkspaceData | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (value.schemaVersion === LOCAL_SCHEMA_VERSION && Array.isArray(value.projects) && Array.isArray(value.notes)) {
    return value as unknown as WorkspaceData;
  }

  const legacyNotes = Array.isArray(value.notes) ? value.notes : Array.isArray(raw) ? raw : null;
  if (!legacyNotes) return null;
  const projectId = uuid7();
  const projectName = text(value.name, "移行したメモ");
  const workspace = emptyWorkspace();
  workspace.projects.push({ id: projectId, name: projectName, description: "旧保存領域から移行", createdAt: now, updatedAt: now, noteCount: legacyNotes.length, eventCount: 1 });
  for (const item of legacyNotes) {
    const source = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const noteId = uuid7();
    const title = text(source.title, "無題のメモ");
    const content = text(source.content, text(source.body));
    const noteStatus = status(source.status);
    workspace.notes.push({ id: noteId, projectId, title, content, status: noteStatus, createdAt: text(source.createdAt, now), updatedAt: text(source.updatedAt, now) });
    workspace.revisions.push({ id: uuid7(), noteId, revisionNumber: 1, title, content, status: noteStatus, createdAt: now });
  }
  workspace.events.push({ id: uuid7(), projectId, noteId: null, eventType: "migration.completed", summary: `${legacyNotes.length}件のメモを移行`, details: "旧IDは元データのバックアップに保持しています。", occurredAt: now });
  return workspace;
}

export function sameWorkspace(left: WorkspaceData, right: WorkspaceData): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function migrationReceipt(sourceKey: string, sourceBackup: string, data: WorkspaceData, migratedAt = new Date().toISOString()): MigrationReceipt {
  return { sourceKey, sourceBackup, migratedAt, projectCount: data.projects.length, noteCount: data.notes.length };
}
