import type { ActivityEvent, Note, NoteRevision, ProjectSummary } from "../../shared/types";

export const LOCAL_SCHEMA_VERSION = 1 as const;

export interface WorkspaceData {
  schemaVersion: typeof LOCAL_SCHEMA_VERSION;
  projects: ProjectSummary[];
  notes: Note[];
  revisions: NoteRevision[];
  events: ActivityEvent[];
}

export interface MigrationReceipt {
  sourceKey: string;
  migratedAt: string;
  projectCount: number;
  noteCount: number;
  sourceBackup: string;
}

export const emptyWorkspace = (): WorkspaceData => ({
  schemaVersion: LOCAL_SCHEMA_VERSION,
  projects: [],
  notes: [],
  revisions: [],
  events: [],
});
