import { NextRequest, NextResponse } from 'next/server';
import { TrainerizeWorkoutManager } from '@/lib/trainerize-workout-manager';

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const manager = new TrainerizeWorkoutManager();
    
    // Validate required fields
    if (!body.workoutDef?.id) {
      return NextResponse.json(
        { error: 'Workout ID is required' },
        { status: 400 }
      );
    }
    
    if (!body.workoutDef?.name) {
      return NextResponse.json(
        { error: 'Workout name is required' },
        { status: 400 }
      );
    }
    
    if (!body.workoutDef?.exercises || body.workoutDef.exercises.length === 0) {
      return NextResponse.json(
        { error: 'At least one exercise is required' },
        { status: 400 }
      );
    }
    
    // Update in Trainerize
    const result = await manager.updateWorkout({
      workoutDef: {
        id: body.workoutDef.id,
        name: body.workoutDef.name,
        exercises: body.workoutDef.exercises,
        type: body.workoutDef.type || 'workoutRegular',
        instructions: body.workoutDef.instructions || '',
        tags: body.workoutDef.tags || [],
        trackingStats: body.workoutDef.trackingStats || {}
      }
    });
    
    return NextResponse.json(result);
    
  } catch (error: any) {
    console.error('Error updating workout:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}