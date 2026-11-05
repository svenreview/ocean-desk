-- Ocean Desk 2.0: idempotent wallet initialization. STAGING DRAFT, not deployed.
-- Prerequisite: docs/ocean-rewards-schema-draft.sql
-- Called only by authenticated Edge Function after verifying Supabase Auth JWT.
begin;
create or replace function public.od_server_initialize_wallet(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_wallet public.od_wallets%rowtype;
begin
  if p_user_id is null then
    raise exception using errcode='22023', message='invalid_user';
  end if;
  -- Existing auth.users FK blocks a made-up identity.
  -- The UPSERT cannot change balances for an existing wallet.
  insert into public.od_wallets(user_id,pieces,tickets)
  values(p_user_id,0,0)
  on conflict(user_id) do nothing;
  select * into strict v_wallet from public.od_wallets where user_id=p_user_id;
  return jsonb_build_object(
    'user_id',v_wallet.user_id,
    'pieces',v_wallet.pieces,
    'tickets',v_wallet.tickets
  );
end;
$function$;
revoke all on function public.od_server_initialize_wallet(uuid) from public, anon, authenticated;
grant execute on function public.od_server_initialize_wallet(uuid) to service_role;
commit;
-- Default environments (santorini-terrace, bali-ocean-cafe) are granted by
-- catalog is_default access logic. Do not insert defaults into reward history.
-- Never import localStorage/demo balances or accept balances from the browser.
