// Local server for trying the app against your own machine:
//   OPENAI_API_KEY=... npm run dev -w @feynman/api
// Then point the app at http://<your-computer's-LAN-IP>:8787
import { createServer } from "node:http";
import handler from "./src/node-handler";

const port = Number(process.env.PORT ?? 8787);
createServer(async (req, res) => {
  await handler(req, res);
  console.log(new Date().toISOString(), req.url, res.statusCode);
}).listen(port, "0.0.0.0", () => console.log(`Feynman API on http://0.0.0.0:${port} (/api/turn, /api/live-turn, /api/lesson, /api/analyse, /api/show-me)`));
