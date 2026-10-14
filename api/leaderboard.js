import { getStore, getAuthoritativeLeaderboard } from './_store.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const view = (req.query?.view || 'overall').toLowerCase();
  const search = req.query?.search || req.query?.player || '';

  const leaderboard = await getAuthoritativeLeaderboard(view, search);
  const store = await getStore();

  const totalSessions = (store.sessions || []).length;
  const uniquePlayers = new Set((store.sessions || []).map(s => s.normalizedPlayerName || s.playerName)).size;

  return res.status(200).json({
    ok: true,
    view,
    totalSessions,
    totalPlayers: uniquePlayers,
    revision: store.revision || 1,
    leaderboard,
    timestamp: new Date().toISOString()
  });
}
