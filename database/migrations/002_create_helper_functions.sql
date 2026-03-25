-- ============================================================================
-- Migration 002: Create Helper Functions & Triggers
-- CRM Demonfaucon - Supabase PostgreSQL
-- ============================================================================

-- ---------------------------------------------------------------------------
-- update_updated_at()
-- Generic trigger function to auto-set updated_at on any row modification.
-- Attach to tables via:
--   CREATE TRIGGER ... BEFORE UPDATE ON <table>
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- get_user_role()
-- Returns the role of the currently authenticated user by looking it up
-- in the profiles table. Returns NULL if no authenticated user.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role;
BEGIN
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = auth.uid();

  RETURN v_role;
END;
$$;

-- ---------------------------------------------------------------------------
-- has_role(allowed_roles user_role[])
-- Returns TRUE if the current user's role is contained within the given array.
-- Usage in RLS policies:
--   has_role(ARRAY['admin', 'super_admin']::user_role[])
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(allowed_roles public.user_role[])
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.get_user_role() = ANY(allowed_roles);
END;
$$;

-- ---------------------------------------------------------------------------
-- is_admin()
-- Shorthand: returns TRUE if the current user is super_admin or admin.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.has_role(ARRAY['super_admin', 'admin']::public.user_role[]);
END;
$$;

-- ---------------------------------------------------------------------------
-- is_management()
-- Returns TRUE if the current user holds a management-level role:
-- super_admin, admin, responsable_commercial, or conducteur_travaux.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_management()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.has_role(
    ARRAY[
      'super_admin',
      'admin',
      'responsable_commercial',
      'conducteur_travaux'
    ]::public.user_role[]
  );
END;
$$;
