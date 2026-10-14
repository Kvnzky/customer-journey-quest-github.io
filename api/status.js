import { getStore } from './_store.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const store = await getStore();
  return res.status(200).json({
    ok: true,
    service: 'Customer Journey Quest Live Sync Service',
    version: '2.0.0',
    revision: store.revision || 1,
    lastPublished: store.lastPublished,
    questionsCount: (store.questions || []).length,
    sessionsCount: (store.sessions || []).length,
    timestamp: new Date().toISOString()
  });
}
