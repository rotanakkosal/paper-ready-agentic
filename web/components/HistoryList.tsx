"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { History as HistoryIcon, ChevronRight, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  formatTimeAgo,
  getHistory,
  clearHistory,
  deleteEntry,
  type HistoryEntry,
} from "@/lib/history";

function PdfIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M14 2v6h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <text
        x="12"
        y="18"
        textAnchor="middle"
        fontSize="5.5"
        fontWeight="700"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fill="currentColor"
      >
        PDF
      </text>
    </svg>
  );
}

const VERDICT_LABEL: Record<string, string> = {
  pass: "Ready",
  needs_revision: "Revise",
  fail: "Major issues",
};

const VERDICT_STYLE: Record<string, string> = {
  pass: "bg-emerald-100 text-emerald-700",
  needs_revision: "bg-amber-100 text-amber-800",
  fail: "bg-rose-100 text-rose-700",
};

export default function HistoryList() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setEntries(getHistory());
    setHydrated(true);
  }, []);

  function onClear() {
    clearHistory();
    setEntries([]);
  }

  function onDelete(id: string) {
    deleteEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  // While hydrating, render the same shell shape so the layout doesn't jump.
  if (!hydrated) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
            <HistoryIcon className="h-5 w-5 text-foreground" />
          </div>
          <div className="space-y-0.5">
            <CardTitle className="text-base">Past validations</CardTitle>
            <CardDescription className="text-xs">Loading…</CardDescription>
          </div>
        </CardHeader>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
            <HistoryIcon className="h-5 w-5 text-foreground" />
          </div>
          <div className="space-y-0.5">
            <CardTitle className="text-base">Past validations</CardTitle>
            <CardDescription className="text-xs">
              Your history will appear here after your first run
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex min-h-[260px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-accent/20 text-center">
            <HistoryIcon className="h-7 w-7 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">
              No past validations yet
            </p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Submit a manuscript and the result will be saved here
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
          <HistoryIcon className="h-5 w-5 text-foreground" />
        </div>
        <div className="flex-1 space-y-0.5">
          <CardTitle className="text-base">Past validations</CardTitle>
          <CardDescription className="text-xs">
            {entries.length} {entries.length === 1 ? "run" : "runs"} · stored
            in your browser
          </CardDescription>
        </div>
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 gap-1.5 text-muted-foreground hover:text-foreground"
                aria-label="Clear all history"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear all past validations?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes all {entries.length}{" "}
                {entries.length === 1 ? "run" : "runs"} from this browser. The
                action can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onClear}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Clear all
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {entries.map((e) => {
            const verdict = e.verdict ?? "needs_revision";
            const label = VERDICT_LABEL[verdict] ?? verdict;
            const style =
              VERDICT_STYLE[verdict] ?? VERDICT_STYLE.needs_revision;
            return (
              <li key={e.id}>
                <Link
                  href={`/report/${e.id}`}
                  className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <PdfIcon className="h-5 w-5 shrink-0 text-rose-600/80" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {e.fileName ?? "Untitled manuscript"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {e.journalName ?? e.journalId}
                      {" · "}
                      {formatTimeAgo(e.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${style}`}
                  >
                    {label}
                  </span>
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.preventDefault();
                      ev.stopPropagation();
                      onDelete(e.id);
                    }}
                    aria-label={`Delete ${e.fileName ?? "this entry"}`}
                    className="shrink-0 rounded-md p-1 text-muted-foreground/40 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
