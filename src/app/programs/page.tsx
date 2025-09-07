"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  Edit,
  Trash2,
  Copy,
  PlayCircle,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Users,
  Target,
  Clock
} from "lucide-react"
import { supabaseAdmin as supabase } from "@/lib/supabase"
import Link from "next/link"
import { Program, TrainingPlan } from "@/lib/trainerize-program-manager"

interface ProgramWithStats extends Program {
  training_plan?: TrainingPlan
  client_count?: number
  completion_rate?: number
  avg_rating?: number
}

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<ProgramWithStats[]>([])
  const [filteredPrograms, setFilteredPrograms] = useState<ProgramWithStats[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([])
  const [bulkOperationLoading, setBulkOperationLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("programs")

  const loadPrograms = async () => {
    try {
      setLoading(true)
      const { data: programsData, error: programsError } = await supabase
        .from('training_programs')
        .select(`
          *,
          training_plans (
            id,
            name,
            duration_weeks,
            workouts_per_week,
            created_at
          )
        `)
        .order('created_at', { ascending: false })

      if (programsError) {
        console.error('Error loading programs:', programsError)
        return
      }

      // Get client assignments count for each program
      const programIds = programsData?.map(p => p.id) || []
      const { data: assignmentsData } = await supabase
        .from('client_programs')
        .select('program_id')
        .in('program_id', programIds)

      // Calculate stats
      const programsWithStats = programsData?.map(program => ({
        ...program,
        client_count: assignmentsData?.filter(a => a.program_id === program.id).length || 0,
        completion_rate: Math.random() * 100, // TODO: Calculate actual completion rate
        avg_rating: Math.random() * 5 // TODO: Calculate actual rating
      })) || []

      setPrograms(programsWithStats as ProgramWithStats[])
    } catch (error) {
      console.error('Error loading programs:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPrograms()
  }, [])

  useEffect(() => {
    let filtered = programs

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(program =>
        program.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        program.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(program => program.sync_status === statusFilter)
    }

    // Apply difficulty filter
    if (difficultyFilter !== "all") {
      filtered = filtered.filter(program => program.difficulty_level === difficultyFilter)
    }

    setFilteredPrograms(filtered)
  }, [programs, searchTerm, statusFilter, difficultyFilter])

  const getSyncStatusBadge = (program: ProgramWithStats) => {
    if (program.trainerize_program_id && program.sync_status === 'synced') {
      return <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
        <CheckCircle className="h-3 w-3" />
        Synced
      </Badge>
    }
    if (program.sync_status === 'error') {
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

  const getDifficultyBadge = (difficulty?: string) => {
    const colors = {
      beginner: 'bg-green-100 text-green-800',
      intermediate: 'bg-yellow-100 text-yellow-800',
      advanced: 'bg-red-100 text-red-800'
    }
    
    const color = colors[difficulty as keyof typeof colors] || 'bg-gray-100 text-gray-800'
    return <Badge className={color}>{difficulty || 'Not Set'}</Badge>
  }

  const handleSelectProgram = (programId: string, checked: boolean) => {
    if (checked) {
      setSelectedPrograms(prev => [...prev, programId])
    } else {
      setSelectedPrograms(prev => prev.filter(id => id !== programId))
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedPrograms(filteredPrograms.map(p => p.id))
    } else {
      setSelectedPrograms([])
    }
  }

  const handleBulkSync = async () => {
    setBulkOperationLoading(true)
    try {
      console.log('Syncing programs:', selectedPrograms)
      // TODO: Implement bulk sync API call
      setTimeout(() => {
        loadPrograms()
        setSelectedPrograms([])
        setBulkOperationLoading(false)
      }, 2000)
    } catch (error) {
      console.error('Bulk sync failed:', error)
      setBulkOperationLoading(false)
    }
  }

  const handleDeleteProgram = async (programId: string) => {
    if (!confirm('Are you sure you want to delete this program?')) return
    
    try {
      const { error } = await supabase
        .from('training_programs')
        .delete()
        .eq('id', programId)

      if (error) throw error
      loadPrograms()
    } catch (error) {
      console.error('Delete failed:', error)
    }
  }

  const handleCloneProgram = async (program: ProgramWithStats) => {
    try {
      const { error } = await supabase
        .from('training_programs')
        .insert([{
          name: `${program.name} (Copy)`,
          description: program.description,
          difficulty_level: program.difficulty_level,
          duration_weeks: program.duration_weeks,
          goals: program.goals,
          equipment_required: program.equipment_required
        }])

      if (error) throw error
      loadPrograms()
    } catch (error) {
      console.error('Clone failed:', error)
    }
  }

  const stats = {
    total: programs.length,
    synced: programs.filter(p => p.trainerize_program_id && p.sync_status === 'synced').length,
    pending: programs.filter(p => !p.trainerize_program_id || p.sync_status === 'pending').length,
    errors: programs.filter(p => p.sync_status === 'error').length,
    totalClients: programs.reduce((sum, p) => sum + (p.client_count || 0), 0)
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Program Management</h1>
          <p className="text-muted-foreground">
            Manage training programs, client assignments, and sync with Trainerize
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/programs/builder">
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Program
            </Button>
          </Link>
          <Link href="/clients/assessment">
            <Button variant="outline" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Assessment
            </Button>
          </Link>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="programs">Programs</TabsTrigger>
          <TabsTrigger value="assignments">Client Assignments</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="programs" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Programs</CardTitle>
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

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.totalClients}</div>
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
                  <Label htmlFor="search">Search Programs</Label>
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
                  <Label>Difficulty Level</Label>
                  <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All levels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Sync Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="synced">Synced</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button 
                    onClick={() => {
                      setSearchTerm("")
                      setStatusFilter("all")
                      setDifficultyFilter("all")
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
          {selectedPrograms.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Badge variant="outline">
                      {selectedPrograms.length} selected
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
                      onClick={() => setSelectedPrograms([])}
                    >
                      Clear Selection
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Programs Table */}
          <Card>
            <CardHeader>
              <CardTitle>Training Programs</CardTitle>
              <CardDescription>
                {filteredPrograms.length} programs found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                  <span className="ml-2">Loading programs...</span>
                </div>
              ) : filteredPrograms.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No programs found matching your filters
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <input
                          type="checkbox"
                          checked={selectedPrograms.length === filteredPrograms.length}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                        />
                      </TableHead>
                      <TableHead>Program</TableHead>
                      <TableHead>Difficulty</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Clients</TableHead>
                      <TableHead>Completion</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Sync</TableHead>
                      <TableHead className="w-12">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPrograms.map((program) => (
                      <TableRow key={program.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedPrograms.includes(program.id)}
                            onChange={(e) => handleSelectProgram(program.id, e.target.checked)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{program.name}</div>
                            {program.description && (
                              <div className="text-sm text-muted-foreground truncate max-w-xs">
                                {program.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getDifficultyBadge(program.difficulty_level)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            {program.duration_weeks || 0}w
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            {program.client_count || 0}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {program.completion_rate?.toFixed(1) || 0}%
                          </div>
                        </TableCell>
                        <TableCell>
                          {getSyncStatusBadge(program)}
                        </TableCell>
                        <TableCell>
                          {program.synced_at ? (
                            <div className="text-sm">
                              {new Date(program.synced_at).toLocaleDateString()}
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
                                <Link href={`/programs/builder?edit=${program.id}`}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleCloneProgram(program)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Clone
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/programs/${program.id}/calendar`}>
                                  <Calendar className="h-4 w-4 mr-2" />
                                  Calendar
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <PlayCircle className="h-4 w-4 mr-2" />
                                Preview
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteProgram(program.id)}
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
        </TabsContent>

        <TabsContent value="assignments">
          <Card>
            <CardHeader>
              <CardTitle>Client Program Assignments</CardTitle>
              <CardDescription>
                Manage which clients are assigned to which programs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Client assignment interface coming soon...
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar">
          <Card>
            <CardHeader>
              <CardTitle>Program Calendar</CardTitle>
              <CardDescription>
                Visual calendar view of program schedules and workouts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Calendar visualization coming soon...
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Program Analytics</CardTitle>
              <CardDescription>
                Performance metrics and insights for your training programs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Analytics dashboard coming soon...
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}