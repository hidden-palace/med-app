import { supabase } from './supabase'
import type { Course, Module, UserProgress, ValidationHistory, RecentActivity, Profile } from './supabase'

export class ValidationRecordNotFoundError extends Error {
  constructor(validationId: string) {
    super(`Validation record ${validationId} not found`)
    this.name = 'ValidationRecordNotFoundError'
  }
}

type NormalizedValidationStorage = {
  structuredDetails: any;
  complianceSummary: string | null;
  overallScore: number | null;
  lcdResults: any[] | null;
  recommendations: any[] | null;
};

function normalizeValidationPayloadForStorage(
  resultDetails: unknown,
  fallbackSummary?: string | null
): NormalizedValidationStorage {
  const structuredDetails = parseResultDetailsForStorage(resultDetails);
  const overallSummary = structuredDetails?.overallSummary ?? structuredDetails?.summary ?? {};

  const complianceSummary =
    fallbackSummary ??
    overallSummary.summary ??
    overallSummary.description ??
    overallSummary.message ??
    null;

  const overallScore = extractNumericScoreValue(
    overallSummary.complianceScore ??
      overallSummary.score ??
      structuredDetails?.overallScore
  );

  const lcdResultsRaw = toArrayForStorage(
    structuredDetails?.lcdChecks ??
      structuredDetails?.lcd_results ??
      structuredDetails?.lcdCompliance
  );

  const recommendations = aggregateRecommendationsForStorage(structuredDetails, lcdResultsRaw);

  return {
    structuredDetails: structuredDetails ?? null,
    complianceSummary,
    overallScore,
    lcdResults: lcdResultsRaw.length > 0 ? lcdResultsRaw : null,
    recommendations,
  };
}

function parseResultDetailsForStorage(details: unknown): any {
  if (!details) {
    return {};
  }

  if (typeof details === 'string') {
    try {
      return JSON.parse(details);
    } catch (error) {
      console.warn('Unable to parse result details string payload:', error);
      return {};
    }
  }

  return details;
}

function extractNumericScoreValue(value: unknown): number | null {
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

function toArrayForStorage(value: unknown): any[] {
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

function aggregateRecommendationsForStorage(details: any, lcdResultsRaw: any[]): any[] | null {
  const recommendations: any[] = [];

  const push = (items: any[]) => {
    for (const item of items) {
      if (!item || !item.text) continue;
      const key = item.text.toLowerCase();
      if (!recommendations.some((existing) => existing.text?.toLowerCase() === key)) {
        recommendations.push(item);
      }
    }
  };

  push(normalizeRecommendationEntries(details?.recommendations, { priority: 'medium', source: 'AI Analysis' }));
  push(
    normalizeRecommendationEntries(details?.overallSummary?.recommendations, {
      priority: 'medium',
      source: 'Overall Summary',
    })
  );
  push(
    normalizeRecommendationEntries(details?.overallSummary?.nextSteps, {
      priority: 'high',
      source: 'Next Steps',
    })
  );

  lcdResultsRaw.forEach((entry) => {
    if (entry && typeof entry === 'object') {
      push(
        normalizeRecommendationEntries((entry as Record<string, unknown>).recommendations, {
          priority: (entry as Record<string, unknown>).priority ?? 'medium',
          source: (entry as Record<string, unknown>).title ?? (entry as Record<string, unknown>).lcd,
        })
      );
    }
  });

  return recommendations.length > 0 ? recommendations : null;
}

function normalizeRecommendationEntries(
  value: unknown,
  defaults: Record<string, unknown> = {}
): any[] {
  const array = toArrayForStorage(value);
  const normalized: any[] = [];

  array.forEach((entry, index) => {
    if (!entry) return;

    if (typeof entry === 'string') {
      const text = entry.trim();
      if (!text) return;
      normalized.push({
        id: `${defaults.source ?? 'rec'}-${index}`,
        text,
        priority: (defaults.priority ?? 'medium') as string,
        category: defaults.category ?? null,
        source: defaults.source ?? null,
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
        ...obj,
        id: obj.id ?? `${defaults.source ?? 'rec'}-${index}`,
        text,
        priority: obj.priority ?? defaults.priority ?? 'medium',
        category: obj.category ?? defaults.category ?? null,
        source: obj.source ?? defaults.source ?? null,
      });
    }
  });

  return normalized;
}

// Course and Module functions
export async function getCourses() { /* unchanged */ }
export async function getAllCourses() { /* unchanged */ }
export async function getCourseModules(courseId: string) { /* unchanged */ }
export async function getAllModules() { /* unchanged */ }
export async function getUserProgress(userId: string, courseId?: string) { /* unchanged */ }
export async function updateModuleProgress(
  userId: string,
  courseId: string,
  moduleId: string,
  completed: boolean,
  lastPosition: number = 0
) { /* unchanged */ }

// Validation functions
export async function createValidationRecord(
  userId: string,
  fileName: string,
  fileType: string,
  state: string,
  region: string,
  fileUrl?: string
) { /* unchanged */ }

export async function updateValidationResult(
  validationId: string,
  status: 'completed' | 'failed',
  resultSummary?: string,
  resultDetails?: any,
  n8nExecutionId?: string
) {
  try {
    console.log('Updating validation result:', {
      validationId,
      status,
      hasResultSummary: !!resultSummary,
      hasResultDetails: !!resultDetails,
      n8nExecutionId,
    });

    const normalized = normalizeValidationPayloadForStorage(resultDetails, resultSummary ?? null);

    const updatePayload: Record<string, unknown> = {
      status,
      result_summary: resultSummary ?? normalized.complianceSummary,
      compliance_summary: normalized.complianceSummary ?? resultSummary ?? null,
      result_details: normalized.structuredDetails ?? null,
      n8n_execution_id: n8nExecutionId ?? null,
      updated_at: new Date().toISOString(),
    };

    if (normalized.overallScore !== null) {
      updatePayload.overall_score = normalized.overallScore;
    }

    if (normalized.lcdResults !== null) {
      updatePayload.lcd_results = normalized.lcdResults;
    }

    if (normalized.recommendations !== null) {
      updatePayload.recommendations = normalized.recommendations;
    }

    const { data, error } = await supabase
      .from('validation_history')
      .update(updatePayload)
      .eq('id', validationId)
      .select()
      .maybeSingle();

    if (error && (error as { code?: string }).code !== 'PGRST116') {
      console.error('Supabase error updating validation result:', error);
      throw error;
    }

    if (!data) {
      throw new ValidationRecordNotFoundError(validationId);
    }

    console.log('Validation result updated successfully:', data.id);
    return data as ValidationHistory;
  } catch (error) {
    console.error('Error in updateValidationResult:', error);
    throw error;
  }
}

export async function getValidationHistory(userId: string, limit: number = 10) { /* unchanged */ }

// Activity functions
export async function addRecentActivity(
  userId: string,
  activityType: RecentActivity['activity_type'],
  title: string,
  description: string,
  metadata?: any
) { /* unchanged */ }

export async function getRecentActivity(userId: string, limit: number = 10) { /* unchanged */ }

// Analytics functions
export async function getDashboardStats(userId: string) { /* unchanged */ }

// File upload
export async function uploadValidationFile(
  userId: string,
  file: File,
  fileName: string
): Promise<string> { /* unchanged */ }

// User Management
export async function getProfiles() { /* unchanged */ }
export async function getUserProfile(userId: string) { /* unchanged */ }
export async function updateProfile(id: string, updates: Partial<Profile>) { /* unchanged */ }
export async function resetUserMFA(userId: string) { /* unchanged */ }
export async function resetUserPassword(userId: string) { /* unchanged */ }
export async function enforceSingleSession(userId: string) { /* unchanged */ }

// Course management
export async function createCourse(courseData: Omit<Course, 'id' | 'created_at' | 'updated_at'>) { /* unchanged */ }
export async function updateCourse(id: string, updates: Partial<Course>) { /* unchanged */ }
export async function deleteCourse(id: string) { /* unchanged */ }
export async function publishCourse(id: string, published: boolean) { /* unchanged */ }
export async function reorderCourses(courseIds: string[]) { /* unchanged */ }

// Module management
export async function createModule(moduleData: Omit<Module, 'id' | 'created_at' | 'updated_at'>) { /* unchanged */ }
export async function updateModule(id: string, updates: Partial<Module>) { /* unchanged */ }
export async function deleteModule(id: string) { /* unchanged */ }
export async function publishModule(id: string, published: boolean) { /* unchanged */ }
export async function reorderModules(courseId: string, moduleIds: string[]) { /* unchanged */ }

// Reports
export async function getAllValidationHistory(limit: number = 50) { /* unchanged */ }
export async function deleteValidationRecord(id: string) { /* unchanged */ }
export async function archiveValidationRecord(id: string) { /* unchanged */ }

// Dashboard progress
export async function getUserCourseProgress(userId: string) { /* unchanged */ }
export async function getCourseById(courseId: string) { /* unchanged */ }

// Admin check
export async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    const profile = await getUserProfile(userId)
    if (!profile) {
      return false
    }
    return profile.role === 'admin' && profile.is_active
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
}
