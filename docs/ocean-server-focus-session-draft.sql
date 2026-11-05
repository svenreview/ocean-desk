-- Ocean Desk 2.0 server-clock focus session: STAGING DRAFT ONLY.
-- Apply AFTER docs/ocean-verified-puzzle-claim-draft.sql.
-- The browser cannot create or verify server focus receipts directly.
-- This proves elapsed wall-clock time only, NOT sustained attention.
begin;

create table if not exists public.od_focus_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  planned_minutes integer not null check (planned_minutes in (25,50)),
  started_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  status text not null default 'active' check (status in ('active','completed','expired')),
  unique (user_id,request_id)
);
create unique index if not exists od_focus_only_one_active
 on public.od_focus_attempts(user_id) where status='active';
create index if not exists od_focus_attempt_user_idx
 on public.od_focus_attempts(user_id,started_at desc);
alter table public.od_focus_attempts enable row level security;
revoke all on public.od_focus_attempts from PUBLIC,anon,authenticated;
-- No client-side SELECT/INSERT/UPDATE/DELETE permitted.

create or replace function public.od_server_focus_start(
  p_user_id uuid,p_request_id uuid,p_minutes integer
) returns jsonb language plpgsql security definer set search_path=''
as $body$
declare
 v_now timestamptz:=clock_timestamp();
 v_row public.od_focus_attempts%rowtype;
begin
 if p_user_id is null or p_request_id is null or p_minutes not in (25,50) or p_minutes is null then
   raise exception using errcode='22023',message='invalid_focus_request';
 end if;
 -- Serialize all session starts for this user (also covers absent rows).
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,81931));

 select * into v_row from public.od_focus_attempts
 where user_id=p_user_id and request_id=p_request_id;
 if found then
   if v_row.planned_minutes<>p_minutes then
     raise exception using errcode='22023',message='focus_request_id_mismatch';
   end if;
   return jsonb_build_object('session_id',v_row.id,'status',v_row.status,
     'planned_minutes',v_row.planned_minutes,'started_at',v_row.started_at,'replayed',true);
 end if;
 -- Stale interrupted sessions can expire; do NOT verify/generate rewards.
 update public.od_focus_attempts set status='expired'
 where user_id=p_user_id and status='active'
   and started_at < v_now-interval '2 hours';
 if exists(select 1 from public.od_focus_attempts where user_id=p_user_id and status='active') then
   raise exception using errcode='P0001',message='focus_already_active';
 end if;
 insert into public.od_focus_attempts(user_id,request_id,planned_minutes,started_at)
 values(p_user_id,p_request_id,p_minutes,v_now)
 returning * into v_row;
 return jsonb_build_object('session_id',v_row.id,'status',v_row.status,
   'planned_minutes',v_row.planned_minutes,'started_at',v_row.started_at,'replayed',false);
end;
$body$;

create or replace function public.od_server_focus_finish(
  p_user_id uuid,p_session_id uuid
) returns jsonb language plpgsql security definer set search_path=''
as $body$
declare
 v_row public.od_focus_attempts%rowtype;
 v_now timestamptz:=clock_timestamp();
 v_elapsed double precision;
begin
 if p_user_id is null or p_session_id is null then
   raise exception using errcode='22023',message='invalid_focus_request';
 end if;
 select * into v_row from public.od_focus_attempts
 where id=p_session_id and user_id=p_user_id for update;
 if not found then raise exception using errcode='P0001',message='focus_session_not_found';end if;
 if v_row.status='completed' then
   return jsonb_build_object('session_id',v_row.id,'status','completed',
    'verified',true,'replayed',true,'completed_at',v_row.completed_at);
 end if;
 if v_row.status<>'active' then
   raise exception using errcode='P0001',message='focus_session_expired';
 end if;
 v_elapsed:=extract(epoch from (v_now-v_row.started_at));
 if v_elapsed < (v_row.planned_minutes*60) then
   raise exception using errcode='P0001',message='focus_too_early';
 end if;
 if v_elapsed > 7200 then
   update public.od_focus_attempts set status='expired' where id=v_row.id;
   return jsonb_build_object('session_id',v_row.id,'status','expired','verified',false,
    'reason','focus_session_expired');
 end if;
 -- Server receipt and session status committed atomically.
 update public.od_focus_attempts
 set status='completed',completed_at=v_now where id=v_row.id;
 insert into public.od_verified_focus(session_id,user_id,planned_minutes)
 values(v_row.id,v_row.user_id,v_row.planned_minutes)
 on conflict(session_id) do nothing;
 return jsonb_build_object('session_id',v_row.id,'status','completed',
  'verified',true,'replayed',false,'completed_at',v_now);
end;
$body$;
revoke all on function public.od_server_focus_start(uuid,uuid,integer)
 from PUBLIC,anon,authenticated;
revoke all on function public.od_server_focus_finish(uuid,uuid)
 from PUBLIC,anon,authenticated;
grant execute on function public.od_server_focus_start(uuid,uuid,integer) to service_role;
grant execute on function public.od_server_focus_finish(uuid,uuid) to service_role;
commit;

-- Important: wall-clock elapsed is not proof of human attention.
-- Do NOT generate ad verification events from these endpoints.
-- Service must validate JWT and use token-derived user id, not a browser user_id.
