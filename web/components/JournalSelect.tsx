"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Journal, JournalListResponse } from "@/lib/types";

type Props = {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
};

export default function JournalSelect({ value, onChange, disabled }: Props) {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/journals");
        const data = (await res.json()) as JournalListResponse | { error: string };
        if (cancelled) return;
        if ("error" in data) {
          setErrorMessage(data.error);
          setState("error");
          return;
        }
        const sorted = [...(data.journals ?? [])].sort((a, b) =>
          (a.name ?? "").localeCompare(b.name ?? "", undefined, {
            sensitivity: "base",
          }),
        );
        setJournals(sorted);
        setState("ready");
      } catch (e) {
        if (cancelled) return;
        setErrorMessage((e as Error).message);
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return (
      <p className="text-sm text-muted-foreground">Loading journals…</p>
    );
  }
  if (state === "error") {
    return (
      <p className="text-sm text-destructive">
        Could not load journals: {errorMessage ?? "unknown error"}
      </p>
    );
  }

  return (
    <Select
      value={value || undefined}
      onValueChange={(v) => onChange(v ?? "")}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a journal" />
      </SelectTrigger>
      <SelectContent>
        {journals.map((j) => (
          <SelectItem
            key={j.journal_id}
            value={j.journal_id}
            className="py-2.5 pl-3 pr-9"
          >
            {j.name}
            {j.required_reference_style ? (
              <span className="text-muted-foreground">
                {" "}
                · {j.required_reference_style}
              </span>
            ) : null}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
