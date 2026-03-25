-- ============================================================================
-- 025 — Champs personnalisés (définitions + valeurs)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Table : custom_field_definitions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.custom_field_definitions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   TEXT NOT NULL CHECK (entity_type IN ('clients', 'prospects', 'chantiers')),
  field_name    TEXT NOT NULL,
  field_label   TEXT NOT NULL,
  field_type    TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'select', 'boolean')),
  options       JSONB DEFAULT '[]'::jsonb,  -- for "select" type: ["Option A", "Option B"]
  required      BOOLEAN NOT NULL DEFAULT false,
  position      INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (entity_type, field_name)
);

-- ---------------------------------------------------------------------------
-- Table : custom_field_values
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.custom_field_values (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_definition_id   UUID NOT NULL REFERENCES public.custom_field_definitions(id) ON DELETE CASCADE,
  entity_type           TEXT NOT NULL,
  entity_id             UUID NOT NULL,
  value                 JSONB,   -- stored as JSON for flexibility
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (field_definition_id, entity_id)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_custom_field_defs_entity
  ON public.custom_field_definitions (entity_type, is_active, position);

CREATE INDEX IF NOT EXISTS idx_custom_field_values_entity
  ON public.custom_field_values (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_field_values ENABLE ROW LEVEL SECURITY;

-- Definitions: everyone (except jardinier) can read
CREATE POLICY "custom_field_defs_select" ON public.custom_field_definitions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role != 'jardinier')
  );

-- Definitions: admin only can manage
CREATE POLICY "custom_field_defs_insert" ON public.custom_field_definitions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

CREATE POLICY "custom_field_defs_update" ON public.custom_field_definitions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

CREATE POLICY "custom_field_defs_delete" ON public.custom_field_definitions
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

-- Values: all non-jardinier can read
CREATE POLICY "custom_field_values_select" ON public.custom_field_values
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role != 'jardinier')
  );

-- Values: all non-jardinier can write (insert/update)
CREATE POLICY "custom_field_values_insert" ON public.custom_field_values
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role != 'jardinier')
  );

CREATE POLICY "custom_field_values_update" ON public.custom_field_values
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role != 'jardinier')
  );

CREATE POLICY "custom_field_values_delete" ON public.custom_field_values
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );
