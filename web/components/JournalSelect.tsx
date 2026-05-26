"use client";

import { useEffect, useState } from "react";
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
        setJournals(data.journals ?? []);
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
    return <div className="text-sm text-gray-500">Loading journals…</div>;
  }
  if (state === "error") {
    return (
      <div className="text-sm text-rose-700">
        Could not load journals: {errorMessage ?? "unknown error"}
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-gray-100"
    >
      <option value="">— Select a journal —</option>
      {journals.map((j) => (
        <option key={j.journal_id} value={j.journal_id}>
          {j.name}
          {j.required_reference_style ? ` (${j.required_reference_style})` : ""}
        </option>
      ))}
    </select>
  );
}
