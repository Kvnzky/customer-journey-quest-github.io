export interface Question {
  id: string;
  text: string;
  options: string[];
  optionScores?: Record<string, number>; // Maps choice string to points awarded (e.g., 20 optimal, 5 partial, 0 ineffective)
  stageDescription?: string; // What this department/group does in the customer journey
  correctAnswer: string;
  explanation: string;
  category: string;
  points: number; // Maximum possible points for this question
  status: 'published' | 'draft' | 'disabled';
  revision?: number;
  createdAt: string;
  updatedAt: string;
}

// Sanitized question payload for fair competition mode (no correct answer / explanation / points exposed during play!)
export interface SanitizedQuestion {
  id: string;
  text: string;
  options: string[];
  category: string;
  points: number;
  stageDescription?: string;
}

export interface QuestionResultItem {
  questionNumber: number;
  questionText: string;
  category: string;
  playerAnswer: string | null;
  isCorrect: boolean;
  isTimedOut: boolean;
  pointsAwarded: number;
  maxPoints?: number;
  scoreTier?: 'optimal' | 'partial' | 'ineffective' | 'timeout';
  timeSpentSeconds: number;
}

export type SessionEndReason = 'COMPLETED' | 'TIME_EXPIRED' | 'ABANDONED';

export interface GameSession {
  id: string;
  deviceId: string;
  playerId?: string;
  playerName: string;
  normalizedPlayerName: string;
  score: number;
  correctCount: number;
  incorrectCount: number;
  totalQuestions: number;
  completedCount: number;
  unansweredCount: number;
  durationSeconds: number;
  status: 'completed' | 'game_over_timeout' | 'abandoned';
  gameOverReason: SessionEndReason;
  questionResults: QuestionResultItem[];
  questionSetRevision: number;
  createdAt: string;
  isPersonalBest?: boolean;
  synced?: boolean;
}

export interface GameSettings {
  questionsPerGame: number;
  timerSeconds: number;
  randomSelection: boolean;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  allowNegativePoints: boolean;
  categories: string[];
  defaultPointsPerQuestion: number;
  competitionMode: boolean; // Fair competition mode toggle (default: true)
}

export interface LeaderboardItem extends GameSession {
  rank: number;
  isSharedRank?: boolean;
}

export interface SyncStatus {
  isOnline: boolean;
  lastSyncTime: string | null;
  pendingSyncCount: number;
  serverRevision: number;
  localRevision: number;
  syncError: string | null;
}

export interface SystemBackup {
  version: string;
  exportDate: string;
  revision: number;
  questions: Question[];
  settings: GameSettings;
  sessions: GameSession[];
}

export interface AppInfo {
  name: string;
  version: string;
  environment: 'desktop-standalone' | 'web-offline';
  deviceId: string;
  revision: number;
  syncUrl: string;
}

export type ScreenState = 
  | 'welcome' 
  | 'gameplay' 
  | 'results' 
  | 'leaderboard';

export type AdminTab = 
  | 'dashboard' 
  | 'questions' 
  | 'settings' 
  | 'records' 
  | 'sync_status'
  | 'import_export' 
  | 'backup_restore' 
  | 'account';

export interface DesktopAPI {
  platform: string;
  isElectron: boolean;
  appVersion: string;
  getSharedSettings: () => Promise<GameSettings | null>;
  saveSharedSettings: (settings: GameSettings) => Promise<boolean>;
  getSharedQuestions: () => Promise<Question[] | null>;
  saveSharedQuestions: (questions: Question[]) => Promise<boolean>;
}

declare global {
  interface Window {
    desktopAPI?: DesktopAPI;
  }
}
