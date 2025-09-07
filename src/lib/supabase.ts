import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Get environment variables with fallbacks
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key'

// Create clients with fallback values - they will work for build but fail gracefully at runtime if not configured
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceRoleKey)

// Runtime validation function for actual usage
export const validateSupabaseConfig = () => {
  if (typeof window !== 'undefined' || process.env.NODE_ENV !== 'development') {
    // Only validate in runtime scenarios that need real connections
    if (supabaseUrl === 'https://placeholder.supabase.co') {
      console.warn('Supabase not configured: NEXT_PUBLIC_SUPABASE_URL is missing')
      return false
    }
    if (supabaseAnonKey === 'placeholder-anon-key') {
      console.warn('Supabase not configured: NEXT_PUBLIC_SUPABASE_ANON_KEY is missing')
      return false
    }
    if (supabaseServiceRoleKey === 'placeholder-service-key') {
      console.warn('Supabase not configured: SUPABASE_SERVICE_ROLE_KEY is missing')
      return false
    }
  }
  return true
}