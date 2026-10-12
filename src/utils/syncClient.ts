import { SyncStatus, Question, GameSettings } from '../types';
import { dbManager } from './db';

type SyncListener = (status: SyncStatus) => void;

class SyncClient {
  private syncUrl: string = '';
  private isOnline: boolean = true;
  private lastSyncTime: string | null = null;
  private pendingCount: number = 0;
  private serverRevision: number = 1;
  private localRevision: number = 1;
  private syncError: string | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<SyncListener> = new Set();
  private isSyncing: boolean = false;
  private channel: BroadcastChannel | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const isDesktop = !!(window as unknown as { desktopAPI?: unknown }).desktopAPI;
      const savedUrl = localStorage.getItem('quest_sync_server_url');
      if (savedUrl) {
        this.syncUrl = savedUrl;
      } else if (isDesktop) {
        this.syncUrl = 'http://localhost:4820';
      } else {
        // Web deployment (Vercel / GitHub Pages / LAN)
        this.syncUrl = '';
      }

      // Realtime cross-tab synchronization channel
      if ('BroadcastChannel' in window) {
        try {
          this.channel = new BroadcastChannel('quest_sync_realtime');
          this.channel.onmessage = async (event) => {
            if (event.data?.type === 'SETTINGS_UPDATED') {
              if (event.data.settings) {
                await dbManager.saveSettings(event.data.settings);
              }
              this.notify();
            } else if (event.data?.type === 'QUESTIONS_UPDATED') {
              this.notify();
            } else if (event.data?.type === 'SESSION_DELETED') {
              if (event.data.sessionId) {
                await dbManager.deleteSession(event.data.sessionId);
              }
              this.notify();
            } else if (event.data?.type === 'SESSIONS_CLEARED') {
              await dbManager.clearAllSessions(event.data.timestamp);
              this.notify();
            } else if (event.data?.type === 'SESSIONS_UPDATED') {
              this.notify();
            }
          };
        } catch (e) {
          console.warn('[SyncClient] BroadcastChannel unavailable:', e);
        }
      }

      // Storage event listener fallback for cross-tab sync
      window.addEventListener('storage', async (e) => {
        if (e.key === 'quest_live_settings' && e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            await dbManager.saveSettings(parsed);
            this.notify();
          } catch {}
        } else if (e.key === 'quest_questions_rev') {
          this.notify();
        } else if (e.key === 'quest_sessions_sync' && e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            if (parsed?.type === 'SESSION_DELETED' && parsed.sessionId) {
              await dbManager.deleteSession(parsed.sessionId);
            } else if (parsed?.type === 'SESSIONS_CLEARED') {
              await dbManager.clearAllSessions(parsed.timestamp);
            }
            this.notify();
          } catch {}
        }
      });
    }
  }

  public getSyncUrl(): string {
    return this.syncUrl;
  }

  public setSyncUrl(url: string): void {
    this.syncUrl = url.trim().replace(/\/+$/, '');
    localStorage.setItem('quest_sync_server_url', this.syncUrl);
    this.triggerSync();
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const status = this.getStatus();
    this.listeners.forEach(fn => fn(status));
  }

  public getStatus(): SyncStatus {
    return {
      isOnline: this.isOnline,
      lastSyncTime: this.lastSyncTime,
      pendingSyncCount: this.pendingCount,
      serverRevision: this.serverRevision,
      localRevision: this.localRevision,
      syncError: this.syncError
    };
  }

  public broadcastSettings(settings: GameSettings): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('quest_live_settings', JSON.stringify(settings));
        if (this.channel) {
          this.channel.postMessage({ type: 'SETTINGS_UPDATED', settings });
        }
      } catch {}
    }
  }

  public broadcastQuestions(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('quest_questions_rev', String(Date.now()));
        if (this.channel) {
          this.channel.postMessage({ type: 'QUESTIONS_UPDATED' });
        }
      } catch {}
    }
  }

  public startAutoSync(intervalMs: number = 15000): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.triggerSync();
    this.intervalId = setInterval(() => {
      this.triggerSync();
    }, intervalMs);
  }

  public stopAutoSync(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public async triggerSync(): Promise<SyncStatus> {
    if (this.isSyncing) return this.getStatus();
    this.isSyncing = true;

    try {
      this.localRevision = await dbManager.getLocalRevision();
      const queued = await dbManager.getQueuedSessions();
      this.pendingCount = queued.length;

      // 0. Check Desktop Shared File System if running in Electron
      if (typeof window !== 'undefined' && window.desktopAPI) {
        try {
          const sharedSettings = await window.desktopAPI.getSharedSettings();
          if (sharedSettings && typeof sharedSettings.timerSeconds === 'number') {
            await dbManager.saveSettings(sharedSettings);
          }
          const sharedQuestions = await window.desktopAPI.getSharedQuestions();
          if (Array.isArray(sharedQuestions) && sharedQuestions.length > 0) {
            await dbManager.bulkSaveQuestions(sharedQuestions);
          }
        } catch (e) {
          console.warn('[SyncClient] Error reading desktop shared data:', e);
        }
      }

      // Check server status
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const statusRes = await fetch(`${this.syncUrl}/api/status`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!statusRes.ok) {
        throw new Error(`Server returned HTTP ${statusRes.status}`);
      }

      const statusData = await statusRes.json();
      this.isOnline = true;
      this.serverRevision = statusData.revision || 1;
      this.syncError = null;

      // 1. If server has a newer question revision, fetch published bundle
      if (this.serverRevision > this.localRevision) {
        console.log(`[SyncClient] New revision detected on server (${this.serverRevision} > ${this.localRevision}). Downloading bundle...`);
        const bundleRes = await fetch(`${this.syncUrl}/api/bundle`);
        if (bundleRes.ok) {
          const bundle = await bundleRes.json();
          if (bundle.ok) {
            if (Array.isArray(bundle.questions) && bundle.questions.length > 0) {
              await dbManager.bulkSaveQuestions(bundle.questions);
            }
            if (bundle.settings) {
              await dbManager.saveSettings(bundle.settings);
            }
            await dbManager.setLocalRevision(bundle.revision);
            this.localRevision = bundle.revision;
            console.log(`[SyncClient] Successfully updated local library to revision ${bundle.revision}.`);
          }
        }
      }

      // 2. Pull latest settings from sync server if available
      try {
        const setRes = await fetch(`${this.syncUrl}/api/settings`);
        if (setRes.ok) {
          const setData = await setRes.json();
          if (setData.ok && setData.settings && typeof setData.settings.timerSeconds === 'number') {
            await dbManager.saveSettings(setData.settings);
          }
        }
      } catch (e) {
        // server settings check error ignored
      }

      // 3. Push pending local sessions and/or local tombstones to the server
      const deletedSessionIds = dbManager.getDeletedSessionIds();
      const lastResetAt = dbManager.getLastResetTimestamp();

      if (queued.length > 0 || deletedSessionIds.length > 0 || lastResetAt > 0) {
        if (queued.length > 0) {
          console.log(`[SyncClient] Uploading ${queued.length} queued sessions to sync server...`);
        }
        const pushRes = await fetch(`${this.syncUrl}/api/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessions: queued,
            deletedSessionIds,
            lastResetAt
          })
        });

        if (pushRes.ok) {
          const pushData = await pushRes.json();
          if (pushData.ok) {
            if (queued.length > 0) {
              await dbManager.markSessionsSynced(queued.map(s => s.id));
              this.pendingCount = 0;
              console.log(`[SyncClient] Queued sessions successfully synchronized.`);
            }
            if (Array.isArray(pushData.sessions)) {
              await dbManager.mergeIncomingSessions(
                pushData.sessions,
                pushData.deletedSessionIds,
                pushData.lastResetAt
              );
            }
          }
        }
      }

      // 4. PULL all sessions and tombstones from the sync server and merge into local IndexedDB
      try {
        const recordsRes = await fetch(`${this.syncUrl}/api/records`);
        if (recordsRes.ok) {
          const recordsData = await recordsRes.json();
          if (recordsData.ok && Array.isArray(recordsData.sessions)) {
            const added = await dbManager.mergeIncomingSessions(
              recordsData.sessions,
              recordsData.deletedSessionIds,
              recordsData.lastResetAt
            );
            if (added > 0) {
              console.log(`[SyncClient] Downloaded and merged ${added} sessions from sync server.`);
            }
          }
        }
      } catch (e) {
        console.warn('[SyncClient] Could not fetch server records:', e);
      }

      this.lastSyncTime = new Date().toLocaleTimeString();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sync update pending';
      this.syncError = msg;
    } finally {
      this.isSyncing = false;
      this.notify();
    }

    return this.getStatus();
  }

  // --- IMMEDIATE SETTINGS UPDATE (DESKTOP SHARED FILE + SYNC SERVER + LOCAL DB) ---
  public async updateSettings(settings: GameSettings): Promise<boolean> {
    // 1. Write to Desktop Shared File if running in Electron standalone
    if (typeof window !== 'undefined' && window.desktopAPI?.saveSharedSettings) {
      try {
        await window.desktopAPI.saveSharedSettings(settings);
      } catch (err) {
        console.warn('[SyncClient] Could not save shared desktop settings:', err);
      }
    }

    // 2. Save locally and broadcast to all open tabs immediately
    await dbManager.saveSettings(settings);
    this.broadcastSettings(settings);

    // 3. Push to Sync Server API
    try {
      const res = await fetch(`${this.syncUrl}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.revision) {
          this.serverRevision = data.revision;
          this.localRevision = data.revision;
          await dbManager.setLocalRevision(data.revision);
        }
      }
    } catch (err) {
      // Local sync broadcast is already active
    }

    this.notify();
    return true;
  }

  // --- PULL LATEST SETTINGS (CHECKS DESKTOP SHARED STORAGE FIRST, THEN SYNC SERVER, THEN LOCAL DB) ---
  public async pullLatestSettings(): Promise<GameSettings> {
    let latestSettings: GameSettings | null = null;

    // 1. Check Desktop Shared File
    if (typeof window !== 'undefined' && window.desktopAPI?.getSharedSettings) {
      try {
        const shared = await window.desktopAPI.getSharedSettings();
        if (shared && typeof shared.timerSeconds === 'number') {
          latestSettings = shared;
          await dbManager.saveSettings(shared);
        }
      } catch (err) {
        console.warn('[SyncClient] Could not read desktop shared settings:', err);
      }
    }

    // 2. Check localStorage fast cache (instant, 0ms)
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('quest_live_settings');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed.timerSeconds === 'number') {
            latestSettings = parsed;
          }
        }
      } catch {}
    }

    // 3. Check Sync Server API with fast timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`${this.syncUrl}/api/settings`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.settings && typeof data.settings.timerSeconds === 'number') {
          latestSettings = data.settings;
          await dbManager.saveSettings(data.settings);
          if (data.revision) {
            this.serverRevision = data.revision;
          }
        }
      }
    } catch {
      // API not reached, using local
    }

    // 4. Fallback to Local IndexedDB
    if (!latestSettings) {
      latestSettings = await dbManager.getSettings();
    }

    return latestSettings;
  }

  // --- ADMIN PUBLISHING METHOD ---
  public async publishToSyncServer(questions: Question[], settings: GameSettings): Promise<number> {
    // 1. Save to Desktop Shared Storage
    if (typeof window !== 'undefined' && window.desktopAPI) {
      try {
        await window.desktopAPI.saveSharedSettings(settings);
        await window.desktopAPI.saveSharedQuestions(questions);
      } catch {}
    }

    // 2. Save locally and broadcast to all open tabs
    await dbManager.bulkSaveQuestions(questions);
    await dbManager.saveSettings(settings);
    this.broadcastQuestions();
    this.broadcastSettings(settings);

    // 3. Push to Server API
    let newRevision = this.localRevision + 1;
    try {
      const res = await fetch(`${this.syncUrl}/api/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions, settings })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.revision) {
          newRevision = data.revision;
        }
      }
    } catch (err) {
      console.warn('[SyncClient] Server publish push failed, local publish active:', err);
    }

    this.serverRevision = newRevision;
    this.localRevision = newRevision;
    await dbManager.setLocalRevision(newRevision);
    this.lastSyncTime = new Date().toLocaleTimeString();
    this.isOnline = true;
    this.notify();

    return newRevision;
  }

  // --- DELETE SINGLE SESSION ON LOCAL DB + SERVER + BROADCAST TO TABS ---
  public async deleteSession(sessionId: string): Promise<boolean> {
    await dbManager.deleteSession(sessionId);

    if (typeof window !== 'undefined') {
      try {
        const payload = { type: 'SESSION_DELETED', sessionId, timestamp: Date.now() };
        localStorage.setItem('quest_sessions_sync', JSON.stringify(payload));
        if (this.channel) {
          this.channel.postMessage(payload);
        }
      } catch {}
    }

    try {
      await fetch(`${this.syncUrl}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          sessionId,
          deletedSessionIds: dbManager.getDeletedSessionIds()
        })
      });
    } catch (err) {
      console.warn('[SyncClient] Server session delete deferred to next sync:', err);
    }

    this.notify();
    return true;
  }

  // --- RESET ALL RECORDS ON LOCAL DB + SERVER + BROADCAST TO TABS ---
  public async resetServerRecords(): Promise<boolean> {
    const timestamp = Date.now();
    await dbManager.clearAllSessions(timestamp);

    if (typeof window !== 'undefined') {
      try {
        const payload = { type: 'SESSIONS_CLEARED', timestamp };
        localStorage.setItem('quest_sessions_sync', JSON.stringify(payload));
        if (this.channel) {
          this.channel.postMessage(payload);
        }
      } catch {}
    }

    try {
      const deletedSessionIds = dbManager.getDeletedSessionIds();
      await Promise.allSettled([
        fetch(`${this.syncUrl}/api/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'clear', timestamp, deletedSessionIds })
        }),
        fetch(`${this.syncUrl}/api/reset-records`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timestamp, deletedSessionIds })
        })
      ]);
      this.notify();
      return true;
    } catch {
      this.notify();
      return false;
    }
  }
}

export const syncClient = new SyncClient();
