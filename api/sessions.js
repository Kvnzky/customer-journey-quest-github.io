import { 
  getStore, 
  addSession, 
  addSessions, 
  deleteSession, 
  deleteSessions, 
  clearAllSessions,
  rankSessions 
} from './_store.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-PIN');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const store = await getStore();
  const currentAdminPin = store.adminPin || 'admin123';

  // Helper to verify admin authorization for destructive operations
  const checkAdminAuth = () => {
    const providedPin = (
      req.headers['x-admin-pin'] ||
      req.body?.adminPin ||
      req.query?.adminPin ||
      ''
    ).toString().trim();

    return providedPin.length > 0 && providedPin === currentAdminPin;
  };

  // Helper to validate and sanitize a session object
  const sanitizeSession = (sess) => {
    if (!sess || typeof sess !== 'object') return null;
    const id = String(sess.id || '').trim();
    if (!id || id.length < 5 || id.length > 100) return null;

    const rawName = String(sess.playerName || 'Anonymous').trim();
    const playerName = rawName.slice(0, 60) || 'Anonymous';
    const normalizedPlayerName = playerName.toLowerCase();

    const score = Math.max(0, Math.min(10000, Math.round(Number(sess.score) || 0)));
    const correctCount = Math.max(0, Math.min(100, Math.round(Number(sess.correctCount) || 0)));
    const totalQuestions = Math.max(1, Math.min(100, Math.round(Number(sess.totalQuestions) || 5)));
    const durationSeconds = Math.max(0, Math.min(7200, Math.round(Number(sess.durationSeconds) || 0)));

    let status = 'completed';
    if (sess.status === 'game_over_timeout') status = 'game_over_timeout';
    else if (sess.status === 'abandoned') status = 'abandoned';

    const createdAt = sess.createdAt && !isNaN(new Date(sess.createdAt).getTime())
      ? new Date(sess.createdAt).toISOString()
      : new Date().toISOString();

    const deviceId = String(sess.deviceId || '').trim().slice(0, 80) || undefined;
    const playerId = String(sess.playerId || '').trim().slice(0, 80) || undefined;

    return {
      ...sess,
      id,
      playerId,
      deviceId,
      playerName,
      normalizedPlayerName,
      score,
      correctCount,
      totalQuestions,
      durationSeconds,
      status,
      createdAt
    };
  };

  // 1. DELETE /api/sessions?id=... (Requires Admin PIN)
  if (req.method === 'DELETE') {
    if (!checkAdminAuth()) {
      return res.status(401).json({ ok: false, error: 'Unauthorized: Invalid administrator PIN.' });
    }

    const id = req.query?.id || req.body?.sessionId;
    if (id) {
      await deleteSession(id);
    }
    const updated = await getStore();
    return res.status(200).json({
      ok: true,
      deletedSessionIds: updated.deletedSessionIds,
      totalSessions: updated.sessions.length
    });
  }

  // 2. POST /api/sessions
  if (req.method === 'POST') {
    const body = req.body || {};

    // Admin Action: Delete single or multiple sessions
    if (body.action === 'delete') {
      if (!checkAdminAuth()) {
        return res.status(401).json({ ok: false, error: 'Unauthorized: Invalid administrator PIN.' });
      }

      const idsToDelete = Array.isArray(body.sessionIds)
        ? body.sessionIds
        : body.sessionId
        ? [body.sessionId]
        : [];

      if (idsToDelete.length > 0) {
        await deleteSessions(idsToDelete);
      }
      const updated = await getStore();
      return res.status(200).json({
        ok: true,
        deletedSessionIds: updated.deletedSessionIds,
        totalSessions: updated.sessions.length
      });
    }

    // Admin Action: Full Leaderboard Reset / Clear
    if (body.action === 'clear') {
      if (!checkAdminAuth()) {
        return res.status(401).json({ ok: false, error: 'Unauthorized: Invalid administrator PIN.' });
      }

      const timestamp = Number(body.timestamp) || Date.now();
      await clearAllSessions(timestamp);
      return res.status(200).json({
        ok: true,
        totalSessions: 0,
        lastResetAt: timestamp,
        message: 'All session records cleared successfully.'
      });
    }

    // Single Game Session Submission from Player Client
    if (body.session) {
      const sanitized = sanitizeSession(body.session);
      if (!sanitized) {
        return res.status(400).json({ ok: false, error: 'Invalid game session payload.' });
      }

      const saved = await addSession(sanitized);
      const updated = await getStore();
      const ranked = rankSessions(updated.sessions);
      const playerRankItem = ranked.find(r => r.id === sanitized.id);

      return res.status(200).json({
        ok: true,
        saved,
        session: sanitized,
        rank: playerRankItem?.rank || null,
        isSharedRank: playerRankItem?.isSharedRank || false,
        totalSessions: updated.sessions.length
      });
    }

    // Batch Session Submission / Queue Flush
    const incomingList = Array.isArray(body.sessions) ? body.sessions : [];
    const sanitizedList = incomingList.map(sanitizeSession).filter(Boolean);

    if (sanitizedList.length > 0) {
      await addSessions(sanitizedList);
    }

    const updated = await getStore();
    return res.status(200).json({
      ok: true,
      savedCount: sanitizedList.length,
      totalSessions: updated.sessions.length,
      sessions: updated.sessions,
      deletedSessionIds: updated.deletedSessionIds,
      lastResetAt: updated.lastResetAt || 0
    });
  }

  // 3. GET /api/sessions: Returns all active sessions from the central database
  return res.status(200).json({
    ok: true,
    sessions: store.sessions || [],
    deletedSessionIds: store.deletedSessionIds || [],
    lastResetAt: store.lastResetAt || 0
  });
}
