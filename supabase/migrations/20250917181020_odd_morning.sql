/*
  # Fix Profiles RLS Infinite Recursion

  1. Problem
    - The "Users can update own profile" policy has a recursive subquery
    - It queries the profiles table within its own policy check
    - This causes infinite recursion error (42P17)

  2. Solution
    - Remove the recursive subquery from the WITH CHECK clause
    - Use OLD values to prevent users from changing role and is_active
    - Simplify the policy to avoid self-referencing queries

  3. Changes
    - Drop and recreate the problematic policy
    - Use OLD.role and OLD.is_active instead of SELECT queries
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Recreate the policy without recursive queries
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    -- Prevent users from changing their own role or active status
    -- Use OLD values to avoid recursive queries
    role = OLD.role AND
    is_active = OLD.is_active
  );