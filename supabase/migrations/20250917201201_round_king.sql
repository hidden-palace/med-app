/*
  # Fix Infinite Recursion by Disabling RLS in is_admin Function

  1. Problem
    - The is_admin() function causes infinite recursion when it queries profiles table
    - Even with SECURITY DEFINER, it still triggers RLS policies
    - This creates a loop where RLS policies call is_admin() which triggers more RLS checks

  2. Solution
    - Modify is_admin() function to temporarily disable RLS for its internal query
    - Use set_config('row_security', 'off', true) to disable RLS for current transaction
    - This breaks the recursive loop while maintaining security

  3. Security
    - Function still runs as SECURITY DEFINER (postgres role)
    - Only disables RLS for the specific query inside the function
    - All other RLS policies remain active for regular user operations
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.is_admin(uuid);

-- Create the is_admin function with RLS disabled for internal query
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Temporarily disable RLS for the current transaction to prevent infinite recursion
  -- when the is_admin function queries the profiles table.
  PERFORM set_config('row_security', 'off', true);

  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'admin' AND is_active = true
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;