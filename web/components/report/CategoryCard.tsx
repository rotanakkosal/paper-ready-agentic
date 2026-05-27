import type { Category } from "@/lib/types";
import EvidencePill from "./EvidencePill";

type Style = { border: string; badge: string; icon: string };

const STATUS_STYLE: Record<string, Style> = {
  pass: {
    border: "border-emerald-500",
    badge: "bg-emerald-100 text-emerald-800",
    icon: "✓",
  },
  fail: {
    border: "border-rose-500",
    badge: "bg-rose-100 text-rose-800",
    icon: "✗",
  },
  warn: {
    border: "border-amber-500",
    badge: "bg-amber-100 text-amber-800",
    icon: "⚠",
  },
  pending: {
    border: "border-gray-400",
    badge: "bg-gray-100 text-gray-700",
    icon: "⏳",
  },
};

function styleFor(status: string): Style {
  return STATUS_STYLE[status] ?? STATUS_STYLE.pending;
}

type Props = { category: Category };

export default function CategoryCard({ category }: Props) {
  const s = styleFor(category.status);
  const evidence = category.evidence_from_guideline ?? [];
  const items = category.items ?? [];

  return (
    <article
      className={`rounded-lg border-l-4 bg-white shadow-sm ${s.border}`}
    >
      <div className="p-5">
        <header className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-900">
            <span className="mr-2" aria-hidden="true">
              {s.icon}
            </span>
            {category.title}
          </h3>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${s.badge}`}
          >
            {category.status}
          </span>
        </header>

        {category.explanation && (
          <p className="mt-2 text-sm leading-relaxed text-gray-700">
            {category.explanation}
          </p>
        )}

        {evidence.length > 0 && (
          <div className="mt-3 space-y-2">
            {evidence.map((e, i) => (
              <EvidencePill key={i} evidence={e} />
            ))}
          </div>
        )}

        {items.length > 0 && (
          <ul className="mt-4 space-y-2 border-t border-gray-100 pt-3">
            {items.map((it, i) => {
              const its = styleFor(it.status);
              return (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span
                    className={`mt-0.5 inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${its.badge}`}
                  >
                    {it.status}
                  </span>
                  <div>
                    <div className="font-medium text-gray-800">{it.label}</div>
                    {it.detail && (
                      <p className="mt-0.5 text-gray-600">{it.detail}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </article>
  );
}
