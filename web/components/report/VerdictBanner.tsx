import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ValidationSummary } from "@/lib/types";

type Verdict = "pass" | "needs_revision" | "fail" | string;

const VERDICT_LABEL: Record<string, string> = {
  pass: "Ready to submit",
  needs_revision: "Needs revision",
  fail: "Major issues",
};

const VERDICT_STYLE: Record<
  string,
  { border: string; bg: string; iconColor: string; Icon: typeof CheckCircle2 }
> = {
  pass: {
    border: "border-l-emerald-500",
    bg: "bg-emerald-50/40",
    iconColor: "text-emerald-600",
    Icon: CheckCircle2,
  },
  needs_revision: {
    border: "border-l-amber-500",
    bg: "bg-amber-50/40",
    iconColor: "text-amber-600",
    Icon: AlertTriangle,
  },
  fail: {
    border: "border-l-rose-500",
    bg: "bg-rose-50/40",
    iconColor: "text-rose-600",
    Icon: XCircle,
  },
};

type Props = { summary: ValidationSummary };

export default function VerdictBanner({ summary }: Props) {
  const v: Verdict = summary.verdict;
  const style = VERDICT_STYLE[v] ?? VERDICT_STYLE.needs_revision;
  const label = VERDICT_LABEL[v] ?? summary.verdict;
  const { Icon } = style;

  return (
    <Card className={`border-l-4 ${style.border} ${style.bg}`}>
      <CardContent className="flex items-center gap-4 py-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-card">
          <Icon className={`h-6 w-6 ${style.iconColor}`} />
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Verdict
          </p>
          <p className="text-xl font-semibold text-foreground">{label}</p>
        </div>
        <div className="hidden gap-4 text-sm sm:flex">
          <div className="text-right">
            <p className="text-lg font-semibold text-emerald-700">
              {summary.pass_count}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              pass
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-amber-700">
              {summary.warn_count}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              warn
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-rose-700">
              {summary.fail_count}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              fail
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
