import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ValidationSummary } from "@/lib/types";

const VERDICT_LABEL: Record<string, string> = {
  pass: "Ready to submit",
  needs_revision: "Needs revision",
  fail: "Major issues",
};

const VERDICT_STYLE: Record<
  string,
  { iconBg: string; iconBorder: string; iconColor: string; Icon: typeof CheckCircle2 }
> = {
  pass: {
    iconBg: "bg-emerald-50",
    iconBorder: "border-emerald-500/30",
    iconColor: "text-emerald-600",
    Icon: CheckCircle2,
  },
  needs_revision: {
    iconBg: "bg-amber-50",
    iconBorder: "border-amber-500/30",
    iconColor: "text-amber-600",
    Icon: AlertTriangle,
  },
  fail: {
    iconBg: "bg-rose-50",
    iconBorder: "border-rose-500/30",
    iconColor: "text-rose-600",
    Icon: XCircle,
  },
};

type Props = { summary: ValidationSummary };

export default function VerdictBanner({ summary }: Props) {
  const v = summary.verdict;
  const style = VERDICT_STYLE[v] ?? VERDICT_STYLE.needs_revision;
  const label = VERDICT_LABEL[v] ?? summary.verdict;
  const { Icon } = style;

  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border ${style.iconBorder} ${style.iconBg}`}
        >
          <Icon className={`h-6 w-6 ${style.iconColor}`} aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Verdict
          </p>
          <h2 className="text-xl font-bold leading-tight text-foreground">
            {label}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="font-semibold text-emerald-700">
                {summary.pass_count}
              </span>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                pass
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="font-semibold text-amber-700">
                {summary.warn_count}
              </span>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                warn
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <XCircle className="h-4 w-4 text-rose-600" />
              <span className="font-semibold text-rose-700">
                {summary.fail_count}
              </span>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                fail
              </span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
