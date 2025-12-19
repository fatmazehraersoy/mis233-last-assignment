import { object } from "npm:zod";
import { client } from "./db/connection.ts";

await client.execute(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'todo',
    priority TEXT DEFAULT 'medium',
    module TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  );
`);



