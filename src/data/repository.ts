import type { Note, NoteRevision, NoteStatus, ProjectDetail, ProjectSummary } from "../../shared/types";

export interface MemoRepository {
  projects(): Promise<ProjectSummary[]>;
  project(id: string): Promise<ProjectDetail>;
  createProject(input: { name: string; description: string }): Promise<{ id: string }>;
  createNote(projectId: string, input: { title: string; content: string; status: NoteStatus }): Promise<{ id: string }>;
  updateNote(noteId: string, input: Partial<Pick<Note, "title" | "content" | "status">>): Promise<Note>;
  deleteNote(noteId: string): Promise<void>;
  history(noteId: string): Promise<NoteRevision[]>;
  createEvent(projectId: string, input: { eventType: string; summary: string; details: string }): Promise<void>;
  exportNote(noteId: string): Promise<Blob>;
  exportAll(): Promise<Blob>;
}
