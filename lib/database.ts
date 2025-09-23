import { supabase } from './supabase'
import type { Course, Module, UserProgress, ValidationHistory, RecentActivity, Profile } from './supabase'

// Debug function to test database connection
export async function testDatabaseConnection() {
  try {
    const { data, error } = await supabase
      .from('courses')
      .select('*', { count: 'exact', head: true })
    
    console.log('Database connection test:', { data, error })
    return { success: !error, data, error }
  } catch (err) {
    console.error('Database connection failed:', err)
    return { success: false, error: err }
  }
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
    
    // First, let's check if the course exists and is published
    const { data: courseData, error: courseError } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single()
    
    console.log('Course data:', courseData, 'Course error:', courseError)
    
    // Now fetch modules
    const { data, error } = await supabase
      .from('modules')
      .select('*')
      .eq('course_id', courseId)
      .order('order_index')
    
    console.log('All modules for course (including unpublished):', { data, error, count: data?.length, courseId })
    
    // Filter published modules
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
  const { data, error } = await supabase
    .from('validation_history')
    .update({
      status,
      result_summary: resultSummary,
      result_details: resultDetails,
      n8n_execution_id: n8nExecutionId,
      updated_at: new Date().toISOString()
    })
    .eq('id', validationId)
    .select()
    .single()
  
  if (error) throw error
  return data as ValidationHistory
}

export async function getValidationHistory(userId: string, limit: number = 10) {
  const { data, error } = await supabase
    .from('validation_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error) throw error
  return data as ValidationHistory[]
}

// Activity functions
export async function addRecentActivity(
  userId: string,
  activityType: RecentActivity['activity_type'],
  title: string,
  description: string,
  metadata?: any
) {
  const { data, error } = await supabase
    .from('recent_activity')
    .insert({
      user_id: userId,
      activity_type: activityType,
      title,
      description,
      metadata
    })
    .select()
    .single()
  
  if (error) throw error
  return data as RecentActivity
}

export async function getRecentActivity(userId: string, limit: number = 10) {
  const { data, error } = await supabase
    .from('recent_activity')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error) throw error
  return data as RecentActivity[]
}

// Analytics functions
export async function getDashboardStats(userId: string) {
  // Get total courses
  const { count: totalCourses } = await supabase
    .from('courses')
    .select('id', { count: 'exact', head: true })
    .eq('published', true)
  
  // Get user's completed modules
  const { count: completedModules } = await supabase
    .from('user_progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('completed', true)
  
  // Get total validations
  const { count: totalValidations } = await supabase
    .from('validation_history')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  
  // Calculate study hours (mock calculation based on completed modules)
  const studyHours = (completedModules || 0) * 0.5 // Assume 30 minutes per module
  
  return {
    totalCourses: totalCourses || 0,
    completedModules: completedModules || 0,
    totalValidations: totalValidations || 0,
    studyHours: studyHours.toFixed(1)
  }
}

// File upload function for validation files
export async function uploadValidationFile(
  userId: string,
  file: File,
  fileName: string
): Promise<string> {
  try {
    // Create a unique file path
    const timestamp = Date.now()
    const filePath = `validation-files/${userId}/${timestamp}-${fileName}`
    
    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage
      .from('wound_notes')
      .upload(filePath, file)
    
    if (error) {
      console.error('Error uploading file:', error)
      throw error
    }
    
    // Get the public URL of the uploaded file
    const { data: urlData } = supabase.storage
      .from('wound_notes')
      .getPublicUrl(filePath)
    
    return urlData.publicUrl
  } catch (error) {
    console.error('uploadValidationFile failed:', error)
    throw error
  }
}

// User Management Functions
export async function getProfiles() {
  try {
    console.log('Fetching all user profiles...')
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    
    console.log('Profiles query result:', { data, error, count: data?.length })
    
    if (error) {
      console.error('Error fetching profiles:', error)
      throw error
    }
    
    return data as Profile[]
  } catch (err) {
    console.error('getProfiles failed:', err)
    throw err
  }
}

export async function getUserProfile(userId: string): Promise<Profile | null> {
  try {
    console.log('Fetching user profile:', userId)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    console.log('User profile query result:', { data, error })

    if (error) {
      console.error('Error fetching user profile:', error)
      throw error
    }

    return (data as Profile) ?? null
  } catch (err) {
    console.error('getUserProfile failed:', err)
    throw err
  }
}

export async function updateProfile(id: string, updates: Partial<Profile>): Promise<Profile | null> {
  try {
    const timestamp = new Date().toISOString()
    const updatePayload = {
      ...updates,
      updated_at: timestamp,
    }

    console.log('Updating profile:', { id, updates: updatePayload })

    const { data: existing, error: existingError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (existingError) {
      console.error('Error fetching existing profile before update:', existingError)
      throw existingError
    }

    if (!existing) {
      const { data: authData, error: authError } = await supabase.auth.getUser()

      if (authError) {
        console.error('Error fetching auth user for profile insert:', authError)
        throw authError
      }

      const authUser = authData?.user
      const fallbackEmail = updatePayload.email ?? authUser?.email

      if (!fallbackEmail) {
        throw new Error('Cannot insert profile without email')
      }

      const insertPayload = {
        id,
        email: fallbackEmail,
        full_name: updatePayload.full_name ?? (authUser?.user_metadata?.full_name ?? fallbackEmail),
        is_active: updatePayload.is_active ?? true,
        role: updatePayload.role ?? 'user',
        last_sign_in_at: updatePayload.last_sign_in_at ?? null,
        created_at: timestamp,
        updated_at: timestamp,
      }

      console.log('Profile missing, inserting new record:', insertPayload)

      const { data: inserted, error: insertError } = await supabase
        .from('profiles')
        .insert(insertPayload)
        .select()
        .maybeSingle()

      if (insertError) {
        console.error('Error inserting profile:', insertError)
        throw insertError
      }

      return (inserted as Profile) ?? null
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error updating profile:', error)
      throw error
    }

    return (data as Profile) ?? null
  } catch (err) {
    console.error('updateProfile failed:', err)
    throw err
  }
}

export async function resetUserMFA(userId: string) {
  try {
    console.log('Resetting MFA for user:', userId)
    // This would typically require a Supabase Admin API call or Edge Function
    // For now, we'll return a placeholder response
    console.warn('MFA reset not implemented - requires Supabase Admin API or Edge Function')
    return { success: false, message: 'MFA reset requires backend implementation' }
  } catch (err) {
    console.error('resetUserMFA failed:', err)
    throw err
  }
}

export async function resetUserPassword(userId: string) {
  try {
    console.log('Resetting password for user:', userId)
    // This would typically require a Supabase Admin API call or Edge Function
    // For now, we'll return a placeholder response
    console.warn('Password reset not implemented - requires Supabase Admin API or Edge Function')
    return { success: false, message: 'Password reset requires backend implementation' }
  } catch (err) {
    console.error('resetUserPassword failed:', err)
    throw err
  }
}

export async function enforceSingleSession(userId: string) {
  try {
    console.log('Enforcing single session for user:', userId)
    // This would typically require a Supabase Admin API call or Edge Function
    // For now, we'll return a placeholder response
    console.warn('Single session enforcement not implemented - requires Supabase Admin API or Edge Function')
    return { success: false, message: 'Single session enforcement requires backend implementation' }
  } catch (err) {
    console.error('enforceSingleSession failed:', err)
    throw err
  }
}

// Enhanced Course Management Functions
export async function createCourse(courseData: Omit<Course, 'id' | 'created_at' | 'updated_at'>) {
  try {
    console.log('Creating new course:', courseData)
    const { data, error } = await supabase
      .from('courses')
      .insert({
        ...courseData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()
    
    console.log('Course creation result:', { data, error })
    
    if (error) {
      console.error('Error creating course:', error)
      throw error
    }
    
    return data as Course
  } catch (err) {
    console.error('createCourse failed:', err)
    throw err
  }
}

export async function updateCourse(id: string, updates: Partial<Course>) {
  try {
    console.log('Updating course:', { id, updates })
    const { data, error } = await supabase
      .from('courses')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    
    console.log('Course update result:', { data, error })
    
    if (error) {
      console.error('Error updating course:', error)
      throw error
    }
    
    return data as Course
  } catch (err) {
    console.error('updateCourse failed:', err)
    throw err
  }
}

export async function deleteCourse(id: string) {
  try {
    console.log('Deleting course:', id)
    // First delete all modules in the course (CASCADE should handle this, but being explicit)
    const { error: modulesError } = await supabase
      .from('modules')
      .delete()
      .eq('course_id', id)
    
    if (modulesError) {
      console.error('Error deleting course modules:', modulesError)
      throw modulesError
    }
    
    // Then delete the course
    const { data, error } = await supabase
      .from('courses')
      .delete()
      .eq('id', id)
      .select()
      .single()
    
    console.log('Course deletion result:', { data, error })
    
    if (error) {
      console.error('Error deleting course:', error)
      throw error
    }
    
    return data
  } catch (err) {
    console.error('deleteCourse failed:', err)
    throw err
  }
}

export async function publishCourse(id: string, published: boolean) {
  try {
    console.log('Publishing/unpublishing course:', { id, published })
    return await updateCourse(id, { published })
  } catch (err) {
    console.error('publishCourse failed:', err)
    throw err
  }
}

export async function reorderCourses(courseIds: string[]) {
  try {
    console.log('Reordering courses:', courseIds)
    const updates = courseIds.map((id, index) => ({
      id,
      order_index: index + 1,
      updated_at: new Date().toISOString()
    }))
    
    const { data, error } = await supabase
      .from('courses')
      .upsert(updates)
      .select()
    
    console.log('Course reorder result:', { data, error })
    
    if (error) {
      console.error('Error reordering courses:', error)
      throw error
    }
    
    return data as Course[]
  } catch (err) {
    console.error('reorderCourses failed:', err)
    throw err
  }
}

// Enhanced Module Management Functions
export async function createModule(moduleData: Omit<Module, 'id' | 'created_at' | 'updated_at'>) {
  try {
    console.log('Creating new module:', moduleData)
    const { data, error } = await supabase
      .from('modules')
      .insert({
        ...moduleData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()
    
    console.log('Module creation result:', { data, error })
    
    if (error) {
      console.error('Error creating module:', error)
      throw error
    }
    
    return data as Module
  } catch (err) {
    console.error('createModule failed:', err)
    throw err
  }
}

export async function updateModule(id: string, updates: Partial<Module>) {
  try {
    console.log('Updating module:', { id, updates })
    const { data, error } = await supabase
      .from('modules')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    
    console.log('Module update result:', { data, error })
    
    if (error) {
      console.error('Error updating module:', error)
      throw error
    }
    
    return data as Module
  } catch (err) {
    console.error('updateModule failed:', err)
    throw err
  }
}

export async function deleteModule(id: string) {
  try {
    console.log('Deleting module:', id)
    const { data, error } = await supabase
      .from('modules')
      .delete()
      .eq('id', id)
      .select()
      .single()
    
    console.log('Module deletion result:', { data, error })
    
    if (error) {
      console.error('Error deleting module:', error)
      throw error
    }
    
    return data
  } catch (err) {
    console.error('deleteModule failed:', err)
    throw err
  }
}

export async function publishModule(id: string, published: boolean) {
  try {
    console.log('Publishing/unpublishing module:', { id, published })
    return await updateModule(id, { published })
  } catch (err) {
    console.error('publishModule failed:', err)
    throw err
  }
}

export async function reorderModules(courseId: string, moduleIds: string[]) {
  try {
    console.log('Reordering modules:', { courseId, moduleIds })
    const updates = moduleIds.map((id, index) => ({
      id,
      course_id: courseId,
      order_index: index + 1,
      updated_at: new Date().toISOString()
    }))
    
    const { data, error } = await supabase
      .from('modules')
      .upsert(updates)
      .select()
    
    console.log('Module reorder result:', { data, error })
    
    if (error) {
      console.error('Error reordering modules:', error)
      throw error
    }
    
    return data as Module[]
  } catch (err) {
    console.error('reorderModules failed:', err)
    throw err
  }
}

// Reports (Validation History) Functions
export async function getAllValidationHistory(limit: number = 50) {
  try {
    console.log('Fetching all validation history for admin...')
    
    // First get validation history
    const { data: validationData, error: validationError } = await supabase
      .from('validation_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (validationError) {
      console.error('Error fetching validation history:', validationError)
      throw validationError
    }
    
    // Then get user profiles for each validation record
    const userIds = [...new Set(validationData.map(v => v.user_id))]
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds)
    
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
      throw profilesError
    }
    
    // Combine the data
    const data = validationData.map(validation => ({
      ...validation,
      profiles: profilesData.find(profile => profile.id === validation.user_id) || null
    }))
    
    console.log('All validation history query result:', { data, count: data?.length })
    
    return data as (ValidationHistory & { profiles: Pick<Profile, 'full_name' | 'email'> })[]
  } catch (err) {
    console.error('getAllValidationHistory failed:', err)
    throw err
  }
}

export async function deleteValidationRecord(id: string) {
  try {
    console.log('Deleting validation record:', id)
    const { data, error } = await supabase
      .from('validation_history')
      .delete()
      .eq('id', id)
      .select()
      .single()
    
    console.log('Validation record deletion result:', { data, error })
    
    if (error) {
      console.error('Error deleting validation record:', error)
      throw error
    }
    
    return data
  } catch (err) {
    console.error('deleteValidationRecord failed:', err)
    throw err
  }
}

export async function archiveValidationRecord(id: string) {
  try {
    console.log('Archiving validation record:', id)
    const { data, error } = await supabase
      .from('validation_history')
      .update({
        status: 'archived',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    
    console.log('Validation record archive result:', { data, error })
    
    if (error) {
      console.error('Error archiving validation record:', error)
      throw error
    }
    
    return data as ValidationHistory
  } catch (err) {
    console.error('archiveValidationRecord failed:', err)
    throw err
  }
}

// Get user's course progress for dashboard
export async function getUserCourseProgress(userId: string) {
  try {
    console.log('Fetching user course progress for:', userId);
    
    // Get all published courses
    const courses = await getCourses();
    
    // Get user's progress
    const userProgress = await getUserProgress(userId);
    
    // Calculate progress for each course
    const courseProgressData = await Promise.all(
      courses.map(async (course) => {
        try {
          // Get modules for this course
          const modules = await getCourseModules(course.id);
          const totalModules = modules.length;
          
          // Count completed modules for this course
          const completedModules = userProgress.filter(
            progress => progress.course_id === course.id && progress.completed
          );
          const completedModulesCount = completedModules.length;
          
          // Calculate progress percentage
          const progress = totalModules > 0 ? Math.round((completedModulesCount / totalModules) * 100) : 0;
          
          return {
            ...course,
            progress,
            totalModules,
            completedModulesCount,
            isStarted: completedModulesCount > 0,
            isCompleted: completedModulesCount === totalModules && totalModules > 0
          };
        } catch (error) {
          console.error(`Error calculating progress for course ${course.id}:`, error);
          return {
            ...course,
            progress: 0,
            totalModules: 0,
            completedModulesCount: 0,
            isStarted: false,
            isCompleted: false
          };
        }
      })
    );
    
    console.log('Course progress data:', courseProgressData);
    return courseProgressData;
  } catch (error) {
    console.error('getUserCourseProgress failed:', error);
    throw error;
  }
}

// Get a single course by ID
export async function getCourseById(courseId: string) {
  try {
    console.log('Fetching course by ID:', courseId);
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .eq('published', true)
      .single();
    
    if (error) {
      console.error('Error fetching course by ID:', error);
      throw error;
    }
    
    return data as Course;
  } catch (err) {
    console.error('getCourseById failed:', err);
    throw err;
  }
}

// Helper function to check if user is admin
export async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    const profile = await getUserProfile(userId)
    return profile?.role === 'admin'
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
}


