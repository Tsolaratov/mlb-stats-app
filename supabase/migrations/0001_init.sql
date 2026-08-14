create extension if not exists pg_trgm;

create table if not exists teams (
  id integer primary key,
  name text not null,
  abbreviation text not null,
  league text,
  division text
);

create table if not exists players (
  id integer primary key,
  full_name text not null,
  primary_position text,
  birth_date date,
  mlb_debut_date date,
  is_active boolean not null default false,
  last_synced_at timestamptz not null default now(),
  history_synced boolean not null default false
);

create index if not exists players_full_name_trgm_idx on players using gin (full_name gin_trgm_ops);
create index if not exists players_is_active_idx on players (is_active);

create table if not exists season_stats (
  player_id integer not null references players(id),
  season integer not null,
  stat_type text not null check (stat_type in ('hitting', 'pitching')),
  team_id integer not null references teams(id),
  games integer,
  avg numeric,
  hr integer,
  rbi integer,
  obp numeric,
  slg numeric,
  ops numeric,
  sb integer,
  so integer,
  wins integer,
  losses integer,
  era numeric,
  whip numeric,
  saves integer,
  innings_pitched numeric,
  primary key (player_id, season, stat_type, team_id)
);

create index if not exists season_stats_season_stat_type_idx on season_stats (season, stat_type);

create table if not exists career_stats (
  player_id integer not null references players(id),
  stat_type text not null check (stat_type in ('hitting', 'pitching')),
  games integer,
  avg numeric,
  hr integer,
  rbi integer,
  obp numeric,
  slg numeric,
  ops numeric,
  sb integer,
  so integer,
  wins integer,
  losses integer,
  era numeric,
  whip numeric,
  saves integer,
  innings_pitched numeric,
  primary key (player_id, stat_type)
);

create table if not exists team_standings (
  team_id integer not null references teams(id),
  season integer not null,
  wins integer not null,
  losses integer not null,
  win_pct numeric not null,
  division_rank integer,
  games_back numeric,
  updated_at timestamptz not null default now(),
  primary key (team_id, season)
);

alter table teams enable row level security;
alter table players enable row level security;
alter table season_stats enable row level security;
alter table career_stats enable row level security;
alter table team_standings enable row level security;

create policy "public read teams" on teams for select using (true);
create policy "public read players" on players for select using (true);
create policy "public read season_stats" on season_stats for select using (true);
create policy "public read career_stats" on career_stats for select using (true);
create policy "public read team_standings" on team_standings for select using (true);
