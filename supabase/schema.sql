-- Imposter Football — Supabase schema
-- Run this in the Supabase SQL editor

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_id text not null,
  status text not null default 'lobby',
  round int not null default 1,
  player_count int not null default 0,
  created_at timestamptz default now()
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  name text not null,
  is_imposter boolean default false,
  word text default '',
  has_voted boolean default false
);

create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  voter_id uuid references players(id) on delete cascade,
  target_id uuid references players(id) on delete cascade,
  round int not null
);

-- Row Level Security (permissive for game use)
alter table rooms enable row level security;
alter table players enable row level security;
alter table votes enable row level security;

create policy "Public rooms" on rooms for all using (true) with check (true);
create policy "Public players" on players for all using (true) with check (true);
create policy "Public votes" on votes for all using (true) with check (true);

-- Enable realtime for all tables
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table votes;
