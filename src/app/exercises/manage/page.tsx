"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { BulkAddToTrainerize } from "@/components/exercises/BulkAddToTrainerize"
import { Search, Filter, Plus, RefreshCw } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface Exercise {
  id: string
  name: string
  description?: string
  muscle_groups?: string[]
  equipment?: string[]
  difficulty_level?: string
  category?: string
  video_url?: string
  instructions?: string
  trainerize_id?: string
  sync_status?: 'pending' | 'synced' | 'error'
  synced_at?: string
  created_at: string
  updated_at: string
}

export default function ExerciseManagePage() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([])
  const [selectedExercises, setSelectedExercises] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [syncFilter, setSyncFilter] = useState<"all" | "unsynced" | "synced" | "error">("all")
  const [loading, setLoading] = useState(true)
  const [showBulkAdd, setShowBulkAdd] = useState(false)

  const loadExercises = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading exercises:', error)
        return
      }

      setExercises((data || []) as Exercise[])
    } catch (error) {
      console.error('Error loading exercises:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadExercises()
  }, [])

  useEffect(() => {
    let filtered = exercises

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(exercise =>
        exercise.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exercise.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply sync status filter
    if (syncFilter !== "all") {
      filtered = filtered.filter(exercise => {
        switch (syncFilter) {
          case "unsynced":
            return !exercise.trainerize_id || exercise.sync_status !== 'synced'
          case "synced":
            return exercise.trainerize_id && exercise.sync_status === 'synced'
          case "error":
            return exercise.sync_status === 'error'
          default:
            return true
        }
      })
    }

    setFilteredExercises(filtered)
  }, [exercises, searchTerm, syncFilter])

  const handleSelectExercise = (exerciseId: string, checked: boolean) => {
    if (checked) {
      setSelectedExercises(prev => [...prev, exerciseId])
    } else {
      setSelectedExercises(prev => prev.filter(id => id !== exerciseId))
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const unsyncedIds = filteredExercises
        .filter(exercise => !exercise.trainerize_id || exercise.sync_status !== 'synced')
        .map(exercise => exercise.id)
      setSelectedExercises(unsyncedIds)
    } else {
      setSelectedExercises([])
    }
  }

  const addSingleExercise = async (exercise: Exercise) => {
    try {
      const response = await fetch('/api/exercises/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exerciseId: exercise.id,
          addToTrainerize: true
        })
      })

      const result = await response.json()
      
      if (result.success) {
        // Refresh exercise data
        loadExercises()
      }
      
      return result
    } catch (error) {
      console.error('Error adding single exercise:', error)
      return { success: false, error: 'Network error' }
    }
  }

  const getSyncStatusBadge = (exercise: Exercise) => {
    if (exercise.trainerize_id && exercise.sync_status === 'synced') {
      return <Badge className="bg-green-100 text-green-800">Synced</Badge>
    }
    if (exercise.sync_status === 'error') {
      return <Badge className="bg-red-100 text-red-800">Error</Badge>
    }
    return <Badge className="bg-yellow-100 text-yellow-800">Unsynced</Badge>
  }

  const canAddToTrainerize = (exercise: Exercise) => {
    return !exercise.trainerize_id || exercise.sync_status !== 'synced'
  }

  const unsyncedCount = filteredExercises.filter(exercise => 
    !exercise.trainerize_id || exercise.sync_status !== 'synced'
  ).length

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Exercise Management</h1>
          <p className="text-muted-foreground">
            Manage and sync exercises with Trainerize
          </p>
        </div>
        <Button onClick={loadExercises} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="search">Search Exercises</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div>
              <Label>Sync Status Filter</Label>
              <div className="flex gap-2 mt-2">
                {[
                  { value: "all", label: "All" },
                  { value: "unsynced", label: "Unsynced" },
                  { value: "synced", label: "Synced" },
                  { value: "error", label: "Error" }
                ].map((filter) => (
                  <Button
                    key={filter.value}
                    variant={syncFilter === filter.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSyncFilter(filter.value as any)}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-end">
              <div className="text-sm text-muted-foreground">
                <p>Total: {filteredExercises.length}</p>
                <p>Unsynced: {unsyncedCount}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Operations */}
      {unsyncedCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Bulk Operations
            </CardTitle>
            <CardDescription>
              Select exercises to add to Trainerize in bulk
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <Checkbox
                id="select-all"
                checked={selectedExercises.length === unsyncedCount}
                onCheckedChange={handleSelectAll}
              />
              <Label htmlFor="select-all">
                Select all unsynced exercises ({unsyncedCount})
              </Label>
            </div>

            {selectedExercises.length > 0 && (
              <div className="flex items-center gap-4">
                <Badge variant="outline">
                  {selectedExercises.length} selected
                </Badge>
                <Button
                  onClick={() => setShowBulkAdd(true)}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Selected to Trainerize
                </Button>
              </div>
            )}

            {showBulkAdd && selectedExercises.length > 0 && (
              <BulkAddToTrainerize
                exerciseIds={selectedExercises}
                onComplete={() => {
                  loadExercises()
                  setSelectedExercises([])
                  setShowBulkAdd(false)
                }}
                skipExisting={true}
                checkForDuplicates={true}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Exercise List */}
      <Card>
        <CardHeader>
          <CardTitle>Exercises</CardTitle>
          <CardDescription>
            {filteredExercises.length} exercises found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Loading exercises...
            </div>
          ) : filteredExercises.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No exercises found matching your filters
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredExercises.map((exercise) => (
                <div
                  key={exercise.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex items-center space-x-3">
                    {canAddToTrainerize(exercise) && (
                      <Checkbox
                        checked={selectedExercises.includes(exercise.id)}
                        onCheckedChange={(checked) => 
                          handleSelectExercise(exercise.id, checked as boolean)
                        }
                      />
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium truncate">{exercise.name}</h4>
                        {getSyncStatusBadge(exercise)}
                      </div>
                      
                      {exercise.description && (
                        <p className="text-sm text-muted-foreground truncate">
                          {exercise.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        {exercise.muscle_groups?.length && (
                          <span>Muscles: {exercise.muscle_groups.join(', ')}</span>
                        )}
                        {exercise.equipment?.length && (
                          <span>Equipment: {exercise.equipment.join(', ')}</span>
                        )}
                        {exercise.difficulty_level && (
                          <span>Difficulty: {exercise.difficulty_level}</span>
                        )}
                      </div>
                      
                      {exercise.trainerize_id && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Trainerize ID: {exercise.trainerize_id}
                          {exercise.synced_at && (
                            <span className="ml-2">
                              Synced: {new Date(exercise.synced_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {canAddToTrainerize(exercise) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addSingleExercise(exercise)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}