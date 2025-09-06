export type RecordType = 
  | 'general' 
  | 'strength' 
  | 'endurance' 
  | 'timedFasterBetter' 
  | 'timedLongerBetter' 
  | 'timedStrength' 
  | 'cardio'

export type ExerciseTag = 
  | 'arms' 
  | 'shoulder' 
  | 'chest' 
  | 'back' 
  | 'abs' 
  | 'legs' 
  | 'cardio' 
  | 'fullBody' 
  | 'none'

export type VideoType = 'youtube' | 'vimeo'
export type VideoStatus = 'processing' | 'ready' | 'failing'

interface TrainerizeExercise {
  id: string
  name: string
  description?: string
  muscle_groups?: string[]
  equipment?: string[]
  difficulty?: string
  video_url?: string
  thumbnail_url?: string
  instructions?: string[]
  category?: string
  is_active?: boolean
  created_at?: string
  updated_at?: string
  [key: string]: any
}

export interface TrainerizeExerciseUpdate {
  id: number
  name?: string
  alternateName?: string
  description?: string
  recordType?: RecordType
  tag?: ExerciseTag
  videoUrl?: string
  videoType?: VideoType
  videoStatus?: VideoStatus
  videoTrainerType?: string
  tags?: Array<{
    type: string
    name: string
  }>
}

export interface TrainerizeExerciseCreate {
  name: string
  alternateName?: string
  description?: string
  recordType?: RecordType
  tag?: ExerciseTag
  videoUrl?: string
  videoType?: VideoType
  videoStatus?: VideoStatus
  videoTrainerType?: string
  tags?: Array<{
    type: string
    name: string
  }>
}

export interface TrainerizeExerciseResponse {
  id: number
  name: string
  alternateName?: string
  description?: string
  recordType?: RecordType
  tag?: ExerciseTag
  videoUrl?: string
  videoType?: VideoType
  videoStatus?: VideoStatus
  success: boolean
  error?: string
}

export interface FieldMapping {
  supabaseField: string
  trainerizeField: keyof TrainerizeExerciseCreate
  transform?: (value: any) => any
}

interface TrainerizeResponse<T = any> {
  code: number
  message: string
  data: T
}

interface RateLimitOptions {
  requestsPerSecond: number
  maxRetries: number
  retryDelay: number
}

interface DiscoveryOptions {
  startId: number
  endId: number
  batchSize: number
  onProgress?: (found: number, checked: number) => void
  onExerciseFound?: (exercise: TrainerizeExercise) => void
}

export class TrainerizeClient {
  private baseUrl: string
  private authHeader: string
  private rateLimitDelay: number
  private lastRequestTime = 0
  private requestQueue: Promise<any> = Promise.resolve()
  private options: RateLimitOptions
  private fieldMappings: FieldMapping[]

  constructor(options: Partial<RateLimitOptions> = {}) {
    this.baseUrl = process.env.TRAINERIZE_API_URL || 'https://api.trainerize.com/v03'
    const groupId = process.env.TRAINERIZE_GROUP_ID || ''
    const apiToken = process.env.TRAINERIZE_API_TOKEN || ''
    
    if (!groupId || !apiToken) {
      throw new Error('Trainerize credentials not configured. Set TRAINERIZE_GROUP_ID and TRAINERIZE_API_TOKEN in environment.')
    }

    const credentials = `${groupId}:${apiToken}`
    this.authHeader = `Basic ${Buffer.from(credentials).toString('base64')}`
    
    this.options = {
      requestsPerSecond: 2, // Conservative rate limit
      maxRetries: 3,
      retryDelay: 1000,
      ...options
    }
    
    this.rateLimitDelay = 1000 / this.options.requestsPerSecond
    
    // Initialize field mappings
    this.fieldMappings = [
      { supabaseField: 'name', trainerizeField: 'name' },
      { supabaseField: 'alternate_name', trainerizeField: 'alternateName' },
      { supabaseField: 'description', trainerizeField: 'description' },
      { 
        supabaseField: 'category', 
        trainerizeField: 'recordType',
        transform: this.mapToRecordType.bind(this)
      },
      { 
        supabaseField: 'muscle_groups', 
        trainerizeField: 'tag',
        transform: this.mapToTag.bind(this)
      },
      { supabaseField: 'video_url', trainerizeField: 'videoUrl' },
      { 
        supabaseField: 'video_url', 
        trainerizeField: 'videoType',
        transform: this.inferVideoType.bind(this)
      }
    ]
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    
    if (timeSinceLastRequest < this.rateLimitDelay) {
      const waitTime = this.rateLimitDelay - timeSinceLastRequest
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
    
    this.lastRequestTime = Date.now()
  }

  private async makeRequest<T = any>(
    endpoint: string, 
    body: any = {}, 
    attempt = 1
  ): Promise<T> {
    await this.waitForRateLimit()

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': this.authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        if (response.status === 429 && attempt < this.options.maxRetries) {
          // Rate limited - exponential backoff
          const backoffDelay = this.options.retryDelay * Math.pow(2, attempt - 1)
          console.log(`Rate limited. Retrying in ${backoffDelay}ms...`)
          await new Promise(resolve => setTimeout(resolve, backoffDelay))
          return this.makeRequest(endpoint, body, attempt + 1)
        }

        if (response.status === 401) {
          throw new Error('Trainerize API authentication failed. Check your credentials.')
        }

        if (response.status === 403) {
          throw new Error('Trainerize API access forbidden. Check your permissions.')
        }

        if (response.status === 404) {
          return null as T // Resource not found is valid for some endpoints
        }

        const errorText = await response.text().catch(() => 'Unknown error')
        throw new Error(`Trainerize API error ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      
      // Check Trainerize's internal response format
      if (data.code !== undefined && data.code !== 0) {
        throw new Error(`Trainerize API returned error code ${data.code}: ${data.message}`)
      }

      return data
    } catch (error) {
      if (attempt < this.options.maxRetries && !(error instanceof Error && error.message.includes('authentication'))) {
        const retryDelay = this.options.retryDelay * attempt
        console.log(`Request failed, retrying in ${retryDelay}ms...`, error)
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.makeRequest(endpoint, body, attempt + 1)
      }
      
      throw error
    }
  }

  // Queue requests to avoid overwhelming the API
  private queueRequest<T>(fn: () => Promise<T>): Promise<T> {
    this.requestQueue = this.requestQueue.then(() => fn(), () => fn())
    return this.requestQueue
  }

  // Get user profile (can be used to validate connection)
  async validateConnection(): Promise<boolean> {
    try {
      const response = await this.makeRequest('/user/getProfile', {
        usersid: [parseInt(process.env.TRAINERIZE_GROUP_ID || '0')],
        unitBodystats: 'inches'
      })
      return !!response
    } catch (error) {
      console.error('Connection validation failed:', error)
      return false
    }
  }

  // Get training plans (could contain exercise data)
  async getTrainingPlans(userID: number): Promise<any[]> {
    try {
      const response = await this.makeRequest<TrainerizeResponse>('/trainingPlan/getList', {
        userID
      })
      return response?.data || []
    } catch (error) {
      console.error('Failed to fetch training plans:', error)
      return []
    }
  }

  // Get workout definitions from a training plan
  async getWorkoutDefinitions(planID: number): Promise<any[]> {
    try {
      const response = await this.makeRequest<TrainerizeResponse>('/trainingPlan/getWorkoutDefList', {
        planID
      })
      return response?.data || []
    } catch (error) {
      console.error('Failed to fetch workout definitions:', error)
      return []
    }
  }

  // Get calendar data (might contain exercise information)
  async getCalendarData(
    userID: number, 
    startDate: string, 
    endDate: string
  ): Promise<any[]> {
    try {
      const response = await this.makeRequest<TrainerizeResponse>('/calendar/getList', {
        userID,
        startDate,
        endDate,
        unitDistance: 'miles',
        unitWeight: 'lbs'
      })
      return response?.data || []
    } catch (error) {
      console.error('Failed to fetch calendar data:', error)
      return []
    }
  }

  // Discover exercises from training plans and workouts
  async discoverExercisesFromPlans(userIDs: number[]): Promise<TrainerizeExercise[]> {
    const exercises = new Map<string, TrainerizeExercise>()
    
    for (const userID of userIDs) {
      try {
        console.log(`Discovering exercises for user ${userID}...`)
        
        // Get training plans
        const plans = await this.getTrainingPlans(userID)
        
        for (const plan of plans) {
          if (plan.id) {
            // Get workouts from plan
            const workouts = await this.getWorkoutDefinitions(plan.id)
            
            // Extract exercises from workouts
            this.extractExercisesFromWorkouts(workouts, exercises)
          }
        }
        
        // Get calendar data for recent period
        const endDate = new Date().toISOString().split('T')[0]
        const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
          .toISOString().split('T')[0]
        
        const calendarData = await this.getCalendarData(userID, startDate, endDate)
        this.extractExercisesFromCalendar(calendarData, exercises)
        
      } catch (error) {
        console.error(`Error processing user ${userID}:`, error)
      }
    }
    
    return Array.from(exercises.values())
  }

  private extractExercisesFromWorkouts(
    workouts: any[], 
    exercises: Map<string, TrainerizeExercise>
  ): void {
    for (const workout of workouts) {
      if (workout.exercises && Array.isArray(workout.exercises)) {
        for (const exercise of workout.exercises) {
          if (exercise.id && exercise.name) {
            exercises.set(exercise.id, this.normalizeExercise(exercise))
          }
        }
      }
      
      // Check nested structures
      if (workout.workoutItems && Array.isArray(workout.workoutItems)) {
        for (const item of workout.workoutItems) {
          if (item.exercise && item.exercise.id) {
            exercises.set(item.exercise.id, this.normalizeExercise(item.exercise))
          }
        }
      }
    }
  }

  private extractExercisesFromCalendar(
    calendarData: any[], 
    exercises: Map<string, TrainerizeExercise>
  ): void {
    for (const item of calendarData) {
      if (item.workout && item.workout.exercises) {
        this.extractExercisesFromWorkouts([item.workout], exercises)
      }
      
      if (item.exercises && Array.isArray(item.exercises)) {
        for (const exercise of item.exercises) {
          if (exercise.id && exercise.name) {
            exercises.set(exercise.id, this.normalizeExercise(exercise))
          }
        }
      }
    }
  }

  private normalizeExercise(rawExercise: any): TrainerizeExercise {
    return {
      id: String(rawExercise.id),
      name: rawExercise.name || rawExercise.exerciseName || rawExercise.title,
      description: rawExercise.description || rawExercise.notes || '',
      muscle_groups: this.normalizeArray(rawExercise.muscle_groups || rawExercise.muscleGroups || rawExercise.muscles),
      equipment: this.normalizeArray(rawExercise.equipment || rawExercise.equipmentNeeded),
      difficulty: rawExercise.difficulty || rawExercise.difficultyLevel || rawExercise.level,
      video_url: rawExercise.video_url || rawExercise.videoUrl || rawExercise.video,
      thumbnail_url: rawExercise.thumbnail_url || rawExercise.thumbnailUrl || rawExercise.thumbnail,
      instructions: this.normalizeArray(rawExercise.instructions || rawExercise.steps),
      category: rawExercise.category || rawExercise.exerciseType || rawExercise.type,
      is_active: rawExercise.is_active !== false,
      created_at: rawExercise.created_at || rawExercise.createdAt,
      updated_at: rawExercise.updated_at || rawExercise.updatedAt,
      ...rawExercise // Keep all original data
    }
  }

  private normalizeArray(value: any): string[] {
    if (Array.isArray(value)) {
      return value.filter(v => v && typeof v === 'string')
    }
    if (typeof value === 'string') {
      return value.split(',').map(s => s.trim()).filter(Boolean)
    }
    return []
  }

  // Batch discover exercises with progress tracking
  async batchDiscoverExercises(
    userIDs: number[],
    options: {
      onProgress?: (progress: { current: number, total: number, found: number }) => void
      onError?: (userID: number, error: Error) => void
    } = {}
  ): Promise<TrainerizeExercise[]> {
    const { onProgress, onError } = options
    const allExercises = new Map<string, TrainerizeExercise>()
    let processed = 0

    for (const userID of userIDs) {
      try {
        const userExercises = await this.discoverExercisesFromPlans([userID])
        
        // Merge exercises
        userExercises.forEach(exercise => {
          allExercises.set(exercise.id, exercise)
        })
        
        processed++
        
        if (onProgress) {
          onProgress({
            current: processed,
            total: userIDs.length,
            found: allExercises.size
          })
        }
        
      } catch (error) {
        if (onError) {
          onError(userID, error instanceof Error ? error : new Error(String(error)))
        }
        processed++
      }
    }

    return Array.from(allExercises.values())
  }

  // Update/Set exercise
  async updateExercise(exercise: TrainerizeExerciseUpdate): Promise<boolean> {
    await this.waitForRateLimit()
    
    try {
      const response = await this.makeRequest('/exercise/set', exercise)
      
      if (response) {
        console.log(`✓ Updated exercise ${exercise.id}: ${exercise.name}`)
        return true
      }
      return false
    } catch (error: any) {
      console.error(`Error updating exercise ${exercise.id}:`, error.message)
      throw new Error(`Failed to update exercise: ${error.message}`)
    }
  }

  // Batch update exercises
  async batchUpdateExercises(
    exercises: TrainerizeExerciseUpdate[],
    onProgress?: (current: number, total: number) => void
  ): Promise<{ success: number; failed: number; errors: any[] }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[]
    }

    for (let i = 0; i < exercises.length; i++) {
      try {
        await this.updateExercise(exercises[i])
        results.success++
      } catch (error) {
        results.failed++
        results.errors.push({
          exerciseId: exercises[i].id,
          error: error instanceof Error ? error.message : String(error)
        })
      }

      if (onProgress) {
        onProgress(i + 1, exercises.length)
      }

      // Rate limiting between updates
      if ((i + 1) % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    return results
  }

  // Add single exercise to Trainerize
  async addExercise(exercise: TrainerizeExerciseCreate): Promise<TrainerizeExerciseResponse> {
    await this.waitForRateLimit()
    
    // Validate exercise data first
    const validation = this.validateExerciseCreate(exercise)
    if (!validation.isValid) {
      return {
        id: 0,
        name: exercise.name,
        success: false,
        error: validation.errors.join(', ')
      }
    }

    try {
      const response = await this.makeRequest('/exercise/add', exercise)
      
      if (response?.id || response?.exerciseId) {
        const newId = response.id || response.exerciseId
        
        console.log(`✓ Added exercise to Trainerize: ${exercise.name} (ID: ${newId})`)
        return {
          id: parseInt(newId),
          name: exercise.name,
          success: true,
          ...response
        }
      }
      
      return {
        id: 0,
        name: exercise.name,
        success: false,
        error: 'No ID returned from Trainerize'
      }
    } catch (error: any) {
      console.error(`Error adding exercise:`, error.message)
      return {
        id: 0,
        name: exercise.name,
        success: false,
        error: error.message
      }
    }
  }

  // Bulk add exercises from Supabase to Trainerize
  async bulkAddExercises(
    exerciseIds: string[],
    options: {
      onProgress?: (current: number, total: number, exercise?: any) => void
      skipExisting?: boolean
      checkForDuplicates?: boolean
    } = {}
  ): Promise<{
    successful: Array<{ exercise: any; trainerize_id: string }>
    failed: Array<{ exercise: any; error: string }>
    skipped: Array<{ exercise: any; reason: string }>
    duplicates: Array<{ exercise: any; existing_name: string }>
  }> {
    const { onProgress, skipExisting = true, checkForDuplicates = true } = options
    const { supabaseAdmin } = await import('./supabase')
    
    const results = {
      successful: [] as Array<{ exercise: any; trainerize_id: string }>,
      failed: [] as Array<{ exercise: any; error: string }>,
      skipped: [] as Array<{ exercise: any; reason: string }>,
      duplicates: [] as Array<{ exercise: any; existing_name: string }>
    }

    // Fetch exercises from Supabase
    const { data: exercises, error } = await supabaseAdmin
      .from('exercises')
      .select('*')
      .in('id', exerciseIds)

    if (error || !exercises) {
      throw new Error(`Failed to fetch exercises: ${error?.message}`)
    }

    // Get existing exercises for duplicate detection if enabled
    let existingExercises: any[] = []
    if (checkForDuplicates) {
      const { data: existing } = await supabaseAdmin
        .from('exercises')
        .select('name, trainerize_id')
        .not('trainerize_id', 'is', null)
      
      existingExercises = existing || []
    }

    for (let i = 0; i < exercises.length; i++) {
      const exercise = exercises[i]
      
      if (onProgress) {
        onProgress(i + 1, exercises.length, exercise)
      }

      // Skip if already has Trainerize ID and skipExisting is true
      if (skipExisting && exercise.trainerize_id) {
        results.skipped.push({
          exercise,
          reason: 'Already synced to Trainerize'
        })
        continue
      }

      // Check for duplicates by name
      if (checkForDuplicates) {
        const duplicate = existingExercises.find(existing => 
          existing.name.toLowerCase() === exercise.name.toLowerCase()
        )
        
        if (duplicate && duplicate.trainerize_id) {
          results.duplicates.push({
            exercise,
            existing_name: duplicate.name
          })
          continue
        }
      }

      // Map Supabase exercise to Trainerize format
      const trainerizeExercise = this.mapSupabaseToTrainerize(exercise)
      
      // Add to Trainerize
      const result = await this.addExercise(trainerizeExercise)
      
      if (result.success && result.id) {
        results.successful.push({
          exercise,
          trainerize_id: result.id.toString()
        })
        
        // Update Supabase with new Trainerize ID
        try {
          await supabaseAdmin
            .from('exercises')
            .update({
              trainerize_id: result.id.toString(),
              synced_at: new Date().toISOString(),
              sync_status: 'synced'
            })
            .eq('id', exercise.id)
        } catch (updateError) {
          console.error('Failed to update Supabase with new Trainerize ID:', updateError)
        }
      } else {
        results.failed.push({
          exercise,
          error: result.error || 'Unknown error'
        })
      }

      // Rate limiting between requests
      if ((i + 1) % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    return results
  }

  // Map Supabase exercise format to Trainerize format
  mapSupabaseToTrainerize(exercise: any): TrainerizeExerciseCreate {
    const mapped: TrainerizeExerciseCreate = {
      name: exercise.name
    }

    // Apply field mappings
    for (const mapping of this.fieldMappings) {
      const value = exercise[mapping.supabaseField]
      
      if (value !== undefined && value !== null) {
        const transformedValue = mapping.transform ? mapping.transform(value) : value
        if (transformedValue !== undefined) {
          (mapped as any)[mapping.trainerizeField] = transformedValue
        }
      }
    }

    // Build tags from exercise data
    mapped.tags = this.buildTags(exercise)

    return mapped
  }

  // Check for duplicate exercises before adding
  async checkForDuplicates(exerciseName: string): Promise<{
    isDuplicate: boolean
    existingExercise?: any
  }> {
    const { supabaseAdmin } = await import('./supabase')
    
    try {
      const { data: existing } = await supabaseAdmin
        .from('exercises')
        .select('*')
        .ilike('name', exerciseName)
        .not('trainerize_id', 'is', null)
        .limit(1)

      if (existing && existing.length > 0) {
        return {
          isDuplicate: true,
          existingExercise: existing[0]
        }
      }

      return { isDuplicate: false }
    } catch (error) {
      console.error('Error checking for duplicates:', error)
      return { isDuplicate: false }
    }
  }

  // Validate exercise creation data
  validateExerciseCreate(exercise: Partial<TrainerizeExerciseCreate>): {
    isValid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    if (!exercise.name || exercise.name.trim().length === 0) {
      errors.push('Exercise name is required')
    }

    if (exercise.name && exercise.name.length > 100) {
      errors.push('Exercise name must be less than 100 characters')
    }

    if (exercise.description && exercise.description.length > 500) {
      errors.push('Description must be less than 500 characters')
    }

    if (exercise.recordType && !['general', 'strength', 'endurance', 'timedFasterBetter', 'timedLongerBetter', 'timedStrength', 'cardio'].includes(exercise.recordType)) {
      errors.push('Invalid record type')
    }

    if (exercise.tag && !['arms', 'shoulder', 'chest', 'back', 'abs', 'legs', 'cardio', 'fullBody', 'none'].includes(exercise.tag)) {
      errors.push('Invalid exercise tag')
    }

    if (exercise.videoType && !['youtube', 'vimeo'].includes(exercise.videoType)) {
      errors.push('Invalid video type')
    }

    if (exercise.videoUrl && exercise.videoUrl.length > 255) {
      errors.push('Video URL must be less than 255 characters')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // Helper methods for mapping
  private mapToRecordType(category?: string): RecordType {
    const mapping: Record<string, RecordType> = {
      'strength': 'strength',
      'cardio': 'cardio',
      'endurance': 'endurance',
      'timed': 'timedFasterBetter'
    }
    return mapping[category?.toLowerCase() || ''] || 'general'
  }

  private mapToTag(muscleGroups?: string[]): ExerciseTag {
    if (!muscleGroups || muscleGroups.length === 0) return 'none'
    
    // Map first muscle group to tag
    const firstGroup = muscleGroups[0].toLowerCase()
    const mapping: Record<string, ExerciseTag> = {
      'arms': 'arms',
      'shoulders': 'shoulder', 
      'shoulder': 'shoulder',
      'chest': 'chest',
      'back': 'back',
      'core': 'abs',
      'abs': 'abs',
      'legs': 'legs',
      'cardio': 'cardio'
    }
    
    return mapping[firstGroup] || 'fullBody'
  }

  // Infer video type from URL
  private inferVideoType(url?: string): VideoType | undefined {
    if (!url) return undefined
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
    if (url.includes('vimeo.com')) return 'vimeo'
    return undefined
  }

  // Build tags array from exercise data
  private buildTags(exercise: any): Array<{ type: string; name: string }> {
    const tags: Array<{ type: string; name: string }> = []
    
    // Add muscle groups as tags
    if (exercise.muscle_groups && Array.isArray(exercise.muscle_groups)) {
      exercise.muscle_groups.forEach((muscle: string) => {
        tags.push({ type: 'muscle', name: muscle })
      })
    }
    
    // Add equipment as tag
    if (exercise.equipment) {
      const equipmentList = Array.isArray(exercise.equipment) 
        ? exercise.equipment 
        : [exercise.equipment]
      
      equipmentList.forEach((eq: string) => {
        tags.push({ type: 'equipment', name: eq })
      })
    }
    
    // Add difficulty as tag
    if (exercise.difficulty_level || exercise.difficulty) {
      tags.push({ 
        type: 'difficulty', 
        name: exercise.difficulty_level || exercise.difficulty 
      })
    }

    // Add category as tag
    if (exercise.category) {
      tags.push({ type: 'category', name: exercise.category })
    }
    
    return tags
  }

  // Export exercises to Trainerize format
  async exportToTrainerizeFormat(exerciseIds: string[]): Promise<TrainerizeExerciseUpdate[]> {
    const exportData: TrainerizeExerciseUpdate[] = []
    const { supabaseAdmin } = await import('./supabase')

    for (const id of exerciseIds) {
      try {
        // Fetch from our database
        const { data: exercise, error } = await supabaseAdmin
          .from('exercises')
          .select('*')
          .eq('trainerize_id', id)
          .single()

        if (error) {
          console.error(`Error fetching exercise ${id}:`, error)
          continue
        }

        if (exercise) {
          // Map to Trainerize format
          const trainerizeFormat: TrainerizeExerciseUpdate = {
            id: parseInt(exercise.trainerize_id),
            name: exercise.name,
            description: exercise.description,
            recordType: this.mapToRecordType(exercise.category),
            tag: this.mapToTag(exercise.muscle_groups),
            videoUrl: exercise.video_url || undefined,
            videoType: exercise.video_url?.includes('youtube') ? 'youtube' : 
                      exercise.video_url?.includes('vimeo') ? 'vimeo' : undefined
          }

          exportData.push(trainerizeFormat)
        }
      } catch (error) {
        console.error(`Error processing exercise ${id}:`, error)
      }
    }

    return exportData
  }

  // Validate exercise update data
  validateExerciseUpdate(exercise: Partial<TrainerizeExerciseUpdate>): {
    isValid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    if (!exercise.id) {
      errors.push('Exercise ID is required')
    }

    if (exercise.name && exercise.name.length > 100) {
      errors.push('Exercise name must be less than 100 characters')
    }

    if (exercise.description && exercise.description.length > 500) {
      errors.push('Description must be less than 500 characters')
    }

    if (exercise.recordType && !['general', 'strength', 'endurance', 'timedFasterBetter', 'timedLongerBetter', 'timedStrength', 'cardio'].includes(exercise.recordType)) {
      errors.push('Invalid record type')
    }

    if (exercise.tag && !['arms', 'shoulder', 'chest', 'back', 'abs', 'legs', 'cardio', 'fullBody', 'none'].includes(exercise.tag)) {
      errors.push('Invalid exercise tag')
    }

    if (exercise.videoType && !['youtube', 'vimeo'].includes(exercise.videoType)) {
      errors.push('Invalid video type')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // Get stats about the connection and available data
  async getStats(): Promise<{
    connectionValid: boolean
    rateLimitDelay: number
    lastRequestTime: number
    queueLength: number
  }> {
    const connectionValid = await this.validateConnection()
    
    return {
      connectionValid,
      rateLimitDelay: this.rateLimitDelay,
      lastRequestTime: this.lastRequestTime,
      queueLength: 0 // Could implement queue length tracking
    }
  }
}

// Export singleton instance
export const trainerizeClient = new TrainerizeClient()