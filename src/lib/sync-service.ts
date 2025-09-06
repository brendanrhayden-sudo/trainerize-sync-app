import { supabaseAdmin } from './supabase'
import { schemaInspector } from './schema-inspector'
import { trainerizeApi } from './trainerize'

export interface SyncOperation {
  id: string
  operation: 'create' | 'update' | 'skip' | 'conflict'
  trainerize_data: any
  existing_data?: any
  mapped_data: any
  conflicts?: string[]
  reason?: string
}

export interface SyncPreview {
  total_trainerize_exercises: number
  operations: SyncOperation[]
  conflicts: SyncOperation[]
  summary: {
    to_create: number
    to_update: number
    to_skip: number
    conflicts: number
  }
  schema_info: {
    table_exists: boolean
    columns: Record<string, any>
    suggested_mapping: Record<string, string>
  }
}

export interface SyncResult {
  success: boolean
  operations_performed: SyncOperation[]
  errors: Array<{ operation: SyncOperation; error: string }>
  summary: {
    created: number
    updated: number
    skipped: number
    failed: number
  }
  audit_log_id?: string
}

export class SyncService {
  private columnMapping: Record<string, string> = {}
  private tableSchema: any = null

  async initialize(): Promise<void> {
    try {
      const schemaInfo = await schemaInspector.inspectExercisesTable()
      
      if (!schemaInfo.hasTable) {
        throw new Error('Exercises table not found. Please create the table first.')
      }

      this.tableSchema = schemaInfo
      this.columnMapping = schemaInfo.suggestedMapping

      console.log('Sync service initialized with schema:', {
        columns: Object.keys(schemaInfo.columns),
        mapping: this.columnMapping,
        relationships: schemaInfo.relationships
      })
    } catch (error) {
      console.error('Failed to initialize sync service:', error)
      throw error
    }
  }

  async previewSync(): Promise<SyncPreview> {
    await this.ensureInitialized()

    try {
      // Get Trainerize data (simulated for now since we don't have exercise endpoints)
      const trainerizeData = await this.getTrainerizeExercises()
      
      // Get existing exercises
      const existingExercises = await this.getExistingExercises()
      const existingByTrainerizeId = new Map()
      const existingByName = new Map()

      existingExercises.forEach(ex => {
        if (ex[this.getColumnName('trainerize_id')]) {
          existingByTrainerizeId.set(ex[this.getColumnName('trainerize_id')], ex)
        }
        if (ex[this.getColumnName('name')]) {
          existingByName.set(ex[this.getColumnName('name')].toLowerCase(), ex)
        }
      })

      const operations: SyncOperation[] = []
      const conflicts: SyncOperation[] = []

      for (const trainerizeExercise of trainerizeData) {
        const operation = await this.analyzeExercise(
          trainerizeExercise,
          existingByTrainerizeId,
          existingByName
        )

        operations.push(operation)
        
        if (operation.operation === 'conflict') {
          conflicts.push(operation)
        }
      }

      const summary = {
        to_create: operations.filter(op => op.operation === 'create').length,
        to_update: operations.filter(op => op.operation === 'update').length,
        to_skip: operations.filter(op => op.operation === 'skip').length,
        conflicts: conflicts.length
      }

      return {
        total_trainerize_exercises: trainerizeData.length,
        operations,
        conflicts,
        summary,
        schema_info: {
          table_exists: this.tableSchema.hasTable,
          columns: this.tableSchema.columns,
          suggested_mapping: this.columnMapping
        }
      }
    } catch (error) {
      console.error('Error in preview sync:', error)
      throw error
    }
  }

  async performSync(operations: SyncOperation[], auditNote?: string): Promise<SyncResult> {
    await this.ensureInitialized()

    // Create audit log entry
    const auditLogId = await this.createAuditLog('sync_start', {
      total_operations: operations.length,
      note: auditNote
    })

    const result: SyncResult = {
      success: true,
      operations_performed: [],
      errors: [],
      summary: {
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 0
      },
      audit_log_id: auditLogId
    }

    for (const operation of operations) {
      try {
        if (operation.operation === 'create') {
          await this.createExercise(operation)
          result.summary.created++
        } else if (operation.operation === 'update') {
          await this.updateExercise(operation)
          result.summary.updated++
        } else {
          result.summary.skipped++
        }
        
        result.operations_performed.push(operation)
      } catch (error) {
        console.error(`Error processing operation ${operation.id}:`, error)
        result.errors.push({
          operation,
          error: error instanceof Error ? error.message : String(error)
        })
        result.summary.failed++
        result.success = false
      }
    }

    // Update audit log
    await this.updateAuditLog(auditLogId, 'sync_complete', {
      result: result.summary,
      errors: result.errors.map(e => e.error)
    })

    return result
  }

  private async analyzeExercise(
    trainerizeExercise: any,
    existingByTrainerizeId: Map<string, any>,
    existingByName: Map<string, any>
  ): Promise<SyncOperation> {
    const operation: SyncOperation = {
      id: trainerizeExercise.id || `temp_${Date.now()}`,
      operation: 'create',
      trainerize_data: trainerizeExercise,
      mapped_data: this.mapTrainerizeData(trainerizeExercise),
      conflicts: []
    }

    // Check if exercise exists by Trainerize ID
    const existingById = existingByTrainerizeId.get(trainerizeExercise.id)
    if (existingById) {
      operation.operation = 'update'
      operation.existing_data = existingById
      
      // Check for conflicts
      const conflicts = this.detectConflicts(operation.mapped_data, existingById)
      if (conflicts.length > 0) {
        operation.operation = 'conflict'
        operation.conflicts = conflicts
      }
      return operation
    }

    // Check if exercise exists by name (potential duplicate)
    const nameToCheck = trainerizeExercise.name?.toLowerCase()
    if (nameToCheck && existingByName.has(nameToCheck)) {
      const existingByNameMatch = existingByName.get(nameToCheck)
      operation.operation = 'conflict'
      operation.existing_data = existingByNameMatch
      operation.conflicts = ['Name match found - potential duplicate']
      operation.reason = 'Exercise with same name already exists'
      return operation
    }

    return operation
  }

  private mapTrainerizeData(trainerizeData: any): Record<string, any> {
    const mapped: Record<string, any> = {}

    // Map each field using our column mapping
    const mappings = {
      id: 'trainerize_id',
      name: 'name',
      description: 'description',
      category: 'category',
      muscle_groups: 'muscle_groups',
      equipment: 'equipment',
      instructions: 'instructions',
      video_url: 'video_url',
      thumbnail_url: 'thumbnail_url',
      difficulty_level: 'difficulty_level',
      is_active: 'is_active'
    }

    for (const [trainerizeField, dbField] of Object.entries(mappings)) {
      const dbColumn = this.getColumnName(dbField)
      if (dbColumn && trainerizeData[trainerizeField] !== undefined) {
        mapped[dbColumn] = this.transformValue(trainerizeData[trainerizeField], dbColumn)
      }
    }

    // Add timestamps
    const now = new Date().toISOString()
    const createdAtColumn = this.getColumnName('created_at')
    const updatedAtColumn = this.getColumnName('updated_at')
    
    if (updatedAtColumn) mapped[updatedAtColumn] = now
    if (createdAtColumn && !mapped[createdAtColumn]) mapped[createdAtColumn] = now

    return mapped
  }

  private transformValue(value: any, columnName: string): any {
    // Handle special transformations based on column type
    const columnInfo = this.tableSchema?.columns[columnName]
    
    if (!columnInfo) return value

    // Handle array types
    if (columnInfo.data_type === 'ARRAY' || columnInfo.data_type.includes('[]')) {
      return Array.isArray(value) ? value : [value].filter(Boolean)
    }

    // Handle boolean types
    if (columnInfo.data_type === 'boolean') {
      return Boolean(value)
    }

    // Handle JSON/JSONB types
    if (columnInfo.data_type === 'jsonb' || columnInfo.data_type === 'json') {
      return typeof value === 'object' ? value : { raw: value }
    }

    return value
  }

  private detectConflicts(newData: any, existingData: any): string[] {
    const conflicts: string[] = []
    const significantFields = ['name', 'description', 'category']

    for (const field of significantFields) {
      const dbColumn = this.getColumnName(field)
      if (dbColumn && newData[dbColumn] && existingData[dbColumn]) {
        if (newData[dbColumn] !== existingData[dbColumn]) {
          conflicts.push(`${field}: "${existingData[dbColumn]}" → "${newData[dbColumn]}"`)
        }
      }
    }

    return conflicts
  }

  private async createExercise(operation: SyncOperation): Promise<void> {
    const { error } = await supabaseAdmin
      .from('exercises')
      .insert([operation.mapped_data])

    if (error) {
      throw new Error(`Failed to create exercise: ${error.message}`)
    }

    await this.logOperation('create', operation)
  }

  private async updateExercise(operation: SyncOperation): Promise<void> {
    const primaryKeyColumn = this.tableSchema?.primaryKey[0] || 'id'
    const primaryKeyValue = operation.existing_data[primaryKeyColumn]

    if (!primaryKeyValue) {
      throw new Error('Cannot update exercise: no primary key found')
    }

    const { error } = await supabaseAdmin
      .from('exercises')
      .update(operation.mapped_data)
      .eq(primaryKeyColumn, primaryKeyValue)

    if (error) {
      throw new Error(`Failed to update exercise: ${error.message}`)
    }

    await this.logOperation('update', operation)
  }

  private async getExistingExercises(): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('exercises')
      .select('*')

    if (error) {
      throw new Error(`Failed to fetch existing exercises: ${error.message}`)
    }

    return data || []
  }

  private async getTrainerizeExercises(): Promise<any[]> {
    // For now, return mock data since Trainerize API doesn't have exercise endpoints
    // This will be replaced with actual Trainerize API calls when available
    return [
      {
        id: 'tr_1',
        name: 'Push-ups',
        description: 'Basic bodyweight exercise',
        category: 'Strength',
        muscle_groups: ['Chest', 'Triceps'],
        equipment: ['Bodyweight'],
        difficulty_level: 'beginner',
        is_active: true
      },
      {
        id: 'tr_2',
        name: 'Squats',
        description: 'Lower body compound exercise',
        category: 'Strength',
        muscle_groups: ['Legs', 'Glutes'],
        equipment: ['Bodyweight'],
        difficulty_level: 'beginner',
        is_active: true
      }
    ]
  }

  private getColumnName(standardField: string): string {
    return this.columnMapping[standardField] || standardField
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.tableSchema) {
      await this.initialize()
    }
  }

  private async createAuditLog(operation: string, details: any): Promise<string> {
    const { data, error } = await supabaseAdmin
      .from('sync_logs')
      .insert([{
        sync_type: 'manual',
        status: 'started',
        started_at: new Date().toISOString(),
        metadata: {
          operation,
          ...details
        }
      }])
      .select('id')
      .single()

    if (error) {
      console.error('Failed to create audit log:', error)
      throw error
    }

    return data.id
  }

  private async updateAuditLog(logId: string, operation: string, details: any): Promise<void> {
    const { error } = await supabaseAdmin
      .from('sync_logs')
      .update({
        status: operation === 'sync_complete' ? 'completed' : 'failed',
        completed_at: new Date().toISOString(),
        metadata: details
      })
      .eq('id', logId)

    if (error) {
      console.error('Failed to update audit log:', error)
    }
  }

  private async logOperation(operation: string, details: SyncOperation): Promise<void> {
    // Log individual operations for detailed tracking
    const { error } = await supabaseAdmin
      .from('sync_logs')
      .insert([{
        sync_type: 'operation',
        status: 'completed',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        records_processed: 1,
        records_created: operation === 'create' ? 1 : 0,
        records_updated: operation === 'update' ? 1 : 0,
        metadata: {
          operation,
          trainerize_id: details.trainerize_data.id,
          exercise_name: details.trainerize_data.name
        }
      }])

    if (error) {
      console.warn('Failed to log operation:', error)
    }
  }
}

export const syncService = new SyncService()