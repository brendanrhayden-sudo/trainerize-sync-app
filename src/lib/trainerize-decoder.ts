import { TrainerizeClient } from './trainerize-client';

export interface DecodedValue {
  id: number;
  name: string;
  type: 'exercise' | 'user' | 'tag' | 'unknown';
  data?: any;
  error?: string;
}

export interface DecodingResult {
  field: string;
  originalValues: number[];
  decodedValues: DecodedValue[];
  confidence: 'high' | 'medium' | 'low';
  possibleMeanings: string[];
  suggestions: string[];
}

export class TrainerizeDecoder {
  private client: TrainerizeClient;
  private exerciseCache = new Map<number, any>();
  private tagCache = new Map<number, any>();
  private userCache = new Map<number, any>();
  
  constructor() {
    this.client = new TrainerizeClient();
  }

  /**
   * Main decoding function - takes any Trainerize response and decodes integer arrays
   */
  async decodeResponse(response: any, options?: {
    maxItemsPerArray?: number;
    skipLargeArrays?: boolean;
    cacheResults?: boolean;
  }): Promise<any> {
    const opts = {
      maxItemsPerArray: 10,
      skipLargeArrays: true,
      cacheResults: true,
      ...options
    };

    const decoded = JSON.parse(JSON.stringify(response)); // Deep clone
    const decodingResults: DecodingResult[] = [];

    await this.processObjectRecursively(decoded, '', decodingResults, opts);

    return {
      decodedResponse: decoded,
      decodingResults,
      summary: this.generateDecodingSummary(decodingResults)
    };
  }

  /**
   * Decode a specific integer array with field context
   */
  async decodeIntegerArray(
    fieldName: string, 
    values: number[], 
    options?: { maxItems?: number }
  ): Promise<DecodingResult> {
    const maxItems = options?.maxItems || 10;
    const valuesToTest = values.slice(0, maxItems);
    
    const analysis = this.analyzeIntegerArray(fieldName, values);
    const decodedValues: DecodedValue[] = [];

    // Try different decoding strategies based on analysis
    for (const meaning of analysis.possibleMeanings) {
      if (meaning === 'exercise_ids') {
        const exerciseResults = await this.decodeAsExercises(valuesToTest);
        if (exerciseResults.some(r => r.name !== 'Failed to fetch')) {
          decodedValues.push(...exerciseResults);
          break;
        }
      } else if (meaning === 'tag_ids') {
        const tagResults = await this.decodeAsTags(valuesToTest);
        if (tagResults.some(r => r.name !== 'Failed to fetch')) {
          decodedValues.push(...tagResults);
          break;
        }
      } else if (meaning === 'user_ids') {
        const userResults = await this.decodeAsUsers(valuesToTest);
        if (userResults.some(r => r.name !== 'Failed to fetch')) {
          decodedValues.push(...userResults);
          break;
        }
      }
    }

    // If no successful decoding, mark as unknown
    if (decodedValues.length === 0) {
      decodedValues.push(...valuesToTest.map(id => ({
        id,
        name: 'Unknown',
        type: 'unknown' as const,
        error: 'Could not determine type'
      })));
    }

    return {
      field: fieldName,
      originalValues: values,
      decodedValues,
      confidence: this.calculateConfidence(analysis, decodedValues),
      possibleMeanings: analysis.possibleMeanings,
      suggestions: this.generateSuggestions(fieldName, analysis, decodedValues)
    };
  }

  private async processObjectRecursively(
    obj: any, 
    path: string, 
    results: DecodingResult[], 
    options: any
  ): Promise<void> {
    if (typeof obj !== 'object' || obj === null) return;

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (Array.isArray(value) && this.isIntegerArray(value)) {
        // Skip large arrays if requested
        if (options.skipLargeArrays && value.length > 50) {
          continue;
        }

        const result = await this.decodeIntegerArray(key, value, { 
          maxItems: options.maxItemsPerArray 
        });
        
        results.push(result);

        // Replace the array with decoded version if high confidence
        if (result.confidence === 'high') {
          obj[key] = result.decodedValues.map(dv => ({
            originalId: dv.id,
            name: dv.name,
            type: dv.type,
            ...(dv.data && { data: dv.data })
          }));
        }
      } else if (typeof value === 'object' && value !== null) {
        await this.processObjectRecursively(value, currentPath, results, options);
      }
    }
  }

  private isIntegerArray(arr: any[]): boolean {
    return arr.length > 0 && arr.every(v => typeof v === 'number' && Number.isInteger(v));
  }

  private analyzeIntegerArray(fieldName: string, values: number[]): {
    possibleMeanings: string[];
    valueStats: { min: number; max: number; count: number };
  } {
    const analysis = {
      possibleMeanings: [] as string[],
      valueStats: {
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length
      }
    };

    // Analyze field name
    const nameLower = fieldName.toLowerCase();
    const namePatterns = [
      { pattern: /exercise/i, meaning: 'exercise_ids' },
      { pattern: /tag/i, meaning: 'tag_ids' },
      { pattern: /user/i, meaning: 'user_ids' },
      { pattern: /client/i, meaning: 'user_ids' },
      { pattern: /set/i, meaning: 'set_data' },
      { pattern: /rep/i, meaning: 'rep_data' },
      { pattern: /weight/i, meaning: 'weight_data' },
      { pattern: /duration/i, meaning: 'duration_data' }
    ];

    namePatterns.forEach(({ pattern, meaning }) => {
      if (pattern.test(nameLower)) {
        analysis.possibleMeanings.push(meaning);
      }
    });

    // Analyze value ranges
    const { min, max } = analysis.valueStats;
    
    if (min >= 10000 && max < 1000000) {
      analysis.possibleMeanings.push('exercise_ids');
    }
    if (min >= 1000 && max < 10000) {
      analysis.possibleMeanings.push('user_ids', 'tag_ids');
    }
    if (min >= 1 && max <= 100) {
      analysis.possibleMeanings.push('reps', 'sets', 'duration_minutes');
    }
    if (min >= 100 && max <= 10000) {
      analysis.possibleMeanings.push('weight_lbs', 'duration_seconds');
    }

    // Remove duplicates
    analysis.possibleMeanings = [...new Set(analysis.possibleMeanings)];

    return analysis;
  }

  private async decodeAsExercises(ids: number[]): Promise<DecodedValue[]> {
    const results: DecodedValue[] = [];

    for (const id of ids) {
      if (this.exerciseCache.has(id)) {
        const cached = this.exerciseCache.get(id);
        results.push({
          id,
          name: cached.name || 'Unknown Exercise',
          type: 'exercise',
          data: cached
        });
        continue;
      }

      try {
        const endpoints = ['/v03/exercise/get', '/exercise/get'];
        let exerciseData = null;

        for (const endpoint of endpoints) {
          try {
            exerciseData = await this.client.makeRequest(endpoint, 'POST', { id });
            break;
          } catch (e) {
            continue;
          }
        }

        if (exerciseData && (exerciseData.name || exerciseData.exerciseName)) {
          const name = exerciseData.name || exerciseData.exerciseName || 'Unknown Exercise';
          this.exerciseCache.set(id, exerciseData);
          results.push({
            id,
            name,
            type: 'exercise',
            data: exerciseData
          });
        } else {
          results.push({
            id,
            name: 'Failed to fetch',
            type: 'exercise',
            error: 'Exercise not found or inaccessible'
          });
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error) {
        results.push({
          id,
          name: 'Error',
          type: 'exercise',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  private async decodeAsTags(ids: number[]): Promise<DecodedValue[]> {
    const results: DecodedValue[] = [];

    // Tags are harder to decode without a direct endpoint
    // We might need to infer from other API calls
    for (const id of ids) {
      if (this.tagCache.has(id)) {
        const cached = this.tagCache.get(id);
        results.push({
          id,
          name: cached.name || `Tag ${id}`,
          type: 'tag',
          data: cached
        });
        continue;
      }

      // For now, we'll just mark them as tags with ID
      results.push({
        id,
        name: `Tag ${id}`,
        type: 'tag',
        error: 'Tag lookup not implemented'
      });
    }

    return results;
  }

  private async decodeAsUsers(ids: number[]): Promise<DecodedValue[]> {
    const results: DecodedValue[] = [];

    for (const id of ids) {
      if (this.userCache.has(id)) {
        const cached = this.userCache.get(id);
        results.push({
          id,
          name: cached.name || `User ${id}`,
          type: 'user',
          data: cached
        });
        continue;
      }

      try {
        // Try user endpoints (these might not work due to permissions)
        const endpoints = ['/user/get', '/client/get'];
        let userData = null;

        for (const endpoint of endpoints) {
          try {
            userData = await this.client.makeRequest(endpoint, 'POST', { id });
            break;
          } catch (e) {
            continue;
          }
        }

        if (userData && (userData.name || userData.firstName)) {
          const name = userData.name || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || `User ${id}`;
          this.userCache.set(id, userData);
          results.push({
            id,
            name,
            type: 'user',
            data: userData
          });
        } else {
          results.push({
            id,
            name: `User ${id}`,
            type: 'user',
            error: 'User data not accessible'
          });
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error) {
        results.push({
          id,
          name: `User ${id}`,
          type: 'user',
          error: 'Permission denied or user not found'
        });
      }
    }

    return results;
  }

  private calculateConfidence(
    analysis: any, 
    decodedValues: DecodedValue[]
  ): 'high' | 'medium' | 'low' {
    const successfulDecodes = decodedValues.filter(dv => !dv.error).length;
    const successRate = successfulDecodes / decodedValues.length;

    if (successRate >= 0.8 && analysis.possibleMeanings.length > 0) {
      return 'high';
    } else if (successRate >= 0.5 || analysis.possibleMeanings.length > 0) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private generateSuggestions(
    fieldName: string, 
    analysis: any, 
    decodedValues: DecodedValue[]
  ): string[] {
    const suggestions: string[] = [];

    if (decodedValues.some(dv => dv.type === 'exercise')) {
      suggestions.push('This appears to be exercise IDs - use /v03/exercise/get to fetch details');
    }

    if (decodedValues.some(dv => dv.type === 'tag')) {
      suggestions.push('Build a tag lookup table by collecting all unique tag values from various endpoints');
    }

    if (decodedValues.some(dv => dv.type === 'user')) {
      suggestions.push('User IDs detected - may require special permissions to access user data');
    }

    if (analysis.possibleMeanings.includes('set_data')) {
      suggestions.push('This might be workout set configuration - check for patterns in the numbers');
    }

    if (decodedValues.every(dv => dv.error)) {
      suggestions.push('Unable to decode - try cross-referencing with other API responses');
      suggestions.push('Check if these are internal system IDs not exposed via API');
    }

    return suggestions;
  }

  private generateDecodingSummary(results: DecodingResult[]): any {
    const summary = {
      totalFieldsDecoded: results.length,
      highConfidenceFields: results.filter(r => r.confidence === 'high').length,
      mediumConfidenceFields: results.filter(r => r.confidence === 'medium').length,
      lowConfidenceFields: results.filter(r => r.confidence === 'low').length,
      identifiedTypes: {} as Record<string, number>,
      recommendations: [] as string[]
    };

    // Count identified types
    results.forEach(result => {
      result.decodedValues.forEach(dv => {
        summary.identifiedTypes[dv.type] = (summary.identifiedTypes[dv.type] || 0) + 1;
      });
    });

    // Generate recommendations
    if (summary.identifiedTypes.exercise > 0) {
      summary.recommendations.push('Exercise IDs found - integrate with exercise management system');
    }
    if (summary.identifiedTypes.tag > 0) {
      summary.recommendations.push('Tag IDs found - create tag lookup functionality');
    }
    if (summary.identifiedTypes.user > 0) {
      summary.recommendations.push('User IDs found - may need elevated permissions');
    }
    if (summary.lowConfidenceFields > summary.highConfidenceFields) {
      summary.recommendations.push('Many fields have low confidence - manual verification recommended');
    }

    return summary;
  }

  /**
   * Utility method to decode a single field quickly
   */
  async quickDecode(fieldName: string, values: number[]): Promise<string> {
    if (values.length === 0) return 'Empty array';
    
    const analysis = this.analyzeIntegerArray(fieldName, values);
    
    if (analysis.possibleMeanings.length === 0) {
      return `Unknown integer array (${values.length} values, range: ${analysis.valueStats.min}-${analysis.valueStats.max})`;
    }
    
    return `Likely ${analysis.possibleMeanings[0]} (${values.length} values)`;
  }
}