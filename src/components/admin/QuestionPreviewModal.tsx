import React from 'react';
import { X, Clock, Award, Sparkles, CheckCircle2 } from 'lucide-react';
import { Question } from '../../types';

interface QuestionPreviewModalProps {
  question: Question | null;
  onClose: () => void;
}

export const QuestionPreviewModal: React.FC<QuestionPreviewModalProps> = ({
  question,
  onClose
}) => {
  if (!question) return null;

  const letters = ['A', 'B', 'C', 'D', 'E'];

  return (
    <div className="fixed inset-0 z-50 bg-[#060e19]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#0b1c2d] border border-[#1b3d63] rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#142e4d] mb-5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#38efbf] animate-pulse" />
            <span className="text-xs font-mono font-bold uppercase text-[#38efbf] tracking-widest">
              Live Player Preview (Simulation Only)
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#132d4b] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mock Top Bar */}
        <div className="flex items-center justify-between mb-4 bg-[#081525] p-3 rounded-xl border border-[#193a5e] text-xs">
          <span className="text-slate-300 font-mono">Stage: <strong className="text-[#38efbf]">{question.category}</strong></span>
          <div className="flex items-center gap-2 text-amber-300 font-mono">
            <Award className="w-3.5 h-3.5" />
            <span>Value: +{question.points} pts</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#38efbf] font-mono">
            <Clock className="w-3.5 h-3.5" />
            <span>30s Timer</span>
          </div>
        </div>

        {/* Stage Description Context */}
        {question.stageDescription && (
          <div className="mb-4 p-3 rounded-xl bg-[#081726] border border-[#173a5e] text-xs text-slate-300">
            <span className="text-[10px] font-mono uppercase font-bold text-[#38efbf] block mb-0.5">
              What this group does:
            </span>
            <span>{question.stageDescription}</span>
          </div>
        )}

        {/* Question Text */}
        <div className="mb-5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold mb-1">
            Customer Scenario
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-white leading-relaxed">
            {question.text.replace(/^Customer scenario:\s*/i, '')}
          </h3>
        </div>

        {/* Options */}
        <div className="space-y-2.5 mb-5">
          {question.options.map((opt, idx) => {
            const isCorrect = opt === question.correctAnswer;
            const score = question.optionScores?.[opt] ?? (isCorrect ? question.points : 0);
            const isOptimal = score >= question.points && question.points > 0;
            const isPartial = score > 0 && !isOptimal;

            return (
              <div
                key={idx}
                className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all ${
                  isOptimal
                    ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-100'
                    : isPartial
                    ? 'bg-amber-950/30 border-amber-500/40 text-amber-100'
                    : 'bg-[#0e233a] border-[#1b3d63] text-slate-300'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded flex items-center justify-center font-mono text-xs font-bold shrink-0 ${
                    isOptimal
                      ? 'bg-emerald-500 text-slate-950'
                      : isPartial
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-[#081525] text-slate-400'
                  }`}
                >
                  {letters[idx] || idx + 1}
                </div>
                <div className="flex-1 text-sm font-medium pt-0.5">
                  {opt}
                </div>
                <div>
                  {isOptimal ? (
                    <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Score: {score} (Optimal)
                    </span>
                  ) : isPartial ? (
                    <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                      Score: {score} (Partial)
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-full border border-slate-700">
                      Score: {score}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Explanation */}
        {question.explanation && (
          <div className="p-3.5 rounded-xl bg-[#081525] border border-[#1b3a5e] text-xs text-slate-300">
            <strong className="text-[#38efbf]">Explanation / Takeaway: </strong>
            {question.explanation}
          </div>
        )}

        <div className="mt-5 pt-3 border-t border-[#142e4d] flex justify-end">
          <button
            onClick={onClose}
            className="py-2 px-4 rounded-xl bg-[#0c243a] hover:bg-[#132d4b] border border-[#1b3d63] text-slate-200 text-xs font-semibold cursor-pointer"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};
