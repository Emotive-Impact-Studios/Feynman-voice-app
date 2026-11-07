// Waitlist sign-ups from the website. Saves an email to Neon.
// Needs DATABASE_URL (the Neon "feynman" database) in this Vercel project.
import { neon } from "@neondatabase/serverless";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request): Promise<Response> {
  let body: { email?: unknown; source?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL.test(email) || email.length > 254) return json({ error: "Please enter a valid email" }, 400);
  const source = typeof body.source === "string" ? body.source.slice(0, 40) : "site";

  const url = process.env.DATABASE_URL;
  if (!url) return json({ error: "Waitlist not configured" }, 503);

  const sql = neon(url);
  await sql`
    insert into waitlist (email, source)
    values (${email}, ${source})
    on conflict (email) do nothing`;
  return json({ ok: true }, 200);
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}
