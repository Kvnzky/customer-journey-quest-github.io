import React, { useState, useEffect } from 'react';
import { Play, Trophy, User, Sparkles, AlertCircle, Award, Wifi, WifiOff } from 'lucide-react';
import { soundManager } from '../utils/audio';
import { dbManager } from '../utils/db';
import { SyncStatus } from '../types';

interface WelcomeScreenProps {
  onStartGame: (playerName: string) => void;
  onViewLeaderboard: () => void;
  syncStatus: SyncStatus;
  initialPlayerName?: string;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onStartGame,
  onViewLeaderboard,
  syncStatus,
  initialPlayerName = ''
}) => {
  const [name, setName] = useState(initialPlayerName);
  const [error, setError] = useState<string | null>(null);
  const [personalBest, setPersonalBest] = useState<number | null>(null);

  useEffect(() => {
    const trimmed = name.trim();
    if (trimmed.length > 0) {
      const normalized = trimmed.toLowerCase();
      dbManager.getLeaderboard('personal_bests').then(bests => {
        const found = bests.find(b => b.normalizedPlayerName === normalized);
        if (found) {
          setPersonalBest(found.score);
        } else {
          setPersonalBest(null);
        }
      }).catch(() => setPersonalBest(null));
    } else {
      setPersonalBest(null);
    }
  }, [name, syncStatus]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter your name to start the quest.');
      soundManager.playIncorrect();
      return;
    }
    if (trimmed.length < 2) {
      setError('Name must be at least 2 characters long.');
      soundManager.playIncorrect();
      return;
    }
    setError(null);
    soundManager.playClick();
    onStartGame(trimmed);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 sm:py-10 animate-fade-in">
      {/* Central Mission Card Recreating the Reference Image */}
      <div className="bg-[#0b1c2d] border border-[#1b3658] rounded-2xl p-6 sm:p-10 shadow-2xl relative overflow-hidden backdrop-blur-md">
        {/* Subtle decorative glow */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#38efbf]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Card Header matching screenshot */}
        <div className="relative z-10 mb-6">
          <div className="text-[11px] sm:text-xs font-bold tracking-widest text-[#38efbf] uppercase font-mono mb-2 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#38efbf]" />
            <span>YOUR MISSION STARTS HERE</span>
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-snug">
            Can you win the customer's trust?
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#8da2b5] leading-relaxed max-w-3xl">
            Guide a customer from the first interaction to a lasting partnership. Make decisions at every stage and discover how our five groups work together.
          </p>
        </div>

        {/* 2 Sub-cards matching screenshot */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 my-6 relative z-10">
          {/* Card 1: Customer */}
          <div className="bg-[#0e243a]/90 border border-[#193b61] rounded-xl p-5 sm:p-6 transition-all hover:border-[#254e7d]">
            <div className="text-[10px] sm:text-xs font-bold tracking-widest text-[#38efbf] uppercase font-mono mb-1.5">
              YOUR CUSTOMER
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
              Apex Industries
            </h3>
            <p className="text-xs sm:text-sm text-[#8da2b5] leading-normal">
              One opportunity. Five groups. One connected journey.
            </p>
          </div>

          {/* Card 2: Objective */}
          <div className="bg-[#0e243a]/90 border border-[#193b61] rounded-xl p-5 sm:p-6 transition-all hover:border-[#254e7d]">
            <div className="text-[10px] sm:text-xs font-bold tracking-widest text-[#38efbf] uppercase font-mono mb-1.5">
              YOUR OBJECTIVE
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
              Build trust
            </h3>
            <p className="text-xs sm:text-sm text-[#8da2b5] leading-normal">
              Make decisions, earn points and reveal the team's impact.
            </p>
          </div>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="mt-8 relative z-10 space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-200 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <User className="w-4 h-4 text-[#38efbf]" />
                Enter Your Player Name
              </span>
              {personalBest !== null && (
                <span className="text-xs text-[#38efbf] font-mono flex items-center gap-1 bg-[#102d44] px-2.5 py-0.5 rounded-full border border-[#20496d]">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  Personal Best: {personalBest} pts
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. Alex Morgan"
                maxLength={40}
                autoFocus
                className={`w-full px-4 py-3.5 rounded-xl bg-[#091728] border text-white placeholder-slate-500 focus:outline-none transition-all text-base sm:text-lg font-medium ${
                  error
                    ? 'border-rose-500 focus:ring-2 focus:ring-rose-500/50'
                    : 'border-[#1b3d63] focus:border-[#38efbf] focus:ring-2 focus:ring-[#38efbf]/25'
                }`}
              />
            </div>
            {error && (
              <p className="mt-2 text-xs sm:text-sm text-rose-400 flex items-center gap-1.5 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </p>
            )}
          </div>

          {/* Action Button matching screenshot */}
          <button
            type="submit"
            className="w-full py-4 px-6 rounded-xl bg-[#38efbf] hover:bg-[#2dd4a6] active:scale-[0.99] text-[#061923] font-bold text-base sm:text-lg tracking-wide shadow-lg shadow-teal-500/20 hover:shadow-teal-500/35 transition-all duration-200 flex items-center justify-center gap-2 group cursor-pointer"
          >
            <span>▶ Start the journey</span>
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </button>
        </form>

        {/* Player Navigation Footer (Admin links completely removed!) */}
        <div className="mt-6 pt-5 border-t border-[#163352] flex items-center justify-center text-xs text-[#7ea0b7]">
          <button
            onClick={() => {
              soundManager.playClick();
              onViewLeaderboard();
            }}
            type="button"
            className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Leaderboard & Records</span>
          </button>
        </div>
      </div>
    </div>
  );
};
