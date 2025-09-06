import { NextRequest, NextResponse } from 'next/server';
import { TrainerizeProgramManager } from '@/lib/trainerize-program-manager';

export async function POST(request: NextRequest) {
  try {
    const assessment = await request.json();
    
    // Validate assessment
    if (!assessment.clientId || !assessment.fitnessLevel) {
      return NextResponse.json(
        { error: 'Invalid assessment data' },
        { status: 400 }
      );
    }
    
    const manager = new TrainerizeProgramManager();
    
    // Generate program
    const result = await manager.generateProgramFromAssessment(assessment);
    
    return NextResponse.json({
      success: true,
      program: result.program,
      trainingPlan: result.trainingPlan,
      workouts: result.workouts
    });
    
  } catch (error: any) {
    console.error('Error generating program:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}