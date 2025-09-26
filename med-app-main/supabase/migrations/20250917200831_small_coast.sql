/*
  # Fix Infinite Recursion in Profiles RLS - Final Solution

  1. Problem
    - The `is_admin()` function runs as SECURITY DEFINER (postgres role)
    - When it queries profiles table, it still triggers RLS policies
    - This creates infinite recursion loop

  2. Solution
    - Add explicit policy for postgres role to bypass RLS
    - This allows the is_admin() function to query profiles without recursion
    - Maintains all existing security for regular users

  3. Security
    - Only postgres role gets bypass access (system level)
    - All user-level policies remain intact
    - Admin checks work without recursion
*/

-- Add policy to allow postgres role to read profiles without RLS checks
-- This prevents infinite recursion in the is_admin() function
CREATE POLICY "Allow postgres role to read profiles"
  ON public.profiles
  FOR SELECT
  TO postgres
  USING (true);

-- Ensure the is_admin function exists and is properly configured
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