import { NextRequest, NextResponse } from 'next/server';
import { TrainerizeProgramManager } from '@/lib/trainerize-program-manager';

export async function POST(request: NextRequest) {
  try {
    const { programId, clientId } = await request.json();
    
    // Validate input
    if (!programId || !clientId) {
      return NextResponse.json(
        { error: 'Program ID and Client ID are required' },
        { status: 400 }
      );
    }
    
    const manager = new TrainerizeProgramManager();
    
    // Export program to Trainerize
    const result = await manager.exportToTrainerize(programId, clientId);
    
    return NextResponse.json({
      success: true,
      trainerizeProgramId: result.trainerizeProgramId,
      exportedWorkouts: result.exportedWorkouts,
      syncStatus: result.syncStatus
    });
    
  } catch (error: any) {
    console.error('Error exporting program:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}