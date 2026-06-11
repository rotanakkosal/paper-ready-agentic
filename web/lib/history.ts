import type { ValidationReport } from "./types";

export type HistoryEntry = {
  id: string;
  createdAt: string; // ISO timestamp
  fileName?: string;
  fileSize?: number;
  journalId: string;
  journalName?: string;
  verdict?: string;
  report: ValidationReport;
};

const STORAGE_KEY = "paperready.history";
const MAX_ENTRIES = 50;

function isClient(): boolean {
  return typeof window !== "undefined";
}

export function getHistory(): HistoryEntry[] {
  if (!isClient()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getById(id: string): HistoryEntry | null {
  return getHistory().find((e) => e.id === id) ?? null;
}

export type NewEntryInput = Omit<HistoryEntry, "id" | "createdAt">;

export function saveToHistory(entry: NewEntryInput): HistoryEntry {
  if (!isClient()) {
    throw new Error("saveToHistory called on the server");
  }
  const full: HistoryEntry = {
    ...entry,
    id: (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).toString(),
    createdAt: new Date().toISOString(),
  };
  const history = [full, ...getHistory()];
  if (history.length > MAX_ENTRIES) history.length = MAX_ENTRIES;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // quota exceeded — drop oldest half and retry once
    const trimmed = history.slice(0, Math.floor(MAX_ENTRIES / 2));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // give up silently — the report is still returned to the caller
    }
  }
  return full;
}

export function deleteEntry(id: string): void {
  if (!isClient()) return;
  const next = getHistory().filter((e) => e.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearHistory(): void {
  if (!isClient()) return;
  localStorage.removeItem(STORAGE_KEY);
}

export function formatTimeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
