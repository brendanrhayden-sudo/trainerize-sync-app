'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Play, 
  Square, 
  Download, 
  RefreshCw, 
  Search, 
  Database,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3
} from 'lucide-react'
import { toast } from 'sonner'

interface DiscoveryStats {
  totalExercises: number
  syncedExercises: number
  discoveryRunning: boolean
  recentDiscoveries: any[]
}

interface Exercise {
  id: string
  trainerize_id: string
  name: string
  category?: string
  muscle_groups?: string[]
  sync_status: string
  synced_at?: string
}

interface ProgressData {
  type: 'start' | 'progress' | 'exercise_saved' | 'complete' | 'error'
  message?: string
  current?: number
  total?: number
  found?: number
  saved?: number
  exercise?: any
}

export default function DiscoveryPage() {
  const [discoveryRunning, setDiscoveryRunning] = useState(false)
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [stats, setStats] = useState<DiscoveryStats | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [mode, setMode] = useState<'plans' | 'range'>('plans')
  const [userIds, setUserIds] = useState<string>('')
  const [startId, setStartId] = useState(1)
  const [endId, setEndId] = useState(10000)
  const [discoveredExercises, setDiscoveredExercises] = useState<any[]>([])
  
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    loadData()
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  const loadData = async () => {
    try {
      const response = await fetch('/api/trainerize/discover?stats=true')
      const result = await response.json()
      
      if (result.success) {
        setExercises(result.data.exercises || [])
        setStats(result.data.stats)
        setDiscoveryRunning(result.data.discoveryRunning)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
      toast.error('Failed to load discovery data')
    }
  }

  const startDiscovery = async () => {
    if (discoveryRunning) return

    setDiscoveryRunning(true)
    setProgress(null)
    setDiscoveredExercises([])

    try {
      const userIdList = userIds.split(',').map(id => parseInt(id.trim())).filter(Boolean)
      
      const response = await fetch('/api/trainerize/discover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mode,
          userIds: mode === 'plans' ? userIdList : [],
          startId: mode === 'range' ? startId : undefined,
          endId: mode === 'range' ? endId : undefined,
          stream: true
        })
      })

      if (!response.ok) {
        throw new Error('Failed to start discovery')
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body')
      }

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              handleProgressUpdate(data)
            } catch (e) {
              console.error('Failed to parse progress data:', e)
            }
          }
        }
      }

    } catch (error) {
      console.error('Discovery failed:', error)
      toast.error('Discovery failed to start')
      setDiscoveryRunning(false)
    }
  }

  const stopDiscovery = async () => {
    try {
      const response = await fetch('/api/trainerize/discover', {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setDiscoveryRunning(false)
        setProgress(null)
        toast.success('Discovery stopped')
      } else {
        toast.error('Failed to stop discovery')
      }
    } catch (error) {
      console.error('Failed to stop discovery:', error)
      toast.error('Failed to stop discovery')
    }
  }

  const handleProgressUpdate = (data: ProgressData) => {
    setProgress(data)

    switch (data.type) {
      case 'start':
        toast.info(data.message || 'Discovery started')
        break
      
      case 'exercise_saved':
        if (data.exercise) {
          setDiscoveredExercises(prev => [...prev, data.exercise])
        }
        break
      
      case 'complete':
        setDiscoveryRunning(false)
        toast.success(data.message || `Discovery completed: ${data.saved} exercises`)
        loadData() // Refresh the data
        break
      
      case 'error':
        setDiscoveryRunning(false)
        toast.error(data.message || 'Discovery failed')
        break
    }
  }

  const exportExercises = async () => {
    try {
      const response = await fetch('/api/backup?format=download')
      const blob = await response.blob()
      
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = `trainerize_exercises_${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      
      toast.success('Exercises exported successfully')
    } catch (error) {
      console.error('Export failed:', error)
      toast.error('Failed to export exercises')
    }
  }

  const getProgressPercentage = () => {
    if (!progress) return 0
    if (progress.type === 'complete') return 100
    if (progress.current && progress.total) {
      return (progress.current / progress.total) * 100
    }
    return 0
  }

  const filteredExercises = exercises.filter(exercise =>
    exercise.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exercise.category?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exercise Discovery</h1>
          <p className="text-muted-foreground">
            Discover and sync exercises from Trainerize API
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportExercises}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Exercises</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalExercises}</div>
              <p className="text-xs text-muted-foreground">in database</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Synced</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.syncedExercises}</div>
              <p className="text-xs text-muted-foreground">from Trainerize</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Discovery Status</CardTitle>
              {stats.discoveryRunning ? (
                <Clock className="h-4 w-4 text-blue-500" />
              ) : (
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.discoveryRunning ? 'Running' : 'Idle'}
              </div>
              <p className="text-xs text-muted-foreground">current state</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Discoveries</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recentDiscoveries.length}</div>
              <p className="text-xs text-muted-foreground">last 10 runs</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Discovery Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Discovery Settings</CardTitle>
          <CardDescription>
            Configure and start exercise discovery from Trainerize
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="plans"
                name="mode"
                value="plans"
                checked={mode === 'plans'}
                onChange={(e) => setMode(e.target.value as 'plans')}
              />
              <label htmlFor="plans" className="text-sm font-medium">
                From Training Plans
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="range"
                name="mode"
                value="range"
                checked={mode === 'range'}
                onChange={(e) => setMode(e.target.value as 'range')}
              />
              <label htmlFor="range" className="text-sm font-medium">
                ID Range Scan
              </label>
            </div>
          </div>

          {mode === 'plans' && (
            <div>
              <label className="text-sm font-medium">User IDs (comma-separated)</label>
              <Input
                placeholder="e.g., 123, 456, 789"
                value={userIds}
                onChange={(e) => setUserIds(e.target.value)}
                className="mt-1"
              />
            </div>
          )}

          {mode === 'range' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Start ID</label>
                <Input
                  type="number"
                  value={startId}
                  onChange={(e) => setStartId(parseInt(e.target.value) || 1)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">End ID</label>
                <Input
                  type="number"
                  value={endId}
                  onChange={(e) => setEndId(parseInt(e.target.value) || 10000)}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          <div className="flex items-center space-x-2">
            {!discoveryRunning ? (
              <Button onClick={startDiscovery}>
                <Play className="mr-2 h-4 w-4" />
                Start Discovery
              </Button>
            ) : (
              <Button variant="destructive" onClick={stopDiscovery}>
                <Square className="mr-2 h-4 w-4" />
                Stop Discovery
              </Button>
            )}
          </div>

          {/* Progress Display */}
          {progress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>
                  {progress.type === 'complete' ? 'Completed' : 
                   progress.type === 'error' ? 'Error' : 
                   'In Progress'}
                </span>
                {progress.current && progress.total && (
                  <span>{progress.current}/{progress.total}</span>
                )}
              </div>
              <Progress value={getProgressPercentage()} className="w-full" />
              {progress.message && (
                <p className="text-sm text-muted-foreground">{progress.message}</p>
              )}
            </div>
          )}

          {/* Real-time discovered exercises */}
          {discoveredExercises.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Recently Discovered:</h4>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {discoveredExercises.slice(-5).map((exercise, index) => (
                  <div key={index} className="text-sm p-2 bg-muted rounded">
                    <div className="font-medium">{exercise.name}</div>
                    {exercise.category && (
                      <div className="text-muted-foreground">{exercise.category}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Exercise List */}
      <Card>
        <CardHeader>
          <CardTitle>Discovered Exercises</CardTitle>
          <CardDescription>
            {filteredExercises.length} of {exercises.length} exercises
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search exercises..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredExercises.map((exercise) => (
              <div key={exercise.id} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <div className="font-medium">{exercise.name}</div>
                  <div className="text-sm text-muted-foreground">
                    ID: {exercise.trainerize_id}
                    {exercise.category && ` • ${exercise.category}`}
                  </div>
                  {exercise.muscle_groups && exercise.muscle_groups.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {exercise.muscle_groups.slice(0, 3).map((group) => (
                        <Badge key={group} variant="outline" className="text-xs">
                          {group}
                        </Badge>
                      ))}
                      {exercise.muscle_groups.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{exercise.muscle_groups.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Badge 
                    variant={exercise.sync_status === 'synced' ? 'default' : 'secondary'}
                  >
                    {exercise.sync_status}
                  </Badge>
                  {exercise.sync_status === 'synced' ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            ))}
            
            {filteredExercises.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {exercises.length === 0 
                  ? 'No exercises discovered yet. Start discovery to find exercises.'
                  : 'No exercises match your search.'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}