/*
  # Add profiles self-update guardrails

  1. Problem
    - The current "Users can update own profile" policy allows any column update.
    - Authenticated users can potentially modify privileged fields.

  2. Solution
    - Add a BEFORE UPDATE trigger that blocks authenticated self-updates to:
      - role
      - is_active
      - active_session_hash
      - active_session_updated_at

  3. Security
    - Service-role updates remain allowed (used by server routes).
    - Regular profile updates (name/email/last sign-in metadata) remain allowed.
*/

CREATE OR REPLACE FUNCTION public.prevent_profile_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated'
    AND auth.uid() IS NOT NULL
    AND auth.uid() = OLD.id THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Updating role is not allowed.';
    END IF;

    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Updating account status is not allowed.';
    END IF;

    IF NEW.active_session_hash IS DISTINCT FROM OLD.active_session_hash
      OR NEW.active_session_updated_at IS DISTINCT FROM OLD.active_session_updated_at THEN
      RAISE EXCEPTION 'Updating session enforcement fields is not allowed.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_self_escalation_trigger ON public.profiles;

CREATE TRIGGER prevent_profile_self_escalation_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_self_escalation();
