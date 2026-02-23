"use client";

import { useMemo, useState, useEffect } from "react";
import { DollarSign, Coins, ShoppingBag, RefreshCw, ExternalLink, Calendar, Wallet } from "lucide-react";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { useTokenIcoDashboard } from "@/lib/hooks/useTokenIcoDashboard";
import { useRecentPurchases } from "@/lib/hooks/useRecentPurchases";
import { useMounted } from "@/lib/hooks/useMounted";

type PurchaseRow = {
  buyer: string;
  txHash: string;
  timestamp: number;
  amountPaid: bigint;
  tokensBought: bigint;
};

function formatDecimalStr(v?: string, maxFrac = 4) {
  if (!v) return "—";
  const [intPartRaw, fracRaw = ""] = v.split(".");
  const intPart = (intPartRaw || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = fracRaw.slice(0, maxFrac).replace(/0+$/, "");
  return frac.length ? `${intPart}.${frac}` : intPart;
}

function formatDateShort(ts: number) {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffHours < 168) return `${Math.floor(diffHours / 24)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function humanizeError(err: unknown) {
  const msg =
    (err as any)?.shortMessage ||
    (err as any)?.message ||
    (err as any)?.cause?.shortMessage ||
    (err as any)?.cause?.message ||
    "Unknown error";

  const s = String(msg).toLowerCase();

  if (s.includes("127.0.0.1") || s.includes("localhost")) return "Connect to BSC mainnet";
  if (s.includes("http request failed") || s.includes("failed to fetch") || s.includes("network error"))
    return "Network error. Please check connection";
  if (s.includes("execution reverted") || s.includes("contractfunctionexecutionerror")) return "Contract call failed";
  if (s.includes("user rejected")) return "Transaction was rejected";
  return "Could not load data";
}

/* ----------------------------- skeleton (blurry) ---------------------------- */

const Shimmer = () => (
  <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
);

function StatCardSkeleton() {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/50 to-black/30 p-5 sm:p-6">
      <Shimmer />
      <div className="absolute inset-0 bg-black/10 backdrop-blur-md" />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-5">
          <div className="p-3 rounded-xl bg-gray-800/50 border border-gray-700/50">
            <div className="h-6 w-6 bg-gray-700/50 rounded" />
          </div>
          <div className="h-6 w-14 bg-gray-800/50 border border-gray-700/50 rounded-full" />
        </div>
        <div className="space-y-3">
          <div className="h-8 w-32 bg-gray-800/60 rounded-lg" />
          <div className="h-4 w-24 bg-gray-800/50 rounded" />
          <div className="h-5 w-28 bg-gray-800/50 rounded" />
        </div>
      </div>
    </div>
  );
}

function ActivityItemSkeleton() {
  return (
    <div className="relative overflow-hidden p-4 rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/30 to-black/20">
      <Shimmer />
      <div className="absolute inset-0 bg-black/10 backdrop-blur-md" />
      <div className="relative z-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-gray-800/60" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-gray-800/60 rounded" />
            <div className="h-3 w-24 bg-gray-800/50 rounded" />
          </div>
        </div>
        <div className="space-y-2 text-right">
          <div className="h-5 w-40 bg-gray-800/60 rounded" />
          <div className="h-4 w-28 bg-gray-800/50 rounded" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------ localStorage cache (bigint) ----------------------- */

type CachedPurchaseRow = Omit<PurchaseRow, "amountPaid" | "tokensBought"> & {
  amountPaid: string;
  tokensBought: string;
};

function cacheKey(address?: string) {
  if (!address) return null;
  return `staera:overview:purchases:${address.toLowerCase()}`;
}

function serializeRows(rows: PurchaseRow[]): CachedPurchaseRow[] {
  return rows.map((r) => ({
    buyer: r.buyer,
    txHash: r.txHash,
    timestamp: r.timestamp,
    amountPaid: r.amountPaid.toString(),
    tokensBought: r.tokensBought.toString(),
  }));
}

function deserializeRows(rows: CachedPurchaseRow[]): PurchaseRow[] {
  return rows.map((r) => ({
    buyer: r.buyer,
    txHash: r.txHash,
    timestamp: r.timestamp,
    amountPaid: BigInt(r.amountPaid),
    tokensBought: BigInt(r.tokensBought),
  }));
}

export default function OverviewTab() {
  const mounted = useMounted();
  const { address } = useAccount();

  /* ---------------------- dashboard (fast, light reads) --------------------- */
  const {
    data: dash,
    userBalHuman,
    isLoading: dashLoading,
    error: dashError,
    refetch: refetchDashboard,
  } = useTokenIcoDashboard();

  // Cache dashboard + balance (so refetch never blanks UI)
  const [cachedDash, setCachedDash] = useState<any>(null);
  const [cachedUserBal, setCachedUserBal] = useState<string>("—");
  const [hasDashData, setHasDashData] = useState(false);

  useEffect(() => {
    if (dash && !dashLoading) {
      setCachedDash(dash);
      setHasDashData(true);
    }
  }, [dash, dashLoading]);

  useEffect(() => {
    if (userBalHuman !== undefined && userBalHuman !== null && !dashLoading) {
      setCachedUserBal(userBalHuman);
    }
  }, [userBalHuman, dashLoading]);

  const stableDash = hasDashData ? (dash || cachedDash) : dash;
  const stableUserBal = hasDashData ? (userBalHuman || cachedUserBal || "—") : userBalHuman || "—";

  /* -------------------- purchases - using fixed fromBlock for speed -------------------- */
  const FIXED_START_BLOCK = 73858251n; // Fixed starting block for faster queries

  const [hasLogsData, setHasLogsData] = useState(false);
  const [cachedRows, setCachedRows] = useState<PurchaseRow[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load persisted cache immediately (instant "spent/purchases/activity" after first visit)
  useEffect(() => {
    const k = cacheKey(address);
    if (!k) return;

    try {
      const raw = localStorage.getItem(k);
      if (!raw) return;

      const parsed = JSON.parse(raw) as { rows: CachedPurchaseRow[]; savedAt: number };
      const restored = deserializeRows(parsed.rows || []);

      if (restored.length) {
        setCachedRows(restored);
        setHasLogsData(true);
      }
    } catch {
      // ignore cache errors
    }
  }, [address]);

  // Read chain events - using fixed fromBlock instead of blockRange
  const {
    rows,
    isLoading: logsLoading,
    error: logsError,
    refetch: refetchPurchases,
  } = useRecentPurchases({
    limit: 200,
    blockRange: FIXED_START_BLOCK, // Using fixed block for faster queries
    minBlockDelta: 3n,
  });

  // Cache rows when new good data arrives, and persist to localStorage
  useEffect(() => {
    if (!rows || logsLoading || logsError) return;

    // Ensure we always have something to render (no flicker)
    setCachedRows(rows as PurchaseRow[]);
    setHasLogsData(true);

    const k = cacheKey(address);
    if (!k) return;

    try {
      localStorage.setItem(
        k,
        JSON.stringify({
          rows: serializeRows(rows as PurchaseRow[]),
          savedAt: Date.now(),
        })
      );
    } catch {
      // ignore storage quota errors
    }
  }, [rows, logsLoading, logsError, address]);

  // Keep UI stable during loading/refetch
  const stableRows: PurchaseRow[] = hasLogsData ? ((rows as PurchaseRow[] | undefined) || cachedRows) : (rows as PurchaseRow[] | undefined) || [];

  const payDecimals = stableDash?.payDecimals ?? 18;
  const paySymbol = stableDash?.paySymbol ?? "USDT";
  const tokenSymbol = stableDash?.symbol ?? "TOKEN";
  const tokenDecimals = stableDash?.decimals ?? 18;

  const myRows = useMemo(() => {
    if (!address) return [];
    const a = address.toLowerCase();
    return stableRows.filter((r) => r.buyer.toLowerCase() === a);
  }, [stableRows, address]);

  const totals = useMemo(() => {
    if (!myRows.length) return { spent: 0n, bought: 0n, count: 0 };
    const spent = myRows.reduce((acc, r) => acc + r.amountPaid, 0n);
    const bought = myRows.reduce((acc, r) => acc + r.tokensBought, 0n);
    return { spent, bought, count: myRows.length };
  }, [myRows]);

  const spentHuman = useMemo(() => formatDecimalStr(formatUnits(totals.spent, payDecimals), 2), [totals.spent, payDecimals]);
  const boughtHuman = useMemo(() => formatDecimalStr(formatUnits(totals.bought, tokenDecimals), 1), [totals.bought, tokenDecimals]);
  const recent = useMemo(() => myRows.slice(0, 3), [myRows]);

  // Loading behavior:
  // - Token balance should appear as soon as dash resolves (don't wait for logs)
  // - Spent/purchases/activity should appear as soon as logs resolve (or cache exists)
  const dashInitialLoading = !hasDashData && dashLoading;
  const logsInitialLoading = address ? (!hasLogsData && logsLoading) : false;

  // Errors:
  // - show errors only if there is no cached data for that section yet
  const dashShowError = !!dashError && !hasDashData;
  const logsShowError = !!logsError && !hasLogsData;

  const stats = [
    {
      title: "Token Balance",
      value: !address ? "—" : stableUserBal,
      subtitle: tokenSymbol,
      icon: DollarSign,
      color: "text-cyan-400",
      bgColor: "bg-gradient-to-br from-cyan-500/20 to-blue-600/20",
      borderColor: "border-cyan-500/30",
      loading: !address ? false : dashInitialLoading,
    },
    {
      title: `${paySymbol} Spent`,
      value: !address ? "—" : spentHuman,
      subtitle: paySymbol,
      icon: Coins,
      color: "text-emerald-400",
      bgColor: "bg-gradient-to-br from-emerald-500/20 to-green-600/20",
      borderColor: "border-emerald-500/30",
      loading: !address ? false : logsInitialLoading,
    },
    {
      title: "Purchases",
      value: !address ? "—" : `${totals.count}`,
      subtitle: !address ? "Connect wallet" : `Total: ${boughtHuman} ${tokenSymbol}`,
      icon: ShoppingBag,
      color: "text-purple-400",
      bgColor: "bg-gradient-to-br from-purple-500/20 to-violet-600/20",
      borderColor: "border-purple-500/30",
      loading: !address ? false : logsInitialLoading,
    },
  ] as const;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.allSettled([refetchDashboard?.(), refetchPurchases?.()]);
    } finally {
      setTimeout(() => setIsRefreshing(false), 350);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-white">Overview</h2>
          <p className="text-sm text-gray-400 mt-1">
            {address ? "Your personal activity and statistics" : "Connect wallet to view your overview"}
          </p>
        </div>

        {/* Refresh is available once dashboard OR logs have ever loaded */}
        {address && (hasDashData || hasLogsData) && (
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg hover:bg-white/10 transition-all duration-200 disabled:opacity-50"
            aria-label="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>

      {/* Errors (section-aware) */}
      {(dashShowError || logsShowError) && (
        <div className="rounded-xl border border-red-500/30 bg-gradient-to-r from-red-500/10 to-red-600/5 p-4 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-red-400" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-red-200">Unable to load data</div>
              <div className="mt-1 text-sm text-red-300/80">
                {humanizeError(dashShowError ? dashError : logsError)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {stats.map((stat, index) => {
          if (stat.loading) return <StatCardSkeleton key={index} />;

          return (
            <div
              key={index}
              className="group relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/50 to-black/30 p-5 sm:p-6 backdrop-blur-sm hover:border-white/20 transition-all duration-300"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="relative">
                <div className="flex items-start justify-between mb-4 sm:mb-6">
                  <div className={`p-2.5 sm:p-3 rounded-xl ${stat.bgColor} border ${stat.borderColor}`}>
                    <stat.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${stat.color}`} />
                  </div>

                  {/* Live / Updating badge */}
                  {address && stat.value !== "—" && (
                    <div className={`text-xs px-2 py-1 rounded-full ${stat.bgColor} border ${stat.borderColor}`}>
                      {(logsLoading && (stat.title.includes("Spent") || stat.title === "Purchases")) ? "Updating" : "Live"}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-white mb-1">{stat.value}</div>
                  <div className={`text-sm ${stat.color} mb-2`}>{stat.subtitle}</div>
                  <div className="text-base font-medium text-gray-300">{stat.title}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/50 to-black/30 backdrop-blur-sm">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-white">Recent Activity</h3>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-sm text-gray-400">
                  {address ? "Your latest on-chain purchases" : "Connect wallet to see your activity"}
                </p>

                {address && hasLogsData && myRows.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-green-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span>{myRows.length} transactions</span>
                  </div>
                )}
              </div>
            </div>

            {address && hasLogsData && myRows.length > 0 && (
              <a
                href={`https://bscscan.com/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-gray-300 hover:text-white transition-all duration-200 text-sm"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View on BSCScan
              </a>
            )}
          </div>

          <div className="space-y-4">
            {!address ? (
              <div className="p-8 text-center rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/30 to-black/20">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-gray-800 to-black mb-4">
                  <Wallet className="w-8 h-8 text-gray-400" />
                </div>
                <h4 className="text-lg font-medium text-gray-300">Wallet Not Connected</h4>
                <p className="text-sm text-gray-400 mt-2">Connect your wallet to view your purchase history and activity</p>
              </div>
            ) : logsInitialLoading ? (
              <>
                <ActivityItemSkeleton />
                <ActivityItemSkeleton />
                <ActivityItemSkeleton />
              </>
            ) : myRows.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/30 to-black/20">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-gray-800 to-black mb-4">
                  <ShoppingBag className="w-8 h-8 text-gray-400" />
                </div>
                <h4 className="text-lg font-medium text-gray-300">No Purchases Found</h4>
                <p className="text-sm text-gray-400 mt-2">You haven't made any purchases yet. Start by buying tokens in the presale.</p>
              </div>
            ) : (
              <>
                {recent.map((p, i) => (
                  <div
                    key={`${p.txHash}-${i}`}
                    className="group p-4 rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/30 to-black/20 hover:border-cyan-500/30 hover:bg-gradient-to-br hover:from-gray-900/40 hover:to-black/30 transition-all duration-300"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center space-x-4">
                        <div className="relative">
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center">
                            <ShoppingBag className="h-5 w-5 text-cyan-400" />
                          </div>
                          {i === 0 && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-400 animate-pulse border-2 border-gray-900" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-white">Token Purchase</div>
                          <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
                            <Calendar className="h-3.5 w-3.5" />
                            {mounted ? formatDateShort(p.timestamp) : "—"}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-bold text-lg text-cyan-300">
                          {formatDecimalStr(formatUnits(p.tokensBought, tokenDecimals), 1)} {tokenSymbol}
                        </div>
                        <div className="text-sm text-gray-400">
                          Paid: {formatDecimalStr(formatUnits(p.amountPaid, payDecimals), 2)} {paySymbol}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-white/10">
                      <a
                        href={`https://bscscan.com/tx/${p.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-xs text-cyan-300 hover:text-cyan-200 transition-colors"
                      >
                        View Transaction <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                ))}

                {/* Summary */}
                <div className="mt-6 p-4 rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/30 to-black/20">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-cyan-300">{totals.count}</div>
                      <div className="text-xs text-gray-400">Total Purchases</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-emerald-300">
                        {formatDecimalStr(formatUnits(totals.bought, tokenDecimals), 2)}
                      </div>
                      <div className="text-xs text-gray-400">Tokens Bought</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-300">
                        {formatDecimalStr(formatUnits(totals.spent, payDecimals), 2)}
                      </div>
                      <div className="text-xs text-gray-400">{paySymbol} Spent</div>
                    </div>
                  </div>
                </div>

                {/* Live indicator */}
                <div className="mt-4 text-xs text-gray-500 flex items-center justify-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/50 animate-pulse" />
                  <span>
                    From block 73,858,251 • Live updates
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}