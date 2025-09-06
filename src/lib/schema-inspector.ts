import { supabaseAdmin } from './supabase'

export interface TableColumn {
  column_name: string
  data_type: string
  is_nullable: string
  column_default: string | null
  character_maximum_length: number | null
}

export interface TableConstraint {
  constraint_name: string
  constraint_type: string
  column_name: string
  referenced_table_name: string | null
  referenced_column_name: string | null
}

export interface TableInfo {
  columns: TableColumn[]
  constraints: TableConstraint[]
  primaryKey: string[]
  indexes: string[]
}

export class SchemaInspector {
  async getTableInfo(tableName: string): Promise<TableInfo> {
    // Get column information
    const { data: columns, error: columnsError } = await supabaseAdmin
      .from('information_schema.columns')
      .select('*')
      .eq('table_name', tableName)
      .eq('table_schema', 'public')

    if (columnsError) {
      console.error('Error fetching column info:', columnsError)
      throw new Error(`Failed to fetch column information for table ${tableName}`)
    }

    // Get constraint information
    const { data: constraints, error: constraintsError } = await supabaseAdmin.rpc(
      'get_table_constraints',
      { table_name_param: tableName }
    )

    if (constraintsError) {
      console.warn('Could not fetch constraints:', constraintsError)
    }

    // Get primary key columns
    const primaryKey = columns
      ?.filter(col => col.column_name === 'id' || col.column_default?.includes('gen_random_uuid'))
      .map(col => col.column_name) || []

    return {
      columns: columns || [],
      constraints: constraints || [],
      primaryKey,
      indexes: []
    }
  }

  async inspectExercisesTable(): Promise<{
    hasTable: boolean
    columns: Record<string, TableColumn>
    relationships: string[]
    suggestedMapping: Record<string, string>
  }> {
    try {
      // Check if exercises table exists
      const { data: tables, error } = await supabaseAdmin
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'exercises')

      if (error || !tables || tables.length === 0) {
        return {
          hasTable: false,
          columns: {},
          relationships: [],
          suggestedMapping: {}
        }
      }

      // Get detailed table information
      const tableInfo = await this.getTableInfo('exercises')
      const columnsMap = tableInfo.columns.reduce((acc, col) => {
        acc[col.column_name] = col
        return acc
      }, {} as Record<string, TableColumn>)

      // Analyze column patterns to suggest mapping
      const suggestedMapping = this.analyzeMappingPatterns(Object.keys(columnsMap))

      // Get relationships
      const relationships = tableInfo.constraints
        .filter(c => c.constraint_type === 'FOREIGN KEY')
        .map(c => `${c.column_name} -> ${c.referenced_table_name}.${c.referenced_column_name}`)

      return {
        hasTable: true,
        columns: columnsMap,
        relationships,
        suggestedMapping
      }
    } catch (error) {
      console.error('Error inspecting exercises table:', error)
      throw error
    }
  }

  private analyzeMappingPatterns(columnNames: string[]): Record<string, string> {
    const mapping: Record<string, string> = {}
    
    // Common patterns for exercise data mapping
    const patterns = {
      // Trainerize field -> possible database columns
      'id': ['id', 'exercise_id', 'trainerize_id', 'external_id'],
      'name': ['name', 'title', 'exercise_name', 'display_name'],
      'description': ['description', 'desc', 'summary', 'notes'],
      'category': ['category', 'category_id', 'category_name', 'type'],
      'muscle_groups': ['muscle_groups', 'muscles', 'target_muscles', 'muscle_group_ids'],
      'equipment': ['equipment', 'equipment_needed', 'equipment_ids', 'gear'],
      'instructions': ['instructions', 'how_to', 'steps', 'directions'],
      'video_url': ['video_url', 'video', 'video_link', 'media_url'],
      'thumbnail_url': ['thumbnail_url', 'thumbnail', 'image_url', 'preview_image'],
      'difficulty_level': ['difficulty_level', 'difficulty', 'level', 'skill_level'],
      'is_active': ['is_active', 'active', 'enabled', 'status'],
      'created_at': ['created_at', 'date_created', 'created_on'],
      'updated_at': ['updated_at', 'date_updated', 'modified_at', 'last_modified'],
    }

    // Match columns to Trainerize fields based on patterns
    for (const [trainerizeField, possibleColumns] of Object.entries(patterns)) {
      for (const possibleColumn of possibleColumns) {
        if (columnNames.includes(possibleColumn)) {
          mapping[trainerizeField] = possibleColumn
          break
        }
      }
    }

    return mapping
  }

  async getSampleData(tableName: 'exercises' | 'sync_logs', limit: number = 5): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from(tableName)
      .select('*')
      .limit(limit)

    if (error) {
      console.error('Error fetching sample data:', error)
      return []
    }

    return data || []
  }
}

export const schemaInspector = new SchemaInspector()