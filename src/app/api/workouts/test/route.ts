import { NextRequest, NextResponse } from 'next/server';
import { TrainerizeClient } from '@/lib/trainerize-client';

export async function POST(request: NextRequest) {
  try {
    const { templateId } = await request.json();
    
    if (!templateId) {
      return NextResponse.json(
        { error: 'templateId is required' },
        { status: 400 }
      );
    }

    const client = new TrainerizeClient();
    const results: any = {
      templateId,
      tests: [],
      decodedData: {},
      errors: []
    };

    // Test 1: Get template details
    console.log(`Testing template ID: ${templateId}`);
    
    try {
      const templateData = await client.makeRequest('/workoutTemplate/get', 'POST', { id: templateId });
      
      results.tests.push({
        test: 'Get Template Details',
        success: true,
        data: templateData
      });
      
      // Analyze the response for integer arrays
      results.decodedData.template = await decodeIntegerArrays(templateData);
      
    } catch (error: any) {
      results.tests.push({
        test: 'Get Template Details',
        success: false,
        error: error.message
      });
      results.errors.push(`Template fetch failed: ${error.message}`);
    }

    // Test 2: Try alternative endpoints
    const alternativeEndpoints = [
      { endpoint: '/workoutTemplate/details', params: { templateId } },
      { endpoint: '/workoutTemplate/full', params: { id: templateId } },
      { endpoint: '/workout/template/get', params: { id: templateId } }
    ];

    for (const alt of alternativeEndpoints) {
      try {
        const altData = await client.makeRequest(alt.endpoint, 'POST', alt.params);
        
        results.tests.push({
          test: `Alternative endpoint: ${alt.endpoint}`,
          success: true,
          data: altData
        });
        
        results.decodedData[alt.endpoint] = await decodeIntegerArrays(altData);
        
      } catch (error: any) {
        results.tests.push({
          test: `Alternative endpoint: ${alt.endpoint}`,
          success: false,
          error: error.message
        });
      }
    }

    // Test 3: If we found exercises, try to decode them
    if (results.decodedData.template?.exercises?.length) {
      try {
        const exerciseIds = results.decodedData.template.exercises;
        const decodedExercises = await decodeExerciseIds(exerciseIds.slice(0, 5), client); // Test first 5
        
        results.decodedData.exerciseDetails = decodedExercises;
        results.tests.push({
          test: 'Decode Exercise IDs',
          success: true,
          data: `Decoded ${decodedExercises.length} exercises`
        });
        
      } catch (error: any) {
        results.tests.push({
          test: 'Decode Exercise IDs',
          success: false,
          error: error.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      results
    });

  } catch (error: any) {
    console.error('Test error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Helper function to identify and decode integer arrays
async function decodeIntegerArrays(data: any): Promise<any> {
  const decoded: any = {};
  
  function processObject(obj: any, path: string = ''): void {
    Object.entries(obj).forEach(([key, value]) => {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (Array.isArray(value) && value.every(v => typeof v === 'number' && Number.isInteger(v))) {
        // This is an integer array - try to decode it
        const analysis = analyzeIntegerArray(key, value);
        decoded[currentPath] = {
          originalValues: value,
          analysis,
          possibleMeaning: analysis.possibleMeanings[0] || 'unknown'
        };
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        processObject(value, currentPath);
      }
    });
  }
  
  processObject(data);
  return decoded;
}

// Analyze integer array to guess its meaning
function analyzeIntegerArray(fieldName: string, values: number[]): any {
  const analysis = {
    fieldName,
    valueCount: values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    possibleMeanings: [] as string[]
  };
  
  // Guess based on field name
  const nameLower = fieldName.toLowerCase();
  if (nameLower.includes('exercise')) {
    analysis.possibleMeanings.push('exercise_ids');
  }
  if (nameLower.includes('tag')) {
    analysis.possibleMeanings.push('tag_ids');
  }
  if (nameLower.includes('user')) {
    analysis.possibleMeanings.push('user_ids');
  }
  if (nameLower.includes('set')) {
    analysis.possibleMeanings.push('set_data');
  }
  
  // Guess based on value ranges
  if (analysis.min >= 10000 && analysis.max < 1000000) {
    analysis.possibleMeanings.push('exercise_ids');
  }
  if (analysis.min >= 1 && analysis.max <= 100) {
    analysis.possibleMeanings.push('reps', 'sets', 'duration_minutes');
  }
  if (analysis.min >= 100 && analysis.max <= 10000) {
    analysis.possibleMeanings.push('weight_lbs', 'duration_seconds', 'distance_meters');
  }
  
  return analysis;
}

// Try to decode exercise IDs by fetching them
async function decodeExerciseIds(exerciseIds: number[], client: TrainerizeClient): Promise<any[]> {
  const decoded = [];
  
  for (const id of exerciseIds) {
    try {
      // Try different exercise endpoints
      const endpoints = [
        '/exercise/get',
        '/v03/exercise/get'
      ];
      
      let exerciseData = null;
      
      for (const endpoint of endpoints) {
        try {
          exerciseData = await client.makeRequest(endpoint, 'POST', { id });
          break;
        } catch {
          continue;
        }
      }
      
      if (exerciseData) {
        decoded.push({
          id,
          name: exerciseData.name || exerciseData.exerciseName || 'Unknown',
          data: exerciseData
        });
      } else {
        decoded.push({
          id,
          name: 'Failed to fetch',
          error: 'Could not retrieve exercise data'
        });
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      decoded.push({
        id,
        name: 'Error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  return decoded;
}