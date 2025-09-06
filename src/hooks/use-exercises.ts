'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Exercise, FilterState, PaginationState, ApiResponse, LoadingState, ErrorState } from '@/types'

interface UseExercisesReturn {
  exercises: Exercise[]
  total: number
  totalPages: number
  loading: LoadingState
  error: ErrorState
  filters: FilterState
  pagination: PaginationState
  setFilters: (filters: Partial<FilterState>) => void
  setPagination: (pagination: Partial<PaginationState>) => void
  refetch: () => Promise<void>
  deleteExercise: (id: string) => Promise<void>
  bulkOperation: (operation: string, ids: string[], data?: any) => Promise<void>
}

const initialFilters: FilterState = {
  search: '',
  category: '',
  muscleGroup: '',
  equipment: '',
  difficultyLevel: '',
  syncStatus: '',
  isActive: null
}

const initialPagination: PaginationState = {
  pageIndex: 0,
  pageSize: 10
}

const initialLoading: LoadingState = {
  exercises: false,
  sync: false,
  bulk: false,
  delete: false
}

const initialError: ErrorState = {
  exercises: null,
  sync: null,
  bulk: null,
  delete: null
}

export function useExercises(): UseExercisesReturn {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState<LoadingState>(initialLoading)
  const [error, setError] = useState<ErrorState>(initialError)
  const [filters, setFiltersState] = useState<FilterState>(initialFilters)
  const [pagination, setPaginationState] = useState<PaginationState>(initialPagination)

  const fetchExercises = useCallback(async () => {
    setLoading(prev => ({ ...prev, exercises: true }))
    setError(prev => ({ ...prev, exercises: null }))

    try {
      const params = new URLSearchParams({
        page: (pagination.pageIndex + 1).toString(),
        pageSize: pagination.pageSize.toString(),
      })

      if (filters.search) params.set('search', filters.search)
      if (filters.category) params.set('category', filters.category)
      if (filters.muscleGroup) params.set('muscleGroup', filters.muscleGroup)
      if (filters.equipment) params.set('equipment', filters.equipment)
      if (filters.difficultyLevel) params.set('difficultyLevel', filters.difficultyLevel)
      if (filters.syncStatus) params.set('syncStatus', filters.syncStatus)
      if (filters.isActive !== null) params.set('isActive', filters.isActive.toString())

      const response = await fetch(`/api/exercises?${params}`)
      const result: ApiResponse = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch exercises')
      }

      setExercises(result.data.exercises)
      setTotal(result.data.pagination.total)
      setTotalPages(result.data.pagination.totalPages)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch exercises'
      setError(prev => ({ ...prev, exercises: errorMessage }))
      setExercises([])
      setTotal(0)
      setTotalPages(0)
    } finally {
      setLoading(prev => ({ ...prev, exercises: false }))
    }
  }, [filters, pagination])

  const deleteExercise = useCallback(async (id: string) => {
    setLoading(prev => ({ ...prev, delete: true }))
    setError(prev => ({ ...prev, delete: null }))

    try {
      const response = await fetch(`/api/exercises/${id}`, {
        method: 'DELETE'
      })
      
      const result: ApiResponse = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete exercise')
      }

      await fetchExercises()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete exercise'
      setError(prev => ({ ...prev, delete: errorMessage }))
    } finally {
      setLoading(prev => ({ ...prev, delete: false }))
    }
  }, [fetchExercises])

  const bulkOperation = useCallback(async (operation: string, ids: string[], data?: any) => {
    setLoading(prev => ({ ...prev, bulk: true }))
    setError(prev => ({ ...prev, bulk: null }))

    try {
      const response = await fetch('/api/exercises/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ operation, ids, data })
      })
      
      const result: ApiResponse = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Bulk operation failed')
      }

      await fetchExercises()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Bulk operation failed'
      setError(prev => ({ ...prev, bulk: errorMessage }))
    } finally {
      setLoading(prev => ({ ...prev, bulk: false }))
    }
  }, [fetchExercises])

  const setFilters = useCallback((newFilters: Partial<FilterState>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }))
    setPaginationState(prev => ({ ...prev, pageIndex: 0 }))
  }, [])

  const setPagination = useCallback((newPagination: Partial<PaginationState>) => {
    setPaginationState(prev => ({ ...prev, ...newPagination }))
  }, [])

  const refetch = useCallback(async () => {
    await fetchExercises()
  }, [fetchExercises])

  useEffect(() => {
    fetchExercises()
  }, [fetchExercises])

  return {
    exercises,
    total,
    totalPages,
    loading,
    error,
    filters,
    pagination,
    setFilters,
    setPagination,
    refetch,
    deleteExercise,
    bulkOperation
  }
}