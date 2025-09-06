#!/usr/bin/env tsx

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function createTables() {
  console.log('🚀 Creating Program Management Tables');
  console.log('=' .repeat(50));

  // Create training_programs table
  console.log('📋 Creating training_programs table...');
  const { error: error1 } = await supabase.rpc('exec', {
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
    `
  });

  if (error1) {
    console.error('❌ Error creating training_programs:', error1);
  } else {
    console.log('✅ training_programs table created');
  }

  // Create training_plans table
  console.log('📋 Creating training_plans table...');
  const { error: error2 } = await supabase.rpc('exec', {
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
    `
  });

  if (error2) {
    console.error('❌ Error creating training_plans:', error2);
  } else {
    console.log('✅ training_plans table created');
  }

  // Create plan_workouts table
  console.log('📋 Creating plan_workouts table...');
  const { error: error3 } = await supabase.rpc('exec', {
    sql: `
      CREATE TABLE IF NOT EXISTS plan_workouts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        training_plan_id UUID NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
        workout_template_id UUID,
        day_of_week INTEGER NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7),
        week_number INTEGER NOT NULL CHECK (week_number >= 1),
        order_in_day INTEGER NOT NULL DEFAULT 1,
        rest_day BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `
  });

  if (error3) {
    console.error('❌ Error creating plan_workouts:', error3);
  } else {
    console.log('✅ plan_workouts table created');
  }

  // Create client_programs table
  console.log('📋 Creating client_programs table...');
  const { error: error4 } = await supabase.rpc('exec', {
    sql: `
      CREATE TABLE IF NOT EXISTS client_programs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id TEXT NOT NULL,
        program_id UUID NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
        start_date DATE NOT NULL DEFAULT CURRENT_DATE,
        end_date DATE,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
        progress_percentage DECIMAL(5,2) DEFAULT 0.0,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `
  });

  if (error4) {
    console.error('❌ Error creating client_programs:', error4);
  } else {
    console.log('✅ client_programs table created');
  }

  // Create generation_rules table
  console.log('📋 Creating generation_rules table...');
  const { error: error5 } = await supabase.rpc('exec', {
    sql: `
      CREATE TABLE IF NOT EXISTS generation_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        fitness_level TEXT NOT NULL CHECK (fitness_level IN ('beginner', 'intermediate', 'advanced')),
        goals TEXT[] DEFAULT '{}',
        equipment_required TEXT[] DEFAULT '{}',
        workout_selection_criteria JSONB DEFAULT '{}',
        program_structure JSONB DEFAULT '{"duration_weeks": 12, "workouts_per_week": 3, "session_duration": 60}',
        progression_rules JSONB DEFAULT '{"weight_increase_percentage": 5, "rep_progression": true}',
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `
  });

  if (error5) {
    console.error('❌ Error creating generation_rules:', error5);
  } else {
    console.log('✅ generation_rules table created');
  }

  // Insert default generation rule
  console.log('📋 Adding default generation rule...');
  const { error: insertError } = await supabase
    .from('generation_rules')
    .upsert({
      name: 'Default Intermediate Rule',
      fitness_level: 'intermediate',
      goals: ['muscle_gain', 'strength'],
      equipment_required: ['barbell', 'dumbbell', 'cable'],
      workout_selection_criteria: {
        muscle_groups_per_week: 2,
        max_exercises_per_workout: 8
      },
      program_structure: {
        duration_weeks: 12,
        workouts_per_week: 4,
        session_duration: 60
      },
      progression_rules: {
        weight_increase_percentage: 5,
        rep_progression: true
      }
    }, { onConflict: 'name' });

  if (insertError) {
    console.error('❌ Error inserting default rule:', insertError);
  } else {
    console.log('✅ Default generation rule added');
  }

  console.log('\n🎉 Database setup completed!');
  console.log('\n📊 Tables created:');
  console.log('   • training_programs');
  console.log('   • training_plans');
  console.log('   • plan_workouts');
  console.log('   • client_programs');
  console.log('   • generation_rules');
}

createTables().catch(console.error);