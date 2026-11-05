-- Ocean Desk 2.0 — server-only transactional travel draw (DRAFT; not deployed).
-- Prerequisite: docs/ocean-rewards-schema-draft.sql reviewed and applied in staging.
-- SECURITY: service_role is the ONLY role that may call this function.
-- The authenticated user ID must be established by the Edge Function via Supabase Auth.
begin;

create or replace function public.od_server_travel_draw(
  p_user_id uuid,
  p_region_id text,
  p_request_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_wallet_tickets integer;
  v_existing public.od_travel_draws%rowtype;
  v_winner public.od_environments%rowtype;
  v_remaining integer;
begin
  if p_user_id is null or p_region_id is null or p_request_id is null then
    raise exception using errcode='22023', message='invalid_arguments';
  end if;

  -- Row lock serializes all draws for one wallet.
  select tickets into v_wallet_tickets
  from public.od_wallets
  where user_id=p_user_id
  for update;

  if not found then
    raise exception using errcode='P0001', message='wallet_not_initialized';
  end if;

  -- Retry safe: same request_id returns its earlier result without spending.
  select * into v_existing
  from public.od_travel_draws
  where user_id=p_user_id and request_id=p_request_id;

  if found then
    if v_existing.region_id<>p_region_id then
      raise exception using errcode='22023', message='request_id_region_mismatch';
    end if;
    return jsonb_build_object(
      'request_id',p_request_id,
      'region_id',v_existing.region_id,
      'environment_id',v_existing.environment_id,
      'tickets_left',v_wallet_tickets,
      'replayed',true
    );
  end if;

  if v_wallet_tickets<1 then
    raise exception using errcode='P0001', message='insufficient_tickets';
  end if;

  if not exists (select 1 from public.od_regions where id=p_region_id) then
    raise exception using errcode='22023', message='invalid_region';
  end if;

  -- Only active, unowned scenes. Equal probability among eligible scenes.
  select * into v_winner
  from public.od_environments e
  where e.region_id=p_region_id and e.is_active
    and not exists (
      select 1 from public.od_owned_environments o
      where o.user_id=p_user_id and o.environment_id=e.id
    )
    and not e.is_default
  order by pg_catalog.random()
  limit 1;

  if not found then
    raise exception using errcode='P0001', message='region_collection_complete';
  end if;

  -- All writes below are a single Postgres transaction. Any error rolls back.
  insert into public.od_owned_environments(user_id,environment_id)
  values (p_user_id,v_winner.id);

  update public.od_wallets
  set tickets=tickets-1,updated_at=now()
  where user_id=p_user_id;

  insert into public.od_travel_draws(user_id,request_id,region_id,environment_id)
  values (p_user_id,p_request_id,p_region_id,v_winner.id);

  return jsonb_build_object(
    'request_id',p_request_id,
    'region_id',p_region_id,
    'environment_id',v_winner.id,
    'name_ko',v_winner.name_ko,
    'tier',v_winner.tier,
    'tickets_left',v_wallet_tickets-1,
    'replayed',false
  );
end;
$function$;

-- Explicitly remove default PUBLIC execute privilege and any inherited grants.
revoke all on function public.od_server_travel_draw(uuid,text,uuid) from PUBLIC,anon,authenticated;
grant execute on function public.od_server_travel_draw(uuid,text,uuid) to service_role;

commit;

-- Pre-release tests (execute in a disposable staging database):
-- * authenticated and anon cannot call the RPC.
-- * same request_id twice spends exactly one ticket.
-- * parallel different request_ids on a 1-ticket wallet allow only one success.
-- * exhausted region does not spend a ticket.
-- * repeat draws never grant duplicate environment.
-- * no wallet / unknown region / insufficient tickets fail safely.
-- * carefully inspect privileges of SECURITY DEFINER function with Supabase Advisors.
