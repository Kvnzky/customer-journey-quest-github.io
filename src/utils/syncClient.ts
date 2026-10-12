import { SyncStatus, Question, GameSettings } from '../types';
import { dbManager } from './db';

type SyncListener = (status: SyncStatus) => void;

class SyncClient {
  private syncUrl: string = 'http://localhost:4820';
  private isOnline: boolean = false;
  private lastSyncTime: string | null = null;
  private pendingCount: number = 0;
  private serverRevision: number = 1;
  private localRevision: number = 1;
  private syncError: string | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<SyncListener> = new Set();
  private isSyncing: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const savedUrl = localStorage.getItem('quest_sync_server_url');
      if (savedUrl) {
        this.syncUrl = savedUrl;
      }
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

  public startAutoSync(intervalMs: number = 20000): void {
    if (this.intervalId) clearInterval(this.intervalId);
    // Initial sync
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
      const timeoutId = setTimeout(() => controller.abort(), 4000);

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

      // 2. Always pull latest settings from sync server if available
      try {
        const setRes = await fetch(`${this.syncUrl}/api/settings`);
        if (setRes.ok) {
          const setData = await setRes.json();
          if (setData.ok && setData.settings && typeof setData.settings.timerSeconds === 'number') {
            await dbManager.saveSettings(setData.settings);
          }
        }
      } catch (e) {
        // server settings check failed
      }

      // 3. If there are pending local sessions, push them to the server
      if (queued.length > 0) {
        console.log(`[SyncClient] Uploading ${queued.length} queued sessions to sync server...`);
        const pushRes = await fetch(`${this.syncUrl}/api/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessions: queued })
        });

        if (pushRes.ok) {
          const pushData = await pushRes.json();
          if (pushData.ok) {
            await dbManager.markSessionsSynced(queued.map(s => s.id));
            this.pendingCount = 0;
            console.log(`[SyncClient] Queued sessions successfully synchronized.`);
          }
        }
      }

      // 4. PULL all sessions from the sync server and merge into local IndexedDB
      try {
        const recordsRes = await fetch(`${this.syncUrl}/api/records`);
        if (recordsRes.ok) {
          const recordsData = await recordsRes.json();
          if (recordsData.ok && Array.isArray(recordsData.sessions)) {
            const added = await dbManager.mergeIncomingSessions(recordsData.sessions);
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
      this.isOnline = false;
      const msg = err instanceof Error ? err.message : 'Connection failed';
      this.syncError = `Offline Mode: ${msg}`;
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

    // 2. Save locally
    await dbManager.saveSettings(settings);

    // 3. Push to Sync Server
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
      console.warn('[SyncClient] Sync server unreachable when saving settings (offline mode active):', err);
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

    // 2. Check Sync Server
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
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
      // Offline mode
    }

    // 3. Fallback to local DB
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

    const res = await fetch(`${this.syncUrl}/api/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions, settings })
    });

    if (!res.ok) {
      throw new Error(`Publish failed with status ${res.status}`);
    }

    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.error || 'Publish error');
    }

    this.serverRevision = data.revision;
    this.localRevision = data.revision;
    await dbManager.setLocalRevision(data.revision);
    this.lastSyncTime = new Date().toLocaleTimeString();
    this.isOnline = true;
    this.notify();

    return data.revision;
  }

  // --- RESET ALL RECORDS ON SERVER ---
  public async resetServerRecords(): Promise<boolean> {
    try {
      const res = await fetch(`${this.syncUrl}/api/reset-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export const syncClient = new SyncClient();
