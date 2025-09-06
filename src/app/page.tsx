'use client'

import React from 'react'
import { RefreshCw, Upload, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { ExercisesTable } from '@/components/exercises/exercises-table'
import { ExercisesFilters } from '@/components/exercises/exercises-filters'
import { ExercisesPagination } from '@/components/exercises/exercises-pagination'
import { useExercises } from '@/hooks/use-exercises'
import { useSync } from '@/hooks/use-sync'

export default function Dashboard() {
  const {
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
  } = useExercises()

  const { isLoading: isSyncing, error: syncError, lastSync, startSync } = useSync()

  const handleSync = async () => {
    try {
      await startSync('manual')
      toast.success('Sync completed successfully!')
      await refetch()
    } catch {
      toast.error('Sync failed. Please try again.')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteExercise(id)
      toast.success('Exercise deleted successfully!')
    } catch {
      toast.error('Failed to delete exercise')
    }
  }

  const handleBulkOperation = async (operation: string, ids: string[]) => {
    try {
      await bulkOperation(operation, ids)
      
      const operationLabels = {
        delete: 'deleted',
        activate: 'activated',
        deactivate: 'deactivated',
        sync: 'synced'
      }
      
      const label = operationLabels[operation as keyof typeof operationLabels] || operation
      toast.success(`Exercises ${label} successfully!`)
    } catch {
      toast.error(`Failed to ${operation} exercises`)
    }
  }

  const resetFilters = () => {
    setFilters({
      search: '',
      category: '',
      muscleGroup: '',
      equipment: '',
      difficultyLevel: '',
      syncStatus: '',
      isActive: null
    })
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exercise Management</h1>
          <p className="text-muted-foreground">
            Manage and sync exercises between Trainerize and your database
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={refetch} disabled={loading.exercises}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading.exercises ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleSync} disabled={isSyncing}>
            {isSyncing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Sync from Trainerize
              </>
            )}
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Exercise
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Exercises</CardTitle>
            <div className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
            <p className="text-xs text-muted-foreground">
              exercises in database
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Synced</CardTitle>
            <div className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {exercises.filter(e => e.sync_status === 'synced').length}
            </div>
            <p className="text-xs text-muted-foreground">
              successfully synced
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <div className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {exercises.filter(e => e.sync_status === 'pending').length}
            </div>
            <p className="text-xs text-muted-foreground">
              pending sync
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
            <div className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {exercises.filter(e => e.sync_status === 'error').length}
            </div>
            <p className="text-xs text-muted-foreground">
              sync errors
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Last Sync Info */}
      {lastSync && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Last Sync</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4 text-sm">
              <span>Processed: <strong>{lastSync.processed}</strong></span>
              <span>Created: <strong>{lastSync.created}</strong></span>
              <span>Updated: <strong>{lastSync.updated}</strong></span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Messages */}
      {(error.exercises || error.sync || syncError) && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-destructive">Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {error.exercises && (
                <p className="text-destructive">{error.exercises}</p>
              )}
              {(error.sync || syncError) && (
                <p className="text-destructive">{error.sync || syncError}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Filter and search exercises
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExercisesFilters
            filters={filters}
            onFiltersChange={setFilters}
            onReset={resetFilters}
          />
        </CardContent>
      </Card>

      {/* Exercises Table */}
      <Card>
        <CardHeader>
          <CardTitle>Exercises</CardTitle>
          <CardDescription>
            {total} exercise{total !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ExercisesTable
            exercises={exercises}
            loading={loading.exercises}
            onDelete={handleDelete}
            onBulkOperation={handleBulkOperation}
          />
          <ExercisesPagination
            pagination={pagination}
            total={total}
            totalPages={totalPages}
            onPaginationChange={setPagination}
          />
        </CardContent>
      </Card>
    </div>
  )
}
