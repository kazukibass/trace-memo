import type { ActivityEvent, Note, NoteRevision, NoteStatus, ProjectDetail, ProjectSummary } from "../../shared/types";
import { uuid7 } from "./id";
import { LEGACY_STORAGE_KEYS, migrationReceipt, normalizeLegacyData, sameWorkspace } from "./migration";
import type { MemoRepository } from "./repository";
import { emptyWorkspace, type MigrationReceipt, type WorkspaceData } from "./types";

const DB_NAME = "trace-memo";
const DB_VERSION = 1;
const STORE = "workspace";
const DATA_KEY = "current";
const RECEIPT_KEY = "migration-receipt";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readValue<T>(key: string): Promise<T | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

async function writeValue<T>(key: string, value: T): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(value, key);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  });
}

async function initialize(): Promise<WorkspaceData> {
  const existing = await readValue<WorkspaceData>(DATA_KEY);
  if (existing) return existing;
  for (const key of LEGACY_STORAGE_KEYS) {
    const sourceBackup = localStorage.getItem(key);
    if (!sourceBackup) continue;
    try {
      const migrated = normalizeLegacyData(JSON.parse(sourceBackup));
      if (!migrated) continue;
      await writeValue(DATA_KEY, migrated);
      const verified = await readValue<WorkspaceData>(DATA_KEY);
      if (!verified || !sameWorkspace(migrated, verified)) throw new Error("移行後のデータ検証に失敗しました");
      await writeValue<MigrationReceipt>(RECEIPT_KEY, migrationReceipt(key, sourceBackup, migrated));
      localStorage.removeItem(key);
      return migrated;
    } catch (error) {
      console.warn(`Legacy migration skipped for ${key}`, error);
    }
  }
  const created = emptyWorkspace();
  await writeValue(DATA_KEY, created);
  return created;
}

async function update(mutator: (data: WorkspaceData) => void): Promise<WorkspaceData> {
  const data = structuredClone(await initialize());
  mutator(data);
  await writeValue(DATA_KEY, data);
  return data;
}

const summary = (project: ProjectSummary, data: WorkspaceData): ProjectSummary => ({
  ...project,
  noteCount: data.notes.filter((note) => note.projectId === project.id).length,
  eventCount: data.events.filter((event) => event.projectId === project.id).length,
});

export class IndexedDbMemoRepository implements MemoRepository {
  async projects() { const data = await initialize(); return data.projects.map((project) => summary(project, data)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
  async project(id: string): Promise<ProjectDetail> {
    const data = await initialize();
    const project = data.projects.find((item) => item.id === id);
    if (!project) throw new Error("プロジェクトが見つかりません");
    return { ...summary(project, data), notes: data.notes.filter((note) => note.projectId === id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), events: data.events.filter((event) => event.projectId === id).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)) };
  }
  async createProject(input: { name: string; description: string }) {
    const id = uuid7(); const now = new Date().toISOString();
    await update((data) => { data.projects.push({ id, ...input, createdAt: now, updatedAt: now, noteCount: 0, eventCount: 1 }); data.events.push({ id: uuid7(), projectId: id, noteId: null, eventType: "project.created", summary: `プロジェクト「${input.name}」を作成`, details: "", occurredAt: now }); });
    return { id };
  }
  async createNote(projectId: string, input: { title: string; content: string; status: NoteStatus }) {
    const id = uuid7(); const now = new Date().toISOString();
    await update((data) => { if (!data.projects.some((project) => project.id === projectId)) throw new Error("プロジェクトが見つかりません"); const note: Note = { id, projectId, ...input, createdAt: now, updatedAt: now }; data.notes.push(note); data.revisions.push({ id: uuid7(), noteId: id, revisionNumber: 1, title: input.title, content: input.content, status: input.status, createdAt: now }); data.events.push({ id: uuid7(), projectId, noteId: id, eventType: "note.created", summary: `メモ「${input.title}」を作成`, details: "", occurredAt: now }); });
    return { id };
  }
  async updateNote(noteId: string, input: Partial<Pick<Note, "title" | "content" | "status">>) {
    let result: Note | undefined;
    await update((data) => { const note = data.notes.find((item) => item.id === noteId); if (!note) throw new Error("メモが見つかりません"); const now = new Date().toISOString(); Object.assign(note, input, { updatedAt: now }); const count = data.revisions.filter((revision) => revision.noteId === noteId).length; data.revisions.push({ id: uuid7(), noteId, revisionNumber: count + 1, title: note.title, content: note.content, status: note.status, createdAt: now }); data.events.push({ id: uuid7(), projectId: note.projectId, noteId, eventType: "note.updated", summary: `メモ「${note.title}」を更新`, details: "", occurredAt: now }); result = { ...note }; });
    return result!;
  }
  async deleteNote(noteId: string) {
    await update((data) => { const note = data.notes.find((item) => item.id === noteId); if (!note) return; data.notes = data.notes.filter((item) => item.id !== noteId); data.revisions = data.revisions.filter((item) => item.noteId !== noteId); data.events.forEach((event) => { if (event.noteId === noteId) event.noteId = null; }); data.events.push({ id: uuid7(), projectId: note.projectId, noteId: null, eventType: "note.deleted", summary: `メモ「${note.title}」を削除`, details: "", occurredAt: new Date().toISOString() }); });
  }
  async history(noteId: string): Promise<NoteRevision[]> { const data = await initialize(); return data.revisions.filter((revision) => revision.noteId === noteId).sort((a, b) => b.revisionNumber - a.revisionNumber); }
  async createEvent(projectId: string, input: { eventType: string; summary: string; details: string }) { await update((data) => { const event: ActivityEvent = { id: uuid7(), projectId, noteId: null, ...input, occurredAt: new Date().toISOString() }; data.events.push(event); }); }
  async exportNote(noteId: string) { const data = await initialize(); const note = data.notes.find((item) => item.id === noteId); if (!note) throw new Error("メモが見つかりません"); return new Blob([JSON.stringify({ note, revisions: data.revisions.filter((item) => item.noteId === noteId) }, null, 2)], { type: "application/json" }); }
  async exportAll() { return new Blob([JSON.stringify(await initialize(), null, 2)], { type: "application/json" }); }
}
