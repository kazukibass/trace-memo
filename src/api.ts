import type { Note, NoteRevision, NoteStatus, ProjectDetail, ProjectSummary } from "../shared/types";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Request failed: ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  projects: () => request<ProjectSummary[]>("/api/projects"),
  project: (id: string) => request<ProjectDetail>(`/api/projects/${id}`),
  createProject: (input: { name: string; description: string }) =>
    request<{ id: string }>("/api/projects", { method: "POST", body: JSON.stringify(input) }),
  createNote: (projectId: string, input: { title: string; content: string; status: NoteStatus }) =>
    request<{ id: string }>(`/api/projects/${projectId}/notes`, { method: "POST", body: JSON.stringify(input) }),
  updateNote: (noteId: string, input: Partial<Pick<Note, "title" | "content" | "status">>) =>
    request<Note>(`/api/notes/${noteId}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteNote: (noteId: string) => request<void>(`/api/notes/${noteId}`, { method: "DELETE" }),
  history: (noteId: string) => request<NoteRevision[]>(`/api/notes/${noteId}/history`),
  createEvent: (projectId: string, input: { eventType: string; summary: string; details: string }) =>
    request<void>(`/api/projects/${projectId}/events`, { method: "POST", body: JSON.stringify(input) }),
};
