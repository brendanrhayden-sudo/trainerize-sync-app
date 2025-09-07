import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// During build time, environment variables might not be available
// We'll create clients with fallback values and check at runtime
const createSupabaseClient = () => {
  if (!supabaseUrl) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Missing env var: NEXT_PUBLIC_SUPABASE_URL')
    }
    // During build, use placeholder values
    return createClient<Database>('https://placeholder.supabase.co', 'placeholder-key')
  }

  if (!supabaseAnonKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Missing env var: NEXT_PUBLIC_SUPABASE_ANON_KEY')
    }
    return createClient<Database>('https://placeholder.supabase.co', 'placeholder-key')
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey)
}

const createSupabaseAdminClient = () => {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    }
    // During build, use placeholder values
    return createClient<Database>('https://placeholder.supabase.co', 'placeholder-service-key')
  }

  return createClient<Database>(supabaseUrl, supabaseServiceRoleKey)
}

export const supabase = createSupabaseClient()
export const supabaseAdmin = createSupabaseAdminClient()