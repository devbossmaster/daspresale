"use client";

import { useEffect, useMemo, useState } from "react";
import { useChainId, useChains } from "wagmi";
import { bsc } from "wagmi/chains";
import { formatUnits } from "viem";
import { DollarSign, Target, Globe, AlertTriangle, TrendingUp, RefreshCw } from "lucide-react";
import { useTokenIcoDashboard } from "@/lib/hooks/useTokenIcoDashboard";
import { useRecentPurchases } from "@/lib/hooks/useRecentPurchases";
import { getUsdtAddress } from "@/lib/contracts/addresses";

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

function computeSaleStatus(input: {
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

export default function RaisedFunds() {
  const chainId = useChainId();
  const chains = useChains();
  const chain = chains.find((c) => c.id === chainId);

  // State for caching and refresh
  const [cachedData, setCachedData] = useState<ReturnType<typeof useTokenIcoDashboard>['data'] | null>(null);
  const [cachedInvestorsCount, setCachedInvestorsCount] = useState<number | null>(null);
  const [hasInitialData, setHasInitialData] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data, isLoading: dashLoading, refetch: refetchDashboard } = useTokenIcoDashboard();
  const { investorsCount, isLoading: investorsLoading, refetch: refetchInvestors } = useRecentPurchases({
    limit: 500,
    blockRange: 50_000n,
  });

  // Update cache when new data arrives
  useEffect(() => {
    if (data && !dashLoading) {
      setCachedData(data);
      setHasInitialData(true);
    }
  }, [data, dashLoading]);

  useEffect(() => {
    if (investorsCount !== undefined && !investorsLoading) {
      setCachedInvestorsCount(investorsCount);
    }
  }, [investorsCount, investorsLoading]);

  // Handle manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchDashboard?.(), refetchInvestors?.()]);
    } catch (error) {
      console.error("Refresh failed:", error);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Use cached data when loading (except first load)
  const stableDash = hasInitialData ? (data || cachedData) : data;
  const stableInvestorsCount = hasInitialData ? (investorsCount ?? cachedInvestorsCount) : investorsCount;

  // Only show loading on initial load, not on refetches
  const isInitialLoading = (!stableDash && dashLoading) || (stableInvestorsCount === undefined && investorsLoading);

  const payDecimals = stableDash?.payDecimals ?? 18;
  const paySymbol = stableDash?.paySymbol ?? "USDT";

  const priceRaw = stableDash?.tokenPrice;
  const raisedRaw = stableDash?.usdtRaised ?? 0n;
  const hardCapUsdtRaw = stableDash?.hardCapUSDT ?? 0n;
  const hardCapTokensRaw = stableDash?.hardCapTokens ?? 0n;
  const totalTokensSoldRaw = stableDash?.totalTokensSold ?? 0n;

  const pricePay = useMemo(() => {
    if (!priceRaw) return null;
    return trimDecimals(formatUnits(priceRaw, payDecimals), 6);
  }, [priceRaw, payDecimals]);

  const raisedPay = useMemo(() => {
    return trimDecimals(formatUnits(raisedRaw, payDecimals), 4);
  }, [raisedRaw, payDecimals]);

  const tokenDecimals = stableDash?.decimals ?? 18;
  const totalTokensSoldHuman = useMemo(() => {
    return trimDecimals(formatUnits(totalTokensSoldRaw, tokenDecimals), 1);
  }, [totalTokensSoldRaw, tokenDecimals]);

  const hasTokenCap = hardCapTokensRaw > 0n;
  const hasUsdtCap = hardCapUsdtRaw > 0n;

  const targetLabel = useMemo(() => {
    if (hasTokenCap)
      return `Target: ${trimDecimals(formatUnits(hardCapTokensRaw, tokenDecimals), 2)} ${stableDash?.symbol ?? "TOKEN"}`;
    if (hasUsdtCap) return `Target: ${trimDecimals(formatUnits(hardCapUsdtRaw, payDecimals), 2)} ${paySymbol}`;
    return "Target: Not set";
  }, [
    hasTokenCap,
    hasUsdtCap,
    hardCapTokensRaw,
    hardCapUsdtRaw,
    tokenDecimals,
    payDecimals,
    paySymbol,
    stableDash?.symbol,
  ]);

  const progress = stableDash?.progressPct ?? null;
  const progressSafe = clamp(progress ?? 0);

  const status = computeSaleStatus({
    paused: stableDash?.paused,
    start: stableDash?.start,
    end: stableDash?.end,
    tokenAddr: stableDash?.tokenAddr,
    tokenPrice: stableDash?.tokenPrice,
    tokensRemaining: stableDash?.tokensRemaining,
  });

  const statusPill =
    status.tone === "success"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
      : status.tone === "warning"
        ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
        : "bg-red-500/10 text-red-200 border-red-500/30";

  const expectedUsdt = getUsdtAddress(chainId);
  const payToken = stableDash?.payToken;
  const payTokenMismatch =
    !!expectedUsdt && !!payToken && expectedUsdt.toLowerCase() !== payToken.toLowerCase();

  return (
    <div className="relative overflow-hidden rounded-xl md:rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900/50 to-black/50 backdrop-blur-xl p-4 md:p-6 shadow-2xl">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
      
      <div className="relative space-y-5 md:space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-lg md:text-xl font-semibold text-white">Funding Overview</h2>
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
            <p className="text-sm text-gray-400 mt-1">
              {stableDash?.symbol ? `${stableDash.symbol} Presale` : "Token Presale"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${statusPill}`}>
              <div className={`w-2 h-2 rounded-full ${
                status.tone === 'success' ? 'bg-emerald-400 animate-pulse' :
                status.tone === 'warning' ? 'bg-amber-400' : 'bg-red-400'
              }`} />
              <span className="text-xs font-medium">{status.label}</span>
            </div>
          </div>
        </div>

        {/* Payment Token Warning */}
        {payTokenMismatch && (
          <div className="rounded-xl border border-red-500/30 bg-gradient-to-r from-red-500/10 to-red-600/5 p-4 backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-red-200">Payment Token Mismatch</div>
                <div className="mt-1 text-sm text-red-300/80">
                  Contract payToken doesn't match configured USDT address
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Current Price Card */}
        <div className="group p-4 md:p-5 bg-gradient-to-br from-gray-900/50 to-black/30 rounded-xl border border-white/10 backdrop-blur-sm hover:border-purple-500/30 transition-all duration-300">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-400">Current Price</p>
              {isInitialLoading ? (
                <div className="h-9 w-48 bg-gray-800/50 rounded-lg animate-pulse mt-1" />
              ) : (
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl md:text-3xl font-bold text-white">
                    {pricePay ? `${pricePay}` : "—"}
                  </span>
                  <span className="text-sm text-purple-300/80">{paySymbol}</span>
                  <span className="text-xs text-gray-400">per token</span>
                </div>
              )}
            </div>

            <div className="px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30">
              <span className="text-xs font-medium text-purple-300">Price</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Total Raised */}
          {/* <div className="flex justify-between items-center p-4 bg-gradient-to-br from-gray-900/30 to-black/20 rounded-xl border border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-600/20">
                <DollarSign className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Total Raised</p>
                {isInitialLoading ? (
                  <div className="h-6 w-32 bg-gray-800/50 rounded animate-pulse mt-1" />
                ) : (
                  <p className="text-lg font-semibold text-white">
                    {raisedPay} <span className="text-sm text-green-300/80">{paySymbol}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400">Progress</div>
              {isInitialLoading ? (
                <div className="h-6 w-16 bg-gray-800/50 rounded animate-pulse mt-1" />
              ) : (
                <p className="text-lg font-semibold text-white">
                  {progress === null ? "N/A" : `${progressSafe.toFixed(1)}%`}
                </p>
              )}
            </div>
          </div> */}

          {/* Total Tokens Sold */}
          <div className="flex justify-between items-center p-4 bg-gradient-to-br from-gray-900/30 to-black/20 rounded-xl border border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-600/20">
                <TrendingUp className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Tokens Sold</p>
                {isInitialLoading ? (
                  <div className="h-6 w-40 bg-gray-800/50 rounded animate-pulse mt-1" />
                ) : (
                  <p className="text-lg font-semibold text-white">
                    {totalTokensSoldHuman} <span className="text-sm text-blue-300/80">{stableDash?.symbol ?? "TOKEN"}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

         </div>
        {/* Info Box */}
        <div className="p-4 bg-gradient-to-r from-gray-900/30 to-black/30 rounded-xl border border-white/10">
          <p className="text-sm text-gray-300 leading-relaxed">
            Presale closes when the hard cap is reached or the sale window ends.
            {hasTokenCap && ` Token cap: ${trimDecimals(formatUnits(hardCapTokensRaw, tokenDecimals), 2)} ${stableDash?.symbol}`}
            {hasUsdtCap && ` USDT cap: ${trimDecimals(formatUnits(hardCapUsdtRaw, payDecimals), 2)} ${paySymbol}`}
          </p>
        </div>

        {/* Last Updated */}
        {!isInitialLoading && hasInitialData && (
          <div className="text-xs text-gray-500/60 text-center pt-2">
            <div className="flex items-center justify-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400/50 animate-pulse" />
              <span>Live updates</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}