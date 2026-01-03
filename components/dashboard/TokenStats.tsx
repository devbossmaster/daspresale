// components/dashboard/TokenStats.tsx
"use client";

import { useMemo } from "react";
import { formatUnits } from "viem";
import { TrendingUp, DollarSign, Package, Users, Clock } from "lucide-react";
import { useTokenIcoDashboard } from "@/lib/hooks/useTokenIcoDashboard";
import { useMounted } from "@/lib/hooks/useMounted";

function trimDecimals(value: string, max: number) {
  if (!value.includes(".")) return value;
  const [i, f] = value.split(".");
  return `${i}.${f.slice(0, max)}`.replace(/\.?0+$/, "");
}

function clamp(n: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, n));
}

function isSaleWindowEnabled(start: number, end: number) {
  return start !== 0 && end !== 0;
}

function formatTs(ts: number) {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function humanizeError(err: unknown) {
  const msg =
    (err as any)?.shortMessage ||
    (err as any)?.message ||
    (err as any)?.cause?.shortMessage ||
    (err as any)?.cause?.message ||
    "";

  const s = String(msg).toLowerCase();

  if (s.includes("127.0.0.1") || s.includes("localhost")) {
    return "The app is trying to use a local RPC. Please switch your wallet to BSC and ensure your app is configured for BSC RPC only.";
  }
  if (s.includes("http request failed") || s.includes("failed to fetch") || s.includes("network error")) {
    return "Unable to reach the BSC RPC. Please check your RPC URL and connection.";
  }
  if (s.includes("execution reverted") || s.includes("contractfunctionexecutionerror")) {
    return "Contract call reverted. Confirm the presale contract address is correct on BSC.";
  }
  return "Could not load token statistics right now. Please try again.";
}

function computeStatus(input: {
  paused?: boolean;
  start?: number;
  end?: number;
  tokenAddr?: `0x${string}`;
  tokenPrice?: bigint;
  tokensRemaining?: bigint;
}) {
  const now = Math.floor(Date.now() / 1000);

  if (input.paused) return { label: "Paused", tone: "danger" as const };

  if (!input.tokenAddr || input.tokenAddr === "0x0000000000000000000000000000000000000000")
    return { label: "Token not set", tone: "danger" as const };

  if (!input.tokenPrice || input.tokenPrice === 0n)
    return { label: "Price not set", tone: "danger" as const };

  if (input.tokensRemaining !== undefined && input.tokensRemaining === 0n)
    return { label: "Sold out", tone: "danger" as const };

  const start = input.start ?? 0;
  const end = input.end ?? 0;

  if (isSaleWindowEnabled(start, end)) {
    if (now < start) return { label: "Not started", tone: "warning" as const };
    if (now > end) return { label: "Ended", tone: "warning" as const };
  }

  return { label: "Live", tone: "success" as const };
}

export default function TokenStats() {
  const mounted = useMounted();
  const { data, isLoading, userBalHuman, error } = useTokenIcoDashboard();

  const symbol = data?.symbol ?? "TOKEN";
  const payDecimals = data?.payDecimals ?? 18;
  const paySymbol = data?.paySymbol ?? "USDT";

  const priceRaw = data?.tokenPrice ?? 0n; // payToken units per 1 token
  const raisedRaw = data?.usdtRaised ?? 0n; // payToken
  const remainingRaw = data?.tokensRemaining ?? 0n;

  const priceHuman = useMemo(() => {
    if (priceRaw <= 0n) return null;
    return trimDecimals(formatUnits(priceRaw, payDecimals), 6);
  }, [priceRaw, payDecimals]);

  const raisedHuman = useMemo(() => {
    return trimDecimals(formatUnits(raisedRaw, payDecimals), 4);
  }, [raisedRaw, payDecimals]);

  const remainingHuman = data?.tokensRemainingHuman ?? "—";

  const progress = data?.progressPct ?? null;
  const progressSafe = progress === null ? 0 : clamp(progress);

  const status = computeStatus({
    paused: data?.paused,
    start: data?.start,
    end: data?.end,
    tokenAddr: data?.tokenAddr,
    tokenPrice: data?.tokenPrice,
    tokensRemaining: remainingRaw,
  });

  const statusPill =
    status.tone === "success"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
      : status.tone === "warning"
        ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
        : "bg-red-500/10 text-red-200 border-red-500/30";

  const windowEnabled = data ? isSaleWindowEnabled(data.start, data.end) : false;
  const windowText =
    !mounted || !data
      ? "—"
      : windowEnabled
        ? `${formatTs(data.start)} → ${formatTs(data.end)}`
        : "Always open (no window)";

  return (
    <div className="relative overflow-hidden rounded-xl md:rounded-2xl border border-slate-800 bg-gradient-to-br from-black to-slate-950 p-4 md:p-6 shadow-lg">
      <div className="absolute inset-0 opacity-5 bg-[linear-gradient(45deg,transparent_25%,rgba(6,182,212,0.1)_50%,transparent_75%)] bg-[length:20px_20px]" />

      <div className="relative space-y-5 md:space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg md:text-xl font-semibold">Token Statistics</h2>
            <div className="mt-2 inline-flex items-center gap-2 text-xs text-gray-400">
              <Clock className="w-4 h-4" />
              <span className="truncate">{windowText}</span>
            </div>
          </div>

          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${statusPill}`}>
            <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span className="text-xs md:text-sm font-medium">{status.label}</span>
          </div>
        </div>

        {error && (
  <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-100">
    <div className="font-semibold">Unable to load token statistics</div>
    <div className="mt-1 text-red-200">{humanizeError(error)}</div>

    <details className="mt-2 text-xs text-red-200/80">
      <summary className="cursor-pointer select-none">Details</summary>
      <div className="mt-2 whitespace-pre-wrap break-words opacity-80">
        {(error as any)?.shortMessage || (error as any)?.message || "—"}
      </div>
    </details>
  </div>
)}

        <div className="space-y-3 md:space-y-4">
          {/* Your wallet balance */}
          <div className="p-4 md:p-5 bg-black/30 rounded-xl border border-slate-800 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="p-2.5 rounded-lg bg-cyan-500/10">
                  <Package className="w-5 h-5 md:w-6 md:h-6 text-cyan-400" />
                </div>
                <div>
                  <p className="text-xs md:text-sm text-gray-400">Your Tokens</p>
                  <p className="text-xl md:text-2xl font-bold mt-1">
                    {isLoading ? "Loading..." : userBalHuman}{" "}
                    <span className="text-base text-cyan-300">{symbol}</span>
                  </p>
                </div>
              </div>

              <div className="text-right hidden sm:block">
                <p className="text-xs text-gray-400">Price</p>
                <p className="text-sm font-semibold text-cyan-300">
                  {isLoading ? "—" : priceHuman ? `${priceHuman} ${paySymbol}` : "—"}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">per token</p>
              </div>
            </div>
          </div>

          {/* Raised */}
          <div className="p-4 md:p-5 bg-black/30 rounded-xl border border-slate-800 backdrop-blur-sm">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="p-2.5 rounded-lg bg-purple-500/10">
                <DollarSign className="w-5 h-5 md:w-6 md:h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-gray-400">Total Raised</p>
                <p className="text-xl md:text-2xl font-bold mt-1">
                  {isLoading ? "Loading..." : `${raisedHuman} ${paySymbol}`}
                </p>
              </div>
            </div>
          </div>

          {/* Remaining tokens in ICO contract */}
          <div className="p-4 md:p-5 bg-black/30 rounded-xl border border-slate-800 backdrop-blur-sm">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="p-2.5 rounded-lg bg-emerald-500/10">
                <Users className="w-5 h-5 md:w-6 md:h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-gray-400">Available For Sale</p>
                <p className="text-xl md:text-2xl font-bold mt-1">
                  {isLoading ? "Loading..." : remainingHuman}{" "}
                  <span className="text-base text-emerald-300">{symbol}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="pt-4 border-t border-slate-800/50">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-gray-400">Sale Progress</span>
            <span className="text-base font-semibold">
              {progress === null ? "N/A" : `${progressSafe.toFixed(1)}%`}
            </span>
          </div>

          <div className="relative h-2.5 rounded-full bg-slate-900 overflow-hidden">
            <div
              className="absolute h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
              style={{ width: `${progress === null ? 0 : progressSafe}%` }}
            />
          </div>

          <div className="flex justify-between mt-2 text-xs text-gray-400">
            <span>0%</span>
            <span>100%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
