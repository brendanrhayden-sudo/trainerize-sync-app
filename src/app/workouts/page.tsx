"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
// Tabs components not used in this component
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Search, 
  Plus, 
  MoreHorizontal, 
  RefreshCw, 
  Download, 
  Edit,
  Trash2,
  Copy,
  PlayCircle,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"

interface Workout {
  id: string
  name: string
  trainerize_id?: string
  workout_type?: string
  exercise_count?: number
  total_sets?: number
  instructions?: string
  synced_at?: string
  sync_status?: 'synced' | 'pending' | 'error'
  created_at: string
  updated_at: string
}

export default function WorkoutManagementPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [filteredWorkouts, setFilteredWorkouts] = useState<Workout[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [syncFilter, setSyncFilter] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [selectedWorkouts, setSelectedWorkouts] = useState<string[]>([])
  const [bulkOperationLoading, setBulkOperationLoading] = useState(false)

  const loadWorkouts = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('workout_templates')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading workouts:', error)
        return
      }

      setWorkouts((data || []) as Workout[])
    } catch (error) {
      console.error('Error loading workouts:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWorkouts()
  }, [])

  useEffect(() => {
    let filtered = workouts

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(workout =>
        workout.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        workout.instructions?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter(workout => workout.workout_type === typeFilter)
    }

    // Apply sync filter
    if (syncFilter !== "all") {
      if (syncFilter === "synced") {
        filtered = filtered.filter(workout => workout.trainerize_id && workout.sync_status === 'synced')
      } else if (syncFilter === "unsynced") {
        filtered = filtered.filter(workout => !workout.trainerize_id || workout.sync_status !== 'synced')
      } else if (syncFilter === "error") {
        filtered = filtered.filter(workout => workout.sync_status === 'error')
      }
    }

    setFilteredWorkouts(filtered)
  }, [workouts, searchTerm, typeFilter, syncFilter])

  const getSyncStatusBadge = (workout: Workout) => {
    if (workout.trainerize_id && workout.sync_status === 'synced') {
      return <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
        <CheckCircle className="h-3 w-3" />
        Synced
      </Badge>
    }
    if (workout.sync_status === 'error') {
      return <Badge className="bg-red-100 text-red-800 flex items-center gap-1">
        <XCircle className="h-3 w-3" />
        Error
      </Badge>
    }
    return <Badge className="bg-yellow-100 text-yellow-800 flex items-center gap-1">
      <AlertCircle className="h-3 w-3" />
      Pending
    </Badge>
  }

  const getWorkoutTypeBadge = (type?: string) => {
    const typeColors = {
      workoutRegular: 'bg-blue-100 text-blue-800',
      workoutCircuit: 'bg-purple-100 text-purple-800',
      workoutTimed: 'bg-orange-100 text-orange-800',
      workoutInterval: 'bg-red-100 text-red-800',
      cardio: 'bg-green-100 text-green-800'
    }
    
    const color = typeColors[type as keyof typeof typeColors] || 'bg-gray-100 text-gray-800'
    const displayName = type?.replace('workout', '') || 'Regular'
    
    return <Badge className={color}>{displayName}</Badge>
  }

  const handleSelectWorkout = (workoutId: string, checked: boolean) => {
    if (checked) {
      setSelectedWorkouts(prev => [...prev, workoutId])
    } else {
      setSelectedWorkouts(prev => prev.filter(id => id !== workoutId))
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedWorkouts(filteredWorkouts.map(w => w.id))
    } else {
      setSelectedWorkouts([])
    }
  }

  const handleBulkSync = async () => {
    setBulkOperationLoading(true)
    try {
      // This would typically call the workout sync API
      console.log('Syncing workouts:', selectedWorkouts)
      // For now, just simulate success
      setTimeout(() => {
        loadWorkouts()
        setSelectedWorkouts([])
        setBulkOperationLoading(false)
      }, 2000)
    } catch (error) {
      console.error('Bulk sync failed:', error)
      setBulkOperationLoading(false)
    }
  }

  const handleImportFromTrainerize = async () => {
    setBulkOperationLoading(true)
    try {
      // Call import API
      console.log('Importing from Trainerize...')
      setTimeout(() => {
        loadWorkouts()
        setBulkOperationLoading(false)
      }, 3000)
    } catch (error) {
      console.error('Import failed:', error)
      setBulkOperationLoading(false)
    }
  }

  const handleDeleteWorkout = async (workoutId: string) => {
    if (!confirm('Are you sure you want to delete this workout?')) return
    
    try {
      const { error } = await supabase
        .from('workout_templates')
        .delete()
        .eq('id', workoutId)

      if (error) throw error
      loadWorkouts()
    } catch (error) {
      console.error('Delete failed:', error)
    }
  }

  const handleDuplicateWorkout = async (workout: Workout) => {
    try {
      const { error } = await supabase
        .from('workout_templates')
        .insert([{
          name: `${workout.name} (Copy)`,
          workout_type: workout.workout_type,
          instructions: workout.instructions,
          exercise_count: workout.exercise_count,
          total_sets: workout.total_sets
        }])

      if (error) throw error
      loadWorkouts()
    } catch (error) {
      console.error('Duplicate failed:', error)
    }
  }

  const stats = {
    total: workouts.length,
    synced: workouts.filter(w => w.trainerize_id && w.sync_status === 'synced').length,
    pending: workouts.filter(w => !w.trainerize_id || w.sync_status === 'pending').length,
    errors: workouts.filter(w => w.sync_status === 'error').length
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Workout Management</h1>
          <p className="text-muted-foreground">
            Manage and sync workout templates between Supabase and Trainerize
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleImportFromTrainerize} disabled={bulkOperationLoading}>
            <Download className="h-4 w-4 mr-2" />
            Import from Trainerize
          </Button>
          <Link href="/workouts/builder">
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Workout
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Workouts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Synced</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.synced}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.errors}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Filters & Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search">Search Workouts</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div>
              <Label>Workout Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="workoutRegular">Regular</SelectItem>
                  <SelectItem value="workoutCircuit">Circuit</SelectItem>
                  <SelectItem value="workoutTimed">Timed</SelectItem>
                  <SelectItem value="workoutInterval">Interval</SelectItem>
                  <SelectItem value="cardio">Cardio</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Sync Status</Label>
              <Select value={syncFilter} onValueChange={setSyncFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="synced">Synced</SelectItem>
                  <SelectItem value="unsynced">Unsynced</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button 
                onClick={() => {
                  setSearchTerm("")
                  setTypeFilter("all")
                  setSyncFilter("all")
                }}
                variant="outline"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Operations */}
      {selectedWorkouts.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge variant="outline">
                  {selectedWorkouts.length} selected
                </Badge>
                <Button 
                  onClick={handleBulkSync} 
                  disabled={bulkOperationLoading}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Sync Selected
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setSelectedWorkouts([])}
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Workout Table */}
      <Card>
        <CardHeader>
          <CardTitle>Workouts</CardTitle>
          <CardDescription>
            {filteredWorkouts.length} workouts found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
              <span className="ml-2">Loading workouts...</span>
            </div>
          ) : filteredWorkouts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No workouts found matching your filters
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedWorkouts.length === filteredWorkouts.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Exercises</TableHead>
                  <TableHead>Sets</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Sync</TableHead>
                  <TableHead className="w-12">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWorkouts.map((workout) => (
                  <TableRow key={workout.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedWorkouts.includes(workout.id)}
                        onChange={(e) => handleSelectWorkout(workout.id, e.target.checked)}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{workout.name}</div>
                        {workout.instructions && (
                          <div className="text-sm text-muted-foreground truncate max-w-xs">
                            {workout.instructions}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getWorkoutTypeBadge(workout.workout_type)}
                    </TableCell>
                    <TableCell>
                      {workout.exercise_count || 0}
                    </TableCell>
                    <TableCell>
                      {workout.total_sets || 0}
                    </TableCell>
                    <TableCell>
                      {getSyncStatusBadge(workout)}
                    </TableCell>
                    <TableCell>
                      {workout.synced_at ? (
                        <div className="text-sm">
                          {new Date(workout.synced_at).toLocaleDateString()}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/workouts/builder?edit=${workout.id}`}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicateWorkout(workout)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <PlayCircle className="h-4 w-4 mr-2" />
                            Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteWorkout(workout.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}