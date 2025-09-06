import type { Database } from './database'

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

export type Exercise = Tables<'exercises'>
export type ExerciseInsert = TablesInsert<'exercises'>
export type ExerciseUpdate = TablesUpdate<'exercises'>

export type SyncLog = Tables<'sync_logs'>
export type SyncLogInsert = TablesInsert<'sync_logs'>
export type SyncLogUpdate = TablesUpdate<'sync_logs'>

export interface FilterState {
  search: string
  category: string
  muscleGroup: string
  equipment: string
  difficultyLevel: string
  syncStatus: string
  isActive: boolean | null
}

export interface SortState {
  column: keyof Exercise | null
  direction: 'asc' | 'desc'
}

export interface PaginationState {
  pageIndex: number
  pageSize: number
}

export interface BulkOperationResult {
  success: boolean
  processed: number
  errors: Array<{
    id: string
    message: string
  }>
}

export interface ApiResponse<T = any> {
  data?: T
  error?: string
  message?: string
  success: boolean
}

export interface LoadingState {
  exercises: boolean
  sync: boolean
  bulk: boolean
  delete: boolean
}

export interface ErrorState {
  exercises: string | null
  sync: string | null
  bulk: string | null
  delete: string | null
}

export * from './database'
export * from './trainerize'