export interface TrainerizeExercise {
  id: string
  name: string
  description?: string
  category?: TrainerizeCategory
  muscle_groups?: string[]
  equipment?: TrainerizeEquipment[]
  instructions?: string
  video?: TrainerizeMedia
  thumbnail?: TrainerizeMedia
  difficulty_level?: 'beginner' | 'intermediate' | 'advanced'
  is_active: boolean
  created_at: string
  updated_at: string
  metadata?: Record<string, any>
}

export interface TrainerizeCategory {
  id: string
  name: string
  description?: string
}

export interface TrainerizeEquipment {
  id: string
  name: string
  description?: string
}

export interface TrainerizeMedia {
  id: string
  url: string
  type: 'video' | 'image'
  thumbnail_url?: string
  duration?: number
}

export interface TrainerizeApiResponse<T> {
  data: T[]
  pagination?: {
    current_page: number
    per_page: number
    total: number
    total_pages: number
  }
  meta?: Record<string, any>
}

export interface TrainerizeApiError {
  error: {
    code: string
    message: string
    details?: Record<string, any>
  }
}

export interface TrainerizeAuthToken {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  refresh_token?: string
  scope?: string
}

export interface TrainerizeClient {
  id: string
  name: string
  email: string
  is_active: boolean
}

export interface SyncOperation {
  id: string
  type: 'create' | 'update' | 'delete'
  entity_type: 'exercise'
  entity_id: string
  status: 'pending' | 'completed' | 'failed'
  error_message?: string
  trainerize_data?: TrainerizeExercise
  supabase_data?: any
  created_at: string
  processed_at?: string
}

export interface TrainerizeExerciseUpdate {
  id: number
  name?: string
  alternateName?: string
  description?: string
  recordType?: string
  tag?: string
  videoUrl?: string
  videoType?: string
  tags?: Array<{ type: string; name: string }>
}

export interface SyncStats {
  total_exercises: number
  synced_exercises: number
  pending_exercises: number
  failed_exercises: number
  last_sync_at?: string
  sync_in_progress: boolean
}