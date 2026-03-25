-- 010: Add 'facturation' role to user_role enum
-- Role dedicated to creating invoices from accepted quotes

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'facturation';
