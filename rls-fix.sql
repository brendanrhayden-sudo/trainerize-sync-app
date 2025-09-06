-- Temporary fix for RLS policies - run this in Supabase SQL Editor

-- Drop existing policies and recreate with proper service role access
DROP POLICY IF EXISTS "Service role full access to training_programs" ON training_programs;
DROP POLICY IF EXISTS "Service role full access to training_plans" ON training_plans;
DROP POLICY IF EXISTS "Service role full access to plan_workouts" ON plan_workouts;
DROP POLICY IF EXISTS "Service role full access to client_programs" ON client_programs;
DROP POLICY IF EXISTS "Service role full access to generation_rules" ON generation_rules;

-- Create policies with service_role bypass (no auth check needed for service role)
CREATE POLICY "Allow service role full access to training_programs" ON training_programs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role full access to training_plans" ON training_plans
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role full access to plan_workouts" ON plan_workouts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role full access to client_programs" ON client_programs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role full access to generation_rules" ON generation_rules
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Also allow anon access for testing (can be removed later)
CREATE POLICY "Allow anon read access to training_programs" ON training_programs
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon read access to training_plans" ON training_plans
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon read access to plan_workouts" ON plan_workouts
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon read access to client_programs" ON client_programs
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon read access to generation_rules" ON generation_rules
  FOR SELECT TO anon USING (true);

SELECT 'RLS policies fixed for service role access! 🔧' as status;