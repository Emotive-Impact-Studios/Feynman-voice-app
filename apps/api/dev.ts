// Local server for trying the app against your own machine:
//   GEMINI_API_KEY=... npm run dev -w @feynman/api
// Then point the app at http://<your-computer's-LAN-IP>:8787
import { createServer } from "node:http";
import { handleTurn } from "./src/turn";

const port = Number(process.env.PORT ?? 8787);
createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (req.url !== "/api/turn") {
    res.writeHead(404).end();
    return;
  }
  const request = new Request(`http://localhost${req.url}`, {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body: req.method === "POST" ? Buffer.concat(chunks) : undefined,
  });
  try {
    const response = await handleTurn(request);
    res.writeHead(response.status, { "content-type": "application/json" });
    res.end(await response.text());
    console.log(new Date().toISOString(), response.status);
  } catch (e) {
    console.error(e);
    res.writeHead(500).end(JSON.stringify({ error: "Server error" }));
  }
}).listen(port, "0.0.0.0", () => console.log(`Feynman API on http://0.0.0.0:${port}/api/turn`));
