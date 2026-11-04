-- Disposable GitHub Actions PostgreSQL database only.
-- Supabase API roles/auth schema shim for testing SQL migrations without touching production.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
