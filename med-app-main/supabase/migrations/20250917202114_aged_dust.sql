/*
  # Fix Infinite Recursion in Profiles RLS

  1. Problem
    - RLS policies on profiles table call is_admin() function
    - is_admin() function queries profiles table
    - This creates infinite recursion loop (42P17 error)

  2. Solution
    - Remove admin policies from profiles table that call is_admin()
    - Keep user policies for own profile access
    - Admin access will be handled at application level

  3. Security Impact
    - Users can only read/update their own profiles via RLS
    - Admin operations on other profiles must be handled in application logic
    - This breaks the recursion while maintaining basic security
*/

-- Drop the problematic admin policies that cause infinite recursion
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;

-- Keep the user policies (these don't cause recursion)
-- "Users can read own profile" - already exists
-- "Users can update own profile" - already exists

-- Keep the postgres role policy for the is_admin function
-- "Allow postgres role to read profiles" - already exists

-- Note: Admin access to other users' profiles will now need to be handled
-- at the application level by checking isUserAdmin() before operations