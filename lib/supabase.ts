import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cachedClient: SupabaseClient | null = null

function ensureSupabaseClient(): SupabaseClient {
  if (cachedClient) {
    return cachedClient
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
  }

  if (!supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable')
  }

  cachedClient = createClient(supabaseUrl, supabaseAnonKey)
  return cachedClient
}

export const getSupabaseClient = (): SupabaseClient => ensureSupabaseClient()

export const supabase = new Proxy({} as SupabaseClient, {
  get: (_target, property, receiver) => {
    const client = ensureSupabaseClient()
    const value = Reflect.get(client as unknown as Record<PropertyKey, unknown>, property, receiver)
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value
  },
}) as SupabaseClient

// Types for our database schema
export interface Course {
  id: string
  title: string
  description: string
  thumbnail: string
  created_at: string
  updated_at: string
  published: boolean
  order_index: number
}

export interface Module {
  id: string
  course_id: string
  title: string
  description: string
  video_url: string
  transcript: string
  duration: string
  order_index: number
  published: boolean
  created_at: string
  updated_at: string
}

export interface UserProgress {
  id: string
  user_id: string
  course_id: string
  module_id: string
  completed: boolean
  last_position: number
  completed_at?: string
  created_at: string
  updated_at: string
}

export interface ValidationHistory {
  id: string
  user_id: string
  file_name: string
  file_type: string
  state: string
  region: string
  status: 'processing' | 'completed' | 'failed'
  result_summary?: string
  result_details?: any
  n8n_execution_id?: string
  file_url?: string
  created_at: string
  updated_at: string
}

export interface RecentActivity {
  id: string
  user_id: string
  activity_type: 'course_completed' | 'module_completed' | 'note_validated' | 'course_started'
  title: string
  description: string
  metadata?: any
  created_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string
  is_active: boolean
  role: 'user' | 'admin'
  last_sign_in_at?: string
  created_at: string
  updated_at: string
}
