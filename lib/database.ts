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
export async function getCourses() {
  try {
    console.log('Fetching courses...')
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('published', true)
      .order('order_index')
    
    console.log('Courses query result:', { data, error, count: data?.length })
    
    if (error) {
      console.error('Error fetching courses:', error)
      throw error
    }
    
    return data as Course[]
  } catch (err) {
    console.error('getCourses failed:', err)
    throw err
  }
}

export async function getAllCourses() {
  try {
    console.log('Fetching all courses (including unpublished)...')
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('order_index')
    
    console.log('All courses query result:', { data, error, count: data?.length })
    
    if (error) {
      console.error('Error fetching all courses:', error)
      throw error
    }
    
    return data as Course[]
  } catch (err) {
    console.error('getAllCourses failed:', err)
    throw err
  }
}

export async function getCourseModules(courseId: string) {
  try {
    console.log('Fetching modules for course:', courseId)
    
    const { data: courseData, error: courseError } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single()
    
    console.log('Course data:', courseData, 'Course error:', courseError)
    
    const { data, error } = await supabase
      .from('modules')
      .select('*')
      .eq('course_id', courseId)
      .order('order_index')
    
    console.log('All modules for course (including unpublished):', { data, error, count: data?.length, courseId })
    
    const publishedModules = data?.filter(module => module.published) || []
    console.log('Published modules only:', { count: publishedModules.length, modules: publishedModules })
    
    if (error) {
      console.error('Error fetching modules:', error)
      throw error
    }
    
    return publishedModules as Module[]
  } catch (err) {
    console.error('getCourseModules failed:', err)
    throw err
  }
}

export async function getAllModules() {
  try {
    console.log('Fetching all modules...')
    const { data, error } = await supabase
      .from('modules')
      .select('*')
      .eq('published', true)
      .order('course_id, order_index')
    
    console.log('All modules query result:', { data, error, count: data?.length })
    
    if (error) {
      console.error('Error fetching all modules:', error)
      throw error
    }
    
    return data as Module[]
  } catch (err) {
    console.error('getAllModules failed:', err)
    throw err
  }
}

export async function getUserProgress(userId: string, courseId?: string) {
  try {
    console.log('Fetching user progress:', { userId, courseId })
    let query = supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
    
    if (courseId) {
      query = query.eq('course_id', courseId)
    }
    
    const { data, error } = await query
    console.log('User progress query result:', { data, error, count: data?.length })
    
    if (error) {
      console.error('Error fetching user progress:', error)
      throw error
    }
    
    return data as UserProgress[]
  } catch (err) {
    console.error('getUserProgress failed:', err)
    throw err
  }
}

export async function updateModuleProgress(
  userId: string,
  courseId: string,
  moduleId: string,
  completed: boolean,
  lastPosition: number = 0
) {
  const { data, error } = await supabase
    .from('user_progress')
    .upsert({
      user_id: userId,
      course_id: courseId,
      module_id: moduleId,
      completed,
      last_position: lastPosition,
      completed_at: completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    })
  
  if (error) throw error
  return data
}

// Validation functions
export async function createValidationRecord(
  userId: string,
  fileName: string,
  fileType: string,
  state: string,
  region: string,
  fileUrl?: string
) {
  const { data, error } = await supabase
    .from('validation_history')
    .insert({
      user_id: userId,
      file_name: fileName,
      file_type: fileType,
      state,
      region,
      status: 'processing',
      file_url: fileUrl
    })
    .select()
    .single()
  
  if (error) throw error
  return data as ValidationHistory
}

export async function updateValidationResult(
  validationId: string,
  status: 'completed' | 'failed',
  resultSummary?: string,
  resultDetails?: any,
  n8nExecutionId?: string
) {
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
    throw error;
  }

  if (!data) {
    throw new ValidationRecordNotFoundError(validationId);
  }

  return data as ValidationHistory;
}

// ... rest of the code continues unchanged (getValidationHistory, addRecentActivity, analytics, uploads, profile, etc.)
