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
      training_programs: {
        Row: {
          id: string
          name: string
          description: string | null
          difficulty_level: 'beginner' | 'intermediate' | 'advanced' | null
          duration_weeks: number
          goals: string[]
          equipment_required: string[]
          trainerize_program_id: string | null
          sync_status: 'pending' | 'synced' | 'error'
          synced_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          difficulty_level?: 'beginner' | 'intermediate' | 'advanced' | null
          duration_weeks?: number
          goals?: string[]
          equipment_required?: string[]
          trainerize_program_id?: string | null
          sync_status?: 'pending' | 'synced' | 'error'
          synced_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          difficulty_level?: 'beginner' | 'intermediate' | 'advanced' | null
          duration_weeks?: number
          goals?: string[]
          equipment_required?: string[]
          trainerize_program_id?: string | null
          sync_status?: 'pending' | 'synced' | 'error'
          synced_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      training_plans: {
        Row: {
          id: string
          program_id: string
          name: string
          duration_weeks: number
          workouts_per_week: number
          trainerize_plan_id: string | null
          sync_status: 'pending' | 'synced' | 'error'
          synced_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          program_id: string
          name: string
          duration_weeks?: number
          workouts_per_week?: number
          trainerize_plan_id?: string | null
          sync_status?: 'pending' | 'synced' | 'error'
          synced_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          program_id?: string
          name?: string
          duration_weeks?: number
          workouts_per_week?: number
          trainerize_plan_id?: string | null
          sync_status?: 'pending' | 'synced' | 'error'
          synced_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      plan_workouts: {
        Row: {
          id: string
          training_plan_id: string
          workout_template_id: string | null
          day_of_week: number
          week_number: number
          order_in_day: number
          rest_day: boolean
          created_at: string
        }
        Insert: {
          id?: string
          training_plan_id: string
          workout_template_id?: string | null
          day_of_week: number
          week_number: number
          order_in_day?: number
          rest_day?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          training_plan_id?: string
          workout_template_id?: string | null
          day_of_week?: number
          week_number?: number
          order_in_day?: number
          rest_day?: boolean
          created_at?: string
        }
        Relationships: []
      }
      client_programs: {
        Row: {
          id: string
          client_id: string
          program_id: string
          start_date: string
          end_date: string | null
          status: 'active' | 'paused' | 'completed' | 'cancelled'
          progress_percentage: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          program_id: string
          start_date?: string
          end_date?: string | null
          status?: 'active' | 'paused' | 'completed' | 'cancelled'
          progress_percentage?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          program_id?: string
          start_date?: string
          end_date?: string | null
          status?: 'active' | 'paused' | 'completed' | 'cancelled'
          progress_percentage?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      generation_rules: {
        Row: {
          id: string
          name: string
          fitness_level: 'beginner' | 'intermediate' | 'advanced'
          goals: string[]
          equipment_required: string[]
          workout_selection_criteria: Json
          program_structure: Json
          progression_rules: Json
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          fitness_level: 'beginner' | 'intermediate' | 'advanced'
          goals?: string[]
          equipment_required?: string[]
          workout_selection_criteria?: Json
          program_structure?: Json
          progression_rules?: Json
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          fitness_level?: 'beginner' | 'intermediate' | 'advanced'
          goals?: string[]
          equipment_required?: string[]
          workout_selection_criteria?: Json
          program_structure?: Json
          progression_rules?: Json
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      workout_templates: {
        Row: {
          id: string
          name: string
          trainerize_id: string | null
          workout_type: string | null
          exercise_count: number | null
          total_sets: number | null
          instructions: string | null
          synced_at: string | null
          sync_status: 'synced' | 'pending' | 'error'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          trainerize_id?: string | null
          workout_type?: string | null
          exercise_count?: number | null
          total_sets?: number | null
          instructions?: string | null
          synced_at?: string | null
          sync_status?: 'synced' | 'pending' | 'error'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          trainerize_id?: string | null
          workout_type?: string | null
          exercise_count?: number | null
          total_sets?: number | null
          instructions?: string | null
          synced_at?: string | null
          sync_status?: 'synced' | 'pending' | 'error'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
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