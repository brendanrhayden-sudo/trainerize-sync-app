import { NextRequest, NextResponse } from 'next/server'
import { trainerizeClient } from '@/lib/trainerize-client'
import { supabaseAdmin } from '@/lib/supabase'
import type { ApiResponse } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { exerciseId, exerciseData, addToTrainerize = true } = body

    let exercise: any

    // If exerciseId provided, fetch from Supabase
    if (exerciseId) {
      const { data, error } = await supabaseAdmin
        .from('exercises')
        .select('*')
        .eq('id', exerciseId)
        .single()

      if (error || !data) {
        return NextResponse.json(
          { success: false, error: 'Exercise not found in database' } as ApiResponse,
          { status: 404 }
        )
      }

      exercise = data
    } else if (exerciseData) {
      // Use provided exercise data
      exercise = exerciseData
    } else {
      return NextResponse.json(
        { success: false, error: 'Either exerciseId or exerciseData must be provided' } as ApiResponse,
        { status: 400 }
      )
    }

    // Check if already synced
    if (exercise.trainerize_id && addToTrainerize) {
      return NextResponse.json({
        success: false,
        error: 'Exercise already exists in Trainerize',
        data: {
          trainerize_id: exercise.trainerize_id,
          already_synced: true
        }
      } as ApiResponse)
    }

    let trainerizeResult = null

    // Add to Trainerize if requested
    if (addToTrainerize) {
      try {
        // Check for duplicates first
        const duplicateCheck = await trainerizeClient.checkForDuplicates(exercise.name)
        
        if (duplicateCheck.isDuplicate) {
          return NextResponse.json({
            success: false,
            error: 'Duplicate exercise found in Trainerize',
            data: {
              duplicate: duplicateCheck.existingExercise,
              reason: 'Exercise with similar name already exists in Trainerize'
            }
          } as ApiResponse, { status: 409 })
        }

        // Map and add to Trainerize
        const trainerizeFormat = trainerizeClient.mapSupabaseToTrainerize(exercise)
        const result = await trainerizeClient.addExercise(trainerizeFormat)

        if (result.success && result.id) {
          // Update Supabase with new Trainerize ID
          const { error: updateError } = await supabaseAdmin
            .from('exercises')
            .update({
              trainerize_id: result.id.toString(),
              synced_at: new Date().toISOString(),
              sync_status: 'synced'
            })
            .eq('id', exercise.id)

          if (updateError) {
            console.error('Failed to update Supabase with Trainerize ID:', updateError)
          }

          trainerizeResult = {
            success: true,
            trainerize_id: result.id.toString(),
            synced_at: new Date().toISOString()
          }
        } else {
          trainerizeResult = {
            success: false,
            error: result.error || 'Failed to add to Trainerize'
          }
        }
      } catch (trainerizeError) {
        console.error('Trainerize API error:', trainerizeError)
        trainerizeResult = {
          success: false,
          error: trainerizeError instanceof Error ? trainerizeError.message : 'Trainerize API error'
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
        records_created: trainerizeResult?.success ? 1 : 0,
        error_message: trainerizeResult?.success === false ? trainerizeResult.error : null,
        metadata: {
          operation: 'add_exercise',
          exercise_id: exercise.id,
          exercise_name: exercise.name,
          add_to_trainerize: addToTrainerize,
          trainerize_result: trainerizeResult
        }
      }])

    return NextResponse.json({
      success: true,
      data: {
        exercise,
        trainerize: trainerizeResult
      },
      message: trainerizeResult?.success 
        ? 'Exercise added to Trainerize successfully' 
        : addToTrainerize 
          ? 'Exercise processed, but Trainerize sync failed'
          : 'Exercise processed successfully'
    } as ApiResponse)

  } catch (error) {
    console.error('Error adding exercise:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to add exercise' 
      } as ApiResponse,
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      exerciseIds, 
      skipExisting = true, 
      checkForDuplicates = true 
    } = body

    if (!exerciseIds || !Array.isArray(exerciseIds)) {
      return NextResponse.json(
        { success: false, error: 'exerciseIds array is required' } as ApiResponse,
        { status: 400 }
      )
    }

    // Start bulk operation log
    const { data: bulkLog } = await supabaseAdmin
      .from('sync_logs')
      .insert([{
        sync_type: 'manual',
        status: 'started',
        started_at: new Date().toISOString(),
        metadata: {
          operation: 'bulk_add_to_trainerize',
          total_exercises: exerciseIds.length,
          skip_existing: skipExisting,
          check_duplicates: checkForDuplicates
        }
      }])
      .select('id')
      .single()

    // Use streaming response for real-time progress updates
    const encoder = new TextEncoder()
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()

    // Process in background
    ;(async () => {
      try {
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({
            type: 'start',
            total: exerciseIds.length,
            message: 'Starting bulk add operation...'
          })}\n\n`)
        )

        const results = await trainerizeClient.bulkAddExercises(exerciseIds, {
          skipExisting,
          checkForDuplicates,
          onProgress: async (current, total, exercise) => {
            await writer.write(
              encoder.encode(`data: ${JSON.stringify({
                type: 'progress',
                current,
                total,
                exercise_name: exercise?.name,
                percentage: Math.round((current / total) * 100)
              })}\n\n`)
            )
          }
        })

        // Update bulk log
        if (bulkLog) {
          await supabaseAdmin
            .from('sync_logs')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              records_processed: exerciseIds.length,
              records_created: results.successful.length,
              error_message: results.failed.length > 0 ? 
                `${results.failed.length} exercises failed to sync` : null,
              metadata: {
                operation: 'bulk_add_to_trainerize',
                results: {
                  successful: results.successful.length,
                  failed: results.failed.length,
                  skipped: results.skipped.length,
                  duplicates: results.duplicates.length
                }
              }
            })
            .eq('id', bulkLog.id)
        }

        await writer.write(
          encoder.encode(`data: ${JSON.stringify({
            type: 'complete',
            results: {
              successful: results.successful.length,
              failed: results.failed.length,
              skipped: results.skipped.length,
              duplicates: results.duplicates.length,
              details: {
                successful: results.successful.map(r => ({
                  name: r.exercise.name,
                  trainerize_id: r.trainerize_id
                })),
                failed: results.failed.map(r => ({
                  name: r.exercise.name,
                  error: r.error
                })),
                skipped: results.skipped.map(r => ({
                  name: r.exercise.name,
                  reason: r.reason
                })),
                duplicates: results.duplicates.map(r => ({
                  name: r.exercise.name,
                  existing_name: r.existing_name
                }))
              }
            },
            message: `Bulk add completed: ${results.successful.length} successful, ${results.failed.length} failed, ${results.skipped.length} skipped, ${results.duplicates.length} duplicates`
          })}\n\n`)
        )

      } catch (error: any) {
        console.error('Bulk add error:', error)

        // Update bulk log with error
        if (bulkLog) {
          await supabaseAdmin
            .from('sync_logs')
            .update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              error_message: error.message
            })
            .eq('id', bulkLog.id)
        }

        await writer.write(
          encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            message: error.message
          })}\n\n`)
        )
      } finally {
        await writer.close()
      }
    })()

    return new NextResponse(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    })

  } catch (error) {
    console.error('Error in bulk add:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Bulk add failed' 
      } as ApiResponse,
      { status: 500 }
    )
  }
}