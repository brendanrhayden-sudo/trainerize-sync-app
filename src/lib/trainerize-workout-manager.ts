import { TrainerizeClient } from './trainerize-client';
import { supabase } from './supabase';

// Complete type definitions based on API docs
export type WorkoutType = 'cardio' | 'workoutRegular' | 'workoutCircuit' | 'workoutTimed' | 'workoutInterval' | 'workoutVideo';
export type WorkoutViewType = 'shared' | 'mine' | 'other' | 'trainingPlan';
export type RecordType = 'general' | 'strength' | 'endurance' | 'timedFasterBetter' | 'timedLongerBetter' | 'timedStrength' | 'cardio' | 'rest';
export type SupersetType = 'superset' | 'circuit' | 'none';
export type ExerciseType = 'system' | 'custom';
export type Side = 'left' | 'right';

export interface ExerciseDefinition {
  id?: number;
  name?: string;
  description?: string;
  sets?: number;
  target?: string;
  targetDetail?: {
    side?: Side;
  };
  supersetID?: number;
  supersetType?: SupersetType;
  intervalTime?: number; // in seconds
  restTime?: number; // in seconds
  recordType?: RecordType;
  type?: ExerciseType;
  vimeoVideo?: string;
  youTubeVideo?: string;
  numPhotos?: number;
}

export interface WorkoutDefinition {
  id?: number;
  name: string;
  exercises: Array<{
    def: ExerciseDefinition;
  }>;
  type?: WorkoutType;
  instructions?: string;
  tags?: Array<{ id: number }>;
  trackingStats?: {
    def?: {
      effortInterval?: boolean;
      restInterval?: boolean;
      minHeartRate?: boolean;
      maxHeartRate?: boolean;
      avgHeartRate?: boolean;
      zone?: boolean;
    };
  };
}

export interface AddWorkoutRequest {
  type: WorkoutViewType;
  userID?: number;
  trainingPlanID?: number;
  workoutDef: WorkoutDefinition;
}

export interface UpdateWorkoutRequest {
  workoutDef: WorkoutDefinition & { id: number };
}

export class TrainerizeWorkoutManager {
  private client: TrainerizeClient;

  constructor() {
    this.client = new TrainerizeClient();
  }

  // Add a new workout definition
  async addWorkout(params: AddWorkoutRequest): Promise<any> {
    try {
      const response = await this.client.makeRequest('/workoutDef/add', 'POST', params);
      
      if (response?.id || response?.workoutId) {
        const workoutId = response.id || response.workoutId;
        
        // Save to Supabase
        await this.saveWorkoutToSupabase(workoutId, params.workoutDef);
        
        console.log(`✓ Added workout: ${params.workoutDef.name} (ID: ${workoutId})`);
        return { success: true, workoutId };
      }
      
      return { success: false, error: 'No ID returned' };
    } catch (error: any) {
      console.error('Error adding workout:', error);
      return { success: false, error: error.message };
    }
  }

  // Update existing workout definition
  async updateWorkout(params: UpdateWorkoutRequest): Promise<any> {
    try {
      const response = await this.client.makeRequest('/workoutDef/set', 'POST', params);
      
      // Update in Supabase
      await this.saveWorkoutToSupabase(params.workoutDef.id, params.workoutDef);
      
      console.log(`✓ Updated workout: ${params.workoutDef.name}`);
      return { success: true, data: response };
    } catch (error: any) {
      console.error('Error updating workout:', error);
      return { success: false, error: error.message };
    }
  }

  // Build workout from Supabase exercise library
  async buildWorkoutFromExercises(
    name: string,
    exerciseIds: string[],
    options: {
      type?: WorkoutType;
      instructions?: string;
      defaultSets?: number;
      defaultRestTime?: number;
      supersets?: Array<{ exerciseIds: string[]; type: SupersetType }>;
    } = {}
  ): Promise<WorkoutDefinition> {
    const {
      type = 'workoutRegular',
      instructions = '',
      defaultSets = 3,
      defaultRestTime = 60,
      supersets = []
    } = options;

    // Fetch exercises from Supabase
    const { data: exercises } = await supabase
      .from('exercises')
      .select('*')
      .in('id', exerciseIds);

    if (!exercises) {
      throw new Error('Failed to fetch exercises');
    }

    // Create superset mapping
    const supersetMap = new Map<string, { id: number; type: SupersetType }>();
    supersets.forEach((superset, index) => {
      superset.exerciseIds.forEach(id => {
        supersetMap.set(id, { id: index + 1, type: superset.type });
      });
    });

    // Build exercise definitions
    const exerciseDefs: Array<{ def: ExerciseDefinition }> = exercises.map(exercise => {
      const supersetInfo = supersetMap.get(exercise.id);
      
      return {
        def: {
          id: exercise.trainerize_id ? parseInt(exercise.trainerize_id) : undefined,
          name: exercise.name,
          description: exercise.description || '',
          sets: exercise.default_sets || defaultSets,
          target: this.buildTargetString(exercise),
          targetDetail: exercise.unilateral ? { side: 'left' } : undefined,
          supersetID: supersetInfo?.id,
          supersetType: supersetInfo?.type || 'none',
          restTime: exercise.rest_time || defaultRestTime,
          recordType: this.mapToRecordType(exercise),
          type: exercise.trainerize_id ? 'system' : 'custom',
          youTubeVideo: this.extractYouTubeId(exercise.video_url)
        }
      };
    });

    return {
      name,
      exercises: exerciseDefs,
      type,
      instructions,
      tags: [],
      trackingStats: {
        def: {
          effortInterval: type === 'workoutInterval',
          restInterval: type === 'workoutInterval',
          avgHeartRate: type === 'cardio'
        }
      }
    };
  }

  // Create workout from template in Supabase
  async createWorkoutFromTemplate(
    templateId: string,
    customizations?: {
      name?: string;
      modifyExercises?: (exercises: any[]) => any[];
    }
  ): Promise<AddWorkoutRequest> {
    // Fetch template from Supabase
    const { data: template } = await supabase
      .from('workout_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (!template) {
      throw new Error('Template not found');
    }

    let exercises = template.exercises || [];
    
    // Apply customizations
    if (customizations?.modifyExercises) {
      exercises = customizations.modifyExercises(exercises);
    }

    // Convert to Trainerize format
    const exerciseDefs = exercises.map((ex: any) => ({
      def: {
        id: ex.exerciseId || ex.trainerize_id,
        name: ex.name,
        description: ex.description,
        sets: ex.sets || 3,
        target: ex.target || `${ex.reps || '10'} reps`,
        restTime: ex.restTime || 60,
        recordType: ex.recordType || 'strength',
        type: ex.type || 'system',
        supersetID: ex.supersetID,
        supersetType: ex.supersetType || 'none'
      }
    }));

    return {
      type: 'mine',
      workoutDef: {
        name: customizations?.name || template.name,
        exercises: exerciseDefs,
        type: template.workout_type || 'workoutRegular',
        instructions: template.instructions || ''
      }
    };
  }

  // Bulk sync workouts from Supabase to Trainerize
  async bulkSyncWorkouts(
    workoutIds: string[],
    options: {
      onProgress?: (current: number, total: number) => void;
      skipExisting?: boolean;
    } = {}
  ): Promise<{
    successful: any[];
    failed: any[];
    skipped: any[];
  }> {
    const results = {
      successful: [] as any[],
      failed: [] as any[],
      skipped: [] as any[]
    };

    // Fetch workouts from Supabase
    const { data: workouts } = await supabase
      .from('workout_templates')
      .select('*')
      .in('id', workoutIds);

    if (!workouts) {
      throw new Error('Failed to fetch workouts');
    }

    for (let i = 0; i < workouts.length; i++) {
      const workout = workouts[i];
      
      if (options.onProgress) {
        options.onProgress(i + 1, workouts.length);
      }

      // Skip if already synced
      if (options.skipExisting && workout.trainerize_id) {
        results.skipped.push(workout);
        continue;
      }

      try {
        // Build workout definition
        const workoutDef = await this.buildWorkoutFromSupabase(workout);
        
        // Add or update in Trainerize
        let result;
        if (workout.trainerize_id) {
          result = await this.updateWorkout({
            workoutDef: {
              ...workoutDef,
              id: parseInt(workout.trainerize_id)
            }
          });
        } else {
          result = await this.addWorkout({
            type: 'mine',
            workoutDef
          });
        }

        if (result.success) {
          results.successful.push({
            ...workout,
            trainerize_id: result.workoutId || workout.trainerize_id
          });

          // Update Supabase with Trainerize ID
          if (result.workoutId && !workout.trainerize_id) {
            await supabase
              .from('workout_templates')
              .update({ 
                trainerize_id: result.workoutId.toString(),
                synced_at: new Date().toISOString()
              })
              .eq('id', workout.id);
          }
        } else {
          results.failed.push({ ...workout, error: result.error });
        }
      } catch (error: any) {
        results.failed.push({ ...workout, error: error.message });
      }

      // Rate limiting
      if ((i + 1) % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  // Extract workouts from Trainerize to Supabase
  async extractAndSaveWorkouts(
    params: {
      view?: WorkoutViewType;
      count?: number;
    } = {}
  ): Promise<number> {
    const { view = 'mine', count = 100 } = params;
    
    // Get workout templates
    const templates = await this.client.makeRequest('/workoutTemplate/getList', 'POST', {
      view,
      count,
      start: 0
    });

    const workoutIds = this.extractWorkoutIds(templates);
    
    // Get definitions for each workout
    const definitions = [];
    for (const id of workoutIds) {
      try {
        const def = await this.client.makeRequest('/workoutTemplate/get', 'POST', { id });
        definitions.push({ id, ...def });
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`Failed to get workout ${id}:`, error);
      }
    }
    
    // Save each workout to Supabase
    let savedCount = 0;
    for (const def of definitions) {
      try {
        await this.saveWorkoutToSupabase(def.id, def);
        savedCount++;
      } catch (error) {
        console.error(`Failed to save workout ${def.id}:`, error);
      }
    }

    return savedCount;
  }

  // Helper: Save workout to Supabase
  private async saveWorkoutToSupabase(workoutId: number, definition: WorkoutDefinition) {
    const exerciseCount = definition.exercises?.length || 0;
    const totalSets = definition.exercises?.reduce(
      (sum, ex) => sum + (ex.def.sets || 0), 0
    ) || 0;

    await supabase
      .from('workout_templates')
      .upsert({
        trainerize_id: workoutId.toString(),
        name: definition.name,
        workout_type: definition.type,
        instructions: definition.instructions,
        exercises: definition.exercises,
        exercise_count: exerciseCount,
        total_sets: totalSets,
        tags: definition.tags,
        tracking_stats: definition.trackingStats,
        metadata: definition,
        synced_at: new Date().toISOString()
      });
  }

  // Helper: Build workout from Supabase format
  private async buildWorkoutFromSupabase(workout: any): Promise<WorkoutDefinition> {
    const exercises = workout.exercises || [];
    
    return {
      name: workout.name,
      exercises: exercises.map((ex: any) => ({
        def: {
          id: ex.exerciseId || (ex.trainerize_id ? parseInt(ex.trainerize_id) : undefined),
          name: ex.name || ex.exerciseName,
          description: ex.description,
          sets: ex.sets || 3,
          target: ex.target || this.buildDefaultTarget(ex),
          targetDetail: ex.targetDetail,
          supersetID: ex.supersetID,
          supersetType: ex.supersetType || 'none',
          intervalTime: ex.intervalTime,
          restTime: ex.restTime || 60,
          recordType: ex.recordType || 'strength',
          type: ex.type || 'system',
          vimeoVideo: ex.vimeoVideo,
          youTubeVideo: ex.youTubeVideo,
          numPhotos: ex.numPhotos
        }
      })),
      type: workout.workout_type || 'workoutRegular',
      instructions: workout.instructions || '',
      tags: workout.tags || [],
      trackingStats: workout.tracking_stats || {}
    };
  }

  // Helper: Build target string
  private buildTargetString(exercise: any): string {
    if (exercise.target) return exercise.target;
    
    if (exercise.reps && exercise.sets) {
      return `${exercise.sets} x ${exercise.reps} reps`;
    } else if (exercise.duration) {
      return `${exercise.duration} seconds`;
    } else if (exercise.distance) {
      return `${exercise.distance} ${exercise.distance_unit || 'm'}`;
    }
    
    return '10 reps';
  }

  // Helper: Build default target
  private buildDefaultTarget(exercise: any): string {
    if (exercise.reps) return `${exercise.reps} reps`;
    if (exercise.duration) return `${exercise.duration} seconds`;
    if (exercise.distance) return `${exercise.distance}m`;
    return '10 reps';
  }

  // Helper: Map to record type
  private mapToRecordType(exercise: any): RecordType {
    if (exercise.record_type) return exercise.record_type;
    if (exercise.category === 'cardio') return 'cardio';
    if (exercise.category === 'strength') return 'strength';
    if (exercise.is_timed) return 'timedLongerBetter';
    return 'general';
  }

  // Helper: Extract workout IDs
  private extractWorkoutIds(data: any): number[] {
    const ids = new Set<number>();
    
    const extract = (obj: any) => {
      if (Array.isArray(obj)) {
        obj.forEach(item => extract(item));
      } else if (obj && typeof obj === 'object') {
        if (obj.id) ids.add(parseInt(obj.id));
        if (obj.workoutId) ids.add(parseInt(obj.workoutId));
        if (obj.templateId) ids.add(parseInt(obj.templateId));
        Object.values(obj).forEach(val => extract(val));
      }
    };
    
    extract(data);
    return Array.from(ids);
  }

  // Helper: Extract YouTube ID
  private extractYouTubeId(url?: string): string | undefined {
    if (!url) return undefined;
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
    return match ? match[1] : undefined;
  }
}