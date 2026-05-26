# Design — Next.js Frontend

A single-page app. Upload form on top, report below. No client-side routing, no auth, no persistence — every request is fresh.

## Stack

- Next.js 15 (App Router, TypeScript)
- Tailwind CSS
- No state library — `useState` is enough
- No client-side PDF preview — keep it simple
- (Optional) shadcn/ui for buttons / inputs if it doesn't slow you down; otherwise plain Tailwind

## Pages

### `/` — the only page

Layout:

```
┌─────────────────────────────────────────────────────────────┐
│  PaperReady                                                 │
│  Check your manuscript against journal guidelines before    │
│  you submit.                                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Target journal   [ Select a journal ▾ ]                   │
│   Manuscript PDF   [ Choose file: manuscript.pdf ]          │
│                                                             │
│                              [ Validate ]                   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│   ╭── Verdict: NEEDS REVISION ──────────────────────────╮   │
│   │   2 pass · 2 warn · 1 fail                          │   │
│   ╰─────────────────────────────────────────────────────╯   │
│                                                             │
│   ✗ Reference Style                              [ FAIL ]   │
│      Manuscript uses APA-style author-year citations;       │
│      journal requires IEEE numbered.                        │
│      ↳ Guideline p.4 §2: "References should be numbered..." │
│      • Citation format ........................... FAIL     │
│      • Reference list order ...................... FAIL     │
│                                                             │
│   ⚠ DOI Resolution                               [ WARN ]   │
│      ...                                                    │
│                                                             │
│   ✓ Title Page                                   [ PASS ]   │
│      ...                                                    │
└─────────────────────────────────────────────────────────────┘
```

States the page must handle:

- **idle** — form visible, no report yet.
- **loading** — form disabled, skeleton or spinner under the form ("Reading guideline... parsing manuscript... checking references...").
- **error** — red banner with the message from the API route.
- **success** — render the `ValidationReport`.

## Component tree

```
app/
├── layout.tsx                # shell, Tailwind globals
├── page.tsx                  # client component, holds form state + report state
└── api/
    └── validate/
        └── route.ts          # server route, forwards to n8n
components/
├── JournalSelect.tsx         # fetches /api/journals on mount, renders <select>
├── UploadForm.tsx            # file input + submit, calls /api/validate
├── ReportView.tsx            # top-level switch on state
└── report/
    ├── VerdictBanner.tsx     # pass/warn/fail counts
    ├── CategoryCard.tsx      # one card per ValidationReport.categories[]
    └── EvidencePill.tsx      # "Guideline p.4 §2: ..." chip
lib/
└── types.ts                  # mirrors ValidationReport from the workflow doc
```

Single `page.tsx` orchestrates state; everything else is presentational.

## API routes

### `GET /api/journals`

Server route that proxies to the sidecar `GET /journals` and returns the same shape. Why proxy: avoids exposing the sidecar host directly to the browser and keeps the journal list serverside-cacheable.

Cache hint: `Cache-Control: s-maxage=3600` — the CSV doesn't change during a session.

### `POST /api/validate`

Server route. Receives multipart from the browser, forwards to n8n with the secret header added serverside (the browser never sees `N8N_WEBHOOK_SECRET`).

```ts
// app/api/validate/route.ts
export async function POST(req: Request) {
  const formData = await req.formData()
  const upstream = await fetch(`${process.env.N8N_BASE_URL}/webhook/validate`, {
    method: "POST",
    headers: { "x-paperready-secret": process.env.N8N_WEBHOOK_SECRET! },
    body: formData,
  })
  if (!upstream.ok) {
    return Response.json(
      { error: `validate upstream failed (${upstream.status})` },
      { status: upstream.status },
    )
  }
  return Response.json(await upstream.json())
}
```

Note: `formData` reconstruction preserves the binary `pdf` field and `journal_id` text field as-is.

## Env vars

`web/.env.local` (gitignored):

```
SIDECAR_BASE_URL=http://localhost:8000
N8N_BASE_URL=http://localhost:5678
N8N_WEBHOOK_SECRET=replace-me
```

`web/.env.example` ships in the repo as the template.

## Styling notes

- Verdict colors: pass `emerald-600`, warn `amber-500`, fail `rose-600`.
- Cards use `border-l-4` in the verdict color — fast visual scanning.
- Keep the page max-width to `max-w-3xl` — reports are read top-to-bottom, not skimmed side-to-side.
- No dark mode — extra polish that doesn't help the demo.

## Loading behavior

A real run takes 15-30s. Don't show a spinning circle for 30s. Show a stepwise indicator:

```
⏳ Parsing manuscript…           (sidecar /parse-manuscript)
⏳ Loading journal guideline…    (Qdrant retrievals)
⏳ Checking references…          (Crossref)
⏳ Generating report…            (agent reasoning)
```

These are fake (the frontend can't see n8n's per-node progress), but cycling through them on a timer makes the wait tolerable. Honest enough — those four things are actually happening.

## Acceptance criteria

- [ ] `pnpm dev` (or `npm run dev`) starts the app on port 3000.
- [ ] Journal dropdown is populated from `/api/journals` (58 entries).
- [ ] Submitting a real PDF + journal returns a rendered report within 30s.
- [ ] All 5 categories from `ValidationReport.categories` render as cards.
- [ ] Evidence pills show page + chunk index, not just text.
- [ ] Switching journal and resubmitting the same PDF produces a *visibly different* report.
- [ ] No console errors on a successful run.
