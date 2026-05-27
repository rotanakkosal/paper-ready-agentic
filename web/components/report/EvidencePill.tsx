import type { EvidenceFromGuideline } from "@/lib/types";

type Props = { evidence: EvidenceFromGuideline };

export default function EvidencePill({ evidence }: Props) {
  const { page, chunk_index_on_page, excerpt } = evidence;
  const trimmed =
    excerpt.length > 280 ? excerpt.slice(0, 280).trimEnd() + "…" : excerpt;

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
      <div className="text-xs font-medium text-gray-500">
        Guideline · p.{page} §{chunk_index_on_page}
      </div>
      <div className="mt-1 whitespace-pre-line italic leading-relaxed text-gray-700">
        “{trimmed}”
      </div>
    </div>
  );
}
