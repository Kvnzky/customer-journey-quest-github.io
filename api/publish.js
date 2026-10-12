import { getStore, saveStore } from './_store.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const body = req.body || {};
  if (!body.questions || !Array.isArray(body.questions)) {
    return res.status(400).json({ ok: false, error: 'Invalid payload: questions array required.' });
  }

  const store = getStore();
  store.revision = (store.revision || 0) + 1;
  store.lastPublished = new Date().toISOString();
  store.questions = body.questions;
  if (body.settings) {
    store.settings = body.settings;
  }
  saveStore(store);

  return res.status(200).json({
    ok: true,
    revision: store.revision,
    lastPublished: store.lastPublished,
    message: 'Question bank published successfully.'
  });
}
