import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  CircleDashed,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import EvidencePill from "./EvidencePill";
import type { Category } from "@/lib/types";

type Style = {
  border: string;
  iconColor: string;
  Icon: typeof CheckCircle2;
  badgeVariant: "default" | "secondary" | "destructive" | "outline";
};

const STATUS_STYLE: Record<string, Style> = {
  pass: {
    border: "border-l-emerald-500",
    iconColor: "text-emerald-600",
    Icon: CheckCircle2,
    badgeVariant: "secondary",
  },
  fail: {
    border: "border-l-rose-500",
    iconColor: "text-rose-600",
    Icon: XCircle,
    badgeVariant: "destructive",
  },
  warn: {
    border: "border-l-amber-500",
    iconColor: "text-amber-600",
    Icon: AlertTriangle,
    badgeVariant: "secondary",
  },
  pending: {
    border: "border-l-muted-foreground",
    iconColor: "text-muted-foreground",
    Icon: CircleDashed,
    badgeVariant: "outline",
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
    <Card className={`border-l-4 ${s.border}`}>
      <CardContent className="space-y-3 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${s.iconColor}`} />
            <h3 className="text-base font-semibold text-foreground">
              {category.title}
            </h3>
          </div>
          <Badge variant={s.badgeVariant} className="shrink-0 uppercase">
            {category.status}
          </Badge>
        </div>

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
          <ul className="space-y-2 border-t border-border pt-3">
            {items.map((it, i) => {
              const its = styleFor(it.status);
              const ItemIcon = its.Icon;
              return (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <ItemIcon
                    className={`mt-0.5 h-4 w-4 shrink-0 ${its.iconColor}`}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-foreground">
                      {it.label}
                    </div>
                    {it.detail && (
                      <p className="mt-0.5 text-muted-foreground">
                        {it.detail}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
