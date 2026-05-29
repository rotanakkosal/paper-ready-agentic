import { workflow, trigger, node, merge, embeddings, languageModel, tool, expr } from '@n8n/workflow-sdk';

const PARSE_MANUSCRIPT_JS = `// Manuscript parser — runs inside the n8n "Code" node of the validate workflow.
//
// Input:  $input.first().json from the upstream "Extract from File" node
//           - .text       full extracted PDF text
//           - .numpages   page count
//         $('Webhook').first().json.body.journal_id
//
// Output: a single item whose json is { journal_id, manuscript: ParsedManuscript }
//         The ParsedManuscript shape matches docs/design/n8n-validate-workflow.md.
//
// Parsing is intentionally heuristic — the agent reasons over these fields
// with retrieved guideline context, so the parser only needs to surface
// structure, not be authoritative.

const inputJson = $input.first().json;
const text = (inputJson.text || '').toString();
const pageCount = inputJson.numpages || 0;
const journalId = $('Webhook').first().json.body?.journal_id || null;

// --- Title: first long-ish line in the first ~1500 chars (above the abstract) ---
// Skip common running headers from preprint servers and conference banners so
// we don't classify the boilerplate as the title (e.g. ViT's "Published as a
// conference paper at ICLR 2021" appears on line 1, above the real title).
const SKIP_HEADER_PATTERNS = [
  /^abstract\\b/i,
  /^published\\s+as/i,
  /^preprint\\b/i,
  /^under\\s+review/i,
  /^arxiv:/i,
  /^manuscript\\s+received/i,
  /^\\d{4}\\s+ieee/i,
  /^©\\s*\\d{4}/i,
];
const firstChunk = text.slice(0, 1500);
const firstLines = firstChunk.split('\\n').map(l => l.trim()).filter(Boolean);
const title = firstLines.find(l =>
  l.length > 20 && !SKIP_HEADER_PATTERNS.some(p => p.test(l))
) || null;

// --- ORCIDs ---
const orcidRe = /\\d{4}-\\d{4}-\\d{4}-\\d{3}[\\dX]/g;
const orcids = text.match(orcidRe) || [];

// --- Abstract: text between "Abstract" and the next major heading ---
const absMatch = text.match(/Abstract[\\s\\-:.]+([\\s\\S]{50,2500}?)(?=Keywords|Introduction|1\\.\\s|I\\.\\s|\\n\\n\\n)/i);
const abstract = absMatch ? absMatch[1].trim() : null;

// --- Sections: capitalised heading-like lines ---
const sectionRe = /^(?:\\d+\\.?\\s+)?([A-Z][A-Za-z ]{3,40})$/gm;
const sectionsSet = new Set();
let mSec;
while ((mSec = sectionRe.exec(text)) !== null) sectionsSet.add(mSec[1].trim());
const sections_detected = Array.from(sectionsSet);

// --- Declarations: simple substring probes ---
const lower = text.toLowerCase();
const declarations = {
  conflict_of_interest: /conflict[s]? of interest|competing interest/.test(lower) ? 'found' : 'missing',
  funding: /\\bfunding\\b|funded by|\\bgrant\\b/.test(lower) ? 'found' : 'missing',
  data_availability: /data availability|data sharing/.test(lower) ? 'found' : 'missing',
  ethics: /ethics statement|ethical (review|approval)|irb approval/.test(lower) ? 'found' : 'missing'
};

// --- References + DOIs ---
// DOI shape: 10.NNNN/<rest>. We require at least one slash + 3 chars after it
// so truncated fragments like "10.1" don't get classified as DOIs and fed
// to crossref_verify_doi (which would 404 and crash the agent).
const doiRe = /10\\.\\d{4,9}\\/[-._;()\\/:A-Z0-9]{3,}/gi;
function normalizeDoi(d) {
  // Strip trailing punctuation that often leaks in from reference text
  return d.replace(/[.,;)\\]>]+$/, '');
}
const refsIdx = text.search(/\\bReferences\\b/i);
let refsBlock = refsIdx >= 0 ? text.slice(refsIdx).replace(/^References[\\s\\S]{0,10}/i, '') : '';
const rawRefs = refsBlock
  .split(/\\n\\s*(?:\\[\\d+\\]|\\d+\\.)\\s+/)
  .map(s => s.trim())
  .filter(s => s.length > 20)
  .slice(0, 100);
const references = rawRefs.map(raw => {
  const dm = raw.match(doiRe);
  return { raw: raw.slice(0, 500), doi: dm ? normalizeDoi(dm[0]) : null };
});
const allDois = (text.match(doiRe) || []).map(normalizeDoi);

return [{
  json: {
    journal_id: journalId,
    manuscript: {
      title,
      orcids_found: orcids,
      abstract,
      sections_detected,
      declarations,
      references,
      stats: {
        page_count: pageCount,
        reference_count: references.length,
        doi_count: allDois.length,
        orcid_count: orcids.length
      }
    }
  }
}];
`;

const BUNDLE_CONTEXT_JS = `// Bundle Context — runs after the Merge, before the Validator Agent.
//
// Input:  $input.first().json = output of "Merge" (combineByPosition)
//           input 0: { journal_id, manuscript } from Parse Manuscript
//           input 1: requirements JSON from Get Requirements
//                    ({ journal_id, journal_name, item_count, items[] })
//         $('Get Journal Metadata').first().json — full CSV row for the journal
//
// Output: a single item bundling { manuscript, journal, requirements } for
//         the agent. The agent grades each pre-extracted requirement against
//         the manuscript instead of discovering requirements via RAG.

const m = $input.first().json || {};
const manuscript = m.manuscript || null;
const journalRow = $('Get Journal Metadata').first().json || {};
const journal = {
  journal_id: journalRow.journal_id ?? m.journal_id ?? null,
  name: journalRow.name ?? null,
  required_reference_style: journalRow.required_reference_style ?? null,
  issn: journalRow.issn ?? null,
  reputation_flag: journalRow.reputation_flag ?? null,
  url: journalRow.homepage_url ?? null
};
// The merge will have copied requirements fields onto $json.
const requirements = Array.isArray(m.items) ? m.items : [];

return [{ json: { manuscript, journal, requirements } }];
`;

const VALIDATOR_SYSTEM_MESSAGE = `You are PaperReady, a pre-submission validator for academic manuscripts.

You receive in the user message:
  - manuscript: structured fields parsed from the user's PDF (title, authors/ORCIDs,
    abstract, sections_detected, declarations, references[], stats)
  - journal: target journal metadata (journal_id, name, required_reference_style,
    issn, reputation_flag, url)
  - requirements: a PRE-EXTRACTED list of atomic submission requirements for
    the target journal. Each item has { topic, requirement, page }. This list
    was built once from the full author guideline at ingest time — it is the
    authoritative checklist. You do NOT need to discover requirements yourself.

You have FOUR tools. Use them sparingly — token/rate budget is tight:
  - qdrant_search(query)        — semantic search over the target journal's
                                  official author guideline. Use AT MOST 2 calls
                                  total, only when a requirement needs guideline
                                  context to grade.
  - get_reference_rules(style_name)
                                — fetch the journal's expected reference style
                                  rules. Call ONCE with journal.required_reference_style.
  - crossref_verify_doi(doi)    — verify a DOI resolves on Crossref. Call on
                                  AT MOST 3 sampled DOIs from manuscript.references[].
  - doaj_lookup(issn)           — look up the journal in DOAJ by ISSN. Call ONCE
                                  with journal.issn (skip if issn is null).

Your job has two parts:

PART A — Grade EVERY item in requirements[].
  For each input requirement, emit one entry in submission_checklist with:
    - requirement: copied verbatim from the input
    - topic: copied verbatim from the input
    - guideline_page: copied verbatim from the input (the input's "page" field)
    - status: "pass" if the manuscript clearly satisfies it,
              "fail" if it clearly violates it,
              "warn" if it partially satisfies or is ambiguous,
              "pending" if it cannot be verified from the manuscript alone
              (anything about the submission portal, file naming on upload,
              reviewer suggestions, cover-letter content).
    - detail: one short sentence explaining the verdict.
  The output submission_checklist MUST have EXACTLY one entry per requirements
  item. Do NOT invent extras. Do NOT drop items.

PART B — Produce five category summaries.
  Group your gradings into five categories and write a short explanation per
  category, with at most 3 representative items each (the most important
  findings, not every checklist row). Categories: reference_style,
  doi_verification, title_page, declarations, legitimacy. Empty DOAJ results
  do NOT mean illegitimate.

Also produce a cover_letter string (150–250 words, plain text with \\n line
breaks, no markdown). Address 'Dear Editor-in-Chief,' if no editor name is
known. Mention the manuscript title, summarise the contribution from the
abstract, justify fit using the journal's scope, close with 'Sincerely,\\nThe authors'.

Output rules:
  - Output ONLY the ValidationReport JSON. No prose, no markdown fences.
  - Cite qdrant_search hits by {page, chunk_index_on_page} in evidence_from_guideline.
  - summary.pass_count, warn_count, fail_count count submission_checklist entries
    (NOT category items). pending entries don't count toward any of the three.
  - summary.verdict: "pass" if fail_count == 0 and warn_count <= 2,
                     "needs_revision" if fail_count <= 3,
                     "fail" otherwise.
  - Never fabricate. If a requirement can't be checked from the manuscript, mark
    it pending.

ValidationReport JSON shape:
{
  "journal": { "journal_id": "...", "name": "...", "required_reference_style": "..." },
  "summary": { "verdict": "pass|needs_revision|fail",
               "pass_count": 0, "warn_count": 0, "fail_count": 0 },
  "categories": [
    {
      "id": "reference_style|doi_verification|title_page|declarations|legitimacy",
      "title": "...",
      "status": "pass|warn|fail",
      "explanation": "...",
      "evidence_from_guideline": [
        { "page": 4, "chunk_index_on_page": 2, "excerpt": "..." }
      ],
      "items": [ { "label": "...", "status": "...", "detail": "..." } ]
    }
  ],
  "cover_letter": "Dear Editor-in-Chief,\\n\\n... (150–250 words) ...\\n\\nSincerely,\\nThe authors",
  "submission_checklist": [
    {
      "topic": "title_page|declarations|references|figures_tables|...",
      "requirement": "Copied verbatim from the requirements input",
      "status": "pass|warn|fail|pending",
      "detail": "One-sentence reason it passed or failed",
      "guideline_page": 0
    }
  ]
}`;

const VALIDATOR_USER_PROMPT = `=Validate the manuscript below against the target journal.

MANUSCRIPT:
{{ JSON.stringify($json.manuscript, null, 2) }}

TARGET JOURNAL:
{{ JSON.stringify($json.journal, null, 2) }}

REQUIREMENTS (authoritative — grade every one as a submission_checklist entry):
{{ JSON.stringify($json.requirements, null, 2) }}

Grade each requirement against the manuscript. Use your tools only when needed for nuance (DOI verification, reference-style rules, DOAJ lookup, occasional guideline context). Produce the ValidationReport JSON exactly matching the schema in your system message. Output JSON only.`;

const QDRANT_TOOL_DESCRIPTION = `Semantic search over the target journal's official author guideline (the manuscript's destination journal). Input is a natural-language query like "title page requirements" or "conflict of interest statement". Returns the top-5 most relevant passages, each with its page number and chunk_index_on_page. Use this for any question about the journal's format requirements.`;

const REF_RULES_TOOL_DESCRIPTION = `Get all formatting rules for a reference style. Valid style_name values: "APA 7", "IEEE", "Vancouver", "Harvard", "Chicago". Call once with the journal's required_reference_style.`;

const CROSSREF_TOOL_DESCRIPTION = `Verify that a DOI resolves to a real Crossref record. Input is a DOI like "10.1109/CVPR.2022.12345" (no URL prefix). Returns 200 with metadata if found, 404 if not. Use to check whether references[].doi values are real.`;

const DOAJ_TOOL_DESCRIPTION = `Look up a journal in DOAJ (Directory of Open Access Journals) by ISSN. Input is an ISSN like "1939-3539". Non-empty results signal OA legitimacy. Empty results do NOT mean illegitimate — many reputable journals are not OA.`;

const CLEAN_OUTPUT_JS = `// Clean Output — runs after the Validator Agent, before Respond to Webhook.
//
// The Validator Agent normally emits { output: "\\\`\\\`\\\`json\\n{...ValidationReport...}\\n\\\`\\\`\\\`" }
// — the report wrapped in a markdown fence inside a string. This node
// unwraps that and responds with a clean ValidationReport object.
//
// Also handles two known Gemini Flash-Lite failure modes:
//   1) The model "leaks" a tool call as plain text instead of issuing a real
//      function call — recognisable as "Calling <tool> with input: {...}".
//      We surface a clear, retry-friendly error.
//   2) The model wraps JSON in extra prose ("Here is the report: ..."). We
//      slice from the first '{' to the last '}' as a fallback.

const raw = $input.first().json.output;

if (raw && typeof raw === 'object') {
  return [{ json: raw }];
}

let text = String(raw ?? '').trim();

const toolLeak = text.match(/^Calling\\s+(\\w+)\\s+with\\s+input:/i);
if (toolLeak) {
  return [{ json: {
    error: 'The model leaked a tool call as text instead of completing the report. This is a known Gemini Flash-Lite reliability issue on multi-step agent loops. Please re-submit.',
    leaked_tool: toolLeak[1],
    raw,
  } }];
}

const fenceMatch = text.match(/\`\`\`(?:json)?\\s*\\n?([\\s\\S]*?)\\n?\`\`\`/i);
if (fenceMatch) text = fenceMatch[1].trim();

let parsed;
try {
  parsed = JSON.parse(text);
} catch (e1) {
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try {
      parsed = JSON.parse(text.slice(first, last + 1));
    } catch (e2) {
      return [{ json: { error: 'failed to parse agent output', message: e2.message, raw } }];
    }
  } else {
    return [{ json: { error: 'failed to parse agent output (no JSON object found)', raw } }];
  }
}

return [{ json: parsed }];
`;

const webhookTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook',
    parameters: {
      httpMethod: 'POST',
      path: 'validate',
      responseMode: 'responseNode',
      options: {}
    },
    position: [0, 112]
  }
});

const extractPdf = node({
  type: 'n8n-nodes-base.extractFromFile',
  version: 1.1,
  config: {
    name: 'Extract from File',
    parameters: {
      operation: 'pdf',
      binaryPropertyName: 'pdf',
      options: {}
    },
    position: [224, 16]
  }
});

const parseManuscript = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse Manuscript',
    parameters: {
      jsCode: PARSE_MANUSCRIPT_JS
    },
    position: [448, 16]
  }
});

const fetchJournal = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Get Journal Metadata',
    parameters: {
      url: expr('http://host.docker.internal:8000/journals/{{ $json.body.journal_id }}'),
      options: {}
    },
    position: [448, 208]
  }
});

const fetchRequirements = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Get Requirements',
    parameters: {
      url: expr('http://host.docker.internal:8000/requirements/{{ $json.journal_id }}'),
      options: {
        response: { response: { neverError: true } }
      }
    },
    position: [560, 208]
  }
});

const mergeJournalAndManuscript = merge({
  version: 3.2,
  config: {
    name: 'Merge',
    parameters: {
      mode: 'combine',
      combineBy: 'combineByPosition',
      options: {}
    },
    position: [672, 112]
  }
});

const bundleContext = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Bundle Context',
    parameters: {
      jsCode: BUNDLE_CONTEXT_JS
    },
    position: [896, 112]
  }
});

const geminiEmbeddings = embeddings({
  type: '@n8n/n8n-nodes-langchain.embeddingsGoogleGemini',
  version: 1,
  config: {
    name: 'Gemini Embeddings',
    parameters: {},
    position: [1248, 432]
  }
});

const qdrantSearchTool = tool({
  type: '@n8n/n8n-nodes-langchain.vectorStoreQdrant',
  version: 1.3,
  config: {
    name: 'qdrant_search',
    parameters: {
      mode: 'retrieve-as-tool',
      toolDescription: QDRANT_TOOL_DESCRIPTION,
      qdrantCollection: {
        __rl: true,
        mode: 'list',
        value: 'guideline_chunks',
        cachedResultName: 'guideline_chunks'
      },
      topK: 5,
      includeDocumentMetadata: true,
      options: {
        searchFilterJson: expr(`{"must":[{"key":"metadata.journal_id","match":{"value":"{{ $('Merge').first().json.journal_id }}"}}]}`),
        contentPayloadKey: 'text'
      }
    },
    subnodes: { embedding: geminiEmbeddings },
    position: [1248, 320]
  }
});

const getReferenceRulesTool = tool({
  type: 'n8n-nodes-base.httpRequestTool',
  version: 4.4,
  config: {
    name: 'get_reference_rules',
    parameters: {
      toolDescription: REF_RULES_TOOL_DESCRIPTION,
      method: 'GET',
      url: expr("http://host.docker.internal:8000/reference-rules/{{ encodeURIComponent($fromAI('style_name', 'Reference style name. One of: APA 7, IEEE, Vancouver, Harvard, Chicago.', 'string')) }}"),
      options: {
        response: { response: { neverError: true } }
      }
    },
    position: [1408, 320]
  }
});

const crossrefVerifyDoiTool = tool({
  type: 'n8n-nodes-base.httpRequestTool',
  version: 4.4,
  config: {
    name: 'crossref_verify_doi',
    parameters: {
      toolDescription: CROSSREF_TOOL_DESCRIPTION,
      method: 'GET',
      url: expr("https://api.crossref.org/works/{{ $fromAI('doi', 'A DOI such as 10.1109/CVPR.2022.12345 (no URL prefix).', 'string') }}"),
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: {
        parameters: [
          {
            name: 'User-Agent',
            value: 'PaperReady/0.1 (mailto:contact@paperready.example)'
          }
        ]
      },
      options: {
        response: { response: { neverError: true } }
      }
    },
    position: [1568, 320]
  }
});

const doajLookupTool = tool({
  type: 'n8n-nodes-base.httpRequestTool',
  version: 4.4,
  config: {
    name: 'doaj_lookup',
    parameters: {
      toolDescription: DOAJ_TOOL_DESCRIPTION,
      method: 'GET',
      url: expr("https://doaj.org/api/search/journals/issn:{{ $fromAI('issn', 'An ISSN such as 1939-3539.', 'string') }}"),
      options: {
        response: { response: { neverError: true } }
      }
    },
    position: [1728, 320]
  }
});

const geminiChatModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
  version: 1.1,
  config: {
    name: 'Gemini 2.5 Flash',
    parameters: {
      modelName: 'models/gemini-2.5-flash',
      options: {
        temperature: 0.2,
        maxOutputTokens: 16384
      }
    },
    position: [1088, 320]
  }
});

const validatorAgent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Validator Agent',
    parameters: {
      promptType: 'define',
      text: VALIDATOR_USER_PROMPT,
      options: {
        systemMessage: VALIDATOR_SYSTEM_MESSAGE,
        maxIterations: 12
      }
    },
    subnodes: {
      model: geminiChatModel,
      tools: [qdrantSearchTool, getReferenceRulesTool, crossrefVerifyDoiTool, doajLookupTool]
    },
    position: [1120, 112]
  }
});

const cleanOutput = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Clean Output',
    parameters: {
      jsCode: CLEAN_OUTPUT_JS
    },
    position: [1536, 112]
  }
});

const respond = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond to Webhook',
    parameters: {
      options: { responseCode: 200 }
    },
    position: [1760, 112]
  }
});

export default workflow('paperready-validate', 'PaperReady — Validate')
  .add(webhookTrigger)
  .to(extractPdf.to(parseManuscript.to(mergeJournalAndManuscript.input(0))))
  .add(webhookTrigger)
  .to(fetchJournal.to(fetchRequirements.to(mergeJournalAndManuscript.input(1))))
  .add(mergeJournalAndManuscript)
  .to(bundleContext)
  .to(validatorAgent)
  .to(cleanOutput)
  .to(respond);
