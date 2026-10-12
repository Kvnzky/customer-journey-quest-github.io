import { getStore, saveStore } from './_store.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const store = getStore();
  const deletedSet = new Set(store.deletedSessionIds || []);
  (store.sessions || []).forEach(s => {
    if (s && s.id) deletedSet.add(s.id);
  });

  store.deletedSessionIds = Array.from(deletedSet);
  store.lastResetAt = Date.now();
  store.sessions = [];
  saveStore(store);

  return res.status(200).json({
    ok: true,
    deletedSessionIds: store.deletedSessionIds,
    lastResetAt: store.lastResetAt,
    message: 'All session records have been cleared.'
  });
}
