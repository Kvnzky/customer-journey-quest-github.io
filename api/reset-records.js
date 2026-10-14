import { getStore, clearAllSessions } from './_store.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-PIN');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const store = await getStore();
  const currentAdminPin = store.adminPin || 'admin123';
  const providedPin = (
    req.headers['x-admin-pin'] ||
    req.body?.adminPin ||
    req.query?.adminPin ||
    ''
  ).toString().trim();

  if (!providedPin || providedPin !== currentAdminPin) {
    return res.status(401).json({ ok: false, error: 'Unauthorized: Invalid administrator PIN.' });
  }

  const timestamp = Number(req.body?.timestamp) || Date.now();
  await clearAllSessions(timestamp);
  const updated = await getStore();

  return res.status(200).json({
    ok: true,
    deletedSessionIds: updated.deletedSessionIds,
    lastResetAt: updated.lastResetAt,
    message: 'All session records have been cleared.'
  });
}
