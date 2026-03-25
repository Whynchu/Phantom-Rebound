const LEADERBOARD_REMOTE_CONFIG = {
  url: 'https://rxeaizrnfbawrlnfveer.supabase.co',
  publishableKey: 'sb_publishable_FHqBPGMvSa859vZASkzOzg_Zpp2GRcm',
};

function hasRemoteLeaderboardConfig(config = LEADERBOARD_REMOTE_CONFIG) {
  return Boolean(config.url && config.publishableKey);
}

export { LEADERBOARD_REMOTE_CONFIG, hasRemoteLeaderboardConfig };
