-- OCEAN DESK 41: STAGING TEST ONLY. NEVER RUN WITHOUT DEPLOYMENT APPROVAL.
-- Restore gate: restores service_role RPC EXECUTE grants after verification.
-- Does not DROP tables/functions, touch data, or change existing catalog RLS.
-- Does NOT stop direct privileged table writes, DB owners, or calls already in progress.
begin;
grant execute on function public.od_server_travel_draw(uuid,text,uuid) to service_role;
grant execute on function public.od_server_initialize_wallet(uuid) to service_role;
grant execute on function public.od_server_claim_verified_puzzle(uuid,uuid,text) to service_role;
grant execute on function public.od_server_focus_start(uuid,uuid,integer) to service_role;
grant execute on function public.od_server_focus_finish(uuid,uuid) to service_role;
grant execute on function public.od_server_focus_cancel(uuid,uuid) to service_role;
grant execute on function public.od_server_focus_status(uuid) to service_role;
commit;
