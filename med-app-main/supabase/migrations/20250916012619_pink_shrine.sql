/*
  # Fix validation_history table schema

  1. Table Updates
    - Ensure `validation_history` table has all required columns
    - Add missing columns if they don't exist
    - Update existing columns to match expected schema

  2. Security
    - Maintain existing RLS policies
    - Ensure proper indexing
*/

-- Ensure validation_history table exists with all required columns
CREATE TABLE IF NOT EXISTS validation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL,
  state text NOT NULL,
  region text NOT NULL,
  status text NOT NULL DEFAULT 'processing',
  result_summary text,
  result_details jsonb,
  overall_score integer,
  lcd_results jsonb,
  recommendations jsonb,
  compliance_summary text,
  processing_metadata jsonb,
  n8n_execution_id text,
  file_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add missing columns if they don't exist
DO $$
BEGIN
  -- Add file_type column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'validation_history' AND column_name = 'file_type'
  ) THEN
    ALTER TABLE validation_history ADD COLUMN file_type text NOT NULL DEFAULT 'text/plain';
  END IF;

  -- Add file_url column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'validation_history' AND column_name = 'file_url'
  ) THEN
    ALTER TABLE validation_history ADD COLUMN file_url text;
  END IF;

  -- Add overall_score column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'validation_history' AND column_name = 'overall_score'
  ) THEN
    ALTER TABLE validation_history ADD COLUMN overall_score integer;
  END IF;

  -- Add lcd_results column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'validation_history' AND column_name = 'lcd_results'
  ) THEN
    ALTER TABLE validation_history ADD COLUMN lcd_results jsonb;
  END IF;

  -- Add recommendations column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'validation_history' AND column_name = 'recommendations'
  ) THEN
    ALTER TABLE validation_history ADD COLUMN recommendations jsonb;
  END IF;

  -- Add compliance_summary column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'validation_history' AND column_name = 'compliance_summary'
  ) THEN
    ALTER TABLE validation_history ADD COLUMN compliance_summary text;
  END IF;

  -- Add processing_metadata column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'validation_history' AND column_name = 'processing_metadata'
  ) THEN
    ALTER TABLE validation_history ADD COLUMN processing_metadata jsonb;
  END IF;
END $$;

-- Enable Row Level Security if not already enabled
ALTER TABLE validation_history ENABLE ROW LEVEL SECURITY;

-- Recreate policies to ensure they exist
DROP POLICY IF EXISTS "Users can read own validation history" ON validation_history;
DROP POLICY IF EXISTS "Users can insert own validation history" ON validation_history;
DROP POLICY IF EXISTS "Users can update own validation history" ON validation_history;

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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_validation_history_user_id ON validation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_validation_history_status ON validation_history(status);
CREATE INDEX IF NOT EXISTS idx_validation_history_created_at ON validation_history(created_at DESC);