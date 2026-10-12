import React, { useState } from 'react';
import { AdminLoginScreen } from './components/AdminLoginScreen';
import { AdminPanel } from './components/admin/AdminPanel';

export function AdminApp() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return (
    <div className="min-h-screen bg-[#060e19] text-white flex flex-col bg-grid-pattern selection:bg-[#38efbf]/20 selection:text-teal-200">
      {/* Top Admin App Header */}
      <header className="w-full border-b border-[#142d4a]/80 bg-[#060e19]/90 backdrop-blur sticky top-0 z-40 px-4 sm:px-8 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold tracking-widest text-[#38efbf] uppercase font-mono">
              OFFICIAL ADMINISTRATIVE APPLICATION
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white uppercase">
              CUSTOMER JOURNEY QUEST — ADMIN PORTAL
            </h1>
          </div>
          <div className="text-xs font-mono text-slate-400">
            Standalone Admin v2.0.0
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col justify-center py-6">
        {!isAuthenticated ? (
          <AdminLoginScreen
            onLoginSuccess={() => setIsAuthenticated(true)}
            onCancel={() => {
              if (window.confirm('Do you want to close the administrator session?')) {
                window.close();
              }
            }}
          />
        ) : (
          <AdminPanel
            onLogout={() => setIsAuthenticated(false)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="w-full py-4 px-6 border-t border-[#122842] text-center text-xs text-[#7ea0b7]/60 font-mono">
        Customer Journey Quest • Administrator Control Portal • Authoritative Question & Competition Management
      </footer>
    </div>
  );
}

export default AdminApp;
