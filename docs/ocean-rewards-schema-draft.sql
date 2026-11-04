-- Ocean Desk 2.0 rewards schema DRAFT (NOT applied to the live database)
-- Review in a staging project before migrating. No client-side writes to balances or inventory.
-- Existing focus_sessions, personal_focus_sessions, rooms and seats are untouched.
begin;

create table if not exists public.od_regions (
 id text primary key,
 name_ko text not null,
 sort_order integer not null default 0
);
create table if not exists public.od_environments (
 id text primary key,
 region_id text not null references public.od_regions(id),
 name_ko text not null,
 tier text not null check (tier in ('basic','rare','special')),
 weight integer not null default 1 check (weight > 0),
 is_default boolean not null default false,
 is_active boolean not null default true,
 sort_order integer not null default 0
);
create table if not exists public.od_wallets (
 user_id uuid primary key references auth.users(id) on delete cascade,
 pieces integer not null default 0 check (pieces between 0 and 9),
 tickets integer not null default 0 check (tickets >= 0),
 updated_at timestamptz not null default now()
);
create table if not exists public.od_owned_environments (
 user_id uuid not null references auth.users(id) on delete cascade,
 environment_id text not null references public.od_environments(id),
 acquired_at timestamptz not null default now(),
 primary key (user_id, environment_id)
);
create table if not exists public.od_reward_claims (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 focus_session_id uuid not null,
 provider_event_id text,
 reward_kind text not null default 'test' check (reward_kind in ('test','verified_ad')),
 granted_at timestamptz not null default now(),
 unique(user_id, focus_session_id),
 unique(provider_event_id)
);
create table if not exists public.od_travel_draws (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 region_id text not null references public.od_regions(id),
 environment_id text not null references public.od_environments(id),
 created_at timestamptz not null default now(),
 unique(user_id, request_id)
);

create index if not exists od_env_region_idx on public.od_environments(region_id);
create index if not exists od_reward_user_idx on public.od_reward_claims(user_id, granted_at desc);
create index if not exists od_draw_user_idx on public.od_travel_draws(user_id, created_at desc);

alter table public.od_regions enable row level security;
alter table public.od_environments enable row level security;
alter table public.od_wallets enable row level security;
alter table public.od_owned_environments enable row level security;
alter table public.od_reward_claims enable row level security;
alter table public.od_travel_draws enable row level security;

-- Catalog: readable only, managed by server/admin.
create policy "od_regions_read" on public.od_regions for select to authenticated using (true);
create policy "od_environments_read" on public.od_environments for select to authenticated using (true);

-- Player data: read-own only. Do NOT grant authenticated INSERT/UPDATE/DELETE.
create policy "od_wallets_read_own" on public.od_wallets for select to authenticated using ((select auth.uid())=user_id);
create policy "od_owned_read_own" on public.od_owned_environments for select to authenticated using ((select auth.uid())=user_id);
create policy "od_claims_read_own" on public.od_reward_claims for select to authenticated using ((select auth.uid())=user_id);
create policy "od_draws_read_own" on public.od_travel_draws for select to authenticated using ((select auth.uid())=user_id);

revoke all on table public.od_regions, public.od_environments,
 public.od_wallets, public.od_owned_environments,
 public.od_reward_claims, public.od_travel_draws from anon, authenticated;
grant select on table public.od_regions, public.od_environments,
 public.od_wallets, public.od_owned_environments,
 public.od_reward_claims, public.od_travel_draws to authenticated;

insert into public.od_regions(id,name_ko,sort_order) values
('bali','발리',1),('jeju','제주',2),('santorini','산토리니',3)
on conflict(id) do nothing;

insert into public.od_environments(id,region_id,name_ko,tier,weight,is_default,sort_order) values
('bali-ocean-cafe','bali','발리 오션카페','basic',1,true,1),
('bali-sunset','bali','발리 선셋룸','rare',1,false,2),
('bali-forest','bali','발리 레인포레스트 카페','special',1,false,3),
('jeju-coast','jeju','제주 해안카페','basic',1,false,1),
('jeju-forest','jeju','제주 숲속서재','rare',1,false,2),
('jeju-rain','jeju','제주 레인카페','special',1,false,3),
('santorini-terrace','santorini','산토리니 오션테라스','basic',1,true,1),
('santorini-sunset','santorini','산토리니 선셋카페','rare',1,false,2),
('santorini-night','santorini','산토리니 나이트룸','special',1,false,3)
on conflict(id) do nothing;
commit;

-- IMPLEMENTATION NOTE:
-- Reward claim and travel draw must execute as authenticated server-side transactions,
-- with verified session/ad evidence and idempotency keys. Do not expose a callable
-- SECURITY DEFINER function or service_role secret to the browser.
-- In MVP test mode, existing localStorage rewards remain demo-only and never synchronize
-- to this schema without server verification.
