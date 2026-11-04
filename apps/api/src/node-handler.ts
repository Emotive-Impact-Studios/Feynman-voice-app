// Node (req, res) adapter around handleTurn, used by the deployed function.
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleTurn } from "./turn";

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
  const request = new Request(`https://local${req.url ?? "/api/turn"}`, {
    method: req.method,
    headers,
    body: req.method === "POST" ? Buffer.concat(chunks) : undefined,
  });
  try {
    const response = await handleTurn(request);
    res.writeHead(response.status, { "content-type": "application/json" });
    res.end(await response.text());
  } catch (e) {
    console.error(e);
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Server error" }));
  }
}
