"use client";

import { useState } from "react";
import { Mail, Copy, Check } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Props = { coverLetter: string };

export default function CoverLetterCard({ coverLetter }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(coverLetter);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore — old browser without clipboard API
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
          <Mail className="h-5 w-5 text-foreground" />
        </div>
        <div className="flex-1 space-y-0.5">
          <CardTitle className="text-base leading-none">
            Suggested cover letter
          </CardTitle>
          <CardDescription className="text-xs">
            Draft starting point — review and personalize before sending
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={copy}
          className="shrink-0 gap-1.5"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-border bg-muted/30 p-4">
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
            {coverLetter}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
