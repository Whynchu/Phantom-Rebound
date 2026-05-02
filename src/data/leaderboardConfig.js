const LEADERBOARD_REMOTE_CONFIG = {
  url: 'https://rxeaizrnfbawrlnfveer.supabase.co',
  publishableKey: 'sb_publishable_FHqBPGMvSa859vZASkzOzg_Zpp2GRcm',
};

function getLeaderboardVersionPrefix(version) {
  const raw = String(version || '').trim();
  const parts = raw.split('.');
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0]}.${parts[1]}.`;
  }
  return raw ? `${raw}.` : '';
}

function hasRemoteLeaderboardConfig(config = LEADERBOARD_REMOTE_CONFIG) {
  return Boolean(config.url && config.publishableKey);
}

export { LEADERBOARD_REMOTE_CONFIG, getLeaderboardVersionPrefix, hasRemoteLeaderboardConfig };
