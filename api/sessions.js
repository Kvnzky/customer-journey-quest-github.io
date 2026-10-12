import { getStore, saveStore } from './_store.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const store = getStore();

  if (req.method === 'POST') {
    const body = req.body || {};
    const incoming = Array.isArray(body.sessions) ? body.sessions : (body.session ? [body.session] : []);
    if (incoming.length === 0) {
      return res.status(200).json({ ok: true, savedCount: 0 });
    }

    const existingIds = new Set((store.sessions || []).map(s => s.id));
    let addedCount = 0;
    incoming.forEach(sess => {
      if (sess && sess.id && !existingIds.has(sess.id)) {
        store.sessions.push(sess);
        existingIds.add(sess.id);
        addedCount++;
      }
    });

    if (addedCount > 0) {
      saveStore(store);
    }

    return res.status(200).json({
      ok: true,
      savedCount: addedCount,
      totalSessions: store.sessions.length
    });
  }

  return res.status(200).json({
    ok: true,
    sessions: store.sessions || []
  });
}
