import { NextRequest, NextResponse } from 'next/server';
import { WorkoutTemplateDiscovery } from '@/lib/trainerize-workout-discovery';

export async function POST(request: NextRequest) {
  const discovery = new WorkoutTemplateDiscovery();
  
  try {
    console.log('Starting workout template discovery...');
    
    // Run discovery
    const analysis = await discovery.discoverWorkoutStructure();
    
    // Also try specific investigations
    const investigations = await runSpecificInvestigations();
    
    const fullReport = {
      ...analysis,
      investigations,
      summary: generateSummary(analysis, investigations)
    };
    
    return NextResponse.json({
      success: true,
      report: fullReport
    });
    
  } catch (error: any) {
    console.error('Discovery error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

async function runSpecificInvestigations() {
  const discovery = new WorkoutTemplateDiscovery();
  const investigations: any = {};
  
  // Investigation 1: Check if tags parameter works
  console.log('\n🔍 Investigation 1: Testing tags parameter');
  const withTags = await discovery.getWorkoutTemplates({ tags: [0] });
  const withSpecificTags = await discovery.getWorkoutTemplates({ tags: [1, 2, 3] });
  
  investigations.tags = {
    withZero: withTags.length,
    withSpecific: withSpecificTags.length,
    conclusion: withTags.length > 0 ? 'Tags parameter works' : 'Tags parameter may not be working'
  };
  
  // Investigation 2: Test sorting
  console.log('\n🔍 Investigation 2: Testing sort parameter');
  const sortedByName = await discovery.getWorkoutTemplates({ sort: 'name', count: 5 });
  const sortedByDate = await discovery.getWorkoutTemplates({ sort: 'dateCreated', count: 5 });
  
  investigations.sorting = {
    byName: sortedByName.map((t: any) => t.name || t.title).slice(0, 3),
    byDate: sortedByDate.map((t: any) => t.dateCreated || t.created).slice(0, 3),
    conclusion: 'Check if order changes between sorts'
  };
  
  // Investigation 3: Search functionality
  console.log('\n🔍 Investigation 3: Testing search');
  const searchResults = await discovery.getWorkoutTemplates({ searchTerm: 'chest' });
  
  investigations.search = {
    resultsFound: searchResults.length,
    sampleResults: searchResults.slice(0, 3).map((t: any) => t.name || t.title)
  };
  
  return investigations;
}

function generateSummary(analysis: any, investigations: any) {
  return {
    totalFieldsFound: analysis.structure?.commonFields?.length || 0,
    integerArrayFields: analysis.structure?.integerArrayFields || [],
    likelyMeanings: {
      exercises: 'Probably exercise IDs - fetch with /exercise/get',
      tags: 'Tag IDs for categorization',
      sets: 'Possibly set configurations',
      reps: 'Repetition counts if in range 1-100'
    },
    nextSteps: [
      'Test fetching individual templates with /workoutTemplate/get',
      'Cross-reference exercise IDs with known exercises',
      'Build mapping table for tags',
      'Test creating a workout with known structure'
    ]
  };
}