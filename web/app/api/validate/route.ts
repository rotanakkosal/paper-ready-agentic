const N8N = process.env.N8N_BASE_URL ?? "http://localhost:5678";
const SECRET = process.env.N8N_WEBHOOK_SECRET;

export async function POST(req: Request) {
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
    } catch {}
    return Response.json(
      { error: `validate webhook returned ${upstream.status}: ${body.slice(0, 400)}` },
      { status: upstream.status },
    );
  }

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
