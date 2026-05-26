import { workflow, trigger, node, merge, embeddings, languageModel, expr } from '@n8n/workflow-sdk';

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
const firstChunk = text.slice(0, 1500);
const firstLines = firstChunk.split('\\n').map(l => l.trim()).filter(Boolean);
const title = firstLines.find(l => l.length > 20 && !/^abstract\\b/i.test(l)) || null;

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
const doiRe = /10\\.\\d{4,9}\\/[-._;()\\/:A-Z0-9]+/gi;
const refsIdx = text.search(/\\bReferences\\b/i);
let refsBlock = refsIdx >= 0 ? text.slice(refsIdx).replace(/^References[\\s\\S]{0,10}/i, '') : '';
const rawRefs = refsBlock
  .split(/\\n\\s*(?:\\[\\d+\\]|\\d+\\.)\\s+/)
  .map(s => s.trim())
  .filter(s => s.length > 20)
  .slice(0, 100);
const references = rawRefs.map(raw => {
  const dm = raw.match(doiRe);
  return { raw: raw.slice(0, 300), doi: dm ? dm[0] : null };
});
const allDois = text.match(doiRe) || [];

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

const BUNDLE_CONTEXT_JS = `// Bundle Context — runs after the Qdrant retrieval, before the agent.
//
// Input:  $input.all() = up to 5 chunk items from "Search Guideline Chunks"
//         (each item.json has { pageContent | document.pageContent, metadata, score })
//         $('Merge').first().json = manuscript + journal metadata combined
//
// Output: a single item bundling everything the agent needs:
//           { manuscript, journal, guideline_chunks: [{excerpt, page, chunk_index_on_page, score}] }

const chunks = $input.all().map(item => {
  const j = item.json || {};
  const doc = j.document || {};
  const md = j.metadata || doc.metadata || {};
  return {
    excerpt: j.pageContent || doc.pageContent || j.text || '',
    page: md.page ?? null,
    chunk_index_on_page: md.chunk_index_on_page ?? null,
    score: j.score ?? null
  };
});

const m = $('Merge').first().json;
const manuscript = m.manuscript || null;
const journal = {
  journal_id: m.journal_id ?? null,
  name: m.name ?? null,
  required_reference_style: m.required_reference_style ?? null,
  issn: m.issn ?? null,
  reputation_flag: m.reputation_flag ?? null,
  url: m.url ?? null
};

return [{ json: { manuscript, journal, guideline_chunks: chunks } }];
`;

const VALIDATOR_SYSTEM_MESSAGE = `You are PaperReady, a pre-submission validator for academic manuscripts.

You receive three inputs in the user message:
  - manuscript: structured fields parsed from the user's PDF (title, authors/ORCIDs,
    abstract, sections_detected, declarations, references[], stats)
  - journal: target journal metadata (journal_id, name, required_reference_style,
    issn, reputation_flag, url)
  - guideline_chunks: top-5 relevant passages already retrieved from the journal's
    official author guideline, each with {excerpt, page, chunk_index_on_page, score}

Produce a ValidationReport JSON with five categories:
  1. reference_style  - does manuscript.references appear to follow
                        journal.required_reference_style? Inspect the first 5
                        references.raw values for numbering, ordering, punctuation.
  2. doi_verification - list DOIs found in manuscript.references[] (status "pending"
                        - Crossref check is not yet wired in this draft).
  3. title_page       - what does the guideline (guideline_chunks) require for title,
                        authors, affiliations, corresponding author, ORCIDs? What is
                        present in manuscript.title / manuscript.orcids_found /
                        manuscript.sections_detected?
  4. declarations     - does the guideline require COI / funding / data-availability /
                        ethics statements? Are they present in manuscript.declarations?
  5. legitimacy       - base on journal.reputation_flag if set; otherwise status
                        "pending" (DOAJ lookup is not yet wired).

Rules:
  - Cite guideline_chunks by {page, chunk_index_on_page} in evidence_from_guideline.
  - Never fabricate citations. If no chunk addresses a topic, write
    "guideline silent on this" and use status "warn" or "pending".
  - Output ONLY the ValidationReport JSON. No prose, no markdown fences.

ValidationReport JSON shape:
{
  "journal": { "journal_id": "...", "name": "...", "required_reference_style": "..." },
  "summary": { "verdict": "pass|needs_revision|fail",
               "pass_count": 0, "warn_count": 0, "fail_count": 0 },
  "categories": [
    {
      "id": "reference_style|doi_verification|title_page|declarations|legitimacy",
      "title": "...",
      "status": "pass|warn|fail|pending",
      "explanation": "...",
      "evidence_from_guideline": [
        { "page": 4, "chunk_index_on_page": 2, "excerpt": "..." }
      ],
      "items": [ { "label": "...", "status": "...", "detail": "..." } ]
    }
  ]
}`;

const VALIDATOR_USER_PROMPT = `=Validate the manuscript below against the target journal.

MANUSCRIPT:
{{ JSON.stringify($json.manuscript, null, 2) }}

TARGET JOURNAL:
{{ JSON.stringify($json.journal, null, 2) }}

RETRIEVED GUIDELINE PASSAGES (top-5 from the journal's official author guideline):
{{ JSON.stringify($json.guideline_chunks, null, 2) }}

Produce a ValidationReport JSON exactly matching the schema in your system message. Output JSON only.`;

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

const geminiEmbeddings = embeddings({
  type: '@n8n/n8n-nodes-langchain.embeddingsGoogleGemini',
  version: 1,
  config: {
    name: 'Gemini Embeddings',
    parameters: {},
    position: [976, 336]
  }
});

const searchGuidelineChunks = node({
  type: '@n8n/n8n-nodes-langchain.vectorStoreQdrant',
  version: 1.3,
  config: {
    name: 'Search Guideline Chunks',
    parameters: {
      mode: 'load',
      qdrantCollection: {
        __rl: true,
        mode: 'list',
        value: 'guideline_chunks',
        cachedResultName: 'guideline_chunks'
      },
      prompt: expr('{{ $json.manuscript.abstract || "reference style, title page, authors, affiliations, declarations" }}'),
      topK: 5,
      options: {
        searchFilterJson: expr('{"must":[{"key":"metadata.journal_id","match":{"value":"{{ $json.journal_id }}"}}]}'),
        contentPayloadKey: 'text'
      }
    },
    subnodes: { embedding: geminiEmbeddings },
    position: [896, 112]
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
    position: [1248, 112]
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
        maxOutputTokens: 4096
      }
    },
    position: [1552, 336]
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
        maxIterations: 4
      }
    },
    subnodes: { model: geminiChatModel },
    position: [1472, 112]
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
    position: [1824, 112]
  }
});

export default workflow('paperready-validate', 'PaperReady — Validate')
  .add(webhookTrigger)
  .to(extractPdf.to(parseManuscript.to(mergeJournalAndManuscript.input(0))))
  .add(webhookTrigger)
  .to(fetchJournal.to(mergeJournalAndManuscript.input(1)))
  .add(mergeJournalAndManuscript)
  .to(searchGuidelineChunks)
  .to(bundleContext)
  .to(validatorAgent)
  .to(respond);
