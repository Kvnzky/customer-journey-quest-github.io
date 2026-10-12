// Standalone Local Synchronization Service for Customer Journey Quest
// Pure Node.js implementation with zero external dependencies!

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 4820;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'sync-data.json');

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial default state
let syncStore = {
  revision: 1,
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
    defaultPointsPerQuestion: 10
  },
  sessions: []
};

// Load existing state from disk if available
if (fs.existsSync(DATA_FILE)) {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    syncStore = { ...syncStore, ...parsed };
    console.log(`[SyncServer] Loaded existing data: revision ${syncStore.revision}, ${syncStore.questions.length} questions, ${syncStore.sessions.length} sessions.`);
  } catch (err) {
    console.error('[SyncServer] Error reading data file, using defaults:', err);
  }
} else {
  // Save initial store
  saveStore();
}

function saveStore() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(syncStore, null, 2), 'utf8');
  } catch (err) {
    console.error('[SyncServer] Failed to save sync data to disk:', err);
  }
}

// Standard ranking calculation for shared sync leaderboard
function rankSessions(sessions) {
  const sorted = [...sessions].sort((a, b) => {
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

// HTTP Server
const server = http.createServer((req, res) => {
  // CORS Headers for electron, local files, and LAN access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-ID');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // JSON helper
  const sendJson = (statusCode, data) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  // Helper to read request body
  const readBody = (callback) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const json = body ? JSON.parse(body) : {};
        callback(null, json);
      } catch (err) {
        callback(err, null);
      }
    });
  };

  // Routes
  if (req.method === 'GET' && pathname === '/api/status') {
    sendJson(200, {
      ok: true,
      service: 'Customer Journey Quest Sync Service',
      version: '2.0.0',
      revision: syncStore.revision,
      lastPublished: syncStore.lastPublished,
      questionsCount: syncStore.questions.length,
      sessionsCount: syncStore.sessions.length,
      timestamp: new Date().toISOString()
    });
  } 
  else if (req.method === 'GET' && pathname === '/api/bundle') {
    // Return published question bank and settings for game client
    sendJson(200, {
      ok: true,
      revision: syncStore.revision,
      lastPublished: syncStore.lastPublished,
      questions: syncStore.questions,
      settings: syncStore.settings
    });
  } 
  else if (req.method === 'POST' && pathname === '/api/publish') {
    // Admin publishing updated question bank & settings
    readBody((err, data) => {
      if (err || !data.questions) {
        return sendJson(400, { ok: false, error: 'Invalid payload: questions array required.' });
      }

      syncStore.revision = (syncStore.revision || 0) + 1;
      syncStore.lastPublished = new Date().toISOString();
      syncStore.questions = data.questions;
      if (data.settings) {
        syncStore.settings = data.settings;
      }

      saveStore();
      console.log(`[SyncServer] Published revision ${syncStore.revision} with ${syncStore.questions.length} questions.`);
      sendJson(200, {
        ok: true,
        revision: syncStore.revision,
        lastPublished: syncStore.lastPublished,
        message: 'Question bank published successfully.'
      });
    });
  } 
  else if (req.method === 'POST' && pathname === '/api/sessions') {
    // Game client submitting completed sessions
    readBody((err, data) => {
      if (err) {
        return sendJson(400, { ok: false, error: 'Invalid JSON payload.' });
      }

      const incoming = Array.isArray(data.sessions) ? data.sessions : (data.session ? [data.session] : []);
      if (incoming.length === 0) {
        return sendJson(200, { ok: true, savedCount: 0, message: 'No sessions provided.' });
      }

      let addedCount = 0;
      const existingIds = new Set(syncStore.sessions.map(s => s.id));

      incoming.forEach(sess => {
        if (sess && sess.id && !existingIds.has(sess.id)) {
          syncStore.sessions.push(sess);
          existingIds.add(sess.id);
          addedCount++;
        }
      });

      if (addedCount > 0) {
        saveStore();
        console.log(`[SyncServer] Saved ${addedCount} new sessions (Total: ${syncStore.sessions.length}).`);
      }

      sendJson(200, {
        ok: true,
        savedCount: addedCount,
        totalSessions: syncStore.sessions.length
      });
    });
  } 
  else if (req.method === 'GET' && pathname === '/api/leaderboard') {
    const view = parsedUrl.query.view || 'overall';
    const ranked = rankSessions(syncStore.sessions);

    if (view === 'today') {
      const todayStr = new Date().toDateString();
      const filtered = ranked.filter(s => new Date(s.createdAt).toDateString() === todayStr);
      sendJson(200, { ok: true, leaderboard: filtered });
    } else if (view === 'personal_bests') {
      const bestMap = new Map();
      ranked.forEach(s => {
        const key = s.normalizedPlayerName || s.playerName.trim().toLowerCase();
        if (!bestMap.has(key)) {
          bestMap.set(key, s);
        }
      });
      sendJson(200, { ok: true, leaderboard: rankSessions(Array.from(bestMap.values())) });
    } else {
      sendJson(200, { ok: true, leaderboard: ranked });
    }
  } 
  else if (req.method === 'GET' && pathname === '/api/records') {
    sendJson(200, {
      ok: true,
      sessions: syncStore.sessions
    });
  } 
  else if (req.method === 'GET' && pathname === '/api/settings') {
    sendJson(200, {
      ok: true,
      settings: syncStore.settings,
      revision: syncStore.revision
    });
  }
  else if (req.method === 'POST' && pathname === '/api/settings') {
    readBody((err, data) => {
      if (err || !data.settings) {
        return sendJson(400, { ok: false, error: 'Invalid settings payload.' });
      }
      syncStore.settings = { ...syncStore.settings, ...data.settings };
      syncStore.revision = (syncStore.revision || 0) + 1;
      syncStore.lastPublished = new Date().toISOString();
      saveStore();
      console.log(`[SyncServer] Game settings updated on server: Timer=${syncStore.settings.timerSeconds}s, QuestionsPerGame=${syncStore.settings.questionsPerGame}. Revision ${syncStore.revision}.`);
      sendJson(200, {
        ok: true,
        revision: syncStore.revision,
        settings: syncStore.settings,
        message: 'Settings updated successfully.'
      });
    });
  }
  else if (req.method === 'POST' && pathname === '/api/reset-records') {
    syncStore.sessions = [];
    saveStore();
    console.log('[SyncServer] All player sessions and leaderboard records reset.');
    sendJson(200, {
      ok: true,
      message: 'All player sessions and leaderboard records reset successfully.'
    });
  } 
  else {
    sendJson(404, { ok: false, error: 'Route not found' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`  Customer Journey Quest - Sync Service v2.0.0       `);
  console.log(`  Listening on: http://localhost:${PORT}             `);
  console.log(`  Revision: ${syncStore.revision} | Questions: ${syncStore.questions.length} `);
  console.log(`====================================================`);
});
