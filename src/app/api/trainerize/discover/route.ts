import { NextRequest, NextResponse } from 'next/server'
import { trainerizeClient } from '@/lib/trainerize-client'
import { supabaseAdmin } from '@/lib/supabase'
import type { ApiResponse } from '@/types'

let discoveryRunning = false
let discoveryController: AbortController | null = null

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      mode = 'plans', 
      userIds = [], 
      startId = 1, 
      endId = 10000,
      stream = false 
    } = body

    if (discoveryRunning) {
      return NextResponse.json(
        { success: false, error: 'Discovery already running' } as ApiResponse,
        { status: 409 }
      )
    }

    // Start discovery log
    const { data: discoveryLog } = await supabaseAdmin
      .from('sync_logs')
      .insert([{
        sync_type: 'discovery',
        status: 'started',
        started_at: new Date().toISOString(),
        metadata: {
          mode,
          userIds: mode === 'plans' ? userIds : null,
          range: mode === 'range' ? { startId, endId } : null
        }
      }])
      .select('id')
      .single()

    if (stream) {
      return handleStreamingDiscovery(mode, { userIds, startId, endId }, discoveryLog?.id)
    } else {
      return handleBatchDiscovery(mode, { userIds, startId, endId }, discoveryLog?.id)
    }

  } catch (error) {
    console.error('Error in discovery:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Discovery failed' 
      } as ApiResponse,
      { status: 500 }
    )
  }
}

async function handleStreamingDiscovery(
  mode: string, 
  options: any, 
  logId?: string
): Promise<NextResponse> {
  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()
  
  discoveryRunning = true
  discoveryController = new AbortController()

  // Start discovery in background
  ;(async () => {
    try {
      await writer.write(
        encoder.encode(`data: ${JSON.stringify({ 
          type: 'start', 
          message: 'Starting discovery...',
          mode 
        })}\n\n`)
      )

      let exercises: any[] = []

      if (mode === 'plans') {
        exercises = await trainerizeClient.batchDiscoverExercises(options.userIds, {
          onProgress: async (progress) => {
            if (discoveryController?.signal.aborted) return
            
            await writer.write(
              encoder.encode(`data: ${JSON.stringify({
                type: 'progress',
                ...progress
              })}\n\n`)
            )
          },
          onError: async (userID, error) => {
            await writer.write(
              encoder.encode(`data: ${JSON.stringify({
                type: 'error',
                userID,
                message: error.message
              })}\n\n`)
            )
          }
        })
      } else {
        // Range-based discovery would go here
        // For now, use plans-based discovery as fallback
        exercises = await trainerizeClient.discoverExercisesFromPlans([parseInt(process.env.TRAINERIZE_GROUP_ID || '0')])
      }

      // Save exercises to database
      let saved = 0
      let errors = 0

      for (const exercise of exercises) {
        try {
          await supabaseAdmin
            .from('exercises')
            .upsert({
              trainerize_id: exercise.id,
              name: exercise.name,
              description: exercise.description,
              category: exercise.category,
              muscle_groups: exercise.muscle_groups || [],
              equipment: exercise.equipment || [],
              instructions: exercise.instructions?.join('\n'),
              video_url: exercise.video_url,
              thumbnail_url: exercise.thumbnail_url,
              difficulty_level: exercise.difficulty,
              is_active: exercise.is_active !== false,
              sync_status: 'synced',
              synced_at: new Date().toISOString(),
              metadata: exercise
            }, { 
              onConflict: 'trainerize_id',
              ignoreDuplicates: false 
            })

          saved++

          await writer.write(
            encoder.encode(`data: ${JSON.stringify({
              type: 'exercise_saved',
              exercise: {
                id: exercise.id,
                name: exercise.name,
                category: exercise.category
              },
              saved,
              total: exercises.length
            })}\n\n`)
          )

        } catch (saveError) {
          errors++
          console.error(`Error saving exercise ${exercise.id}:`, saveError)
        }
      }

      // Update discovery log
      if (logId) {
        await supabaseAdmin
          .from('sync_logs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            records_processed: exercises.length,
            records_created: saved,
            error_message: errors > 0 ? `${errors} exercises failed to save` : null
          })
          .eq('id', logId)
      }

      await writer.write(
        encoder.encode(`data: ${JSON.stringify({
          type: 'complete',
          total: exercises.length,
          saved,
          errors,
          summary: `Discovered ${exercises.length} exercises, saved ${saved}`
        })}\n\n`)
      )

    } catch (error) {
      console.error('Discovery error:', error)
      
      // Update discovery log
      if (logId) {
        await supabaseAdmin
          .from('sync_logs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('id', logId)
      }

      await writer.write(
        encoder.encode(`data: ${JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Discovery failed'
        })}\n\n`)
      )
    } finally {
      discoveryRunning = false
      discoveryController = null
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
}

async function handleBatchDiscovery(
  mode: string, 
  options: any, 
  logId?: string
): Promise<NextResponse> {
  discoveryRunning = true

  try {
    let exercises: any[] = []

    if (mode === 'plans') {
      exercises = await trainerizeClient.batchDiscoverExercises(options.userIds)
    } else {
      exercises = await trainerizeClient.discoverExercisesFromPlans([parseInt(process.env.TRAINERIZE_GROUP_ID || '0')])
    }

    // Save exercises to database
    let saved = 0
    const errors: string[] = []

    for (const exercise of exercises) {
      try {
        await supabaseAdmin
          .from('exercises')
          .upsert({
            trainerize_id: exercise.id,
            name: exercise.name,
            description: exercise.description,
            category: exercise.category,
            muscle_groups: exercise.muscle_groups || [],
            equipment: exercise.equipment || [],
            instructions: exercise.instructions?.join('\n'),
            video_url: exercise.video_url,
            thumbnail_url: exercise.thumbnail_url,
            difficulty_level: exercise.difficulty,
            is_active: exercise.is_active !== false,
            sync_status: 'synced',
            synced_at: new Date().toISOString(),
            metadata: exercise
          }, { 
            onConflict: 'trainerize_id',
            ignoreDuplicates: false 
          })

        saved++
      } catch (saveError) {
        const errorMsg = `Exercise ${exercise.id}: ${saveError instanceof Error ? saveError.message : 'Unknown error'}`
        errors.push(errorMsg)
        console.error('Error saving exercise:', saveError)
      }
    }

    // Update discovery log
    if (logId) {
      await supabaseAdmin
        .from('sync_logs')
        .update({
          status: errors.length === 0 ? 'completed' : 'failed',
          completed_at: new Date().toISOString(),
          records_processed: exercises.length,
          records_created: saved,
          error_message: errors.length > 0 ? errors.slice(0, 5).join('; ') : null
        })
        .eq('id', logId)
    }

    return NextResponse.json({
      success: true,
      data: {
        discovered: exercises.length,
        saved,
        errors: errors.length,
        exercises: exercises.slice(0, 10) // Return first 10 as preview
      },
      message: `Discovery completed: ${saved}/${exercises.length} exercises saved`
    } as ApiResponse)

  } catch (error) {
    // Update discovery log
    if (logId) {
      await supabaseAdmin
        .from('sync_logs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', logId)
    }

    throw error
  } finally {
    discoveryRunning = false
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeStats = searchParams.get('stats') === 'true'

    // Get discovery status
    const { data: exercises, error: exercisesError } = await supabaseAdmin
      .from('exercises')
      .select('id, trainerize_id, name, sync_status, synced_at')
      .order('synced_at', { ascending: false })
      .limit(100)

    if (exercisesError) {
      throw new Error(`Failed to fetch exercises: ${exercisesError.message}`)
    }

    let stats = null
    if (includeStats) {
      const { data: syncLogs } = await supabaseAdmin
        .from('sync_logs')
        .select('*')
        .eq('sync_type', 'discovery')
        .order('started_at', { ascending: false })
        .limit(10)

      const { count: totalExercises } = await supabaseAdmin
        .from('exercises')
        .select('*', { count: 'exact', head: true })

      const { count: syncedExercises } = await supabaseAdmin
        .from('exercises')
        .select('*', { count: 'exact', head: true })
        .eq('sync_status', 'synced')

      stats = {
        totalExercises: totalExercises || 0,
        syncedExercises: syncedExercises || 0,
        recentDiscoveries: syncLogs || [],
        discoveryRunning
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        exercises: exercises || [],
        discoveryRunning,
        stats
      }
    } as ApiResponse)

  } catch (error) {
    console.error('Error fetching discovery status:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch status' 
      } as ApiResponse,
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    if (discoveryRunning && discoveryController) {
      discoveryController.abort()
      discoveryRunning = false
      discoveryController = null

      return NextResponse.json({
        success: true,
        message: 'Discovery stopped'
      } as ApiResponse)
    }

    return NextResponse.json({
      success: false,
      error: 'No discovery running'
    } as ApiResponse, { status: 400 })

  } catch {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to stop discovery' 
      } as ApiResponse,
      { status: 500 }
    )
  }
}