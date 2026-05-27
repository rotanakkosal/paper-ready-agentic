// Server route — forwards multipart (pdf + journal_id) to the n8n webhook.
// We do this server-side so any future N8N_WEBHOOK_SECRET header is added
// here and never leaked to the browser.

const N8N = process.env.N8N_BASE_URL ?? "http://localhost:5678";
const SECRET = process.env.N8N_WEBHOOK_SECRET;

export async function POST(req: Request) {
  // Forward the incoming FormData as-is to preserve the binary PDF + text fields.
  const incoming = await req.formData();

  const headers: Record<string, string> = {};
  if (SECRET) headers["x-paperready-secret"] = SECRET;

  let upstream: Response;
  try {
    upstream = await fetch(`${N8N}/webhook/validate`, {
      method: "POST",
      headers,
      body: incoming,
    });
  } catch (e) {
    return Response.json(
      { error: `n8n unreachable at ${N8N}: ${(e as Error).message}` },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    let body = "";
    try {
      body = await upstream.text();
    } catch {
      // ignore
    }
    return Response.json(
      { error: `validate webhook returned ${upstream.status}: ${body.slice(0, 400)}` },
      { status: upstream.status },
    );
  }

  // n8n returns application/json after T12's Clean Output node parses + unwraps.
  // But: if the agent crashes mid-run (e.g. Gemini free-tier 429/503), n8n
  // completes the webhook with HTTP 200 + empty body. Surface that as a useful
  // error instead of letting JSON.parse explode on the client.
  const text = await upstream.text();
  if (!text.trim()) {
    return Response.json(
      {
        error:
          "The agent ran into a Gemini free-tier rate limit before completing. Wait ~60 seconds and try again.",
      },
      { status: 502 },
    );
  }
  try {
    return Response.json(JSON.parse(text));
  } catch {
    return Response.json(
      { error: `n8n returned non-JSON: ${text.slice(0, 300)}` },
      { status: 502 },
    );
  }
}
