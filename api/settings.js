import { getStore, saveStore } from './_store.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const store = await getStore();

  if (req.method === 'POST') {
    const body = req.body || {};
    if (!body.settings) {
      return res.status(400).json({ ok: false, error: 'Missing settings payload' });
    }
    store.settings = { ...store.settings, ...body.settings };
    store.revision = (store.revision || 0) + 1;
    store.lastPublished = new Date().toISOString();
    await saveStore(store);

    return res.status(200).json({
      ok: true,
      revision: store.revision,
      settings: store.settings
    });
  }

  // GET
  return res.status(200).json({
    ok: true,
    settings: store.settings,
    revision: store.revision
  });
}
