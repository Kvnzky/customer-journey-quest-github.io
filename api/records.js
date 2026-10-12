import { getStore } from './_store.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const store = getStore();
  return res.status(200).json({
    ok: true,
    sessions: store.sessions || [],
    deletedSessionIds: store.deletedSessionIds || [],
    lastResetAt: store.lastResetAt || 0
  });
}
