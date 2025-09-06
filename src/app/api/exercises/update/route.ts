import { NextRequest, NextResponse } from 'next/server'
import { trainerizeClient } from '@/lib/trainerize-client'
import { supabaseAdmin } from '@/lib/supabase'
import type { ApiResponse } from '@/types'
import type { TrainerizeExerciseUpdate } from '@/types/trainerize'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { exercise, syncToTrainerize = true } = body

    // Validate required fields
    if (!exercise.id) {
      return NextResponse.json(
        { success: false, error: 'Exercise ID is required' } as ApiResponse,
        { status: 400 }
      )
    }

    // Validate exercise data
    const validation = trainerizeClient.validateExerciseUpdate(exercise)
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Validation failed', 
          details: validation.errors 
        } as ApiResponse,
        { status: 400 }
      )
    }

    // Update in Supabase first
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (exercise.name) updateData.name = exercise.name
    if (exercise.description) updateData.description = exercise.description
    if (exercise.muscle_groups) updateData.muscle_groups = exercise.muscle_groups
    if (exercise.equipment) updateData.equipment = exercise.equipment
    if (exercise.difficulty) updateData.difficulty_level = exercise.difficulty
    if (exercise.tag) updateData.category = exercise.tag
    if (exercise.videoUrl) updateData.video_url = exercise.videoUrl
    if (exercise.instructions) updateData.instructions = exercise.instructions

    const { data: updatedExercise, error: dbError } = await supabaseAdmin
      .from('exercises')
      .update(updateData)
      .eq('trainerize_id', exercise.id)
      .select()
      .single()

    if (dbError) {
      console.error('Database update error:', dbError)
      return NextResponse.json(
        { 
          success: false, 
          error: `Database update failed: ${dbError.message}` 
        } as ApiResponse,
        { status: 500 }
      )
    }

    // Sync to Trainerize if requested
    let trainerizeResult = null
    if (syncToTrainerize && exercise.id) {
      try {
        const trainerizeUpdate: TrainerizeExerciseUpdate = {
          id: parseInt(exercise.id),
          name: exercise.name,
          alternateName: exercise.alternateName,
          description: exercise.description,
          recordType: exercise.recordType,
          tag: exercise.tag,
          videoUrl: exercise.videoUrl,
          videoType: exercise.videoType,
          tags: exercise.tags || []
        }

        const success = await trainerizeClient.updateExercise(trainerizeUpdate)
        
        if (success) {
          // Update sync status in database
          await supabaseAdmin
            .from('exercises')
            .update({
              sync_status: 'synced',
              synced_at: new Date().toISOString()
            })
            .eq('trainerize_id', exercise.id)
        }

        trainerizeResult = { 
          success, 
          synced_at: success ? new Date().toISOString() : null 
        }
      } catch (syncError) {
        console.error('Trainerize sync error:', syncError)
        
        // Update sync status to error
        await supabaseAdmin
          .from('exercises')
          .update({
            sync_status: 'error'
          })
          .eq('trainerize_id', exercise.id)

        trainerizeResult = {
          success: false,
          error: syncError instanceof Error ? syncError.message : 'Sync failed'
        }
      }
    }

    // Log the operation
    await supabaseAdmin
      .from('sync_logs')
      .insert([{
        sync_type: 'manual',
        status: 'completed',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        records_processed: 1,
        records_updated: 1,
        metadata: {
          operation: 'update',
          exercise_id: exercise.id,
          sync_to_trainerize: syncToTrainerize,
          trainerize_result: trainerizeResult
        }
      }])

    return NextResponse.json({
      success: true,
      data: {
        exercise: updatedExercise,
        trainerize: trainerizeResult
      },
      message: `Exercise updated successfully${syncToTrainerize ? ' and synced to Trainerize' : ''}`
    } as ApiResponse)

  } catch (error) {
    console.error('Error updating exercise:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Update failed' 
      } as ApiResponse,
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { exercises, syncToTrainerize = true } = body

    if (!exercises || !Array.isArray(exercises)) {
      return NextResponse.json(
        { success: false, error: 'Exercises array is required' } as ApiResponse,
        { status: 400 }
      )
    }

    // Start batch operation log
    const { data: batchLog } = await supabaseAdmin
      .from('sync_logs')
      .insert([{
        sync_type: 'manual',
        status: 'started',
        started_at: new Date().toISOString(),
        metadata: {
          operation: 'batch_update',
          total_exercises: exercises.length,
          sync_to_trainerize: syncToTrainerize
        }
      }])
      .select('id')
      .single()

    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[]
    }

    // Process each exercise
    for (let i = 0; i < exercises.length; i++) {
      try {
        const exercise = exercises[i]
        
        // Update individual exercise
        const response = await fetch(`${request.nextUrl.origin}/api/exercises/update`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            exercise,
            syncToTrainerize
          })
        })

        if (response.ok) {
          results.success++
        } else {
          const errorData = await response.json()
          results.failed++
          results.errors.push({
            exerciseId: exercise.id,
            error: errorData.error || 'Unknown error'
          })
        }
      } catch (error) {
        results.failed++
        results.errors.push({
          exerciseId: exercises[i].id,
          error: error instanceof Error ? error.message : 'Processing error'
        })
      }
    }

    // Update batch log
    if (batchLog) {
      await supabaseAdmin
        .from('sync_logs')
        .update({
          status: results.failed === 0 ? 'completed' : 'failed',
          completed_at: new Date().toISOString(),
          records_processed: exercises.length,
          records_updated: results.success,
          error_message: results.errors.length > 0 ? 
            results.errors.slice(0, 3).map(e => `${e.exerciseId}: ${e.error}`).join('; ') : 
            null,
          metadata: {
            operation: 'batch_update',
            results
          }
        })
        .eq('id', batchLog.id)
    }

    return NextResponse.json({
      success: results.failed === 0,
      data: results,
      message: `Batch update completed: ${results.success} success, ${results.failed} failed`
    } as ApiResponse)

  } catch (error) {
    console.error('Error in batch update:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Batch update failed' 
      } as ApiResponse,
      { status: 500 }
    )
  }
}