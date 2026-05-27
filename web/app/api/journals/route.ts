const SIDECAR = process.env.SIDECAR_BASE_URL ?? "http://localhost:8000";

export async function GET() {
  let upstream: Response;
  try {
    upstream = await fetch(`${SIDECAR}/journals`, { cache: "no-store" });
  } catch (e) {
    return Response.json(
      { error: `sidecar unreachable at ${SIDECAR}: ${(e as Error).message}` },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    return Response.json(
      { error: `sidecar /journals returned ${upstream.status}` },
      { status: 502 },
    );
  }

  return Response.json(await upstream.json(), {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
