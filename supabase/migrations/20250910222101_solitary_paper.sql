/*
  # Fix RLS Policies and Data Access

  1. Enable RLS on all tables
  2. Add proper policies for data access
  3. Fix data type issues
  4. Add indexes for performance
*/

-- Enable RLS on all tables
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE recent_activity ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can read published courses" ON courses;
DROP POLICY IF EXISTS "Authenticated users can read all courses" ON courses;
DROP POLICY IF EXISTS "Anyone can read modules of published courses" ON modules;
DROP POLICY IF EXISTS "Authenticated users can read all modules" ON modules;
DROP POLICY IF EXISTS "Users can read own progress" ON user_progress;
DROP POLICY IF EXISTS "Users can insert own progress" ON user_progress;
DROP POLICY IF EXISTS "Users can update own progress" ON user_progress;
DROP POLICY IF EXISTS "Users can read own validation history" ON validation_history;
DROP POLICY IF EXISTS "Users can insert own validation history" ON validation_history;
DROP POLICY IF EXISTS "Users can update own validation history" ON validation_history;
DROP POLICY IF EXISTS "Users can read own activity" ON recent_activity;
DROP POLICY IF EXISTS "Users can insert own activity" ON recent_activity;

-- Create policies for courses (allow public read for published courses)
CREATE POLICY "Anyone can read published courses"
  ON courses
  FOR SELECT
  USING (published = true);

CREATE POLICY "Authenticated users can read all courses"
  ON courses
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policies for modules (allow public read for modules of published courses)
CREATE POLICY "Anyone can read modules of published courses"
  ON modules
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM courses 
      WHERE courses.id = modules.course_id 
      AND courses.published = true
    )
  );

CREATE POLICY "Authenticated users can read all modules"
  ON modules
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policies for user_progress
CREATE POLICY "Users can read own progress"
  ON user_progress
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
  ON user_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON user_progress
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for validation_history
CREATE POLICY "Users can read own validation history"
  ON validation_history
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own validation history"
  ON validation_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own validation history"
  ON validation_history
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for recent_activity
CREATE POLICY "Users can read own activity"
  ON recent_activity
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activity"
  ON recent_activity
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_modules_course_id ON modules(course_id);
CREATE INDEX IF NOT EXISTS idx_modules_order ON modules(course_id, order_index);
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_course_id ON user_progress(course_id);
CREATE INDEX IF NOT EXISTS idx_validation_history_user_id ON validation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_recent_activity_user_id ON recent_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_courses_published ON courses(published, order_index);

-- Fix duration column to use TEXT instead of INTERVAL for easier handling
ALTER TABLE modules ALTER COLUMN duration TYPE TEXT;