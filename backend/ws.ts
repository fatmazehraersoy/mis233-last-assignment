import { WSContext } from "npm:hono/ws";


export const clients = new Set<WSContext>();


export function broadcast(message: object) {
  const msgString = JSON.stringify(message);
  for (const client of clients) {
    try {
      client.send(msgString);
    } catch (e) {
      console.log("Mesaj gönderilemedi, client siliniyor.");
      clients.delete(client);
    }
  }
}