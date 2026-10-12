import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Clock, CheckCircle2, User, ArrowRight } from 'lucide-react';
import { SanitizedQuestion, GameSettings } from '../types';
import { soundManager } from '../utils/audio';
import { DEFAULT_STAGE_DESCRIPTIONS } from '../data/defaultQuestions';

interface GameplayScreenProps {
  playerName: string;
  questions: SanitizedQuestion[];
  settings: GameSettings;
  onGameEnd: (
    recordedAnswers: { questionId: string; selectedAnswer: string | null; timeSpent: number }[],
    totalDurationSeconds: number,
    reason: 'COMPLETED' | 'TIME_EXPIRED' | 'ABANDONED'
  ) => void;
  onAbortGame: () => void;
  onQuestionChange?: (currentIndex: number, currentCategory: string) => void;
}

export const GameplayScreen: React.FC<GameplayScreenProps> = ({
  playerName,
  questions,
  settings,
  onGameEnd,
  onAbortGame,
  onQuestionChange
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const timerDuration = settings.timerSeconds || 30;
  const [timeRemaining, setTimeRemaining] = useState<number>(timerDuration);

  // Refs for race-condition-free timer and zero unwanted resets
  const sessionStartTimeRef = useRef<number>(Date.now());
  const questionStartTimeRef = useRef<number>(Date.now());
  const deadlineRef = useRef<number>(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedOptionRef = useRef<string | null>(null);
  const recordedAnswersRef = useRef<
    { questionId: string; selectedAnswer: string | null; timeSpent: number }[]
  >([]);
  const isTransitioningRef = useRef<boolean>(false);

  // Keep latest references for callbacks and props
  const onGameEndRef = useRef(onGameEnd);
  onGameEndRef.current = onGameEnd;

  const onQuestionChangeRef = useRef(onQuestionChange);
  onQuestionChangeRef.current = onQuestionChange;

  const questionsRef = useRef(questions);
  questionsRef.current = questions;

  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  const currentQuestion = questions[currentIndex];
  const currentQuestionRef = useRef(currentQuestion);
  currentQuestionRef.current = currentQuestion;

  const timerDurationRef = useRef(timerDuration);
  timerDurationRef.current = timerDuration;

  // Options shuffling - updates only when question changes
  const [shuffledOptions, setShuffledOptions] = useState<string[]>([]);

  useEffect(() => {
    if (!currentQuestion) return;

    let opts = [...currentQuestion.options];
    if (settings.shuffleAnswers) {
      for (let i = opts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [opts[i], opts[j]] = [opts[j], opts[i]];
      }
    }
    setShuffledOptions(opts);
  }, [currentIndex, currentQuestion?.id, settings.shuffleAnswers]);

  // Notify parent of active question category for Customer Journey stage progression
  useEffect(() => {
    if (currentQuestion && onQuestionChangeRef.current) {
      onQuestionChangeRef.current(currentIndex, currentQuestion.category);
    }
  }, [currentIndex, currentQuestion?.category]);

  // Unified progression function: proceeds to next question with finalAnswer
  const advanceToNext = useCallback((finalAnswer: string | null) => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    soundManager.playClick();

    const currIdx = currentIndexRef.current;
    const currQ = questionsRef.current[currIdx];
    if (!currQ) return;

    const timeSpent = Math.max(
      1,
      Math.min(
        timerDurationRef.current,
        Math.round((Date.now() - questionStartTimeRef.current) / 1000)
      )
    );

    const entry = {
      questionId: currQ.id,
      selectedAnswer: finalAnswer, // either the clicked answer, or null if unanswered
      timeSpent
    };

    const nextAnswers = [...recordedAnswersRef.current, entry];
    recordedAnswersRef.current = nextAnswers;

    if (currIdx + 1 < questionsRef.current.length) {
      setSelectedOption(null);
      selectedOptionRef.current = null;
      setCurrentIndex(currIdx + 1);
    } else {
      const totalDuration = Math.round((Date.now() - sessionStartTimeRef.current) / 1000);
      onGameEndRef.current(nextAnswers, totalDuration, 'COMPLETED');
    }
  }, []);

  // 30-Second Countdown Timer: starts fresh ONLY when currentIndex changes!
  useEffect(() => {
    const q = currentQuestionRef.current;
    if (!q) return;

    isTransitioningRef.current = false;
    questionStartTimeRef.current = Date.now();
    const duration = timerDurationRef.current;
    setTimeRemaining(duration);

    const deadline = Date.now() + duration * 1000;
    deadlineRef.current = deadline;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    timerIntervalRef.current = setInterval(() => {
      if (isTransitioningRef.current) {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        return;
      }

      const now = Date.now();
      const diffMs = deadlineRef.current - now;
      const secondsLeft = Math.max(0, Math.ceil(diffMs / 1000));

      setTimeRemaining(secondsLeft);

      if (secondsLeft <= 5 && secondsLeft > 0) {
        soundManager.playUrgentTick();
      } else if (secondsLeft <= 10 && secondsLeft > 5) {
        soundManager.playTick();
      }

      if (diffMs <= 0 || secondsLeft <= 0) {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        // When timer reaches 0: whatever was selected is the final answer (or null if none)
        // and it automatically proceeds to the next question!
        advanceToNext(selectedOptionRef.current);
      }
    }, 100);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [currentIndex, advanceToNext]);

  // Player selects an option (does NOT advance, does NOT reset timer)
  const handleSelectOption = (option: string) => {
    if (isTransitioningRef.current) return;
    setSelectedOption(option);
    selectedOptionRef.current = option;
    soundManager.playClick();
  };

  // User manually clicks Next button to proceed
  const handleNextQuestion = () => {
    if (isTransitioningRef.current || !selectedOptionRef.current) return;
    advanceToNext(selectedOptionRef.current);
  };

  const timerPercentage = Math.max(0, (timeRemaining / timerDuration) * 100);
  const isUrgent = timeRemaining <= 10;
  const isCritical = timeRemaining <= 5;
  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-4 sm:py-6 relative animate-fade-in">
      {/* Top HUD Bar (NO running score displayed during fair competition!) */}
      <div className="bg-[#0b1c2d] border border-[#1b3658] rounded-xl p-4 mb-4 flex items-center justify-between gap-3 shadow-lg">
        {/* Progress & Category */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <div className="text-[10px] font-mono uppercase text-[#38efbf] tracking-widest font-bold">
              {currentQuestion?.category}
            </div>
            <div className="text-sm sm:text-base font-bold text-white">
              Question {currentIndex + 1} of {questions.length}
            </div>
          </div>
        </div>

        {/* 30-Second Countdown Timer Card */}
        <div
          className={`flex items-center gap-3 px-4 py-2 rounded-lg border transition-all duration-300 ${
            isCritical
              ? 'bg-rose-950/70 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.4)] animate-pulse'
              : isUrgent
              ? 'bg-amber-950/60 border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
              : 'bg-[#081525] border-[#1f4773]'
          }`}
        >
          <Clock
            className={`w-5 h-5 ${
              isCritical
                ? 'text-rose-400 animate-spin'
                : isUrgent
                ? 'text-amber-400'
                : 'text-[#38efbf]'
            }`}
          />
          <div className="flex items-baseline gap-1">
            <span
              className={`text-xl sm:text-2xl font-black font-mono leading-none ${
                isCritical
                  ? 'text-rose-400'
                  : isUrgent
                  ? 'text-amber-300'
                  : 'text-[#38efbf]'
              }`}
            >
              {timeRemaining}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">s</span>
          </div>

          <div className="w-14 sm:w-16 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
            <div
              className={`h-full transition-all duration-200 ${
                isCritical
                  ? 'bg-rose-500'
                  : isUrgent
                  ? 'bg-amber-400'
                  : 'bg-[#38efbf]'
              }`}
              style={{ width: `${timerPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Question Card */}
      <div className="bg-[#0b1c2d] border border-[#1b3658] rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Progress line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-[#152e4d]">
          <div
            className="h-full bg-gradient-to-r from-[#38efbf] to-cyan-400 transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>

        {/* Stage Context / Group Role */}
        <div className="mb-4 p-3.5 sm:p-4 rounded-xl bg-[#081726] border border-[#173a5e] text-slate-300">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[#38efbf] font-bold mb-1 flex items-center gap-1.5">
            <span>What this group does:</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
            {currentQuestion?.stageDescription || DEFAULT_STAGE_DESCRIPTIONS[currentQuestion?.category] || 'Guides the customer through a critical milestone in their journey.'}
          </p>
        </div>

        {/* Customer Scenario Prompt */}
        <div className="mb-6 pt-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
              <span>Customer Scenario</span>
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Value: +{currentQuestion?.points || 20} pts
            </span>
          </div>
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white leading-relaxed">
            {currentQuestion?.text.replace(/^Customer scenario:\s*/i, '')}
          </h2>
        </div>

        {/* Answer Option Buttons */}
        <div className="space-y-3.5 my-6">
          {shuffledOptions.map((option, optIdx) => {
            const letter = optionLetters[optIdx] || `${optIdx + 1}`;
            const isSelected = selectedOption === option;

            return (
              <button
                key={optIdx}
                onClick={() => handleSelectOption(option)}
                className={`w-full text-left p-4 sm:p-5 rounded-xl border transition-all duration-200 flex items-start gap-4 select-none cursor-pointer ${
                  isSelected
                    ? 'bg-[#122e4d] border-[#38efbf] text-white shadow-[0_0_20px_rgba(56,239,191,0.25)] ring-1 ring-[#38efbf]'
                    : 'bg-[#0e233a] border-[#1b3e64] hover:border-[#38efbf]/70 hover:bg-[#122e4d] text-slate-200 active:scale-[0.99]'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center font-mono font-bold text-sm border transition-colors ${
                    isSelected
                      ? 'bg-[#38efbf] text-[#061923] border-[#38efbf]'
                      : 'bg-[#091728] text-[#38efbf] border-[#1d436c]'
                  }`}
                >
                  {isSelected ? (
                    <CheckCircle2 className="w-5 h-5 text-[#061923]" />
                  ) : (
                    letter
                  )}
                </div>

                <div className="flex-1 pt-0.5 text-sm sm:text-base font-medium leading-snug">
                  {option}
                </div>
              </button>
            );
          })}
        </div>

        {/* Action Bar: Next Question centered in the middle */}
        <div className="mt-8 pt-5 border-t border-[#132d4b] flex justify-center items-center">
          <button
            disabled={!selectedOption}
            onClick={handleNextQuestion}
            className={`py-3.5 px-8 sm:px-12 rounded-xl font-bold text-sm sm:text-base tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer ${
              selectedOption
                ? 'bg-[#38efbf] hover:bg-[#2dd4a6] text-[#061923] shadow-[0_0_25px_rgba(56,239,191,0.35)] hover:scale-[1.02] active:scale-[0.98]'
                : 'bg-[#0a1827] border border-[#1b3658] text-slate-500 cursor-not-allowed opacity-50'
            }`}
          >
            <span>{currentIndex + 1 < questions.length ? 'Next Question' : 'Submit & Finish'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Footer info */}
        <div className="mt-6 pt-4 border-t border-[#132d4b] flex items-center justify-between text-xs text-[#7ea0b7]">
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>Active Competitor: <strong className="text-white">{playerName}</strong></span>
          </div>

          <button
            onClick={() => {
              if (window.confirm('Do you want to abandon the current quest attempt?')) {
                onAbortGame();
              }
            }}
            className="text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
          >
            Abandon Quest
          </button>
        </div>
      </div>
    </div>
  );
};
