// Real captured output from n8n execution #85 (ViT manuscript on TPAMI,
// 2026-05-27). Used by the page when ?demo=1 is in the URL so we can
// validate the UI rendering without burning Gemini API quota.

import type { ValidationReport } from "./types";

export const DEMO_REPORT: ValidationReport = {
  journal: {
    journal_id: "tpami",
    name: "IEEE Transactions on Pattern Analysis and Machine Intelligence",
    required_reference_style: "IEEE",
  },
  summary: {
    verdict: "needs_revision",
    pass_count: 2,
    warn_count: 1,
    fail_count: 2,
  },
  categories: [
    {
      id: "reference_style",
      title: "Reference Style Validation (IEEE)",
      status: "fail",
      explanation:
        "The manuscript's references do not adhere to the IEEE style guidelines. Issues include missing sequential numbering, incorrect author formatting (initials first, then last name), lack of quotation marks for article titles, non-italicized and non-abbreviated journal names, and improper formatting for conference proceedings (e.g., missing 'in Proc.'). Multiple references are also concatenated in single entries.",
      evidence_from_guideline: [],
      items: [
        {
          label: "Reference 1",
          status: "fail",
          detail:
            "Does not follow IEEE format for authors, title, or conference proceedings.",
        },
        {
          label: "Reference 2",
          status: "fail",
          detail:
            "Contains multiple references and does not follow IEEE format for authors, journal title, or overall structure.",
        },
        {
          label: "Reference 3",
          status: "fail",
          detail:
            "Contains multiple references and does not follow IEEE format for authors, title, or conference proceedings.",
        },
      ],
    },
    {
      id: "doi_verification",
      title: "DOI Verification",
      status: "pass",
      explanation:
        "The sampled DOIs from the manuscript's references were successfully verified on Crossref.",
      evidence_from_guideline: [],
      items: [
        {
          label: "DOI: 10.1137/0330046",
          status: "pass",
          detail: "Successfully resolved on Crossref.",
        },
      ],
    },
    {
      id: "title_page",
      title: "Title Page Requirements",
      status: "warn",
      explanation:
        "The manuscript is missing ORCIDs for authors, which are required by IEEE publications. While author names are present, explicit affiliations and corresponding author details are not clearly structured as per typical title page requirements. The guideline also mentions author biographies and photos.",
      evidence_from_guideline: [
        {
          page: 13,
          chunk_index_on_page: 0,
          excerpt:
            "Authors without an ORCID in their ScholarOne account will be prompted to provide one during submission. Learn more about ORCID and sign up for an ORCID today.",
        },
        {
          page: 12,
          chunk_index_on_page: 2,
          excerpt:
            "ScholarOne will prompt you to enter an Open Researcher and Contributor ID (ORCID), which is required by all IEEE publications.",
        },
        {
          page: 5,
          chunk_index_on_page: 2,
          excerpt:
            "[Full name] is [role] at [institution] at [city, state, postal code, country]. Contact [him/her] at [website or email address].",
        },
        {
          page: 23,
          chunk_index_on_page: 0,
          excerpt:
            "biography of each author photos of authors (for full-length journal articles)",
        },
      ],
      items: [
        {
          label: "ORCIDs",
          status: "fail",
          detail:
            "No ORCIDs were found in the manuscript, but they are required by the journal.",
        },
        {
          label: "Author Affiliations",
          status: "warn",
          detail:
            "Explicit author affiliations and corresponding author details are not clearly presented.",
        },
      ],
    },
    {
      id: "declarations",
      title: "Declarations (COI, Funding, Data, Ethics)",
      status: "fail",
      explanation:
        "The manuscript explicitly states that conflict of interest, funding, data availability, and ethics declarations are 'missing'. The journal guidelines indicate requirements for conflict of interest statements and human/animal research disclosures.",
      evidence_from_guideline: [
        {
          page: 16,
          chunk_index_on_page: 0,
          excerpt:
            "Conflict of Interest is defined in IEEE Policies, Section 9.9 – Conflict of Interest.",
        },
        {
          page: 19,
          chunk_index_on_page: 2,
          excerpt: "Human and Animal Research Disclosure",
        },
      ],
      items: [
        {
          label: "Conflict of Interest",
          status: "fail",
          detail: "Declaration is missing, but required by journal policy.",
        },
        {
          label: "Funding",
          status: "fail",
          detail: "Declaration is missing.",
        },
        {
          label: "Data Availability",
          status: "fail",
          detail: "Declaration is missing.",
        },
        {
          label: "Ethics",
          status: "fail",
          detail:
            "Declaration is missing, and human/animal research disclosure may be required.",
        },
      ],
    },
    {
      id: "legitimacy",
      title: "Journal Legitimacy",
      status: "pass",
      explanation:
        "The journal 'IEEE Transactions on Pattern Analysis and Machine Intelligence' is a well-established publication. While it was not found in the Directory of Open Access Journals (DOAJ), this does not indicate illegitimacy, as many reputable journals are not open access. No negative reputation flags were identified.",
      evidence_from_guideline: [],
      items: [
        {
          label: "DOAJ Listing",
          status: "warn",
          detail:
            "Journal not found in DOAJ. This is not a definitive indicator of illegitimacy, as many reputable journals are not open access.",
        },
        {
          label: "Reputation Flag",
          status: "pass",
          detail:
            "No negative reputation flags were associated with the journal.",
        },
      ],
    },
  ],
  cover_letter:
    'Dear Editor-in-Chief,\n\nWe are pleased to submit our manuscript titled "AN IMAGE IS WORTH 16X16 WORDS:" for consideration in IEEE Transactions on Pattern Analysis and Machine Intelligence. In this work, we present a pure transformer architecture applied directly to sequences of image patches, demonstrating its effectiveness in image classification tasks. Our Vision Transformer (ViT) achieves excellent results compared to state-of-the-art convolutional networks, requiring substantially fewer computational resources when pre-trained on large datasets and transferred to various benchmarks.\n\nOur research offers a novel approach to computer vision by leveraging transformer architectures, which we believe aligns well with the journal\'s scope focusing on pattern analysis and machine intelligence. We hope our findings will be of significant interest to your readership.\n\nSincerely,\nThe authors',
  submission_checklist: [
    {
      requirement: "References follow IEEE numbered style",
      status: "fail",
      detail:
        "First three references use author-year style with no quotation marks on titles and unabbreviated journal names — not IEEE-compliant.",
      guideline_page: 14,
    },
    {
      requirement: "ORCIDs provided for all authors",
      status: "fail",
      detail:
        "No ORCIDs found in the manuscript. IEEE publications require ORCID for all authors via ScholarOne.",
      guideline_page: 12,
    },
    {
      requirement: "Conflict of Interest declaration included",
      status: "fail",
      detail:
        "No COI statement detected. Required by IEEE Policies, Section 9.9.",
      guideline_page: 16,
    },
    {
      requirement: "Funding sources declared",
      status: "fail",
      detail: "No funding statement detected in the manuscript.",
    },
    {
      requirement: "Data Availability statement included",
      status: "fail",
      detail: "No data availability statement detected.",
    },
    {
      requirement: "Ethics / Human and Animal Research disclosure",
      status: "fail",
      detail:
        "No ethics statement detected. Required if research involved human or animal subjects.",
      guideline_page: 19,
    },
    {
      requirement: "Title page lists all author affiliations clearly",
      status: "warn",
      detail:
        "Author names present, but explicit affiliations and corresponding-author contact details are not clearly structured.",
      guideline_page: 5,
    },
    {
      requirement: "Journal is indexed in DOAJ or has no reputation concerns",
      status: "warn",
      detail:
        "Not listed in DOAJ. Not a definitive concern — many reputable journals are not open access.",
    },
    {
      requirement: "All DOIs in references resolve via Crossref",
      status: "pass",
      detail:
        "Sampled DOI (10.1137/0330046) successfully resolved on Crossref.",
    },
    {
      requirement: "No negative reputation flags on the target journal",
      status: "pass",
      detail:
        "No reputation flags associated with IEEE Transactions on Pattern Analysis and Machine Intelligence.",
    },
    {
      requirement: "Manuscript submitted via the ScholarOne portal",
      status: "pending",
      detail:
        "Cannot be verified from the manuscript alone — verify before final submission.",
    },
  ],
};
