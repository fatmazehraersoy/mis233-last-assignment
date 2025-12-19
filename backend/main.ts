// backend/main.ts (Hono version)
import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { eq } from "npm:drizzle-orm";
import { jwt } from "npm:hono/jwt";

import { orm } from "./db/drizzle.ts";
import { tasks } from "./db/schema.ts";
import { saveDb } from "./db/connection.ts";
import { migrate } from "npm:drizzle-orm/sql-js/migrator";

import { logger } from "./middleware/logger.ts";

import { tasksRoute } from "./routes/tasks.ts";
import { authRoute } from "./routes/auth.ts";
import { DB_URL, PORT } from "./config/env.ts";
import { upgradeWebSocket } from "npm:hono/deno";
import { clients } from "./ws.ts";

console.log(`DB_URL = ${DB_URL}`);
console.log(`Server starting on port ${PORT}`);


// --- Boot: run migrations, persist DB file even if already exists ---
try {
    await migrate(orm, { migrationsFolder: "./db/migrations" });
    console.log("Migrations applied.");
} catch (e) {
    let exists = false;
    let e1: unknown = e;
    while (e1) {
        const msg = e1 instanceof Error ? e1.message : String(e1);
        if (msg.includes("already exists")) {
            exists = true;
            console.warn(
                "Migrations skipped: tables already exist (baseline assumed).",
            );
            break;
        }
        // @ts-ignore - walk cause chain if present
        e1 = (e1 as any)?.cause;
    }
    if (!exists) throw e;
} finally {
    await saveDb();
}


import { z } from "npm:zod";
import { OpenAPIHono } from "npm:@hono/zod-openapi";

// Zod schema for a Task
const Task = z.object({
    id: z.number().int(),
    title: z.string().min(1),
    status: z.enum(["todo","doing","done"]),
    priority: z.enum(["low","medium","high"]).default("medium"),
    module: z.string().nullable().optional(),
});

// Create OpenAPI-enabled app
const app = new OpenAPIHono();


app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["content-type", "authorization"],
  exposeHeaders: ["location"],
}));


// Serve OpenAPI JSON
app.doc("/openapi.json", {
    openapi: "3.0.0",
    info: { title: "Tasks API", version: "1.0.0" },
});



// --- App setup ---
// const app = new Hono();
app.use("*", logger);

tasksRoute.use("*", logger);
// WebSocket Endpoint'i
app.get(
  "/ws",
  upgradeWebSocket((c) => {
    return {
      onOpen(_event, ws) {
        
        clients.add(ws);
        console.log("Yeni bir WebSocket bağlantısı!");
      },
      onClose(_event, ws) {
        
        clients.delete(ws);
        console.log("Bir bağlantı koptu.");
      },
    };
  })
);

// Mount tasks under /api/tasks
app.route("/api/tasks", tasksRoute);

app.route("/auth", authRoute);
app.use("/api/tasks/*", jwt({ secret: "cok-gizli-super-guvenli-anahtar" }));

// Simple hello route
app.get("/api/hello", (c) => c.json({ msg: "Hello from Hono + sql.js ✅" }));

app.openapi({
    method: "get",
    path: "/api/tasks",
    tags: ["tasks"],
    summary: "List tasks",
    responses: {
        200: {
            description: "Array of tasks",
            content: {
                "application/json": { schema: z.array(Task) }
            }
        }
    }
}, async (c) => {
    const rows = [{ id: 1, title: "Demo", status: "todo", priority: "medium", module: null }];
    return c.json(rows);
});

// Simple Swagger UI
app.get("/docs", (c) =>
    c.html(`<!doctype html>
<html><head><meta charset="utf-8"/>
<title>API Docs</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css">
</head><body>
<div id="swagger"></div>
<script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({url:'/openapi.json',dom_id:'#swagger'});</script>
</body></html>`));



// Start server
Deno.serve({ port: 8000 }, app.fetch);
console.log("Hono server running at http://localhost:8000");
