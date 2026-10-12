import { getStore, rankSessions } from './_store.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const store = getStore();
  const view = req.query?.view || 'overall';
  const ranked = rankSessions(store.sessions || []);

  if (view === 'today') {
    const todayStr = new Date().toDateString();
    const filtered = ranked.filter(s => new Date(s.createdAt).toDateString() === todayStr);
    return res.status(200).json({ ok: true, leaderboard: filtered });
  } else if (view === 'personal_bests') {
    const bestMap = new Map();
    ranked.forEach(s => {
      const key = s.normalizedPlayerName || (s.playerName || '').trim().toLowerCase();
      if (!bestMap.has(key)) {
        bestMap.set(key, s);
      }
    });
    return res.status(200).json({ ok: true, leaderboard: rankSessions(Array.from(bestMap.values())) });
  }

  return res.status(200).json({ ok: true, leaderboard: ranked });
}
