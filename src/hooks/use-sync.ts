'use client'

import { useState, useCallback } from 'react'
import type { ApiResponse } from '@/types'

interface SyncResult {
  syncId: string
  processed: number
  created: number
  updated: number
}

interface UseSyncReturn {
  isLoading: boolean
  error: string | null
  lastSync: SyncResult | null
  startSync: (type?: 'full' | 'incremental' | 'manual') => Promise<void>
}

export function useSync(): UseSyncReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<SyncResult | null>(null)

  const startSync = useCallback(async (type: 'full' | 'incremental' | 'manual' = 'manual') => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type })
      })

      const result: ApiResponse<SyncResult> = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Sync failed')
      }

      setLastSync(result.data!)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sync failed'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    isLoading,
    error,
    lastSync,
    startSync
  }
}