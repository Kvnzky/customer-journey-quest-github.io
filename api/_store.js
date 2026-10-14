import fs from 'fs';
import os from 'os';
import path from 'path';

// Primary Central Redis Database configuration (supports Upstash / Vercel KV)
const REDIS_URL = (
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.KV_REST_API_URL ||
  'https://magnetic-badger-234744.upstash.io'
).replace(/\/+$/, '');

const REDIS_TOKEN = (
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.KV_REST_API_TOKEN ||
  'gQAAAAAAA5T4AQIgcDEzOTAzN2I4ZDg0ZTM0MmQxYTNiZDhmMzM0MDFjZGQyZA'
);

let inMemoryStore = null;
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

// Low-level atomic Redis command helper over HTTPS REST
async function execRedis(cmd, ...args) {
  if (!REDIS_URL || !REDIS_TOKEN) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

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

    if (!res.ok) {
      console.warn(`[CentralDB] Redis command ${cmd} failed with HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    return data.result;
  } catch (err) {
    console.warn(`[CentralDB] Redis command ${cmd} error:`, err?.message || err);
    return null;
  }
}

// Low-level Redis Pipeline execution helper
async function execRedisPipeline(commands) {
  if (!REDIS_URL || !REDIS_TOKEN || !Array.isArray(commands) || commands.length === 0) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

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
    console.warn('[CentralDB] Redis pipeline error:', err?.message || err);
    return null;
  }
}

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

/**
 * Retrieves the authoritative store from the central Redis database.
 * Falls back to local disk and memory if the database is temporarily unreachable.
 */
export async function getStore() {
  try {
    // 1. Fetch sessions from Redis Hash 'quest:sessions'
    // 2. Fetch tombstones from Redis Set 'quest:tombstones'
    // 3. Fetch meta from Redis Hash 'quest:meta'
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

      // If central database questions are empty, initialize from bundled defaults
      if (questions.length === 0) {
        const bundled = getBundledStore();
        questions = bundled.questions || [];
        if (bundled.settings) settings = bundled.settings;
        if (bundled.revision) revision = bundled.revision;

        // Populate Redis in background
        execRedisPipeline([
          ['HSET', 'quest:meta', 'questions', JSON.stringify(questions)],
          ['HSET', 'quest:meta', 'settings', JSON.stringify(settings)],
          ['HSET', 'quest:meta', 'revision', String(revision)]
        ]).catch(() => {});
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
      saveLocalDiskStore(centralStore);
      return centralStore;
    }
  } catch (err) {
    console.warn('[CentralDB] Error fetching store from Redis:', err);
  }

  // Fallback to in-memory or local disk
  if (inMemoryStore) return normalizeStore(inMemoryStore);
  const disk = getLocalDiskStore();
  if (disk) {
    inMemoryStore = disk;
    return disk;
  }

  const bundled = getBundledStore();
  inMemoryStore = bundled;
  return bundled;
}

/**
 * Saves store modifications to the central database and local cache.
 */
export async function saveStore(store) {
  const normalized = normalizeStore(store);
  inMemoryStore = normalized;
  saveLocalDiskStore(normalized);

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
    console.warn('[CentralDB] Error saving store to Redis:', err);
  }
}

/**
 * Atomically saves a single completed game session to the central Redis database.
 * Uses Redis HSET for atomic, non-destructive write (zero race conditions).
 */
export async function addSession(session) {
  if (!session || !session.id) return false;

  // Check tombstone
  const isTombstoned = await execRedis('SISMEMBER', 'quest:tombstones', session.id);
  if (isTombstoned === 1) {
    console.warn(`[CentralDB] Rejected resurrected session: ${session.id}`);
    return false;
  }

  // Atomic HSET into Redis Hash
  const jsonStr = JSON.stringify(session);
  await execRedis('HSET', 'quest:sessions', session.id, jsonStr);

  // Update in-memory & local cache
  if (!inMemoryStore) inMemoryStore = await getStore();
  const exists = inMemoryStore.sessions.some(s => s.id === session.id);
  if (!exists) {
    inMemoryStore.sessions.push(session);
    saveLocalDiskStore(inMemoryStore);
  }

  return true;
}

/**
 * Atomically saves multiple sessions to the central database via Redis pipeline.
 */
export async function addSessions(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) return 0;

  const validSessions = sessions.filter(s => s && s.id);
  if (validSessions.length === 0) return 0;

  // Fetch tombstones to filter
  const tombstones = (await execRedis('SMEMBERS', 'quest:tombstones')) || [];
  const tombstoneSet = new Set(tombstones);

  const pipeline = [];
  const added = [];

  for (const s of validSessions) {
    if (!tombstoneSet.has(s.id)) {
      pipeline.push(['HSET', 'quest:sessions', s.id, JSON.stringify(s)]);
      added.push(s);
    }
  }

  if (pipeline.length > 0) {
    await execRedisPipeline(pipeline);
  }

  if (!inMemoryStore) inMemoryStore = await getStore();
  const existingIds = new Set(inMemoryStore.sessions.map(s => s.id));
  for (const s of added) {
    if (!existingIds.has(s.id)) {
      inMemoryStore.sessions.push(s);
      existingIds.add(s.id);
    }
  }
  saveLocalDiskStore(inMemoryStore);

  return added.length;
}

/**
 * Atomically deletes a session by ID and permanently records its tombstone.
 */
export async function deleteSession(sessionId) {
  if (!sessionId) return false;

  await execRedisPipeline([
    ['HDEL', 'quest:sessions', sessionId],
    ['SADD', 'quest:tombstones', sessionId]
  ]);

  if (inMemoryStore) {
    inMemoryStore.sessions = inMemoryStore.sessions.filter(s => s.id !== sessionId);
    if (!inMemoryStore.deletedSessionIds.includes(sessionId)) {
      inMemoryStore.deletedSessionIds.push(sessionId);
    }
    saveLocalDiskStore(inMemoryStore);
  }

  return true;
}

/**
 * Atomically deletes multiple sessions by ID.
 */
export async function deleteSessions(sessionIds) {
  if (!Array.isArray(sessionIds) || sessionIds.length === 0) return false;

  const pipeline = [
    ['HDEL', 'quest:sessions', ...sessionIds],
    ['SADD', 'quest:tombstones', ...sessionIds]
  ];
  await execRedisPipeline(pipeline);

  if (inMemoryStore) {
    const idSet = new Set(sessionIds);
    inMemoryStore.sessions = inMemoryStore.sessions.filter(s => !idSet.has(s.id));
    for (const id of sessionIds) {
      if (!inMemoryStore.deletedSessionIds.includes(id)) {
        inMemoryStore.deletedSessionIds.push(id);
      }
    }
    saveLocalDiskStore(inMemoryStore);
  }

  return true;
}

/**
 * Atomically resets all sessions and records the reset timestamp.
 */
export async function clearAllSessions(timestamp = Date.now()) {
  const store = await getStore();
  const currentIds = store.sessions.map(s => s.id);

  const pipeline = [
    ['DEL', 'quest:sessions'],
    ['HSET', 'quest:meta', 'lastResetAt', String(timestamp)]
  ];
  if (currentIds.length > 0) {
    pipeline.push(['SADD', 'quest:tombstones', ...currentIds]);
  }

  await execRedisPipeline(pipeline);

  store.sessions = [];
  store.lastResetAt = timestamp;
  if (currentIds.length > 0) {
    store.deletedSessionIds = Array.from(new Set([...(store.deletedSessionIds || []), ...currentIds]));
  }
  inMemoryStore = store;
  saveLocalDiskStore(store);

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
      // Group by playerId if present, otherwise by normalized player name
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
