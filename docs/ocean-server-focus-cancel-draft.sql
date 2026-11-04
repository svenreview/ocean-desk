-- Server focus cancel: a paused/reset session cannot generate a completed receipt.
-- Apply AFTER docs/ocean-server-focus-session-draft.sql, staging only.
begin;
create or replace function public.od_server_focus_cancel(
  p_user_id uuid,p_session_id uuid
) returns jsonb language plpgsql security definer set search_path=''
as $body$
declare v_row public.od_focus_attempts%rowtype;
begin
 if p_user_id is null or p_session_id is null then
  raise exception using errcode='22023',message='invalid_focus_request';
 end if;
 select * into v_row from public.od_focus_attempts
 where user_id=p_user_id and id=p_session_id for update;
 if not found then raise exception using errcode='P0001',message='focus_session_not_found'; end if;
 if v_row.status='active' then
  update public.od_focus_attempts set status='expired' where id=v_row.id;
  return jsonb_build_object('session_id',v_row.id,'status','expired','cancelled',true);
 end if;
 return jsonb_build_object('session_id',v_row.id,'status',v_row.status,'cancelled',false);
end;
$body$;
revoke all on function public.od_server_focus_cancel(uuid,uuid)
 from PUBLIC,anon,authenticated;
grant execute on function public.od_server_focus_cancel(uuid,uuid) to service_role;
commit;
