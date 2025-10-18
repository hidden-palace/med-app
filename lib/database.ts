import type { SupabaseClient, User } from '@supabase/supabase-js'
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

function normalizeSupabaseError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) {
    return error;
  }

  if (error && typeof error === 'object') {
    const { message, details, hint, code, status } = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
      status?: unknown;
    };

    const parts = [message, details, hint]
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter(Boolean);

    const normalizedMessage = parts.length > 0 ? parts.join(' | ') : fallbackMessage;

    const normalizedError = new Error(normalizedMessage);

    if (typeof code === 'string' || typeof code === 'number') {
      (normalizedError as { code?: string | number }).code = code;
    }

    if (typeof status === 'number') {
      (normalizedError as { status?: number }).status = status;
    }

    if (typeof details !== 'undefined' && typeof details !== 'string') {
      (normalizedError as { details?: unknown }).details = details;
    }

    if (typeof hint === 'string' && hint.trim()) {
      (normalizedError as { hint?: string }).hint = hint.trim();
    }

    return normalizedError;
  }

  return new Error(fallbackMessage);
}

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
  n8nExecutionId?: string,
  client: SupabaseClient = supabase
) {
  const normalized = normalizeValidationPayloadForStorage(resultDetails, resultSummary ?? null);

  const basePayload: Record<string, unknown> = {
    status,
    result_summary: resultSummary ?? normalized.complianceSummary,
    result_details: normalized.structuredDetails ?? null,
    n8n_execution_id: n8nExecutionId ?? null,
    updated_at: new Date().toISOString(),
  };

  const extendedPayload: Record<string, unknown> = {
    ...basePayload,
  };

  if (normalized.complianceSummary !== null && normalized.complianceSummary !== undefined) {
    extendedPayload.compliance_summary = normalized.complianceSummary;
  }

  if (normalized.overallScore !== null) {
    extendedPayload.overall_score = normalized.overallScore;
  }

  if (normalized.lcdResults !== null) {
    extendedPayload.lcd_results = normalized.lcdResults;
  }

  if (normalized.recommendations !== null) {
    extendedPayload.recommendations = normalized.recommendations;
  }

  const applyUpdate = async (payload: Record<string, unknown>) => {
    return client
      .from('validation_history')
      .update(payload)
      .eq('id', validationId)
      .select()
      .maybeSingle();
  };

  let { data, error } = await applyUpdate(extendedPayload);

  const shouldRetryWithBasePayload = (err: unknown) => {
    if (!err || typeof err !== 'object') {
      return false;
    }

    const { code, message } = err as { code?: string; message?: string };
    if (code === '42703') {
      return true;
    }

    if (!message) {
      return false;
    }

    const normalizedMessage = message.toLowerCase();
    return normalizedMessage.includes('column') && normalizedMessage.includes('does not exist');
  };

  if (error && shouldRetryWithBasePayload(error)) {
    console.warn('updateValidationResult falling back to legacy payload due to missing columns', {
      error,
      validationId,
    });

    ({ data, error } = await applyUpdate(basePayload));
  }

  if (error && (error as { code?: string }).code !== 'PGRST116') {
    throw normalizeSupabaseError(error, 'Failed to update validation record');
  }

  if ((error as { code?: string })?.code === 'PGRST116' || !data) {
    throw new ValidationRecordNotFoundError(validationId);
  }

  return data as ValidationHistory;
}

export type AdminActionResult = {
  success: boolean
  message?: string
}

function getIsoTimestamp(): string {
  return new Date().toISOString()
}

function sanitizeStorageFileName(fileName: string): string {
  return (
    fileName
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'upload'
  )
}

function stripUndefined<T extends Record<string, unknown>>(payload: T): T {
  for (const key of Object.keys(payload)) {
    if (payload[key] === undefined) {
      delete payload[key]
    }
  }
  return payload
}

function resolveSiteUrl(): string | null {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SUPABASE_SITE_URL,
    process.env.VERCEL_URL
      ? process.env.VERCEL_URL.startsWith('http')
        ? process.env.VERCEL_URL
        : `https://${process.env.VERCEL_URL}`
      : null,
  ]

  for (const value of candidates) {
    if (value) {
      return value
    }
  }

  return null
}

export async function getValidationHistory(userId: string, limit = 10) {
  const { data, error } = await supabase
    .from('validation_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  return (data ?? []) as ValidationHistory[]
}

export async function getAllValidationHistory(limit = 100) {
  const { data, error } = await supabase
    .from('validation_history')
    .select('*, profiles(full_name, email)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  return (data ?? []) as Array<
    ValidationHistory & { profiles: Pick<Profile, 'full_name' | 'email'> | null }
  >
}

export async function addRecentActivity(
  userId: string,
  activityType: RecentActivity['activity_type'],
  title: string,
  description: string,
  metadata: Record<string, unknown> = {}
) {
  const payload = {
    user_id: userId,
    activity_type: activityType,
    title,
    description,
    metadata,
    created_at: getIsoTimestamp(),
  }

  const { error } = await supabase.from('recent_activity').insert(payload)

  if (error) {
    throw error
  }
}

export async function getRecentActivity(userId: string, limit = 10) {
  const { data, error } = await supabase
    .from('recent_activity')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  return (data ?? []) as RecentActivity[]
}

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  try {
    const [coursesResult, validationsResult, completedModulesResult] = await Promise.all([
      supabase.from('courses').select('id', { count: 'exact', head: true }).eq('published', true),
      supabase
        .from('validation_history')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase.from('user_progress').select('id').eq('user_id', userId).eq('completed', true),
    ])

    if (coursesResult.error) throw coursesResult.error
    if (validationsResult.error) throw validationsResult.error
    if (completedModulesResult.error) throw completedModulesResult.error

    const totalCourses = coursesResult.count ?? 0
    const totalValidations = validationsResult.count ?? 0
    const completedModules = completedModulesResult.data?.length ?? 0

    const studyMinutes = completedModules * 30
    const studyHoursValue = studyMinutes / 60
    const studyHours =
      studyMinutes === 0
        ? '0 hrs'
        : studyHoursValue >= 1
        ? `${studyHoursValue.toFixed(1).replace(/\.0$/, '')} hrs`
        : `${studyMinutes} mins`

    return {
      totalCourses,
      completedModules,
      totalValidations,
      studyHours,
    }
  } catch (error) {
    console.error('getDashboardStats failed:', error)
    return {
      totalCourses: 0,
      completedModules: 0,
      totalValidations: 0,
      studyHours: '0 hrs',
    }
  }
}

export async function getUserCourseProgress(userId: string) {
  try {
    const [courses, modulesResult, progressResult] = await Promise.all([
      getCourses(),
      supabase.from('modules').select('*').eq('published', true),
      supabase.from('user_progress').select('*').eq('user_id', userId),
    ])

    if (modulesResult.error) throw modulesResult.error
    if (progressResult.error) throw progressResult.error

    const modulesByCourse = new Map<string, Module[]>()

    for (const moduleRow of (modulesResult.data ?? []) as Module[]) {
      if (!modulesByCourse.has(moduleRow.course_id)) {
        modulesByCourse.set(moduleRow.course_id, [])
      }
      modulesByCourse.get(moduleRow.course_id)!.push(moduleRow)
    }

    for (const moduleList of modulesByCourse.values()) {
      moduleList.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    }

    const progressRows = (progressResult.data ?? []) as UserProgress[]

    return courses.map((course) => {
      const modulesForCourse = modulesByCourse.get(course.id) ?? []
      const completedForCourse = progressRows.filter(
        (row) => row.course_id === course.id && row.completed
      )
      const isStarted = progressRows.some(
        (row) =>
          row.course_id === course.id &&
          (row.completed || (row.last_position ?? 0) > 0)
      )
      const progress =
        modulesForCourse.length > 0
          ? Math.round((completedForCourse.length / modulesForCourse.length) * 100)
          : 0

      return {
        id: course.id,
        title: course.title,
        thumbnail: course.thumbnail,
        order_index: course.order_index ?? 0,
        totalModules: modulesForCourse.length,
        completedModulesCount: completedForCourse.length,
        progress,
        isStarted,
      }
    })
  } catch (error) {
    console.error('getUserCourseProgress failed:', error)
    return []
  }
}

export async function uploadValidationFile(userId: string, file: File, fileName: string) {
  const bucket = VALIDATION_STORAGE_BUCKET
  const sanitizedName = sanitizeStorageFileName(fileName)
  const path = `${userId}/${Date.now()}-${sanitizedName}`

  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })

  if (uploadError) {
    throw uploadError
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)

  if (!data?.publicUrl) {
    throw new Error('Unable to generate public URL for uploaded file')
  }

  return data.publicUrl
}

export async function getCourseById(courseId: string) {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data ?? null) as Course | null
}

type CoursePayload = Pick<Course, 'title' | 'description' | 'thumbnail' | 'order_index' | 'published'>

type ModulePayload = Pick<
  Module,
  'course_id' | 'title' | 'description' | 'video_url' | 'transcript' | 'duration' | 'order_index' | 'published'
>

async function getNextCourseOrderIndex() {
  const { count, error } = await supabase.from('courses').select('id', { count: 'exact', head: true })

  if (error) {
    throw error
  }

  return count ?? 0
}

async function getNextModuleOrderIndex(courseId: string) {
  const { count, error } = await supabase
    .from('modules')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId)

  if (error) {
    throw error
  }

  return count ?? 0
}

export async function createCourse(course: Partial<CoursePayload>) {
  const orderIndex =
    typeof course.order_index === 'number' ? course.order_index : await getNextCourseOrderIndex()

  const payload = stripUndefined({
    ...course,
    order_index: orderIndex,
    published: course.published ?? false,
    created_at: getIsoTimestamp(),
    updated_at: getIsoTimestamp(),
  })

  const { data, error } = await supabase.from('courses').insert(payload).select().single()

  if (error) {
    throw error
  }

  return data as Course
}

export async function updateCourse(courseId: string, updates: Partial<CoursePayload>) {
  const payload = stripUndefined({
    ...updates,
    updated_at: getIsoTimestamp(),
  })

  const { data, error } = await supabase
    .from('courses')
    .update(payload)
    .eq('id', courseId)
    .select()
    .maybeSingle()

  if (error) {
    throw error
  }

  return data as Course | null
}

export async function deleteCourse(courseId: string) {
  await supabase.from('modules').delete().eq('course_id', courseId)

  const { error } = await supabase.from('courses').delete().eq('id', courseId)

  if (error) {
    throw error
  }
}

export async function publishCourse(courseId: string, published: boolean) {
  return updateCourse(courseId, { published })
}

export async function createModule(module: Partial<ModulePayload>) {
  if (!module.course_id) {
    throw new Error('course_id is required to create a module')
  }

  const orderIndex =
    typeof module.order_index === 'number'
      ? module.order_index
      : await getNextModuleOrderIndex(module.course_id)

  const payload = stripUndefined({
    ...module,
    order_index: orderIndex,
    published: module.published ?? false,
    created_at: getIsoTimestamp(),
    updated_at: getIsoTimestamp(),
  })

  const { data, error } = await supabase.from('modules').insert(payload).select().single()

  if (error) {
    throw error
  }

  return data as Module
}

export async function updateModule(moduleId: string, updates: Partial<ModulePayload>) {
  const payload = stripUndefined({
    ...updates,
    updated_at: getIsoTimestamp(),
  })

  const { data, error } = await supabase
    .from('modules')
    .update(payload)
    .eq('id', moduleId)
    .select()
    .maybeSingle()

  if (error) {
    throw error
  }

  return data as Module | null
}

export async function deleteModule(moduleId: string) {
  const { error } = await supabase.from('modules').delete().eq('id', moduleId)

  if (error) {
    throw error
  }
}

export async function publishModule(moduleId: string, published: boolean) {
  return updateModule(moduleId, { published })
}

export async function reorderCourses(courseIds: string[]) {
  const updates = courseIds.map((courseId, index) =>
    supabase
      .from('courses')
      .update({
        order_index: index,
        updated_at: getIsoTimestamp(),
      })
      .eq('id', courseId)
  )

  const results = await Promise.all(updates)

  for (const result of results) {
    if (result.error) {
      throw result.error
    }
  }
}

export async function reorderModules(courseId: string, moduleIds: string[]) {
  const updates = moduleIds.map((moduleId, index) =>
    supabase
      .from('modules')
      .update({
        order_index: index,
        updated_at: getIsoTimestamp(),
      })
      .eq('id', moduleId)
      .eq('course_id', courseId)
  )

  const results = await Promise.all(updates)

  for (const result of results) {
    if (result.error) {
      throw result.error
    }
  }
}

export async function getProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as Profile[]
}

export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data ?? null) as Profile | null
}

type UpdateProfileOptions = {
  createIfMissing?: boolean
  fallbackUser?: User | null
}

export async function updateProfile(
  userId: string,
  updates: Partial<Profile>,
  options: UpdateProfileOptions = {}
) {
  const payload = stripUndefined({
    ...updates,
    updated_at: getIsoTimestamp(),
  })

  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select()
    .maybeSingle()

  if (error && (error as { code?: string }).code !== 'PGRST116') {
    throw error
  }

  if (!data && options.createIfMissing) {
    const fallbackUser = options.fallbackUser
    const fallbackEmail =
      (typeof updates.email === 'string' && updates.email) ||
      (typeof fallbackUser?.email === 'string' ? fallbackUser.email : undefined) ||
      (typeof fallbackUser?.user_metadata?.email === 'string'
        ? (fallbackUser.user_metadata.email as string)
        : undefined)
    const fallbackName =
      (typeof updates.full_name === 'string' && updates.full_name) ||
      (typeof fallbackUser?.user_metadata?.full_name === 'string'
        ? (fallbackUser.user_metadata.full_name as string)
        : undefined) ||
      (typeof fallbackUser?.user_metadata?.name === 'string'
        ? (fallbackUser.user_metadata.name as string)
        : undefined) ||
      fallbackEmail ||
      null

    const insertPayload = stripUndefined({
      id: userId,
      email: fallbackEmail,
      full_name: fallbackName,
      is_active: updates.is_active ?? true,
      role: updates.role ?? 'user',
      last_sign_in_at: updates.last_sign_in_at ?? getIsoTimestamp(),
      created_at: getIsoTimestamp(),
      updated_at: getIsoTimestamp(),
    })

    const { data: inserted, error: insertError } = await supabase
      .from('profiles')
      .insert(insertPayload)
      .select()
      .single()

    if (insertError) {
      throw insertError
    }

    return inserted as Profile
  }

  return data as Profile | null
}

export async function resetUserPassword(userId: string): Promise<AdminActionResult> {
  try {
    const profile = await getUserProfile(userId)
    if (!profile?.email) {
      return { success: false, message: 'User email not found' }
    }

    const siteUrl = resolveSiteUrl()
    const options: { redirectTo?: string } = {}
    if (siteUrl) {
      options.redirectTo = `${siteUrl.replace(/\/$/, '')}/auth/callback`
    }

    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, options)

    if (error) {
      return { success: false, message: error.message }
    }

    return { success: true, message: 'Password reset email sent' }
  } catch (error) {
    console.error('resetUserPassword failed:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function resetUserMFA(_userId: string): Promise<AdminActionResult> {
  console.warn(
    'resetUserMFA requires a secure server-side integration with Supabase service role credentials'
  )
  return {
    success: false,
    message: 'MFA reset is not configured. Please contact an administrator.',
  }
}

export async function enforceSingleSession(userId: string): Promise<AdminActionResult> {
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      return { success: false, message: error.message }
    }

    const session = data.session
    if (!session) {
      return { success: false, message: 'No active session available' }
    }

    const payload: Record<string, unknown> = { userId }

    const sessionWithId = session as { session_id?: string }
    if (sessionWithId.session_id) {
      payload.sessionId = sessionWithId.session_id
    }
    if (session.refresh_token) {
      payload.refreshToken = session.refresh_token
    }

    const response = await fetch('/api/auth/force-single-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    })

    if (response.status === 204) {
      return { success: true }
    }

    const responsePayload = await response.json().catch(() => null)

    return {
      success: false,
      message:
        (responsePayload &&
          typeof responsePayload.error === 'string' &&
          responsePayload.error) ||
        `Failed to enforce single session (status ${response.status})`,
    }
  } catch (error) {
    console.error('enforceSingleSession failed:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function deleteValidationRecord(validationId: string) {
  const { error } = await supabase.from('validation_history').delete().eq('id', validationId)

  if (error) {
    throw error
  }
}

export async function archiveValidationRecord(validationId: string) {
  const { data, error } = await supabase
    .from('validation_history')
    .update({
      status: 'archived',
      updated_at: getIsoTimestamp(),
    })
    .eq('id', validationId)
    .select()
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new ValidationRecordNotFoundError(validationId)
  }

  return data as ValidationHistory
}

