import { 
  Question, 
  GameSession, 
  GameSettings, 
  LeaderboardItem, 
  SystemBackup, 
  SanitizedQuestion, 
  QuestionResultItem 
} from '../types';
import { DEFAULT_QUESTIONS, DEFAULT_SETTINGS } from '../data/defaultQuestions';

const DB_NAME = 'CustomerJourneyQuestDB_v2';
const DB_VERSION = 1;

class DatabaseManager {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private cachedDeviceId: string | null = null;

  public getDeviceId(): string {
    if (this.cachedDeviceId) return this.cachedDeviceId;
    let id = localStorage.getItem('quest_device_id');
    if (!id) {
      id = `dev-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`;
      localStorage.setItem('quest_device_id', id);
    }
    this.cachedDeviceId = id;
    return id;
  }

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB is not supported in this environment.'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Questions store
        if (!db.objectStoreNames.contains('questions')) {
          const questionStore = db.createObjectStore('questions', { keyPath: 'id' });
          questionStore.createIndex('category', 'category', { unique: false });
          questionStore.createIndex('status', 'status', { unique: false });
        }

        // Sessions store
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('normalizedPlayerName', 'normalizedPlayerName', { unique: false });
          sessionStore.createIndex('score', 'score', { unique: false });
          sessionStore.createIndex('createdAt', 'createdAt', { unique: false });
          sessionStore.createIndex('synced', 'synced', { unique: false });
        }

        // Settings & Metadata store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        // Admin config store
        if (!db.objectStoreNames.contains('admin')) {
          db.createObjectStore('admin', { keyPath: 'key' });
        }

        // Unsynced sessions queue
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id' });
        }
      };

      request.onsuccess = async () => {
        const db = request.result;
        await this.seedDefaultsIfEmpty(db);
        resolve(db);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to open database'));
      };
    });

    return this.dbPromise;
  }

  private async seedDefaultsIfEmpty(db: IDBDatabase): Promise<void> {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(['questions', 'settings', 'admin'], 'readwrite');
        const qStore = tx.objectStore('questions');
        const countReq = qStore.count();
        countReq.onsuccess = () => {
          if (countReq.result === 0) {
            DEFAULT_QUESTIONS.forEach(q => qStore.put(q));
          } else {
            // Automatically upgrade default questions to the latest 20, 15, 10, 5 tiered scores
            DEFAULT_QUESTIONS.forEach(defQ => {
              const getReq = qStore.get(defQ.id);
              getReq.onsuccess = () => {
                if (getReq.result) {
                  const existing = getReq.result;
                  const needsUpgrade = !existing.optionScores || 
                    Object.values(existing.optionScores).some(v => v === 0);
                  if (needsUpgrade) {
                    qStore.put({ ...existing, ...defQ });
                  }
                }
              };
            });
          }
        };

        const sStore = tx.objectStore('settings');
        const sReq = sStore.get('game_settings');
        sReq.onsuccess = () => {
          if (!sReq.result) {
            sStore.put({ key: 'game_settings', value: DEFAULT_SETTINGS });
          }
        };

        const revReq = sStore.get('revision');
        revReq.onsuccess = () => {
          if (!revReq.result) {
            sStore.put({ key: 'revision', value: 1 });
          }
        };

        const aStore = tx.objectStore('admin');
        const aReq = aStore.get('admin_pin');
        aReq.onsuccess = () => {
          if (!aReq.result) {
            aStore.put({ key: 'admin_pin', value: 'admin123' });
          }
        };

        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  // --- REVISION TRACKING ---
  public async getLocalRevision(): Promise<number> {
    const db = await this.getDB();
    return new Promise((resolve) => {
      const tx = db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const req = store.get('revision');
      req.onsuccess = () => {
        resolve(req.result ? req.result.value : 1);
      };
      req.onerror = () => resolve(1);
    });
  }

  public async setLocalRevision(rev: number): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      const req = store.put({ key: 'revision', value: rev });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- QUESTIONS ---
  public async getQuestions(): Promise<Question[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('questions', 'readonly');
      const store = tx.objectStore('questions');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  public async getPublishedQuestions(): Promise<Question[]> {
    const questions = await this.getQuestions();
    return questions.filter(q => q.status === 'published' || (q as unknown as { status: string }).status === 'active');
  }

  /**
   * Sanitizes questions for player gameplay payload:
   * STRIPS correctAnswer and explanation to guarantee answer key secrecy!
   */
  public sanitizeQuestions(questions: Question[]): SanitizedQuestion[] {
    return questions.map(q => ({
      id: q.id,
      text: q.text,
      options: [...q.options],
      category: q.category,
      points: q.points || 20,
      stageDescription: q.stageDescription
    }));
  }

  public async saveQuestion(question: Question): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('questions', 'readwrite');
      const store = tx.objectStore('questions');
      const req = store.put(question);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async bulkSaveQuestions(questions: Question[]): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('questions', 'readwrite');
      const store = tx.objectStore('questions');
      questions.forEach(q => store.put(q));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public async deleteQuestion(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('questions', 'readwrite');
      const store = tx.objectStore('questions');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- SESSIONS & TOMBSTONE TRACKING ---
  public getDeletedSessionIds(): string[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('quest_deleted_session_ids');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }

  public addDeletedSessionIds(ids: string[]): void {
    if (typeof window === 'undefined' || !Array.isArray(ids) || ids.length === 0) return;
    try {
      const current = new Set(this.getDeletedSessionIds());
      ids.forEach(id => {
        if (id) current.add(id);
      });
      localStorage.setItem('quest_deleted_session_ids', JSON.stringify(Array.from(current)));
    } catch {}
  }

  public getLastResetTimestamp(): number {
    if (typeof window === 'undefined') return 0;
    try {
      return Number(localStorage.getItem('quest_last_reset_ts') || '0') || 0;
    } catch {
      return 0;
    }
  }

  public setLastResetTimestamp(ts: number): void {
    if (typeof window === 'undefined') return;
    try {
      const current = this.getLastResetTimestamp();
      if (ts > current) {
        localStorage.setItem('quest_last_reset_ts', String(ts));
      }
    } catch {}
  }

  public async getSessions(): Promise<GameSession[]> {
    const db = await this.getDB();
    const deletedSet = new Set(this.getDeletedSessionIds());
    const lastResetTs = this.getLastResetTimestamp();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(['sessions', 'syncQueue'], 'readwrite');
      const store = tx.objectStore('sessions');
      const queueStore = tx.objectStore('syncQueue');
      const req = store.getAll();

      req.onsuccess = () => {
        const all = (req.result as GameSession[]) || [];
        const valid: GameSession[] = [];

        all.forEach(s => {
          if (!s || !s.id) return;
          const createdTs = s.createdAt ? new Date(s.createdAt).getTime() : 0;
          if (deletedSet.has(s.id) || (lastResetTs > 0 && createdTs > 0 && createdTs < lastResetTs)) {
            store.delete(s.id);
            queueStore.delete(s.id);
          } else {
            valid.push(s);
          }
        });

        resolve(valid);
      };
      req.onerror = () => reject(req.error);
    });
  }

  public async saveSession(session: GameSession): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['sessions', 'syncQueue'], 'readwrite');
      const sessionStore = tx.objectStore('sessions');
      const queueStore = tx.objectStore('syncQueue');

      sessionStore.put(session);
      // Also add to sync queue if not marked synced
      if (!session.synced) {
        queueStore.put(session);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public async deleteSession(id: string): Promise<void> {
    this.addDeletedSessionIds([id]);
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['sessions', 'syncQueue'], 'readwrite');
      tx.objectStore('sessions').delete(id);
      tx.objectStore('syncQueue').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public async clearAllSessions(resetTimestamp?: number): Promise<void> {
    const ts = resetTimestamp || Date.now();
    this.setLastResetTimestamp(ts);
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['sessions', 'syncQueue'], 'readwrite');
      const sessionStore = tx.objectStore('sessions');
      const getAllReq = sessionStore.getAll();
      getAllReq.onsuccess = () => {
        const existing = (getAllReq.result as GameSession[]) || [];
        this.addDeletedSessionIds(existing.map(s => s.id));
        sessionStore.clear();
        tx.objectStore('syncQueue').clear();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public async mergeIncomingSessions(
    incomingSessions: GameSession[],
    serverDeletedIds?: string[],
    serverLastResetTs?: number
  ): Promise<number> {
    if (Array.isArray(serverDeletedIds) && serverDeletedIds.length > 0) {
      this.addDeletedSessionIds(serverDeletedIds);
    }
    if (typeof serverLastResetTs === 'number' && serverLastResetTs > 0) {
      this.setLastResetTimestamp(serverLastResetTs);
    }

    const deletedSet = new Set(this.getDeletedSessionIds());
    const lastResetTs = this.getLastResetTimestamp();
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(['sessions', 'syncQueue'], 'readwrite');
      const store = tx.objectStore('sessions');
      const queueStore = tx.objectStore('syncQueue');
      const getAllReq = store.getAll();

      getAllReq.onsuccess = () => {
        const existingSessions = (getAllReq.result as GameSession[]) || [];
        const existingIds = new Set<string>();
        let changedCount = 0;

        // 1. Purge any locally stored session that was deleted or predates a reset
        existingSessions.forEach(s => {
          if (!s || !s.id) return;
          const createdTs = s.createdAt ? new Date(s.createdAt).getTime() : 0;
          if (deletedSet.has(s.id) || (lastResetTs > 0 && createdTs > 0 && createdTs < lastResetTs)) {
            store.delete(s.id);
            queueStore.delete(s.id);
            changedCount++;
          } else {
            existingIds.add(s.id);
          }
        });

        // 2. Add valid incoming sessions that are not deleted and not predating reset
        if (Array.isArray(incomingSessions)) {
          incomingSessions.forEach(sess => {
            if (!sess || !sess.id) return;
            if (deletedSet.has(sess.id)) return;
            const createdTs = sess.createdAt ? new Date(sess.createdAt).getTime() : 0;
            if (lastResetTs > 0 && createdTs > 0 && createdTs < lastResetTs) return;

            if (!existingIds.has(sess.id)) {
              store.put({ ...sess, synced: true });
              existingIds.add(sess.id);
              changedCount++;
            }
          });
        }

        tx.oncomplete = () => resolve(changedCount);
      };

      getAllReq.onerror = () => reject(getAllReq.error);
    });
  }

  // --- SYNC QUEUE ---
  public async getQueuedSessions(): Promise<GameSession[]> {
    const db = await this.getDB();
    const deletedSet = new Set(this.getDeletedSessionIds());
    const lastResetTs = this.getLastResetTimestamp();

    return new Promise((resolve, reject) => {
      const tx = db.transaction('syncQueue', 'readwrite');
      const store = tx.objectStore('syncQueue');
      const req = store.getAll();
      req.onsuccess = () => {
        const all = (req.result as GameSession[]) || [];
        const valid: GameSession[] = [];
        all.forEach(s => {
          if (!s || !s.id) return;
          const createdTs = s.createdAt ? new Date(s.createdAt).getTime() : 0;
          if (deletedSet.has(s.id) || (lastResetTs > 0 && createdTs > 0 && createdTs < lastResetTs)) {
            store.delete(s.id);
          } else {
            valid.push(s);
          }
        });
        resolve(valid);
      };
      req.onerror = () => reject(req.error);
    });
  }

  public async markSessionsSynced(sessionIds: string[]): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['sessions', 'syncQueue'], 'readwrite');
      const sStore = tx.objectStore('sessions');
      const qStore = tx.objectStore('syncQueue');

      sessionIds.forEach(id => {
        qStore.delete(id);
        const req = sStore.get(id);
        req.onsuccess = () => {
          if (req.result) {
            sStore.put({ ...req.result, synced: true });
          }
        };
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- SETTINGS ---
  public async getSettings(): Promise<GameSettings> {
    const db = await this.getDB();
    return new Promise((resolve) => {
      const tx = db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const req = store.get('game_settings');
      req.onsuccess = () => {
        if (req.result && req.result.value) {
          resolve(req.result.value);
        } else {
          resolve(DEFAULT_SETTINGS);
        }
      };
      req.onerror = () => resolve(DEFAULT_SETTINGS);
    });
  }

  public async saveSettings(settings: GameSettings): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      const req = store.put({ key: 'game_settings', value: settings });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- ADMIN CREDENTIALS ---
  public async getAdminPin(): Promise<string> {
    const db = await this.getDB();
    return new Promise((resolve) => {
      const tx = db.transaction('admin', 'readonly');
      const store = tx.objectStore('admin');
      const req = store.get('admin_pin');
      req.onsuccess = () => {
        if (req.result && req.result.value) {
          resolve(req.result.value);
        } else {
          resolve('admin123');
        }
      };
      req.onerror = () => resolve('admin123');
    });
  }

  public async setAdminPin(newPin: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('admin', 'readwrite');
      const store = tx.objectStore('admin');
      const req = store.put({ key: 'admin_pin', value: newPin });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- LEADERBOARD & RANKING LOGIC ---
  public sortAndRankSessions(sessions: GameSession[]): LeaderboardItem[] {
    const sorted = [...sessions].sort((a, b) => {
      // 1. Highest final score first
      if (b.score !== a.score) return b.score - a.score;
      // 2. More correct answers when scores tied
      if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
      // 3. Shorter completion time next
      if (a.durationSeconds !== b.durationSeconds) return a.durationSeconds - b.durationSeconds;
      // 4. Earlier completion timestamp
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    const ranked: LeaderboardItem[] = [];
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

      ranked.push({
        ...current,
        rank,
        isSharedRank
      });
    }

    return ranked;
  }

  public async getLeaderboard(
    view: 'overall' | 'today' | 'personal_bests' | 'player_history',
    targetPlayer?: string
  ): Promise<LeaderboardItem[]> {
    const sessions = await this.getSessions();

    if (view === 'today') {
      const todayStr = new Date().toDateString();
      const filtered = sessions.filter(s => new Date(s.createdAt).toDateString() === todayStr);
      return this.sortAndRankSessions(filtered);
    }

    if (view === 'personal_bests') {
      const bestMap = new Map<string, GameSession>();
      sessions.forEach(s => {
        const key = s.normalizedPlayerName;
        const existing = bestMap.get(key);
        if (!existing) {
          bestMap.set(key, s);
        } else {
          if (
            s.score > existing.score ||
            (s.score === existing.score && s.correctCount > existing.correctCount) ||
            (s.score === existing.score && s.correctCount === existing.correctCount && s.durationSeconds < existing.durationSeconds)
          ) {
            bestMap.set(key, s);
          }
        }
      });
      return this.sortAndRankSessions(Array.from(bestMap.values()));
    }

    if (view === 'player_history' && targetPlayer) {
      const norm = targetPlayer.trim().toLowerCase();
      const filtered = sessions.filter(s => s.normalizedPlayerName === norm);
      return this.sortAndRankSessions(filtered);
    }

    return this.sortAndRankSessions(sessions);
  }

  public async checkIsPersonalBest(normalizedName: string, newScore: number): Promise<boolean> {
    const sessions = await this.getSessions();
    const playerSessions = sessions.filter(s => s.normalizedPlayerName === normalizedName);
    if (playerSessions.length === 0) return true;
    const highestPrevious = Math.max(...playerSessions.map(s => s.score));
    return newScore > highestPrevious;
  }

  // --- FAIR EVALUATION ENGINE ---
  /**
   * Trusted session evaluation executed at game completion.
   * Compares recorded player answers against the authoritative local questions store.
   * Produces QuestionResultItem[] with ✓ and ✗ without revealing the answer key!
   */
  public async evaluateGameCompletion(
    playerName: string,
    answers: { questionId: string; selectedAnswer: string | null; timeSpent: number }[],
    totalDuration: number,
    settings: GameSettings,
    reason: 'COMPLETED' | 'TIME_EXPIRED' | 'ABANDONED'
  ): Promise<GameSession> {
    const allQuestions = await this.getQuestions();
    const questionMap = new Map<string, Question>();
    allQuestions.forEach(q => questionMap.set(q.id, q));

    const revision = await this.getLocalRevision();
    let score = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    const results: QuestionResultItem[] = [];

    answers.forEach((ans, idx) => {
      const q = questionMap.get(ans.questionId);
      const questionText = q ? q.text : `Question ${idx + 1}`;
      const category = q ? q.category : 'General';
      const isTimedOut = ans.selectedAnswer === null;

      let awarded = 0;
      let maxPoints = q ? (q.points || settings.defaultPointsPerQuestion || 20) : 20;
      let scoreTier: 'optimal' | 'partial' | 'ineffective' | 'timeout' = 'ineffective';
      let isCorrect = false;

      if (isTimedOut) {
        awarded = 0;
        scoreTier = 'timeout';
        isCorrect = false;
        incorrectCount++;
      } else if (q) {
        if (q.optionScores && Object.keys(q.optionScores).length > 0) {
          const scoreValues = Object.values(q.optionScores);
          maxPoints = Math.max(...scoreValues, q.points || 20);
          awarded = q.optionScores[ans.selectedAnswer!] ?? 0;
        } else {
          maxPoints = q.points || settings.defaultPointsPerQuestion || 20;
          if (ans.selectedAnswer === q.correctAnswer) {
            awarded = maxPoints;
          } else {
            // Default tiered scale [15, 10, 5] for choices without explicit optionScores
            const tiers = [15, 10, 5];
            const otherOpts = q.options.filter(o => o !== q.correctAnswer);
            const optIdx = otherOpts.indexOf(ans.selectedAnswer!);
            awarded = optIdx >= 0 && optIdx < tiers.length ? tiers[optIdx] : 5;
          }
        }

        if (awarded >= maxPoints && maxPoints > 0) {
          scoreTier = 'optimal';
          isCorrect = true;
          correctCount++;
        } else if (awarded > 0) {
          scoreTier = 'partial';
          isCorrect = true;
          correctCount++;
        } else {
          scoreTier = 'ineffective';
          isCorrect = false;
          incorrectCount++;
          if (settings.allowNegativePoints) {
            awarded = -maxPoints;
          }
        }
      } else {
        incorrectCount++;
      }

      score = Math.max(0, score + awarded);

      results.push({
        questionNumber: idx + 1,
        questionText,
        category,
        playerAnswer: ans.selectedAnswer,
        isCorrect,
        isTimedOut,
        pointsAwarded: awarded,
        maxPoints,
        scoreTier,
        timeSpentSeconds: ans.timeSpent
      });
    });

    const unansweredCount = answers.filter(a => a.selectedAnswer === null).length;

    const session: GameSession = {
      id: `sess-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      deviceId: this.getDeviceId(),
      playerName,
      normalizedPlayerName: playerName.trim().toLowerCase(),
      score,
      correctCount,
      incorrectCount,
      totalQuestions: answers.length,
      completedCount: answers.length - unansweredCount,
      unansweredCount,
      durationSeconds: totalDuration,
      status: reason === 'COMPLETED' ? 'completed' : (reason === 'TIME_EXPIRED' ? 'game_over_timeout' : 'abandoned'),
      gameOverReason: reason,
      questionResults: results,
      questionSetRevision: revision,
      createdAt: new Date().toISOString(),
      synced: false
    };

    return session;
  }

  // --- FULL BACKUP AND RESTORE ---
  public async exportBackup(): Promise<SystemBackup> {
    const questions = await this.getQuestions();
    const settings = await this.getSettings();
    const sessions = await this.getSessions();
    const revision = await this.getLocalRevision();

    return {
      version: '2.0.0',
      exportDate: new Date().toISOString(),
      revision,
      questions,
      settings,
      sessions
    };
  }

  public async restoreBackup(backup: SystemBackup, mode: 'replace' | 'merge' = 'replace'): Promise<void> {
    const db = await this.getDB();

    if (mode === 'replace') {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(['questions', 'settings', 'sessions', 'syncQueue'], 'readwrite');
        tx.objectStore('questions').clear();
        tx.objectStore('sessions').clear();
        tx.objectStore('syncQueue').clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['questions', 'settings', 'sessions'], 'readwrite');
      const qStore = tx.objectStore('questions');
      const sStore = tx.objectStore('sessions');
      const setStore = tx.objectStore('settings');

      if (Array.isArray(backup.questions)) {
        backup.questions.forEach(q => qStore.put(q));
      }
      if (Array.isArray(backup.sessions)) {
        backup.sessions.forEach(s => sStore.put(s));
      }
      if (backup.settings) {
        setStore.put({ key: 'game_settings', value: backup.settings });
      }
      if (backup.revision) {
        setStore.put({ key: 'revision', value: backup.revision });
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const dbManager = new DatabaseManager();
