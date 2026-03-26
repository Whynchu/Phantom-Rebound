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

create index if not exists leaderboard_scores_score_idx
  on public.leaderboard_scores (game_version, score desc, created_at desc);

create index if not exists leaderboard_scores_created_idx
  on public.leaderboard_scores (game_version, created_at desc);

create index if not exists leaderboard_scores_name_idx
  on public.leaderboard_scores (game_version, player_name, created_at desc);

alter table public.leaderboard_scores enable row level security;

revoke all on public.leaderboard_scores from anon, authenticated;

drop function if exists public.submit_score(text, integer, integer, text);
create or replace function public.submit_score(
  p_player_name text,
  p_score integer,
  p_room integer,
  p_game_version text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_version text;
begin
  v_name := upper(trim(coalesce(p_player_name, '')));
  v_version := trim(coalesce(p_game_version, ''));

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

  insert into public.leaderboard_scores (player_name, score, room, game_version)
  values (v_name, p_score, p_room, v_version);

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
  created_at timestamptz
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
      ls.created_at
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
    filtered.created_at
  from filtered
  order by filtered.score desc, filtered.created_at desc
  limit greatest(1, least(coalesce(p_limit, 10), 25));
$$;

grant execute on function public.submit_score(text, integer, integer, text) to anon, authenticated;
grant execute on function public.get_leaderboard(text, text, text, text, integer) to anon, authenticated;
