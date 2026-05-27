import type { ValidationSummary } from "@/lib/types";

const VERDICT_LABEL: Record<string, string> = {
  pass: "Ready to submit",
  needs_revision: "Needs revision",
  fail: "Major issues",
};

const VERDICT_STYLE: Record<string, string> = {
  pass: "border-emerald-500 bg-emerald-50",
  needs_revision: "border-amber-500 bg-amber-50",
  fail: "border-rose-500 bg-rose-50",
};

type Props = { summary: ValidationSummary };

export default function VerdictBanner({ summary }: Props) {
  const label = VERDICT_LABEL[summary.verdict] ?? summary.verdict;
  const style =
    VERDICT_STYLE[summary.verdict] ?? "border-gray-400 bg-gray-50";

  return (
    <div className={`rounded-lg border-l-4 px-5 py-4 ${style}`}>
      <div className="text-xs font-medium uppercase tracking-wider text-gray-600">
        Verdict
      </div>
      <div className="text-xl font-semibold text-gray-900">{label}</div>
      <div className="mt-1 text-sm text-gray-700">
        <span className="font-medium text-emerald-700">
          {summary.pass_count} pass
        </span>
        {"  ·  "}
        <span className="font-medium text-amber-700">
          {summary.warn_count} warn
        </span>
        {"  ·  "}
        <span className="font-medium text-rose-700">
          {summary.fail_count} fail
        </span>
      </div>
    </div>
  );
}
