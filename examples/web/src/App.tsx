import React from "react";
import { useAuth } from "./hooks/useAuth";
import LoginForm from "./components/LoginForm";
import Dashboard from "./components/Dashboard";

export default function App() {
  const { user, loading, tokenConfig, login, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="w-8 h-8 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <p className="text-slate-400 text-sm">Restoring session…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm onLogin={login} />;
  }

  return <Dashboard user={user} tokenConfig={tokenConfig} onLogout={logout} />;
}
