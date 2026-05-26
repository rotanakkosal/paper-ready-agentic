# Design — Q&A Gold-Standard Evaluation

**Status:** planned, not yet built. Build only if validate ships with time to spare on Thursday morning (see [../IMPLEMENTATION.md](../IMPLEMENTATION.md) T21).

The eval exists to put a number on the agent's behavior. Without it, the demo is anecdotal. Even a small (10-15 question) eval lets the writeup say *"the agent answers 11/15 guideline questions correctly"* instead of *"it seems to work"*.

## What we're evaluating

Just the retrieval + reasoning over a single journal's guideline. The structured CSV lookups and Crossref/DOAJ calls are deterministic and don't need this kind of eval.

## Q&A format

A JSONL file, one question per line, in `eval/gold_standard.jsonl`:

```jsonl
{"qid": "tpami-001", "journal_id": "tpami", "question": "What reference style does the journal require?", "expected_answer": "IEEE numbered references", "answer_type": "exact_match", "must_contain": ["IEEE"]}
{"qid": "tpami-002", "journal_id": "tpami", "question": "What is the maximum page limit?", "expected_answer": "14 pages including references", "answer_type": "semantic", "must_contain": ["14"]}
{"qid": "tpami-003", "journal_id": "tpami", "question": "Are author ORCIDs required on the title page?", "expected_answer": "Recommended but not required", "answer_type": "yes_no_unclear", "expected_label": "unclear"}
{"qid": "ivc-001", "journal_id": "ivc", "question": "What reference style does the journal require?", "expected_answer": "Elsevier Vancouver numbered", "answer_type": "exact_match", "must_contain": ["Vancouver"]}
```

### `answer_type` values

- **`exact_match`** — `must_contain` strings (case-insensitive) all appear in the model's answer.
- **`semantic`** — LLM-as-judge with a fixed rubric prompt. Returns pass/fail. More expensive — use only for questions where wording legitimately varies.
- **`yes_no_unclear`** — three-way label. Cheap to score; great for "is X required?" questions.

## Composition target (15 Qs)

- 5 questions on **tpami**
- 5 questions on **ivc**
- 5 questions that should both produce `unclear` or `not found in guideline` (negative examples — does the agent hallucinate?)

Question categories spread across the validation flow:

| Category | Example |
|---|---|
| reference style | "What reference style is required?" |
| title page | "Are ORCIDs required for all authors?" |
| sections | "Is a 'Data Availability' statement required?" |
| length | "What is the maximum page count?" |
| figures | "Should figure captions be above or below the figure?" |
| negative | "What is the journal's policy on cryptocurrency citations?" (expected: "not in guideline") |

## Runner

A small Python script, `eval/run_eval.py`, that:

1. Loads `gold_standard.jsonl`.
2. For each row, POSTs to a dedicated n8n webhook `/webhook/ask` (a stripped-down version of validate — just question-answering over Qdrant for one journal, no manuscript parsing).
3. Scores per the `answer_type`.
4. Writes results to `eval/results-{ISO timestamp}.jsonl` and prints a summary table.

```
EVAL RESULTS  (2026-05-28T09:14:22)
─────────────────────────────────────
tpami        4 / 5     (80%)
ivc          5 / 5    (100%)
negative     3 / 5     (60%)  ← 2 hallucinations
─────────────────────────────────────
overall     12 / 15    (80%)
```

### Why a separate `/webhook/ask` workflow

- The validate workflow demands a manuscript PDF. The eval is about retrieval, not parsing. Asking real questions without a manuscript needs a lighter trigger.
- Reuses the same Qdrant search node + Gemini agent — copy/paste once, swap the trigger.

## What this eval does NOT cover

- Does PDF parsing work? — manual smoke test in T6 covers this.
- Does Crossref/DOAJ work? — they're third-party APIs; if they answer, they answer.
- End-to-end report quality. — that's the demo, not a number.

If the eval grows beyond 15 questions or starts trying to score whole reports, it's becoming the project — stop and ship what's there.

## Build effort estimate

- Curate 15 questions (read the guideline PDFs, write expected answers): **~1.5h**.
- `eval/run_eval.py` runner with the three scoring modes: **~30m**.
- Stripped-down `/webhook/ask` n8n workflow: **~30m**.

Total ~2.5h. Won't ship for the midterm unless validate is solid by Thursday 10am.

## Acceptance criteria (if built)

- [ ] `gold_standard.jsonl` has 15 entries across the two ingested journals.
- [ ] `python eval/run_eval.py` runs to completion and prints a per-journal breakdown.
- [ ] Results are reproducible: rerunning gives the same score ±1 question (Gemini has some non-determinism even at temp 0).
- [ ] The writeup includes the summary table and at least two error cases analysed.
