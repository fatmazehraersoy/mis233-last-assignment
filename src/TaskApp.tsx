// TaskApp.tsx
import { useEffect, useMemo, useReducer, useState } from "react";
import {
  taskReducer,
  initialState,
  selectVisible,
  selectCounts,
  type Filter,
  type Priority,
  type TaskStatus,
  type Task,
} from "./taskReducer";
import Modal from "./Modal";
import Sidebar from "./Sidebar";
const API = "http://localhost:8000/api";
type TaskRow = {
  id: number;
  title: string;
  status: "todo" | "in_progress" | "done" | "blocked" | "archived";
  priority: "low" | "medium" | "high";
  created_at?: number;
};

// Optional: migrate old localStorage that used `done: boolean`
function safeParse<T>(s: string | null): T | null {
  try { return s ? (JSON.parse(s) as T) : null; } catch { return null; }
}

type OldTask = { id: string; title: string; done: boolean; priority: Priority; createdAt: number };
type OldState = { tasks: OldTask[]; filter: any };

const STORAGE_KEY = "task-manager-state";

const STATUSES: TaskStatus[] = ["todo", "in_progress", "done", "blocked", "archived"];
const PRIOS: Priority[] = ["low", "medium", "high"];

export default function TaskApp() {
  const [draftTitle, setDraftTitle] = useState("");
  const [draftPriority, setDraftPriority] = useState<Priority>("medium");
  const [draftStatus, setDraftStatus] = useState<TaskStatus>("todo");

  const [isNewOpen, setNewOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [filter, setFilter] = useState<"all" | TaskStatus>("all");
  const [q, setQ] = useState("");

  async function reload() {
    const url = q ? `${API}/tasks?q=${encodeURIComponent(q)}` : `${API}/tasks`;
    const data = await fetch(url).then(r => r.json());
    setTasks(data);
  }
  useEffect(() => { reload(); }, []);       // initial load
  useEffect(() => { reload(); }, [q]);      // refetch on search
  // optional: small search
  // const [q, setQ] = useState("");

  // const [state, dispatch] = useReducer(
  //   taskReducer,
  //   undefined,
  //   () => {
  //     const stored = safeParse<unknown>(localStorage.getItem(STORAGE_KEY));
  //     // migrate if needed
  //     if (stored && typeof stored === "object" && "tasks" in (stored as any)) {
  //       const s = stored as OldState | any;
  //       if (s.tasks?.length && typeof s.tasks[0]?.done === "boolean") {
  //         const tasks = (s.tasks as OldTask[]).map(t => ({
  //           id: t.id,
  //           title: t.title,
  //           status: t.done ? "done" as TaskStatus : "todo",
  //           priority: t.priority ?? "medium",
  //           createdAt: t.createdAt ?? Date.now(),
  //         }));
  //         const filter: Filter = (["all", ...STATUSES] as const).includes(s.filter) ? s.filter : "all";
  //         return { tasks, filter };
  //       }
  //       // already new shape
  //       return s as any;
  //     }
  //     return initialState;
  //   }
  // );
  useEffect(() => {
    
    const token = localStorage.getItem("accessToken");

    
    fetch("http://localhost:8000/api/tasks", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        
        "Authorization": token ? `Bearer ${token}` : "",
      },
    })
      .then((r) => {
        
        if (!r.ok) {
            console.error("Yetkisiz giriş veya hata oluştu");
            
            // window.location.href = "/"; 
            return []; 
        }
        return r.json();
      })
      .then(setTasks)
      .catch((err) => console.error("Veri çekme hatası:", err));
  }, []);
  // useEffect(() => {
  //   localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  // }, [state]);

  const visible = useMemo(() => {
    const byFilter = filter === "all" ? tasks : tasks.filter(t => t.status === filter);
    return byFilter;
  }, [tasks, filter]);

  const counts = useMemo(() => {
    const base = { all: tasks.length, byStatus: { todo: 0, in_progress: 0, done: 0, blocked: 0, archived: 0 } };
    for (const t of tasks) (base as any)[t.status]++;
    return base;
  }, [tasks]);


  // keyboard shortcuts: N = new, / = search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === "n" || e.key === "N")) { e.preventDefault(); setNewOpen(true); }
      if (e.shiftKey && (e.key === "/")) { e.preventDefault(); (document.getElementById("q") as HTMLInputElement)?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // WEBSOCKET BAĞLANTISI
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8000/ws");

    ws.onopen = () => {
      console.log("WebSocket bağlandı!");
    };

    ws.onmessage = (event) => {
      console.log("Sunucudan mesaj geldi:", event.data);
      reload();
    };

    return () => {
      ws.close();
    };
  }, []);
  async function apiAdd(title: string, priority: Priority, status: TaskStatus) {
    const token = localStorage.getItem("accessToken");
    await fetch(`${API}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json",
        "Authorization": `Bearer ${token}` 
      },
      body: JSON.stringify({ title, priority, status })
    });
    await reload();
  }

  async function apiUpdate(id: number, patch: Partial<TaskRow>) {
    await fetch(`${API}/tasks/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json", 
        "Authorization": `Bearer ${token}` 
      },
      body: JSON.stringify(patch)
    });
    await reload();
  }

  async function apiDelete(id: number) {
    const token = localStorage.getItem("accessToken"); 

    await fetch(`${API}/tasks/${id}`, { 
        method: "DELETE",
        
        headers: {
            "Authorization": `Bearer ${token}` 
        }
    });
    await reload();
  }

  // Top-bar quick add (if you have it)
  const add = async () => {
    const title = draftTitle.trim();
    if (!title) return;
    await apiAdd(title, draftPriority, draftStatus);
    setDraftTitle("");
  };

  // Modal add
  const addFromModal = async () => {
    const title = draftTitle.trim();
    if (!title) return;
    await apiAdd(title, draftPriority, draftStatus);
    setDraftTitle(""); setDraftPriority("medium"); setDraftStatus("todo"); setNewOpen(false);
  };

  // Edit modal save
  const saveEdit = async (fields: Partial<{ title: string; priority: Priority; status: TaskStatus }>) => {
    if (!editing) return;
    await apiUpdate(editing.id, fields as any);
    setEditId(null);
  };

  // filter by q (client side)
  const filteredVisible = visible.filter(t =>
    !q || t.title.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <div style={{ display: "flex", gridTemplateColumns: "220px 1fr", minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif" }}>
      <Sidebar

        active={filter}

        counts={counts}

        onPick={(f) => setFilter(f)}

        onNew={() => setNewOpen(true)}

        onClearDone={async () => {
  const token = localStorage.getItem("accessToken"); 
  const done = tasks.filter(t => t.status === "done");
  await Promise.all(done.map(t => fetch(`${API}/tasks/${t.id}`, { 
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` } 
  })));
  reload();
}}

      />

      <main style={{ maxWidth: 980, margin: "0 auto", padding: "24px 24px" }}>
        <h2 style={{ margin: 0 }}>Task Manager</h2>

        {/* top bar: search + quick add button */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
          <input id="q" value={q} onChange={e => setQ(e.target.value)} placeholder="Search tasks…" style={{ padding: 8, flex: 1 }} />
          <button onClick={() => setNewOpen(true)}>＋ New</button>
        </div>

        {/* List */}
        <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>
          {filteredVisible.map((t, idx) => (
            <li key={t.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 120px 130px repeat(5, max-content)",
                gap: 8, alignItems: "center", padding: "8px 0", borderBottom: "1px solid #eee"
              }}>
              <button onClick={() => setEditId(t.id)} title="Edit" style={{ textAlign: "left", background: "transparent", border: "none", padding: 0, cursor: "pointer" }}>
                <span style={{ textDecoration: t.status === "archived" ? "line-through" : "none" }} title={`priority: ${t.priority}`}>
                  {t.title}
                </span>
              </button>

              <select
                value={t.status}
                onChange={(e) => apiUpdate(t.id, { status: e.target.value as TaskStatus })}
              >
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              <select
                value={t.priority}
                onChange={(e) => apiUpdate(t.id, { priority: e.target.value as Priority })}
              >
                {PRIOS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>

              <button
                onClick={() => {
                  const order: TaskStatus[] = ["todo", "in_progress", "done", "blocked", "archived"];
                  const next = order[(order.indexOf(t.status) + 1) % order.length];
                  apiUpdate(t.id, { status: next });
                }}
                title="Cycle status"
              >⟳</button>
              {/* <button
                onClick={() => dispatch({ type: "reorder", from: idx, to: Math.max(0, idx - 1) })}
                disabled={idx === 0}
                title="Move up"
              >↑</button>
              <button
                onClick={() => dispatch({ type: "reorder", from: idx, to: Math.min(state.tasks.length - 1, idx + 1) })}
                disabled={idx === state.tasks.length - 1}
                title="Move down"
              >↓</button> */}
              <button onClick={() => setEditId(t.id)} title="Edit">✎</button>
              <button onClick={() => apiDelete(t.id)} title="Delete">✕</button>
            </li>
          ))}
        </ul>
      </main>

      {/* NEW TASK MODAL */}
      <Modal open={isNewOpen} onClose={() => setNewOpen(false)} title="New Task"
        footer={
          <>
            <button onClick={() => setNewOpen(false)}>Cancel</button>
            <button onClick={addFromModal}>Create</button>
          </>
        }
      >
        <div style={{ display: "grid", gap: 10 }}>
          <input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addFromModal()}
            placeholder="Task title"
            style={{ padding: 8 }}
            autoFocus
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label>Priority{" "}
              <select value={draftPriority} onChange={e => setDraftPriority(e.target.value as Priority)}>
                {PRIOS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label>Status{" "}
              <select value={draftStatus} onChange={e => setDraftStatus(e.target.value as TaskStatus)}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
        </div>
      </Modal>

      {/* EDIT TASK MODAL */}
      <Modal
       
        onClose={() => setEditId(null)}
        title="Edit Task"
        footer={
          <>
            <button onClick={() => setEditId(null)}>Close</button>
            <button onClick={() => {
              // save title/priority/status from inputs below
              const title = (document.getElementById("edit-title") as HTMLInputElement)?.value?.trim();
              const prio = (document.getElementById("edit-prio") as HTMLSelectElement)?.value as Priority;
              const st = (document.getElementById("edit-status") as HTMLSelectElement)?.value as TaskStatus;
              saveEdit({ title, priority: prio, status: st });
            }}>Save</button>
          </>
        }
      >
        {editing && (
          <div style={{ display: "grid", gap: 10 }}>
            <input id="edit-title" defaultValue={editing.title} style={{ padding: 8 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label>Priority{" "}
                <select id="edit-prio" defaultValue={editing.priority}>
                  {PRIOS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <label>Status{" "}
                <select id="edit-status" defaultValue={editing.status}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
