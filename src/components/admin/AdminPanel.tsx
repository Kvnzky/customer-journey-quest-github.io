import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Settings, 
  HelpCircle, 
  Users, 
  FileText, 
  Database, 
  KeyRound, 
  LogOut, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Copy, 
  Eye, 
  CheckCircle2, 
  XCircle, 
  Download, 
  Upload, 
  AlertTriangle, 
  ChevronLeft, 
  ChevronRight,
  Flame,
  Clock,
  Sparkles,
  RefreshCw,
  FolderOpen,
  FileSpreadsheet,
  RotateCcw,
  Gamepad2
} from 'lucide-react';
import { Question, GameSession, GameSettings, AdminTab, SystemBackup, SyncStatus } from '../../types';
import { dbManager } from '../../utils/db';
import { soundManager } from '../../utils/audio';
import { syncClient } from '../../utils/syncClient';
import { 
  exportQuestionsToCsv, 
  parseQuestionsCsv, 
  exportLeaderboardToCsv, 
  exportSessionsToCsv, 
  downloadFile 
} from '../../utils/csv';
import { parseUniversalQuestionFile } from '../../utils/documentParser';
import { QuestionFormModal } from './QuestionFormModal';
import { QuestionPreviewModal } from './QuestionPreviewModal';
import { SessionDetailModal } from './SessionDetailModal';
import { Wifi, WifiOff, UploadCloud } from 'lucide-react';
import { getJourneyOrderedCategories, getJourneyStageRank } from '../../utils/journeySelector';

interface AdminPanelProps {
  onLogout: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

  // Core Data
  const [questions, setQuestions] = useState<Question[]>([]);
  const [settings, setSettings] = useState<GameSettings | null>(null);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isQuestionFormOpen, setIsQuestionFormOpen] = useState(false);
  const [previewingQuestion, setPreviewingQuestion] = useState<Question | null>(null);
  const [inspectingSession, setInspectingSession] = useState<GameSession | null>(null);

  // Question Management Filters & Pagination
  const [qSearch, setQSearch] = useState('');
  const [qCategoryFilter, setQCategoryFilter] = useState('all');
  const [qStatusFilter, setQStatusFilter] = useState('all');
  const [qPage, setQPage] = useState(1);
  const itemsPerPage = 7;

  // Session Records Filters
  const [sSearch, setSSearch] = useState('');
  const [sStatusFilter, setSStatusFilter] = useState('all');

  // Account Settings Form
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinMessage, setPinMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Universal Document Import State (Excel, Word, PDF, CSV)
  const [csvFileContent, setCsvFileContent] = useState<string | null>(null);
  const [importedFileName, setImportedFileName] = useState<string | null>(null);
  const [isParsingFile, setIsParsingFile] = useState<boolean>(false);
  const [csvPreviewQuestions, setCsvPreviewQuestions] = useState<Question[]>([]);
  const [csvErrors, setCsvErrors] = useState<{ row: number; error: string; rawText: string }[]>([]);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Backup & Restore State
  const [restoreJson, setRestoreJson] = useState<SystemBackup | null>(null);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  // Notification Banner
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const [syncStatus, setSyncStatus] = useState<SyncStatus>(syncClient.getStatus());
  const [publishing, setPublishing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadAllData();
    const unsub = syncClient.subscribe(st => {
      setSyncStatus(st);
      dbManager.getSessions().then(setSessions).catch(() => {});
    });
    syncClient.triggerSync().then(() => {
      loadAllData();
    }).catch(() => {});
    return () => unsub();
  }, []);

  const handleManualSyncAndRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    soundManager.playClick();
    try {
      await syncClient.triggerSync();
      await loadAllData();
      const updatedSessions = await dbManager.getSessions();
      setSessions(updatedSessions);
      soundManager.playCorrect();
      showToast(`Synchronized! ${updatedSessions.length} total player sessions updated.`);
    } catch (err: unknown) {
      console.error('Sync refresh error:', err);
      showToast('Sync server status checked.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePublishUpdates = async () => {
    if (publishing) return;
    setPublishing(true);
    try {
      const pubQs = questions.filter(q => q.status === 'published');
      if (pubQs.length === 0) {
        showToast('No questions with "Published" status to deploy.');
        setPublishing(false);
        return;
      }
      const newRev = await syncClient.publishToSyncServer(pubQs, settings!);
      soundManager.playVictory();
      showToast(`Revision ${newRev} published! Connected game installations will receive this automatically.`);
      await loadAllData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Publish error';
      showToast(`Sync server error: ${msg}. Make sure sync-server is running.`);
    } finally {
      setPublishing(false);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [qs, sets, sess] = await Promise.all([
        dbManager.getQuestions(),
        dbManager.getSettings(),
        dbManager.getSessions()
      ]);
      setQuestions(qs);
      setSettings(sets);
      setSessions(sess);
    } catch (err) {
      console.error('Error loading admin data:', err);
      showToast('Error loading database records.');
    } finally {
      setLoading(false);
    }
  };

  // --- QUESTION ACTIONS ---
  const handleSaveQuestion = async (q: Question, addAnother: boolean = false) => {
    try {
      await dbManager.saveQuestion(q);
      syncClient.broadcastQuestions();
      const updated = await dbManager.getQuestions();
      setQuestions(updated);
      showToast(`Question "${q.text.slice(0, 30)}..." saved successfully.`);
      if (!addAnother) {
        setIsQuestionFormOpen(false);
        setEditingQuestion(null);
      }
    } catch (err) {
      showToast('Failed to save question.');
    }
  };

  const handleDeleteQuestion = async (q: Question) => {
    if (window.confirm(`Are you sure you want to delete question: "${q.text}"?\n\nHistorical game records will NOT be lost.`)) {
      try {
        await dbManager.deleteQuestion(q.id);
        syncClient.broadcastQuestions();
        const updated = await dbManager.getQuestions();
        setQuestions(updated);
        showToast('Question deleted.');
      } catch (err) {
        showToast('Failed to delete question.');
      }
    }
  };

  const handleDuplicateQuestion = (q: Question) => {
    const duplicated: Question = {
      ...q,
      id: `quest-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      text: `${q.text} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setEditingQuestion(duplicated);
    setIsQuestionFormOpen(true);
  };

  const handleToggleStatus = async (q: Question) => {
    let nextStatus: 'published' | 'draft' | 'disabled' = 'published';
    if (q.status === 'published') nextStatus = 'draft';
    else if (q.status === 'draft') nextStatus = 'disabled';
    else nextStatus = 'published';

    const updated: Question = {
      ...q,
      status: nextStatus,
      updatedAt: new Date().toISOString()
    };
    await dbManager.saveQuestion(updated);
    syncClient.broadcastQuestions();
    const qs = await dbManager.getQuestions();
    setQuestions(qs);
    showToast(`Question set to ${updated.status}.`);
  };

  // --- GAME SETTINGS ACTIONS ---
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    if (settings.timerSeconds < 5) {
      showToast('Timer must be at least 5 seconds.');
      return;
    }

    try {
      await dbManager.saveSettings(settings);
      await syncClient.updateSettings(settings);
      soundManager.playCorrect();
      showToast('Game settings successfully updated and synchronized!');
    } catch (err) {
      showToast('Error saving settings.');
    }
  };

  // --- SESSION RECORDS ACTIONS ---
  const handleDeleteSession = async (sess: GameSession) => {
    if (window.confirm(`Are you sure you want to permanently delete session "${sess.id}" for player "${sess.playerName}"?`)) {
      try {
        await syncClient.deleteSession(sess.id);
        const updated = await dbManager.getSessions();
        setSessions(updated);
        soundManager.playCorrect();
        showToast(`Deleted record for "${sess.playerName}" and synced with main site.`);
      } catch (err) {
        showToast('Failed to delete session record.');
      }
    }
  };

  // --- ACCOUNT SETTINGS ACTION ---
  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinMessage(null);

    const actualPin = await dbManager.getAdminPin();
    if (currentPin.trim() !== actualPin) {
      setPinMessage({ text: 'Current password/PIN is incorrect.', type: 'error' });
      soundManager.playIncorrect();
      return;
    }

    if (newPin.trim().length < 4) {
      setPinMessage({ text: 'New PIN must be at least 4 characters long.', type: 'error' });
      soundManager.playIncorrect();
      return;
    }

    if (newPin.trim() !== confirmPin.trim()) {
      setPinMessage({ text: 'New PIN and Confirm PIN do not match.', type: 'error' });
      soundManager.playIncorrect();
      return;
    }

    try {
      await dbManager.setAdminPin(newPin.trim());
      soundManager.playCorrect();
      setPinMessage({ text: 'Admin PIN updated successfully!', type: 'success' });
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    } catch (err) {
      setPinMessage({ text: 'Error saving new PIN.', type: 'error' });
    }
  };

  // --- UNIVERSAL DOCUMENT IMPORT HANDLER (Excel, Word, PDF, CSV) ---
  const handleDocumentFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportedFileName(file.name);
    setIsParsingFile(true);
    setImportStatus(`Analyzing and extracting questions from ${file.name}...`);
    soundManager.playClick();

    try {
      const parsed = await parseUniversalQuestionFile(file);
      setCsvPreviewQuestions(parsed.validQuestions);
      setCsvErrors(parsed.errors);
      setImportStatus(null);

      if (parsed.validQuestions.length > 0) {
        showToast(`Extracted ${parsed.validQuestions.length} questions from ${file.name}`);
        soundManager.playCorrect();
      } else {
        showToast(`No valid questions recognized in ${file.name}. Review warnings below.`);
      }
    } catch (err: any) {
      console.error('File parsing error:', err);
      setImportStatus(`Error parsing ${file.name}: ${err.message || 'Format not recognized'}`);
      showToast(`Error parsing file: ${err.message || 'Failed to read'}`);
    } finally {
      setIsParsingFile(false);
    }
  };

  // --- RESET & CLEAR LEADERBOARD HANDLER ---
  const handleResetLeaderboard = async () => {
    const confirmed = window.confirm(
      '⚠️ CRITICAL ACTION: Are you sure you want to completely RESET and CLEAR all rankings and leaderboard records?\n\n' +
      '• All player scores, completion records, and rankings will be permanently erased.\n' +
      '• Records in this database and on the synchronization service will be wiped.\n\n' +
      'This action CANNOT be undone. Do you wish to continue?'
    );
    if (!confirmed) return;

    try {
      await dbManager.clearAllSessions();
      await syncClient.resetServerRecords();
      setSessions([]);
      soundManager.playCorrect();
      showToast('All rankings and leaderboard records have been reset.');
    } catch (err: any) {
      console.error('Reset error:', err);
      showToast('Error resetting leaderboard records.');
    }
  };

  const handleExecuteCsvImport = async () => {
    if (csvPreviewQuestions.length === 0) {
      showToast('No valid questions to import.');
      return;
    }

    try {
      if (importMode === 'replace') {
        if (!window.confirm('WARNING: "Replace All" mode will overwrite existing questions in the database. Continue?')) {
          return;
        }
        // Save new set
        await dbManager.bulkSaveQuestions(csvPreviewQuestions);
      } else {
        // Append mode
        await dbManager.bulkSaveQuestions(csvPreviewQuestions);
      }

      syncClient.broadcastQuestions();
      const updated = await dbManager.getQuestions();
      setQuestions(updated);
      soundManager.playCorrect();
      setImportStatus(`Successfully imported ${csvPreviewQuestions.length} questions into the library!`);
      showToast(`Imported ${csvPreviewQuestions.length} questions.`);
      setCsvPreviewQuestions([]);
      setCsvFileContent(null);
    } catch (err) {
      setImportStatus('Error importing questions into IndexedDB.');
    }
  };

  // --- BACKUP & RESTORE HANDLERS ---
  const handleExportFullBackup = async () => {
    try {
      const backup = await dbManager.exportBackup();
      const jsonStr = JSON.stringify(backup, null, 2);
      const dateStr = new Date().toISOString().split('T')[0];
      downloadFile(jsonStr, `customer_journey_quest_backup_${dateStr}.json`, 'application/json');
      showToast('Full system backup downloaded.');
    } catch (err) {
      showToast('Error generating backup.');
    }
  };

  const handleBackupFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string) as SystemBackup;
        if (!parsed.questions || !Array.isArray(parsed.questions)) {
          setRestoreMessage('Invalid backup file: missing questions array.');
          setRestoreJson(null);
          return;
        }
        setRestoreJson(parsed);
        setRestoreMessage(`Backup verified: ${parsed.questions.length} questions, ${parsed.sessions?.length || 0} sessions, export date: ${parsed.exportDate || 'Unknown'}`);
      } catch (err) {
        setRestoreMessage('Invalid JSON format.');
        setRestoreJson(null);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async (mode: 'replace' | 'merge') => {
    if (!restoreJson) return;

    const confirmMsg = mode === 'replace'
      ? 'WARNING: This will REPLACE all current questions and game sessions with the backup data. Continue?'
      : 'This will MERGE the backup questions and sessions with your existing records. Continue?';

    if (window.confirm(confirmMsg)) {
      try {
        await dbManager.restoreBackup(restoreJson, mode);
        await loadAllData();
        soundManager.playCorrect();
        showToast(`Restore completed (${mode} mode).`);
        setRestoreJson(null);
        setRestoreMessage(null);
      } catch (err) {
        showToast('Error restoring backup.');
      }
    }
  };

  // --- COMPUTED STATS ---
  const publishedQuestionsCount = questions.filter(q => q.status === 'published' || (q as unknown as { status: string }).status === 'active').length;
  const draftQuestionsCount = questions.filter(q => q.status === 'draft').length;
  const disabledQuestionsCount = questions.filter(q => q.status === 'disabled' || (q as unknown as { status: string }).status === 'inactive').length;
  const allCategories = getJourneyOrderedCategories(settings?.categories);
  const uniquePlayersCount = new Set(sessions.map(s => s.normalizedPlayerName)).size;
  const completedGamesCount = sessions.filter(s => s.status === 'completed').length;
  const highestScoreRecorded = sessions.length > 0 ? Math.max(...sessions.map(s => s.score)) : 0;

  // Question Pagination & Filter (Sorted strictly by Customer Journey department sequence)
  const filteredQuestions = questions.filter(q => {
    const matchesSearch = !qSearch || q.text.toLowerCase().includes(qSearch.toLowerCase()) || q.id.toLowerCase().includes(qSearch.toLowerCase());
    const matchesCat = qCategoryFilter === 'all' || q.category.toLowerCase() === qCategoryFilter.toLowerCase();
    const matchesStatus = qStatusFilter === 'all' || q.status === qStatusFilter;
    return matchesSearch && matchesCat && matchesStatus;
  }).sort((a, b) => {
    const rankA = getJourneyStageRank(a.category, allCategories);
    const rankB = getJourneyStageRank(b.category, allCategories);
    if (rankA !== rankB) return rankA - rankB;
    return a.id.localeCompare(b.id);
  });

  const totalQPages = Math.ceil(filteredQuestions.length / itemsPerPage) || 1;
  const paginatedQuestions = filteredQuestions.slice((qPage - 1) * itemsPerPage, qPage * itemsPerPage);

  // Session Filter
  const filteredSessions = sessions.filter(s => {
    const matchesSearch = !sSearch || s.playerName.toLowerCase().includes(sSearch.toLowerCase()) || s.id.toLowerCase().includes(sSearch.toLowerCase());
    const matchesStatus = sStatusFilter === 'all' || s.status === sStatusFilter || (sStatusFilter === 'timeout' && s.gameOverReason === 'TIME_EXPIRED');
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 animate-fade-in">
      {/* Toast */}
      {toast && (
        <div className="fixed top-20 right-6 z-50 bg-[#102d44] border border-[#38efbf] text-[#38efbf] px-4 py-2.5 rounded-xl shadow-2xl text-xs sm:text-sm font-semibold flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4" />
          <span>{toast}</span>
        </div>
      )}

      {/* Top Admin Header */}
      <div className="bg-[#0b1c2d] border border-[#1b3658] rounded-2xl p-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 flex items-center justify-center shrink-0">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-mono text-[#38efbf] uppercase tracking-wider font-bold">
              Administrator Control Center
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white">
              Quest Configuration & Records
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-end sm:self-auto">
          <button
            onClick={handleManualSyncAndRefresh}
            disabled={isRefreshing}
            className="py-2 px-3.5 rounded-xl bg-[#0c243a] hover:bg-[#122e4d] border border-cyan-500/50 text-cyan-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
            title="Synchronize live rankings and sessions from the sync network"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#38efbf]' : 'text-cyan-400'}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync & Refresh'}</span>
          </button>

          <button
            onClick={handlePublishUpdates}
            disabled={publishing}
            className="py-2 px-3.5 rounded-xl bg-[#38efbf] hover:bg-[#2dd4a6] text-[#061923] text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
            title="Deploy changes to sync server for all game installations"
          >
            <UploadCloud className={`w-3.5 h-3.5 ${publishing ? 'animate-bounce' : ''}`} />
            <span>{publishing ? 'Publishing...' : 'Publish to Game Clients'}</span>
          </button>

          <a
            href="./"
            className="py-2 px-3.5 rounded-xl bg-[#0e243a] hover:bg-[#16385b] border border-cyan-500/30 text-cyan-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Open the player Game interface"
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span>Open Game</span>
          </a>

          <button
            onClick={() => {
              soundManager.playClick();
              onLogout();
            }}
            className="py-2 px-3.5 rounded-xl bg-[#140b12] hover:bg-rose-950/80 border border-rose-500/40 text-rose-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Exit Admin</span>
          </button>
        </div>
      </div>

      {/* Top 8 Dashboard KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 mb-6">
        <div className="bg-[#0b1c2d] border border-[#183658] rounded-xl p-3 text-center">
          <div className="text-[10px] text-[#7ea0b7] font-mono uppercase">Total Qs</div>
          <div className="text-lg font-bold text-white font-mono">{questions.length}</div>
        </div>
        <div className="bg-[#0b1c2d] border border-[#183658] rounded-xl p-3 text-center">
          <div className="text-[10px] text-emerald-400 font-mono uppercase">Published</div>
          <div className="text-lg font-bold text-emerald-300 font-mono">{publishedQuestionsCount}</div>
        </div>
        <div className="bg-[#0b1c2d] border border-[#183658] rounded-xl p-3 text-center">
          <div className="text-[10px] text-amber-400 font-mono uppercase">Drafts</div>
          <div className="text-lg font-bold text-amber-300 font-mono">{draftQuestionsCount}</div>
        </div>
        <div className="bg-[#0b1c2d] border border-[#183658] rounded-xl p-3 text-center">
          <div className="text-[10px] text-cyan-400 font-mono uppercase">Categories</div>
          <div className="text-lg font-bold text-cyan-300 font-mono">{allCategories.length}</div>
        </div>
        <div className="bg-[#0b1c2d] border border-[#183658] rounded-xl p-3 text-center">
          <div className="text-[10px] text-teal-400 font-mono uppercase">Players</div>
          <div className="text-lg font-bold text-teal-300 font-mono">{uniquePlayersCount}</div>
        </div>
        <div className="bg-[#0b1c2d] border border-[#183658] rounded-xl p-3 text-center">
          <div className="text-[10px] text-purple-400 font-mono uppercase">Sessions</div>
          <div className="text-lg font-bold text-purple-300 font-mono">{sessions.length}</div>
        </div>
        <div className="bg-[#0b1c2d] border border-[#183658] rounded-xl p-3 text-center">
          <div className="text-[10px] text-indigo-400 font-mono uppercase">Completed</div>
          <div className="text-lg font-bold text-indigo-300 font-mono">{completedGamesCount}</div>
        </div>
        <div className="bg-[#0b1c2d] border border-[#183658] rounded-xl p-3 text-center">
          <div className="text-[10px] text-amber-400 font-mono uppercase">Revision</div>
          <div className="text-lg font-bold text-amber-300 font-mono">r{syncStatus.localRevision}</div>
        </div>
      </div>

      {/* Main Tab Navigation Bar */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-[#142d4a] pb-3">
        <button
          onClick={() => {
            soundManager.playClick();
            setActiveTab('dashboard');
          }}
          className={`py-2 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'dashboard'
              ? 'bg-[#38efbf] text-[#061923] shadow-md shadow-teal-500/20'
              : 'bg-[#0c1f35] text-slate-300 hover:text-white border border-[#183658]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => {
            soundManager.playClick();
            setActiveTab('questions');
          }}
          className={`py-2 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'questions'
              ? 'bg-[#38efbf] text-[#061923] shadow-md shadow-teal-500/20'
              : 'bg-[#0c1f35] text-slate-300 hover:text-white border border-[#183658]'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Question Management</span>
        </button>

        <button
          onClick={() => {
            soundManager.playClick();
            setActiveTab('settings');
          }}
          className={`py-2 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-[#38efbf] text-[#061923] shadow-md shadow-teal-500/20'
              : 'bg-[#0c1f35] text-slate-300 hover:text-white border border-[#183658]'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Game Settings</span>
        </button>

        <button
          onClick={() => {
            soundManager.playClick();
            setActiveTab('records');
          }}
          className={`py-2 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'records'
              ? 'bg-[#38efbf] text-[#061923] shadow-md shadow-teal-500/20'
              : 'bg-[#0c1f35] text-slate-300 hover:text-white border border-[#183658]'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Player & Score Records</span>
        </button>

        <button
          onClick={() => {
            soundManager.playClick();
            setActiveTab('sync_status');
          }}
          className={`py-2 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'sync_status'
              ? 'bg-[#38efbf] text-[#061923] shadow-md shadow-teal-500/20'
              : 'bg-[#0c1f35] text-slate-300 hover:text-white border border-[#183658]'
          }`}
        >
          <Wifi className="w-3.5 h-3.5" />
          <span>Sync & Deploy</span>
        </button>

        <button
          onClick={() => {
            soundManager.playClick();
            setActiveTab('import_export');
          }}
          className={`py-2 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'import_export'
              ? 'bg-[#38efbf] text-[#061923] shadow-md shadow-teal-500/20'
              : 'bg-[#0c1f35] text-slate-300 hover:text-white border border-[#183658]'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Import & Export</span>
        </button>

        <button
          onClick={() => {
            soundManager.playClick();
            setActiveTab('backup_restore');
          }}
          className={`py-2 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'backup_restore'
              ? 'bg-[#38efbf] text-[#061923] shadow-md shadow-teal-500/20'
              : 'bg-[#0c1f35] text-slate-300 hover:text-white border border-[#183658]'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Backup & Restore</span>
        </button>

        <button
          onClick={() => {
            soundManager.playClick();
            setActiveTab('account');
          }}
          className={`py-2 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'account'
              ? 'bg-[#38efbf] text-[#061923] shadow-md shadow-teal-500/20'
              : 'bg-[#0c1f35] text-slate-300 hover:text-white border border-[#183658]'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>Admin Account</span>
        </button>
      </div>

      {/* TAB 1: DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="bg-[#0b1c2d] border border-[#1b3658] rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-2">Welcome to Customer Journey Quest Administration</h3>
            <p className="text-xs sm:text-sm text-[#8da2b5] leading-relaxed mb-4">
              This panel enables full administration of question libraries, 30-second question timer thresholds, scoring multipliers, historical player sessions, CSV exports, and full JSON database backups directly on your local system without any third-party cloud dependencies.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div
                onClick={() => setActiveTab('questions')}
                className="bg-[#0e243a] border border-[#193b61] rounded-xl p-4 hover:border-[#38efbf] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2 text-[#38efbf] font-bold text-sm mb-1">
                  <HelpCircle className="w-4 h-4" />
                  <span>Manage Question Library</span>
                </div>
                <p className="text-xs text-slate-400">
                  {questions.length} total questions ({publishedQuestionsCount} published). Add, edit, duplicate, or preview questions.
                </p>
              </div>

              <div
                onClick={() => setActiveTab('settings')}
                className="bg-[#0e243a] border border-[#193b61] rounded-xl p-4 hover:border-[#38efbf] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm mb-1">
                  <Settings className="w-4 h-4" />
                  <span>Configure Game Rules</span>
                </div>
                <p className="text-xs text-slate-400">
                  Timer duration ({settings?.timerSeconds || 30}s), questions per journey ({settings?.questionsPerGame || 5}), shuffle toggles.
                </p>
              </div>

              <div
                onClick={() => setActiveTab('backup_restore')}
                className="bg-[#0e243a] border border-[#193b61] rounded-xl p-4 hover:border-[#38efbf] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm mb-1">
                  <Database className="w-4 h-4" />
                  <span>Data Backups</span>
                </div>
                <p className="text-xs text-slate-400">
                  Export complete JSON snapshot or restore database records safely.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: QUESTION MANAGEMENT */}
      {activeTab === 'questions' && (
        <div className="bg-[#0b1c2d] border border-[#1b3658] rounded-2xl p-5 sm:p-6 shadow-xl">
          {/* Header Controls */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-5">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-[#38efbf]" />
                Question Database
              </h3>
              <p className="text-xs text-[#7ea0b7]">
                Add, edit, duplicate, activate/deactivate, and preview questions
              </p>
            </div>

            <button
              onClick={() => {
                soundManager.playClick();
                setEditingQuestion(null);
                setIsQuestionFormOpen(true);
              }}
              className="py-2.5 px-4 rounded-xl bg-[#38efbf] hover:bg-[#2dd4a6] text-[#061923] text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer self-start md:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Question</span>
            </button>
          </div>

          {/* Search and Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={qSearch}
                onChange={(e) => {
                  setQSearch(e.target.value);
                  setQPage(1);
                }}
                placeholder="Search questions by text or ID..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#081525] border border-[#193a5e] text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#38efbf]"
              />
            </div>

            <select
              value={qCategoryFilter}
              onChange={(e) => {
                setQCategoryFilter(e.target.value);
                setQPage(1);
              }}
              className="px-3 py-2 rounded-lg bg-[#081525] border border-[#193a5e] text-xs sm:text-sm text-white focus:outline-none focus:border-[#38efbf]"
            >
              <option value="all">All Categories</option>
              {allCategories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select
              value={qStatusFilter}
              onChange={(e) => {
                setQStatusFilter(e.target.value);
                setQPage(1);
              }}
              className="px-3 py-2 rounded-lg bg-[#081525] border border-[#193a5e] text-xs sm:text-sm text-white focus:outline-none focus:border-[#38efbf]"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          {/* Questions Table */}
          {filteredQuestions.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <p className="text-sm">No questions matched the filter criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#163352] text-[11px] font-mono text-[#7ea0b7] uppercase">
                    <th className="py-3 px-3">ID / Category</th>
                    <th className="py-3 px-4">Question Prompt</th>
                    <th className="py-3 px-4">Correct Key</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#122842] text-xs sm:text-sm">
                  {paginatedQuestions.map((q) => (
                    <tr key={q.id} className="hover:bg-[#0e233a]/50 text-slate-200">
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="text-[10px] font-mono text-slate-400">{q.id}</div>
                        <span className="text-[11px] font-bold text-[#38efbf]">{q.category}</span>
                      </td>
                      <td className="py-3 px-4 max-w-md">
                        <p className="font-medium text-white line-clamp-2">{q.text}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-[#38efbf] font-mono font-bold">+{q.points} pts</span>
                          {q.optionScores && (
                            <span className="text-[10px] text-amber-300 font-mono bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-500/30">
                              Tiered ({Object.values(q.optionScores).join('/')} pts)
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500 font-mono">• {q.options.length} options</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 max-w-xs text-xs text-emerald-300">
                        <span className="line-clamp-2">{q.correctAnswer}</span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleToggleStatus(q)}
                          className={`text-[10px] font-mono px-2.5 py-1 rounded-full border cursor-pointer ${
                            q.status === 'published'
                              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                              : q.status === 'draft'
                              ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}
                        >
                          {q.status === 'published' ? 'Published' : q.status === 'draft' ? 'Draft' : 'Disabled'}
                        </button>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setPreviewingQuestion(q)}
                            title="Preview Question"
                            className="p-1.5 rounded-lg bg-[#081525] hover:bg-[#132d4b] text-cyan-400 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDuplicateQuestion(q)}
                            title="Duplicate Question"
                            className="p-1.5 rounded-lg bg-[#081525] hover:bg-[#132d4b] text-teal-400 transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingQuestion(q);
                              setIsQuestionFormOpen(true);
                            }}
                            title="Edit Question"
                            className="p-1.5 rounded-lg bg-[#081525] hover:bg-[#132d4b] text-amber-400 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(q)}
                            title="Delete Question"
                            className="p-1.5 rounded-lg bg-[#081525] hover:bg-rose-950/80 text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalQPages > 1 && (
            <div className="flex items-center justify-between border-t border-[#163352] pt-4 mt-4 text-xs text-[#7ea0b7]">
              <span>
                Page {qPage} of {totalQPages} ({filteredQuestions.length} questions)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={qPage <= 1}
                  onClick={() => setQPage(prev => Math.max(1, prev - 1))}
                  className="p-1.5 rounded-lg bg-[#081525] border border-[#193a5e] text-slate-300 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={qPage >= totalQPages}
                  onClick={() => setQPage(prev => Math.min(totalQPages, prev + 1))}
                  className="p-1.5 rounded-lg bg-[#081525] border border-[#193a5e] text-slate-300 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: GAME SETTINGS */}
      {activeTab === 'settings' && settings && (
        <div className="bg-[#0b1c2d] border border-[#1b3658] rounded-2xl p-6 shadow-xl max-w-3xl">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
            <Settings className="w-5 h-5 text-cyan-400" />
            Gameplay & Scoring Rules
          </h3>
          <p className="text-xs text-[#7ea0b7] mb-6">
            Changes apply to future game sessions and preserve historical records
          </p>

          <form onSubmit={handleSaveSettings} className="space-y-5">
            {/* Timer setting */}
            <div className="bg-[#081525] p-4 rounded-xl border border-[#183658]">
              <label className="block text-sm font-semibold text-white mb-1 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#38efbf]" />
                  Question Countdown Timer (Seconds)
                </span>
                <span className="text-xs text-[#38efbf] font-mono">Default: 30s</span>
              </label>
              <p className="text-xs text-[#8da2b5] mb-2.5">
                Mandatory countdown timer. If zero is reached, the entire game ends immediately.
              </p>
              <input
                type="number"
                min={5}
                max={120}
                value={settings.timerSeconds}
                onChange={(e) => setSettings({ ...settings, timerSeconds: parseInt(e.target.value, 10) || 30 })}
                className="w-full sm:w-48 px-3.5 py-2 rounded-lg bg-[#0b1c2d] border border-[#1d436c] text-white font-mono text-sm focus:outline-none focus:border-[#38efbf]"
              />
            </div>

            {/* Questions per game */}
            <div className="bg-[#081525] p-4 rounded-xl border border-[#183658]">
              <label className="block text-sm font-semibold text-white mb-1">
                Questions Per Game Session
              </label>
              <p className="text-xs text-[#8da2b5] mb-2.5">
                Number of questions presented to the player during each quest attempt.
              </p>
              <input
                type="number"
                min={1}
                max={questions.length || 50}
                value={settings.questionsPerGame}
                onChange={(e) => setSettings({ ...settings, questionsPerGame: parseInt(e.target.value, 10) || 5 })}
                className="w-full sm:w-48 px-3.5 py-2 rounded-lg bg-[#0b1c2d] border border-[#1d436c] text-white font-mono text-sm focus:outline-none focus:border-[#38efbf]"
              />
            </div>

            {/* Shuffle options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-[#081525] p-4 rounded-xl border border-[#183658] flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">Shuffle Question Order</div>
                  <div className="text-xs text-[#7ea0b7]">Randomize sequence for each game</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.shuffleQuestions}
                  onChange={(e) => setSettings({ ...settings, shuffleQuestions: e.target.checked })}
                  className="w-5 h-5 accent-[#38efbf] cursor-pointer"
                />
              </div>

              <div className="bg-[#081525] p-4 rounded-xl border border-[#183658] flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">Shuffle Answer Options</div>
                  <div className="text-xs text-[#7ea0b7]">Randomize A, B, C, D placements</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.shuffleAnswers}
                  onChange={(e) => setSettings({ ...settings, shuffleAnswers: e.target.checked })}
                  className="w-5 h-5 accent-[#38efbf] cursor-pointer"
                />
              </div>
            </div>

            {/* Negative points */}
            <div className="bg-[#081525] p-4 rounded-xl border border-[#183658] flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-white">Allow Negative Scores on Incorrect Answers</div>
                <div className="text-xs text-[#7ea0b7]">Deduct points when player submits a wrong answer (default: disabled)</div>
              </div>
              <input
                type="checkbox"
                checked={settings.allowNegativePoints}
                onChange={(e) => setSettings({ ...settings, allowNegativePoints: e.target.checked })}
                className="w-5 h-5 accent-rose-500 cursor-pointer"
              />
            </div>

            <button
              type="submit"
              className="py-3 px-6 rounded-xl bg-[#38efbf] hover:bg-[#2dd4a6] text-[#061923] font-bold text-sm shadow-md cursor-pointer"
            >
              Save Game Settings
            </button>

            {/* Danger Zone: Reset Leaderboard */}
            <div className="mt-6 pt-6 border-t border-[#132d4b]">
              <div className="bg-[#170a14] border border-rose-500/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    Leaderboard & Rankings Reset
                  </h4>
                  <p className="text-xs text-rose-200/70 mt-0.5">
                    Permanently wipe all recorded game sessions, player scores, and rankings across this device and sync server.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetLeaderboard}
                  disabled={sessions.length === 0}
                  className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Leaderboard ({sessions.length} records)</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: PLAYER & SCORE RECORDS */}
      {activeTab === 'records' && (
        <div className="bg-[#0b1c2d] border border-[#1b3658] rounded-2xl p-5 sm:p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                Player & Score Records
              </h3>
              <p className="text-xs text-[#7ea0b7]">
                Audit past game sessions, review decision snapshots, and manage history
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleManualSyncAndRefresh}
                disabled={isRefreshing}
                className="py-2 px-3 rounded-lg bg-[#0c243a] hover:bg-[#122e4d] border border-cyan-500/50 text-cyan-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Fetch latest rankings and sessions from the sync server"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#38efbf]' : 'text-cyan-400'}`} />
                <span>Sync & Refresh Records</span>
              </button>

              <button
                onClick={() => {
                  soundManager.playClick();
                  const csv = exportSessionsToCsv(sessions);
                  downloadFile(csv, `sessions_backup_${new Date().toISOString().split('T')[0]}.csv`);
                }}
                disabled={sessions.length === 0}
                className="py-2 px-3 rounded-lg bg-[#0c243a] hover:bg-[#122e4d] border border-[#1c456f] text-slate-200 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#38efbf]" />
                <span>Export Sessions CSV</span>
              </button>

              <button
                onClick={handleResetLeaderboard}
                disabled={sessions.length === 0}
                className="py-2 px-3 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-500/50 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Completely reset and clear all player scores and leaderboard rankings"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                <span>Reset / Clear Leaderboard</span>
              </button>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={sSearch}
                onChange={(e) => setSSearch(e.target.value)}
                placeholder="Search by player name or session ID..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#081525] border border-[#193a5e] text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#38efbf]"
              />
            </div>

            <select
              value={sStatusFilter}
              onChange={(e) => setSStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-[#081525] border border-[#193a5e] text-xs sm:text-sm text-white focus:outline-none focus:border-[#38efbf]"
            >
              <option value="all">All Outcomes</option>
              <option value="completed">Completed Quests Only</option>
              <option value="timeout">Time Expired Games Only</option>
            </select>
          </div>

          {filteredSessions.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <p className="text-sm">No historical sessions found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#163352] text-[11px] font-mono text-[#7ea0b7] uppercase">
                    <th className="py-3 px-3">Session ID</th>
                    <th className="py-3 px-4">Player</th>
                    <th className="py-3 px-3 text-right">Score</th>
                    <th className="py-3 px-3 text-center">Correct</th>
                    <th className="py-3 px-3 text-center">Outcome</th>
                    <th className="py-3 px-4 text-right">Date Played</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#122842] text-xs sm:text-sm">
                  {filteredSessions.map((s) => (
                    <tr key={s.id} className="hover:bg-[#0e233a]/50 text-slate-200">
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {s.id.slice(0, 16)}...
                      </td>
                      <td className="py-3 px-4 font-semibold text-white whitespace-nowrap">
                        {s.playerName}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-amber-300">
                        {s.score} pts
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        <span className="text-emerald-400">{s.correctCount}</span>
                        <span className="text-slate-500"> / {s.totalQuestions}</span>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {s.gameOverReason === 'TIME_EXPIRED' ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-950/60 border border-rose-500/40 text-rose-300">
                            Time Expired
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300">
                            Completed
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-xs text-slate-400 font-mono whitespace-nowrap">
                        {new Date(s.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setInspectingSession(s)}
                            title="Inspect Snapshots"
                            className="p-1.5 rounded-lg bg-[#081525] hover:bg-[#132d4b] text-cyan-400"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSession(s)}
                            title="Delete Session"
                            className="p-1.5 rounded-lg bg-[#081525] hover:bg-rose-950/80 text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB: SYNC STATUS & DEPLOYMENT */}
      {activeTab === 'sync_status' && (
        <div className="space-y-6">
          <div className="bg-[#0b1c2d] border border-[#1b3658] rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Wifi className="w-5 h-5 text-[#38efbf]" />
                  Central Synchronization & Deployment Service
                </h3>
                <p className="text-xs text-[#7ea0b7] mt-0.5">
                  Publish authoritative question bundles and receive competition session records from all connected devices.
                </p>
              </div>

              <span
                className={`text-xs font-mono px-3 py-1 rounded-full font-bold flex items-center gap-1.5 ${
                  syncStatus.isOnline
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                    : 'bg-amber-950 text-amber-300 border border-amber-500/50'
                }`}
              >
                {syncStatus.isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                {syncStatus.isOnline ? 'Service Online' : 'Service Disconnected'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-[#081525] p-4 rounded-xl border border-[#193a5e]">
                <div className="text-[10px] text-[#7ea0b7] uppercase font-mono">Current Revision</div>
                <div className="text-2xl font-bold text-amber-300 font-mono mt-1">r{syncStatus.localRevision}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Server: r{syncStatus.serverRevision}</div>
              </div>

              <div className="bg-[#081525] p-4 rounded-xl border border-[#193a5e]">
                <div className="text-[10px] text-[#7ea0b7] uppercase font-mono">Last Sync Check</div>
                <div className="text-xl font-bold text-slate-200 font-mono mt-1 truncate">{syncStatus.lastSyncTime || 'Active'}</div>
                <div className="text-[11px] text-emerald-400 mt-0.5 font-mono">Status: Connected</div>
              </div>

              <div className="bg-[#081525] p-4 rounded-xl border border-[#193a5e]">
                <div className="text-[10px] text-[#7ea0b7] uppercase font-mono">Pending Records</div>
                <div className="text-2xl font-bold text-cyan-300 font-mono mt-1">{syncStatus.pendingSyncCount}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Total sessions: {sessions.length}</div>
              </div>

              <div className="bg-[#081525] p-4 rounded-xl border border-[#193a5e]">
                <div className="text-[10px] text-[#7ea0b7] uppercase font-mono">Published Questions</div>
                <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">{publishedQuestionsCount}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">({draftQuestionsCount} drafts not deployed)</div>
              </div>
            </div>

            {/* Live Sync Callout */}
            <div className="p-4 rounded-xl bg-teal-950/30 border border-teal-500/30 mb-6">
              <h5 className="text-xs font-bold text-teal-300 uppercase tracking-wider mb-1 flex items-center gap-1.5 font-mono">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#38efbf]" />
                Live Cloud Synchronization Active
              </h5>
              <p className="text-xs text-[#8da2b5] leading-relaxed">
                Questions, question timer settings, and scoring parameters are kept in continuous sync with all game clients. Changes published from this Admin Portal are instantly applied to the live game via the cloud API and real-time broadcast channel.
              </p>
            </div>

            <div className="bg-[#081525] p-4 rounded-xl border border-[#183658] mb-6 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold">Synchronization Server URL</span>
                <span className="text-slate-400 font-mono text-[11px]">Default: Cloud API (Same Origin)</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  defaultValue={syncClient.getSyncUrl()}
                  placeholder="(Cloud API Auto-Detected)"
                  onBlur={(e) => syncClient.setSyncUrl(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-[#05111d] border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-[#38efbf]"
                />
                <button
                  onClick={handleManualSyncAndRefresh}
                  disabled={isRefreshing}
                  className="py-2 px-4 rounded-lg bg-[#0c243a] hover:bg-[#122e4d] border border-[#1c456f] text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-[#38efbf] ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>{isRefreshing ? 'Checking...' : 'Synchronize Now'}</span>
                </button>
              </div>
            </div>

            {/* Big Action: Publish Question Bank */}
            <div className="p-4 rounded-xl bg-teal-950/40 border border-teal-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 text-[#38efbf]" />
                  Publish Question Bank to Competition Devices
                </h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  Publishes all {publishedQuestionsCount} active questions and current game settings to the sync service. All connected game instances will receive this update automatically.
                </p>
              </div>

              <button
                onClick={handlePublishUpdates}
                disabled={publishing}
                className="py-3 px-6 rounded-xl bg-[#38efbf] hover:bg-[#2dd4a6] text-[#061923] font-bold text-sm shadow-md transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                {publishing ? 'Publishing Updates...' : 'Publish Question Bank'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: IMPORT & EXPORT */}
      {activeTab === 'import_export' && (
        <div className="space-y-6">
          {/* CSV Export & JSON Export */}
          <div className="bg-[#0b1c2d] border border-[#1b3658] rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Download className="w-5 h-5 text-[#38efbf]" />
              Export Question Library
            </h3>
            <p className="text-xs text-[#7ea0b7] mb-4">
              Download your current questions in standard CSV or structured JSON formats.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  soundManager.playClick();
                  const csv = exportQuestionsToCsv(questions);
                  downloadFile(csv, `quest_questions_${new Date().toISOString().split('T')[0]}.csv`);
                }}
                className="py-2.5 px-4 rounded-xl bg-[#0c243a] hover:bg-[#122e4d] border border-[#1c456f] text-slate-200 text-xs sm:text-sm font-semibold flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4 text-[#38efbf]" />
                <span>Export Questions (CSV)</span>
              </button>

              <button
                onClick={() => {
                  soundManager.playClick();
                  const jsonStr = JSON.stringify(questions, null, 2);
                  downloadFile(jsonStr, `quest_questions_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
                }}
                className="py-2.5 px-4 rounded-xl bg-[#0c243a] hover:bg-[#122e4d] border border-[#1c456f] text-slate-200 text-xs sm:text-sm font-semibold flex items-center gap-2 cursor-pointer"
              >
                <FolderOpen className="w-4 h-4 text-cyan-400" />
                <span>Export Questions (JSON)</span>
              </button>
            </div>
          </div>

          {/* Universal Document & Spreadsheet Import Section */}
          <div className="bg-[#0b1c2d] border border-[#1b3658] rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-teal-400" />
                Import Questions (Excel, Word, PDF, CSV)
              </h3>

              {/* Supported Format Badges */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="px-2.5 py-1 rounded-md bg-[#081525] border border-emerald-500/40 text-[11px] font-mono font-semibold text-emerald-400 flex items-center gap-1">
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Excel (.xlsx, .xls)
                </span>
                <span className="px-2.5 py-1 rounded-md bg-[#081525] border border-blue-500/40 text-[11px] font-mono font-semibold text-blue-400 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" /> Word (.docx, .doc)
                </span>
                <span className="px-2.5 py-1 rounded-md bg-[#081525] border border-rose-500/40 text-[11px] font-mono font-semibold text-rose-400 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" /> PDF (.pdf)
                </span>
                <span className="px-2.5 py-1 rounded-md bg-[#081525] border border-amber-500/40 text-[11px] font-mono font-semibold text-amber-400 flex items-center gap-1">
                  <Database className="w-3.5 h-3.5" /> CSV / Text
                </span>
              </div>
            </div>

            <p className="text-xs text-[#7ea0b7] mb-4">
              Upload spreadsheets, Word documents, or PDF files containing questions. The intelligent parser extracts prompts, options (A, B, C, D), correct keys, and department categories before committing.
            </p>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,.docx,.doc,.pdf,.txt"
                  onChange={handleDocumentFileSelected}
                  disabled={isParsingFile}
                  className="text-xs text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#38efbf] file:text-[#061923] hover:file:bg-[#2dd4a6] cursor-pointer disabled:opacity-50"
                />

                <div className="flex items-center gap-4 text-xs text-slate-300">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="append"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      className="accent-[#38efbf]"
                    />
                    <span>Append to library</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="accent-rose-500"
                    />
                    <span>Replace all existing</span>
                  </label>
                </div>
              </div>

              {isParsingFile && (
                <div className="p-3 rounded-lg bg-[#081525] border border-[#1d436c] text-xs text-cyan-300 flex items-center gap-2 animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#38efbf]" />
                  <span>Parsing and extracting questions from {importedFileName || 'document'}...</span>
                </div>
              )}

              {/* Parsing Warnings / Error Reports */}
              {csvErrors.length > 0 && (
                <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 space-y-2">
                  <div className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Document Validation Warnings ({csvErrors.length} notices):</span>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1 text-[11px] text-rose-200 font-mono">
                    {csvErrors.map((err, i) => (
                      <div key={i}>
                        Notice {err.row}: {err.error} <span className="text-slate-400">[{err.rawText}]</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Document Valid Preview Table */}
              {csvPreviewQuestions.length > 0 && (
                <div className="border border-[#193b61] rounded-xl p-4 bg-[#081525]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Ready to Import: {csvPreviewQuestions.length} Valid Questions {importedFileName ? `from ${importedFileName}` : ''}
                    </span>
                    <button
                      onClick={handleExecuteCsvImport}
                      className="py-1.5 px-4 rounded-lg bg-[#38efbf] hover:bg-[#2dd4a6] text-[#061923] font-bold text-xs shadow-md cursor-pointer transition-all"
                    >
                      Commit Import
                    </button>
                  </div>

                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-800 text-xs">
                    {csvPreviewQuestions.slice(0, 5).map((q, i) => (
                      <div key={i} className="py-2">
                        <span className="font-mono text-[10px] text-[#38efbf]">[{q.category}]</span>{' '}
                        <span className="text-white font-medium">{q.text}</span>
                        <div className="text-[10px] text-emerald-300 mt-0.5">Correct: {q.correctAnswer}</div>
                      </div>
                    ))}
                    {csvPreviewQuestions.length > 5 && (
                      <div className="py-2 text-[11px] text-slate-400 text-center">
                        ...and {csvPreviewQuestions.length - 5} more questions.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {importStatus && !isParsingFile && (
                <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{importStatus}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: BACKUP & RESTORE */}
      {activeTab === 'backup_restore' && (
        <div className="space-y-6">
          <div className="bg-[#0b1c2d] border border-[#1b3658] rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Database className="w-5 h-5 text-amber-400" />
              Full System Backup
            </h3>
            <p className="text-xs text-[#7ea0b7] mb-4">
              Create an exact JSON archive containing questions, gameplay rules, categories, and all historical game sessions.
            </p>

            <button
              onClick={handleExportFullBackup}
              className="py-2.5 px-5 rounded-xl bg-[#38efbf] hover:bg-[#2dd4a6] text-[#061923] text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Full System Backup (JSON)</span>
            </button>
          </div>

          <div className="bg-[#0b1c2d] border border-[#1b3658] rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-cyan-400" />
              Restore System from Backup
            </h3>
            <p className="text-xs text-[#7ea0b7] mb-4">
              Restore previously saved backup file. Validate contents before committing changes.
            </p>

            <div className="space-y-4">
              <input
                type="file"
                accept=".json"
                onChange={handleBackupFileSelected}
                className="text-xs text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#0c243a] file:border file:border-[#1c456f] file:text-slate-200 hover:file:bg-[#122e4d] cursor-pointer"
              />

              {restoreMessage && (
                <div className="p-3.5 rounded-xl bg-[#081525] border border-[#1b3d63] text-xs text-slate-200">
                  {restoreMessage}
                </div>
              )}

              {restoreJson && (
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => handleExecuteRestore('replace')}
                    className="py-2 px-4 rounded-xl bg-rose-900 hover:bg-rose-800 text-rose-100 text-xs font-bold transition-all shadow-md cursor-pointer"
                  >
                    Replace All Data
                  </button>

                  <button
                    onClick={() => handleExecuteRestore('merge')}
                    className="py-2 px-4 rounded-xl bg-[#0e2c47] hover:bg-[#153a5c] border border-[#214f7d] text-teal-200 text-xs font-semibold cursor-pointer"
                  >
                    Merge with Existing Data
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: ADMIN ACCOUNT SETTINGS */}
      {activeTab === 'account' && (
        <div className="bg-[#0b1c2d] border border-[#1b3658] rounded-2xl p-6 shadow-xl max-w-md">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
            <KeyRound className="w-5 h-5 text-[#38efbf]" />
            Change Administrator PIN
          </h3>
          <p className="text-xs text-[#7ea0b7] mb-5">
            Update the credentials required to enter this admin panel
          </p>

          <form onSubmit={handleChangePin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                Current Admin PIN
              </label>
              <input
                type="password"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                placeholder="Enter current PIN"
                className="w-full px-3 py-2 rounded-lg bg-[#081525] border border-[#1b3e64] text-white text-sm focus:outline-none focus:border-[#38efbf]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                New Admin PIN (min 4 characters)
              </label>
              <input
                type="password"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="Enter new PIN"
                className="w-full px-3 py-2 rounded-lg bg-[#081525] border border-[#1b3e64] text-white text-sm focus:outline-none focus:border-[#38efbf]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1">
                Confirm New PIN
              </label>
              <input
                type="password"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="Confirm new PIN"
                className="w-full px-3 py-2 rounded-lg bg-[#081525] border border-[#1b3e64] text-white text-sm focus:outline-none focus:border-[#38efbf]"
              />
            </div>

            {pinMessage && (
              <div
                className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                  pinMessage.type === 'success'
                    ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/60 border border-rose-500/40 text-rose-300'
                }`}
              >
                {pinMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                <span>{pinMessage.text}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-[#38efbf] hover:bg-[#2dd4a6] text-[#061923] font-bold text-xs shadow-md cursor-pointer"
            >
              Update Password / PIN
            </button>
          </form>
        </div>
      )}

      {/* Modals */}
      {isQuestionFormOpen && (
        <QuestionFormModal
          initialQuestion={editingQuestion}
          categories={allCategories}
          existingQuestions={questions}
          onSave={handleSaveQuestion}
          onCancel={() => {
            setIsQuestionFormOpen(false);
            setEditingQuestion(null);
          }}
          onPreview={(q) => setPreviewingQuestion(q)}
        />
      )}

      {previewingQuestion && (
        <QuestionPreviewModal
          question={previewingQuestion}
          onClose={() => setPreviewingQuestion(null)}
        />
      )}

      {inspectingSession && (
        <SessionDetailModal
          session={inspectingSession}
          onClose={() => setInspectingSession(null)}
        />
      )}
    </div>
  );
};
