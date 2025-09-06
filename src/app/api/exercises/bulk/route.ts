import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import type { ApiResponse, BulkOperationResult } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const { operation, ids, data } = await request.json()

    let result: BulkOperationResult = {
      success: true,
      processed: 0,
      errors: []
    }

    switch (operation) {
      case 'delete':
        result = await bulkDelete(ids)
        break
      
      case 'update':
        result = await bulkUpdate(ids, data)
        break
      
      case 'activate':
        result = await bulkUpdate(ids, { is_active: true })
        break
      
      case 'deactivate':
        result = await bulkUpdate(ids, { is_active: false })
        break
      
      case 'sync':
        result = await bulkSync(ids)
        break
      
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid operation' } as ApiResponse,
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: result.success,
      data: result,
      message: `Bulk ${operation} completed`
    } as ApiResponse)

  } catch (error) {
    console.error('Error in bulk operation:', error)
    return NextResponse.json(
      { success: false, error: 'Bulk operation failed' } as ApiResponse,
      { status: 500 }
    )
  }
}

async function bulkDelete(ids: string[]): Promise<BulkOperationResult> {
  const result: BulkOperationResult = {
    success: true,
    processed: 0,
    errors: []
  }

  for (const id of ids) {
    try {
      const { error } = await supabase
        .from('exercises')
        .delete()
        .eq('id', id)

      if (error) {
        result.errors.push({
          id,
          message: error.message
        })
      } else {
        result.processed++
      }
    } catch (error) {
      result.errors.push({
        id,
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  result.success = result.errors.length === 0
  return result
}

async function bulkUpdate(ids: string[], updateData: Record<string, any>): Promise<BulkOperationResult> {
  const result: BulkOperationResult = {
    success: true,
    processed: 0,
    errors: []
  }

  for (const id of ids) {
    try {
      const { error } = await supabase
        .from('exercises')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) {
        result.errors.push({
          id,
          message: error.message
        })
      } else {
        result.processed++
      }
    } catch (error) {
      result.errors.push({
        id,
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  result.success = result.errors.length === 0
  return result
}

async function bulkSync(ids: string[]): Promise<BulkOperationResult> {
  const result: BulkOperationResult = {
    success: true,
    processed: 0,
    errors: []
  }

  for (const id of ids) {
    try {
      const { error } = await supabase
        .from('exercises')
        .update({
          sync_status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) {
        result.errors.push({
          id,
          message: error.message
        })
      } else {
        result.processed++
      }
    } catch (error) {
      result.errors.push({
        id,
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  result.success = result.errors.length === 0
  return result
}