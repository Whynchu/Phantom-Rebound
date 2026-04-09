-- Phantom Rebound Leaderboard Schema
-- Updated for Phase 7: Player Color Customization (v1.14.0+)
--
-- This schema now supports:
-- - 8 player color themes (green, blue, purple, pink, gold, red, cyan, orange)
-- - Boon selection order tracking (stored as CSV in boon_order column)
-- - Enhanced boons structure: {picks: [], color: 'color_name', order: 'csv', telemetry: {...}}
-- - Backwards compatibility with legacy boon arrays
--
-- New columns:
--   player_color TEXT - The color theme chosen by the player (default: 'green')
--   boon_order TEXT - CSV of boon names selected in order (for UI display)
-- 
-- Updated boons structure (v1.14.0+):
--   Legacy (still supported): boons = [boon1, boon2, boon3]
--   New format: boons = {picks: [boon1, boon2, ...], color: 'blue', order: 'Rapid Fire,Shield Burst,...', telemetry: {...}}
--   Telemetry payload (v1.16.18+): compact run analytics nested under boons.telemetry
--     - summary: total healing/charge by source, total HP lost, safety proc totals
--     - snapshots: periodic build-state checkpoints
--     - rooms: per-room pressure, sustain, damage taken, and clear-time records
--
-- Diagnostic payloads (v1.16.24+):
--   Crash/freeze diagnostics are stored in run_diagnostics instead of leaderboard_scores
--   so unfinished runs cannot be banked as leaderboard entries.

create extension if not exists pgcrypto;

create table if not exists public.leaderboard_scores (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  score integer not null,
  room integer not null,
  game_version text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint leaderboard_scores_name_check check (
    player_name ~ '^[A-Z0-9 _-]{1,14}$'
  ),
  constraint leaderboard_scores_score_check check (
    score >= 0 and score <= 100000000
  ),
  constraint leaderboard_scores_room_check check (
    room >= 1 and room <= 9999
  ),
  constraint leaderboard_scores_version_check check (
    char_length(game_version) between 1 and 24
  )
);

alter table public.leaderboard_scores
  add column if not exists boons jsonb default null;

alter table public.leaderboard_scores
  add column if not exists player_color text default 'green' check (player_color in ('green', 'blue', 'purple', 'pink', 'gold', 'red', 'cyan', 'orange'));

alter table public.leaderboard_scores
  add column if not exists boon_order text default null;

create index if not exists leaderboard_scores_score_idx
  on public.leaderboard_scores (game_version, score desc, created_at desc);

create index if not exists leaderboard_scores_created_idx
  on public.leaderboard_scores (game_version, created_at desc);

create index if not exists leaderboard_scores_name_idx
  on public.leaderboard_scores (game_version, player_name, created_at desc);

create index if not exists leaderboard_scores_color_idx
  on public.leaderboard_scores (game_version, player_color, score desc);

create table if not exists public.run_diagnostics (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  score integer not null,
  room integer not null,
  game_version text not null,
  player_color text default 'green' check (player_color in ('green', 'blue', 'purple', 'pink', 'gold', 'red', 'cyan', 'orange')),
  report jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint run_diagnostics_name_check check (
    player_name ~ '^[A-Z0-9 _-]{1,14}$'
  ),
  constraint run_diagnostics_score_check check (
    score >= 0 and score <= 100000000
  ),
  constraint run_diagnostics_room_check check (
    room >= 1 and room <= 9999
  ),
  constraint run_diagnostics_version_check check (
    char_length(game_version) between 1 and 24
  )
);

create index if not exists run_diagnostics_created_idx
  on public.run_diagnostics (game_version, created_at desc);

create index if not exists run_diagnostics_room_idx
  on public.run_diagnostics (game_version, room desc, created_at desc);

alter table public.leaderboard_scores enable row level security;
alter table public.run_diagnostics enable row level security;

revoke all on public.leaderboard_scores from anon, authenticated;
revoke all on public.run_diagnostics from anon, authenticated;

drop function if exists public.submit_score(text, integer, integer, text);
drop function if exists public.submit_score(text, integer, integer, text, jsonb);
drop function if exists public.submit_score(text, integer, integer, text, jsonb, text);
create or replace function public.submit_score(
  p_player_name text,
  p_score integer,
  p_room integer,
  p_game_version text,
  p_boons jsonb default null,
  p_player_color text default 'green'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_version text;
  v_color text;
  v_boon_order text;
begin
  v_name := upper(trim(coalesce(p_player_name, '')));
  v_version := trim(coalesce(p_game_version, ''));
  v_color := coalesce(p_player_color, 'green');

  if v_name !~ '^[A-Z0-9 _-]{1,14}$' then
    raise exception 'invalid player_name';
  end if;

  if p_score is null or p_score < 0 or p_score > 100000000 then
    raise exception 'invalid score';
  end if;

  if p_room is null or p_room < 1 or p_room > 9999 then
    raise exception 'invalid room';
  end if;

  if char_length(v_version) < 1 or char_length(v_version) > 24 then
    raise exception 'invalid game_version';
  end if;

  -- Validate player_color (only 8 valid options)
  if v_color not in ('green', 'blue', 'purple', 'pink', 'gold', 'red', 'cyan', 'orange') then
    v_color := 'green';
  end if;

  if p_boons is not null then
    -- Support both legacy array and new object format
    if jsonb_typeof(p_boons) = 'array' then
      -- Legacy format: just array of boons, ignore for validation
      null;
    elsif jsonb_typeof(p_boons) = 'object' then
      -- New format: {picks: [...], color: '...', order: '...', telemetry: {...}}
      if (p_boons->>'picks') is null then
        raise exception 'invalid boons: missing picks field';
      end if;
      -- Extract order for indexing
      v_boon_order := (p_boons->>'order');
    else
      raise exception 'invalid boons: must be array or object';
    end if;
  end if;

  insert into public.leaderboard_scores (player_name, score, room, game_version, boons, player_color, boon_order)
  values (v_name, p_score, p_room, v_version, p_boons, v_color, v_boon_order);

  return jsonb_build_object('ok', true);
end;
$$;

drop function if exists public.submit_run_diagnostic(text, integer, integer, text, jsonb, text);
create or replace function public.submit_run_diagnostic(
  p_player_name text,
  p_score integer,
  p_room integer,
  p_game_version text,
  p_report jsonb,
  p_player_color text default 'green'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_version text;
  v_color text;
begin
  v_name := upper(trim(coalesce(p_player_name, '')));
  v_version := trim(coalesce(p_game_version, ''));
  v_color := coalesce(p_player_color, 'green');

  if v_name !~ '^[A-Z0-9 _-]{1,14}$' then
    raise exception 'invalid player_name';
  end if;

  if p_score is null or p_score < 0 or p_score > 100000000 then
    raise exception 'invalid score';
  end if;

  if p_room is null or p_room < 1 or p_room > 9999 then
    raise exception 'invalid room';
  end if;

  if char_length(v_version) < 1 or char_length(v_version) > 24 then
    raise exception 'invalid game_version';
  end if;

  if v_color not in ('green', 'blue', 'purple', 'pink', 'gold', 'red', 'cyan', 'orange') then
    v_color := 'green';
  end if;

  if p_report is null or jsonb_typeof(p_report) <> 'object' then
    raise exception 'invalid report';
  end if;

  insert into public.run_diagnostics (player_name, score, room, game_version, player_color, report)
  values (v_name, p_score, p_room, v_version, v_color, p_report);

  return jsonb_build_object('ok', true);
end;
$$;

drop function if exists public.get_leaderboard(text, text, text, integer);
drop function if exists public.get_leaderboard(text, text, text, text, integer);
create or replace function public.get_leaderboard(
  p_period text default 'daily',
  p_scope text default 'everyone',
  p_player_name text default 'RUNNER',
  p_game_version text default '',
  p_limit integer default 10
)
returns table (
  player_name text,
  score integer,
  room integer,
  created_at timestamptz,
  boons jsonb,
  player_color text,
  boon_order text
)
language sql
security definer
set search_path = public
as $$
  with filtered as (
    select
      ls.player_name,
      ls.score,
      ls.room,
      ls.created_at,
      ls.boons,
      coalesce(ls.player_color, 'green') as player_color,
      ls.boon_order
    from public.leaderboard_scores ls
    where
      ls.game_version = trim(coalesce(p_game_version, ''))
      and (coalesce(p_period, 'daily') <> 'daily' or ls.created_at >= date_trunc('day', now()))
      and (
        coalesce(p_scope, 'everyone') <> 'personal'
        or ls.player_name = upper(trim(coalesce(p_player_name, 'RUNNER')))
      )
  )
  select
    filtered.player_name,
    filtered.score,
    filtered.room,
    filtered.created_at,
    filtered.boons,
    filtered.player_color,
    filtered.boon_order
  from filtered
  order by filtered.score desc, filtered.created_at desc
  limit greatest(1, least(coalesce(p_limit, 10), 25));
$$;

grant execute on function public.submit_score(text, integer, integer, text, jsonb, text) to anon, authenticated;
grant execute on function public.submit_run_diagnostic(text, integer, integer, text, jsonb, text) to anon, authenticated;
grant execute on function public.get_leaderboard(text, text, text, text, integer) to anon, authenticated;
