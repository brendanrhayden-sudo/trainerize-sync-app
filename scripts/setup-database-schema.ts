#!/usr/bin/env tsx

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Database setup script for program management system
class DatabaseSetup {
  
  async checkCurrentTables() {
    console.log('🔍 Checking current database schema...\n');
    
    const { data: tables, error } = await supabase
      .rpc('exec', {
        sql: `
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public'
          ORDER BY table_name;
        `
      });

    if (error) {
      console.error('❌ Error checking tables:', error.message);
      console.log('📋 Proceeding with table creation...\n');
      return [];
    }

    console.log('📋 Current tables:');
    const tableNames = tables?.map((t: any) => t.table_name) || [];
    tableNames.forEach((name: string) => console.log(`   • ${name}`));
    console.log('');
    
    return tableNames;
  }

  async createTrainingProgramsTable() {
    console.log('📋 Creating training_programs table...');
    
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS training_programs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          description TEXT,
          difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
          duration_weeks INTEGER DEFAULT 12,
          goals TEXT[] DEFAULT '{}',
          equipment_required TEXT[] DEFAULT '{}',
          trainerize_program_id TEXT,
          sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'error')),
          synced_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Add indexes
        CREATE INDEX IF NOT EXISTS idx_training_programs_sync_status ON training_programs(sync_status);
        CREATE INDEX IF NOT EXISTS idx_training_programs_difficulty ON training_programs(difficulty_level);
        CREATE INDEX IF NOT EXISTS idx_training_programs_trainerize_id ON training_programs(trainerize_program_id);

        -- Add updated_at trigger
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ language 'plpgsql';

        DROP TRIGGER IF EXISTS update_training_programs_updated_at ON training_programs;
        CREATE TRIGGER update_training_programs_updated_at 
          BEFORE UPDATE ON training_programs 
          FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
      `
    });

    if (error) {
      console.error('❌ Error creating training_programs table:', error.message);
      throw error;
    }
    console.log('✅ training_programs table created successfully');
  }

  async createTrainingPlansTable() {
    console.log('📋 Creating training_plans table...');
    
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS training_plans (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          program_id UUID NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          duration_weeks INTEGER NOT NULL DEFAULT 12,
          workouts_per_week INTEGER NOT NULL DEFAULT 3,
          trainerize_plan_id TEXT,
          sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'error')),
          synced_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Add indexes
        CREATE INDEX IF NOT EXISTS idx_training_plans_program_id ON training_plans(program_id);
        CREATE INDEX IF NOT EXISTS idx_training_plans_sync_status ON training_plans(sync_status);
        CREATE INDEX IF NOT EXISTS idx_training_plans_trainerize_id ON training_plans(trainerize_plan_id);

        -- Add updated_at trigger
        DROP TRIGGER IF EXISTS update_training_plans_updated_at ON training_plans;
        CREATE TRIGGER update_training_plans_updated_at 
          BEFORE UPDATE ON training_plans 
          FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
      `
    });

    if (error) {
      console.error('❌ Error creating training_plans table:', error.message);
      throw error;
    }
    console.log('✅ training_plans table created successfully');
  }

  async createPlanWorkoutsTable() {
    console.log('📋 Creating plan_workouts table...');
    
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS plan_workouts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          training_plan_id UUID NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
          workout_template_id UUID REFERENCES workout_templates(id) ON DELETE SET NULL,
          day_of_week INTEGER NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7),
          week_number INTEGER NOT NULL CHECK (week_number >= 1),
          order_in_day INTEGER NOT NULL DEFAULT 1,
          rest_day BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          
          -- Ensure unique scheduling per day/week
          UNIQUE(training_plan_id, day_of_week, week_number, order_in_day)
        );

        -- Add indexes
        CREATE INDEX IF NOT EXISTS idx_plan_workouts_training_plan_id ON plan_workouts(training_plan_id);
        CREATE INDEX IF NOT EXISTS idx_plan_workouts_workout_template_id ON plan_workouts(workout_template_id);
        CREATE INDEX IF NOT EXISTS idx_plan_workouts_schedule ON plan_workouts(week_number, day_of_week, order_in_day);
      `
    });

    if (error) {
      console.error('❌ Error creating plan_workouts table:', error.message);
      throw error;
    }
    console.log('✅ plan_workouts table created successfully');
  }

  async createClientProgramsTable() {
    console.log('📋 Creating client_programs table...');
    
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS client_programs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          client_id TEXT NOT NULL,
          program_id UUID NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
          start_date DATE NOT NULL DEFAULT CURRENT_DATE,
          end_date DATE,
          status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
          progress_percentage DECIMAL(5,2) DEFAULT 0.0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          
          -- Prevent multiple active programs for same client
          UNIQUE(client_id, program_id)
        );

        -- Add indexes
        CREATE INDEX IF NOT EXISTS idx_client_programs_client_id ON client_programs(client_id);
        CREATE INDEX IF NOT EXISTS idx_client_programs_program_id ON client_programs(program_id);
        CREATE INDEX IF NOT EXISTS idx_client_programs_status ON client_programs(status);
        CREATE INDEX IF NOT EXISTS idx_client_programs_dates ON client_programs(start_date, end_date);

        -- Add updated_at trigger
        DROP TRIGGER IF EXISTS update_client_programs_updated_at ON client_programs;
        CREATE TRIGGER update_client_programs_updated_at 
          BEFORE UPDATE ON client_programs 
          FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
      `
    });

    if (error) {
      console.error('❌ Error creating client_programs table:', error.message);
      throw error;
    }
    console.log('✅ client_programs table created successfully');
  }

  async createGenerationRulesTable() {
    console.log('📋 Creating generation_rules table...');
    
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS generation_rules (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          fitness_level TEXT NOT NULL CHECK (fitness_level IN ('beginner', 'intermediate', 'advanced')),
          goals TEXT[] DEFAULT '{}',
          equipment_required TEXT[] DEFAULT '{}',
          workout_selection_criteria JSONB DEFAULT '{}',
          program_structure JSONB DEFAULT '{
            "duration_weeks": 12,
            "workouts_per_week": 3,
            "session_duration": 60
          }',
          progression_rules JSONB DEFAULT '{
            "weight_increase_percentage": 5,
            "rep_progression": true
          }',
          active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Add indexes
        CREATE INDEX IF NOT EXISTS idx_generation_rules_fitness_level ON generation_rules(fitness_level);
        CREATE INDEX IF NOT EXISTS idx_generation_rules_goals ON generation_rules USING GIN(goals);
        CREATE INDEX IF NOT EXISTS idx_generation_rules_equipment ON generation_rules USING GIN(equipment_required);
        CREATE INDEX IF NOT EXISTS idx_generation_rules_active ON generation_rules(active);

        -- Add updated_at trigger
        DROP TRIGGER IF EXISTS update_generation_rules_updated_at ON generation_rules;
        CREATE TRIGGER update_generation_rules_updated_at 
          BEFORE UPDATE ON generation_rules 
          FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
      `
    });

    if (error) {
      console.error('❌ Error creating generation_rules table:', error.message);
      throw error;
    }
    console.log('✅ generation_rules table created successfully');
  }

  async insertDefaultGenerationRules() {
    console.log('📋 Inserting default generation rules...');
    
    const defaultRules = [
      {
        name: 'Beginner Full Body',
        fitness_level: 'beginner',
        goals: ['general_fitness', 'muscle_gain'],
        equipment_required: ['barbell', 'dumbbell', 'bodyweight'],
        workout_selection_criteria: {
          muscle_groups_per_week: 2,
          max_exercises_per_workout: 6,
          compound_focus: true,
          complexity_level: 'low'
        },
        program_structure: {
          duration_weeks: 8,
          workouts_per_week: 3,
          session_duration: 45
        },
        progression_rules: {
          weight_increase_percentage: 2.5,
          rep_progression: true,
          linear_progression: true
        }
      },
      {
        name: 'Intermediate Push Pull Legs',
        fitness_level: 'intermediate',
        goals: ['muscle_gain', 'strength'],
        equipment_required: ['barbell', 'dumbbell', 'cable'],
        workout_selection_criteria: {
          muscle_groups_per_week: 2,
          max_exercises_per_workout: 8,
          compound_focus: true,
          complexity_level: 'medium'
        },
        program_structure: {
          duration_weeks: 12,
          workouts_per_week: 4,
          session_duration: 60
        },
        progression_rules: {
          weight_increase_percentage: 5,
          rep_progression: true,
          periodization: 'linear'
        }
      },
      {
        name: 'Advanced Powerbuilding',
        fitness_level: 'advanced',
        goals: ['strength', 'muscle_gain', 'power'],
        equipment_required: ['barbell', 'dumbbell', 'cable', 'machines'],
        workout_selection_criteria: {
          muscle_groups_per_week: 3,
          max_exercises_per_workout: 10,
          compound_focus: true,
          complexity_level: 'high'
        },
        program_structure: {
          duration_weeks: 16,
          workouts_per_week: 5,
          session_duration: 75
        },
        progression_rules: {
          weight_increase_percentage: 7.5,
          rep_progression: true,
          periodization: 'conjugate'
        }
      }
    ];

    for (const rule of defaultRules) {
      const { error } = await supabase
        .from('generation_rules')
        .upsert(rule, { 
          onConflict: 'name',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error(`❌ Error inserting rule "${rule.name}":`, error.message);
      } else {
        console.log(`✅ Inserted rule: ${rule.name}`);
      }
    }
  }

  async setupRLS() {
    console.log('🔐 Setting up Row Level Security...');
    
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        -- Enable RLS on all tables
        ALTER TABLE training_programs ENABLE ROW LEVEL SECURITY;
        ALTER TABLE training_plans ENABLE ROW LEVEL SECURITY;
        ALTER TABLE plan_workouts ENABLE ROW LEVEL SECURITY;
        ALTER TABLE client_programs ENABLE ROW LEVEL SECURITY;
        ALTER TABLE generation_rules ENABLE ROW LEVEL SECURITY;

        -- Create policies for service role (full access)
        CREATE POLICY "Service role can manage all training_programs" ON training_programs
          FOR ALL USING (auth.role() = 'service_role');
        
        CREATE POLICY "Service role can manage all training_plans" ON training_plans
          FOR ALL USING (auth.role() = 'service_role');
        
        CREATE POLICY "Service role can manage all plan_workouts" ON plan_workouts
          FOR ALL USING (auth.role() = 'service_role');
        
        CREATE POLICY "Service role can manage all client_programs" ON client_programs
          FOR ALL USING (auth.role() = 'service_role');
        
        CREATE POLICY "Service role can manage all generation_rules" ON generation_rules
          FOR ALL USING (auth.role() = 'service_role');

        -- Create policies for authenticated users (read access for now)
        CREATE POLICY "Authenticated users can read training_programs" ON training_programs
          FOR SELECT USING (auth.role() = 'authenticated');
        
        CREATE POLICY "Authenticated users can read training_plans" ON training_plans
          FOR SELECT USING (auth.role() = 'authenticated');
        
        CREATE POLICY "Authenticated users can read plan_workouts" ON plan_workouts
          FOR SELECT USING (auth.role() = 'authenticated');
        
        CREATE POLICY "Authenticated users can read their client_programs" ON client_programs
          FOR SELECT USING (auth.role() = 'authenticated');
        
        CREATE POLICY "Authenticated users can read active generation_rules" ON generation_rules
          FOR SELECT USING (auth.role() = 'authenticated' AND active = true);
      `
    });

    if (error) {
      console.error('❌ Error setting up RLS:', error.message);
      // Don't throw here as RLS might already exist
    } else {
      console.log('✅ Row Level Security configured');
    }
  }

  async runSetup() {
    try {
      console.log('🚀 Starting Database Setup for Program Management System');
      console.log('=' .repeat(60));
      
      // Check current state
      await this.checkCurrentTables();
      
      // Create tables in order (respecting foreign keys)
      await this.createTrainingProgramsTable();
      await this.createTrainingPlansTable();
      await this.createPlanWorkoutsTable();
      await this.createClientProgramsTable();
      await this.createGenerationRulesTable();
      
      // Insert default data
      await this.insertDefaultGenerationRules();
      
      // Setup security
      await this.setupRLS();
      
      console.log('\n🎉 Database setup completed successfully!');
      console.log('\n📊 Summary:');
      console.log('   ✅ training_programs - Core program definitions');
      console.log('   ✅ training_plans - Workout scheduling within programs');
      console.log('   ✅ plan_workouts - Individual workout assignments');
      console.log('   ✅ client_programs - Client-to-program assignments');
      console.log('   ✅ generation_rules - Rules for auto-generating programs');
      console.log('   ✅ Default generation rules inserted');
      console.log('   ✅ Row Level Security configured');
      
      console.log('\n🔗 Next Steps:');
      console.log('   1. Test program generation: npm run test:programs');
      console.log('   2. Visit http://localhost:3000/programs to manage programs');
      console.log('   3. Use the assessment form to generate personalized programs');
      
    } catch (error: any) {
      console.error('\n❌ Setup failed:', error.message);
      process.exit(1);
    }
  }
}

// Run setup
async function main() {
  const setup = new DatabaseSetup();
  await setup.runSetup();
}

main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});