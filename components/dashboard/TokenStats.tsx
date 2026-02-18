"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { TrendingUp, DollarSign, Package, Users, Clock, RefreshCw, AlertCircle } from "lucide-react";
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
    month: "short",
    day: "numeric",
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
    "Unknown error";

  const s = String(msg).toLowerCase();

  if (s.includes("127.0.0.1") || s.includes("localhost")) {
    return "Connect to BSC mainnet";
  }
  if (s.includes("http request failed") || s.includes("failed to fetch") || s.includes("network error")) {
    return "Network error. Please check connection";
  }
  if (s.includes("execution reverted") || s.includes("contractfunctionexecutionerror")) {
    return "Contract call failed";
  }
  if (s.includes("user rejected")) {
    return "Transaction was rejected";
  }
  return "Could not load data";
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
  const { data, isLoading: dashLoading, userBalHuman, error, refetch } = useTokenIcoDashboard();
  
  // State for manual refresh
  const [isRefreshing, setIsRefreshing] = useState(false);
  // State to track if we have initial data
  const [hasInitialData, setHasInitialData] = useState(false);
  
  // Cache last successful data
  const [cachedData, setCachedData] = useState<typeof data | null>(null);
  const [cachedUserBal, setCachedUserBal] = useState<string | null>(null);

  // Update cache when new data arrives
  useEffect(() => {
    if (data && !dashLoading) {
      setCachedData(data);
      setHasInitialData(true);
    }
  }, [data, dashLoading]);

  useEffect(() => {
    if (userBalHuman !== undefined && userBalHuman !== null && !dashLoading) {
      setCachedUserBal(userBalHuman);
    }
  }, [userBalHuman, dashLoading]);

  // Use cached data when loading (except first load)
  const stableDash = hasInitialData ? (data || cachedData) : data;
  const stableUserBal = hasInitialData ? (userBalHuman || cachedUserBal || "—") : userBalHuman || "—";

  // Handle manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch?.();
    } catch (error) {
      console.error("Refresh failed:", error);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const symbol = stableDash?.symbol ?? "TOKEN";
  const payDecimals = stableDash?.payDecimals ?? 18;
  const paySymbol = stableDash?.paySymbol ?? "USDT";

  const priceRaw = stableDash?.tokenPrice ?? 0n;
  const raisedRaw = stableDash?.usdtRaised ?? 0n;
  const remainingRaw = stableDash?.tokensRemaining ?? 0n;

  const priceHuman = useMemo(() => {
    if (priceRaw <= 0n) return null;
    return trimDecimals(formatUnits(priceRaw, payDecimals), 6);
  }, [priceRaw, payDecimals]);

  const raisedHuman = useMemo(() => {
    return trimDecimals(formatUnits(raisedRaw, payDecimals), 4);
  }, [raisedRaw, payDecimals]);

  const remainingHuman = stableDash?.tokensRemainingHuman ?? "—";
   // Display formatting (max 1 decimal)
  const userBalDisplay = useMemo(() => {
    if (!stableUserBal || stableUserBal === "—") return "—";
    return trimDecimals(String(stableUserBal), 1);
  }, [stableUserBal]);

  const remainingDisplay = useMemo(() => {
    if (!remainingHuman || remainingHuman === "—") return "—";
    return trimDecimals(String(remainingHuman), 1);
  }, [remainingHuman]);
  const progress = stableDash?.progressPct ?? null;
  const progressSafe = progress === null ? 0 : clamp(progress);

  const status = computeStatus({
    paused: stableDash?.paused,
    start: stableDash?.start,
    end: stableDash?.end,
    tokenAddr: stableDash?.tokenAddr,
    tokenPrice: stableDash?.tokenPrice,
    tokensRemaining: remainingRaw,
  });

  const statusPill =
    status.tone === "success"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
      : status.tone === "warning"
        ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
        : "bg-red-500/10 text-red-200 border-red-500/30";

  const windowEnabled = stableDash ? isSaleWindowEnabled(stableDash.start, stableDash.end) : false;
  const windowText =
    !mounted || !stableDash
      ? "—"
      : windowEnabled
        ? `${formatTs(stableDash.start)} → ${formatTs(stableDash.end)}`
        : "Always open";

  // Determine loading state - only show loading on initial load, not on refetches
  const isInitialLoading = dashLoading && !hasInitialData;
  
  // Show error only if we don't have cached data
  const showError = !!error && !hasInitialData;

  return (
    <div className="relative overflow-hidden rounded-xl md:rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900/50 to-black/50 backdrop-blur-xl p-4 md:p-6 shadow-2xl">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
      
      <div className="relative space-y-5 md:space-y-6">
        {/* Header with refresh button */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-lg md:text-xl font-semibold text-white">Token Statistics</h2>
              {!isInitialLoading && hasInitialData && (
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-all duration-200 disabled:opacity-50"
                  aria-label="Refresh data"
                >
                  <RefreshCw className={`w-4 h-4 text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>
            <div className="mt-2 inline-flex items-center gap-2 text-xs text-gray-400">
              <Clock className="w-3.5 h-3.5" />
              <span className="truncate">{windowText}</span>
            </div>
          </div>

          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${statusPill}`}>
            <div className={`w-2 h-2 rounded-full ${
              status.tone === 'success' ? 'bg-emerald-400 animate-pulse' :
              status.tone === 'warning' ? 'bg-amber-400' : 'bg-red-400'
            }`} />
            <span className="text-xs md:text-sm font-medium">{status.label}</span>
          </div>
        </div>

        {/* Error Message */}
        {showError && (
          <div className="rounded-xl border border-red-500/30 bg-gradient-to-r from-red-500/10 to-red-600/5 p-4 backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-red-200">Unable to load token statistics</div>
                <div className="mt-1 text-sm text-red-300/80">{humanizeError(error)}</div>
                <button
                  onClick={handleRefresh}
                  className="mt-2 text-sm px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="space-y-3 md:space-y-4">
          {/* Your Token Balance */}
          <div className="group p-4 md:p-5 bg-gradient-to-br from-gray-900/50 to-black/30 rounded-xl border border-white/10 backdrop-blur-sm hover:border-blue-500/30 transition-all duration-300">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="p-2.5 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20">
                  <Package className="w-5 h-5 md:w-6 md:h-6 text-cyan-400" />
                </div>
                <div>
                  <p className="text-xs md:text-sm text-gray-400">Your Tokens</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    {isInitialLoading ? (
                      <div className="h-7 w-32 bg-gray-800/50 rounded-lg animate-pulse" />
                    ) : (
                      <>
                        <p className="text-xl md:text-2xl font-bold text-white">
                          {userBalDisplay}
                        </p>
                        <span className="text-base text-cyan-300/80">{symbol}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-right hidden sm:block">
                <p className="text-xs text-gray-400">Price</p>
                {isInitialLoading ? (
                  <div className="h-6 w-24 bg-gray-800/50 rounded animate-pulse mt-1" />
                ) : (
                  <p className="text-sm font-semibold text-cyan-300">
                    {priceHuman ? `${priceHuman} ${paySymbol}` : "—"}
                  </p>
                )}
                <p className="text-[11px] text-gray-500/80 mt-0.5">per token</p>
              </div>
            </div>
          </div>
{/* 
          Total Raised
          <div className="group p-4 md:p-5 bg-gradient-to-br from-gray-900/50 to-black/30 rounded-xl border border-white/10 backdrop-blur-sm hover:border-purple-500/30 transition-all duration-300">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="p-2.5 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-600/20">
                <DollarSign className="w-5 h-5 md:w-6 md:h-6 text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs md:text-sm text-gray-400">Total Raised</p>
                {isInitialLoading ? (
                  <div className="h-7 w-40 bg-gray-800/50 rounded-lg animate-pulse mt-1" />
                ) : (
                  <p className="text-xl md:text-2xl font-bold text-white mt-1">
                    {raisedHuman} <span className="text-base text-purple-300/80">{paySymbol}</span>
                  </p>
                )}
              </div>
            </div>
          </div> */}

          {/* Available For Sale */}
          <div className="group p-4 md:p-5 bg-gradient-to-br from-gray-900/50 to-black/30 rounded-xl border border-white/10 backdrop-blur-sm hover:border-emerald-500/30 transition-all duration-300">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="p-2.5 rounded-lg bg-gradient-to-br from-emerald-500/20 to-green-600/20">
                <Users className="w-5 h-5 md:w-6 md:h-6 text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs md:text-sm text-gray-400">Available For Sale</p>
                <div className="flex items-baseline gap-2 mt-1">
                  {isInitialLoading ? (
                    <div className="h-7 w-40 bg-gray-800/50 rounded-lg animate-pulse" />
                  ) : (
                    <>
                      <p className="text-xl md:text-2xl font-bold text-white">
                        {remainingDisplay}
                      </p>
                      <span className="text-base text-emerald-300/80">{symbol}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="pt-4 border-t border-white/10">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-gray-400">Sale Progress</span>
            <span className="text-base font-semibold text-white">
            </span>
          </div>

          <div className="relative h-2.5 rounded-full bg-gray-900/80 overflow-hidden">
            {isInitialLoading ? (
              <div className="h-full w-full bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 animate-shimmer bg-[length:200%_100%]" />
            ) : (
              <>
                <div
                  className="absolute h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 transition-all duration-1000 ease-out"
                  style={{ width: `${progressSafe}%` }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-gradient-x" />
              </>
            )}
          </div>

          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>{isInitialLoading ? (
                <div className="h-5 w-12 bg-gray-800/50 rounded animate-pulse" />
              ) : (
                progress === null ? "N/A" : `${progressSafe.toFixed(1)}%`
              )}</span>
            <span>100%</span>
          </div>
        </div>

        {/* Last Updated */}
        {hasInitialData && !dashLoading && (
          <div className="text-xs text-gray-500/60 text-center pt-2">
            <div className="flex items-center justify-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/50 animate-pulse" />
              <span>Live data</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}