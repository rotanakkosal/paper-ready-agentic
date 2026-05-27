import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  CircleDashed,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import EvidencePill from "./EvidencePill";
import type { Category } from "@/lib/types";

type Style = {
  iconBg: string;
  iconBorder: string;
  iconColor: string;
  Icon: typeof CheckCircle2;
  badgeVariant: "default" | "secondary" | "destructive" | "outline";
  badgeClass: string;
};

const STATUS_STYLE: Record<string, Style> = {
  pass: {
    iconBg: "bg-emerald-50",
    iconBorder: "border-emerald-500/30",
    iconColor: "text-emerald-600",
    Icon: CheckCircle2,
    badgeVariant: "secondary",
    badgeClass: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  },
  fail: {
    iconBg: "bg-rose-50",
    iconBorder: "border-rose-500/30",
    iconColor: "text-rose-600",
    Icon: XCircle,
    badgeVariant: "secondary",
    badgeClass: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  },
  warn: {
    iconBg: "bg-amber-50",
    iconBorder: "border-amber-500/30",
    iconColor: "text-amber-600",
    Icon: AlertTriangle,
    badgeVariant: "secondary",
    badgeClass: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  },
  pending: {
    iconBg: "bg-muted/40",
    iconBorder: "border-border",
    iconColor: "text-muted-foreground",
    Icon: CircleDashed,
    badgeVariant: "outline",
    badgeClass: "",
  },
};

function styleFor(status: string): Style {
  return STATUS_STYLE[status] ?? STATUS_STYLE.pending;
}

type Props = { category: Category };

export default function CategoryCard({ category }: Props) {
  const s = styleFor(category.status);
  const { Icon } = s;
  const evidence = category.evidence_from_guideline ?? [];
  const items = category.items ?? [];

  return (
    <Card id={`cat-${category.id}`} className="scroll-mt-20">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${s.iconBorder} ${s.iconBg}`}
        >
          <Icon className={`h-5 w-5 ${s.iconColor}`} aria-hidden />
        </div>
        <CardTitle className="flex-1 text-base leading-tight">
          {category.title}
        </CardTitle>
        <Badge
          variant={s.badgeVariant}
          className={`shrink-0 uppercase ${s.badgeClass}`}
        >
          {category.status}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        {category.explanation && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {category.explanation}
          </p>
        )}

        {evidence.length > 0 && (
          <div className="space-y-2">
            {evidence.map((e, i) => (
              <EvidencePill key={i} evidence={e} />
            ))}
          </div>
        )}

        {items.length > 0 && (
          <div className="overflow-hidden rounded-md border border-border bg-muted/20">
            <p className="border-b border-border bg-muted/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {items.length} item{items.length === 1 ? "" : "s"} checked
            </p>
            <ul className="divide-y divide-border">
              {items.map((it, i) => {
                const its = styleFor(it.status);
                const ItemIcon = its.Icon;
                return (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 px-3 py-2.5 text-sm"
                  >
                    <ItemIcon
                      className={`mt-0.5 h-4 w-4 shrink-0 ${its.iconColor}`}
                      aria-hidden
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground">
                        {it.label}
                      </div>
                      {it.detail && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {it.detail}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
