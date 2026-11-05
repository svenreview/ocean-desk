-- OCEAN DESK 41: STAGING TEST ONLY. NEVER RUN WITHOUT DEPLOYMENT APPROVAL.
-- Emergency gate: blocks new service_role RPC EXECUTE grants.
-- Does not DROP tables/functions, touch data, or change existing catalog RLS.
-- Does NOT stop direct privileged table writes, DB owners, or calls already in progress.
begin;
revoke all on function public.od_server_travel_draw(uuid,text,uuid) from service_role;
revoke all on function public.od_server_initialize_wallet(uuid) from service_role;
revoke all on function public.od_server_claim_verified_puzzle(uuid,uuid,text) from service_role;
revoke all on function public.od_server_focus_start(uuid,uuid,integer) from service_role;
revoke all on function public.od_server_focus_finish(uuid,uuid) from service_role;
revoke all on function public.od_server_focus_cancel(uuid,uuid) from service_role;
revoke all on function public.od_server_focus_status(uuid) from service_role;
commit;
