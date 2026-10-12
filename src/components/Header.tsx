import React, { useState } from 'react';
import { Volume2, VolumeX, Trophy, Home, Info, Wifi, WifiOff } from 'lucide-react';
import { soundManager } from '../utils/audio';
import { ScreenState, SyncStatus } from '../types';

interface HeaderProps {
  currentScreen: ScreenState;
  onNavigate: (screen: ScreenState) => void;
  playerName?: string;
  onHomeClick?: () => void;
  syncStatus: SyncStatus;
  onOpenInfoModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentScreen,
  onNavigate,
  playerName,
  onHomeClick,
  syncStatus,
  onOpenInfoModal
}) => {
  const [muted, setMuted] = useState(soundManager.getMuted());

  const handleToggleSound = () => {
    const isNowMuted = soundManager.toggleMute();
    setMuted(isNowMuted);
    if (!isNowMuted) {
      soundManager.playClick();
    }
  };

  return (
    <header className="w-full border-b border-[#142d4a]/80 bg-[#060e19]/90 backdrop-blur sticky top-0 z-40 px-4 sm:px-8 py-3.5 transition-colors">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Branding from reference screenshot */}
        <div 
          className="cursor-pointer group select-none" 
          onClick={() => onHomeClick ? onHomeClick() : onNavigate('welcome')}
        >
          <div className="text-[11px] font-bold tracking-widest text-[#38efbf] uppercase font-mono flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#38efbf] animate-pulse"></span>
            INTERACTIVE DEPARTMENT EXPERIENCE
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white group-hover:text-teal-100 transition-colors uppercase">
            CUSTOMER JOURNEY QUEST
          </h1>
          <p className="text-xs sm:text-sm text-[#7ea0b7] font-normal">
            From first click to lifetime trust
          </p>
        </div>

        {/* Action icons & Controls (Admin button completely removed!) */}
        <div className="flex items-center gap-2 self-end md:self-center">
          {playerName && currentScreen === 'gameplay' && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0c1f35] border border-[#1b3d63] text-xs font-medium text-teal-200">
              <span className="w-2 h-2 rounded-full bg-[#38efbf]"></span>
              <span>Player: <strong className="text-white">{playerName}</strong></span>
            </div>
          )}

          {/* Sync indicator badge */}
          <button
            onClick={onOpenInfoModal}
            title={`Live Cloud & Admin Sync Active (Rev ${syncStatus.serverRevision || 1})`}
            className="px-2.5 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/50 text-emerald-300 text-xs font-mono font-medium flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">
              Synced (r{syncStatus.serverRevision || 1})
            </span>
          </button>

          {currentScreen !== 'welcome' && (
            <button
              onClick={() => onHomeClick ? onHomeClick() : onNavigate('welcome')}
              title="Home / Main Menu"
              className="p-2 rounded-lg bg-[#0c1f35] hover:bg-[#132d4b] border border-[#1b3d63] text-slate-300 hover:text-white transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer"
            >
              <Home className="w-4 h-4 text-[#38efbf]" />
              <span className="hidden sm:inline">Menu</span>
            </button>
          )}

          <button
            onClick={() => {
              soundManager.playClick();
              onNavigate('leaderboard');
            }}
            title="Leaderboard & Rankings"
            className={`p-2 rounded-lg border transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer ${
              currentScreen === 'leaderboard'
                ? 'bg-[#122e4d] border-[#38efbf] text-[#38efbf]'
                : 'bg-[#0c1f35] hover:bg-[#132d4b] border-[#1b3d63] text-slate-300 hover:text-white'
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Leaderboard</span>
          </button>

          {/* App Info / Version modal trigger */}
          <button
            onClick={() => {
              soundManager.playClick();
              onOpenInfoModal();
            }}
            title="Application Information"
            className="p-2 rounded-lg bg-[#0c1f35] hover:bg-[#132d4b] border border-[#1b3d63] text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <Info className="w-4 h-4 text-cyan-400" />
          </button>

          {/* Sound Mute Toggle */}
          <button
            onClick={handleToggleSound}
            title={muted ? 'Unmute Sound' : 'Mute Sound'}
            className="p-2 rounded-lg bg-[#0c1f35] hover:bg-[#132d4b] border border-[#1b3d63] text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            {muted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-[#38efbf]" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
