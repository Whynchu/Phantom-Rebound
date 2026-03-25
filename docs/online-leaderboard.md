# Online leaderboard setup

This repo now expects Supabase RPC functions rather than direct table writes.

## What the game calls

- `submit_score(p_player_name, p_score, p_room, p_game_version)`
- `get_leaderboard(p_period, p_scope, p_player_name, p_limit)`

The browser client uses the public Supabase URL and publishable key already wired in `src/data/leaderboardConfig.js`.

## Supabase setup

1. Open the Supabase project SQL editor.
2. Run `supabase/leaderboard.sql`.
3. Confirm both RPC functions exist under Database -> Functions.
4. Open the game and the leaderboard should switch from `LOCAL FALLBACK` to `SUPABASE LIVE` once calls succeed.

## Notes

- The table itself is not opened to `anon`; the client only gets execute rights on the two RPC functions.
- This is still a lightweight trust model. It is appropriate for an indie leaderboard, not for a cheat-proof competitive ladder.
- `personal` currently means "filtered by runner name", not authenticated user identity.

## Next hardening steps

1. Add rate limiting in an Edge Function in front of `submit_score`.
2. Add a run token minted at run start and consumed at run end.
3. Store more telemetry for suspicious-run review.
