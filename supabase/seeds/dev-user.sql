-- A confirmed development user, for authenticated end-to-end runs.
--
-- NOT for production. It sets a known password, which is exactly what makes it
-- useful locally and unacceptable anywhere real. Nothing applies this
-- automatically; run it by hand against a development database.
--
-- Why a seed rather than a signup: Supabase requires email confirmation and
-- there is no inbox in a test run. GoTrue also rejects reserved TLDs, so
-- `.test` and `.invalid` addresses fail validation at signup — hence a
-- registrable-looking domain and a direct insert.
--
-- Every column GoTrue expects is written explicitly. Leaving the token columns
-- NULL produces a row that looks correct in psql and then fails the password
-- grant with "Invalid login credentials", which costs an hour to diagnose.
delete from auth.users where email = 'acceptance@localize-infra.dev';

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  invited_at, confirmation_token, confirmation_sent_at,
  recovery_token, recovery_sent_at,
  email_change_token_new, email_change, email_change_sent_at,
  last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, created_at, updated_at,
  phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at,
  email_change_token_current, email_change_confirm_status,
  banned_until, reauthentication_token, reauthentication_sent_at,
  is_sso_user, deleted_at, is_anonymous
)
values (
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  'acceptance@localize-infra.dev', crypt('acceptance-test-pw-8chars', gen_salt('bf')), now(),
  null, '', null,
  '', null,
  '', '', null,
  null, '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  false, now(), now(),
  null, null, '', '', null,
  '', 0,
  null, '', null,
  false, null, false
);
