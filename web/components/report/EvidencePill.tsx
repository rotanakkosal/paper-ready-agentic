import { BookMarked } from "lucide-react";
import type { EvidenceFromGuideline } from "@/lib/types";

type Props = { evidence: EvidenceFromGuideline };

export default function EvidencePill({ evidence }: Props) {
  const { page, chunk_index_on_page, excerpt } = evidence;
  const trimmed =
    excerpt.length > 280 ? excerpt.slice(0, 280).trimEnd() + "…" : excerpt;

  return (
    <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <BookMarked className="h-3 w-3" />
        Guideline · p.{page} §{chunk_index_on_page}
      </div>
      <p className="whitespace-pre-line italic leading-relaxed text-foreground/80">
        “{trimmed}”
      </p>
    </div>
  );
}
