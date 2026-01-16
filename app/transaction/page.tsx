// app/transaction/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Wallet as WalletIcon,
  DollarSign,
  ShoppingBag,
  Clock,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  Users,
  Calendar,
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useChainId, useChains } from "wagmi";
import { bsc } from "wagmi/chains";
import { formatUnits } from "viem";

import { useMounted } from "@/lib/hooks/useMounted";
import { useRecentPurchases } from "@/lib/hooks/useRecentPurchases";
import { useTokenIcoDashboard } from "@/lib/hooks/useTokenIcoDashboard";

function shortAddr(a?: string) {
  if (!a) return "—";
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

function formatDecimalStr(v?: string, maxFrac = 6) {
  if (!v) return "—";
  const [intRaw, fracRaw = ""] = v.split(".");
  const intPart = (intRaw || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = fracRaw.slice(0, maxFrac).replace(/0+$/, "");
  return frac.length ? `${intPart}.${frac}` : intPart;
}

function formatDateTimeClient(ts: number) {
  if (!ts) return { date: "—", time: "—" };
  const d = new Date(ts * 1000);
  return {
    date: d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }),
    time: d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }),
    full: d.toLocaleString()
  };
}

function extractErrText(e: any) {
  return e?.shortMessage || e?.cause?.shortMessage || e?.details || e?.message || "";
}

function humanizeReadError(e: any) {
  const raw = String(extractErrText(e) || "").toLowerCase();
  if (!raw) return "Unable to load transactions. Please try again.";
  if (raw.includes("network") || raw.includes("chain"))
    return "Network error. Please reconnect your wallet and retry.";
  if (raw.includes("timeout")) return "Request timed out. Please try again.";
  if (raw.includes("rate limit")) return "Rate limited. Please wait a moment.";
  if (raw.includes("failed to fetch")) return "Connection error. Check your network.";
  return "Unable to load transactions. Please try again.";
}

export default function TransactionPage() {
  const mounted = useMounted();
  const chainId = useChainId();
  const onBsc = chainId === bsc.id;

  const chains = useChains();
  const chain = chains.find((c) => c.id === chainId);
  const explorerBase = onBsc ? chain?.blockExplorers?.default?.url : undefined;

  // Caching states
  const [cachedDashboard, setCachedDashboard] = useState<any>(null);
  const [cachedTransactions, setCachedTransactions] = useState<any[]>([]);
  const [hasInitialData, setHasInitialData] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Fixed starting block for faster queries
  const FIXED_START_BLOCK = 73858251n;

  // Dashboard data with caching
  const { 
    data: dashLive, 
    isLoading: dashLoadingLive, 
    error: dashError,
    refetch: refetchDashboard 
  } = useTokenIcoDashboard();

  useEffect(() => {
    if (dashLive && !dashLoadingLive) {
      setCachedDashboard(dashLive);
      setHasInitialData(true);
    }
  }, [dashLive, dashLoadingLive]);

  const dash = hasInitialData ? (dashLive || cachedDashboard) : dashLive;
  const dashLoading = dashLoadingLive && !hasInitialData;

  // Transactions with caching - using fixed start block
  const {
    rows: liveRows,
    isLoading: logsLoading,
    error: logsError,
    refetch: refetchTransactions,
  } = useRecentPurchases({
    limit: 200,
    blockRange: FIXED_START_BLOCK,
  });

  useEffect(() => {
    if (!logsLoading && !logsError && liveRows) {
      setCachedTransactions(liveRows);
      setHasInitialData(true);
    }
  }, [liveRows, logsLoading, logsError]);

  const rows = hasInitialData ? (liveRows || cachedTransactions) : (liveRows || []);
  const isLoading = logsLoading && !hasInitialData;

  const tokenSymbol = dash?.symbol ?? "TOKEN";
  const tokenDecimals = dash?.decimals ?? 18;
  const paySymbol = dash?.paySymbol ?? "USDT";
  const payDecimals = dash?.payDecimals ?? 18;

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.allSettled([
        refetchDashboard?.(),
        refetchTransactions?.(),
      ]);
    } catch (error) {
      console.error("Refresh failed:", error);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const totalTx = rows.length;
    const totalPaid = rows.reduce((acc, r) => acc + r.amountPaid, 0n);
    const totalTokens = rows.reduce((acc, r) => acc + r.tokensBought, 0n);
    
    // Get unique buyers
    const uniqueBuyers = new Set(rows.map(r => r.buyer.toLowerCase())).size;
    
    // Get latest transaction timestamp
    const latestTx = rows.length > 0 
      ? Math.max(...rows.map(r => r.timestamp))
      : 0;

    return {
      totalTx,
      uniqueBuyers,
      totalPaid: formatDecimalStr(formatUnits(totalPaid, payDecimals), 2),
      totalTokens: formatDecimalStr(formatUnits(totalTokens, tokenDecimals), 2),
      latestTx: latestTx ? formatDateTimeClient(latestTx).date : "—",
      avgPerTx: rows.length > 0 
        ? formatDecimalStr(formatUnits(totalPaid / BigInt(rows.length), payDecimals), 2)
        : "0",
    };
  }, [rows, payDecimals, tokenDecimals]);

  // Prepare transactions for display
  const txs = useMemo(() => {
    return rows.map((r) => {
      const paid = formatDecimalStr(formatUnits(r.amountPaid, payDecimals), 2);
      const bought = formatDecimalStr(formatUnits(r.tokensBought, tokenDecimals), 1);
      const { date, time, full } = mounted ? formatDateTimeClient(r.timestamp) : { date: "—", time: "—", full: "—" };

      const txUrl = explorerBase ? `${explorerBase}/tx/${r.txHash}` : undefined;
      const addrUrl = explorerBase ? `${explorerBase}/address/${r.buyer}` : undefined;

      return {
        key: `${r.txHash}:${r.blockNumber.toString()}`,
        wallet: r.buyer,
        walletShort: shortAddr(r.buyer),
        paid,
        bought,
        date,
        time,
        fullTime: full,
        status: "Completed" as const,
        txUrl,
        addrUrl,
        txHash: r.txHash,
        timestamp: r.timestamp,
      };
    });
  }, [rows, payDecimals, tokenDecimals, explorerBase, mounted]);

  // Pagination
  const totalPages = Math.ceil(txs.length / itemsPerPage);
  const paginatedTxs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return txs.slice(startIndex, startIndex + itemsPerPage);
  }, [txs, currentPage]);

  const readError = dashError || logsError;
  const errorText = readError ? humanizeReadError(readError) : null;
  const detailsText = readError ? extractErrText(readError) : null;

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white bg-gradient-to-b from-gray-900 via-gray-900 to-black">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-40 left-40 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-6 sm:pt-8 pb-10">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight bg-gradient-to-r from-white via-cyan-200 to-purple-200 bg-clip-text text-transparent">
              Transaction History
            </h1>
            <p className="mt-3 text-sm sm:text-base text-gray-400 max-w-2xl">
              Real-time tracking of all token purchases.
            </p>
          </div>

          {hasInitialData && !isLoading && (
            <div className="flex items-center gap-4">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-gray-300 transition-all duration-300 flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
              </button>
            </div>
          )}
        </div>

        {/* Network Warning */}
        {!onBsc && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-amber-600/5 p-4 backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-amber-200">Switch to BSC</div>
                <div className="mt-1 text-sm text-amber-300/80">
                  Please switch your wallet to BNB Smart Chain to view transaction history
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {readError && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-gradient-to-r from-red-500/10 to-red-600/5 p-4 backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-red-200">Could not load transactions</div>
                <div className="mt-1 text-sm text-red-300/80">{errorText}</div>
                
                {detailsText && (
                  <details className="mt-3">
                    <summary className="text-xs text-red-300/60 cursor-pointer select-none">Show technical details</summary>
                    <div className="mt-2 p-3 bg-red-900/20 rounded-lg text-xs text-red-300/50 whitespace-pre-wrap break-words">
                      {detailsText}
                    </div>
                  </details>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 mb-8">
          <div className="p-5 rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/50 to-black/30 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-900/30 to-cyan-900/10">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="text-sm text-gray-400">Total Transactions</div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-white">{stats.totalTx}</div>
            <div className="text-xs text-gray-500 mt-2">From block {FIXED_START_BLOCK.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</div>
          </div>

          <div className="p-5 rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/50 to-black/30 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-900/30 to-purple-900/10">
                <Users className="w-5 h-5 text-purple-400" />
              </div>
              <div className="text-sm text-gray-400">Unique Buyers</div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-white">{stats.uniqueBuyers}</div>
            <div className="text-xs text-gray-500 mt-2">Distinct wallets</div>
          </div>
          {/* <div className="p-5 rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/50 to-black/30 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-900/30 to-blue-900/10">
                <DollarSign className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-sm text-gray-400">Total Volume</div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-white">{stats.totalPaid}</div>
            <div className="text-xs text-gray-500 mt-2">{paySymbol} Raised</div>
          </div>

          <div className="p-5 rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/50 to-black/30 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-900/30 to-emerald-900/10">
                <Calendar className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-sm text-gray-400">Latest Activity</div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-white">{stats.latestTx}</div>
            <div className="text-xs text-gray-500 mt-2">Most recent purchase</div>
          </div>
        </div> */}
      </div>

        {/* Main Transaction Card */}
        <div className="rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/50 to-black/30 backdrop-blur-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-5 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-fuchsia-900/30 to-fuchsia-900/10">
                <ShoppingBag className="w-5 h-5 text-fuchsia-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Purchase History</h2>
                <p className="text-xs text-gray-400">
                  {isLoading ? 'Loading transactions...' : `${txs.length} transactions found`}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-900/50 text-xs text-gray-400">
                <Filter className="w-3.5 h-3.5" />
                <span>Page {currentPage} of {totalPages}</span>
              </div>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <WalletIcon className="w-4 h-4" />
                      Wallet
                    </div>
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Payment ({paySymbol})
                    </div>
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4" />
                      Tokens ({tokenSymbol})
                    </div>
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Date & Time
                    </div>
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/5">
                {isLoading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-5">
                      <div className="h-4 bg-gray-800/50 rounded w-32"></div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="h-4 bg-gray-800/50 rounded w-24"></div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="h-4 bg-gray-800/50 rounded w-24"></div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="h-4 bg-gray-800/50 rounded w-36"></div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="h-6 bg-gray-800/50 rounded w-20"></div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="h-8 bg-gray-800/50 rounded w-20"></div>
                    </td>
                  </tr>
                ))}

                {!isLoading && !readError && paginatedTxs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="inline-flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-800/50 to-gray-900/50 flex items-center justify-center">
                          <ShoppingBag className="w-8 h-8 text-gray-500" />
                        </div>
                        <div>
                          <div className="font-medium text-white mb-1">No Transactions Found Wait a Little</div>
                          
                        </div>
                      </div>
                    </td>
                  </tr>
                )}

                {paginatedTxs.map((tx) => (
                  <tr key={tx.key} className="group hover:bg-white/5 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                          <WalletIcon className="w-4 h-4 text-gray-400" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">{tx.walletShort}</div>
                          <div className="text-xs text-gray-500">Wallet</div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-5">
                      <div className="text-lg font-bold text-cyan-300">{tx.paid}</div>
                      <div className="text-xs text-gray-500">{paySymbol}</div>
                    </td>
                    
                    <td className="px-6 py-5">
                      <div className="text-lg font-bold text-purple-300">{tx.bought}</div>
                      <div className="text-xs text-gray-500">{tokenSymbol}</div>
                    </td>
                    
                    <td className="px-6 py-5">
                      <div className="text-sm text-gray-300">{tx.date}</div>
                      <div className="text-xs text-gray-500">{tx.time}</div>
                    </td>
                    
                    <td className="px-6 py-5">
                      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-900/30 px-3 py-1.5 text-xs text-emerald-400 border border-emerald-500/20">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        {tx.status}
                      </div>
                    </td>
                    
                    <td className="px-6 py-5">
                      <div className="flex gap-2">
                        {tx.txUrl && (
                          <a
                            href={tx.txUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-gray-300 rounded-lg transition-all duration-200"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Tx
                          </a>
                        )}
                        {tx.addrUrl && (
                          <a
                            href={tx.addrUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-gray-300 rounded-lg transition-all duration-200"
                          >
                            <WalletIcon className="w-3.5 h-3.5" />
                            Wallet
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile/Tablet Cards */}
          <div className="lg:hidden p-4 space-y-4">
            {isLoading && Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4 rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/30 to-black/20 animate-pulse">
                <div className="flex justify-between items-center mb-4">
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-800/50 rounded w-32"></div>
                    <div className="h-3 bg-gray-800/50 rounded w-24"></div>
                  </div>
                  <div className="h-6 bg-gray-800/50 rounded w-16"></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-6 bg-gray-800/50 rounded"></div>
                  <div className="h-6 bg-gray-800/50 rounded"></div>
                </div>
              </div>
            ))}

            {!isLoading && !readError && paginatedTxs.length === 0 && (
              <div className="p-8 text-center">
                <div className="inline-flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-800/50 to-gray-900/50 flex items-center justify-center">
                    <ShoppingBag className="w-8 h-8 text-gray-500" />
                  </div>
                  <div>
                    <div className="font-medium text-white mb-2">No Transactions Found</div>
                    <div className="text-sm text-gray-400">
                      Searched from block {FIXED_START_BLOCK.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.
                      When purchases are made, they will appear here in real-time.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {paginatedTxs.map((tx) => (
              <div key={tx.key} className="group p-4 rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/30 to-black/20 backdrop-blur-sm hover:border-fuchsia-500/30 transition-all duration-300">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs text-gray-400">{tx.date}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      <WalletIcon className="w-4 h-4 text-gray-400" />
                      {tx.walletShort}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 rounded-full bg-emerald-900/30 px-3 py-1.5 text-xs text-emerald-400 border border-emerald-500/20">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span>{tx.status}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-3 rounded-lg bg-gradient-to-br from-cyan-900/20 to-cyan-900/10 border border-cyan-500/10">
                    <div className="text-xs text-gray-400 mb-1">Payment</div>
                    <div className="font-bold text-cyan-300">{tx.paid} {paySymbol}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-gradient-to-br from-purple-900/20 to-purple-900/10 border border-purple-500/10">
                    <div className="text-xs text-gray-400 mb-1">Tokens</div>
                    <div className="font-bold text-purple-300">{tx.bought} {tokenSymbol}</div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-white/10">
                  {tx.txUrl && (
                    <a
                      href={tx.txUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-xs bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-gray-300 rounded-lg transition-all duration-200"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Transaction
                    </a>
                  )}
                  {tx.addrUrl && (
                    <a
                      href={tx.addrUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-xs bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-gray-300 rounded-lg transition-all duration-200"
                    >
                      <WalletIcon className="w-3.5 h-3.5" />
                      Address
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 sm:px-6 py-4 border-t border-white/10 flex items-center justify-between">
              <div className="text-sm text-gray-400">
                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, txs.length)} of {txs.length} transactions
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-sm transition-all ${
                          currentPage === pageNum
                            ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white'
                            : 'hover:bg-white/10 text-gray-400'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          
          <div className="p-4 rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/30 to-black/20">
            <div className="text-xs text-gray-400 mb-2">Average per Transaction</div>
            <div className="text-lg font-bold text-cyan-300">{stats.avgPerTx} {paySymbol}</div>
          </div>
          
          <div className="p-4 rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/30 to-black/20">
            <div className="text-xs text-gray-400 mb-2">Total Tokens Distributed</div>
            <div className="text-lg font-bold text-purple-300">{stats.totalTokens} {tokenSymbol}</div>
          </div>
        </div>

        {/* Important Notice */}
        <div className="mt-8 p-4 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-amber-600/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-amber-200 mb-1">Data Source Information</div>
              <div className="text-sm text-amber-300/80">
                Transaction data is sourced from on-chain view transactions directly on the blockchain explorer.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}