"use client";

import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  CircleDashed,
} from "lucide-react";
import type { Category } from "@/lib/types";

const SHORT_LABEL: Record<string, string> = {
  reference_style: "References",
  doi_verification: "DOIs",
  title_page: "Title page",
  declarations: "Declarations",
  legitimacy: "Legitimacy",
};

const STATUS_STYLE: Record<
  string,
  { Icon: typeof CheckCircle2; iconColor: string; ring: string }
> = {
  pass: {
    Icon: CheckCircle2,
    iconColor: "text-emerald-600",
    ring: "hover:border-emerald-500/40",
  },
  fail: {
    Icon: XCircle,
    iconColor: "text-rose-600",
    ring: "hover:border-rose-500/40",
  },
  warn: {
    Icon: AlertTriangle,
    iconColor: "text-amber-600",
    ring: "hover:border-amber-500/40",
  },
  pending: {
    Icon: CircleDashed,
    iconColor: "text-muted-foreground",
    ring: "hover:border-foreground/30",
  },
};

type Props = { categories: Category[] };

export default function CategoryToc({ categories }: Props) {
  if (!categories.length) return null;

  function jumpTo(id: string) {
    const el = document.getElementById(`cat-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex flex-wrap gap-2 px-1">
      {categories.map((c) => {
        const s = STATUS_STYLE[c.status] ?? STATUS_STYLE.pending;
        const { Icon } = s;
        const label = SHORT_LABEL[c.id] ?? c.title;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => jumpTo(c.id)}
            className={
              "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground shadow-sm transition-colors " +
              s.ring
            }
            aria-label={`Jump to ${label} (${c.status})`}
          >
            <Icon className={`h-3.5 w-3.5 ${s.iconColor}`} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
