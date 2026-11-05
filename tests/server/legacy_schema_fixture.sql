-- Representative LEGACY schema fixture for disposable GitHub Actions PostgreSQL.
-- This mirrors table names and selected column types observed READ-ONLY on 2026-11-05.
-- It is NOT a dump of production data, and is never executed on Supabase.
create table public.rooms (
 id text primary key, name text not null, kind text not null,
 capacity integer not null, created_at timestamptz not null default now()
);
create table public.seats (
 id text primary key, room_id text not null references public.rooms(id),
 seat_number integer not null, x numeric not null, y numeric not null
);
create table public.room_instances (
 id uuid primary key, template_room_id text not null references public.rooms(id),
 instance_no integer not null, name text not null, capacity integer not null,
 is_open boolean not null, created_at timestamptz not null default now()
);
create table public.instance_seats (
 id uuid primary key, room_instance_id uuid not null references public.room_instances(id),
 seat_number integer not null, x numeric not null, y numeric not null
);
create table public.focus_sessions (
 id uuid primary key, user_id uuid not null references auth.users(id),
 room_id text not null references public.rooms(id), started_at timestamptz not null,
 finished_at timestamptz, planned_minutes integer
);
create table public.personal_focus_sessions (
 id uuid primary key, user_id uuid not null references auth.users(id),
 started_at timestamptz not null, finished_at timestamptz, planned_minutes integer
);
-- Constraints and indexes mirrored from actual public metadata, read-only inspected on 2026-11-05.
alter table public.rooms
 add constraint rooms_kind_check check (kind in ('cafe','study')),
 add constraint rooms_capacity_check check (capacity between 1 and 100);
alter table public.seats
 add constraint seats_seat_number_check check (seat_number > 0),
 add constraint seats_room_id_seat_number_key unique(room_id,seat_number);
alter table public.room_instances
 add constraint room_instances_capacity_check check (capacity between 1 and 100),
 add constraint room_instances_instance_no_check check (instance_no > 0),
 add constraint room_instances_id_template_room_id_key unique(id,template_room_id),
 add constraint room_instances_template_room_id_instance_no_key unique(template_room_id,instance_no);
alter table public.instance_seats
 add constraint instance_seats_seat_number_check check (seat_number > 0),
 add constraint instance_seats_room_instance_id_seat_number_key unique(room_instance_id,seat_number);
alter table public.focus_sessions
 add constraint focus_sessions_check check (finished_at is null or finished_at >= started_at),
 add constraint focus_sessions_planned_minutes_check check (planned_minutes between 1 and 240);
alter table public.personal_focus_sessions
 add constraint personal_focus_sessions_check check (finished_at is null or finished_at >= started_at),
 add constraint personal_focus_sessions_planned_minutes_check check (planned_minutes between 1 and 240);
create index focus_sessions_user_started_idx on public.focus_sessions(user_id,started_at desc);
create index personal_focus_sessions_user_started_idx on public.personal_focus_sessions(user_id,started_at desc);
alter table public.rooms enable row level security;
alter table public.seats enable row level security;
alter table public.room_instances enable row level security;
alter table public.instance_seats enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.personal_focus_sessions enable row level security;
create policy "rooms are public read only" on public.rooms for select to anon,authenticated using (true);
create policy "seats are public read only" on public.seats for select to anon,authenticated using (true);
create policy "public read room instances" on public.room_instances for select to anon,authenticated using (is_open = true);
create policy "public read instance seats" on public.instance_seats for select to anon,authenticated
 using (exists (select 1 from public.room_instances ri where ri.id = room_instance_id and ri.is_open));
create policy "read own focus sessions" on public.focus_sessions for select to authenticated using (auth.uid()=user_id);
create policy "read own personal sessions" on public.personal_focus_sessions for select to authenticated using (auth.uid()=user_id);
insert into public.rooms(id,name,kind,capacity) values('legacy-room-1','Legacy room','study',8);
insert into public.seats(id,room_id,seat_number,x,y) values('legacy-seat-1','legacy-room-1',1,0.3,0.5);
insert into public.room_instances(id,template_room_id,instance_no,name,capacity,is_open)
 values('11111111-1111-4111-8111-111111111111','legacy-room-1',1,'Legacy room instance',8,true);
insert into public.instance_seats(id,room_instance_id,seat_number,x,y)
 values('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111',1,0.3,0.5);
insert into auth.users(id) values('33333333-3333-4333-8333-333333333333');
insert into public.focus_sessions(id,user_id,room_id,started_at,planned_minutes)
 values('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333','legacy-room-1',now(),25);
insert into public.personal_focus_sessions(id,user_id,started_at,planned_minutes)
 values('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333',now(),50);
