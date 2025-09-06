import { NextRequest, NextResponse } from 'next/server';
import { TrainerizeWorkoutManager } from '@/lib/trainerize-workout-manager';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const manager = new TrainerizeWorkoutManager();
    
    // Validate required fields
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
    
    // Set defaults
    const workoutRequest = {
      type: body.type || 'mine',
      userID: body.userID,
      trainingPlanID: body.trainingPlanID,
      workoutDef: {
        name: body.workoutDef.name,
        exercises: body.workoutDef.exercises,
        type: body.workoutDef.type || 'workoutRegular',
        instructions: body.workoutDef.instructions || '',
        tags: body.workoutDef.tags || [],
        trackingStats: body.workoutDef.trackingStats || {}
      }
    };
    
    // Add to Trainerize
    const result = await manager.addWorkout(workoutRequest);
    
    return NextResponse.json(result);
    
  } catch (error: any) {
    console.error('Error adding workout:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}