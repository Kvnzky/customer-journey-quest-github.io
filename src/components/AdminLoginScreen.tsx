import React, { useState } from 'react';
import { Shield, KeyRound, ArrowLeft, AlertCircle, Lock } from 'lucide-react';
import { dbManager } from '../utils/db';
import { soundManager } from '../utils/audio';

interface AdminLoginScreenProps {
  onLoginSuccess: () => void;
  onCancel: () => void;
}

export const AdminLoginScreen: React.FC<AdminLoginScreenProps> = ({
  onLoginSuccess,
  onCancel
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setError('Please enter the administrator password/PIN.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const storedPin = await dbManager.getAdminPin();
      if (pin.trim() === storedPin) {
        soundManager.playCorrect();
        onLoginSuccess();
      } else {
        soundManager.playIncorrect();
        setError('Access Denied: Invalid administrator password/PIN.');
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }
    } catch (err) {
      setError('Database error validating credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 py-12 sm:py-20 animate-fade-in">
      <div
        className={`bg-[#0b1c2d] border border-[#1b3658] rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden ${
          shake ? 'animate-shake border-rose-500' : ''
        }`}
      >
        {/* Glow */}
        <div className="absolute -top-16 -right-16 w-40 h-40 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#0e253d] border border-cyan-500/40 text-cyan-400 mx-auto flex items-center justify-center mb-3 shadow-lg">
            <Shield className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-extrabold text-white">Administrator Access</h2>
          <p className="text-xs sm:text-sm text-[#7ea0b7] mt-1">
            Sign in to configure questions, scoring, timers, and data backups
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-[#38efbf]" />
              Admin Password / PIN
            </label>
            <div className="relative">
              <input
                type="password"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Enter admin password (default: admin123)"
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-[#081525] border border-[#1b3e64] text-white placeholder-slate-500 focus:outline-none focus:border-[#38efbf] focus:ring-1 focus:ring-[#38efbf] text-sm"
              />
            </div>
            {error && (
              <p className="mt-2 text-xs text-rose-400 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl bg-[#38efbf] hover:bg-[#2dd4a6] text-[#061923] font-bold text-sm tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Lock className="w-4 h-4" />
            <span>{loading ? 'Authenticating...' : 'Sign In to Portal'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundManager.playClick();
              onCancel();
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-transparent hover:bg-[#0e233a] text-slate-400 hover:text-white text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Game</span>
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-[#142d4a] text-center">
          <p className="text-[11px] text-slate-500 leading-normal">
            Initial default credential: <code className="text-[#38efbf] font-mono">admin123</code>. You can change this PIN inside Admin Settings.
          </p>
        </div>
      </div>
    </div>
  );
};
