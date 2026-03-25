-- ============================================================================
-- 022 — Comptes de démonstration pour chaque rôle
-- Mot de passe commun : Demo1234!
-- Ces comptes sont temporaires et seront modifiés par le client.
-- ============================================================================

-- 1. Admin
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@demonfaucon.fr',
  crypt('Demo1234!', gen_salt('bf')),
  now(),
  '{"first_name":"Marie","last_name":"Dupont","role":"admin"}'::jsonb,
  now(), now(), '', ''
);

-- 2. Responsable Commercial
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'resp.commercial@demonfaucon.fr',
  crypt('Demo1234!', gen_salt('bf')),
  now(),
  '{"first_name":"Thomas","last_name":"Martin","role":"responsable_commercial"}'::jsonb,
  now(), now(), '', ''
);

-- 3. Commercial
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'commercial1@demonfaucon.fr',
  crypt('Demo1234!', gen_salt('bf')),
  now(),
  '{"first_name":"Julie","last_name":"Bernard","role":"commercial"}'::jsonb,
  now(), now(), '', ''
);

-- 4. Conducteur de Travaux
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'conducteur@demonfaucon.fr',
  crypt('Demo1234!', gen_salt('bf')),
  now(),
  '{"first_name":"Pierre","last_name":"Moreau","role":"conducteur_travaux"}'::jsonb,
  now(), now(), '', ''
);

-- 5. Comptabilité
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'compta@demonfaucon.fr',
  crypt('Demo1234!', gen_salt('bf')),
  now(),
  '{"first_name":"Sophie","last_name":"Petit","role":"comptabilite"}'::jsonb,
  now(), now(), '', ''
);

-- 6. Facturation
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'facturation@demonfaucon.fr',
  crypt('Demo1234!', gen_salt('bf')),
  now(),
  '{"first_name":"Lucas","last_name":"Roux","role":"facturation"}'::jsonb,
  now(), now(), '', ''
);

-- 7. Jardinier (accès mobile PWA)
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'jardinier@demonfaucon.fr',
  crypt('Demo1234!', gen_salt('bf')),
  now(),
  '{"first_name":"Antoine","last_name":"Garcia","role":"jardinier"}'::jsonb,
  now(), now(), '', ''
);
