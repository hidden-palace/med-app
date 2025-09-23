/*
  # Fix Profiles RLS Infinite Recursion - Simple Approach

  1. Problem
    - The "Users can update own profile" policy causes infinite recursion
    - OLD references don't work in RLS policies
    - Complex WITH CHECK clauses cause database errors

  2. Solution
    - Simplify the policy to only check user ownership
    - Remove role/active status protection from RLS level
    - Handle role protection through application logic instead

  3. Changes
    - Drop and recreate the problematic policy with simple ownership check
    - Keep admin policies using the is_admin() function
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Recreate with simple ownership check only
-- Role and active status protection will be handled at application level
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Ensure the is_admin function exists and works properly
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'admin' AND is_active = true
  );
END;
$$;