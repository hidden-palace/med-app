"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ShieldCheck, Download } from "lucide-react";
import type { ValidationHistory } from "@/lib/supabase";

interface ValidationResultsProps {
  result: ValidationHistory;
}

type NormalizedValidation = {
  recommendationsText: string;
  metadata: {
    generatedAt?: string;
    patientInfoRedacted?: string;
    fileName?: string;
  };
};

export function ValidationResults({ result }: ValidationResultsProps) {
  const normalized = useMemo(() => normalizeResult(result), [result]);

  const handleDownloadReport = () => {
    const reportText = buildReportText(result, normalized);
    const blob = new Blob([reportText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `validation-report-${sanitizeFileName(result.file_name)}-${formatDateForFile(result.created_at)}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-primary" />
          <span>ChatGPT Recommendations</span>
        </CardTitle>
        <Button onClick={handleDownloadReport} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border bg-muted/50 p-4">
          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
            {normalized.recommendationsText || "No recommendations returned."}
          </div>
        </div>

        {(normalized.metadata.generatedAt ||
          normalized.metadata.patientInfoRedacted) && (
          <div className="rounded-lg border bg-muted/40 p-4">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <ShieldCheck className="h-4 w-4" /> Metadata
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {normalized.metadata.generatedAt && (
                <div>
                  <div className="text-xs uppercase text-muted-foreground">
                    Date & Time Generated
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    {normalized.metadata.generatedAt}
                  </div>
                </div>
              )}
              {normalized.metadata.patientInfoRedacted && (
                <div>
                  <div className="text-xs uppercase text-muted-foreground">
                    Privacy
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    {normalized.metadata.patientInfoRedacted}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function normalizeResult(result: ValidationHistory): NormalizedValidation {
  const rawDetails = parseDetails(result.result_details);
  const meta = buildMeta(rawDetails?.meta, result);
  const recommendationsText = extractRecommendationsText(rawDetails, result);

  return {
    recommendationsText,
    metadata: meta,
  };
}

function parseDetails(details: ValidationHistory["result_details"]): any {
  if (!details) return {};
  if (typeof details === "string") {
    try {
      return JSON.parse(details);
    } catch {
      return { recommendations: details };
    }
  }
  return details;
}

function extractRecommendationsText(
  rawDetails: any,
  result: ValidationHistory,
): string {
  const candidates = [
    rawDetails?.recommendations,
    rawDetails?.overallSummary?.recommendations,
    rawDetails?.overallSummary?.nextSteps,
    result.recommendations,
  ];

  for (const candidate of candidates) {
    const normalized = toTextBlock(candidate);
    if (normalized) return normalized;
  }

  return "";
}

function toTextBlock(value: unknown): string {
  if (!value) return "";

  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((entry) => {
        if (!entry) return "";
        if (typeof entry === "string") return entry;
        if (typeof entry === "object") {
          const obj = entry as Record<string, unknown>;
          const text =
            (typeof obj.text === "string" && obj.text) ||
            (typeof obj.description === "string" && obj.description) ||
            (typeof obj.summary === "string" && obj.summary) ||
            (typeof obj.recommendation === "string" && obj.recommendation) ||
            (typeof obj.action === "string" && obj.action) ||
            "";
          return text;
        }
        return String(entry);
      })
      .filter(Boolean);

    return parts.join("\n\n").trim();
  }

  if (typeof value === "object") {
    const entries = Object.values(value as Record<string, unknown>);
    return entries.map((entry) => toTextBlock(entry)).filter(Boolean).join("\n\n").trim();
  }

  return String(value).trim();
}

function buildMeta(
  meta: any,
  result: ValidationHistory,
): NormalizedValidation["metadata"] {
  const obj = typeof meta === "object" && meta ? meta : {};
  const generatedAtSource =
    obj.generatedAt ??
    obj.generated_at ??
    result.updated_at ??
    result.created_at;
  const generatedAt =
    typeof generatedAtSource === "string" && generatedAtSource
      ? new Date(generatedAtSource).toLocaleString()
      : undefined;

  const patientRedactedFlag =
    typeof obj.patient_info_redacted === "boolean"
      ? obj.patient_info_redacted
      : typeof obj.patientInfoRedacted === "boolean"
        ? obj.patientInfoRedacted
        : true;

  return {
    generatedAt,
    patientInfoRedacted: patientRedactedFlag ? "Patient info redacted" : undefined,
    fileName: result.file_name,
  };
}

function sanitizeFileName(name: string): string {
  return name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "-");
}

function formatDateForFile(date: string): string {
  return new Date(date).toISOString().split("T")[0];
}

function buildReportText(
  result: ValidationHistory,
  normalized: NormalizedValidation,
): string {
  const lines: string[] = [];
  const separator = "----------------------------------------";

  lines.push("UPTOSHIFT WOUND CARE VALIDATION REPORT");
  lines.push(separator);
  lines.push(`File: ${result.file_name}`);
  lines.push(`Generated: ${normalized.metadata.generatedAt ?? "Unknown"}`);
  lines.push("");
  lines.push("CHATGPT RECOMMENDATIONS (Texas LCD)");
  lines.push(separator);
  lines.push(normalized.recommendationsText || "No recommendations returned.");
  lines.push("");
  lines.push("METADATA");
  lines.push(separator);
  if (normalized.metadata.patientInfoRedacted) {
    lines.push(normalized.metadata.patientInfoRedacted);
  }
  lines.push("");

  return lines.join("\n");
}
