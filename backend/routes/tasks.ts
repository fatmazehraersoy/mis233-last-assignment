// backend/routes/tasks.ts
import { Hono } from "npm:hono";
import { eq } from "npm:drizzle-orm";
import { orm } from "../db/drizzle.ts";
import { tasks } from "../db/schema.ts";
import { saveDb } from "../db/connection.ts";
import { extractJtiFromJwt, isJtiBlacklisted } from "../db/blacklist.ts";
import kv from "../db/cache.ts"; 
import { broadcast } from "../ws.ts"; 

export const tasksRoute = new Hono();


tasksRoute.use("*", async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

  if (token) {
    const jti = extractJtiFromJwt(token);
    if (jti && isJtiBlacklisted(jti)) {
      console.log(`Kara listedeki Token (JTI: ${jti}) ile erişim engellendi.`);
      return c.json({ error: "Oturum sonlandırılmış (Token kara listede)." }, 401);
    }
  }
  await next();
});


tasksRoute.get("/", async (c) => {
    const q = (c.req.query("q") ?? "").toLowerCase();

    
    if (!q) {
        const cached = await kv.get(["tasks_list"]);
        if (cached.value) {
            console.log("Veri CACHE'den (Hafızadan) hızlıca geldi!"); 
            return c.json(cached.value);
        }
    }

    console.log("Veri VERİTABANI'ndan çekiliyor...");
    
    
    let rows = await orm.select().from(tasks).all();
    if (q) rows = rows.filter((r) => r.title.toLowerCase().includes(q));

    
    if (!q) {
        await kv.set(["tasks_list"], rows, { expireIn: 60000 });
        console.log("Veri Cache kutusuna kaydedildi.");
    }

    return c.json(rows);
});


tasksRoute.post("/", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const title = String(body.title ?? "").trim();
    if (!title) return c.json({ error: "title required" }, 400);

    const priority = (body.priority ?? "medium") as string;
    const status = (body.status ?? "todo") as string;
    const module = (body.module ?? null) as string | null;

    const inserted = await orm
        .insert(tasks)
        .values({ title, priority, status, module })
        .returning()
        .get();

    await saveDb();

    // Cache Temizle
    await kv.delete(["tasks_list"]);
    console.log("Yeni veri eklendi, Cache temizlendi.");
    broadcast({ event: "update" }); // Herkese haber ver!
    console.log("WebSocket güncellemesi gönderildi.");

    const headers = new Headers();
    headers.set("location", `/api/tasks/${inserted.id}`);
    return new Response(JSON.stringify(inserted), {
        status: 201,
        headers,
    });
});

tasksRoute.put("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return c.json({ error: "invalid id" }, 400);

    const patch = await c.req.json().catch(() => ({}));
    const { id: _ignore, ...safePatch } = patch;

    await orm.update(tasks).set(safePatch).where(eq(tasks.id, id)).run();
    const updated = await orm.select().from(tasks).where(eq(tasks.id, id)).get();
    await saveDb();

    if (!updated) return c.json({ error: "not found" }, 404);

   
    await kv.delete(["tasks_list"]);
    console.log("Veri güncellendi, Cache temizlendi.");
    broadcast({ event: "update" }); 
    console.log("WebSocket güncellemesi gönderildi.");

    return c.json(updated);
});


tasksRoute.delete("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return c.json({ error: "invalid id" }, 400);

    await orm.delete(tasks).where(eq(tasks.id, id)).run();
    await saveDb();

   
    await kv.delete(["tasks_list"]);
    console.log("Veri silindi, Cache temizlendi.");
    broadcast({ event: "update" }); 
    console.log("WebSocket güncellemesi gönderildi.");

    return c.json({ ok: true });
});
