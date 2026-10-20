import fs from 'fs';
import os from 'os';
import path from 'path';

// Primary Central Redis Database configuration (used if configured in environment variables)
const REDIS_URL = (
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.KV_REST_API_URL ||
  ''
).replace(/\/+$/, '');

const REDIS_TOKEN = (
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.KV_REST_API_TOKEN ||
  ''
);

// Authoritative Persistent Central Cloud Store (shared across all Vercel serverless containers and devices)
const CENTRAL_STORE_URL = (
  process.env.CENTRAL_STORE_URL ||
  'https://superjsonblob.com/api/jsonBlob/499c9701-e4a7-4b6c-8941-30281a016b6a'
).trim();

let inMemoryStore = null;
let lastFetchTimestamp = 0;
const CACHE_TTL_MS = 1200; // 1.2s fresh cache to protect against rapid redundant fetches while staying real-time

const TMP_STORE_PATH = path.join(os.tmpdir(), 'quest-sync-data.json');

const DEFAULT_STORE = {
  revision: 6,
  lastPublished: new Date().toISOString(),
  questions: [],
  settings: {
    questionsPerGame: 5,
    timerSeconds: 30,
    randomSelection: false,
    shuffleQuestions: false,
    shuffleAnswers: true,
    allowNegativePoints: false,
    categories: ['Marketing', 'PreSales', 'Proposals', 'Guardian', 'Digital'],
    defaultPointsPerQuestion: 20,
    competitionMode: true
  },
  sessions: [],
  deletedSessionIds: [],
  lastResetAt: 0,
  adminPin: 'admin123'
};

function normalizeStore(store) {
  if (!store || typeof store !== 'object') store = { ...DEFAULT_STORE };
  if (!Array.isArray(store.sessions)) store.sessions = [];
  if (!Array.isArray(store.deletedSessionIds)) store.deletedSessionIds = [];
  if (typeof store.lastResetAt !== 'number') store.lastResetAt = 0;

  const deletedSet = new Set(store.deletedSessionIds);
  store.sessions = store.sessions.filter(s => {
    if (!s || !s.id) return false;
    if (deletedSet.has(s.id)) return false;
    if (store.lastResetAt > 0 && s.createdAt) {
      const createdTs = new Date(s.createdAt).getTime();
      if (!isNaN(createdTs) && createdTs < store.lastResetAt) return false;
    }
    return true;
  });

  return store;
}

// Low-level atomic Redis command helper over HTTPS REST (only if REDIS_URL is provided)
async function execRedis(cmd, ...args) {
  if (!REDIS_URL || !REDIS_TOKEN) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(REDIS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([cmd, ...args]),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();
    return data.result;
  } catch (err) {
    return null;
  }
}

// Low-level Redis Pipeline execution helper
async function execRedisPipeline(commands) {
  if (!REDIS_URL || !REDIS_TOKEN || !Array.isArray(commands) || commands.length === 0) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(`${REDIS_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(commands),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

// Read bundled fallback store from disk if needed
function getBundledStore() {
  try {
    const bundledPath = path.join(process.cwd(), 'server', 'data', 'sync-data.json');
    if (fs.existsSync(bundledPath)) {
      const raw = fs.readFileSync(bundledPath, 'utf8');
      return normalizeStore(JSON.parse(raw));
    }
  } catch {}
  return normalizeStore({ ...DEFAULT_STORE });
}

// Read local temp file
function getLocalDiskStore() {
  try {
    if (fs.existsSync(TMP_STORE_PATH)) {
      const raw = fs.readFileSync(TMP_STORE_PATH, 'utf8');
      return normalizeStore(JSON.parse(raw));
    }
  } catch {}
  return null;
}

// Write local temp file
function saveLocalDiskStore(store) {
  try {
    fs.writeFileSync(TMP_STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch {}
}

// Fetch from the persistent central cloud store
async function fetchCloudStore() {
  if (!CENTRAL_STORE_URL) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(CENTRAL_STORE_URL, {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        return normalizeStore(data);
      }
    }
  } catch (err) {
    console.warn('[CentralDB] Cloud store fetch warning:', err?.message || err);
  }
  return null;
}

// Persist whole store back to the persistent central cloud store
async function persistCloudStore(store) {
  if (!CENTRAL_STORE_URL) return false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(CENTRAL_STORE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(store),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    return res.ok;
  } catch (err) {
    console.warn('[CentralDB] Cloud store persist warning:', err?.message || err);
    return false;
  }
}

/**
 * Retrieves the authoritative store from the central persistent database.
 * Falls back to local disk and memory if the database is temporarily unreachable.
 */
export async function getStore(forceFresh = false) {
  const now = Date.now();
  if (!forceFresh && inMemoryStore && (now - lastFetchTimestamp < CACHE_TTL_MS)) {
    return normalizeStore(inMemoryStore);
  }

  // 1. If Redis is explicitly configured, query Redis
  if (REDIS_URL && REDIS_TOKEN) {
    try {
      const pipelineRes = await execRedisPipeline([
        ['HVALS', 'quest:sessions'],
        ['SMEMBERS', 'quest:tombstones'],
        ['HGETALL', 'quest:meta']
      ]);

      if (pipelineRes && Array.isArray(pipelineRes) && pipelineRes[0]?.result !== undefined) {
        const rawSessions = pipelineRes[0].result || [];
        const rawTombstones = pipelineRes[1]?.result || [];
        const rawMeta = pipelineRes[2]?.result || {};

        let parsedMeta = {};
        if (Array.isArray(rawMeta)) {
          for (let i = 0; i < rawMeta.length; i += 2) {
            parsedMeta[rawMeta[i]] = rawMeta[i + 1];
          }
        } else if (typeof rawMeta === 'object' && rawMeta !== null) {
          parsedMeta = rawMeta;
        }

        const sessions = [];
        for (const item of rawSessions) {
          try {
            const parsed = typeof item === 'string' ? JSON.parse(item) : item;
            if (parsed && parsed.id) sessions.push(parsed);
          } catch {}
        }

        let questions = [];
        let settings = DEFAULT_STORE.settings;
        let revision = DEFAULT_STORE.revision;
        let lastPublished = DEFAULT_STORE.lastPublished;
        let lastResetAt = Number(parsedMeta.lastResetAt) || 0;
        let adminPin = parsedMeta.adminPin || DEFAULT_STORE.adminPin;

        if (parsedMeta.settings) {
          try { settings = JSON.parse(parsedMeta.settings); } catch {}
        }
        if (parsedMeta.questions) {
          try { questions = JSON.parse(parsedMeta.questions); } catch {}
        }
        if (parsedMeta.revision) {
          revision = Number(parsedMeta.revision) || revision;
        }
        if (parsedMeta.lastPublished) {
          lastPublished = parsedMeta.lastPublished;
        }

        if (questions.length === 0) {
          const bundled = getBundledStore();
          questions = bundled.questions || [];
          if (bundled.settings) settings = bundled.settings;
          if (bundled.revision) revision = bundled.revision;
        }

        const centralStore = normalizeStore({
          revision,
          lastPublished,
          questions,
          settings,
          sessions,
          deletedSessionIds: rawTombstones,
          lastResetAt,
          adminPin
        });

        inMemoryStore = centralStore;
        lastFetchTimestamp = now;
        saveLocalDiskStore(centralStore);
        return centralStore;
      }
    } catch (err) {
      console.warn('[CentralDB] Redis query failed, using central cloud store:', err);
    }
  }

  // 2. Query Central Cloud Store
  const cloudStore = await fetchCloudStore();
  if (cloudStore) {
    if (!Array.isArray(cloudStore.questions) || cloudStore.questions.length === 0) {
      const bundled = getBundledStore();
      cloudStore.questions = bundled.questions || [];
      cloudStore.settings = bundled.settings || cloudStore.settings;
      cloudStore.revision = bundled.revision || cloudStore.revision;
      persistCloudStore(cloudStore).catch(() => {});
    }

    inMemoryStore = cloudStore;
    lastFetchTimestamp = now;
    saveLocalDiskStore(cloudStore);
    return cloudStore;
  }

  // 3. Fallback to in-memory, disk, or bundled defaults
  if (inMemoryStore) return normalizeStore(inMemoryStore);
  const disk = getLocalDiskStore();
  if (disk) {
    inMemoryStore = disk;
    lastFetchTimestamp = now;
    return disk;
  }

  const bundled = getBundledStore();
  inMemoryStore = bundled;
  lastFetchTimestamp = now;
  return bundled;
}

/**
 * Saves store modifications to the central database and local cache.
 */
export async function saveStore(store) {
  const normalized = normalizeStore(store);
  inMemoryStore = normalized;
  lastFetchTimestamp = Date.now();
  saveLocalDiskStore(normalized);

  if (REDIS_URL && REDIS_TOKEN) {
    try {
      const pipelineCmds = [
        ['HSET', 'quest:meta', 'revision', String(normalized.revision || 1)],
        ['HSET', 'quest:meta', 'lastPublished', normalized.lastPublished || new Date().toISOString()],
        ['HSET', 'quest:meta', 'lastResetAt', String(normalized.lastResetAt || 0)],
        ['HSET', 'quest:meta', 'adminPin', normalized.adminPin || 'admin123'],
        ['HSET', 'quest:meta', 'settings', JSON.stringify(normalized.settings || DEFAULT_STORE.settings)],
        ['HSET', 'quest:meta', 'questions', JSON.stringify(normalized.questions || [])]
      ];

      if (normalized.deletedSessionIds?.length > 0) {
        pipelineCmds.push(['SADD', 'quest:tombstones', ...normalized.deletedSessionIds]);
      }

      await execRedisPipeline(pipelineCmds);
    } catch (err) {
      console.warn('[CentralDB] Redis save error:', err);
    }
  }

  await persistCloudStore(normalized);
}

/**
 * Atomically saves a single completed game session to the central persistent database.
 */
export async function addSession(session) {
  if (!session || !session.id) return false;

  // 1. If Redis configured, write to Redis
  if (REDIS_URL && REDIS_TOKEN) {
    try {
      const isTombstoned = await execRedis('SISMEMBER', 'quest:tombstones', session.id);
      if (isTombstoned === 1) return false;
      await execRedis('HSET', 'quest:sessions', session.id, JSON.stringify(session));
    } catch (e) {}
  }

  // 2. Save to Central Cloud Store
  const currentStore = await getStore(true);
  const deletedSet = new Set(currentStore.deletedSessionIds || []);
  if (deletedSet.has(session.id)) return false;

  if (currentStore.lastResetAt > 0 && session.createdAt) {
    const createdTs = new Date(session.createdAt).getTime();
    if (!isNaN(createdTs) && createdTs < currentStore.lastResetAt) return false;
  }

  if (!Array.isArray(currentStore.sessions)) currentStore.sessions = [];
  const existingIdx = currentStore.sessions.findIndex(s => s.id === session.id);
  if (existingIdx >= 0) {
    currentStore.sessions[existingIdx] = session;
  } else {
    currentStore.sessions.push(session);
  }

  inMemoryStore = currentStore;
  lastFetchTimestamp = Date.now();
  saveLocalDiskStore(currentStore);

  await persistCloudStore(currentStore);
  return true;
}

/**
 * Atomically saves multiple sessions to the central database.
 */
export async function addSessions(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) return 0;
  const valid = sessions.filter(s => s && s.id);
  if (valid.length === 0) return 0;

  if (REDIS_URL && REDIS_TOKEN) {
    try {
      const tombstones = (await execRedis('SMEMBERS', 'quest:tombstones')) || [];
      const tSet = new Set(tombstones);
      const cmds = valid.filter(s => !tSet.has(s.id)).map(s => ['HSET', 'quest:sessions', s.id, JSON.stringify(s)]);
      if (cmds.length > 0) await execRedisPipeline(cmds);
    } catch (e) {}
  }

  const currentStore = await getStore(true);
  const deletedSet = new Set(currentStore.deletedSessionIds || []);
  const lastResetAt = currentStore.lastResetAt || 0;

  if (!Array.isArray(currentStore.sessions)) currentStore.sessions = [];
  const existingMap = new Map(currentStore.sessions.map(s => [s.id, s]));
  let addedCount = 0;

  for (const s of valid) {
    if (deletedSet.has(s.id)) continue;
    if (lastResetAt > 0 && s.createdAt) {
      const ts = new Date(s.createdAt).getTime();
      if (!isNaN(ts) && ts < lastResetAt) continue;
    }
    if (!existingMap.has(s.id)) addedCount++;
    existingMap.set(s.id, s);
  }

  currentStore.sessions = Array.from(existingMap.values());
  inMemoryStore = currentStore;
  lastFetchTimestamp = Date.now();
  saveLocalDiskStore(currentStore);

  await persistCloudStore(currentStore);
  return addedCount;
}

/**
 * Atomically deletes a session by ID and permanently records its tombstone.
 */
export async function deleteSession(sessionId) {
  if (!sessionId) return false;

  if (REDIS_URL && REDIS_TOKEN) {
    try {
      await execRedisPipeline([
        ['HDEL', 'quest:sessions', sessionId],
        ['SADD', 'quest:tombstones', sessionId]
      ]);
    } catch (e) {}
  }

  const store = await getStore(true);
  store.sessions = (store.sessions || []).filter(s => s.id !== sessionId);
  if (!Array.isArray(store.deletedSessionIds)) store.deletedSessionIds = [];
  if (!store.deletedSessionIds.includes(sessionId)) {
    store.deletedSessionIds.push(sessionId);
  }

  inMemoryStore = store;
  lastFetchTimestamp = Date.now();
  saveLocalDiskStore(store);

  await persistCloudStore(store);
  return true;
}

/**
 * Atomically deletes multiple sessions by ID.
 */
export async function deleteSessions(sessionIds) {
  if (!Array.isArray(sessionIds) || sessionIds.length === 0) return false;

  if (REDIS_URL && REDIS_TOKEN) {
    try {
      await execRedisPipeline([
        ['HDEL', 'quest:sessions', ...sessionIds],
        ['SADD', 'quest:tombstones', ...sessionIds]
      ]);
    } catch (e) {}
  }

  const store = await getStore(true);
  const idSet = new Set(sessionIds);
  store.sessions = (store.sessions || []).filter(s => !idSet.has(s.id));
  if (!Array.isArray(store.deletedSessionIds)) store.deletedSessionIds = [];
  for (const id of sessionIds) {
    if (!store.deletedSessionIds.includes(id)) {
      store.deletedSessionIds.push(id);
    }
  }

  inMemoryStore = store;
  lastFetchTimestamp = Date.now();
  saveLocalDiskStore(store);

  await persistCloudStore(store);
  return true;
}

/**
 * Atomically resets all sessions and records the reset timestamp.
 */
export async function clearAllSessions(timestamp = Date.now()) {
  if (REDIS_URL && REDIS_TOKEN) {
    try {
      const store = await getStore();
      const currentIds = (store.sessions || []).map(s => s.id);
      const pipeline = [
        ['DEL', 'quest:sessions'],
        ['HSET', 'quest:meta', 'lastResetAt', String(timestamp)]
      ];
      if (currentIds.length > 0) {
        pipeline.push(['SADD', 'quest:tombstones', ...currentIds]);
      }
      await execRedisPipeline(pipeline);
    } catch (e) {}
  }

  const store = await getStore(true);
  const currentIds = (store.sessions || []).map(s => s.id);
  store.sessions = [];
  store.lastResetAt = timestamp;
  if (!Array.isArray(store.deletedSessionIds)) store.deletedSessionIds = [];
  if (currentIds.length > 0) {
    store.deletedSessionIds = Array.from(new Set([...store.deletedSessionIds, ...currentIds]));
  }

  inMemoryStore = store;
  lastFetchTimestamp = Date.now();
  saveLocalDiskStore(store);

  await persistCloudStore(store);
  return true;
}

/**
 * Single authoritative ranking calculation used across all devices.
 * Strict tie-breaking rules:
 * 1. Score (highest to lowest)
 * 2. Correct answers count (highest to lowest)
 * 3. Completion time (lowest duration seconds wins)
 * 4. Completion timestamp (earliest completion wins)
 * 5. Identical metrics receive tied rank (e.g. T-#1)
 */
export function rankSessions(sessions) {
  const sorted = [...(sessions || [])].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
    if (a.durationSeconds !== b.durationSeconds) return a.durationSeconds - b.durationSeconds;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const ranked = [];
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    let rank = i + 1;
    let isSharedRank = false;

    if (i > 0) {
      const prev = sorted[i - 1];
      if (
        prev.score === current.score &&
        prev.correctCount === current.correctCount &&
        prev.durationSeconds === current.durationSeconds
      ) {
        rank = ranked[i - 1].rank;
        isSharedRank = true;
        ranked[i - 1].isSharedRank = true;
      }
    }

    ranked.push({ ...current, rank, isSharedRank });
  }

  return ranked;
}

/**
 * Calculates authoritative leaderboard for any view: 'overall', 'today', 'personal_bests', 'player_history'.
 */
export async function getAuthoritativeLeaderboard(view = 'overall', targetPlayer = '') {
  const store = await getStore();
  const ranked = rankSessions(store.sessions || []);

  if (view === 'today') {
    const todayStr = new Date().toDateString();
    const filtered = ranked.filter(s => new Date(s.createdAt).toDateString() === todayStr);
    return filtered;
  }

  if (view === 'personal_bests') {
    const bestMap = new Map();
    ranked.forEach(s => {
      const key = s.playerId || s.normalizedPlayerName || (s.playerName || '').trim().toLowerCase();
      if (!bestMap.has(key)) {
        bestMap.set(key, s);
      }
    });
    return rankSessions(Array.from(bestMap.values()));
  }

  if (view === 'player_history' && targetPlayer && targetPlayer.trim()) {
    const norm = targetPlayer.trim().toLowerCase();
    const filtered = ranked.filter(s => 
      (s.normalizedPlayerName && s.normalizedPlayerName.includes(norm)) ||
      (s.playerName && s.playerName.toLowerCase().includes(norm))
    );
    return filtered;
  }

  return ranked;
}
