import { Hono } from "npm:hono";
import * as bcrypt from "npm:bcryptjs"; 
import { eq } from "npm:drizzle-orm";
import { sign } from "npm:hono/jwt"; 

import { orm } from "../db/drizzle.ts";
import { users } from "../db/schema.ts";
import { saveDb } from "../db/connection.ts";
// Buradaki importların dosya yollarının doğru olduğundan emin ol
import { extractJtiFromJwt, addJtiToBlacklist } from "../db/blacklist.ts";

const auth = new Hono();
const JWT_SECRET = "cok-gizli-super-guvenli-anahtar"; 

auth.post("/register", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body;

    if (!email || !password) return c.json({ error: "Email ve şifre gereklidir." }, 400);

    const existingUsers = await orm.select().from(users).where(eq(users.email, email));
    if (existingUsers.length > 0) return c.json({ error: "Bu email zaten kayıtlı." }, 409);

    const passwordHash = await bcrypt.hash(password, 10);

    await orm.insert(users).values({ email, passwordHash });
    await saveDb();

    return c.json({ message: "Kullanıcı başarıyla oluşturuldu." }, 201);
  } catch (error) {
    return c.json({ "error": "Sunucu hatası."+error }, 500);
  }
});

auth.post("/login", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body;

    if (!email || !password) return c.json({ error: "Email ve şifre gereklidir." }, 400);

    const result = await orm.select().from(users).where(eq(users.email, email));
    const user = result[0];

    if (!user) return c.json({ error: "Geçersiz email veya şifre." }, 401);

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return c.json({ error: "Geçersiz email veya şifre." }, 401);

    // DÜZELTME 1: Token'a benzersiz bir ID (jti) ekliyoruz!
    // Bloom filter'ın neyi engelleyeceğini bilmesi için bu şart.
    const payload = {
      id: user.id,
      email: user.email,
      jti: crypto.randomUUID(), // <--- BU SATIR EKLENDİ (Deno/Node'da yerleşiktir)
      exp: Math.floor(Date.now() / 1000) + 60 * 60, 
    };

    const token = await sign(payload, JWT_SECRET);
  
    return c.json({ 
        message: "Giriş başarılı", 
        token: token, 
        user: { id: user.id, email: user.email } 
    }, 200);

  } catch (error) {
    console.error("Login hatası:", error);
    return c.json({ error: "Sunucu hatası." }, 500);
  }
});

auth.post("/logout", async (c) => {
    // DÜZELTME 2: Hono syntax'ı kullanıldı (c.req ve c.json)
    const authHeader = c.req.header("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

    if (token) {
        // Token'dan jti'yi çıkar (Login'de eklediğimiz ID'yi burada okuyoruz)
        const jti = extractJtiFromJwt(token);

        if (jti) {
            addJtiToBlacklist(jti);
            console.log(`LOGOUT: JTI ${jti} kara listeye eklendi.`);
        } else {
            console.log("LOGOUT HATA: Token içinden jti okunamadı.");
        }
    }
    
    return c.json({ message: "Çıkış başarılı." }, 200);
});

export { auth as authRoute };