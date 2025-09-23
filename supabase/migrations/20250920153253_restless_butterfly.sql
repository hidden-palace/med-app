/*
  # Add Foreign Key Relationship Between validation_history and profiles

  1. Problem
    - PostgREST cannot find relationship between validation_history and profiles tables
    - Missing foreign key constraint prevents JOIN operations
    - Query fails when trying to fetch user details with validation history

  2. Solution
    - Add foreign key constraint linking validation_history.user_id to profiles.id
    - Name it validation_history_user_id_fkey to match PostgREST expectations
    - Include CASCADE options for data integrity

  3. Security
    - Maintains existing RLS policies
    - Ensures referential integrity between tables
*/

-- Add foreign key constraint between validation_history and profiles
DO $$
BEGIN
  -- Check if the foreign key constraint doesn't already exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'validation_history_user_id_fkey'
    AND table_name = 'validation_history'
    AND constraint_type = 'FOREIGN KEY'
  ) THEN
    -- Add the foreign key constraint
    ALTER TABLE validation_history 
    ADD CONSTRAINT validation_history_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES public.profiles(id) 
    ON DELETE CASCADE;
  END IF;
END $$;

-- Create index for better JOIN performance
CREATE INDEX IF NOT EXISTS idx_validation_history_user_id_fkey ON validation_history(user_id);