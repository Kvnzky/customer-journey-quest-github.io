import React from 'react';
import { X, Trophy, Compass, Layers, CheckCircle } from 'lucide-react';

interface AppInfoModalProps {
  onClose: () => void;
}

export const AppInfoModal: React.FC<AppInfoModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-[#060e19]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#0b1c2d] border border-[#1b3d63] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden">
        {/* Glow */}
        <div className="absolute -top-16 -right-16 w-40 h-40 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#142e4d] mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-950/80 border border-teal-500/40 text-[#38efbf] flex items-center justify-center shadow-md">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white uppercase tracking-tight">Customer Journey Quest</h3>
              <p className="text-[11px] text-[#7ea0b7] font-mono">Interactive Department Experience</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#132d4b] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 text-xs">
          {/* Mission Overview */}
          <div className="bg-[#081525] p-3.5 rounded-xl border border-[#183658] space-y-1.5">
            <h4 className="font-bold text-white flex items-center gap-1.5 text-xs">
              <CheckCircle className="w-3.5 h-3.5 text-[#38efbf]" />
              Your Mission
            </h4>
            <p className="text-[#8da2b5] leading-relaxed text-[11px]">
              Guide a enterprise customer from their very first inquiry to a lasting partnership. Make decisions across each key department to build maximum trust and business value.
            </p>
          </div>

          {/* Journey Stages */}
          <div className="bg-[#081525] p-3.5 rounded-xl border border-[#183658] space-y-2.5">
            <h4 className="font-bold text-white flex items-center gap-1.5 text-xs">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              The 5 Journey Stages
            </h4>
            <div className="grid grid-cols-5 gap-1.5 text-center font-mono text-[11px]">
              <div className="p-2 rounded-lg bg-[#0e243a] border border-[#1d476f] text-teal-200">
                <div className="font-bold">1</div>
                <div className="text-[10px] mt-0.5">Marketing</div>
              </div>
              <div className="p-2 rounded-lg bg-[#0e243a] border border-[#1d476f] text-cyan-200">
                <div className="font-bold">2</div>
                <div className="text-[10px] mt-0.5">PreSales</div>
              </div>
              <div className="p-2 rounded-lg bg-[#0e243a] border border-[#1d476f] text-blue-200">
                <div className="font-bold">3</div>
                <div className="text-[10px] mt-0.5">Proposals</div>
              </div>
              <div className="p-2 rounded-lg bg-[#0e243a] border border-[#1d476f] text-indigo-200">
                <div className="font-bold">4</div>
                <div className="text-[10px] mt-0.5">Guardian</div>
              </div>
              <div className="p-2 rounded-lg bg-[#0e243a] border border-[#1d476f] text-purple-200">
                <div className="font-bold">5</div>
                <div className="text-[10px] mt-0.5">Digital</div>
              </div>
            </div>
          </div>

          {/* Scoring Rules */}
          <div className="bg-[#081525] p-3.5 rounded-xl border border-[#183658] space-y-2">
            <h4 className="font-bold text-white flex items-center gap-1.5 text-xs">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              Strategic Scoring System
            </h4>
            <p className="text-[#8da2b5] leading-relaxed text-[11px]">
              Every choice awards tiered points based on real-world impact:
            </p>
            <div className="grid grid-cols-4 gap-2 text-center font-mono">
              <div className="p-2.5 rounded-xl bg-teal-950/40 border border-teal-500/30 text-teal-300 font-bold">
                <div className="text-sm">20</div>
                <div className="text-[9px] text-teal-400/80">Optimal</div>
              </div>
              <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 font-bold">
                <div className="text-sm">15</div>
                <div className="text-[9px] text-cyan-400/80">Strong</div>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-500/30 text-blue-300 font-bold">
                <div className="text-sm">10</div>
                <div className="text-[9px] text-blue-400/80">Moderate</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-600/30 text-slate-300 font-bold">
                <div className="text-sm">5</div>
                <div className="text-[9px] text-slate-400/80">Minimal</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 pt-3.5 border-t border-[#142e4d] flex justify-end">
          <button
            onClick={onClose}
            className="py-2 px-6 rounded-xl bg-[#0c243a] hover:bg-[#132d4b] border border-[#1b3d63] text-slate-200 text-xs font-semibold cursor-pointer transition-all"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
