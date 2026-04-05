/**
 * TokenStatusBar — live token expiry countdown
 *
 * Shows exactly what the api-kit client is doing with tokens in real-time:
 * green = healthy, yellow = pre-emptive refresh zone, red = expired.
 */

import { useTokenInfo } from "../hooks/useTokenInfo";

interface Props {
  tokenConfig: { accessTokenExpiresIn: string; refreshTokenExpiresIn: string } | null;
  refreshCount: number;
}

export default function TokenStatusBar({ tokenConfig, refreshCount }: Props) {
  const info = useTokenInfo();

  const statusColor = info.isExpired
    ? "bg-red-500"
    : info.isExpiringSoon
    ? "bg-amber-400"
    : "bg-emerald-500";

  const statusLabel = info.isExpired
    ? "Expired"
    : info.isExpiringSoon
    ? "Refreshing soon…"
    : "Valid";

  const statusText = info.isExpired
    ? "text-red-400"
    : info.isExpiringSoon
    ? "text-amber-400"
    : "text-emerald-400";

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-300">Token Status</h3>
        <span className={`flex items-center gap-1.5 text-xs font-medium ${statusText}`}>
          <span className={`w-2 h-2 rounded-full ${statusColor} ${info.isExpiringSoon && !info.isExpired ? "animate-pulse" : ""}`} />
          {statusLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="Expires in"
          value={
            info.secondsRemaining === null
              ? "—"
              : info.secondsRemaining <= 0
              ? "Expired"
              : `${info.secondsRemaining}s`
          }
          highlight={info.isExpiringSoon || info.isExpired}
          danger={info.isExpired}
        />
        <Stat label="Silent refreshes" value={String(refreshCount)} />
        {tokenConfig && (
          <>
            <Stat label="Access TTL"  value={tokenConfig.accessTokenExpiresIn} />
            <Stat label="Refresh TTL" value={tokenConfig.refreshTokenExpiresIn} />
          </>
        )}
      </div>

      {info.secondsRemaining !== null && info.secondsRemaining > 0 && (
        <div className="mt-3">
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${statusColor}`}
              style={{
                // We don't know the total TTL from here, but we can show a rough decay.
                // We cap at 100% for the first reading and let it shrink.
                width: `${Math.min(100, (info.secondsRemaining / 30) * 100)}%`,
              }}
            />
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Pre-emptive refresh triggers at ≤ 10 s remaining
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight = false,
  danger = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="bg-slate-800/60 rounded-lg px-3 py-2">
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p
        className={`text-sm font-mono font-semibold ${
          danger ? "text-red-400" : highlight ? "text-amber-400" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
