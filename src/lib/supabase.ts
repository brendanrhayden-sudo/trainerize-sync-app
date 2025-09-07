import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Get environment variables with fallbacks
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key'

// Check if configuration is valid
export const isSupabaseConfigured = () => {
  return supabaseUrl !== 'https://placeholder.supabase.co' && 
         supabaseAnonKey !== 'placeholder-anon-key'
}

// Create clients with fallback values - they will work for build but fail gracefully at runtime if not configured
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceRoleKey)

// Runtime validation function for actual usage
export const validateSupabaseConfig = () => {
  if (!isSupabaseConfigured()) {
    if (typeof window !== 'undefined') {
      console.warn('Supabase not configured. Some features may not work.')
    }
    return false
  }
  return true
}

// Safe wrapper for Supabase operations
export const safeSupabaseOperation = async <T>(
  operation: () => Promise<T>,
  fallback: T
): Promise<T> => {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured, using fallback value')
    return fallback
  }
  
  try {
    return await operation()
  } catch (error) {
    console.error('Supabase operation failed:', error)
    return fallback
  }
}