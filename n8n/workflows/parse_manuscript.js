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
const firstChunk = text.slice(0, 1500);
const firstLines = firstChunk.split('\n').map(l => l.trim()).filter(Boolean);
const title = firstLines.find(l => l.length > 20 && !/^abstract\b/i.test(l)) || null;

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
const doiRe = /10\.\d{4,9}\/[-._;()\/:A-Z0-9]+/gi;
const refsIdx = text.search(/\bReferences\b/i);
let refsBlock = refsIdx >= 0 ? text.slice(refsIdx).replace(/^References[\s\S]{0,10}/i, '') : '';
const rawRefs = refsBlock
  .split(/\n\s*(?:\[\d+\]|\d+\.)\s+/)
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
