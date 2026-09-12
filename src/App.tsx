import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Note, NoteRevision, NoteStatus, ProjectDetail, ProjectSummary } from "../shared/types";
import { api, downloadBlob } from "./data";

const statusLabel: Record<NoteStatus, string> = { active: "進行中", paused: "保留", done: "完了" };
const eventLabel: Record<string, string> = {
  "project.created": "プロジェクト",
  "note.created": "作成",
  "note.updated": "更新",
  "note.deleted": "削除",
  "work.started": "作業開始",
  "work.progress": "進捗",
  "decision.made": "方針決定",
  "work.completed": "完了",
  "note.observation": "メモ",
};

function App() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [creatingProject, setCreatingProject] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null | "new">(null);
  const [history, setHistory] = useState<{ note: Note; revisions: NoteRevision[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshProjects = useCallback(async () => {
    const result = await api.projects();
    setProjects(result);
    setSelectedId((current) => current ?? result[0]?.id ?? null);
  }, []);

  const refreshDetail = useCallback(async (id: string) => {
    setDetail(await api.project(id));
  }, []);

  useEffect(() => { refreshProjects().catch((value) => setError(String(value))); }, [refreshProjects]);
  useEffect(() => {
    if (selectedId) refreshDetail(selectedId).catch((value) => setError(String(value)));
    else setDetail(null);
  }, [selectedId, refreshDetail]);

  async function reload() {
    await refreshProjects();
    if (selectedId) await refreshDetail(selectedId);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">T</span><div><strong>Trace Memo</strong><small>work in context</small></div></div>
        <button className="new-project" onClick={() => setCreatingProject(true)}>＋ 新しいプロジェクト</button>
        <nav className="project-nav" aria-label="プロジェクト">
          <p>PROJECTS</p>
          {projects.map((project) => (
            <button key={project.id} className={selectedId === project.id ? "active" : ""} onClick={() => setSelectedId(project.id)}>
              <span>{project.name.slice(0, 1)}</span>
              <div><strong>{project.name}</strong><small>{project.noteCount} notes · {project.eventCount} events</small></div>
            </button>
          ))}
        </nav>
        <footer>
          <span className="pulse" /> この端末に保存
          <button className="backup-button" onClick={async () => downloadBlob(await api.exportAll(), `trace-memo-${new Date().toISOString().slice(0, 10)}.json`)}>バックアップ</button>
        </footer>
      </aside>

      <main>
        {error && <div className="error-banner">{error}<button onClick={() => setError(null)}>×</button></div>}
        {!detail ? <EmptyWorkspace onCreate={() => setCreatingProject(true)} /> : (
          <ProjectView
            project={detail}
            onNewNote={() => setEditingNote("new")}
            onEditNote={setEditingNote}
            onHistory={async (note) => setHistory({ note, revisions: await api.history(note.id) })}
            onDelete={async (note) => {
              if (!confirm(`「${note.title}」を削除しますか？`)) return;
              await api.deleteNote(note.id); await reload();
            }}
            onEvent={async (input) => { await api.createEvent(detail.id, input); await reload(); }}
          />
        )}
      </main>

      {creatingProject && <ProjectDialog onClose={() => setCreatingProject(false)} onSave={async (input) => {
        const created = await api.createProject(input); setCreatingProject(false); await refreshProjects(); setSelectedId(created.id);
      }} />}
      {detail && editingNote && <NoteDialog note={editingNote === "new" ? null : editingNote} onClose={() => setEditingNote(null)} onSave={async (input) => {
        if (editingNote === "new") await api.createNote(detail.id, input);
        else await api.updateNote(editingNote.id, input);
        setEditingNote(null); await reload();
      }} />}
      {history && <HistoryDialog {...history} onClose={() => setHistory(null)} />}
    </div>
  );
}

function EmptyWorkspace({ onCreate }: { onCreate: () => void }) {
  return <section className="empty-workspace"><span>◫</span><h1>最初のプロジェクトを作る</h1><p>メモだけでなく、判断と作業の経過も残せます。</p><button onClick={onCreate}>プロジェクトを作成</button></section>;
}

function ProjectView({ project, onNewNote, onEditNote, onHistory, onDelete, onEvent }: {
  project: ProjectDetail;
  onNewNote: () => void;
  onEditNote: (note: Note) => void;
  onHistory: (note: Note) => void;
  onDelete: (note: Note) => void;
  onEvent: (input: { eventType: string; summary: string; details: string }) => Promise<void>;
}) {
  return <div className="workspace">
    <header className="workspace-header"><div><p>PROJECT</p><h1>{project.name}</h1><span>{project.description || "説明はまだありません"}</span></div><button onClick={onNewNote}>＋ メモを作成</button></header>
    <div className="metrics"><div><strong>{project.noteCount}</strong><span>現在のメモ</span></div><div><strong>{project.eventCount}</strong><span>記録した出来事</span></div><div><strong>{new Date(project.updatedAt).toLocaleDateString("ja-JP")}</strong><span>最終更新</span></div></div>
    <div className="content-grid">
      <section><div className="section-title"><h2>現在地</h2><span>{project.notes.length} notes</span></div>
        <div className="notes-grid">{project.notes.map((note) => <article className="note-card" key={note.id}>
          <div className={`status ${note.status}`}>{statusLabel[note.status]}</div><h3>{note.title}</h3><p>{note.content || "本文はありません"}</p>
          <time>{new Date(note.updatedAt).toLocaleString("ja-JP")}</time>
          <div className="note-actions"><button onClick={() => onEditNote(note)}>編集</button><button onClick={() => onHistory(note)}>履歴</button><button onClick={async () => downloadBlob(await api.exportNote(note.id), `${note.id}.json`)}>JSON</button><button className="danger" onClick={() => onDelete(note)}>削除</button></div>
        </article>)}</div>
        {!project.notes.length && <div className="empty-panel">まだメモがありません。現在地を書き残しましょう。</div>}
      </section>
      <aside className="timeline-panel"><div className="section-title"><h2>時間軸</h2><span>{project.events.length} events</span></div><EventComposer onSave={onEvent} />
        <div className="timeline">{project.events.map((event) => <article key={event.id}><i /><time>{new Date(event.occurredAt).toLocaleString("ja-JP")}</time><span>{eventLabel[event.eventType] ?? event.eventType}</span><h3>{event.summary}</h3>{event.details && <p>{event.details}</p>}</article>)}</div>
      </aside>
    </div>
  </div>;
}

function EventComposer({ onSave }: { onSave: (input: { eventType: string; summary: string; details: string }) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return <div className="event-composer"><button className="composer-toggle" onClick={() => setOpen(!open)}>＋ 出来事を記録</button>{open && <form onSubmit={async (event) => {
    event.preventDefault(); const data = new FormData(event.currentTarget); await onSave({ eventType: String(data.get("eventType")), summary: String(data.get("summary")), details: String(data.get("details")) }); setOpen(false);
  }}><select name="eventType"><option value="work.progress">進捗</option><option value="decision.made">方針決定</option><option value="work.started">作業開始</option><option value="work.completed">完了</option><option value="note.observation">メモ</option></select><input name="summary" required maxLength={240} placeholder="何が起きた？" /><textarea name="details" placeholder="理由や補足" /><button type="submit">記録する</button></form>}</div>;
}

function Dialog({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="dialog"><button className="dialog-close" onClick={onClose}>×</button>{children}</div></div>;
}

function ProjectDialog({ onClose, onSave }: { onClose: () => void; onSave: (input: { name: string; description: string }) => Promise<void> }) {
  return <Dialog onClose={onClose}><p className="eyebrow">NEW PROJECT</p><h2>プロジェクトを作成</h2><form onSubmit={async (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); await onSave({ name: String(data.get("name")), description: String(data.get("description")) }); }}><label>プロジェクト名<input name="name" required maxLength={120} autoFocus /></label><label>説明<textarea name="description" /></label><button type="submit">作成する</button></form></Dialog>;
}

function NoteDialog({ note, onClose, onSave }: { note: Note | null; onClose: () => void; onSave: (input: { title: string; content: string; status: NoteStatus }) => Promise<void> }) {
  return <Dialog onClose={onClose}><p className="eyebrow">{note ? "EDIT NOTE" : "NEW NOTE"}</p><h2>{note ? "メモを編集" : "現在地を記録"}</h2><form onSubmit={async (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); await onSave({ title: String(data.get("title")), content: String(data.get("content")), status: String(data.get("status")) as NoteStatus }); }}><label>タイトル<input name="title" required maxLength={120} defaultValue={note?.title} autoFocus /></label><label>本文<textarea name="content" rows={10} defaultValue={note?.content} /></label><label>状態<select name="status" defaultValue={note?.status ?? "active"}><option value="active">進行中</option><option value="paused">保留</option><option value="done">完了</option></select></label><button type="submit">保存する</button></form></Dialog>;
}

function HistoryDialog({ note, revisions, onClose }: { note: Note; revisions: NoteRevision[]; onClose: () => void }) {
  return <Dialog onClose={onClose}><p className="eyebrow">HISTORY</p><h2>{note.title}</h2><div className="history-list">{revisions.map((revision) => <article key={revision.id}><header><strong>Revision {revision.revisionNumber}</strong><time>{new Date(revision.createdAt).toLocaleString("ja-JP")}</time></header><h3>{revision.title}</h3><p>{revision.content || "本文はありません"}</p></article>)}</div></Dialog>;
}

export default App;
