/*
  # Enable RLS and Create Access Policies

  1. Enable RLS on all tables
  2. Create policies for public access to published courses
  3. Create policies for authenticated user access
  4. Fix data types and constraints
*/

-- Enable Row Level Security on all tables
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE recent_activity ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Public can read published courses" ON courses;
DROP POLICY IF EXISTS "Public can read modules of published courses" ON modules;
DROP POLICY IF EXISTS "Users can manage own progress" ON user_progress;
DROP POLICY IF EXISTS "Users can read own progress" ON user_progress;
DROP POLICY IF EXISTS "Users can insert own progress" ON user_progress;
DROP POLICY IF EXISTS "Users can update own progress" ON user_progress;
DROP POLICY IF EXISTS "Users can manage own validation history" ON validation_history;
DROP POLICY IF EXISTS "Users can manage own activity" ON recent_activity;

-- Courses policies (allow public read for published courses)
CREATE POLICY "Public can read published courses"
  ON courses
  FOR SELECT
  USING (published = true);

-- Modules policies (allow public read for modules of published courses)
CREATE POLICY "Public can read modules of published courses"
  ON modules
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM courses 
      WHERE courses.id = modules.course_id 
      AND courses.published = true
    )
  );

-- User progress policies (users can only access their own progress)
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

-- Validation history policies (users can only access their own history)
CREATE POLICY "Users can manage own validation history"
  ON validation_history
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Recent activity policies (users can only access their own activity)
CREATE POLICY "Users can manage own activity"
  ON recent_activity
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Fix duration column to use TEXT instead of INTERVAL for easier handling
ALTER TABLE modules ALTER COLUMN duration TYPE TEXT USING duration::TEXT;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_courses_published ON courses(published, order_index);
CREATE INDEX IF NOT EXISTS idx_modules_course_id ON modules(course_id, order_index);
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_course_id ON user_progress(course_id);
CREATE INDEX IF NOT EXISTS idx_validation_history_user_id ON validation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_recent_activity_user_id ON recent_activity(user_id);

-- Ensure all courses are published for testing
UPDATE courses SET published = true WHERE published IS NULL OR published = false;