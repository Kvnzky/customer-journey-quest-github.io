import React, { useState } from 'react';
import { X, Info, Wifi, WifiOff, RefreshCw, HardDrive, ShieldCheck, Laptop } from 'lucide-react';
import { SyncStatus } from '../types';
import { syncClient } from '../utils/syncClient';
import { soundManager } from '../utils/audio';

interface AppInfoModalProps {
  syncStatus: SyncStatus;
  deviceId: string;
  onClose: () => void;
}

export const AppInfoModal: React.FC<AppInfoModalProps> = ({
  syncStatus,
  deviceId,
  onClose
}) => {
  const [syncUrlInput, setSyncUrlInput] = useState(syncClient.getSyncUrl());
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleManualSync = async () => {
    soundManager.playClick();
    setSyncing(true);
    await syncClient.triggerSync();
    setSyncing(false);
  };

  const handleSaveUrl = () => {
    syncClient.setSyncUrl(syncUrlInput);
    setIsEditingUrl(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#060e19]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#0b1c2d] border border-[#1b3d63] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#142e4d] mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-950/80 border border-teal-500/40 text-[#38efbf] flex items-center justify-center">
              <Info className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Application Information</h3>
              <p className="text-[11px] text-[#7ea0b7] font-mono">Customer Journey Quest Standalone</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#132d4b] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* System Specs */}
        <div className="space-y-3 text-xs">
          <div className="bg-[#081525] p-3 rounded-xl border border-[#183658] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Laptop className="w-3.5 h-3.5 text-cyan-400" />
                Build Version:
              </span>
              <span className="text-white font-mono font-bold">v2.0.0 (Live Web & Cloud Sync)</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                Installation Device ID:
              </span>
              <span className="text-slate-300 font-mono text-[11px] truncate max-w-[200px]">{deviceId}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#38efbf]" />
                Fair Competition Mode:
              </span>
              <span className="text-[#38efbf] font-bold">Active (Answer Key Segregated)</span>
            </div>
          </div>

          {/* Synchronization Section */}
          <div className="bg-[#081525] p-3.5 rounded-xl border border-[#183658] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                {syncStatus.isOnline ? (
                  <Wifi className="w-4 h-4 text-emerald-400" />
                ) : (
                  <WifiOff className="w-4 h-4 text-amber-400" />
                )}
                Synchronization Service
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                  syncStatus.isOnline
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                    : 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {syncStatus.isOnline ? 'Connected' : 'Live Sync Active'}
              </span>
            </div>

            <div className="text-[11px] text-[#8da2b5] space-y-1">
              <div className="flex justify-between">
                <span>Local Revision:</span>
                <span className="font-mono text-white font-bold">r{syncStatus.localRevision}</span>
              </div>
              <div className="flex justify-between">
                <span>Last Sync Check:</span>
                <span className="font-mono text-slate-300">{syncStatus.lastSyncTime || 'Never'}</span>
              </div>
              <div className="flex justify-between">
                <span>Pending Queued Records:</span>
                <span className="font-mono text-cyan-300 font-bold">{syncStatus.pendingSyncCount}</span>
              </div>
            </div>

            {/* Sync Server URL setting */}
            <div className="pt-1 border-t border-slate-800">
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-slate-400">Sync Server URL:</span>
                <button
                  type="button"
                  onClick={() => setIsEditingUrl(!isEditingUrl)}
                  className="text-[#38efbf] hover:underline"
                >
                  {isEditingUrl ? 'Cancel' : 'Change'}
                </button>
              </div>

              {isEditingUrl ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={syncUrlInput}
                    onChange={(e) => setSyncUrlInput(e.target.value)}
                    placeholder="http://localhost:4820"
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#05111d] border border-slate-700 text-white font-mono text-[11px] focus:outline-none focus:border-[#38efbf]"
                  />
                  <button
                    onClick={handleSaveUrl}
                    className="py-1 px-3 rounded-lg bg-[#38efbf] text-[#061923] text-xs font-bold cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="text-[11px] font-mono text-slate-400 truncate bg-[#05111d] p-1.5 rounded border border-slate-800">
                  {syncClient.getSyncUrl()}
                </div>
              )}
            </div>

            <button
              onClick={handleManualSync}
              disabled={syncing}
              className="w-full mt-2 py-2 px-3 rounded-lg bg-[#0c243a] hover:bg-[#122e4d] border border-[#1c456f] text-slate-200 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#38efbf] ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Checking Sync Server...' : 'Synchronize Now'}</span>
            </button>
          </div>

          <div className="p-3 rounded-xl bg-teal-950/20 border border-teal-500/20 text-[11px] text-teal-200/90 leading-relaxed">
            <strong>Live Synchronization:</strong> Questions, question timer settings, and scoring parameters are kept in continuous sync with the Admin Portal setup. Changes published from the Admin Portal are instantly applied to the live game.
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#142e4d] flex justify-end">
          <button
            onClick={onClose}
            className="py-1.5 px-4 rounded-xl bg-[#0c243a] hover:bg-[#132d4b] border border-[#1b3d63] text-slate-200 text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
