import initSqlJs from "sql.js";

// Resolve the wasm file location in a version-agnostic way
const wasmUrl = import.meta.resolve("sql.js/dist/sql-wasm.wasm");
const SQL = await initSqlJs({
  locateFile: () => wasmUrl,
});

// DB file on disk
const DB_FILE = "./db/tasks.db";

// Ensure ./db exists
try { await Deno.mkdir("./db", { recursive: true }); } catch {}

// Load existing DB or create a new one
let initial: Uint8Array | null = null;
try {
  initial = await Deno.readFile(DB_FILE);
} catch {
  initial = null;
}

export const sqlDb = initial ? new SQL.Database(initial) : new SQL.Database();

// Bootstrap schema (idempotent)
sqlDb.run(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'todo',
    priority TEXT DEFAULT 'medium',
    module TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  );
`);
sqlDb.run(`
  ---drop table users;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  );
`);

export async function saveDb() {
  const data = sqlDb.export();
  await Deno.writeFile(DB_FILE, data);
}

console.log("🗄️ sql.js ready →", DB_FILE);
