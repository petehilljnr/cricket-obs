-- ==========================================================
-- CRICKET SCORING DB (2-Day / Multi-Innings) for Supabase
-- ==========================================================

-- ---------- Extensions ----------
create extension if not exists pgcrypto;

-- ---------- ENUM Types ----------
do $$ begin
  create type match_format as enum ('TWO_DAY','TEST','ODI','T20','CUSTOM');
exception when duplicate_object then null; end $$;

do $$ begin
  create type match_status as enum ('SCHEDULED','LIVE','COMPLETE','ABANDONED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type innings_status as enum ('PENDING','LIVE','COMPLETE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type innings_end_reason as enum (
    'NOT_ENDED',
    'ALL_OUT',
    'DECLARED',
    'TARGET_REACHED',
    'TIME_EXPIRED',
    'OVERS_EXHAUSTED',
    'FORFEITED',
    'ABANDONED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type extra_type as enum ('NONE','WIDE','NO_BALL','BYE','LEG_BYE','PENALTY');
exception when duplicate_object then null; end $$;

do $$ begin
  create type wicket_kind as enum (
    'NONE','BOWLED','CAUGHT','LBW','RUN_OUT','STUMPED','HIT_WICKET',
    'OBSTRUCTING','HIT_BALL_TWICE','TIMED_OUT','RETIRED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type innings_event_type as enum (
    'DECLARE',
    'RETIRE_HURT',
    'RETIRE_OUT',
    'PENALTY_RUNS',
    'INNINGS_FORFEIT',
    'CHANGE_BALL',
    'NOTE'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type session_type as enum ('SESSION', 'BREAK', 'INTERRUPTION');
exception when duplicate_object then null; end $$;

do $$ begin
  create type match_result_type as enum ('HOME_WIN','AWAY_WIN','TIE','DRAW','ABANDONED','NO_RESULT');
exception when duplicate_object then null; end $$;


-- ==========================================================
-- CORE ENTITIES
-- ==========================================================

-- ---------- Teams ----------
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text,
  created_at timestamptz not null default now()
);

-- ---------- Players ----------
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete restrict,
  full_name text not null,
  display_name text,
  shirt_number int,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists players_team_ix on players(team_id);

-- ---------- Matches ----------
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  format match_format not null default 'TWO_DAY',
  venue text,
  start_time timestamptz,
  balls_per_over int not null default 6,
  home_team_id uuid references teams(id),
  away_team_id uuid references teams(id),
  toss_winner_team_id uuid references teams(id),
  toss_decision text check (toss_decision in ('BAT','BOWL')),
  status match_status not null default 'SCHEDULED',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists matches_status_ix on matches(status);

-- ---------- Match rules (configurable per match) ----------
create table if not exists match_rules (
  match_id uuid primary key references matches(id) on delete cascade,
  scheduled_days int not null default 2,
  overs_per_day int,                 -- optional, e.g. 80
  default_max_overs_per_innings int, -- optional default applied when creating innings
  declarations_allowed boolean not null default true,
  allow_retired_hurt boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------- Match teams ----------
create table if not exists match_teams (
  match_id uuid not null references matches(id) on delete cascade,
  team_id uuid not null references teams(id) on delete restrict,
  is_home boolean not null default false,
  is_batting_first boolean,
  primary key (match_id, team_id)
);

-- ---------- Match players (playing XI / squad) ----------
create table if not exists match_players (
  match_id uuid not null references matches(id) on delete cascade,
  player_id uuid not null references players(id) on delete restrict,
  is_playing_xi boolean not null default false,
  batting_order_hint int,
  primary key (match_id, player_id)
);

create index if not exists match_players_match_ix on match_players(match_id);


-- ==========================================================
-- DAY / SESSION / PERIODS (OPTIONAL BUT USEFUL FOR 2-DAY)
-- ==========================================================
create table if not exists match_periods (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  day_no int not null check (day_no >= 1),
  period_no int not null check (period_no >= 1),
  type session_type not null default 'SESSION',
  label text,                 -- "Day 1 - Morning", "Lunch", "Rain"
  start_time timestamptz,
  end_time timestamptz,
  notes text,
  unique (match_id, day_no, period_no)
);

create index if not exists match_periods_match_ix on match_periods(match_id);


-- ==========================================================
-- INNINGS (UP TO 4)
-- ==========================================================
create table if not exists innings (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  innings_no int not null check (innings_no between 1 and 4),
  batting_team_id uuid not null references teams(id) on delete restrict,
  bowling_team_id uuid not null references teams(id) on delete restrict,

  status innings_status not null default 'PENDING',

  max_overs int,        -- variable per match/innings (your requirement)
  target_runs int,      -- if chasing
  is_follow_on boolean not null default false,

  end_reason innings_end_reason not null default 'NOT_ENDED',
  started_at timestamptz,
  ended_at timestamptz,

  created_at timestamptz not null default now(),

  unique (match_id, innings_no),
  check (batting_team_id <> bowling_team_id)
);

create index if not exists innings_match_ix on innings(match_id);
create index if not exists innings_status_ix on innings(status);


-- ==========================================================
-- BALL-BY-BALL DELIVERIES (SOURCE OF TRUTH)
-- ==========================================================
create table if not exists deliveries (
  id uuid primary key default gen_random_uuid(),
  innings_id uuid not null references innings(id) on delete cascade,

  -- Ordering: seq_in_innings should be strictly increasing
  seq_in_innings int not null,
  over_no int not null check (over_no >= 0),
  ball_no int not null check (ball_no >= 1),

  -- Optional day/session context
  match_day_no int check (match_day_no >= 1),
  period_id uuid references match_periods(id) on delete set null,

  striker_id uuid not null references players(id) on delete restrict,
  non_striker_id uuid not null references players(id) on delete restrict,
  bowler_id uuid not null references players(id) on delete restrict,

  runs_off_bat int not null default 0 check (runs_off_bat >= 0 and runs_off_bat <= 7),
  extras_type extra_type not null default 'NONE',
  extras_runs int not null default 0 check (extras_runs >= 0 and extras_runs <= 10),
  is_legal boolean not null default true, -- false for wides/no-balls

  wicket wicket_kind not null default 'NONE',
  player_out_id uuid references players(id) on delete restrict,
  fielder_id uuid references players(id) on delete restrict,

  -- Recommended: store post-delivery striker state (overlay reliability)
  next_striker_id uuid references players(id) on delete restrict,
  next_non_striker_id uuid references players(id) on delete restrict,

  commentary text,

  created_at timestamptz not null default now(),
  -- created_by uuid references auth.users(id), -- Optional in Supabase
  is_active boolean not null default true,

  -- Integrity checks
  check (striker_id <> non_striker_id),
  check (bowler_id <> striker_id and bowler_id <> non_striker_id),
  check (
    (wicket = 'NONE' and player_out_id is null)
    or (wicket <> 'NONE' and player_out_id is not null)
  ),
  check (
    (extras_type = 'NONE' and extras_runs = 0)
    or (extras_type <> 'NONE' and extras_runs >= 1)
  ),
  check (not (extras_type in ('WIDE','NO_BALL') and is_legal = true))
);

create unique index if not exists deliveries_innings_seq_uq
  on deliveries(innings_id, seq_in_innings);

create index if not exists deliveries_innings_order_ix
  on deliveries(innings_id, over_no, ball_no, seq_in_innings);

create index if not exists deliveries_active_innings_ix
  on deliveries(innings_id)
  where is_active = true;


-- ==========================================================
-- INNINGS EVENTS (DECLARATIONS, PENALTY RUNS, RETIREMENTS, NOTES)
-- ==========================================================
create table if not exists innings_events (
  id uuid primary key default gen_random_uuid(),
  innings_id uuid not null references innings(id) on delete cascade,
  seq_in_innings int not null,        -- place it in the timeline
  type innings_event_type not null,
  player_id uuid references players(id) on delete restrict,
  runs int check (runs is null or runs >= 0),
  notes text,
  created_at timestamptz not null default now(),
  is_active boolean not null default true
);

create unique index if not exists innings_events_seq_uq
  on innings_events(innings_id, seq_in_innings);

create index if not exists innings_events_innings_ix
  on innings_events(innings_id)
  where is_active = true;


-- ==========================================================
-- RESULT (DRAWS COMMON IN 2-DAY)
-- ==========================================================
create table if not exists match_result (
  match_id uuid primary key references matches(id) on delete cascade,
  result match_result_type,
  winner_team_id uuid references teams(id) on delete set null,
  margin_runs int,
  margin_wickets int,
  notes text,
  decided_at timestamptz
);


-- ==========================================================
-- DERIVED "LIVE" STATE TABLE FOR FAST OVERLAY QUERIES
-- ==========================================================
create table if not exists live_innings_state (
  innings_id uuid primary key references innings(id) on delete cascade,
  runs int not null default 0,
  wickets int not null default 0,
  legal_balls int not null default 0,

  striker_id uuid references players(id) on delete set null,
  non_striker_id uuid references players(id) on delete set null,
  current_bowler_id uuid references players(id) on delete set null,

  last_delivery_id uuid references deliveries(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists live_innings_state_updated_ix
  on live_innings_state(updated_at desc);


-- ==========================================================
-- HELPER FUNCTIONS FOR STATS
-- ==========================================================

-- Wickets credited to bowler (exclude RUN_OUT, RETIRED)
create or replace function is_bowler_wicket(w wicket_kind)
returns boolean language sql immutable as $$
  select w in ('BOWLED','CAUGHT','LBW','STUMPED','HIT_WICKET','OBSTRUCTING','HIT_BALL_TWICE','TIMED_OUT');
$$;

-- Runs charged to bowler: include off bat + wides + no-balls, exclude byes/leg byes
create or replace function bowler_runs_conceded(runs_off_bat int, et extra_type, er int)
returns int language sql immutable as $$
  select
    runs_off_bat
    + case when et in ('WIDE','NO_BALL') then er else 0 end;
$$;


-- ==========================================================
-- RECOMPUTE LIVE INNINGS STATE (SIMPLE + RELIABLE)
-- ==========================================================
create or replace function recompute_live_innings_state(p_innings uuid)
returns void language plpgsql as $$
declare
  v_last deliveries%rowtype;
begin
  -- find last active delivery
  select *
  into v_last
  from deliveries
  where innings_id = p_innings and is_active = true
  order by seq_in_innings desc
  limit 1;

  insert into live_innings_state (
    innings_id, runs, wickets, legal_balls,
    striker_id, non_striker_id, current_bowler_id,
    last_delivery_id, updated_at
  )
  select
    p_innings,
    coalesce(sum(d.runs_off_bat + d.extras_runs), 0) as runs,
    coalesce(sum(case when d.wicket <> 'NONE' then 1 else 0 end), 0) as wickets,
    coalesce(sum(case when d.is_legal then 1 else 0 end), 0) as legal_balls,
    -- Prefer post-delivery striker state if present, else use current delivery state
    coalesce(v_last.next_striker_id, v_last.striker_id),
    coalesce(v_last.next_non_striker_id, v_last.non_striker_id),
    v_last.bowler_id,
    v_last.id,
    now()
  from deliveries d
  where d.innings_id = p_innings and d.is_active = true
  on conflict (innings_id) do update
    set runs = excluded.runs,
        wickets = excluded.wickets,
        legal_balls = excluded.legal_balls,
        striker_id = excluded.striker_id,
        non_striker_id = excluded.non_striker_id,
        current_bowler_id = excluded.current_bowler_id,
        last_delivery_id = excluded.last_delivery_id,
        updated_at = excluded.updated_at;
end $$;

create or replace function deliveries_after_change()
returns trigger language plpgsql as $$
declare
  v_innings uuid;
begin
  v_innings := coalesce(new.innings_id, old.innings_id);
  perform recompute_live_innings_state(v_innings);
  return null;
end $$;

drop trigger if exists deliveries_recompute_state_trg on deliveries;

create trigger deliveries_recompute_state_trg
after insert or update or delete on deliveries
for each row execute function deliveries_after_change();


-- ==========================================================
-- VIEWS (SCORER UI + OVERLAY)
-- ==========================================================

-- 1) Innings totals (deliveries only)
create or replace view v_innings_score as
select
  innings_id,
  sum(runs_off_bat + extras_runs) as runs,
  sum(case when wicket <> 'NONE' then 1 else 0 end) as wickets,
  sum(case when is_legal then 1 else 0 end) as legal_balls
from deliveries
where is_active = true
group by innings_id;

-- 2) Overs display based on match balls_per_over
create or replace view v_innings_overs as
select
  i.id as innings_id,
  m.balls_per_over,
  s.legal_balls,
  (s.legal_balls / m.balls_per_over) as completed_overs,
  (s.legal_balls % m.balls_per_over) as balls_into_over,
  ((s.legal_balls / m.balls_per_over)::text || '.' || (s.legal_balls % m.balls_per_over)::text) as overs_display
from innings i
join matches m on m.id = i.match_id
left join v_innings_score s on s.innings_id = i.id;

-- 3) Batting card per innings
create or replace view v_batting_card as
select
  d.innings_id,
  p.id as player_id,
  coalesce(p.display_name, p.full_name) as batter_name,
  sum(d.runs_off_bat) as runs,
  count(*) filter (
    where d.striker_id = p.id
      and d.extras_type <> 'WIDE'
      and d.is_active = true
  ) as balls,
  count(*) filter (where d.striker_id = p.id and d.runs_off_bat = 4 and d.is_active = true) as fours,
  count(*) filter (where d.striker_id = p.id and d.runs_off_bat = 6 and d.is_active = true) as sixes,
  round(
    case when count(*) filter (where d.striker_id = p.id and d.extras_type <> 'WIDE' and d.is_active = true) = 0
      then 0
      else 100.0 * sum(d.runs_off_bat)::numeric
           / count(*) filter (where d.striker_id = p.id and d.extras_type <> 'WIDE' and d.is_active = true)
    end
  , 2) as strike_rate
from deliveries d
join players p
  on p.id in (d.striker_id, d.non_striker_id)
where d.is_active = true
group by d.innings_id, p.id, batter_name;

-- 4) Bowling figures per innings
create or replace view v_bowling_figures as
select
  d.innings_id,
  b.id as bowler_id,
  coalesce(b.display_name, b.full_name) as bowler_name,

  sum(case when d.is_legal then 1 else 0 end) as legal_balls,
  (sum(case when d.is_legal then 1 else 0 end) / m.balls_per_over) as overs_int,
  (sum(case when d.is_legal then 1 else 0 end) % m.balls_per_over) as balls_int,
  ((sum(case when d.is_legal then 1 else 0 end) / m.balls_per_over)::text
    || '.' ||
    (sum(case when d.is_legal then 1 else 0 end) % m.balls_per_over)::text) as overs_display,

  sum(bowler_runs_conceded(d.runs_off_bat, d.extras_type, d.extras_runs)) as runs_conceded,

  sum(case when is_bowler_wicket(d.wicket) then 1 else 0 end) as wickets,

  count(*) filter (where d.extras_type = 'WIDE') as wides,
  count(*) filter (where d.extras_type = 'NO_BALL') as no_balls,

  round(
    case when sum(case when d.is_legal then 1 else 0 end) = 0
      then 0
      else (sum(bowler_runs_conceded(d.runs_off_bat, d.extras_type, d.extras_runs))::numeric
            / (sum(case when d.is_legal then 1 else 0 end)::numeric / m.balls_per_over))
    end
  , 2) as economy
from deliveries d
join innings i on i.id = d.innings_id
join matches m on m.id = i.match_id
join players b on b.id = d.bowler_id
where d.is_active = true
group by d.innings_id, b.id, bowler_name, m.balls_per_over;

-- 5) Fall of wickets (basic)
create or replace view v_fall_of_wickets as
select
  d.innings_id,
  d.seq_in_innings,
  d.over_no,
  d.ball_no,
  (select sum(d2.runs_off_bat + d2.extras_runs)
     from deliveries d2
     where d2.innings_id = d.innings_id
       and d2.is_active = true
       and d2.seq_in_innings <= d.seq_in_innings
  ) as score_at_wicket,
  d.wicket,
  d.player_out_id
from deliveries d
where d.is_active = true
  and d.wicket <> 'NONE';

-- 6) Last N balls (change 12 -> whatever you want)
create or replace view v_last_12_balls as
select x.*
from (
  select d.*,
         row_number() over (partition by innings_id order by seq_in_innings desc) as rn
  from deliveries d
  where is_active = true
) x
where x.rn <= 12;

-- 7) Basic OBS overlay view (single-row-per-innings state)
create or replace view v_obs_overlay as
select
  i.match_id,
  i.id as innings_id,
  i.innings_no,
  bt.short_name as batting_team,
  bowl.short_name as bowling_team,

  ls.runs,
  ls.wickets,
  o.overs_display,

  -- Batters on screen
  s_bat.id as striker_id,
  coalesce(s_bat.display_name, s_bat.full_name) as striker_name,
  ns_bat.id as non_striker_id,
  coalesce(ns_bat.display_name, ns_bat.full_name) as non_striker_name,

  -- Bowler on screen
  bw.id as bowler_id,
  coalesce(bw.display_name, bw.full_name) as bowler_name,

  -- Innings metadata
  i.status as innings_status,
  i.end_reason,
  i.max_overs,
  i.target_runs,

  -- Last ball quick info
  dlast.over_no as last_over,
  dlast.ball_no as last_ball,
  (dlast.runs_off_bat + dlast.extras_runs) as last_ball_runs,
  dlast.extras_type as last_ball_extras_type,
  dlast.wicket as last_ball_wicket,

  ls.updated_at
from innings i
join teams bt on bt.id = i.batting_team_id
join teams bowl on bowl.id = i.bowling_team_id
left join live_innings_state ls on ls.innings_id = i.id
left join v_innings_overs o on o.innings_id = i.id
left join players s_bat on s_bat.id = ls.striker_id
left join players ns_bat on ns_bat.id = ls.non_striker_id
left join players bw on bw.id = ls.current_bowler_id
left join deliveries dlast on dlast.id = ls.last_delivery_id;


-- ==========================================================
-- OPTIONAL: DEFAULTS WHEN CREATING INNINGS
-- If you create innings rows without max_overs, this can populate
-- from match_rules.default_max_overs_per_innings
-- ==========================================================
create or replace function innings_default_max_overs()
returns trigger language plpgsql as $$
declare
  v_default int;
begin
  if new.max_overs is null then
    select default_max_overs_per_innings into v_default
    from match_rules
    where match_id = new.match_id;

    if v_default is not null then
      new.max_overs := v_default;
    end if;
  end if;

  return new;
end $$;

drop trigger if exists innings_default_max_overs_trg on innings;

create trigger innings_default_max_overs_trg
before insert on innings
for each row execute function innings_default_max_overs();


-- ==========================================================
-- OPTIONAL: RLS PLACEHOLDER (READ-ONLY BY DEFAULT)
-- Supabase projects often enable RLS; these are templates.
-- Uncomment and adjust when you decide auth rules.
-- ==========================================================

-- alter table teams enable row level security;
-- alter table players enable row level security;
-- alter table matches enable row level security;
-- alter table match_rules enable row level security;
-- alter table match_teams enable row level security;
-- alter table match_players enable row level security;
-- alter table innings enable row level security;
-- alter table deliveries enable row level security;
-- alter table innings_events enable row level security;
-- alter table live_innings_state enable row level security;

-- Example public read policy (tighten as needed):
-- create policy "public_read_matches"
-- on matches for select
-- using (true);

-- Example scorer write policy (requires you to implement a scorer check):
-- create policy "scorer_write_deliveries"
-- on deliveries for insert
-- with check (auth.uid() is not null);

-- ==========================================================
-- END
-- ==========================================================