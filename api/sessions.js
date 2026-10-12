import { getStore, saveStore } from './_store.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const store = getStore();
  const deletedSet = new Set(store.deletedSessionIds || []);

  if (req.method === 'DELETE') {
    const id = req.query?.id || req.body?.sessionId;
    if (id) {
      deletedSet.add(id);
      store.deletedSessionIds = Array.from(deletedSet);
      store.sessions = (store.sessions || []).filter(s => s.id !== id);
      saveStore(store);
    }
    return res.status(200).json({
      ok: true,
      deletedSessionIds: store.deletedSessionIds,
      totalSessions: store.sessions.length
    });
  }

  if (req.method === 'POST') {
    const body = req.body || {};

    // Handle single or bulk session deletion
    if (body.action === 'delete') {
      const idsToDelete = Array.isArray(body.sessionIds)
        ? body.sessionIds
        : body.sessionId
        ? [body.sessionId]
        : [];

      idsToDelete.forEach(id => {
        if (id) deletedSet.add(id);
      });
      if (Array.isArray(body.deletedSessionIds)) {
        body.deletedSessionIds.forEach(id => {
          if (id) deletedSet.add(id);
        });
      }

      store.deletedSessionIds = Array.from(deletedSet);
      store.sessions = (store.sessions || []).filter(s => !deletedSet.has(s.id));
      saveStore(store);

      return res.status(200).json({
        ok: true,
        deletedSessionIds: store.deletedSessionIds,
        totalSessions: store.sessions.length
      });
    }

    // Handle full leaderboard reset / clear
    if (body.action === 'clear') {
      (store.sessions || []).forEach(s => {
        if (s && s.id) deletedSet.add(s.id);
      });
      if (Array.isArray(body.deletedSessionIds)) {
        body.deletedSessionIds.forEach(id => {
          if (id) deletedSet.add(id);
        });
      }
      store.deletedSessionIds = Array.from(deletedSet);
      store.lastResetAt = Math.max(store.lastResetAt || 0, Number(body.timestamp) || Date.now());
      store.sessions = [];
      saveStore(store);

      return res.status(200).json({
        ok: true,
        deletedSessionIds: store.deletedSessionIds,
        lastResetAt: store.lastResetAt,
        totalSessions: 0
      });
    }

    // Merge incoming tombstones & reset timestamp if provided
    let modified = false;
    if (Array.isArray(body.deletedSessionIds)) {
      body.deletedSessionIds.forEach(id => {
        if (id && !deletedSet.has(id)) {
          deletedSet.add(id);
          modified = true;
        }
      });
      store.deletedSessionIds = Array.from(deletedSet);
    }

    if (typeof body.lastResetAt === 'number' && body.lastResetAt > (store.lastResetAt || 0)) {
      store.lastResetAt = body.lastResetAt;
      modified = true;
    }

    if (modified) {
      store.sessions = (store.sessions || []).filter(s => {
        if (!s || !s.id || deletedSet.has(s.id)) return false;
        if (store.lastResetAt > 0 && s.createdAt) {
          const ts = new Date(s.createdAt).getTime();
          if (!isNaN(ts) && ts < store.lastResetAt) return false;
        }
        return true;
      });
    }

    const incoming = Array.isArray(body.sessions) ? body.sessions : (body.session ? [body.session] : []);
    const existingIds = new Set((store.sessions || []).map(s => s.id));
    let addedCount = 0;

    incoming.forEach(sess => {
      if (!sess || !sess.id) return;
      if (deletedSet.has(sess.id)) return;
      if (store.lastResetAt > 0 && sess.createdAt) {
        const ts = new Date(sess.createdAt).getTime();
        if (!isNaN(ts) && ts < store.lastResetAt) return;
      }
      if (!existingIds.has(sess.id)) {
        const cleanPlayerName = String(sess.playerName || 'Anonymous').trim().slice(0, 60);
        const sanitizedSession = {
          ...sess,
          playerName: cleanPlayerName,
          normalizedPlayerName: cleanPlayerName.toLowerCase(),
          score: Math.max(0, Math.min(10000, Number(sess.score) || 0)),
          correctCount: Math.max(0, Number(sess.correctCount) || 0),
          totalQuestions: Math.max(0, Number(sess.totalQuestions) || 0),
          durationSeconds: Math.max(0, Number(sess.durationSeconds) || 0)
        };
        store.sessions.push(sanitizedSession);
        existingIds.add(sess.id);
        addedCount++;
      }
    });

    if (addedCount > 0 || modified) {
      saveStore(store);
    }

    return res.status(200).json({
      ok: true,
      savedCount: addedCount,
      totalSessions: store.sessions.length,
      sessions: store.sessions,
      deletedSessionIds: store.deletedSessionIds,
      lastResetAt: store.lastResetAt || 0
    });
  }

  return res.status(200).json({
    ok: true,
    sessions: store.sessions || [],
    deletedSessionIds: store.deletedSessionIds || [],
    lastResetAt: store.lastResetAt || 0
  });
}
