import React, { useState, useEffect, useCallback } from 'react';
import { 
  Trophy, 
  Calendar, 
  UserCheck, 
  History, 
  Search, 
  Download, 
  ArrowLeft, 
  Users, 
  Sparkles,
  RefreshCw,
  Crown,
  Medal
} from 'lucide-react';
import { LeaderboardItem } from '../types';
import { dbManager } from '../utils/db';
import { syncClient } from '../utils/syncClient';
import { exportLeaderboardToCsv, downloadFile } from '../utils/csv';
import { soundManager } from '../utils/audio';

interface LeaderboardScreenProps {
  onBack: () => void;
  activePlayerName?: string;
  latestSessionId?: string;
}

export const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({
  onBack,
  activePlayerName,
  latestSessionId
}) => {
  const [activeTab, setActiveTab] = useState<'overall' | 'today' | 'personal_bests' | 'player_history'>('overall');
  const [entries, setEntries] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(activePlayerName || '');

  // High-level statistics
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [totalGames, setTotalGames] = useState(0);

  const loadLeaderboardData = useCallback(async (showSpinner: boolean = false) => {
    if (showSpinner) setLoading(true);
    try {
      const data = await dbManager.getLeaderboard(activeTab, searchTerm);
      setEntries(data);

      // Compute summary stats
      const allSessions = await dbManager.getSessions();
      setTotalGames(allSessions.length);

      const uniquePlayersSet = new Set(allSessions.map(s => s.normalizedPlayerName));
      setTotalPlayers(uniquePlayersSet.size);
    } catch (err) {
      console.error('Error loading leaderboard:', err);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [activeTab, searchTerm]);

  useEffect(() => {
    loadLeaderboardData(true);
    syncClient.triggerSync().then(() => {
      loadLeaderboardData(false);
    }).catch(() => {});
  }, [activeTab]);

  useEffect(() => {
    loadLeaderboardData(false);
    const unsub = syncClient.subscribe(() => {
      loadLeaderboardData(false);
    });
    return () => unsub();
  }, [loadLeaderboardData]);

  const handleExportCsv = () => {
    soundManager.playClick();
    const csv = exportLeaderboardToCsv(entries);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadFile(csv, `quest_leaderboard_${activeTab}_${dateStr}.csv`);
  };

  const isSearching = !!searchTerm.trim();
  const matchesSearch = (item: LeaderboardItem | null) =>
    !item ? false : (!isSearching || item.playerName.toLowerCase().includes(searchTerm.trim().toLowerCase()));

  // Top 3 Championship Podium entries
  const top1 = entries[0] || null;
  const top2 = entries[1] || null;
  const top3 = entries[2] || null;

  // Ranks 4 and onward for the runner-up table
  const rank4AndBeyond = entries.slice(3);
  const tableEntries = isSearching
    ? rank4AndBeyond.filter(e => e.playerName.toLowerCase().includes(searchTerm.trim().toLowerCase()))
    : rank4AndBeyond;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 sm:py-8 animate-fade-in">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              soundManager.playClick();
              onBack();
            }}
            className="p-2.5 rounded-xl bg-[#0c1f35] hover:bg-[#132d4b] border border-[#1b3d63] text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Return to Game"
          >
            <ArrowLeft className="w-5 h-5 text-[#38efbf]" />
          </button>
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2">
              <Trophy className="w-7 h-7 text-amber-400" />
              Customer Journey Leaderboard
            </h2>
            <p className="text-xs sm:text-sm text-[#7ea0b7]">
              Rankings, high scores, and persistent player records
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={async () => {
              soundManager.playClick();
              setLoading(true);
              try {
                await syncClient.triggerSync();
              } catch {}
              await loadLeaderboardData(true);
              soundManager.playCorrect();
            }}
            className="py-2.5 px-4 rounded-xl bg-[#0c243a] hover:bg-[#122e4d] border border-cyan-500/50 text-cyan-300 hover:text-white text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer"
            title="Sync and refresh leaderboard records"
          >
            <RefreshCw className={`w-4 h-4 text-[#38efbf] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={entries.length === 0}
            className="py-2.5 px-4 rounded-xl bg-[#0c243a] hover:bg-[#122e4d] border border-[#1c456f] text-slate-200 hover:text-white text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#38efbf]" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards Grid (Unique Players & Total Games) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
        <div className="bg-[#0b1c2d] border border-[#1b3658] rounded-xl p-4 flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-teal-950/60 border border-teal-500/30 text-[#38efbf]">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-[#7ea0b7] uppercase font-mono tracking-wider">Unique Players</div>
            <div className="text-xl sm:text-2xl font-bold text-white font-mono">{totalPlayers}</div>
          </div>
        </div>

        <div className="bg-[#0b1c2d] border border-[#1b3658] rounded-xl p-4 flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-[#7ea0b7] uppercase font-mono tracking-wider">Total Games Played</div>
            <div className="text-xl sm:text-2xl font-bold text-white font-mono">{totalGames}</div>
          </div>
        </div>
      </div>

      {/* Tabs and Search Bar */}
      <div className="bg-[#0b1c2d] border border-[#1b3658] rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#142d4a]">
          {/* Navigation Tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                soundManager.playClick();
                setActiveTab('overall');
              }}
              className={`py-2 px-3.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'overall'
                  ? 'bg-[#38efbf] text-[#061923] shadow-md shadow-teal-500/20'
                  : 'bg-[#0c1f35] text-slate-300 hover:text-white hover:bg-[#132d4b] border border-[#193a5e]'
              }`}
            >
              <Trophy className="w-4 h-4" />
              <span>Overall Rankings</span>
            </button>

            <button
              onClick={() => {
                soundManager.playClick();
                setActiveTab('today');
              }}
              className={`py-2 px-3.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'today'
                  ? 'bg-[#38efbf] text-[#061923] shadow-md shadow-teal-500/20'
                  : 'bg-[#0c1f35] text-slate-300 hover:text-white hover:bg-[#132d4b] border border-[#193a5e]'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Today's Rankings</span>
            </button>

            <button
              onClick={() => {
                soundManager.playClick();
                setActiveTab('personal_bests');
              }}
              className={`py-2 px-3.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'personal_bests'
                  ? 'bg-[#38efbf] text-[#061923] shadow-md shadow-teal-500/20'
                  : 'bg-[#0c1f35] text-slate-300 hover:text-white hover:bg-[#132d4b] border border-[#193a5e]'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Personal Bests</span>
            </button>

            <button
              onClick={() => {
                soundManager.playClick();
                setActiveTab('player_history');
              }}
              className={`py-2 px-3.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'player_history'
                  ? 'bg-[#38efbf] text-[#061923] shadow-md shadow-teal-500/20'
                  : 'bg-[#0c1f35] text-slate-300 hover:text-white hover:bg-[#132d4b] border border-[#193a5e]'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Player History</span>
            </button>
          </div>

          {/* Search box */}
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search player name..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#081525] border border-[#1a3a5f] text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#38efbf]"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <div className="w-8 h-8 border-2 border-[#38efbf] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <span>Loading player standings...</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="py-16 text-center">
            <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-300 mb-1">No session records found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Start a new Customer Journey Quest to log your score on the leaderboard!
            </p>
          </div>
        ) : (
          <div>
            {/* ======================================================== */}
            {/* TOP 1-3 CHAMPIONSHIP PODIUM STAGE                        */}
            {/* ======================================================== */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-400" />
                  <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white">
                    Top 1–3 Championship Podium
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-[#7ea0b7]">
                  Podium Stage
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                {/* 2ND PLACE (SILVER) - Left on desktop */}
                <div className="order-2 md:order-1 flex flex-col">
                  {top2 ? (
                    <div
                      className={`relative rounded-2xl p-5 border transition-all duration-300 flex flex-col justify-between ${
                        latestSessionId === top2.id
                          ? 'bg-gradient-to-b from-[#182a3d] to-[#0a1827] border-slate-200 shadow-[0_0_25px_rgba(226,232,240,0.25)] ring-2 ring-slate-300'
                          : isSearching && matchesSearch(top2)
                          ? 'bg-gradient-to-b from-[#192c42] to-[#0a1827] border-[#38efbf] shadow-[0_0_20px_rgba(56,239,191,0.25)]'
                          : isSearching && !matchesSearch(top2)
                          ? 'bg-[#091624]/60 border-slate-700/50 opacity-40'
                          : 'bg-gradient-to-b from-[#132235] to-[#081525] border-slate-400/50 hover:border-slate-300 shadow-lg'
                      }`}
                    >
                      {/* Top medal header */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-slate-300/15 border border-slate-300/40 text-slate-200">
                          <Medal className="w-3.5 h-3.5 text-slate-300" />
                          2ND PLACE • SILVER
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                          {top2.durationSeconds}s
                        </span>
                      </div>

                      {/* Player avatar & name */}
                      <div className="flex items-center gap-3 my-2">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-400 text-slate-950 font-black text-xl flex items-center justify-center shadow-md">
                          {top2.playerName.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                          <div className="text-base sm:text-lg font-bold text-white truncate" title={top2.playerName}>
                            {top2.playerName}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {top2.correctCount}/{top2.totalQuestions} Correct Answers
                          </div>
                        </div>
                      </div>

                      {/* Score display */}
                      <div className="mt-4 pt-3 border-t border-slate-700/40 flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-wider font-mono text-slate-400">Score</span>
                        <div className="text-2xl font-black font-mono text-slate-200">
                          {top2.score} <span className="text-xs font-normal text-slate-400">pts</span>
                        </div>
                      </div>

                      {/* Pedestal Base */}
                      <div className="mt-3 py-2 px-3 rounded-xl bg-slate-400/10 border border-slate-300/30 text-center font-mono font-black text-slate-300 text-xs sm:text-sm tracking-wider">
                        🥈 2ND PLACE PEDESTAL
                      </div>
                    </div>
                  ) : (
                    /* Empty Slot #2 */
                    <div className="rounded-2xl p-6 border-2 border-dashed border-slate-800 bg-[#081525]/40 text-center flex flex-col items-center justify-center min-h-[220px]">
                      <Medal className="w-8 h-8 text-slate-700 mb-2" />
                      <span className="text-xs font-mono text-slate-500 uppercase font-semibold">2nd Place Unclaimed</span>
                      <span className="text-[10px] text-slate-600 mt-1">Play a quest to claim Rank 2</span>
                    </div>
                  )}
                </div>

                {/* 1ST PLACE (GOLD) - Center, elevated on desktop */}
                <div className="order-1 md:order-2 flex flex-col md:-translate-y-4">
                  {top1 ? (
                    <div
                      className={`relative rounded-2xl p-6 border transition-all duration-300 flex flex-col justify-between ${
                        latestSessionId === top1.id
                          ? 'bg-gradient-to-b from-[#2e2308] via-[#1a1c29] to-[#081525] border-amber-300 shadow-[0_0_35px_rgba(251,191,36,0.35)] ring-2 ring-amber-400'
                          : isSearching && matchesSearch(top1)
                          ? 'bg-gradient-to-b from-[#2e2308] via-[#1a1c29] to-[#081525] border-[#38efbf] shadow-[0_0_30px_rgba(56,239,191,0.35)]'
                          : isSearching && !matchesSearch(top1)
                          ? 'bg-[#091624]/60 border-amber-800/40 opacity-40'
                          : 'bg-gradient-to-b from-[#241c08] via-[#141b29] to-[#081525] border-amber-400/80 hover:border-amber-300 shadow-[0_0_30px_rgba(251,191,36,0.25)]'
                      }`}
                    >
                      {/* Top crown badge */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-black bg-amber-400/20 border border-amber-400/60 text-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.3)]">
                          <Crown className="w-4 h-4 text-amber-300" />
                          1ST PLACE • CHAMPION
                        </span>
                        <span className="text-xs font-mono text-amber-300/80">
                          {top1.durationSeconds}s
                        </span>
                      </div>

                      {/* Player avatar & name */}
                      <div className="flex items-center gap-3.5 my-3">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-300 via-amber-400 to-yellow-500 text-slate-950 font-black text-2xl flex items-center justify-center shadow-[0_0_20px_rgba(251,191,36,0.4)]">
                          {top1.playerName.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                          <div className="text-lg sm:text-xl font-black text-amber-100 truncate" title={top1.playerName}>
                            {top1.playerName}
                          </div>
                          <div className="text-xs text-amber-300/80 font-mono font-semibold">
                            {top1.correctCount}/{top1.totalQuestions} Correct Answers
                          </div>
                        </div>
                      </div>

                      {/* Score display */}
                      <div className="mt-4 pt-3 border-t border-amber-500/30 flex items-center justify-between">
                        <span className="text-xs uppercase tracking-wider font-mono text-amber-300/70">Winning Score</span>
                        <div className="text-3xl font-black font-mono text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.4)]">
                          {top1.score} <span className="text-sm font-normal text-amber-400/70">pts</span>
                        </div>
                      </div>

                      {/* Pedestal Base */}
                      <div className="mt-3 py-2.5 px-4 rounded-xl bg-amber-400/15 border border-amber-400/40 text-center font-mono font-black text-amber-300 text-sm sm:text-base tracking-wider shadow-inner">
                        👑 1ST PLACE PEDESTAL
                      </div>
                    </div>
                  ) : (
                    /* Empty Slot #1 */
                    <div className="rounded-2xl p-6 border-2 border-dashed border-amber-900/50 bg-[#081525]/40 text-center flex flex-col items-center justify-center min-h-[240px]">
                      <Crown className="w-10 h-10 text-amber-700 mb-2" />
                      <span className="text-xs font-mono text-amber-500 uppercase font-semibold">1st Place Unclaimed</span>
                      <span className="text-[10px] text-slate-500 mt-1">Be the first champion to take Rank 1!</span>
                    </div>
                  )}
                </div>

                {/* 3RD PLACE (BRONZE) - Right on desktop */}
                <div className="order-3 md:order-3 flex flex-col">
                  {top3 ? (
                    <div
                      className={`relative rounded-2xl p-5 border transition-all duration-300 flex flex-col justify-between ${
                        latestSessionId === top3.id
                          ? 'bg-gradient-to-b from-[#26150a] to-[#0a1827] border-amber-500 shadow-[0_0_25px_rgba(217,119,6,0.25)] ring-2 ring-amber-600'
                          : isSearching && matchesSearch(top3)
                          ? 'bg-gradient-to-b from-[#26150a] to-[#0a1827] border-[#38efbf] shadow-[0_0_20px_rgba(56,239,191,0.25)]'
                          : isSearching && !matchesSearch(top3)
                          ? 'bg-[#091624]/60 border-amber-900/40 opacity-40'
                          : 'bg-gradient-to-b from-[#1f1208] to-[#081525] border-amber-700/60 hover:border-amber-600 shadow-lg'
                      }`}
                    >
                      {/* Top medal header */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-amber-700/20 border border-amber-600/40 text-amber-400">
                          <Medal className="w-3.5 h-3.5 text-amber-500" />
                          3RD PLACE • BRONZE
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                          {top3.durationSeconds}s
                        </span>
                      </div>

                      {/* Player avatar & name */}
                      <div className="flex items-center gap-3 my-2">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-800 text-amber-100 font-black text-xl flex items-center justify-center shadow-md">
                          {top3.playerName.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                          <div className="text-base sm:text-lg font-bold text-amber-100 truncate" title={top3.playerName}>
                            {top3.playerName}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {top3.correctCount}/{top3.totalQuestions} Correct Answers
                          </div>
                        </div>
                      </div>

                      {/* Score display */}
                      <div className="mt-4 pt-3 border-t border-amber-900/40 flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-wider font-mono text-slate-400">Score</span>
                        <div className="text-2xl font-black font-mono text-amber-400">
                          {top3.score} <span className="text-xs font-normal text-slate-400">pts</span>
                        </div>
                      </div>

                      {/* Pedestal Base */}
                      <div className="mt-3 py-2 px-3 rounded-xl bg-amber-700/10 border border-amber-600/30 text-center font-mono font-black text-amber-500 text-xs sm:text-sm tracking-wider">
                        🥉 3RD PLACE PEDESTAL
                      </div>
                    </div>
                  ) : (
                    /* Empty Slot #3 */
                    <div className="rounded-2xl p-6 border-2 border-dashed border-slate-800 bg-[#081525]/40 text-center flex flex-col items-center justify-center min-h-[220px]">
                      <Medal className="w-8 h-8 text-amber-900 mb-2" />
                      <span className="text-xs font-mono text-amber-700 uppercase font-semibold">3rd Place Unclaimed</span>
                      <span className="text-[10px] text-slate-600 mt-1">Play a quest to claim Rank 3</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ======================================================== */}
            {/* RANKINGS FOR TOP 4 AND ONWARD                            */}
            {/* ======================================================== */}
            <div className="mt-8 pt-6 border-t border-[#142d4a]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-teal-950/60 border border-teal-500/30 text-[#38efbf]">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                      Rankings (Top 4 & Onward)
                    </h4>
                    <p className="text-[11px] text-[#7ea0b7]">
                      Runner-up standings and verified competitors
                    </p>
                  </div>
                </div>
                <div className="text-xs font-mono px-3 py-1 rounded-full bg-[#081525] border border-[#183a5f] text-slate-300">
                  {tableEntries.length} {tableEntries.length === 1 ? 'Contender' : 'Contenders'} Listed
                </div>
              </div>

              {tableEntries.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-[#183a5f] rounded-2xl bg-[#081525]/30">
                  <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-300">
                    {isSearching
                      ? (matchesSearch(top1) || matchesSearch(top2) || matchesSearch(top3)
                          ? `Matching records for "${searchTerm}" are featured on the Top 1–3 Championship Podium above!`
                          : `No players from Rank 4 onward match "${searchTerm}".`)
                      : entries.length <= 3 && entries.length > 0
                      ? 'All active contenders are currently featured on the Top 1–3 Championship Podium above!'
                      : 'No runner-up ranking records found.'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {!isSearching && entries.length <= 3
                      ? 'Complete more quests with new players to fill positions from Rank 4 onward.'
                      : ''}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#163352] text-[11px] font-mono text-[#7ea0b7] uppercase tracking-wider">
                        <th className="py-3 px-3">Rank</th>
                        <th className="py-3 px-4">Player Name</th>
                        <th className="py-3 px-4 text-right">Score</th>
                        <th className="py-3 px-4 text-center">Correct</th>
                        <th className="py-3 px-4 text-center">Duration</th>
                        <th className="py-3 px-4 text-center">Outcome</th>
                        <th className="py-3 px-4 text-right">Date Played</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#122842] text-xs sm:text-sm">
                      {tableEntries.map((item) => {
                        const isLatest = latestSessionId && item.id === latestSessionId;

                        return (
                          <tr
                            key={item.id}
                            className={`transition-colors ${
                              isLatest
                                ? 'bg-[#123652]/70 font-semibold text-teal-100 ring-1 ring-[#38efbf]/50'
                                : 'hover:bg-[#0e233a]/60 text-slate-200'
                            }`}
                          >
                            {/* Rank */}
                            <td className="py-3.5 px-3 whitespace-nowrap">
                              <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-md bg-[#081626] border border-[#1b3d63] text-slate-300">
                                {item.isSharedRank ? `T-#${item.rank}` : `#${item.rank}`}
                              </span>
                            </td>

                            {/* Player Name */}
                            <td className="py-3.5 px-4 whitespace-nowrap font-medium text-white">
                              <div className="flex items-center gap-2">
                                <span>{item.playerName}</span>
                                {isLatest && (
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#38efbf] text-[#061923] font-bold">
                                    LATEST
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Score */}
                            <td className="py-3.5 px-4 whitespace-nowrap text-right font-mono font-bold text-amber-300 text-sm sm:text-base">
                              {item.score} <span className="text-xs text-slate-500 font-normal">pts</span>
                            </td>

                            {/* Correct Answers */}
                            <td className="py-3.5 px-4 whitespace-nowrap text-center font-mono">
                              <span className="text-emerald-400 font-semibold">{item.correctCount}</span>
                              <span className="text-slate-500"> / {item.totalQuestions}</span>
                            </td>

                            {/* Duration */}
                            <td className="py-3.5 px-4 whitespace-nowrap text-center text-slate-300 font-mono text-xs">
                              {item.durationSeconds}s
                            </td>

                            {/* Outcome */}
                            <td className="py-3.5 px-4 whitespace-nowrap text-center">
                              {item.gameOverReason === 'TIME_EXPIRED' ? (
                                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-rose-950/70 border border-rose-500/40 text-rose-300">
                                  Time Expired
                                </span>
                              ) : item.status === 'completed' ? (
                                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-emerald-950/70 border border-emerald-500/40 text-emerald-300">
                                  Completed
                                </span>
                              ) : (
                                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-400">
                                  Abandoned
                                </span>
                              )}
                            </td>

                            {/* Date Played */}
                            <td className="py-3.5 px-4 whitespace-nowrap text-right text-xs text-slate-400 font-mono">
                              {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
