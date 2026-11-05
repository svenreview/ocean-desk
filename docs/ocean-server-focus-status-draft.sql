-- Ocean Desk 2.0 server recovery lookup — STAGING ONLY.
-- Depends on docs/ocean-server-focus-session-draft.sql.
-- Caller: trusted JWT-verified Edge Function, service_role only.
-- Never trust client timestamps, user IDs or elapsed seconds.
begin;
create or replace function public.od_server_focus_status(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path=''
as $body$
declare
  v_record public.od_focus_attempts%rowtype;
  v_now timestamptz:=clock_timestamp();
  v_elapsed integer;
begin
  if p_user_id is null then
    raise exception using errcode='22023',message='invalid_focus_request';
  end if;
  select * into v_record from public.od_focus_attempts
  where user_id=p_user_id and status='active'
  order by started_at desc limit 1;
  if not found then
    return jsonb_build_object('active',false);
  end if;
  v_elapsed:=greatest(0,floor(extract(epoch from(v_now-v_record.started_at)))::integer);
  if v_elapsed>7200 then
    -- Expiration is reported without completing the session or creating receipts.
    return jsonb_build_object('active',false,'expired',true);
  end if;
  return jsonb_build_object(
    'active',true,
    'session_id',v_record.id,
    'planned_minutes',v_record.planned_minutes,
    'elapsed_seconds',v_elapsed,
    'remaining_seconds',greatest(0,v_record.planned_minutes*60-v_elapsed),
    'ready_to_finish',(v_elapsed>=v_record.planned_minutes*60),
    'started_at',v_record.started_at,
    'server_time',v_now
  );
end;
$body$;
revoke all on function public.od_server_focus_status(uuid) from PUBLIC,anon,authenticated;
grant execute on function public.od_server_focus_status(uuid) to service_role;
commit;
