import { NextRequest, NextResponse } from 'next/server'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { trainerizeClient, type TrainerizeExercise } from '@/lib/trainerize-client'
import type { ApiResponse, Exercise } from '@/types'

export async function POST(request: NextRequest) {
  try {
    // Return error if Supabase isn't configured
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Database not configured. Please set up environment variables.' } as ApiResponse,
        { status: 503 }
      )
    }

    const { type = 'manual' } = await request.json()
    
    const syncLogInsert = {
      sync_type: type as 'full' | 'incremental' | 'manual',
      status: 'started' as const,
      started_at: new Date().toISOString(),
      records_processed: 0,
      records_created: 0,
      records_updated: 0,
      records_deleted: 0
    }

    const { data: syncLog, error: syncLogError } = await supabase
      .from('sync_logs')
      .insert([syncLogInsert])
      .select()
      .single()

    if (syncLogError) {
      throw new Error('Failed to create sync log')
    }

    try {
      let totalProcessed = 0
      let totalCreated = 0
      let totalUpdated = 0

      // Discover exercises from plans (using default group ID)
      const groupId = parseInt(process.env.TRAINERIZE_GROUP_ID || '0')
      const exercises = await trainerizeClient.discoverExercisesFromPlans([groupId])
        
        for (const trainerizeExercise of exercises) {
          try {
            const exerciseData = mapTrainerizeToSupabase(trainerizeExercise)
            
            const { data: existingExercise } = await supabase
              .from('exercises')
              .select('id, updated_at')
              .eq('trainerize_id', trainerizeExercise.id)
              .single()

            if (existingExercise) {
              const { error: updateError } = await supabase
                .from('exercises')
                .update({
                  ...exerciseData,
                  updated_at: new Date().toISOString(),
                  synced_at: new Date().toISOString(),
                  sync_status: 'synced'
                })
                .eq('id', existingExercise.id)

              if (!updateError) {
                totalUpdated++
              }
            } else {
              const { error: insertError } = await supabase
                .from('exercises')
                .insert([{
                  ...exerciseData,
                  synced_at: new Date().toISOString(),
                  sync_status: 'synced'
                }])

              if (!insertError) {
                totalCreated++
              }
            }

            totalProcessed++
          } catch (exerciseError) {
            console.error(`Error processing exercise ${trainerizeExercise.id}:`, exerciseError)
          }
        }

      await supabase
        .from('sync_logs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          records_processed: totalProcessed,
          records_created: totalCreated,
          records_updated: totalUpdated
        })
        .eq('id', syncLog.id)

      return NextResponse.json({
        success: true,
        data: {
          syncId: syncLog.id,
          processed: totalProcessed,
          created: totalCreated,
          updated: totalUpdated
        },
        message: 'Sync completed successfully'
      } as ApiResponse)

    } catch (syncError) {
      await supabase
        .from('sync_logs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: syncError instanceof Error ? syncError.message : 'Unknown error'
        })
        .eq('id', syncLog.id)

      throw syncError
    }

  } catch (error) {
    console.error('Error in sync:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Sync failed' 
      } as ApiResponse,
      { status: 500 }
    )
  }
}

function mapTrainerizeToSupabase(trainerizeExercise: TrainerizeExercise): Omit<Exercise, 'id' | 'created_at' | 'updated_at'> {
  return {
    trainerize_id: trainerizeExercise.id,
    name: trainerizeExercise.name,
    description: trainerizeExercise.description || null,
    category: trainerizeExercise.category || null,
    muscle_groups: trainerizeExercise.muscle_groups || [],
    equipment: trainerizeExercise.equipment || [],
    instructions: trainerizeExercise.instructions?.join('\n') || null,
    video_url: trainerizeExercise.video_url || null,
    thumbnail_url: trainerizeExercise.thumbnail_url || null,
    difficulty_level: (trainerizeExercise.difficulty as "beginner" | "intermediate" | "advanced") || null,
    is_active: trainerizeExercise.is_active !== false,
    synced_at: new Date().toISOString(),
    sync_status: 'synced' as const,
    metadata: trainerizeExercise
  }
}