import React from 'react';
import { X, CheckCircle2, XCircle, Clock, Award, User, AlertTriangle } from 'lucide-react';
import { GameSession } from '../../types';

interface SessionDetailModalProps {
  session: GameSession | null;
  onClose: () => void;
}

export const SessionDetailModal: React.FC<SessionDetailModalProps> = ({
  session,
  onClose
}) => {
  if (!session) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#060e19]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#0b1c2d] border border-[#1b3d63] rounded-2xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl relative my-8 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#142e4d] mb-4">
          <div>
            <div className="text-[11px] font-mono text-[#38efbf] uppercase tracking-wider font-bold">
              Session Snapshot Record
            </div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2 mt-0.5">
              Player: {session.playerName}
            </h3>
            <div className="text-xs text-slate-400 font-mono mt-0.5">
              ID: {session.id} • Played: {new Date(session.createdAt).toLocaleString()}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#132d4b] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-[#081525] p-3 rounded-xl border border-[#183658] text-center">
            <span className="text-[10px] text-[#7ea0b7] uppercase font-mono">Final Score</span>
            <div className="text-xl font-bold text-amber-300 font-mono">{session.score} pts</div>
          </div>
          <div className="bg-[#081525] p-3 rounded-xl border border-[#183658] text-center">
            <span className="text-[10px] text-[#7ea0b7] uppercase font-mono">Correct</span>
            <div className="text-xl font-bold text-emerald-400 font-mono">{session.correctCount} / {session.totalQuestions}</div>
          </div>
          <div className="bg-[#081525] p-3 rounded-xl border border-[#183658] text-center">
            <span className="text-[10px] text-[#7ea0b7] uppercase font-mono">Duration</span>
            <div className="text-xl font-bold text-cyan-300 font-mono">{session.durationSeconds}s</div>
          </div>
          <div className="bg-[#081525] p-3 rounded-xl border border-[#183658] text-center">
            <span className="text-[10px] text-[#7ea0b7] uppercase font-mono">Status</span>
            <div className="text-xs font-bold uppercase mt-1">
              {session.gameOverReason === 'TIME_EXPIRED' ? (
                <span className="text-rose-400">Time Expired</span>
              ) : session.status === 'completed' ? (
                <span className="text-emerald-400">Completed</span>
              ) : (
                <span className="text-slate-400">Abandoned</span>
              )}
            </div>
          </div>
        </div>

        {/* Results Scrollable List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
            Question Decision Trail ({session.questionResults?.length || 0})
          </h4>

          {(!session.questionResults || session.questionResults.length === 0) ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              No individual question decisions were recorded before termination.
            </p>
          ) : (
            session.questionResults.map((snap) => (
              <div
                key={snap.questionNumber}
                className={`p-3.5 rounded-xl border ${
                  snap.isCorrect
                    ? 'bg-[#081829] border-emerald-500/30'
                    : 'bg-[#190a14] border-rose-500/30'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-[#38efbf] uppercase">
                      {snap.category}
                    </span>
                    <span className="text-xs text-slate-400">• Q{snap.questionNumber}</span>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      snap.scoreTier === 'optimal' || (snap.isCorrect && snap.pointsAwarded >= 20)
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                        : snap.scoreTier === 'partial' || (snap.isCorrect && snap.pointsAwarded > 0)
                        ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                        : 'bg-rose-950 text-rose-300 border border-rose-500/40'
                    }`}
                  >
                    {snap.scoreTier === 'optimal'
                      ? `+${snap.pointsAwarded} pts (Optimal)`
                      : snap.scoreTier === 'partial'
                      ? `+${snap.pointsAwarded} pts (Partial)`
                      : snap.isTimedOut
                      ? '0 pts (Expired)'
                      : snap.isCorrect
                      ? `+${snap.pointsAwarded} pts`
                      : '0 pts (Ineffective)'}
                  </span>
                </div>

                <p className="text-xs sm:text-sm font-semibold text-white mb-2">
                  {snap.questionText}
                </p>

                <div className="text-xs space-y-1 bg-[#05111d] p-2.5 rounded-lg border border-slate-800">
                  <div className="flex items-start gap-2">
                    <span className="text-slate-400 min-w-[85px]">Submitted:</span>
                    <span className={snap.isCorrect ? 'text-emerald-300 font-medium' : 'text-rose-300 font-medium'}>
                      {snap.isTimedOut ? '(Timed out without answer)' : snap.playerAnswer}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-slate-400 min-w-[85px]">Result:</span>
                    <span className={snap.isCorrect ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                      {snap.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                    </span>
                  </div>
                  {snap.timeSpentSeconds !== undefined && (
                    <div className="flex items-start gap-2">
                      <span className="text-slate-400 min-w-[85px]">Response Time:</span>
                      <span className="text-slate-300 font-mono">{snap.timeSpentSeconds} seconds</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-[#142e4d] mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="py-2 px-4 rounded-xl bg-[#0c243a] hover:bg-[#132d4b] border border-[#1b3d63] text-slate-200 text-xs font-semibold cursor-pointer"
          >
            Close Snapshot
          </button>
        </div>
      </div>
    </div>
  );
};
