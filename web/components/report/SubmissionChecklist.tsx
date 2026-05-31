"use client";

import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  CircleDashed,
  ListChecks,
  BookOpen,
  ChevronRight,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { resolveChecklistItems } from "@/lib/checklist";
import type {
  ValidationReport,
  SubmissionChecklistItem,
} from "@/lib/types";

type IconStyle = {
  Icon: typeof CheckCircle2;
  color: string;
};

const STATUS_ICON: Record<string, IconStyle> = {
  pass: { Icon: CheckCircle2, color: "text-emerald-600" },
  fail: { Icon: XCircle, color: "text-rose-600" },
  warn: { Icon: AlertTriangle, color: "text-amber-600" },
  pending: { Icon: CircleDashed, color: "text-muted-foreground" },
};

type GroupKey = "fail" | "warn" | "pending" | "pass";

const GROUPS: {
  key: GroupKey;
  label: string;
  accent: string;
  dot: string;
}[] = [
  { key: "fail", label: "Must fix", accent: "text-rose-700", dot: "bg-rose-500" },
  { key: "warn", label: "Review", accent: "text-amber-700", dot: "bg-amber-500" },
  { key: "pending", label: "Pending", accent: "text-muted-foreground", dot: "bg-muted-foreground/60" },
  { key: "pass", label: "Passing", accent: "text-emerald-700", dot: "bg-emerald-500" },
];

const TOPIC_LABEL: Record<string, string> = {
  title_page: "Title page",
  references: "References",
  declarations: "Declarations",
  figures_tables: "Figures & tables",
  abstract_keywords: "Abstract & keywords",
  highlights_graphical_abstract: "Highlights & graphical abstract",
  data_availability: "Data availability",
  ethics: "Ethics",
  ai_disclosure: "AI disclosure",
  manuscript_structure: "Manuscript structure",
  submission_process: "Submission process",
  open_access_license: "Open access & license",
  other: "Other",
};

const TOPIC_ORDER = [
  "title_page",
  "abstract_keywords",
  "highlights_graphical_abstract",
  "references",
  "figures_tables",
  "declarations",
  "data_availability",
  "ethics",
  "ai_disclosure",
  "manuscript_structure",
  "open_access_license",
  "submission_process",
  "other",
];

function groupByTopic(
  rows: SubmissionChecklistItem[],
): { topic: string | null; items: SubmissionChecklistItem[] }[] {
  const byTopic = new Map<string, SubmissionChecklistItem[]>();
  for (const r of rows) {
    const key = r.topic ?? "__no_topic__";
    if (!byTopic.has(key)) byTopic.set(key, []);
    byTopic.get(key)!.push(r);
  }
  const order = [...TOPIC_ORDER, "__no_topic__"];
  return order
    .filter((t) => byTopic.has(t))
    .map((t) => ({
      topic: t === "__no_topic__" ? null : t,
      items: byTopic.get(t)!,
    }));
}

type Props = { report: ValidationReport };

export default function SubmissionChecklist({ report }: Props) {
  const items = resolveChecklistItems(report);
  if (items.length === 0) return null;

  // Defence-in-depth against agent-hallucinated page numbers: only trust a
  // guideline_page if that same page was actually retrieved from Qdrant during
  // this run (i.e. appears in some category's evidence_from_guideline). Pages
  // not present in any evidence array were almost certainly never seen by the
  // agent and shouldn't be cited as if they were.
  const verifiedPages = new Set<number>();
  for (const c of report.categories ?? []) {
    for (const e of c.evidence_from_guideline ?? []) {
      if (typeof e.page === "number" && e.page > 0) verifiedPages.add(e.page);
    }
  }

  const grouped: Record<GroupKey, SubmissionChecklistItem[]> = {
    fail: [],
    warn: [],
    pending: [],
    pass: [],
  };
  for (const row of items) {
    const key = (row.status in grouped ? row.status : "pending") as GroupKey;
    grouped[key].push(row);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <ListChecks className="h-7 w-7 shrink-0 text-foreground" aria-hidden />
        <div className="space-y-0.5">
          <CardTitle className="text-base leading-none">
            Submission checklist
          </CardTitle>
          <CardDescription className="text-xs">
            {items.length} requirement{items.length === 1 ? "" : "s"} for{" "}
            <span className="font-medium text-foreground">
              {report.journal?.name ?? "the target journal"}
            </span>
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {GROUPS.map((g) => {
          const rows = grouped[g.key];
          if (rows.length === 0) return null;
          const topicSubGroups = groupByTopic(rows);
          const showTopicHeaders =
            topicSubGroups.length > 1 ||
            (topicSubGroups.length === 1 && topicSubGroups[0].topic !== null);
          const sectionContent = topicSubGroups.map((sub) => (
            <div key={sub.topic ?? "__no_topic__"} className="space-y-0.5">
              {showTopicHeaders && (
                <div className="flex items-baseline gap-1.5 px-1 pt-1.5">
                  <span className="text-xs font-medium text-foreground/70">
                    {sub.topic ? TOPIC_LABEL[sub.topic] ?? sub.topic : "Other"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {sub.items.length}
                  </span>
                </div>
              )}
              <ul className="divide-y divide-border">
                {sub.items.map((row, i) => {
                  const s = STATUS_ICON[row.status] ?? STATUS_ICON.pending;
                  const { Icon } = s;
                  const isAction =
                    row.status === "fail" || row.status === "warn";
                  return (
                    <li
                      key={`${row.requirement}-${i}`}
                      className="flex items-start gap-2.5 px-1 py-2.5"
                    >
                      <Icon
                        className={`mt-0.5 h-4 w-4 shrink-0 ${s.color}`}
                        aria-hidden
                      />
                      <div className="flex-1 min-w-0">
                        <div
                          className={
                            "text-sm " +
                            (isAction
                              ? "font-medium text-foreground"
                              : "text-foreground/80")
                          }
                        >
                          {row.requirement}
                        </div>
                        {row.detail && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {row.detail}
                          </p>
                        )}
                        {row.guideline_page !== undefined &&
                          row.guideline_page > 0 &&
                          verifiedPages.has(row.guideline_page) && (
                            <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/80">
                              <BookOpen className="h-3 w-3" />
                              Guideline · p.{row.guideline_page}
                            </p>
                          )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ));

          if (g.key === "pass") {
            return (
              <details key={g.key} className="group/pass space-y-1">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-1 pb-1 [&::-webkit-details-marker]:hidden">
                  <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/70 transition-transform group-open/pass:rotate-90" />
                  <span className={`h-2 w-2 rounded-full ${g.dot}`} aria-hidden />
                  <h3
                    className={`text-[11px] font-semibold uppercase tracking-wider ${g.accent}`}
                  >
                    {g.label}
                  </h3>
                  <span className="text-[11px] text-muted-foreground">
                    · {rows.length}
                  </span>
                  <span className="text-[11px] text-muted-foreground/70 group-open/pass:hidden">
                    (click to expand)
                  </span>
                </summary>
                <div className="space-y-2">{sectionContent}</div>
              </details>
            );
          }

          return (
            <section key={g.key} className="space-y-1">
              <div className="flex items-center gap-2 px-1 pb-1">
                <span className={`h-2 w-2 rounded-full ${g.dot}`} aria-hidden />
                <h3
                  className={`text-[11px] font-semibold uppercase tracking-wider ${g.accent}`}
                >
                  {g.label}
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  · {rows.length}
                </span>
              </div>
              <div className="space-y-2">{sectionContent}</div>
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}
