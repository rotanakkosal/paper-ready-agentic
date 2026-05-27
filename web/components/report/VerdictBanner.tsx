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
  { iconColor: string; titleColor: string; Icon: typeof CheckCircle2 }
> = {
  pass: {
    iconColor: "text-emerald-600",
    titleColor: "text-emerald-700",
    Icon: CheckCircle2,
  },
  needs_revision: {
    iconColor: "text-amber-600",
    titleColor: "text-amber-700",
    Icon: AlertTriangle,
  },
  fail: {
    iconColor: "text-rose-600",
    titleColor: "text-rose-700",
    Icon: XCircle,
  },
};

type Props = { summary: ValidationSummary };

export default function VerdictBanner({ summary }: Props) {
  const v = summary.verdict;
  const style = VERDICT_STYLE[v] ?? VERDICT_STYLE.needs_revision;
  const label = VERDICT_LABEL[v] ?? summary.verdict;
  const { Icon } = style;

  const pass = summary.pass_count ?? 0;
  const warn = summary.warn_count ?? 0;
  const fail = summary.fail_count ?? 0;
  const total = pass + warn + fail;

  const headline =
    total === 0
      ? label
      : v === "pass"
        ? `All ${total} requirements met`
        : v === "fail"
          ? `${fail} of ${total} failing`
          : `${warn + fail} of ${total} need attention`;

  const passPct = total ? (pass / total) * 100 : 0;
  const warnPct = total ? (warn / total) * 100 : 0;
  const failPct = total ? (fail / total) * 100 : 0;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 px-5 py-3 md:flex-row md:items-center md:gap-5">
        <div className="flex items-center gap-3 md:shrink-0">
          <Icon
            className={`h-7 w-7 shrink-0 ${style.iconColor}`}
            aria-hidden
          />
          <div className="min-w-0">
            <h2
              className={`text-base font-bold leading-tight ${style.titleColor}`}
            >
              {label}
            </h2>
            {total > 0 && (
              <p className="text-xs text-muted-foreground">{headline}</p>
            )}
          </div>
        </div>

        {total > 0 && (
          <>
            <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              {failPct > 0 && (
                <div
                  className="h-full bg-rose-500"
                  style={{ width: `${failPct}%` }}
                  aria-label={`${fail} failing`}
                />
              )}
              {warnPct > 0 && (
                <div
                  className="h-full bg-amber-500"
                  style={{ width: `${warnPct}%` }}
                  aria-label={`${warn} warnings`}
                />
              )}
              {passPct > 0 && (
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${passPct}%` }}
                  aria-label={`${pass} passing`}
                />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] md:shrink-0">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                <span className="font-semibold text-foreground">{fail}</span>
                <span className="uppercase tracking-wider text-muted-foreground">
                  fail
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                <span className="font-semibold text-foreground">{warn}</span>
                <span className="uppercase tracking-wider text-muted-foreground">
                  warn
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="font-semibold text-foreground">{pass}</span>
                <span className="uppercase tracking-wider text-muted-foreground">
                  pass
                </span>
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
