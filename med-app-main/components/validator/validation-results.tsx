'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { ValidationHistory } from '@/lib/supabase';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ClipboardList,
  Download,
  FileText,
  Lightbulb,
  MapPin,
  ShieldCheck,
  Stethoscope,
  Timer,
  Thermometer,
  Droplets,
  Ruler,
  Layers,
  Image as ImageIcon,
  Circle,
} from 'lucide-react';
interface ValidationResultsProps {
  result: ValidationHistory;
}

type NormalizedRecommendation = {
  id: string;
  text: string;
  priority: 'high' | 'medium' | 'low';
  category?: string;
  source?: string;
};

type NormalizedLCDCheck = {
  id: string;
  title: string;
  status: 'pass' | 'partial' | 'fail' | 'na';
  summary?: string;
  score?: number | null;
  reasons: string[];
  evidence: string[];
  recommendations: NormalizedRecommendation[];
};

type NormalizedValidationDetails = {
  raw: any;
  meta: Record<string, string | undefined>;
  sections: Record<string, string | undefined>;
  woundAssessment: {
    location?: string;
    size?: Record<string, string | number | undefined>;
    edges?: string;
    base?: string;
    exudate?: string;
    infectionSigns?: string;
    surroundingSkin?: string;
  } | null;
  overallSummary: {
    status?: string;
    summaryText?: string | null;
    keyFindings: string[];
    nextSteps: string[];
    score: number | null;
  };
  lcdChecks: NormalizedLCDCheck[];
  recommendations: NormalizedRecommendation[];
};

const PRIORITY_ORDER: NormalizedRecommendation['priority'][] = ['high', 'medium', 'low'];
export function ValidationResults({ result }: ValidationResultsProps) {
  const normalized = useMemo(() => normalizeValidationDetails(result), [result]);

  const complianceScore = Math.max(
    0,
    Math.min(100, normalized.overallSummary.score ?? result.overall_score ?? 0)
  );

  const validationStatus = resolveValidationStatus(
    result.status,
    complianceScore,
    normalized.overallSummary.status
  );

  const keyFindings = normalized.overallSummary.keyFindings;
  const nextSteps = normalized.overallSummary.nextSteps;
  const lcdChecks = normalized.lcdChecks;
  const recommendations = normalized.recommendations;

  const handleDownloadReport = () => {
    const reportText = buildReportText(result, normalized, complianceScore, validationStatus);
    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
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
        <div className="flex flex-col gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            {renderStatusIcon(validationStatus)}
            <span>Validation Results</span>
            <Badge variant="outline" className={statusBadgeClasses(validationStatus)}>
              {validationStatus.toUpperCase()}
            </Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Comprehensive LCD compliance analysis powered by AI.
          </p>
        </div>

        <Button onClick={handleDownloadReport} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Download Report
        </Button>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="clinical">Clinical Documentation</TabsTrigger>
            <TabsTrigger value="wound">Wound Assessment</TabsTrigger>
            <TabsTrigger value="lcd">LCD Compliance</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4 text-primary" />
                  Overall Compliance Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <OverviewStat label="File" value={result.file_name} icon={FileText} />
                  <OverviewStat label="State / Region" value={`${result.state} / ${result.region}`} icon={MapPin} />
                  <OverviewStat
                    label="Validated"
                    value={new Date(result.created_at).toLocaleString()}
                    icon={Timer}
                  />
                </div>

                <div className="rounded-lg border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-muted-foreground">Compliance Score</span>
                      <span className="text-3xl font-semibold text-primary">{complianceScore}%</span>
                    </div>
                    <Progress value={complianceScore} className="h-2 min-w-[160px] flex-1" />
                    <Badge className={statusBadgeClasses(validationStatus)}>
                      {readableStatus(validationStatus)}
                    </Badge>
                  </div>
                </div>

                <Alert variant="default" className={cn('border-l-4', statusAccentBorder(validationStatus))}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-semibold">
                      {normalized.overallSummary.summaryText || result.result_summary || 'Validation completed.'}
                    </p>
                    {keyFindings.length > 0 && (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                        {keyFindings.map((finding, idx) => (
                          <li key={idx}>{finding}</li>
                        ))}
                      </ul>
                    )}
                  </AlertDescription>
                </Alert>

                {normalized.meta && Object.keys(normalized.meta).length > 0 && (
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      <ShieldCheck className="h-4 w-4" /> Metadata
                    </h4>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {Object.entries(normalized.meta).map(([label, value]) =>
                        value ? (
                          <div key={label}>
                            <div className="text-xs uppercase text-muted-foreground">{formatLabel(label)}</div>
                            <div className="text-sm font-medium text-foreground">{value}</div>
                          </div>
                        ) : null
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {(nextSteps.length > 0 || recommendations.length > 0) && (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Lightbulb className="h-4 w-4 text-primary" /> Prioritized Next Steps
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {nextSteps.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Immediate Actions</h4>
                      <ul className="space-y-2 text-sm">
                        {nextSteps.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <CheckCircle className="mt-0.5 h-4 w-4 text-primary" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {recommendations.length > 0 && (
                    <div className="space-y-3">
                      <RecommendationGroup
                        title="High Priority"
                        recommendations={recommendations.filter((rec) => rec.priority === 'high')}
                      />
                      <RecommendationGroup
                        title="Additional Opportunities"
                        recommendations={recommendations.filter((rec) => rec.priority !== 'high')}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
          <TabsContent value="clinical" className="space-y-4">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Stethoscope className="h-4 w-4 text-primary" /> Clinical Narrative
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="space-y-2">
                  {renderClinicalSection('Chief Complaint', normalized.sections.chiefComplaint)}
                  {renderClinicalSection(
                    'History of Present Illness',
                    normalized.sections.hpi || normalized.sections.history
                  )}
                  {renderClinicalSection('Interventions To Date', normalized.sections.interventions)}
                  {renderClinicalSection('Treatment Plan', normalized.sections.plan)}
                  {renderClinicalSection('Medical Necessity', normalized.sections.medicalNecessity)}
                  {renderClinicalSection('Comorbidities', normalized.sections.comorbidities)}
                  {renderClinicalSection('Consent', normalized.sections.consent)}
                  {renderClinicalSection('Supporting Documentation', normalized.sections.documentation)}
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="wound" className="space-y-4">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Thermometer className="h-4 w-4 text-primary" /> Wound Assessment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {normalized.woundAssessment ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {renderAssessmentRow('Location', normalized.woundAssessment.location, MapPin)}
                    {renderAssessmentRow('Edges', normalized.woundAssessment.edges, Layers)}
                    {renderAssessmentRow('Base', normalized.woundAssessment.base, ShieldCheck)}
                    {renderAssessmentRow('Exudate', normalized.woundAssessment.exudate, Droplets)}
                    {renderAssessmentRow('Infection Signs', normalized.woundAssessment.infectionSigns, AlertCircle)}
                    {renderAssessmentRow('Surrounding Skin', normalized.woundAssessment.surroundingSkin, Circle)}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No wound assessment details were provided.</p>
                )}

                {normalized.woundAssessment?.size && (
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                      <Ruler className="h-4 w-4" /> Measurements
                    </h4>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {Object.entries(normalized.woundAssessment.size).map(([label, value]) => (
                        <div key={label}>
                          <div className="text-xs uppercase text-muted-foreground">{formatLabel(label)}</div>
                          <div className="text-sm font-medium text-foreground">{String(value)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {normalized.sections.photosMeasurements && (
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                      <ImageIcon className="h-4 w-4" /> Photos & Measurement Notes
                    </h4>
                    <p className="text-sm leading-relaxed text-foreground">
                      {normalized.sections.photosMeasurements}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="lcd" className="space-y-4">
            {lcdChecks.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  No specific LCD analysis was returned for this validation.
                </CardContent>
              </Card>
            ) : (
              lcdChecks.map((lcd) => (
                <Card key={lcd.id} className="border-l-4 border-l-primary/40">
                  <CardHeader className="pb-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-base font-semibold">{lcd.title}</CardTitle>
                      <div className="flex items-center gap-2">
                        {typeof lcd.score === 'number' && (
                          <Badge variant="outline" className="bg-muted text-muted-foreground">
                            {lcd.score}%
                          </Badge>
                        )}
                        <Badge className={lcdStatusBadgeClasses(lcd.status)}>{lcdStatusLabel(lcd.status)}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {lcd.summary && <p className="text-sm leading-relaxed text-foreground">{lcd.summary}</p>}

                    <Accordion type="multiple" className="space-y-2">
                      {lcd.reasons.length > 0 && (
                        <AccordionItem value={`reasons-${lcd.id}`}>
                          <AccordionTrigger className="text-sm font-semibold">Assessment Details</AccordionTrigger>
                          <AccordionContent>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                              {lcd.reasons.map((reason, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <AlertCircle className="mt-0.5 h-4 w-4 text-orange-500" />
                                  <span>{reason}</span>
                                </li>
                              ))}
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                      )}

                      {lcd.evidence.length > 0 && (
                        <AccordionItem value={`evidence-${lcd.id}`}>
                          <AccordionTrigger className="text-sm font-semibold">Supporting Evidence</AccordionTrigger>
                          <AccordionContent>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                              {lcd.evidence.map((item, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                      )}

                      {lcd.recommendations.length > 0 && (
                        <AccordionItem value={`recommendations-${lcd.id}`}>
                          <AccordionTrigger className="text-sm font-semibold">Recommended Actions</AccordionTrigger>
                          <AccordionContent>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                              {lcd.recommendations.map((rec) => (
                                <li key={rec.id} className="flex items-start gap-2">
                                  <Lightbulb className="mt-0.5 h-4 w-4 text-primary" />
                                  <span>{rec.text}</span>
                                </li>
                              ))}
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                      )}
                    </Accordion>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
          <TabsContent value="recommendations" className="space-y-4">
            {recommendations.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  No recommendations were generated for this validation.
                </CardContent>
              </Card>
            ) : (
              PRIORITY_ORDER.map((priority) => (
                <RecommendationGroup
                  key={priority}
                  title={`${priority.charAt(0).toUpperCase()}${priority.slice(1)} Priority`}
                  recommendations={recommendations.filter((rec) => rec.priority === priority)}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
function normalizeValidationDetails(result: ValidationHistory): NormalizedValidationDetails {
  const rawDetails = parseDetails(result.result_details);
  const overallSummary = rawDetails?.overallSummary ?? rawDetails?.summary ?? {};

  const score = extractNumericScore(
    overallSummary.complianceScore ??
      overallSummary.score ??
      result.overall_score ??
      rawDetails?.overallScore
  );

  const keyFindings = toStringArray(overallSummary.keyFindings);
  const nextSteps = toStringArray(overallSummary.nextSteps);
  const summaryText =
    overallSummary.summary ??
      overallSummary.message ??
      overallSummary.description ??
      result.result_summary ??
      result.compliance_summary ??
      null;

  const meta = buildMeta(rawDetails?.meta, result);
  const sections = buildSections(rawDetails?.sections ?? rawDetails);
  const woundAssessment = buildWoundAssessment(sections.woundAssessment);

  const lcdChecks = buildLCDChecks(rawDetails, result.lcd_results);
  const aggregatedRecommendations = aggregateRecommendations(rawDetails, lcdChecks);

  return {
    raw: rawDetails,
    meta,
    sections,
    woundAssessment,
    overallSummary: {
      status: (overallSummary.complianceStatus ?? overallSummary.status ?? result.status)?.toString(),
      summaryText,
      keyFindings,
      nextSteps,
      score,
    },
    lcdChecks,
    recommendations: aggregatedRecommendations,
  };
}

function parseDetails(details: ValidationHistory['result_details']): any {
  if (!details) {
    return {};
  }

  if (typeof details === 'string') {
    try {
      return JSON.parse(details);
    } catch (error) {
      console.warn('Unable to parse validation result details string:', error);
      return {};
    }
  }

  return details;
}

function extractNumericScore(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === 'string') {
    const match = value.match(/-?\d+(?:\.\d+)?/);
    if (match) {
      return Math.round(Number(match[0]));
    }
  }

  return null;
}

function buildMeta(meta: any, result: ValidationHistory): Record<string, string | undefined> {
  const obj = typeof meta === 'object' && meta ? meta : {};
  return {
    validationId: obj.validationId ?? result.id,
    mac: obj.mac,
    state: obj.state ?? result.state,
    regionHint: obj.regionHint ?? result.region,
    generatedAt: obj.generatedAt ? new Date(obj.generatedAt).toLocaleString() : undefined,
    patientInfoRedacted: obj.patient_info_redacted,
    fileType: obj.fileType ?? result.file_type,
  };
}

function buildSections(sections: any): Record<string, string | undefined> {
  if (typeof sections !== 'object' || !sections) {
    return {
      chiefComplaint: undefined,
      hpi: undefined,
      interventions: undefined,
      plan: undefined,
      medicalNecessity: undefined,
      comorbidities: undefined,
      consent: undefined,
      documentation: undefined,
      photosMeasurements: undefined,
      woundAssessment: undefined,
    };
  }

  return {
    chiefComplaint: sections.chiefComplaint ?? sections.complaint,
    hpi: sections.hpi ?? sections.history,
    interventions: sections.interventionsToDate ?? sections.interventions,
    plan: sections.plan,
    medicalNecessity: sections.medicalNecessity ?? sections.justification,
    comorbidities: sections.comorbidities,
    consent: sections.consent,
    documentation: sections.supportingDocumentation,
    photosMeasurements: sections.photosMeasurements,
    woundAssessment: sections.woundAssessment,
  };
}

function buildWoundAssessment(raw: any): NormalizedValidationDetails['woundAssessment'] {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const size = raw.size && typeof raw.size === 'object' ? raw.size : undefined;

  return {
    location: raw.location,
    size,
    edges: raw.edges,
    base: raw.base,
    exudate: raw.exudate,
    infectionSigns: raw.infectionSigns,
    surroundingSkin: raw.surroundingSkin,
  };
}

function buildLCDChecks(rawDetails: any, fallback: any): NormalizedLCDCheck[] {
  const lcdSource = rawDetails?.lcdChecks ?? rawDetails?.lcd_results ?? rawDetails?.lcdCompliance ?? fallback;
  const array = toArray(lcdSource);
  return array.map((entry, index) => normalizeLCDCheck(entry, index));
}

function normalizeLCDCheck(entry: any, index: number): NormalizedLCDCheck {
  const obj = typeof entry === 'object' && entry ? entry : { description: String(entry ?? '') };
  const status = normalizeLCDStatus(obj.status ?? obj.outcome ?? obj.compliance ?? 'unknown');
  const score = extractNumericScore(obj.score ?? obj.complianceScore);
  const title =
    obj.title ??
    obj.name ??
    (obj.lcd ? `LCD ${obj.lcd}` : null) ??
    `LCD Check ${index + 1}`;

  const reasons = toStringArray(
    obj.reasons ?? obj.reason ?? obj.details ?? obj.missing_elements ?? obj.assessment
  );
  const evidence = toStringArray(obj.evidence ?? obj.supportingEvidence ?? obj.documentation ?? obj.documents);
  const recommendations = normalizeRecommendationCollection(obj.recommendations ?? obj.suggestions ?? obj.actions, {
    priority: 'medium',
    source: title,
  });

  return {
    id: String(obj.id ?? obj.lcd ?? index),
    title,
    status,
    summary: obj.summary ?? obj.assessment ?? obj.description,
    score,
    reasons,
    evidence,
    recommendations,
  };
}

function normalizeLCDStatus(value: unknown): NormalizedLCDCheck['status'] {
  const input = (value ?? '').toString().toLowerCase();
  if (['pass', 'passed', 'met', 'compliant', 'complete'].includes(input)) {
    return 'pass';
  }
  if (['partial', 'partially met', 'warning', 'needs improvement'].includes(input)) {
    return 'partial';
  }
  if (['na', 'n/a', 'not applicable'].includes(input)) {
    return 'na';
  }
  return 'fail';
}

function aggregateRecommendations(
  rawDetails: any,
  lcdChecks: NormalizedLCDCheck[]
): NormalizedRecommendation[] {
  const aggregate: NormalizedRecommendation[] = [];

  const push = (items: NormalizedRecommendation[]) => {
    for (const item of items) {
      if (!item.text) continue;
      const key = `${item.priority}-${item.text.toLowerCase()}`;
      if (!aggregate.some((existing) => `${existing.priority}-${existing.text.toLowerCase()}` === key)) {
        aggregate.push(item);
      }
    }
  };

  push(normalizeRecommendationCollection(rawDetails?.recommendations, { priority: 'medium', source: 'AI Analysis' }));
  push(
    normalizeRecommendationCollection(rawDetails?.overallSummary?.recommendations, {
      priority: 'medium',
      source: 'Overall Summary',
    })
  );
  push(
    normalizeRecommendationCollection(rawDetails?.overallSummary?.nextSteps, {
      priority: 'high',
      source: 'Next Steps',
    })
  );

  for (const lcd of lcdChecks) {
    push(lcd.recommendations.map((rec) => ({ ...rec, priority: rec.priority ?? 'medium' })));
  }

  return aggregate.sort(
    (a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)
  );
}

function normalizeRecommendationCollection(
  value: unknown,
  defaults: Partial<NormalizedRecommendation> = {}
): NormalizedRecommendation[] {
  const array = toArray(value);
  const normalized: NormalizedRecommendation[] = [];

  array.forEach((entry, index) => {
    if (!entry) return;

    if (typeof entry === 'string') {
      const text = entry.trim();
      if (!text) return;
      normalized.push({
        id: `${defaults.source ?? 'rec'}-${index}`,
        text,
        priority: normalizePriority(defaults.priority),
        category: defaults.category,
        source: defaults.source,
      });
      return;
    }

    if (typeof entry === 'object') {
      const obj = entry as Record<string, unknown>;
      const text = String(
        obj.text ??
          obj.description ??
          obj.suggestion ??
          obj.recommendation ??
          obj.action ??
          obj.summary ??
          ''
      ).trim();

      if (!text) return;

      normalized.push({
        id: String(obj.id ?? `${defaults.source ?? 'rec'}-${index}`),
        text,
        priority: normalizePriority(obj.priority ?? defaults.priority),
        category: (obj.category ?? defaults.category) as string | undefined,
        source: (obj.source ?? defaults.source) as string | undefined,
      });
    }
  });

  return normalized;
}
function normalizePriority(value: unknown): NormalizedRecommendation['priority'] {
  const input = (value ?? '').toString().toLowerCase();
  if (input === 'high') return 'high';
  if (input === 'low') return 'low';
  return 'medium';
}

function toArray(value: unknown): any[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch (error) {
      // ignore parse errors for plain strings
    }

    return value
      .split(/\n|;/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>);
  }

  return [value];
}

function toStringArray(value: unknown): string[] {
  return toArray(value)
    .map((item) => {
      if (item === null || item === undefined) return '';
      if (typeof item === 'string') return item.trim();
      if (typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        return (
          obj.text ??
          obj.description ??
          obj.summary ??
          obj.details ??
          obj.reason ??
          obj.message ??
          ''
        ).toString().trim();
      }
      return item.toString().trim();
    })
    .filter(Boolean);
}

function resolveValidationStatus(
  status: ValidationHistory['status'],
  score: number,
  summaryStatus?: string
): 'passed' | 'warning' | 'failed' {
  const normalizedStatus = (summaryStatus ?? status).toLowerCase();

  if (['pass', 'passed', 'compliant'].includes(normalizedStatus) || score >= 90) {
    return 'passed';
  }

  if (['warning', 'partial', 'partially compliant'].includes(normalizedStatus) || score >= 70) {
    return 'warning';
  }

  return 'failed';
}

function renderStatusIcon(status: 'passed' | 'warning' | 'failed') {
  const iconClasses = 'h-5 w-5';

  switch (status) {
    case 'passed':
      return <CheckCircle className={cn(iconClasses, 'text-green-600')} />;
    case 'warning':
      return <AlertTriangle className={cn(iconClasses, 'text-orange-500')} />;
    default:
      return <AlertCircle className={cn(iconClasses, 'text-red-500')} />;
  }
}

function readableStatus(status: 'passed' | 'warning' | 'failed'): string {
  if (status === 'passed') return 'Fully Compliant';
  if (status === 'warning') return 'Partially Compliant';
  return 'Non-Compliant';
}

function statusBadgeClasses(status: 'passed' | 'warning' | 'failed'): string {
  switch (status) {
    case 'passed':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'warning':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    default:
      return 'bg-red-50 text-red-700 border-red-200';
  }
}

function statusAccentBorder(status: 'passed' | 'warning' | 'failed'): string {
  switch (status) {
    case 'passed':
      return 'border-green-300';
    case 'warning':
      return 'border-orange-300';
    default:
      return 'border-red-300';
  }
}
function OverviewStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  if (!value) return null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
          <div className="text-sm font-semibold text-foreground">{value}</div>
        </div>
      </div>
    </div>
  );
}

function renderClinicalSection(title: string, content?: string) {
  if (!content) return null;

  const value = content.trim();
  if (!value) return null;

  return (
    <AccordionItem value={title}>
      <AccordionTrigger className="text-left text-sm font-semibold">{title}</AccordionTrigger>
      <AccordionContent>
        <p className="text-sm leading-relaxed text-muted-foreground">{value}</p>
      </AccordionContent>
    </AccordionItem>
  );
}

function renderAssessmentRow(
  label: string,
  value?: string,
  icon?: React.ComponentType<{ className?: string }>
) {
  if (!value) return null;
  const Icon = icon;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        {Icon ? (
          <div className="rounded-full bg-primary/10 p-2 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
        <div>
          <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
          <div className="text-sm leading-relaxed text-foreground">{value}</div>
        </div>
      </div>
    </div>
  );
}

function RecommendationGroup({
  title,
  recommendations,
}: {
  title: string;
  recommendations: NormalizedRecommendation[];
}) {
  if (!recommendations || recommendations.length === 0) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <ClipboardList className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        {recommendations.map((rec) => (
          <div key={rec.id} className="flex flex-col gap-1 rounded-md border bg-background/80 p-3">
            <span className="font-medium text-foreground">{rec.text}</span>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <Badge variant="outline" className={priorityBadgeClasses(rec.priority)}>
                {rec.priority.charAt(0).toUpperCase() + rec.priority.slice(1)}
              </Badge>
              {rec.category && <span>Category: {rec.category}</span>}
              {rec.source && <span>Source: {rec.source}</span>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function priorityBadgeClasses(priority: NormalizedRecommendation['priority']): string {
  switch (priority) {
    case 'high':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'low':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    default:
      return 'bg-amber-50 text-amber-700 border-amber-200';
  }
}

function lcdStatusBadgeClasses(status: NormalizedLCDCheck['status']): string {
  switch (status) {
    case 'pass':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'partial':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'na':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    default:
      return 'bg-red-50 text-red-700 border-red-200';
  }
}

function lcdStatusLabel(status: NormalizedLCDCheck['status']): string {
  switch (status) {
    case 'pass':
      return 'Pass';
    case 'partial':
      return 'Partial';
    case 'na':
      return 'N/A';
    default:
      return 'Not Met';
  }
}

function formatLabel(label: string): string {
  return label
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function sanitizeFileName(name: string): string {
  return name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '-');
}

function formatDateForFile(date: string): string {
  return new Date(date).toISOString().split('T')[0];
}
function buildReportText(
  result: ValidationHistory,
  normalized: NormalizedValidationDetails,
  score: number,
  status: 'passed' | 'warning' | 'failed'
): string {
  const lines: string[] = [];
  const separator = '----------------------------------------';

  lines.push('MEDLEARN WOUND CARE VALIDATION REPORT');
  lines.push(separator);
  lines.push(`File: ${result.file_name}`);
  lines.push(`State / Region: ${result.state} / ${result.region}`);
  lines.push(`Generated: ${new Date(result.created_at).toLocaleString()}`);
  lines.push('');
  lines.push('SUMMARY');
  lines.push(separator);
  lines.push(`Status: ${readableStatus(status)}`);
  lines.push(`Compliance Score: ${score}%`);
  lines.push(
    `Overview: ${
      normalized.overallSummary.summaryText || result.result_summary || 'No summary provided.'
    }`
  );
  lines.push('');

  if (normalized.overallSummary.keyFindings.length > 0) {
    lines.push('Key Findings:');
    normalized.overallSummary.keyFindings.forEach((finding, idx) => {
      lines.push(`${idx + 1}. ${finding}`);
    });
    lines.push('');
  }

  if (normalized.overallSummary.nextSteps.length > 0) {
    lines.push('Immediate Next Steps:');
    normalized.overallSummary.nextSteps.forEach((step, idx) => {
      lines.push(`${idx + 1}. ${step}`);
    });
    lines.push('');
  }

  lines.push('CLINICAL DOCUMENTATION');
  lines.push(separator);
  Object.entries(normalized.sections).forEach(([key, value]) => {
    if (!value || key === 'woundAssessment') return;
    lines.push(`${formatLabel(key)}:`);
    lines.push(value);
    lines.push('');
  });

  if (normalized.woundAssessment) {
    lines.push('Wound Assessment:');
    Object.entries(normalized.woundAssessment).forEach(([key, value]) => {
      if (!value) return;
      if (key === 'size' && typeof value === 'object') {
        lines.push('  Measurements:');
        Object.entries(value).forEach(([metric, metricValue]) => {
          lines.push(`    - ${formatLabel(metric)}: ${metricValue}`);
        });
        return;
      }
      lines.push(`  ${formatLabel(key)}: ${value}`);
    });
    lines.push('');
  }

  lines.push('LCD COMPLIANCE');
  lines.push(separator);
  if (normalized.lcdChecks.length === 0) {
    lines.push('No LCD analysis available.');
  } else {
    normalized.lcdChecks.forEach((lcd, idx) => {
      lines.push(`${idx + 1}. ${lcd.title}`);
      lines.push(`   Status: ${lcdStatusLabel(lcd.status)}${lcd.score ? ` (${lcd.score}%)` : ''}`);
      if (lcd.summary) {
        lines.push(`   Summary: ${lcd.summary}`);
      }
      if (lcd.reasons.length > 0) {
        lines.push('   Assessment:');
        lcd.reasons.forEach((reason) => lines.push(`     - ${reason}`));
      }
      if (lcd.evidence.length > 0) {
        lines.push('   Evidence:');
        lcd.evidence.forEach((item) => lines.push(`     - ${item}`));
      }
      if (lcd.recommendations.length > 0) {
        lines.push('   Recommended Actions:');
        lcd.recommendations.forEach((rec) => lines.push(`     - ${rec.text}`));
      }
      lines.push('');
    });
  }

  if (normalized.recommendations.length > 0) {
    lines.push('RECOMMENDATIONS');
    lines.push(separator);
    normalized.recommendations.forEach((rec, idx) => {
      lines.push(`${idx + 1}. ${rec.text}`);
      lines.push(`   Priority: ${rec.priority.toUpperCase()}`);
      if (rec.category) lines.push(`   Category: ${rec.category}`);
      if (rec.source) lines.push(`   Source: ${rec.source}`);
      lines.push('');
    });
  }

  return lines.join('\n');
}



