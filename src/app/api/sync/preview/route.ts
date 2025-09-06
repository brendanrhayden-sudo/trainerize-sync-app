import { NextRequest, NextResponse } from 'next/server'
import { syncService } from '@/lib/sync-service'
import type { ApiResponse } from '@/types'

export async function GET(request: NextRequest) {
  try {
    // Initialize the sync service
    await syncService.initialize()

    // Get the sync preview
    const preview = await syncService.previewSync()

    return NextResponse.json({
      success: true,
      data: preview,
      message: `Preview ready: ${preview.total_trainerize_exercises} exercises analyzed`
    } as ApiResponse)

  } catch (error) {
    console.error('Error in sync preview:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Preview failed' 
      } as ApiResponse,
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { operations, audit_note } = body

    if (!operations || !Array.isArray(operations)) {
      return NextResponse.json(
        { success: false, error: 'Operations array is required' } as ApiResponse,
        { status: 400 }
      )
    }

    // Filter out conflict operations - user must resolve these first
    const validOperations = operations.filter((op: any) => 
      op.operation !== 'conflict' && op.operation !== 'skip'
    )

    if (validOperations.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid operations to perform' } as ApiResponse,
        { status: 400 }
      )
    }

    // Initialize the sync service
    await syncService.initialize()

    // Perform the sync
    const result = await syncService.performSync(validOperations, audit_note)

    return NextResponse.json({
      success: result.success,
      data: result,
      message: `Sync completed: ${result.summary.created} created, ${result.summary.updated} updated, ${result.summary.failed} failed`
    } as ApiResponse)

  } catch (error) {
    console.error('Error in sync execution:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Sync failed' 
      } as ApiResponse,
      { status: 500 }
    )
  }
}