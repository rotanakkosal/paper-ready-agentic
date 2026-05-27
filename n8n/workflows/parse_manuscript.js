// Manuscript parser — runs inside the n8n "Code" node of the validate workflow.
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
  /^abstract\b/i,
  /^published\s+as/i,
  /^preprint\b/i,
  /^under\s+review/i,
  /^arxiv:/i,
  /^manuscript\s+received/i,
  /^\d{4}\s+ieee/i,
  /^©\s*\d{4}/i,
];
const firstChunk = text.slice(0, 1500);
const firstLines = firstChunk.split('\n').map(l => l.trim()).filter(Boolean);
const title = firstLines.find(l =>
  l.length > 20 && !SKIP_HEADER_PATTERNS.some(p => p.test(l))
) || null;

// --- ORCIDs ---
const orcidRe = /\d{4}-\d{4}-\d{4}-\d{3}[\dX]/g;
const orcids = text.match(orcidRe) || [];

// --- Abstract: text between "Abstract" and the next major heading ---
const absMatch = text.match(/Abstract[\s\-:.]+([\s\S]{50,2500}?)(?=Keywords|Introduction|1\.\s|I\.\s|\n\n\n)/i);
const abstract = absMatch ? absMatch[1].trim() : null;

// --- Sections: capitalised heading-like lines ---
const sectionRe = /^(?:\d+\.?\s+)?([A-Z][A-Za-z ]{3,40})$/gm;
const sectionsSet = new Set();
let mSec;
while ((mSec = sectionRe.exec(text)) !== null) sectionsSet.add(mSec[1].trim());
const sections_detected = Array.from(sectionsSet);

// --- Declarations: simple substring probes ---
const lower = text.toLowerCase();
const declarations = {
  conflict_of_interest: /conflict[s]? of interest|competing interest/.test(lower) ? 'found' : 'missing',
  funding: /\bfunding\b|funded by|\bgrant\b/.test(lower) ? 'found' : 'missing',
  data_availability: /data availability|data sharing/.test(lower) ? 'found' : 'missing',
  ethics: /ethics statement|ethical (review|approval)|irb approval/.test(lower) ? 'found' : 'missing'
};

// --- References + DOIs ---
// DOI shape: 10.NNNN/<rest>. We require at least one slash + 3 chars after it
// so truncated fragments like "10.1" don't get classified as DOIs and fed
// to crossref_verify_doi (which would 404 and crash the agent).
const doiRe = /10\.\d{4,9}\/[-._;()\/:A-Z0-9]{3,}/gi;
function normalizeDoi(d) {
  // Strip trailing punctuation that often leaks in from reference text
  return d.replace(/[.,;)\]>]+$/, '');
}
const refsIdx = text.search(/\bReferences\b/i);
let refsBlock = refsIdx >= 0 ? text.slice(refsIdx).replace(/^References[\s\S]{0,10}/i, '') : '';
const rawRefs = refsBlock
  .split(/\n\s*(?:\[\d+\]|\d+\.)\s+/)
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
