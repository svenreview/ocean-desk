-- Ocean Desk 2.0 — verified puzzle grant, DRAFT: disposable PostgreSQL CI only.
-- Requires ocean-rewards-schema-draft.sql and wallet init.
-- Production MUST supply two independently trusted server-only receipts;
-- NEVER mark either receipt verified solely from client timer/ad callbacks.
begin;
create table if not exists public.od_verified_focus (
 session_id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 planned_minutes integer not null check (planned_minutes in (25,50)),
 verified_at timestamptz not null default now()
);
create table if not exists public.od_verified_ad_events (
 event_id text primary key,
 session_id uuid not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 provider text not null,
 verified_at timestamptz not null default now(),
 unique(user_id,session_id)
);
alter table public.od_verified_focus enable row level security;
alter table public.od_verified_ad_events enable row level security;
revoke all on public.od_verified_focus,public.od_verified_ad_events from PUBLIC,anon,authenticated;
-- Intentionally no user read or write policies. Server-only receipt storage.

create or replace function public.od_server_claim_verified_puzzle(
 p_user_id uuid, p_session_id uuid, p_event_id text
) returns jsonb
language plpgsql security definer set search_path=''
as $body$
declare
 v_wallet public.od_wallets%rowtype;
 v_claim public.od_reward_claims%rowtype;
 v_focus public.od_verified_focus%rowtype;
 v_ad public.od_verified_ad_events%rowtype;
 v_new_pieces integer;
 v_new_tickets integer;
begin
 if p_user_id is null or p_session_id is null or p_event_id is null or length(trim(p_event_id))=0 then
   raise exception using errcode='22023',message='invalid_request';
 end if;
 -- Lock wallet first to serialize all rewards and travel draws.
 select * into v_wallet from public.od_wallets where user_id=p_user_id for update;
 if not found then raise exception using errcode='P0001',message='wallet_not_initialized'; end if;
 -- Identical retry: return wallet without spending/adding again.
 select * into v_claim from public.od_reward_claims
 where user_id=p_user_id and focus_session_id=p_session_id;
 if found then
   if v_claim.provider_event_id is distinct from p_event_id then
     raise exception using errcode='22023',message='session_already_claimed';
   end if;
   return jsonb_build_object('replayed',true,'pieces',v_wallet.pieces,'tickets',v_wallet.tickets);
 end if;
 select * into v_focus from public.od_verified_focus
 where session_id=p_session_id and user_id=p_user_id;
 if not found then raise exception using errcode='P0001',message='focus_not_verified';end if;
 select * into v_ad from public.od_verified_ad_events
 where event_id=p_event_id and session_id=p_session_id and user_id=p_user_id;
 if not found then raise exception using errcode='P0001',message='ad_not_verified';end if;
 -- Unique constraints on event ID and session prevent cross-account event reuse.
 insert into public.od_reward_claims(user_id,focus_session_id,provider_event_id,reward_kind)
 values(p_user_id,p_session_id,p_event_id,'verified_ad');
 v_new_pieces:= (v_wallet.pieces+1)%10;
 v_new_tickets:=v_wallet.tickets+case when v_wallet.pieces=9 then 1 else 0 end;
 update public.od_wallets set pieces=v_new_pieces,tickets=v_new_tickets,updated_at=now()
 where user_id=p_user_id;
 return jsonb_build_object('replayed',false,'pieces',v_new_pieces,'tickets',v_new_tickets,
 'ticket_awarded',(v_wallet.pieces=9));
end;
$body$;
revoke all on function public.od_server_claim_verified_puzzle(uuid,uuid,text)
 from PUBLIC,anon,authenticated;
grant execute on function public.od_server_claim_verified_puzzle(uuid,uuid,text) to service_role;
commit;
-- Not production-ready until actual trusted focus measurement + ad provider
-- signature verification / anti-replay ingestion exists. A client must never
-- INSERT into od_verified_* or directly call this RPC.
