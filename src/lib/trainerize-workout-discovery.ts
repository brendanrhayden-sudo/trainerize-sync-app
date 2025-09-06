import { TrainerizeClient } from './trainerize-client';
import { supabaseAdmin } from './supabase';
import fs from 'fs/promises';
import path from 'path';

interface WorkoutTemplateListParams {
  view?: 'shared' | 'mine' | 'other' | 'all';
  tags?: number[];
  userID?: number;
  sort?: 'name' | 'dateCreated' | 'dateUpdated';
  searchTerm?: string;
  start?: number;
  count?: number;
}

export class WorkoutTemplateDiscovery {
  private client: TrainerizeClient;
  private discoveries: Map<string, any> = new Map();
  
  constructor() {
    this.client = new TrainerizeClient();
  }

  // Main discovery method
  async discoverWorkoutStructure() {
    console.log('🔍 Starting Workout Template Discovery...\n');
    
    // Step 1: Get templates with different views
    const views: Array<'shared' | 'mine' | 'other' | 'all'> = ['all', 'shared', 'mine'];
    const allTemplates: any[] = [];
    
    for (const view of views) {
      console.log(`\n📋 Fetching ${view} templates...`);
      const templates = await this.getWorkoutTemplates({ view, count: 100 });
      allTemplates.push(...templates);
      
      // Save raw response for analysis
      await this.saveDiscovery(`templates_${view}`, templates);
    }
    
    // Step 2: Analyze structure
    const analysis = await this.analyzeTemplateStructure(allTemplates);
    
    // Step 3: Decode integer arrays
    const decodedPatterns = await this.decodeIntegerArrays(allTemplates);
    
    // Step 4: Get individual template details
    const detailedAnalysis = await this.getDetailedTemplates(allTemplates.slice(0, 5));
    
    // Step 5: Save complete analysis
    const fullAnalysis = {
      timestamp: new Date().toISOString(),
      totalTemplates: allTemplates.length,
      structure: analysis,
      integerArrayPatterns: decodedPatterns,
      detailedExamples: detailedAnalysis,
      recommendations: this.generateRecommendations(analysis, decodedPatterns)
    };
    
    await this.saveDiscovery('complete_analysis', fullAnalysis);
    
    return fullAnalysis;
  }

  // Fetch workout templates
  async getWorkoutTemplates(params: WorkoutTemplateListParams): Promise<any[]> {
    try {
      const response = await this.client.makeRequest('/workoutTemplate/getList', 'POST', params);
      
      // Log response structure
      console.log('Response keys:', Object.keys(response));
      
      if (response.templates) {
        console.log(`Found ${response.templates.length} templates`);
        return response.templates;
      } else if (Array.isArray(response)) {
        console.log(`Found ${response.length} templates`);
        return response;
      }
      
      console.log('Unexpected response structure:', JSON.stringify(response, null, 2));
      return [];
    } catch (error) {
      console.error('Error fetching templates:', error);
      return [];
    }
  }

  // Analyze template structure
  async analyzeTemplateStructure(templates: any[]): Promise<any> {
    const analysis = {
      commonFields: new Set<string>(),
      fieldTypes: {} as Record<string, Set<string>>,
      arrayFields: new Set<string>(),
      integerArrayFields: new Set<string>(),
      uniqueValues: {} as Record<string, Set<any>>,
      patterns: {} as Record<string, any>
    };
    
    // Analyze each template
    templates.forEach(template => {
      Object.entries(template).forEach(([key, value]) => {
        // Track common fields
        analysis.commonFields.add(key);
        
        // Track field types
        if (!analysis.fieldTypes[key]) {
          analysis.fieldTypes[key] = new Set();
        }
        analysis.fieldTypes[key].add(typeof value);
        
        // Track arrays
        if (Array.isArray(value)) {
          analysis.arrayFields.add(key);
          
          // Check if it's an integer array
          if (value.every(v => typeof v === 'number' && Number.isInteger(v))) {
            analysis.integerArrayFields.add(key);
            
            // Collect unique values for pattern analysis
            if (!analysis.uniqueValues[key]) {
              analysis.uniqueValues[key] = new Set();
            }
            value.forEach(v => analysis.uniqueValues[key].add(v));
          }
        }
        
        // Track unique values for small sets (potential enums)
        if (typeof value === 'string' || typeof value === 'number') {
          if (!analysis.uniqueValues[key]) {
            analysis.uniqueValues[key] = new Set();
          }
          if (analysis.uniqueValues[key].size < 100) {
            analysis.uniqueValues[key].add(value);
          }
        }
      });
    });
    
    // Convert sets to arrays for JSON serialization
    return {
      commonFields: Array.from(analysis.commonFields),
      fieldTypes: Object.fromEntries(
        Object.entries(analysis.fieldTypes).map(([k, v]) => [k, Array.from(v)])
      ),
      arrayFields: Array.from(analysis.arrayFields),
      integerArrayFields: Array.from(analysis.integerArrayFields),
      uniqueValues: Object.fromEntries(
        Object.entries(analysis.uniqueValues).map(([k, v]) => [k, Array.from(v)])
      )
    };
  }

  // Attempt to decode integer arrays
  async decodeIntegerArrays(templates: any[]): Promise<any> {
    const patterns: Record<string, any> = {};
    
    // Find all integer array fields
    const intArrayFields = new Set<string>();
    templates.forEach(template => {
      Object.entries(template).forEach(([key, value]) => {
        if (Array.isArray(value) && value.every(v => typeof v === 'number')) {
          intArrayFields.add(key);
        }
      });
    });
    
    console.log('\n🔢 Integer array fields found:', Array.from(intArrayFields));
    
    // Analyze each integer array field
    for (const field of intArrayFields) {
      patterns[field] = await this.analyzeIntegerArray(field, templates);
    }
    
    return patterns;
  }

  // Analyze a specific integer array field
  async analyzeIntegerArray(fieldName: string, templates: any[]): Promise<any> {
    const analysis = {
      fieldName,
      possibleMeanings: [] as string[],
      valueRanges: { min: Infinity, max: -Infinity },
      commonPatterns: [] as any[],
      correlations: {} as Record<string, number>
    };
    
    const allValues: number[] = [];
    
    templates.forEach(template => {
      if (template[fieldName] && Array.isArray(template[fieldName])) {
        template[fieldName].forEach((value: number) => {
          allValues.push(value);
          analysis.valueRanges.min = Math.min(analysis.valueRanges.min, value);
          analysis.valueRanges.max = Math.max(analysis.valueRanges.max, value);
        });
      }
    });
    
    // Guess possible meanings based on value ranges
    if (analysis.valueRanges.min >= 10000 && analysis.valueRanges.max < 1000000) {
      analysis.possibleMeanings.push('exercise_ids');
    }
    if (analysis.valueRanges.min >= 1 && analysis.valueRanges.max <= 100) {
      analysis.possibleMeanings.push('reps', 'sets', 'duration_seconds');
    }
    if (analysis.valueRanges.min >= 1 && analysis.valueRanges.max <= 1000) {
      analysis.possibleMeanings.push('weight', 'distance');
    }
    if (fieldName.toLowerCase().includes('tag')) {
      analysis.possibleMeanings.push('tag_ids');
    }
    if (fieldName.toLowerCase().includes('exercise')) {
      analysis.possibleMeanings.push('exercise_ids');
    }
    if (fieldName.toLowerCase().includes('user')) {
      analysis.possibleMeanings.push('user_ids');
    }
    
    // Look for patterns (sequences, multiples, etc.)
    const valueCounts = allValues.reduce((acc, val) => {
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    
    analysis.commonPatterns = Object.entries(valueCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([value, count]) => ({ value: Number(value), occurrences: count }));
    
    return analysis;
  }

  // Get detailed template information
  async getDetailedTemplates(templates: any[]): Promise<any[]> {
    const detailed = [];
    
    for (const template of templates) {
      if (template.id || template.templateId) {
        const id = template.id || template.templateId;
        
        try {
          // Try to get more details about this template
          const detailResponse = await this.client.makeRequest('/workoutTemplate/get', 'POST', { id });
          
          detailed.push({
            summary: template,
            details: detailResponse,
            analysis: this.analyzeWorkoutDetails(detailResponse)
          });
          
          console.log(`✓ Got details for template ${id}`);
        } catch (error) {
          console.log(`✗ Could not get details for template ${id}`);
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return detailed;
  }

  // Analyze workout details
  analyzeWorkoutDetails(workout: any): any {
    const analysis = {
      hasExercises: false,
      exerciseStructure: null as any,
      hasSets: false,
      setStructure: null as any,
      hasInstructions: false,
      customFields: [] as string[]
    };
    
    // Check for exercises
    if (workout.exercises || workout.exerciseList) {
      analysis.hasExercises = true;
      const exercises = workout.exercises || workout.exerciseList;
      
      if (Array.isArray(exercises) && exercises.length > 0) {
        analysis.exerciseStructure = {
          count: exercises.length,
          sampleStructure: exercises[0],
          fields: Object.keys(exercises[0])
        };
      }
    }
    
    // Check for sets
    if (workout.sets || workout.setList) {
      analysis.hasSets = true;
      const sets = workout.sets || workout.setList;
      
      if (Array.isArray(sets) && sets.length > 0) {
        analysis.setStructure = {
          count: sets.length,
          sampleStructure: sets[0],
          fields: Object.keys(sets[0])
        };
      }
    }
    
    // Find custom fields
    const standardFields = ['id', 'name', 'description', 'exercises', 'sets', 'created', 'updated'];
    Object.keys(workout).forEach(key => {
      if (!standardFields.includes(key)) {
        analysis.customFields.push(key);
      }
    });
    
    return analysis;
  }

  // Generate recommendations based on analysis
  generateRecommendations(analysis: any, patterns: any): any {
    const recommendations = {
      dataModel: {},
      mappings: {},
      warnings: [],
      suggestions: []
    };
    
    // Recommend data model based on findings
    if (analysis.integerArrayFields?.includes('exercises')) {
      recommendations.dataModel['exercises'] = 'Array of exercise IDs';
      recommendations.mappings['exercises'] = 'Map to exercise objects by fetching from /exercise/get';
    }
    
    if (analysis.integerArrayFields?.includes('tags')) {
      recommendations.dataModel['tags'] = 'Array of tag IDs';
      recommendations.suggestions.push('Create a tag lookup table by collecting all unique tag values');
    }
    
    // Add warnings for unknown fields
    analysis.integerArrayFields?.forEach((field: string) => {
      if (!patterns[field]?.possibleMeanings?.length) {
        recommendations.warnings.push(`Unknown integer array field: ${field}`);
      }
    });
    
    return recommendations;
  }

  // Save discovery results
  async saveDiscovery(name: string, data: any) {
    // Save to Supabase
    try {
      await supabaseAdmin
        .from('api_discoveries')
        .insert({
          api: 'trainerize',
          endpoint: 'workoutTemplate',
          discovery_name: name,
          data: data,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.log('Could not save to Supabase (table may not exist):', error.message);
    }
    
    // Also save to local file for debugging
    try {
      const dir = path.join(process.cwd(), 'discoveries');
      await fs.mkdir(dir, { recursive: true });
      
      const filename = `${name}_${Date.now()}.json`;
      await fs.writeFile(
        path.join(dir, filename),
        JSON.stringify(data, null, 2)
      );
      
      console.log(`💾 Saved discovery: ${filename}`);
    } catch (error) {
      console.log('Could not save to file system:', error.message);
    }
  }
}