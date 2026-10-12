import React, { useEffect, useState } from 'react';
import { 
  Trophy, 
  RotateCcw, 
  UserPlus, 
  Home, 
  Clock, 
  Award, 
  AlertTriangle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ShieldCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { GameSession } from '../types';
import { dbManager } from '../utils/db';
import { soundManager } from '../utils/audio';
import { syncClient } from '../utils/syncClient';

interface ResultsScreenProps {
  session: GameSession;
  onPlayAgain: () => void;
  onChangePlayer: () => void;
  onViewLeaderboard: () => void;
  onReturnHome: () => void;
}

export const ResultsScreen: React.FC<ResultsScreenProps> = ({
  session,
  onPlayAgain,
  onChangePlayer,
  onViewLeaderboard,
  onReturnHome
}) => {
  const [leaderboardRank, setLeaderboardRank] = useState<number | null>(null);
  const [isSharedRank, setIsSharedRank] = useState<boolean>(false);
  const [isPersonalBest, setIsPersonalBest] = useState<boolean>(false);
  const [showReview, setShowReview] = useState<boolean>(true);

  useEffect(() => {
    let confettiFired = false;

    const fetchRankingInfo = async () => {
      try {
        const isPB = await dbManager.checkIsPersonalBest(
          session.normalizedPlayerName,
          session.score,
          session.id
        );
        setIsPersonalBest(isPB);

        const allRanked = await dbManager.getLeaderboard('overall');
        const match = allRanked.find(item => item.id === session.id);
        if (match) {
          setLeaderboardRank(match.rank);
          setIsSharedRank(!!match.isSharedRank);
        }

        if (!confettiFired && (session.status === 'completed' || isPB)) {
          confettiFired = true;
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
          });
        }
      } catch (err) {
        console.error('Error fetching ranking info:', err);
      }
    };

    fetchRankingInfo();
    const unsub = syncClient.subscribe(() => {
      fetchRankingInfo();
    });
    return () => unsub();
  }, [session]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const isTimeout = session.gameOverReason === 'TIME_EXPIRED';

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 sm:py-8 animate-fade-in">
      {/* Hero Banner */}
      <div
        className={`rounded-2xl p-6 sm:p-8 border shadow-2xl relative overflow-hidden mb-6 ${
          isTimeout
            ? 'bg-[#150a12] border-rose-500/60 shadow-[0_0_35px_rgba(244,63,94,0.2)]'
            : 'bg-[#0b1c2d] border-[#1b3e64] shadow-[0_0_35px_rgba(56,239,191,0.15)]'
        }`}
      >
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold tracking-wider uppercase border mb-1">
              {isTimeout ? (
                <span className="text-rose-400 border-rose-500/40 bg-rose-950/50 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  QUEST TERMINATED • 30S TIME EXPIRED
                </span>
              ) : (
                <span className="text-[#38efbf] border-teal-500/40 bg-teal-950/50 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  CUSTOMER JOURNEY QUEST COMPLETE!
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
              {isTimeout ? "Session Concluded: Time Expired" : "Customer Trust Journey Complete"}
            </h2>

            <p className="text-sm sm:text-base text-[#8da2b5]">
              {isTimeout
                ? `The 30-second deadline expired for ${session.playerName}. Per competition rules, points earned from choices are summarized below.`
                : `Final results recorded for ${session.playerName}. Review your standing and choice points breakdown below.`}
            </p>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards Grid: Rank on Board, Total Score in Middle, Completion Time */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        {/* Card 1: Rank on Board */}
        <div className="bg-[#0b1c2d] border border-[#1b3658] rounded-xl p-4 text-center">
          <div className="text-xs text-[#7ea0b7] font-medium mb-1">Rank on Board</div>
          <div className="text-xl sm:text-2xl font-bold text-white font-mono flex items-center justify-center gap-1.5">
            <Trophy className="w-5 h-5 text-amber-400" />
            <span>{leaderboardRank ? (isSharedRank ? `T-#${leaderboardRank}` : `#${leaderboardRank}`) : '—'}</span>
          </div>
        </div>

        {/* Card 2: Total Score (In the Middle) */}
        <div className="bg-[#0b1c2d] border border-[#1b3658] rounded-xl p-4 text-center shadow-lg">
          <div className="text-xs text-[#7ea0b7] font-medium mb-1">Total Score</div>
          <div className="text-2xl sm:text-3xl font-black text-amber-300 font-mono flex items-center justify-center gap-1.5">
            <Award className="w-6 h-6 text-amber-400" />
            <span>{session.score} pts</span>
          </div>
          {isPersonalBest && (
            <span className="inline-block mt-1 text-[10px] font-bold text-[#38efbf] bg-teal-950/80 px-2.5 py-0.5 rounded-full border border-teal-500/40">
              Personal Best!
            </span>
          )}
        </div>

        {/* Card 3: Completion Time */}
        <div className="bg-[#0b1c2d] border border-[#1b3658] rounded-xl p-4 text-center">
          <div className="text-xs text-[#7ea0b7] font-medium mb-1">Completion Time</div>
          <div className="text-xl sm:text-2xl font-bold text-cyan-300 font-mono flex items-center justify-center gap-1.5">
            <Clock className="w-5 h-5 text-cyan-400" />
            <span>{formatDuration(session.durationSeconds)}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <button
          onClick={() => {
            soundManager.playClick();
            onPlayAgain();
          }}
          className="py-3.5 px-4 rounded-xl bg-[#38efbf] hover:bg-[#2dd4a6] text-[#061923] font-bold text-sm tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Play Again</span>
        </button>

        <button
          onClick={() => {
            soundManager.playClick();
            onChangePlayer();
          }}
          className="py-3.5 px-4 rounded-xl bg-[#0c1f35] hover:bg-[#132d4b] border border-[#1b3d63] text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <UserPlus className="w-4 h-4 text-[#38efbf]" />
          <span>Change Player</span>
        </button>

        <button
          onClick={() => {
            soundManager.playClick();
            onViewLeaderboard();
          }}
          className="py-3.5 px-4 rounded-xl bg-[#0c1f35] hover:bg-[#132d4b] border border-[#1b3d63] text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Trophy className="w-4 h-4 text-amber-400" />
          <span>Leaderboard</span>
        </button>

        <button
          onClick={() => {
            soundManager.playClick();
            onReturnHome();
          }}
          className="py-3.5 px-4 rounded-xl bg-[#0c1f35] hover:bg-[#132d4b] border border-[#1b3d63] text-slate-300 hover:text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Home className="w-4 h-4 text-cyan-400" />
          <span>Main Menu</span>
        </button>
      </div>

      {/* POINTS SUMMARY (POINTS EARNED ONLY, NO CORRECT/INCORRECT OR COLOR CODING) */}
      <div className="bg-[#0b1c2d] border border-[#1b3658] rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 bg-[#081525] border-b border-[#142e4d] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#38efbf]" />
            <div>
              <h3 className="text-sm font-bold text-white">Points Summary</h3>
              <p className="text-[11px] text-[#7ea0b7]">
                Points earned from each question choice ({session.totalQuestions} questions)
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowReview(!showReview)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            {showReview ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        {showReview && (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {session.questionResults.map((item) => (
              <div
                key={item.questionNumber}
                className="flex items-center justify-between p-3.5 rounded-xl border bg-[#081525] border-[#183658] transition-all"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-slate-200">
                    Question {item.questionNumber}
                  </span>
                </div>

                <div>
                  <span className="text-xs font-mono font-bold text-amber-300 bg-[#061322] px-3 py-1 rounded-full border border-[#1b3e64]">
                    {item.pointsAwarded} pts
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
