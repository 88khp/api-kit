/**
 * RaceConditionDemo — fires N parallel requests simultaneously
 *
 * When the access token is expired (or about to expire), all N requests will
 * arrive at the server with an invalid token and receive 401.
 * Watch the network tab: you will see exactly ONE /auth/refresh call, while
 * all N data requests complete successfully — this is the queue mechanism.
 *
 * The log panel shows the timeline of each request so the behaviour is
 * immediately visible without opening DevTools.
 */

import React, { useState } from "react";
import { apiClient } from "../apiClient";

interface LogEntry {
  id: number;
  timestamp: string;
  message: string;
  type: "info" | "success" | "warn" | "error";
}

let globalId = 0;

export default function RaceConditionDemo() {
  const [concurrency, setConcurrency] = useState(5);
  const [running, setRunning]         = useState(false);
  const [logs, setLogs]               = useState<LogEntry[]>([]);

  function addLog(message: string, type: LogEntry["type"] = "info") {
    setLogs((prev) => [
      {
        id: ++globalId,
        timestamp: new Date().toLocaleTimeString("en", { hour12: false, fractionalSecondDigits: 2 }),
        message,
        type,
      },
      ...prev.slice(0, 49), // keep last 50
    ]);
  }

  async function fireRequests() {
    setRunning(true);
    addLog(`Firing ${concurrency} parallel requests…`, "info");

    const start = Date.now();

    const requests = Array.from({ length: concurrency }, (_, i) =>
      apiClient
        .get<{ message: string; timestamp: string }>(`/api/data?req=${i + 1}`)
        .then((res) => {
          addLog(`Request ${i + 1} ✓  — ${res.data.message}`, "success");
          return { ok: true };
        })
        .catch((err: unknown) => {
          const status = (err as { response?: { status?: number } }).response?.status;
          addLog(`Request ${i + 1} ✗  — status ${status ?? "network error"}`, "error");
          return { ok: false };
        })
    );

    const results = await Promise.all(requests);
    const ok = results.filter((r) => r.ok).length;
    addLog(
      `Done in ${Date.now() - start}ms — ${ok}/${concurrency} succeeded`,
      ok === concurrency ? "success" : "warn"
    );
    setRunning(false);
  }

  function clearLogs() {
    setLogs([]);
  }

  const typeStyles: Record<LogEntry["type"], string> = {
    info:    "text-slate-400",
    success: "text-emerald-400",
    warn:    "text-amber-400",
    error:   "text-red-400",
  };

  const typeIcon: Record<LogEntry["type"], string> = {
    info:    "→",
    success: "✓",
    warn:    "⚠",
    error:   "✗",
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Race Condition Demo</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Fire N parallel requests — only ONE token refresh happens regardless.
          </p>
        </div>
        <span className="text-xs bg-indigo-900/50 text-indigo-300 border border-indigo-800 rounded px-2 py-0.5 font-mono">
          QUEUE GUARD
        </span>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 shrink-0">Parallel requests</label>
          <input
            type="number"
            min={1}
            max={20}
            value={concurrency}
            onChange={(e) => setConcurrency(Math.max(1, Math.min(20, Number(e.target.value))))}
            className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white
                       text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <button
          onClick={fireRequests}
          disabled={running}
          className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500
                     disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg py-2
                     transition flex items-center justify-center gap-2"
        >
          {running ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Running…
            </>
          ) : (
            "Fire Requests"
          )}
        </button>

        {logs.length > 0 && (
          <button
            onClick={clearLogs}
            className="text-xs text-slate-500 hover:text-slate-300 transition shrink-0"
          >
            Clear
          </button>
        )}
      </div>

      {/* Tip */}
      <div className="bg-amber-950/30 border border-amber-900/50 rounded-lg px-3 py-2 mb-4">
        <p className="text-xs text-amber-300/80">
          <strong className="text-amber-300">Tip:</strong> Wait until the token expires (≤ 0 s) then fire
          requests. Check Network tab — you'll see only 1 <code>/auth/refresh</code> call.
        </p>
      </div>

      {/* Log panel */}
      {logs.length > 0 && (
        <div className="bg-slate-950 rounded-lg border border-slate-800 p-3 max-h-56 overflow-y-auto font-mono text-xs space-y-1">
          {logs.map((entry) => (
            <div key={entry.id} className="flex items-start gap-2">
              <span className="text-slate-600 shrink-0">{entry.timestamp}</span>
              <span className={`shrink-0 ${typeStyles[entry.type]}`}>{typeIcon[entry.type]}</span>
              <span className={typeStyles[entry.type]}>{entry.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
