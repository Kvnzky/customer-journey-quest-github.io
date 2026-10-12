import fs from 'fs';
import os from 'os';
import path from 'path';

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
  lastResetAt: 0
};

function normalizeStore(store) {
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

export function getStore() {
  if (inMemoryStore) {
    return normalizeStore(inMemoryStore);
  }

  // 1. Try reading temp store path
  try {
    if (fs.existsSync(TMP_STORE_PATH)) {
      const raw = fs.readFileSync(TMP_STORE_PATH, 'utf8');
      inMemoryStore = normalizeStore(JSON.parse(raw));
      return inMemoryStore;
    }
  } catch {}

  // 2. Try reading bundled server/data/sync-data.json
  try {
    const bundledPath = path.join(process.cwd(), 'server', 'data', 'sync-data.json');
    if (fs.existsSync(bundledPath)) {
      const raw = fs.readFileSync(bundledPath, 'utf8');
      inMemoryStore = normalizeStore(JSON.parse(raw));
      return inMemoryStore;
    }
  } catch {}

  inMemoryStore = normalizeStore({ ...DEFAULT_STORE });
  return inMemoryStore;
}

export function saveStore(store) {
  inMemoryStore = normalizeStore(store);
  try {
    fs.writeFileSync(TMP_STORE_PATH, JSON.stringify(inMemoryStore, null, 2), 'utf8');
  } catch (err) {
    console.warn('[SyncAPI] Could not write to temp store:', err);
  }
}

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
