import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import type { ApiResponse } from '@/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching exercise:', error)
      return NextResponse.json(
        { success: false, error: 'Exercise not found' } as ApiResponse,
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    } as ApiResponse)

  } catch (error) {
    console.error('Error in exercise fetch:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' } as ApiResponse,
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    const { data, error } = await supabase
      .from('exercises')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating exercise:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update exercise' } as ApiResponse,
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Exercise updated successfully'
    } as ApiResponse)

  } catch (error) {
    console.error('Error in exercise update:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' } as ApiResponse,
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { error } = await supabase
      .from('exercises')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting exercise:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to delete exercise' } as ApiResponse,
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Exercise deleted successfully'
    } as ApiResponse)

  } catch (error) {
    console.error('Error in exercise deletion:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' } as ApiResponse,
      { status: 500 }
    )
  }
}