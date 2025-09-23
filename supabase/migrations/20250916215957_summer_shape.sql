/*
  # Fix RLS Infinite Recursion Error

  1. Functions
    - Create `is_admin()` function with SECURITY DEFINER to bypass RLS
    - This prevents infinite recursion when checking admin status

  2. Profiles Table Policies
    - Update admin policies to use the new `is_admin()` function
    - This breaks the recursion loop

  3. Validation History Policies
    - Add admin access policy for validation_history table
    - Allows admins to view all validation records

  4. Security
    - Maintain existing user access controls
    - Add proper admin access without recursion
*/

-- Create a SECURITY DEFINER function to check if user is admin
-- This bypasses RLS and prevents infinite recursion
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

-- Drop existing admin policies that cause recursion
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;

-- Recreate admin policies using the new is_admin function
CREATE POLICY "Admins can read all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update all profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert profiles"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- Add admin access policy for validation_history table
CREATE POLICY "Admins can read all validation history"
  ON validation_history
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update all validation history"
  ON validation_history
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete all validation history"
  ON validation_history
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));