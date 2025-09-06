-- Program Management System Database Schema
-- Run this script in your Supabase SQL Editor

-- 1. Create training_programs table
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

-- Add indexes for training_programs
CREATE INDEX IF NOT EXISTS idx_training_programs_sync_status ON training_programs(sync_status);
CREATE INDEX IF NOT EXISTS idx_training_programs_difficulty ON training_programs(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_training_programs_trainerize_id ON training_programs(trainerize_program_id);

-- 2. Create training_plans table
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

-- Add indexes for training_plans
CREATE INDEX IF NOT EXISTS idx_training_plans_program_id ON training_plans(program_id);
CREATE INDEX IF NOT EXISTS idx_training_plans_sync_status ON training_plans(sync_status);
CREATE INDEX IF NOT EXISTS idx_training_plans_trainerize_id ON training_plans(trainerize_plan_id);

-- 3. Create plan_workouts table
CREATE TABLE IF NOT EXISTS plan_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_plan_id UUID NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
  workout_template_id UUID,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7),
  week_number INTEGER NOT NULL CHECK (week_number >= 1),
  order_in_day INTEGER NOT NULL DEFAULT 1,
  rest_day BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique scheduling per day/week
  UNIQUE(training_plan_id, day_of_week, week_number, order_in_day)
);

-- Add indexes for plan_workouts
CREATE INDEX IF NOT EXISTS idx_plan_workouts_training_plan_id ON plan_workouts(training_plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_workouts_workout_template_id ON plan_workouts(workout_template_id);
CREATE INDEX IF NOT EXISTS idx_plan_workouts_schedule ON plan_workouts(week_number, day_of_week, order_in_day);

-- 4. Create client_programs table
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
  
  -- Prevent multiple active programs for same client-program combination
  UNIQUE(client_id, program_id)
);

-- Add indexes for client_programs
CREATE INDEX IF NOT EXISTS idx_client_programs_client_id ON client_programs(client_id);
CREATE INDEX IF NOT EXISTS idx_client_programs_program_id ON client_programs(program_id);
CREATE INDEX IF NOT EXISTS idx_client_programs_status ON client_programs(status);
CREATE INDEX IF NOT EXISTS idx_client_programs_dates ON client_programs(start_date, end_date);

-- 5. Create generation_rules table
CREATE TABLE IF NOT EXISTS generation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
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

-- Add indexes for generation_rules
CREATE INDEX IF NOT EXISTS idx_generation_rules_fitness_level ON generation_rules(fitness_level);
CREATE INDEX IF NOT EXISTS idx_generation_rules_goals ON generation_rules USING GIN(goals);
CREATE INDEX IF NOT EXISTS idx_generation_rules_equipment ON generation_rules USING GIN(equipment_required);
CREATE INDEX IF NOT EXISTS idx_generation_rules_active ON generation_rules(active);

-- 6. Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 7. Add updated_at triggers
DROP TRIGGER IF EXISTS update_training_programs_updated_at ON training_programs;
CREATE TRIGGER update_training_programs_updated_at 
  BEFORE UPDATE ON training_programs 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_training_plans_updated_at ON training_plans;
CREATE TRIGGER update_training_plans_updated_at 
  BEFORE UPDATE ON training_plans 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_client_programs_updated_at ON client_programs;
CREATE TRIGGER update_client_programs_updated_at 
  BEFORE UPDATE ON client_programs 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_generation_rules_updated_at ON generation_rules;
CREATE TRIGGER update_generation_rules_updated_at 
  BEFORE UPDATE ON generation_rules 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 8. Enable Row Level Security
ALTER TABLE training_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_rules ENABLE ROW LEVEL SECURITY;

-- 9. Create RLS policies for service role (full access)
CREATE POLICY "Service role full access to training_programs" ON training_programs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to training_plans" ON training_plans
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to plan_workouts" ON plan_workouts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to client_programs" ON client_programs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to generation_rules" ON generation_rules
  FOR ALL USING (auth.role() = 'service_role');

-- 10. Create RLS policies for authenticated users (read access)
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

-- 11. Insert default generation rules
INSERT INTO generation_rules (name, fitness_level, goals, equipment_required, workout_selection_criteria, program_structure, progression_rules)
VALUES 
  (
    'Beginner Full Body',
    'beginner',
    '{"general_fitness", "muscle_gain"}',
    '{"barbell", "dumbbell", "bodyweight"}',
    '{"muscle_groups_per_week": 2, "max_exercises_per_workout": 6, "compound_focus": true, "complexity_level": "low"}',
    '{"duration_weeks": 8, "workouts_per_week": 3, "session_duration": 45}',
    '{"weight_increase_percentage": 2.5, "rep_progression": true, "linear_progression": true}'
  ),
  (
    'Intermediate Push Pull Legs',
    'intermediate',
    '{"muscle_gain", "strength"}',
    '{"barbell", "dumbbell", "cable"}',
    '{"muscle_groups_per_week": 2, "max_exercises_per_workout": 8, "compound_focus": true, "complexity_level": "medium"}',
    '{"duration_weeks": 12, "workouts_per_week": 4, "session_duration": 60}',
    '{"weight_increase_percentage": 5, "rep_progression": true, "periodization": "linear"}'
  ),
  (
    'Advanced Powerbuilding',
    'advanced',
    '{"strength", "muscle_gain", "power"}',
    '{"barbell", "dumbbell", "cable", "machines"}',
    '{"muscle_groups_per_week": 3, "max_exercises_per_workout": 10, "compound_focus": true, "complexity_level": "high"}',
    '{"duration_weeks": 16, "workouts_per_week": 5, "session_duration": 75}',
    '{"weight_increase_percentage": 7.5, "rep_progression": true, "periodization": "conjugate"}'
  )
ON CONFLICT (name) DO NOTHING;

-- Success message
SELECT 'Program Management Database Schema created successfully! 🎉' as status;