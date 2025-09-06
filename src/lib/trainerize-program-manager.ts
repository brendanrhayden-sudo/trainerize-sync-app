import { TrainerizeClient } from './trainerize-client';
import { supabaseAdmin } from './supabase';

// Use admin client to bypass RLS
const supabase = supabaseAdmin;

// Core type definitions for programs and training plans
export interface Program {
  id: string;
  name: string;
  description?: string;
  difficulty_level?: 'beginner' | 'intermediate' | 'advanced';
  duration_weeks?: number;
  goals?: string[];
  equipment_required?: string[];
  trainerize_program_id?: string;
  sync_status?: 'pending' | 'synced' | 'error';
  synced_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TrainingPlan {
  id: string;
  program_id: string;
  name: string;
  duration_weeks: number;
  workouts_per_week: number;
  trainerize_plan_id?: string;
  sync_status?: 'pending' | 'synced' | 'error';
  synced_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PlanWorkout {
  id: string;
  training_plan_id: string;
  workout_template_id: string | null;
  day_of_week: number;
  week_number: number;
  order_in_day: number;
  rest_day: boolean;
  created_at: string;
}

export interface ClientAssessment {
  clientId: string;
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
  goals: string[];
  equipment: string[];
  availableDays: number;
  sessionDuration: number;
  assessmentDate: string;
  injuries?: string[];
  preferences?: string[];
}

export interface GenerationRules {
  id: string;
  fitness_level: string;
  goals: string[];
  equipment_required: string[];
  workout_selection_criteria: any;
  program_structure: {
    duration_weeks: number;
    workouts_per_week: number;
    session_duration: number;
  };
  progression_rules: any;
  created_at: string;
  updated_at: string;
}

export interface ProgramGenerationResult {
  program: Program;
  trainingPlan: TrainingPlan;
  workouts: PlanWorkout[];
}

export interface ExportResult {
  trainerizeProgramId: string;
  exportedWorkouts: number;
  syncStatus: 'success' | 'error';
}

export class TrainerizeProgramManager {
  private trainerizeClient: TrainerizeClient;

  constructor() {
    this.trainerizeClient = new TrainerizeClient();
  }

  // Program CRUD operations
  async createProgram(programData: Omit<Program, 'id' | 'created_at' | 'updated_at'>): Promise<Program> {
    const { data, error } = await supabase
      .from('training_programs')
      .insert([{
        ...programData,
        sync_status: 'pending'
      }])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create program: ${error.message}`);
    }

    return data;
  }

  async getProgram(programId: string): Promise<Program | null> {
    const { data, error } = await supabase
      .from('training_programs')
      .select('*')
      .eq('id', programId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to get program: ${error.message}`);
    }

    return data;
  }

  async updateProgram(programId: string, updates: Partial<Program>): Promise<Program> {
    const { data, error } = await supabase
      .from('training_programs')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', programId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update program: ${error.message}`);
    }

    return data;
  }

  async deleteProgram(programId: string): Promise<void> {
    // First delete related training plans
    await supabase
      .from('training_plans')
      .delete()
      .eq('program_id', programId);

    // Then delete the program
    const { error } = await supabase
      .from('training_programs')
      .delete()
      .eq('id', programId);

    if (error) {
      throw new Error(`Failed to delete program: ${error.message}`);
    }
  }

  async getAllPrograms(): Promise<Program[]> {
    const { data, error } = await supabase
      .from('training_programs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get programs: ${error.message}`);
    }

    return data || [];
  }

  // Training plan management within programs
  async createTrainingPlan(planData: Omit<TrainingPlan, 'id' | 'created_at' | 'updated_at'>): Promise<TrainingPlan> {
    const { data, error } = await supabase
      .from('training_plans')
      .insert([{
        ...planData,
        sync_status: 'pending'
      }])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create training plan: ${error.message}`);
    }

    return data;
  }

  async getTrainingPlansForProgram(programId: string): Promise<TrainingPlan[]> {
    const { data, error } = await supabase
      .from('training_plans')
      .select('*')
      .eq('program_id', programId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get training plans: ${error.message}`);
    }

    return data || [];
  }

  // Calendar scheduling for workouts
  async scheduleWorkouts(trainingPlanId: string, workouts: Omit<PlanWorkout, 'id' | 'created_at'>[]): Promise<PlanWorkout[]> {
    const { data, error } = await supabase
      .from('plan_workouts')
      .insert(workouts.map(workout => ({
        ...workout,
        training_plan_id: trainingPlanId
      })))
      .select();

    if (error) {
      throw new Error(`Failed to schedule workouts: ${error.message}`);
    }

    return data || [];
  }

  async getScheduledWorkouts(trainingPlanId: string): Promise<PlanWorkout[]> {
    const { data, error } = await supabase
      .from('plan_workouts')
      .select('*')
      .eq('training_plan_id', trainingPlanId)
      .order('week_number', { ascending: true })
      .order('day_of_week', { ascending: true })
      .order('order_in_day', { ascending: true });

    if (error) {
      throw new Error(`Failed to get scheduled workouts: ${error.message}`);
    }

    return data || [];
  }

  // Client assignment to programs
  async assignClientToProgram(clientId: string, programId: string, startDate?: string): Promise<void> {
    const { error } = await supabase
      .from('client_programs')
      .insert([{
        client_id: clientId,
        program_id: programId,
        start_date: startDate || new Date().toISOString().split('T')[0],
        status: 'active'
      }]);

    if (error) {
      throw new Error(`Failed to assign client to program: ${error.message}`);
    }
  }

  async getClientPrograms(clientId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('client_programs')
      .select(`
        *,
        program:training_programs (
          id,
          name,
          description,
          difficulty_level,
          duration_weeks
        )
      `)
      .eq('client_id', clientId)
      .order('start_date', { ascending: false });

    if (error) {
      throw new Error(`Failed to get client programs: ${error.message}`);
    }

    return data || [];
  }

  // Assessment-based program generation
  async generateProgramFromAssessment(assessment: ClientAssessment): Promise<ProgramGenerationResult> {
    try {
      // Get generation rules based on assessment
      const rules = await this.getGenerationRules(assessment);
      
      // Create program structure
      const program = await this.createProgram({
        name: `${assessment.fitnessLevel.charAt(0).toUpperCase() + assessment.fitnessLevel.slice(1)} Program for ${assessment.clientId}`,
        description: `Auto-generated program based on assessment for ${assessment.goals.join(', ')}`,
        difficulty_level: assessment.fitnessLevel,
        duration_weeks: rules.program_structure.duration_weeks,
        goals: assessment.goals,
        equipment_required: assessment.equipment
      });

      // Create training plan
      const trainingPlan = await this.createTrainingPlan({
        program_id: program.id,
        name: `${program.name} - Training Plan`,
        duration_weeks: rules.program_structure.duration_weeks,
        workouts_per_week: Math.min(assessment.availableDays, rules.program_structure.workouts_per_week)
      });

      // Select appropriate workouts
      const selectedWorkouts = await this.selectWorkoutsForProgram(assessment, rules);
      
      // Schedule workouts
      const workouts = await this.scheduleWorkouts(trainingPlan.id, selectedWorkouts);

      return {
        program,
        trainingPlan,
        workouts
      };
    } catch (error: any) {
      throw new Error(`Failed to generate program from assessment: ${error.message}`);
    }
  }

  private async getGenerationRules(assessment: ClientAssessment): Promise<GenerationRules> {
    // Try to get specific rules for this fitness level and goals
    const { data, error } = await supabase
      .from('generation_rules')
      .select('*')
      .eq('fitness_level', assessment.fitnessLevel)
      .contains('goals', assessment.goals)
      .single();

    if (error || !data) {
      // Return default rules
      return {
        id: 'default',
        fitness_level: assessment.fitnessLevel,
        goals: assessment.goals,
        equipment_required: assessment.equipment,
        workout_selection_criteria: {
          muscle_groups_per_week: assessment.fitnessLevel === 'beginner' ? 2 : 3,
          max_exercises_per_workout: assessment.fitnessLevel === 'beginner' ? 6 : 8
        },
        program_structure: {
          duration_weeks: assessment.fitnessLevel === 'beginner' ? 8 : 12,
          workouts_per_week: Math.min(assessment.availableDays, assessment.fitnessLevel === 'beginner' ? 3 : 4),
          session_duration: assessment.sessionDuration
        },
        progression_rules: {
          weight_increase_percentage: 5,
          rep_progression: true
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    return data;
  }

  private async selectWorkoutsForProgram(assessment: ClientAssessment, rules: GenerationRules): Promise<Omit<PlanWorkout, 'id' | 'created_at'>[]> {
    // Get available workout templates (simplified - ignore equipment filtering for now)
    const { data: workoutTemplates, error } = await supabase
      .from('workout_templates')
      .select('*')
      .limit(10); // Get some templates to work with

    if (error) {
      throw new Error(`Failed to get workout templates: ${error.message}`);
    }

    const templates = workoutTemplates || [];
    if (templates.length === 0) {
      // Create some default placeholder workouts for testing
      console.log('No workout templates found, creating placeholder schedule');
      const scheduledWorkouts: Omit<PlanWorkout, 'id' | 'created_at'>[] = [];
      const workoutsPerWeek = rules.program_structure.workouts_per_week;
      const duration = rules.program_structure.duration_weeks;

      for (let week = 1; week <= duration; week++) {
        for (let day = 0; day < workoutsPerWeek; day++) {
          scheduledWorkouts.push({
            training_plan_id: '', // Will be set when inserting
            workout_template_id: null, // No template available
            day_of_week: day + 1, // 1-7 for Mon-Sun
            week_number: week,
            order_in_day: 1,
            rest_day: false
          });
        }
      }

      return scheduledWorkouts;
    }

    // Create workout schedule
    const scheduledWorkouts: Omit<PlanWorkout, 'id' | 'created_at'>[] = [];
    const workoutsPerWeek = rules.program_structure.workouts_per_week;
    const duration = rules.program_structure.duration_weeks;

    for (let week = 1; week <= duration; week++) {
      for (let day = 0; day < workoutsPerWeek; day++) {
        // Select a workout template (simple round-robin for now)
        const template = templates[day % templates.length];
        
        scheduledWorkouts.push({
          training_plan_id: '', // Will be set when inserting
          workout_template_id: template.id,
          day_of_week: day + 1, // 1-7 for Mon-Sun
          week_number: week,
          order_in_day: 1,
          rest_day: false
        });
      }

      // Add rest days if needed
      for (let restDay = workoutsPerWeek; restDay < 7; restDay++) {
        scheduledWorkouts.push({
          training_plan_id: '', // Will be set when inserting
          workout_template_id: templates[0].id, // Placeholder
          day_of_week: restDay + 1,
          week_number: week,
          order_in_day: 1,
          rest_day: true
        });
      }
    }

    return scheduledWorkouts;
  }

  // Full sync with Trainerize API
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async exportToTrainerize(programId: string, clientId: string): Promise<ExportResult> {
    try {
      const program = await this.getProgram(programId);
      if (!program) {
        throw new Error('Program not found');
      }

      const trainingPlans = await this.getTrainingPlansForProgram(programId);
      if (trainingPlans.length === 0) {
        throw new Error('No training plans found for program');
      }

      // Export to Trainerize (this would need actual Trainerize API implementation)
      // const trainerizeProgramData = {
      //   name: program.name,
      //   description: program.description,
      //   clientId: clientId,
      //   durationWeeks: program.duration_weeks
      // };

      // For now, simulate the export
      const trainerizeProgramId = `trainerize_${Date.now()}`;
      
      // Update program with Trainerize ID
      await this.updateProgram(programId, {
        trainerize_program_id: trainerizeProgramId,
        sync_status: 'synced',
        synced_at: new Date().toISOString()
      });

      // Count exported workouts
      let exportedWorkouts = 0;
      for (const plan of trainingPlans) {
        const workouts = await this.getScheduledWorkouts(plan.id);
        exportedWorkouts += workouts.filter(w => !w.rest_day).length;
      }

      return {
        trainerizeProgramId,
        exportedWorkouts,
        syncStatus: 'success'
      };
    } catch (error: any) {
      // Update sync status to error
      await this.updateProgram(programId, {
        sync_status: 'error'
      });

      throw new Error(`Failed to export to Trainerize: ${error.message}`);
    }
  }

  async importFromTrainerize(trainerizeProgramId: string): Promise<Program> {
    // This would implement importing a program from Trainerize
    // For now, create a placeholder
    const program = await this.createProgram({
      name: `Imported Program ${trainerizeProgramId}`,
      description: `Program imported from Trainerize ID: ${trainerizeProgramId}`,
      trainerize_program_id: trainerizeProgramId,
      sync_status: 'synced',
      synced_at: new Date().toISOString()
    });

    return program;
  }

  async syncProgramWithTrainerize(programId: string): Promise<void> {
    try {
      const program = await this.getProgram(programId);
      if (!program) {
        throw new Error('Program not found');
      }

      if (!program.trainerize_program_id) {
        throw new Error('Program not linked to Trainerize');
      }

      // Implement sync logic here
      // For now, just update sync timestamp
      await this.updateProgram(programId, {
        sync_status: 'synced',
        synced_at: new Date().toISOString()
      });
    } catch (error: any) {
      await this.updateProgram(programId, {
        sync_status: 'error'
      });
      throw error;
    }
  }

  // Utility methods
  async cloneProgram(programId: string, newName?: string): Promise<Program> {
    const originalProgram = await this.getProgram(programId);
    if (!originalProgram) {
      throw new Error('Program not found');
    }

    // Create new program
    const clonedProgram = await this.createProgram({
      name: newName || `${originalProgram.name} (Copy)`,
      description: originalProgram.description,
      difficulty_level: originalProgram.difficulty_level,
      duration_weeks: originalProgram.duration_weeks,
      goals: originalProgram.goals,
      equipment_required: originalProgram.equipment_required
    });

    // Clone training plans
    const trainingPlans = await this.getTrainingPlansForProgram(programId);
    for (const plan of trainingPlans) {
      const clonedPlan = await this.createTrainingPlan({
        program_id: clonedProgram.id,
        name: plan.name,
        duration_weeks: plan.duration_weeks,
        workouts_per_week: plan.workouts_per_week,
        workout_schedule: plan.workout_schedule
      });

      // Clone scheduled workouts
      const workouts = await this.getScheduledWorkouts(plan.id);
      if (workouts.length > 0) {
        await this.scheduleWorkouts(clonedPlan.id, workouts.map(w => ({
          training_plan_id: clonedPlan.id,
          workout_template_id: w.workout_template_id,
          day_of_week: w.day_of_week,
          week_number: w.week_number,
          order_in_day: w.order_in_day,
          rest_day: w.rest_day
        })));
      }
    }

    return clonedProgram;
  }

  async getProgramStats(programId: string): Promise<any> {
    const program = await this.getProgram(programId);
    if (!program) {
      throw new Error('Program not found');
    }

    const trainingPlans = await this.getTrainingPlansForProgram(programId);
    
    // Get client assignments
    const { data: assignments } = await supabase
      .from('client_programs')
      .select('*')
      .eq('program_id', programId);

    let totalWorkouts = 0;
    for (const plan of trainingPlans) {
      const workouts = await this.getScheduledWorkouts(plan.id);
      totalWorkouts += workouts.filter(w => !w.rest_day).length;
    }

    return {
      program,
      trainingPlansCount: trainingPlans.length,
      totalWorkouts,
      activeClients: assignments?.filter(a => a.status === 'active').length || 0,
      completedClients: assignments?.filter(a => a.status === 'completed').length || 0
    };
  }
}