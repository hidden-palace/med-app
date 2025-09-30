/*
  # Enhance profiles for single-session tracking

  1. Table Updates
    - Add columns to record the active session hash and last update timestamp
  2. Indexes
    - Index the session hash for quick lookups
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_session_hash text,
  ADD COLUMN IF NOT EXISTS active_session_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_active_session_hash
  ON public.profiles(active_session_hash);
