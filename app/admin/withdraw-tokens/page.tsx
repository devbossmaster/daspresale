"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Shield,
  Wallet,
  Copy,
  ExternalLink,
  Coins,
  CheckCircle,
  History,
  RefreshCw,
  Loader2,
  Download,
  Info,
  Clock,
  Users,
  DollarSign,
  ArrowUpRight,
} from "lucide-react";
import {
  useAccount,
  useChainId,
  useChains,
  usePublicClient,
  useBlockNumber,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { bsc } from "wagmi/chains";
import { formatUnits, parseAbiItem } from "viem";

import { erc20Abi } from "@/lib/contracts/abi/erc20Abi";
import { getTokenIcoAddress } from "@/lib/contracts/addresses";
import { useTokenIcoDashboard } from "@/lib/hooks/useTokenIcoDashboard";

const E_TokensWithdrawn = parseAbiItem("event TokensWithdrawn(uint256 amountTokens)");

type WithdrawRow = {
  amountTokens: bigint;
  txHash: `0x${string}`;
  blockNumber: bigint;
  timestamp: number;
  time: string;
  explorerLink?: string;
};

function shortAddr(addr?: string) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function trimDecimals(value: string, max: number) {
  if (!value.includes(".")) return value;
  const [i, f] = value.split(".");
  return `${i}.${f.slice(0, max)}`.replace(/\.?0+$/, "");
}

function formatTimeAgo(ts: number) {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - ts;
  
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  
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
  if (s.includes("network") || s.includes("chain"))
    return "Please connect to BNB Smart Chain.";
  return "Transaction failed. Please try again.";
}

export default function WithdrawTokensPage() {
  const chainId = useChainId();
  const onBsc = chainId === bsc.id;
  const chains = useChains();
  const chain = chains.find((c) => c.id === chainId);
  const { address: user } = useAccount();

  const ico = getTokenIcoAddress(chainId);
  const publicClient = usePublicClient();
  const { data: latestBlock } = useBlockNumber({ watch: true });

  // Dashboard data with caching
  const { data: dash, isLoading: dashLoading } = useTokenIcoDashboard();
  const saleTokenAddr = dash?.tokenAddr as `0x${string}` | undefined;
  const saleSymbol = dash?.symbol ?? "TOKEN";
  const saleDecimals = dash?.decimals ?? 18;
  const tokensRemaining = dash?.tokensRemaining ?? 0n;
  const usdtRaised = dash?.usdtRaised ?? 0n;
  const payDecimals = dash?.payDecimals ?? 18;
  const paySymbol = dash?.paySymbol ?? "USDT";

const usdtRaisedHuman = useMemo(() => {
  // formatUnits gives a decimal string; trimDecimals will cap to 4 decimals and remove trailing zeros
  return trimDecimals(formatUnits(usdtRaised, payDecimals), 4);
}, [usdtRaised, payDecimals]);

  const explorerBase = onBsc ? chain?.blockExplorers?.default?.url : undefined;
  const contractReady = onBsc && !!ico && !!publicClient;

  // Owner check
  const { data: ownerAddr } = useReadContract({
    address: contractReady ? ico : undefined,
    abi: [{ type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] }],
    functionName: "owner",
    query: { enabled: contractReady, staleTime: 10000 },
  });

  const isOwner = useMemo(() => {
    if (!user || !ownerAddr) return false;
    return user.toLowerCase() === ownerAddr.toLowerCase();
  }, [user, ownerAddr]);

  // Withdraw write
  const { writeContractAsync, isPending } = useWriteContract();

  // UI states
  const [uiError, setUiError] = useState<string | null>(null);
  const [uiSuccess, setUiSuccess] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<`0x${string}` | null>(null);
  const [confirmStage, setConfirmStage] = useState<"idle" | "confirming">("idle");
  const [copied, setCopied] = useState<string | null>(null);

  // Recent withdrawals with caching (prevent flickering)
  const [cachedWithdrawals, setCachedWithdrawals] = useState<WithdrawRow[] | null>(null);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false);
  const [hasInitialWithdrawals, setHasInitialWithdrawals] = useState(false);
  const [blockRange, setBlockRange] = useState<bigint>(200_000n); // Smaller initial range

  // Format token amount
  const remainingFormatted = useMemo(() => {
    return trimDecimals(formatUnits(tokensRemaining, saleDecimals), 6);
  }, [tokensRemaining, saleDecimals]);

  // Fetch withdrawals with caching
  useEffect(() => {
    let cancelled = false;

    async function fetchWithdrawals() {
      if (!contractReady || !ico) return;

      setWithdrawalsLoading(true);
      try {
        const toBlock = (latestBlock ?? (await publicClient!.getBlockNumber())) as bigint;
        const fromBlock = toBlock > blockRange ? toBlock - blockRange : 0n;

        const logs = await publicClient!.getLogs({
          address: ico,
          event: E_TokensWithdrawn,
          fromBlock,
          toBlock,
        });

        // Process logs in parallel
        const withdrawals = await Promise.all(
          logs.map(async (log) => {
            if (!log.blockNumber || !log.transactionHash) return null;
            
            const args = log.args as unknown as { amountTokens: bigint };
            const block = await publicClient!.getBlock({ blockNumber: log.blockNumber });
            
            return {
              amountTokens: args.amountTokens,
              txHash: log.transactionHash as `0x${string}`,
              blockNumber: log.blockNumber,
              timestamp: Number(block.timestamp),
              time: formatTimeAgo(Number(block.timestamp)),
              explorerLink: explorerBase ? `${explorerBase}/tx/${log.transactionHash}` : undefined,
            };
          })
        );

        const validWithdrawals = withdrawals.filter(Boolean) as WithdrawRow[];
        validWithdrawals.sort((a, b) => (a.blockNumber > b.blockNumber ? -1 : 1));

        if (!cancelled) {
          setCachedWithdrawals(validWithdrawals.slice(0, 10)); // Keep only latest 10
          setHasInitialWithdrawals(true);
        }
      } catch {
        if (!cancelled) {
          setCachedWithdrawals([]);
        }
      } finally {
        if (!cancelled) setWithdrawalsLoading(false);
      }
    }

    fetchWithdrawals();
    
    return () => {
      cancelled = true;
    };
  }, [contractReady, ico, latestBlock, explorerBase, blockRange, publicClient]);

  // Stable data for display (prevents flickering)
  const stableWithdrawals = hasInitialWithdrawals 
    ? (cachedWithdrawals || [])
    : (withdrawalsLoading ? [] : cachedWithdrawals || []);

  // Handle copy
  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setUiError("Copy failed. Please copy manually.");
    }
  };

  // Handle withdraw
  const handleWithdraw = async () => {
    if (!onBsc) {
      setUiError("Please switch to BNB Smart Chain.");
      return;
    }
    if (!isOwner) {
      setUiError("Only contract owner can withdraw tokens.");
      return;
    }
    if (tokensRemaining === 0n) {
      setUiError("No tokens available to withdraw.");
      return;
    }

    setConfirmStage("confirming");
    setUiError(null);
    setUiSuccess(null);

    try {
      const hash = await writeContractAsync({
        address: ico!,
        abi: [{ type: "function", name: "withdrawTokens", stateMutability: "nonpayable", inputs: [], outputs: [] }],
        functionName: "withdrawTokens",
        args: [],
      });

      setLastTx(hash);
      const receipt = await publicClient!.waitForTransactionReceipt({ hash });

      setUiSuccess(`Successfully withdrew ${remainingFormatted} ${saleSymbol}`);
      setConfirmStage("idle");

      // Add to recent withdrawals cache
      if (receipt.blockNumber) {
        const block = await publicClient!.getBlock({ blockNumber: receipt.blockNumber });
        const newWithdraw: WithdrawRow = {
          amountTokens: tokensRemaining,
          txHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          timestamp: Number(block.timestamp),
          time: "Just now",
          explorerLink: explorerBase ? `${explorerBase}/tx/${receipt.transactionHash}` : undefined,
        };
        
        setCachedWithdrawals(prev => [newWithdraw, ...(prev || []).slice(0, 9)]);
      }
    } catch (e: any) {
      setUiError(humanizeTxError(e));
      setConfirmStage("idle");
    }
  };

  const canWithdraw = isOwner && contractReady && tokensRemaining > 0n && !isPending;
  const txUrl = lastTx && explorerBase ? `${explorerBase}/tx/${lastTx}` : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Withdraw Tokens</h1>
        <p className="text-gray-400">Withdraw remaining sale tokens to owner wallet</p>
      </div>

      {/* Network warning */}
      {!onBsc && (
        <div className="rounded-xl border border-amber-800/40 bg-gradient-to-r from-amber-900/20 to-orange-900/10 p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <span className="font-medium">Switch to BNB Smart Chain to continue</span>
          </div>
        </div>
      )}

      {/* Status messages */}
      {(uiError || uiSuccess) && (
        <div className="space-y-3">
          {uiError && (
            <div className="rounded-xl border border-red-800/40 bg-gradient-to-r from-red-900/20 to-pink-900/10 p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <div>
                  <div className="font-medium text-red-200">{uiError}</div>
                </div>
              </div>
            </div>
          )}
          {uiSuccess && (
            <div className="rounded-xl border border-emerald-800/40 bg-gradient-to-r from-emerald-900/20 to-teal-900/10 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <div className="font-medium text-emerald-200">{uiSuccess}</div>
                </div>
                {txUrl && (
                  <a
                    href={txUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-300 hover:text-cyan-200 text-sm flex items-center gap-2"
                  >
                    View <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Info & Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contract Info */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900/50 to-black/50 p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-3">
              <Shield className="w-6 h-6 text-cyan-400" />
              Contract Information
            </h2>
            
            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-400 mb-2">ICO Contract</div>
                <div className="flex items-center gap-2 p-3 bg-gray-800/30 rounded-xl">
                  <code className="font-mono text-sm truncate flex-1">{ico || "—"}</code>
                  {ico && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCopy(ico, "ico")}
                        className="p-2 hover:bg-gray-700/50 rounded-lg"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <a
                        href={`${explorerBase}/address/${ico}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 hover:bg-gray-700/50 rounded-lg"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-400 mb-2">Owner Address</div>
                <div className="flex items-center gap-2 p-3 bg-gray-800/30 rounded-xl">
                  <code className="font-mono text-sm truncate flex-1">
                    {ownerAddr ? shortAddr(ownerAddr) : "—"}
                  </code>
                  {ownerAddr && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCopy(ownerAddr, "owner")}
                        className="p-2 hover:bg-gray-700/50 rounded-lg"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <a
                        href={`${explorerBase}/address/${ownerAddr}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 hover:bg-gray-700/50 rounded-lg"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  )}
                </div>
                <div className="mt-2 text-sm">
                  <span className={isOwner ? "text-emerald-400" : "text-red-400"}>
                    {user ? (
                      isOwner ? "✓ You are the owner" : "✗ You are not the owner"
                    ) : (
                      "Connect wallet to check"
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Token Info */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900/50 to-black/50 p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-3">
              <Coins className="w-6 h-6 text-purple-400" />
              Token Information
            </h2>

            <div className="p-4 bg-gradient-to-r from-cyan-900/20 to-purple-900/20 rounded-xl border border-cyan-800/30">
              <div className="text-center mb-4">
                <div className="text-sm text-gray-400 mb-1">Available to Withdraw</div>
                <div className="text-4xl font-bold bg-gradient-to-r from-cyan-300 to-purple-300 bg-clip-text text-transparent">
                  {remainingFormatted}
                </div>
                <div className="text-lg text-gray-300">{saleSymbol}</div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-400">Token Address</div>
                  <div className="font-mono truncate">{saleTokenAddr ? shortAddr(saleTokenAddr) : "Not set"}</div>
                </div>
                <div>
                  <div className="text-gray-400">USDT Raised</div>
                  <div className="font-mono">{usdtRaisedHuman} {paySymbol}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Withdraw Controls */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900/50 to-black/50 p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-3">
              <Download className="w-6 h-6 text-amber-400" />
              Withdraw Controls
            </h2>

            <div className="space-y-6">
              {/* Warning */}
              <div className="p-4 bg-gradient-to-r from-amber-900/20 to-red-900/10 rounded-xl border border-amber-800/30">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
                  <div className="text-sm">
                    <div className="font-medium text-amber-300 mb-2">Irreversible Action</div>
                    <p>This will transfer all remaining tokens to your wallet. This action cannot be undone.</p>
                  </div>
                </div>
              </div>

              {/* Withdraw button */}
              <button
                onClick={handleWithdraw}
                disabled={!canWithdraw}
                className={`
                  w-full py-4 font-bold text-lg rounded-xl transition-all duration-300
                  flex items-center justify-center gap-3
                  ${canWithdraw
                    ? 'bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 hover:scale-[1.02]'
                    : 'bg-gray-800 opacity-50 cursor-not-allowed'
                  }
                `}
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : confirmStage === "confirming" ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  <>
                    <Wallet className="w-5 h-5" />
                    {!onBsc ? "Switch to BSC" : 
                     !isOwner ? "Owner Only" : 
                     tokensRemaining === 0n ? "No Tokens Available" : 
                     `Withdraw ${remainingFormatted} ${saleSymbol}`}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right column - Recent Withdrawals */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900/50 to-black/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-3">
                <History className="w-6 h-6 text-emerald-400" />
                Recent Withdrawals
              </h2>
              {stableWithdrawals.length > 0 && (
                <div className="text-sm text-gray-400">
                  {stableWithdrawals.length} total
                </div>
              )}
            </div>

            {withdrawalsLoading && !hasInitialWithdrawals ? (
              // Skeleton loaders
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse p-4 bg-gray-800/30 rounded-xl">
                    <div className="flex justify-between mb-2">
                      <div className="h-4 w-32 bg-gray-700 rounded"></div>
                      <div className="h-6 w-16 bg-gray-700 rounded-full"></div>
                    </div>
                    <div className="h-8 w-full bg-gray-700 rounded mt-2"></div>
                  </div>
                ))}
              </div>
            ) : stableWithdrawals.length === 0 ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-800/50 mb-4">
                  <Wallet className="w-8 h-8 text-gray-400" />
                </div>
                <div className="text-gray-400">No withdrawals yet</div>
                {blockRange < 1_000_000n && (
                  <button
                    onClick={() => setBlockRange(prev => prev * 2n)}
                    className="mt-4 text-sm px-4 py-2 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg transition-colors"
                  >
                    Load More Blocks
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {stableWithdrawals.map((withdraw) => (
                  <div
                    key={withdraw.txHash}
                    className="group p-4 bg-gray-800/20 hover:bg-gray-800/30 rounded-xl border border-white/10 transition-all duration-300"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="text-sm text-gray-400 flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" />
                        {withdraw.time}
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle className="w-3 h-3" />
                        Success
                      </div>
                    </div>

                    <div className="font-bold text-lg text-cyan-300 mb-2">
                      {trimDecimals(formatUnits(withdraw.amountTokens, saleDecimals), 4)} {saleSymbol}
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="text-gray-400">
                        Block #{withdraw.blockNumber.toString()}
                      </div>
                      {withdraw.explorerLink && (
                        <a
                          href={withdraw.explorerLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-300 hover:text-cyan-200 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          View <ArrowUpRight className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}

                {blockRange < 2_000_000n && (
                  <button
                    onClick={() => setBlockRange(prev => prev * 2n)}
                    className="w-full mt-4 py-2 text-sm bg-gray-800/30 hover:bg-gray-700/30 rounded-lg transition-colors border border-white/10"
                  >
                    Load More Withdrawals
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900/50 to-black/50 p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-3">
              <Info className="w-5 h-5 text-blue-400" />
              Quick Stats
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Network</span>
                <span className={`font-medium ${onBsc ? 'text-emerald-400' : 'text-red-400'}`}>
                  {onBsc ? 'BSC Connected' : 'Wrong Network'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Block Range</span>
                <span className="font-mono">{(blockRange / 1000n).toString()}k</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Latest Block</span>
                <span className="font-mono">{latestBlock?.toString() || "—"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}