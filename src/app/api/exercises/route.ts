import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { schemaInspector } from '@/lib/schema-inspector'
import type { ApiResponse } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '10'), 100) // Limit page size
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const muscleGroup = searchParams.get('muscleGroup') || ''
    const equipment = searchParams.get('equipment') || ''
    const difficultyLevel = searchParams.get('difficultyLevel') || ''
    const syncStatus = searchParams.get('syncStatus') || ''
    const isActive = searchParams.get('isActive')

    // Inspect schema to understand actual column names
    const schemaInfo = await schemaInspector.inspectExercisesTable()
    
    if (!schemaInfo.hasTable) {
      return NextResponse.json(
        { success: false, error: 'Exercises table not found' } as ApiResponse,
        { status: 404 }
      )
    }

    const columnMap = schemaInfo.suggestedMapping
    let query = supabaseAdmin
      .from('exercises')
      .select('*', { count: 'exact' })

    // Build filters using actual column names
    if (search) {
      const nameCol = columnMap.name || 'name'
      const descCol = columnMap.description || 'description'
      query = query.or(`${nameCol}.ilike.%${search}%,${descCol}.ilike.%${search}%`)
    }

    if (category) {
      const categoryCol = columnMap.category || 'category'
      query = query.eq(categoryCol, category)
    }

    if (muscleGroup) {
      const muscleGroupsCol = columnMap.muscle_groups || 'muscle_groups'
      if (schemaInfo.columns[muscleGroupsCol]?.data_type?.includes('[]')) {
        query = query.contains(muscleGroupsCol, [muscleGroup])
      } else {
        query = query.ilike(muscleGroupsCol, `%${muscleGroup}%`)
      }
    }

    if (equipment) {
      const equipmentCol = columnMap.equipment || 'equipment'
      if (schemaInfo.columns[equipmentCol]?.data_type?.includes('[]')) {
        query = query.contains(equipmentCol, [equipment])
      } else {
        query = query.ilike(equipmentCol, `%${equipment}%`)
      }
    }

    if (difficultyLevel) {
      const difficultyCol = columnMap.difficulty_level || 'difficulty_level'
      query = query.eq(difficultyCol, difficultyLevel)
    }

    if (syncStatus) {
      const syncStatusCol = columnMap.sync_status || 'sync_status'
      if (schemaInfo.columns[syncStatusCol]) {
        query = query.eq(syncStatusCol, syncStatus)
      }
    }

    if (isActive !== null) {
      const isActiveCol = columnMap.is_active || 'is_active' || 'active'
      query = query.eq(isActiveCol, isActive === 'true')
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    // Order by created_at if available, otherwise by first available column
    const orderCol = columnMap.created_at || Object.keys(schemaInfo.columns)[0]
    const { data, error, count } = await query
      .range(from, to)
      .order(orderCol, { ascending: false })

    if (error) {
      console.error('Error fetching exercises:', error)
      return NextResponse.json(
        { success: false, error: `Failed to fetch exercises: ${error.message}` } as ApiResponse,
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        exercises: data || [],
        pagination: {
          page,
          pageSize,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / pageSize)
        },
        schema_info: {
          columns: Object.keys(schemaInfo.columns),
          column_mapping: columnMap
        }
      }
    } as ApiResponse)

  } catch (error) {
    console.error('Error in exercises API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' } as ApiResponse,
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate that we have required fields
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' } as ApiResponse,
        { status: 400 }
      )
    }

    // Inspect schema to understand the actual table structure
    const schemaInfo = await schemaInspector.inspectExercisesTable()
    
    if (!schemaInfo.hasTable) {
      return NextResponse.json(
        { success: false, error: 'Exercises table not found' } as ApiResponse,
        { status: 404 }
      )
    }

    // Prepare data using actual column names
    const insertData: Record<string, any> = {}
    const columnMap = schemaInfo.suggestedMapping

    // Map common fields
    const fieldMappings = {
      name: body.name,
      description: body.description,
      category: body.category,
      muscle_groups: body.muscle_groups || body.muscleGroups,
      equipment: body.equipment,
      instructions: body.instructions,
      video_url: body.video_url || body.videoUrl,
      thumbnail_url: body.thumbnail_url || body.thumbnailUrl,
      difficulty_level: body.difficulty_level || body.difficultyLevel,
      is_active: body.is_active !== undefined ? body.is_active : true,
      trainerize_id: body.trainerize_id || body.trainerizeId,
      sync_status: body.sync_status || 'pending'
    }

    for (const [standardField, value] of Object.entries(fieldMappings)) {
      const actualColumn = columnMap[standardField] || standardField
      if (value !== undefined && schemaInfo.columns[actualColumn]) {
        insertData[actualColumn] = value
      }
    }

    // Add timestamps if columns exist
    const now = new Date().toISOString()
    const createdAtCol = columnMap.created_at || 'created_at'
    const updatedAtCol = columnMap.updated_at || 'updated_at'
    
    if (schemaInfo.columns[createdAtCol]) insertData[createdAtCol] = now
    if (schemaInfo.columns[updatedAtCol]) insertData[updatedAtCol] = now

    // Ensure we have at least a name
    const nameCol = columnMap.name || 'name'
    if (!insertData[nameCol]) {
      return NextResponse.json(
        { success: false, error: 'Exercise name is required' } as ApiResponse,
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('exercises')
      .insert(insertData as any)
      .select()
      .single()

    if (error) {
      console.error('Error creating exercise:', error)
      return NextResponse.json(
        { success: false, error: `Failed to create exercise: ${error.message}` } as ApiResponse,
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Exercise created successfully'
    } as ApiResponse)

  } catch (error) {
    console.error('Error in exercise creation:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' } as ApiResponse,
      { status: 500 }
    )
  }
}