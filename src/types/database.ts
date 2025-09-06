export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      exercises: {
        Row: {
          id: string
          trainerize_id: string
          name: string
          description: string | null
          category: string | null
          muscle_groups: string[]
          equipment: string[]
          instructions: string | null
          video_url: string | null
          thumbnail_url: string | null
          difficulty_level: 'beginner' | 'intermediate' | 'advanced' | null
          is_active: boolean
          created_at: string
          updated_at: string
          synced_at: string | null
          sync_status: 'pending' | 'synced' | 'error' | 'deleted'
          metadata: Json | null
        }
        Insert: {
          id?: string
          trainerize_id: string
          name: string
          description?: string | null
          category?: string | null
          muscle_groups?: string[]
          equipment?: string[]
          instructions?: string | null
          video_url?: string | null
          thumbnail_url?: string | null
          difficulty_level?: 'beginner' | 'intermediate' | 'advanced' | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          synced_at?: string | null
          sync_status?: 'pending' | 'synced' | 'error' | 'deleted'
          metadata?: Json | null
        }
        Update: {
          id?: string
          trainerize_id?: string
          name?: string
          description?: string | null
          category?: string | null
          muscle_groups?: string[]
          equipment?: string[]
          instructions?: string | null
          video_url?: string | null
          thumbnail_url?: string | null
          difficulty_level?: 'beginner' | 'intermediate' | 'advanced' | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          synced_at?: string | null
          sync_status?: 'pending' | 'synced' | 'error' | 'deleted'
          metadata?: Json | null
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          id: string
          sync_type: 'full' | 'incremental' | 'manual'
          status: 'started' | 'completed' | 'failed'
          started_at: string
          completed_at: string | null
          records_processed: number
          records_created: number
          records_updated: number
          records_deleted: number
          error_message: string | null
          metadata: Json | null
        }
        Insert: {
          id?: string
          sync_type: 'full' | 'incremental' | 'manual'
          status?: 'started' | 'completed' | 'failed'
          started_at?: string
          completed_at?: string | null
          records_processed?: number
          records_created?: number
          records_updated?: number
          records_deleted?: number
          error_message?: string | null
          metadata?: Json | null
        }
        Update: {
          id?: string
          sync_type?: 'full' | 'incremental' | 'manual'
          status?: 'started' | 'completed' | 'failed'
          started_at?: string
          completed_at?: string | null
          records_processed?: number
          records_created?: number
          records_updated?: number
          records_deleted?: number
          error_message?: string | null
          metadata?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}