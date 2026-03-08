import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// GET /api/admin/validations?limit=50
// Returns latest validation_history records joined with basic user profile fields.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')

    let limit = 50
    if (limitParam !== null) {
      const parsed = Number(limitParam)
      if (!Number.isFinite(parsed)) {
        return NextResponse.json({ error: 'Invalid limit parameter' }, { status: 400 })
      }
      limit = Math.max(1, Math.min(200, Math.floor(parsed)))
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Require a valid user access token so RLS can authorize admin access via policies
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      // Forward the caller's JWT to Supabase so RLS evaluates with the user context
      global: { headers: { Authorization: authHeader } },
    })

    const { data, error } = await supabase
      .from('validation_history')
      .select('*, profiles(full_name,email)')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('/api/admin/validations query error', {
        code: (error as any)?.code,
        message: error.message,
        details: (error as any)?.details,
        hint: (error as any)?.hint,
      })
      return NextResponse.json({ error: 'Failed to fetch validations' }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('/api/admin/validations unexpected error', err)
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 })
  }
}

