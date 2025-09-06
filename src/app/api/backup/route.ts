import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { ApiResponse } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'

    // Get all exercises with metadata
    const { data: exercises, error: exercisesError } = await supabaseAdmin
      .from('exercises')
      .select('*')
      .order('created_at', { ascending: true })

    if (exercisesError) {
      throw new Error(`Failed to fetch exercises: ${exercisesError.message}`)
    }

    // Get sync logs for audit trail
    const { data: syncLogs, error: logsError } = await supabaseAdmin
      .from('sync_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(100)

    if (logsError) {
      console.warn('Could not fetch sync logs:', logsError)
    }

    const backup = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      source: 'supabase',
      total_exercises: exercises?.length || 0,
      data: {
        exercises: exercises || [],
        sync_logs: syncLogs || []
      },
      metadata: {
        backup_type: 'full',
        created_by: 'trainerize-sync-app',
        format: format
      }
    }

    // Store backup in Supabase Storage (if configured)
    try {
      const backupFileName = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      
      const { error: uploadError } = await supabaseAdmin.storage
        .from('backups')
        .upload(backupFileName, JSON.stringify(backup, null, 2), {
          contentType: 'application/json'
        })

      if (uploadError) {
        console.warn('Could not upload backup to storage:', uploadError)
      } else {
        (backup.metadata as any)['storage_file'] = backupFileName
      }
    } catch (storageError) {
      console.warn('Storage not available:', storageError)
    }

    const response = NextResponse.json({
      success: true,
      data: backup,
      message: `Backup created with ${backup.total_exercises} exercises`
    } as ApiResponse)

    // Set headers for file download
    if (format === 'download') {
      response.headers.set('Content-Type', 'application/json')
      response.headers.set('Content-Disposition', `attachment; filename="exercises_backup_${Date.now()}.json"`)
    }

    return response

  } catch (error) {
    console.error('Error creating backup:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Backup failed' 
      } as ApiResponse,
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { backup_data, restore_mode = 'safe' } = body

    if (!backup_data || !backup_data.data || !backup_data.data.exercises) {
      return NextResponse.json(
        { success: false, error: 'Invalid backup data format' } as ApiResponse,
        { status: 400 }
      )
    }

    const exercises = backup_data.data.exercises
    let restored = 0
    let skipped = 0
    const errors: string[] = []

    // Create restore log
    const { data: restoreLog } = await supabaseAdmin
      .from('sync_logs')
      .insert([{
        sync_type: 'manual',
        status: 'started',
        started_at: new Date().toISOString(),
        metadata: {
          backup_timestamp: backup_data.timestamp,
          restore_mode,
          total_exercises: exercises.length
        }
      }])
      .select('id')
      .single()

    for (const exercise of exercises) {
      try {
        if (restore_mode === 'safe') {
          // In safe mode, only restore if exercise doesn't exist
          const { data: existing } = await supabaseAdmin
            .from('exercises')
            .select('id')
            .eq('id', exercise.id)
            .single()

          if (existing) {
            skipped++
            continue
          }
        }

        const { error } = await supabaseAdmin
          .from('exercises')
          .upsert([exercise], { 
            onConflict: restore_mode === 'overwrite' ? 'id' : undefined 
          })

        if (error) {
          errors.push(`Exercise ${exercise.id}: ${error.message}`)
        } else {
          restored++
        }
      } catch (err) {
        errors.push(`Exercise ${exercise.id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    // Update restore log
    if (restoreLog) {
      await supabaseAdmin
        .from('sync_logs')
        .update({
          status: errors.length === 0 ? 'completed' : 'failed',
          completed_at: new Date().toISOString(),
          records_processed: exercises.length,
          records_created: restored,
          error_message: errors.length > 0 ? errors.join('; ') : null,
          metadata: {
            restored,
            skipped,
            errors: errors.length
          }
        })
        .eq('id', restoreLog.id)
    }

    return NextResponse.json({
      success: errors.length === 0,
      data: {
        restored,
        skipped,
        errors: errors.length,
        error_details: errors.length > 10 ? errors.slice(0, 10) : errors
      },
      message: `Restore completed: ${restored} restored, ${skipped} skipped, ${errors.length} errors`
    } as ApiResponse)

  } catch (error) {
    console.error('Error restoring backup:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Restore failed' 
      } as ApiResponse,
      { status: 500 }
    )
  }
}