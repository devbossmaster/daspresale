"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Settings,
  DollarSign,
  Package,
  Link as LinkIcon,
  Wallet,
  Copy,
  ExternalLink,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  AlertCircle,
  Shield,
  Clock,
  TrendingUp,
  Users,
  ChevronRight,
  CheckCircle,
  XCircle,
  BarChart3,
  ShieldCheck,
  Cpu,
  Network,
  Loader2,
  Info,
} from "lucide-react";
import {
  useAccount,
  useChainId,
  useChains,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { bsc } from "wagmi/chains";
import { isAddress, parseUnits } from "viem";

import { getTokenIcoAddress } from "@/lib/contracts/addresses";
import { useTokenIcoDashboard } from "@/lib/hooks/useTokenIcoDashboard";
import { useMounted } from "@/lib/hooks/useMounted";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

function shortAddr(a?: string) {
  if (!a) return "—";
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

function formatTimeAgo(ts?: number) {
  if (!ts) return "—";
  const now = Math.floor(Date.now() / 1000);
  const diff = now - ts;
  
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  
  const d = new Date(ts * 1000);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function humanizeTxError(e: any) {
  const msg = e?.shortMessage || e?.cause?.shortMessage || e?.message || "";
  const s = String(msg).toLowerCase();
  
  if (s.includes("user rejected") || s.includes("rejected the request"))
    return "Transaction was cancelled in your wallet.";
  if (s.includes("insufficient funds"))
    return "Insufficient funds to pay gas.";
  if (s.includes("execution reverted"))
    return "Transaction reverted by contract.";
  if (s.includes("network") || s.includes("chain"))
    return "Network error. Please connect to BNB Smart Chain.";
  return "Transaction failed. Please try again.";
}

// Fixed: USDT has 6 decimals, not 18
function formatUsdtAmount(amount: bigint, decimals: number = 6): string {
  if (amount === 0n) return "0.0";
  
  const value = Number(amount) / 10 ** decimals;
  
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
}

function formatTokens(amount: bigint, decimals: number = 18): string {
  if (amount === 0n) return "0";
  const value = Number(amount) / 10 ** decimals;
  
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)}K`;
  }
  
  return value.toLocaleString('en-US', { 
    maximumFractionDigits: 2 
  });
}

const adminSections = [
  { id: "overview", label: "Dashboard", icon: BarChart3 },
  { id: "token-config", label: "Token Setup", icon: ShieldCheck },
  { id: "price-settings", label: "Price Settings", icon: DollarSign },
  { id: "sale-controls", label: "Sale Controls", icon: Cpu },
] as const;

type SectionId = typeof adminSections[number]["id"];

export default function AdminPage() {
  const mounted = useMounted();
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  
  const [cachedDashboard, setCachedDashboard] = useState<any>(null);
  const [cachedOwner, setCachedOwner] = useState<`0x${string}` | null>(null);
  const [hasInitialData, setHasInitialData] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  const chainId = useChainId();
  const onBsc = chainId === bsc.id;
  const chains = useChains();
  const chain = chains.find((c) => c.id === chainId);
  const { address: user } = useAccount();

  const ico = getTokenIcoAddress(chainId);
  const publicClient = usePublicClient();
  const explorerBase = onBsc ? chain?.blockExplorers?.default?.url : undefined;

  const { 
    data: dashLive, 
    isLoading: dashLoadingLive, 
    refetch: refetchDashboard 
  } = useTokenIcoDashboard();

  useEffect(() => {
    if (dashLive && !dashLoadingLive) {
      setCachedDashboard(dashLive);
      setHasInitialData(true);
      setLastUpdate(Date.now());
    }
  }, [dashLive, dashLoadingLive]);

  const dash = hasInitialData ? (dashLive || cachedDashboard) : dashLive;
  const dashLoading = dashLoadingLive && !hasInitialData;

  const ownerRead = useReadContract({
    address: onBsc ? ico : undefined,
    abi: [{ type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] }],
    functionName: "owner",
    query: { 
      enabled: !!ico && onBsc, 
      staleTime: 10000,
    },
  });

  useEffect(() => {
    if (ownerRead.data && !ownerRead.isLoading) {
      setCachedOwner(ownerRead.data as `0x${string}`);
    }
  }, [ownerRead.data, ownerRead.isLoading]);

  const ownerAddr = hasInitialData ? (ownerRead.data || cachedOwner) : ownerRead.data;
  const isOwner = useMemo(() => {
    if (!user || !ownerAddr) return false;
    return user.toLowerCase() === ownerAddr.toLowerCase();
  }, [user, ownerAddr]);

  const [uiError, setUiError] = useState<string | null>(null);
  const [uiSuccess, setUiSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<`0x${string}` | null>(null);

  const [saleTokenInput, setSaleTokenInput] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [startInput, setStartInput] = useState<string>("");
  const [endInput, setEndInput] = useState<string>("");

  const { writeContractAsync, isPending } = useWriteContract();

  const saleTokenAlreadySet = useMemo(() => {
    const t = dash?.tokenAddr as `0x${string}` | undefined;
    return !!t && t !== ZERO_ADDRESS;
  }, [dash?.tokenAddr]);

  const saleSymbol = dash?.symbol ?? "TOKEN";
  const payDecimals = dash?.payDecimals ?? 6; // Fixed: USDT has 6 decimals
  const paySymbol = dash?.paySymbol ?? "USDT";
  const isPaused = dash?.paused ?? false;
  const usdtRaised = dash?.usdtRaised ?? 0n;
  const tokensRemaining = dash?.tokensRemaining ?? 0n;
  const currentPrice = dash?.priceUsdt ?? "0";

  const usdtRaisedFormatted = useMemo(() => {
    return formatUsdtAmount(usdtRaised, 18); // Fixed: 6 decimals for USDT
  }, [usdtRaised]);

  const tokensRemainingFormatted = useMemo(() => {
    return formatTokens(tokensRemaining, 18);
  }, [tokensRemaining]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.allSettled([
        refetchDashboard?.(),
        ownerRead.refetch?.(),
      ]);
      setLastUpdate(Date.now());
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  function resetNotices() {
    setUiError(null);
    setUiSuccess(null);
    setLastTx(null);
  }

  async function runWrite(label: string, args: any) {
    resetNotices();

    try {
      if (!onBsc) throw new Error("Please switch to BNB Smart Chain.");
      if (!ico) throw new Error("ICO address not configured.");
      if (!isOwner) throw new Error("Only contract owner can perform this action.");
      if (!publicClient) throw new Error("Public client not ready.");

      const hash = await writeContractAsync(args);
      setLastTx(hash);

      await publicClient.waitForTransactionReceipt({ hash });
      setUiSuccess(`${label} successful!`);
      
      handleRefresh();
    } catch (e: any) {
      setUiError(humanizeTxError(e));
    }
  }

  async function onSetSaleToken() {
    const addr = saleTokenInput.trim();
    if (!isAddress(addr)) {
      setUiError("Invalid token address.");
      return;
    }

    await runWrite("Token set", {
      address: ico!,
      abi: [{ type: "function", name: "setSaleToken", stateMutability: "nonpayable", inputs: [{ name: "_token", type: "address" }], outputs: [] }],
      functionName: "setSaleToken",
      args: [addr as `0x${string}`],
    });

    setSaleTokenInput("");
  }

  async function onUpdatePrice() {
    const v = priceInput.trim();
    if (!v || Number(v) <= 0) {
      setUiError("Enter a valid price greater than 0.");
      return;
    }

    let newPrice: bigint;
    try {
      newPrice = parseUnits(v.replace(/,/g, ""), payDecimals);
    } catch {
      setUiError(`Invalid number format. Max decimals: ${payDecimals}.`);
      return;
    }

    await runWrite("Price updated", {
      address: ico!,
      abi: [{ type: "function", name: "updateTokenPrice", stateMutability: "nonpayable", inputs: [{ name: "newPrice", type: "uint256" }], outputs: [] }],
      functionName: "updateTokenPrice",
      args: [newPrice],
    });

    setPriceInput("");
  }

  async function onPause() {
    await runWrite("Sale paused", {
      address: ico!,
      abi: [{ type: "function", name: "pause", stateMutability: "nonpayable", inputs: [], outputs: [] }],
      functionName: "pause",
      args: [],
    });
  }

  async function onUnpause() {
    await runWrite("Sale unpaused", {
      address: ico!,
      abi: [{ type: "function", name: "unpause", stateMutability: "nonpayable", inputs: [], outputs: [] }],
      functionName: "unpause",
      args: [],
    });
  }

  async function onSetSaleWindow() {
    const s = BigInt(startInput.trim() || "0");
    const e = BigInt(endInput.trim() || "0");

    if (s === 0n && e === 0n) {
      await runWrite("Sale window disabled", {
        address: ico!,
        abi: [{ type: "function", name: "setSaleWindow", stateMutability: "nonpayable", inputs: [{ name: "start", type: "uint64" }, { name: "end", type: "uint64" }], outputs: [] }],
        functionName: "setSaleWindow",
        args: [s, e],
      });
      return;
    }

    if (s >= e) {
      setUiError("End time must be greater than start time.");
      return;
    }

    await runWrite("Sale window updated", {
      address: ico!,
      abi: [{ type: "function", name: "setSaleWindow", stateMutability: "nonpayable", inputs: [{ name: "start", type: "uint64" }, { name: "end", type: "uint64" }], outputs: [] }],
      functionName: "setSaleWindow",
      args: [s, e],
    });
  }

  useEffect(() => {
    if (dash?.start !== undefined) setStartInput(String(dash.start));
    if (dash?.end !== undefined) setEndInput(String(dash.end));
  }, [dash?.start, dash?.end]);

  const txUrl = lastTx && explorerBase ? `${explorerBase}/tx/${lastTx}` : null;

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 -left-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-40 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10">
        <div className="border-b border-white/10 backdrop-blur-xl bg-gradient-to-r from-gray-900/80 to-black/80 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Admin Dashboard
                </h1>
                <p className="text-sm text-gray-400 mt-1">
                  Manage presale settings and monitor contract activity
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="text-sm text-gray-400 hidden sm:block">
                  Last updated: {formatTimeAgo(Math.floor(lastUpdate / 1000))}
                </div>
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="px-4 py-2 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-gray-300 rounded-xl flex items-center gap-2 transition-all duration-200 border border-gray-800 hover:border-gray-700"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {isRefreshing ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-4 mb-8">
            {!onBsc && (
              <div className="rounded-xl border border-amber-800/40 bg-gradient-to-r from-amber-900/20 to-orange-900/10 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-900/30 rounded-lg">
                    <Network className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-amber-200">Switch Network</div>
                    <div className="text-sm text-amber-300/80">
                      Please switch to BNB Smart Chain to access admin controls
                    </div>
                  </div>
                </div>
              </div>
            )}

            {onBsc && !isOwner && user && (
              <div className="rounded-xl border border-amber-800/40 bg-gradient-to-r from-amber-900/20 to-orange-900/10 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-900/30 rounded-lg">
                    <Shield className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-amber-200">Read-Only Access</div>
                    <div className="text-sm text-amber-300/80">
                      Connected wallet is not the contract owner. You can view data but cannot make changes.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {uiError && (
              <div className="rounded-xl border border-red-800/40 bg-gradient-to-r from-red-900/20 to-pink-900/10 p-4 backdrop-blur-sm">
                <div className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-400 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium text-red-200">Transaction Failed</div>
                    <div className="text-sm text-red-300/80">{uiError}</div>
                  </div>
                </div>
              </div>
            )}

            {uiSuccess && (
              <div className="rounded-xl border border-emerald-800/40 bg-gradient-to-r from-emerald-900/20 to-green-900/10 p-4 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                    <div>
                      <div className="font-medium text-emerald-200">Success!</div>
                      <div className="text-sm text-emerald-300/80">{uiSuccess}</div>
                    </div>
                  </div>
                  {txUrl && (
                    <a href={txUrl} target="_blank" rel="noreferrer" className="text-cyan-300 hover:text-cyan-200 text-sm flex items-center gap-2">
                      View <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            <div className="lg:w-64">
              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900/50 to-black/30 backdrop-blur-xl p-5">
                <div className="mb-6">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-blue-900/20 to-cyan-900/10 border border-blue-800/30">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                      <ShieldCheck className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <div className="font-bold text-white">Admin Panel</div>
                      <div className={`text-xs ${isOwner ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {isOwner ? 'Owner Access' : 'Read-Only Mode'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {adminSections.map((section) => {
                    const Icon = section.icon;
                    const isActive = activeSection === section.id;
                    return (
                      <button
                        key={section.id}
                        onClick={() => {
                          resetNotices();
                          setActiveSection(section.id);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 ${
                          isActive
                            ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/10 border border-blue-500/30 text-white shadow-lg'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium">{section.label}</span>
                        {isActive && (
                          <ChevronRight className="w-4 h-4 ml-auto" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 pt-6 border-t border-white/10">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${onBsc ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                        <span className="text-sm text-gray-400">Network</span>
                      </div>
                      <span className="text-sm font-medium">{chain?.name || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Chain ID</span>
                      <span className="font-mono text-sm text-gray-300">{chainId}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Last Update</span>
                      <span className="text-sm text-gray-300">{formatTimeAgo(Math.floor(lastUpdate / 1000))}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1">
              {activeSection === "overview" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900/50 to-black/30 p-5 backdrop-blur-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2.5 bg-cyan-900/30 rounded-lg">
                          <Package className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div className="text-xs px-2.5 py-1 bg-gray-800/50 rounded-full text-gray-400">
                          Remaining
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-white mb-1">
                        {dashLoading ? (
                          <div className="h-8 w-32 bg-gray-800/50 rounded-lg animate-pulse"></div>
                        ) : (
                          tokensRemainingFormatted
                        )}
                      </div>
                      <div className="text-sm text-gray-400">{saleSymbol}</div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900/50 to-black/30 p-5 backdrop-blur-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2.5 bg-purple-900/30 rounded-lg">
                          <TrendingUp className="w-5 h-5 text-purple-400" />
                        </div>
                        <div className="text-xs px-2.5 py-1 bg-gray-800/50 rounded-full text-gray-400">
                          Raised
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-white mb-1">
                        {dashLoading ? (
                          <div className="h-8 w-32 bg-gray-800/50 rounded-lg animate-pulse"></div>
                        ) : (
                          `$${usdtRaisedFormatted}`
                        )}
                      </div>
                      <div className="text-sm text-gray-400">{paySymbol}</div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900/50 to-black/30 p-5 backdrop-blur-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2.5 bg-blue-900/30 rounded-lg">
                          <Users className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className={`text-xs px-2.5 py-1 rounded-full ${isPaused ? 'bg-red-900/30 text-red-400' : 'bg-emerald-900/30 text-emerald-400'}`}>
                          {isPaused ? 'Paused' : 'Active'}
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-white mb-1">
                        {dashLoading ? (
                          <div className="h-8 w-32 bg-gray-800/50 rounded-lg animate-pulse"></div>
                        ) : (
                          isPaused ? 'Paused' : 'Live'
                        )}
                      </div>
                      <div className="text-sm text-gray-400">Sale Status</div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900/50 to-black/30 p-5 backdrop-blur-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-2.5 bg-amber-900/30 rounded-lg">
                          <DollarSign className="w-5 h-5 text-amber-400" />
                        </div>
                        <div className="text-xs px-2.5 py-1 bg-gray-800/50 rounded-full text-gray-400">
                          Price
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-white mb-1">
                        {dashLoading ? (
                          <div className="h-8 w-32 bg-gray-800/50 rounded-lg animate-pulse"></div>
                        ) : (
                          `$${currentPrice}`
                        )}
                      </div>
                      <div className="text-sm text-gray-400">per {saleSymbol}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900/50 to-black/30 p-6 backdrop-blur-sm">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2.5 bg-cyan-900/30 rounded-lg">
                          <LinkIcon className="w-6 h-6 text-cyan-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white">Contract Address</h3>
                          <p className="text-sm text-gray-400">Presale smart contract</p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="p-4 bg-gray-900/30 rounded-xl border border-gray-800">
                          <div className="font-mono text-sm text-gray-300 break-all">
                            {ico || "—"}
                          </div>
                        </div>
                        <div className="flex gap-3">
                          {ico && (
                            <button
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(ico);
                                  setCopied("ico");
                                  setTimeout(() => setCopied(null), 1500);
                                } catch {
                                  setUiError("Copy failed");
                                }
                              }}
                              className="flex-1 py-2.5 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg flex items-center justify-center gap-2 transition-colors"
                            >
                              <Copy className="w-4 h-4" />
                              {copied === "ico" ? "Copied!" : "Copy"}
                            </button>
                          )}
                          {ico && explorerBase && (
                            <a
                              href={`${explorerBase}/address/${ico}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 py-2.5 bg-cyan-900/30 hover:bg-cyan-800/30 rounded-lg flex items-center justify-center gap-2 transition-colors"
                            >
                              <ExternalLink className="w-4 h-4" />
                              Explorer
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900/50 to-black/30 p-6 backdrop-blur-sm">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2.5 bg-purple-900/30 rounded-lg">
                          <Wallet className="w-6 h-6 text-purple-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white">Owner Address</h3>
                          <p className="text-sm text-gray-400">Contract administrator</p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="p-4 bg-gray-900/30 rounded-xl border border-gray-800">
                          <div className="font-mono text-sm text-gray-300 break-all">
                            {ownerAddr || "—"}
                          </div>
                          <div className="mt-2 text-sm">
                            <span className={isOwner ? "text-emerald-400" : "text-amber-400"}>
                              {user ? (isOwner ? "✓ You are the owner" : "✗ Not the owner") : "Connect wallet"}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          {ownerAddr && (
                            <button
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(ownerAddr);
                                  setCopied("owner");
                                  setTimeout(() => setCopied(null), 1500);
                                } catch {
                                  setUiError("Copy failed");
                                }
                              }}
                              className="flex-1 py-2.5 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg flex items-center justify-center gap-2 transition-colors"
                            >
                              <Copy className="w-4 h-4" />
                              {copied === "owner" ? "Copied!" : "Copy"}
                            </button>
                          )}
                          {ownerAddr && explorerBase && (
                            <a
                              href={`${explorerBase}/address/${ownerAddr}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 py-2.5 bg-purple-900/30 hover:bg-purple-800/30 rounded-lg flex items-center justify-center gap-2 transition-colors"
                            >
                              <ExternalLink className="w-4 h-4" />
                              Explorer
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "token-config" && (
                <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900/50 to-black/30 p-6 backdrop-blur-sm">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-2.5 bg-blue-900/30 rounded-lg">
                      <ShieldCheck className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Token Setup</h3>
                      <p className="text-sm text-gray-400">Configure the sale token (one-time operation)</p>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="p-5 rounded-xl border border-white/10 bg-gradient-to-r from-gray-900/30 to-black/20">
                      <div className="text-sm font-medium text-white mb-3">Current Status</div>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${saleTokenAlreadySet ? 'bg-emerald-900/30' : 'bg-amber-900/30'}`}>
                          {saleTokenAlreadySet ? (
                            <CheckCircle className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-amber-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium">
                            {saleTokenAlreadySet ? "Token is configured" : "Token not configured yet"}
                          </div>
                          <div className="text-sm text-gray-400 truncate font-mono">
                            {saleTokenAlreadySet ? shortAddr(dash?.tokenAddr) : "Setup required before sale can start"}
                          </div>
                          {saleTokenAlreadySet && dash?.tokenAddr && (
                            <div className="mt-2 flex gap-2">
                              <button
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(dash.tokenAddr);
                                    setCopied("token-addr");
                                    setTimeout(() => setCopied(null), 1500);
                                  } catch {
                                    setUiError("Copy failed");
                                  }
                                }}
                                className="text-xs px-2 py-1 bg-gray-800/50 hover:bg-gray-700/50 rounded-md flex items-center gap-1 transition-colors"
                              >
                                <Copy className="w-3 h-3" />
                                {copied === "token-addr" ? "Copied!" : "Copy"}
                              </button>
                              {explorerBase && (
                                <a
                                  href={`${explorerBase}/address/${dash.tokenAddr}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs px-2 py-1 bg-blue-900/30 hover:bg-blue-800/30 rounded-md flex items-center gap-1 transition-colors"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  View
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-sm font-medium text-white">Set Token Address</div>
                          <div className="text-xs px-2 py-1 bg-blue-900/30 text-blue-400 rounded-full">
                            Required
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
                              <div className="p-2 bg-gray-800/50 rounded-lg">
                                <Package className="w-4 h-4 text-gray-400" />
                              </div>
                            </div>
                            <input
                              type="text"
                              placeholder="0x0000000000000000000000000000000000000000"
                              value={saleTokenInput}
                              onChange={(e) => setSaleTokenInput(e.target.value)}
                              className="w-full pl-14 pr-32 py-3.5 bg-gray-900/50 border-2 border-gray-800 rounded-xl font-mono text-sm text-white focus:outline-none focus:border-blue-500 focus:bg-black/60 transition-all duration-200 placeholder:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={saleTokenAlreadySet || !isOwner}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                              <div className="text-xs px-2.5 py-1 bg-gray-800/80 text-gray-300 rounded-full border border-gray-700/50">
                                ERC-20
                              </div>
                              {saleTokenInput && (
                                <button
                                  onClick={() => setSaleTokenInput("")}
                                  className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg transition-colors"
                                  aria-label="Clear input"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                            
                            {saleTokenInput.trim() && (
                              <div className="absolute left-4 top-full mt-1.5 flex items-center gap-1.5">
                                {isAddress(saleTokenInput.trim()) ? (
                                  <>
                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-xs text-emerald-400 font-medium">Valid address</span>
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-3.5 h-3.5 text-red-400" />
                                    <span className="text-xs text-red-400 font-medium">Invalid address</span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                          
                          <div className="text-xs text-gray-500 pl-1">
                            Enter the exact ERC-20 token contract address. This will be the token sold in the presale.
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <button
                          disabled={
                            !onBsc || 
                            !isOwner || 
                            isPending || 
                            saleTokenAlreadySet || 
                            !saleTokenInput.trim() || 
                            !isAddress(saleTokenInput.trim())
                          }
                          onClick={onSetSaleToken}
                          className="relative w-full py-3.5 bg-gradient-to-r from-blue-700/90 to-cyan-700/90 hover:from-blue-600 hover:to-cyan-600 disabled:from-gray-900 disabled:to-gray-800 disabled:text-gray-500 rounded-xl font-bold text-base transition-all duration-300 hover:scale-[1.02] disabled:hover:scale-100 disabled:cursor-not-allowed overflow-hidden group"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 via-cyan-600/20 to-blue-600/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                          
                          <div className="relative z-10 flex items-center justify-center gap-3">
                            {isPending ? (
                              <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Configuring Token...</span>
                              </>
                            ) : saleTokenAlreadySet ? (
                              <>
                                <CheckCircle className="w-5 h-5" />
                                <span>Token Already Configured</span>
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="w-5 h-5" />
                                <span>Configure Token Contract</span>
                              </>
                            )}
                          </div>
                        </button>
                        
                        <div className="flex flex-wrap gap-3 text-xs">
                          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${onBsc ? 'bg-emerald-900/20 text-emerald-400' : 'bg-amber-900/20 text-amber-400'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${onBsc ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                            {onBsc ? 'Correct Network' : 'Wrong Network'}
                          </div>
                          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${isOwner ? 'bg-emerald-900/20 text-emerald-400' : 'bg-amber-900/20 text-amber-400'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isOwner ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                            {isOwner ? 'Owner Access' : 'Not Owner'}
                          </div>
                          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${saleTokenAlreadySet ? 'bg-gray-900/20 text-gray-400' : 'bg-blue-900/20 text-blue-400'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${saleTokenAlreadySet ? 'bg-gray-400' : 'bg-blue-400'}`} />
                            {saleTokenAlreadySet ? 'Already Set' : 'Ready to Configure'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 rounded-xl border border-amber-800/40 bg-gradient-to-r from-amber-900/20 to-orange-900/10">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="font-medium text-amber-200 mb-2">Important Notice</div>
                          <ul className="text-sm text-amber-300/80 space-y-1">
                            <li>• This is a <span className="font-bold">one-time operation</span> and cannot be reversed</li>
                            <li>• Double-check the token address before submitting</li>
                            <li>• Ensure the token contract is verified on the blockchain explorer</li>
                            <li>• Once set, the sale will be ready to accept purchases</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "price-settings" && (
                <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900/50 to-black/30 p-6 backdrop-blur-sm">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-2.5 bg-blue-900/30 rounded-lg">
                      <DollarSign className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Price Settings</h3>
                      <p className="text-sm text-gray-400">Update token price in {paySymbol}</p>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="p-6 rounded-xl bg-gradient-to-r from-cyan-900/20 to-blue-900/20 border border-cyan-800/30">
                      <div className="text-center">
                        <div className="text-sm text-gray-400 mb-2">Current Price</div>
                        <div className="text-4xl font-bold bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent mb-2">
                          {dashLoading ? (
                            <div className="h-12 w-48 bg-gray-800/50 rounded-lg animate-pulse mx-auto"></div>
                          ) : (
                            `$${currentPrice}`
                          )}
                        </div>
                        <div className="text-lg text-gray-300">
                          1 {saleSymbol} = ${currentPrice} {paySymbol}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <div className="text-sm font-medium text-white mb-3">Set New Price</div>
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
                            $
                          </div>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={priceInput}
                            onChange={(e) => setPriceInput(e.target.value)}
                            className="w-full pl-10 pr-4 py-4 bg-black/40 border border-white/10 rounded-xl text-xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-600"
                            disabled={!isOwner || !saleTokenAlreadySet}
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                            {paySymbol}
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          Enter the price in {paySymbol} for 1 {saleSymbol}
                        </div>
                      </div>

                      <button
                        disabled={!onBsc || !isOwner || isPending || !saleTokenAlreadySet || !priceInput.trim()}
                        onClick={onUpdatePrice}
                        className="w-full py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:from-gray-800 disabled:to-gray-900 disabled:text-gray-400 rounded-xl font-bold text-lg transition-all duration-300 hover:scale-[1.02] disabled:hover:scale-100 flex items-center justify-center gap-3"
                      >
                        {isPending ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Updating Price...
                          </>
                        ) : (
                          "Update Price"
                        )}
                      </button>
                    </div>

                    {!saleTokenAlreadySet && (
                      <div className="p-4 rounded-xl border border-amber-800/40 bg-gradient-to-r from-amber-900/20 to-orange-900/10">
                        <div className="flex items-center gap-3">
                          <AlertCircle className="w-5 h-5 text-amber-400" />
                          <div className="text-sm text-amber-300/80">
                            Token must be configured before setting price
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="p-4 rounded-xl border border-blue-800/40 bg-gradient-to-r from-blue-900/20 to-cyan-900/10">
                      <div className="flex items-start gap-3">
                        <Info className="w-5 h-5 text-blue-400 mt-0.5" />
                        <div className="flex-1">
                          <div className="font-medium text-blue-200 mb-2">Price Information</div>
                          <div className="text-sm text-blue-300/80">
                            The price determines how much {paySymbol} is required to purchase 1 {saleSymbol}.
                            This can be updated at any time by the contract owner.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "sale-controls" && (
                <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900/50 to-black/30 p-6 backdrop-blur-sm">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-2.5 bg-blue-900/30 rounded-lg">
                      <Cpu className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Sale Controls</h3>
                      <p className="text-sm text-gray-400">Manage sale status and timing</p>
                    </div>
                  </div>

                  <div className="space-y-8">
                    {/* Sale Status - Fixed Professional UI */}
                    <div className="rounded-xl border border-white/10 bg-gradient-to-r from-gray-900/30 to-black/20 p-6">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className={`p-3 rounded-xl ${isPaused ? 'bg-red-900/30 border border-red-800/40' : 'bg-emerald-900/30 border border-emerald-800/40'}`}>
                              {isPaused ? (
                                <PauseCircle className="w-6 h-6 text-red-400" />
                              ) : (
                                <PlayCircle className="w-6 h-6 text-emerald-400" />
                              )}
                            </div>
                            <div>
                              <h4 className="font-bold text-white">Sale Status</h4>
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-red-400 animate-pulse' : 'bg-emerald-400 animate-pulse'}`} />
                                <span className={`font-medium ${isPaused ? 'text-red-400' : 'text-emerald-400'}`}>
                                  {isPaused ? 'PAUSED' : 'ACTIVE'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <p className="text-sm text-gray-400 max-w-md">
                            {isPaused 
                              ? "Sale is paused. No new purchases can be made until resumed." 
                              : "Sale is active and accepting purchases according to current settings."}
                          </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                          <button
                            disabled={!onBsc || !isOwner || isPending || isPaused}
                            onClick={onPause}
                            className="px-5 py-3 bg-gradient-to-r from-red-700 to-orange-700 hover:from-red-600 hover:to-orange-600 disabled:from-gray-800 disabled:to-gray-900 disabled:text-gray-500 rounded-xl font-semibold transition-all duration-300 hover:scale-[1.02] disabled:hover:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[140px]"
                          >
                            {isPending ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <PauseCircle className="w-4 h-4" />
                                Pause Sale
                              </>
                            )}
                          </button>
                          
                          <button
                            disabled={!onBsc || !isOwner || isPending || !isPaused}
                            onClick={onUnpause}
                            className="px-5 py-3 bg-gradient-to-r from-emerald-700 to-green-700 hover:from-emerald-600 hover:to-green-600 disabled:from-gray-800 disabled:to-gray-900 disabled:text-gray-500 rounded-xl font-semibold transition-all duration-300 hover:scale-[1.02] disabled:hover:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[140px]"
                          >
                            {isPending ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <PlayCircle className="w-4 h-4" />
                                Resume Sale
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Sale Window - Fixed Professional UI */}
                    <div className="rounded-xl border border-white/10 bg-gradient-to-r from-gray-900/30 to-black/20 p-6">
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-bold text-white">Sale Window Settings</h4>
                            <p className="text-sm text-gray-400">Control when the sale is available</p>
                          </div>
                          <div className={`px-3 py-1.5 rounded-full text-sm ${dash?.start === 0n && dash?.end === 0n ? 'bg-gray-800/50 text-gray-400' : 'bg-blue-900/30 text-blue-400'}`}>
                            {dash?.start === 0n && dash?.end === 0n ? 'Always Open' : 'Time Limited'}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <label className="text-sm text-gray-400 flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              Start Time (Unix)
                            </label>
                            <input
                              value={startInput}
                              onChange={(e) => setStartInput(e.target.value)}
                              className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl font-mono text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="0 for always open"
                              disabled={!isOwner}
                            />
                            {startInput !== "0" && startInput !== "" && (
                              <div className="text-xs text-gray-500">
                                {new Date(Number(startInput) * 1000).toLocaleString()}
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-3">
                            <label className="text-sm text-gray-400 flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              End Time (Unix)
                            </label>
                            <input
                              value={endInput}
                              onChange={(e) => setEndInput(e.target.value)}
                              className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl font-mono text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="0 for always open"
                              disabled={!isOwner}
                            />
                            {endInput !== "0" && endInput !== "" && (
                              <div className="text-xs text-gray-500">
                                {new Date(Number(endInput) * 1000).toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                          <button
                            disabled={!onBsc || !isOwner || isPending}
                            onClick={onSetSaleWindow}
                            className="flex-1 py-3.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:from-gray-800 disabled:to-gray-900 disabled:text-gray-400 rounded-xl font-bold transition-all duration-200 hover:scale-[1.02] disabled:hover:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                          >
                            {isPending ? (
                              <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Updating...
                              </>
                            ) : (
                              'Update Sale Window'
                            )}
                          </button>
                          <button
                            disabled={!onBsc || !isOwner || isPending}
                            onClick={() => {
                              setStartInput("0");
                              setEndInput("0");
                              onSetSaleWindow();
                            }}
                            className="flex-1 py-3.5 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:text-gray-500 rounded-xl font-bold transition-colors disabled:cursor-not-allowed"
                          >
                            Disable Time Limits
                          </button>
                        </div>

                        <div className="p-4 bg-gray-900/30 rounded-lg border border-gray-800">
                          <div className="text-sm text-gray-400 space-y-2">
                            <div className="flex items-center gap-2">
                              <Info className="w-4 h-4" />
                              <span className="font-medium">How it works:</span>
                            </div>
                            <ul className="space-y-1 pl-6 list-disc text-gray-500">
                              <li>Set both timestamps to 0 for always-open sale</li>
                              <li>Use Unix timestamps in seconds</li>
                              <li>End time must be greater than start time</li>
                              <li>Current time: {Math.floor(Date.now() / 1000)}</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}