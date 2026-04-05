/**
 * Dashboard — shown when the user is authenticated.
 * Combines token status, user info, race-condition demo, and manual data fetch.
 */

import React, { useState } from "react";
import { User } from "../hooks/useAuth";
import { apiClient } from "../apiClient";
import TokenStatusBar from "./TokenStatusBar";
import RaceConditionDemo from "./RaceConditionDemo";

interface Props {
  user: User;
  tokenConfig: { accessTokenExpiresIn: string; refreshTokenExpiresIn: string } | null;
  onLogout: () => Promise<void>;
}

interface DataResult {
  message: string;
  timestamp: string;
  items: { id: number; value: string }[];
}

export default function Dashboard({ user, tokenConfig, onLogout }: Props) {
  const [data, setData]               = useState<DataResult | null>(null);
  const [fetching, setFetching]       = useState(false);
  const [fetchError, setFetchError]   = useState("");
  const [loggingOut, setLoggingOut]   = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);

  // Track silent refreshes
  React.useEffect(() => {
    const handler = () => setRefreshCount((n) => n + 1);
    window.addEventListener("token-refreshed", handler);
    return () => window.removeEventListener("token-refreshed", handler);
  }, []);

  async function fetchData() {
    setFetching(true);
    setFetchError("");
    try {
      const res = await apiClient.get<DataResult>("/api/data");
      setData(res.data);
    } catch {
      setFetchError("Failed to fetch data. See console for details.");
    } finally {
      setFetching(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    await onLogout();
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white">
              {user.username[0].toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">{user.username}</h1>
              <p className="text-xs text-slate-500">sub: {user.sub}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-red-400
                       disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loggingOut ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            )}
            {loggingOut ? "Logging out…" : "Logout"}
          </button>
        </div>

        {/* Token status */}
        <TokenStatusBar tokenConfig={tokenConfig} refreshCount={refreshCount} />

        {/* Race condition demo */}
        <RaceConditionDemo />

        {/* Manual fetch */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Protected Data Fetch</h3>
          </div>

          <button
            onClick={fetchData}
            disabled={fetching}
            className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50
                       disabled:cursor-not-allowed border border-slate-700 text-sm text-white
                       font-medium rounded-lg py-2.5 transition flex items-center justify-center gap-2"
          >
            {fetching ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Fetching…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                GET /api/data
              </>
            )}
          </button>

          {fetchError && (
            <p className="mt-2 text-xs text-red-400">{fetchError}</p>
          )}

          {data && (
            <div className="mt-3 bg-slate-950 rounded-lg border border-slate-800 p-3">
              <p className="text-xs text-slate-500 mb-2">{data.timestamp}</p>
              <p className="text-sm text-emerald-400 mb-2">{data.message}</p>
              <div className="grid grid-cols-5 gap-1.5">
                {data.items.map((item) => (
                  <div key={item.id}
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-center">
                    <p className="text-xs text-slate-500">#{item.id}</p>
                    <p className="text-xs font-mono text-white truncate">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Feature legend */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Active Features</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { label: "Auto token attach",     active: true },
              { label: "401 → auto refresh",    active: true },
              { label: "Queue guard (no races)", active: true },
              { label: "Pre-emptive refresh",   active: true },
              { label: "Exponential backoff",   active: true },
              { label: "Pluggable storage",     active: true },
            ].map((f) => (
              <div key={f.label}
                className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-xs text-slate-300">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
