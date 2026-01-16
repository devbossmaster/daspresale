"use client";

import { useEffect, useMemo, useState } from "react";
import { Send, Copy, Check, ExternalLink, AlertCircle, RefreshCw, Wallet, Shield } from "lucide-react";
import {
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChains,
} from "wagmi";
import { bsc } from "wagmi/chains";
import { erc20Abi, formatUnits, isAddress, parseUnits } from "viem";
import { useMounted } from "@/lib/hooks/useMounted";
import { useTokenIcoDashboard } from "@/lib/hooks/useTokenIcoDashboard";

function asAddress(v?: string): `0x${string}` | undefined {
  if (!v) return undefined;
  return /^0x[a-fA-F0-9]{40}$/.test(v) ? (v as `0x${string}`) : undefined;
}

const ENV_TOKEN = asAddress(process.env.NEXT_PUBLIC_TMSAT_TOKEN_ADDRESS);

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

function normalizeDecimalInput(raw: string, decimals: number) {
  const v = raw.replace(/,/g, "").trim();
  if (v === "") return "";

  let out = "";
  let dotSeen = false;

  for (const ch of v) {
    if (ch >= "0" && ch <= "9") out += ch;
    else if (ch === "." && !dotSeen) {
      dotSeen = true;
      out += ".";
    }
  }

  if (out.startsWith(".")) out = `0${out}`;

  if (dotSeen) {
    const [i, f = ""] = out.split(".");
    out = `${i}.${f.slice(0, Math.max(0, decimals))}`;
  } else {
    out = out.replace(/^0+(?=\d)/, "");
    if (out === "") out = "0";
  }

  if (out.includes(".")) {
    const [i, f = ""] = out.split(".");
    const i2 = i.replace(/^0+(?=\d)/, "") || "0";
    out = `${i2}.${f}`;
  }

  return out;
}

function extractErrText(e: any) {
  return e?.shortMessage || e?.cause?.shortMessage || e?.details || e?.message || "";
}

function humanizeTxError(e: any) {
  const raw = String(extractErrText(e) || "").toLowerCase();

  if (!raw) return "Transaction failed. Please try again.";

  if (raw.includes("user rejected") || raw.includes("rejected the request")) {
    return "Transaction was rejected in your wallet.";
  }
  if (raw.includes("insufficient funds")) {
    return "Insufficient BNB to pay gas fees.";
  }
  if (raw.includes("nonce")) {
    return "Nonce issue detected. Please retry in your wallet, or wait for pending transactions to confirm.";
  }
  if (raw.includes("replacement transaction underpriced")) {
    return "Gas price too low for a replacement transaction. Increase gas and retry.";
  }
  if (raw.includes("execution reverted") || raw.includes("contractfunctionexecutionerror")) {
    return "Transfer reverted by contract. Check token restrictions.";
  }
  if (raw.includes("failed to fetch") || raw.includes("network error")) {
    return "Network connection issue. Please check your connection.";
  }

  return "Transaction failed. Please try again.";
}

export default function TransferForm() {
  const mounted = useMounted();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const onBsc = chainId === bsc.id;

  const chains = useChains();
  const chain = chains.find((c) => c.id === chainId);

  const explorerBase = onBsc ? chain?.blockExplorers?.default?.url : undefined;

  // Caching states
  const [cachedDashboard, setCachedDashboard] = useState<any>(null);
  const [hasInitialData, setHasInitialData] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Dashboard data with caching
  const { 
    data: dashLive, 
    error: dashError, 
    isLoading: dashLoadingLive,
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

  // Prefer env token override, else presale token
  const tokenAddr =
    (ENV_TOKEN && isAddress(ENV_TOKEN) ? ENV_TOKEN : dash?.tokenAddr) as
      | `0x${string}`
      | undefined;

  const tokenIsValid = !!tokenAddr && isAddress(tokenAddr);

  // Cache for token metadata
  const [cachedSymbol, setCachedSymbol] = useState<string>("TOKEN");
  const [cachedDecimals, setCachedDecimals] = useState<number>(18);

  const tokenSymbolRead = useReadContract({
    address: tokenIsValid ? tokenAddr : undefined,
    abi: erc20Abi,
    functionName: "symbol",
    query: { 
      enabled: tokenIsValid && onBsc, 
      refetchOnWindowFocus: false,
      staleTime: 30000,
    },
  });

  const tokenDecimalsRead = useReadContract({
    address: tokenIsValid ? tokenAddr : undefined,
    abi: erc20Abi,
    functionName: "decimals",
    query: { 
      enabled: tokenIsValid && onBsc, 
      refetchOnWindowFocus: false,
      staleTime: 30000,
    },
  });

  // Update cache when data arrives
  useEffect(() => {
    if (tokenSymbolRead.data && !tokenSymbolRead.isLoading) {
      setCachedSymbol(tokenSymbolRead.data as string);
    }
    if (tokenDecimalsRead.data && !tokenDecimalsRead.isLoading) {
      setCachedDecimals(tokenDecimalsRead.data as number);
    }
  }, [tokenSymbolRead.data, tokenSymbolRead.isLoading, tokenDecimalsRead.data, tokenDecimalsRead.isLoading]);

  const decimals = tokenDecimalsRead.data || cachedDecimals || dash?.decimals || 18;
  const symbol = tokenSymbolRead.data || cachedSymbol || dash?.symbol || "TOKEN";

  // Balance with caching
  const [cachedBalance, setCachedBalance] = useState<bigint>(0n);
  
  const balanceRead = useReadContract({
    address: tokenIsValid ? tokenAddr : undefined,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { 
      enabled: !!address && tokenIsValid && onBsc, 
      refetchOnWindowFocus: false,
      staleTime: 8000,
    },
  });

  useEffect(() => {
    if (balanceRead.data !== undefined && !balanceRead.isLoading) {
      setCachedBalance(balanceRead.data as bigint);
    }
  }, [balanceRead.data, balanceRead.isLoading]);

  const balanceRaw = hasInitialData ? (balanceRead.data || cachedBalance) : (balanceRead.data || 0n);
  const balanceLoading = balanceRead.isLoading && !hasInitialData;

  const balanceHuman = useMemo(() => {
    if (balanceLoading) return "—";
    return formatUnits(balanceRaw, decimals);
  }, [balanceRaw, decimals, balanceLoading]);

  const [recipient, setRecipient] = useState("");
  const [amountText, setAmountText] = useState("");
  const [copied, setCopied] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const [uiErrorDetails, setUiErrorDetails] = useState<string | null>(null);

  const normalizedAmount = useMemo(
    () => normalizeDecimalInput(amountText, decimals),
    [amountText, decimals]
  );

  const { amountRaw, amountError } = useMemo(() => {
    try {
      if (!normalizedAmount) return { amountRaw: 0n, amountError: null as string | null };
      if (normalizedAmount === "." || normalizedAmount === "0.") return { amountRaw: 0n, amountError: null };
      return { amountRaw: parseUnits(normalizedAmount, decimals), amountError: null };
    } catch {
      return { amountRaw: 0n, amountError: "Invalid amount format." };
    }
  }, [normalizedAmount, decimals]);

  const recipientValid = recipient ? isAddress(recipient) : false;
  const notSelf = address && recipientValid ? address.toLowerCase() !== recipient.toLowerCase() : true;
  const hasAmount = amountRaw > 0n;
  const hasEnough = amountRaw <= balanceRaw;

  const { writeContractAsync, data: txHash, isPending, error: writeError } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: txHash });

  const handleCopyTokenAddress = async () => {
    try {
      if (!tokenAddr) return;
      await navigator.clipboard.writeText(tokenAddr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.allSettled([
        refetchDashboard?.(),
        balanceRead.refetch?.(),
        tokenSymbolRead.refetch?.(),
        tokenDecimalsRead.refetch?.(),
      ]);
    } catch (error) {
      console.error("Refresh failed:", error);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const canTransfer = useMemo(() => {
    return onBsc &&
      !!address &&
      tokenIsValid &&
      recipientValid &&
      notSelf &&
      hasAmount &&
      hasEnough &&
      !isPending &&
      !receipt.isLoading &&
      !amountError;
  }, [onBsc, address, tokenIsValid, recipientValid, notSelf, hasAmount, hasEnough, isPending, receipt.isLoading, amountError]);

  async function handleTransfer() {
    setUiError(null);
    setUiErrorDetails(null);

    if (!onBsc) {
      setUiError("Please switch your wallet network to BNB Smart Chain (BSC).");
      return;
    }
    if (!canTransfer || !tokenAddr) return;

    try {
      await writeContractAsync({
        address: tokenAddr,
        abi: erc20Abi,
        functionName: "transfer",
        args: [recipient as `0x${string}`, amountRaw],
      });

      // Clear amount on success, keep recipient
      setAmountText("");
    } catch (e: any) {
      setUiError(humanizeTxError(e));
      setUiErrorDetails(extractErrText(e) || null);
    }
  }

  const txUrl = txHash && explorerBase ? `${explorerBase}/tx/${txHash}` : undefined;

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/50 to-black/30 backdrop-blur-xl shadow-2xl">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
      
      <div className="relative p-5 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6 sm:mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-600/20 border border-blue-500/30">
              <Send className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">Transfer Tokens</h2>
              <p className="text-sm text-gray-400">
                Send {symbol} to another wallet
              </p>
            </div>
          </div>
          
          {hasInitialData && !dashLoading && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-lg hover:bg-white/10 transition-all duration-200 disabled:opacity-50 group"
              aria-label="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 text-gray-400 group-hover:text-blue-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {/* Error Messages */}
        {(uiError || dashError || writeError) && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-gradient-to-r from-red-500/10 to-red-600/5 p-4 backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-red-200">Transfer Failed</div>
                <div className="mt-1 text-sm text-red-300/80">
                  {uiError || humanizeTxError(writeError) || "Unable to load token data. Please try again."}
                </div>
                {uiErrorDetails && (
                  <details className="mt-2">
                    <summary className="text-xs text-red-300/60 cursor-pointer select-none">Show details</summary>
                    <div className="mt-2 text-xs text-red-300/50 whitespace-pre-wrap break-words">
                      {uiErrorDetails}
                    </div>
                  </details>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Network Warning */}
        {!onBsc && isConnected && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-amber-600/5 p-4 backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-amber-200">Wrong Network</div>
                <div className="mt-1 text-sm text-amber-300/80">
                  Please switch to BSC Mainnet to transfer tokens
                </div>
              </div>
            </div>
          </div>
        )}

        {!address && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-amber-600/5 p-4 backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <Wallet className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-amber-200">Wallet Not Connected</div>
                <div className="mt-1 text-sm text-amber-300/80">
                  Connect your wallet to transfer tokens
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Token Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/30 to-black/20">
            <div className="text-xs text-gray-400 mb-2">Token</div>
            <div className="text-lg font-bold text-white">{symbol}</div>
            <div className="text-xs text-gray-500 mt-1">ERC-20 Token</div>
          </div>
          
          <div className="p-4 rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/30 to-black/20">
            <div className="text-xs text-gray-400 mb-2">Decimals</div>
            <div className="text-lg font-bold text-white">{decimals}</div>
            <div className="text-xs text-gray-500 mt-1">Token precision</div>
          </div>
          
          <div className="p-4 rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/30 to-black/20">
            <div className="text-xs text-gray-400 mb-2">Network</div>
            <div className={`text-lg font-bold ${onBsc ? 'text-emerald-400' : 'text-amber-400'}`}>
              {onBsc ? 'BSC Mainnet' : 'Wrong Network'}
            </div>
            <div className="text-xs text-gray-500 mt-1">Chain ID: {chainId}</div>
          </div>
        </div>

        {/* Token Address */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-white">Token Address</h3>
            {tokenIsValid && (
              <button
                onClick={handleCopyTokenAddress}
                className="text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-gray-300 transition-colors flex items-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </>
                )}
              </button>
            )}
          </div>
          <div className="p-4 rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/30 to-black/20">
            <div className="font-mono text-sm break-all text-gray-300">
              {tokenAddr || "Token address not available"}
            </div>
          </div>
        </div>

        {/* Balance Card */}
        <div className="mb-6">
          <h3 className="text-base font-semibold text-white mb-3">Your Balance</h3>
          <div className="p-4 rounded-xl border border-white/10 bg-gradient-to-br from-blue-900/20 to-cyan-900/20">
            {balanceLoading ? (
              <div className="h-12 w-48 bg-gray-800/50 rounded-lg animate-pulse" />
            ) : (
              <>
                <div className="text-3xl font-bold text-white mb-2">
                  {formatDecimalStr(balanceHuman, 1)} <span className="text-cyan-300">{symbol}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-400">
                    Available for transfer
                  </div>
                  <button
                    onClick={() => {
                      if (balanceHuman !== "—") setAmountText(balanceHuman);
                    }}
                    disabled={balanceHuman === "—" || !tokenIsValid || !onBsc}
                    className="text-sm px-4 py-2 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-gray-300 disabled:opacity-50 rounded-lg transition-all duration-200"
                  >
                    Use Max
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Recipient */}
        <div className="mb-6">
          <h3 className="text-base font-semibold text-white mb-3">Recipient Address</h3>
          <div className="relative">
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value.trim())}
              className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl font-mono text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500"
              placeholder="0x..."
              spellCheck={false}
              autoComplete="off"
              disabled={!address}
            />
            {explorerBase && recipientValid && (
              <a
                href={`${explorerBase}/address/${recipient}`}
                target="_blank"
                rel="noreferrer"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded-lg"
                title="View address on explorer"
              >
                <ExternalLink className="w-4 h-4 text-gray-400" />
              </a>
            )}
          </div>
          {recipient.length > 0 && !recipientValid && (
            <div className="mt-2 text-xs text-red-400 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5" />
              Invalid recipient address
            </div>
          )}
          {recipientValid && !notSelf && (
            <div className="mt-2 text-xs text-amber-400 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5" />
              Cannot send to your own address
            </div>
          )}
        </div>

        {/* Amount */}
        <div className="mb-6">
          <h3 className="text-base font-semibold text-white mb-3">Amount to Transfer</h3>
          <div className="relative mb-4">
            <input
              inputMode="decimal"
              type="text"
              value={normalizedAmount}
              onChange={(e) => setAmountText(e.target.value)}
              className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-xl font-bold text-right text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500"
              placeholder="0.0"
              spellCheck={false}
              autoComplete="off"
              disabled={!address}
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              {symbol}
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (balanceHuman !== "—") {
                    const half = (parseFloat(balanceHuman) / 2).toString();
                    setAmountText(half);
                  }
                }}
                disabled={balanceHuman === "—" || !tokenIsValid || !onBsc}
                className="px-3 py-1.5 text-xs bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-gray-300 rounded-lg transition-colors disabled:opacity-50"
              >
                50%
              </button>
              <button
                onClick={() => {
                  if (balanceHuman !== "—") setAmountText(balanceHuman);
                }}
                disabled={balanceHuman === "—" || !tokenIsValid || !onBsc}
                className="px-3 py-1.5 text-xs bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-gray-300 rounded-lg transition-colors disabled:opacity-50"
              >
                MAX
              </button>
            </div>
            
            {normalizedAmount && (
              <button
                onClick={() => setAmountText("")}
                className="text-xs text-gray-400 hover:text-white transition-colors"
                type="button"
              >
                Clear
              </button>
            )}
          </div>
          
          {amountError && (
            <div className="mt-2 text-xs text-red-400">{amountError}</div>
          )}
          {!amountError && normalizedAmount && hasAmount && !hasEnough && (
            <div className="mt-2 text-xs text-red-400">Amount exceeds your available balance</div>
          )}
        </div>

        {/* Transfer Button */}
        <div className="pt-4 border-t border-white/10">
          <button
            onClick={handleTransfer}
            disabled={!canTransfer}
            className={`
              w-full py-4 rounded-xl font-bold text-lg transition-all duration-300
              flex items-center justify-center gap-3
              ${!canTransfer
                ? 'bg-gradient-to-r from-gray-700 to-gray-800 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-400 hover:to-cyan-500 text-white hover:shadow-xl hover:-translate-y-0.5'
              }
            `}
            type="button"
          >
            {isPending ? (
              <div className="flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Confirming in wallet...
              </div>
            ) : receipt.isLoading ? (
              <div className="flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Waiting for confirmation...
              </div>
            ) : !address ? (
              <div className="flex items-center justify-center gap-3">
                <Wallet className="w-5 h-5" />
                Connect Wallet to Transfer
              </div>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Transfer {normalizedAmount ? `${normalizedAmount} ${symbol}` : symbol}
              </>
            )}
          </button>
          
          {/* Transaction Status */}
          {(txHash || receipt.isSuccess) && (
            <div className="mt-4 space-y-3">
              {txHash && (
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-green-600/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <div>
                        <div className="text-sm font-medium text-emerald-200">Transaction Submitted</div>
                        {txUrl && (
                          <a
                            href={txUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-emerald-300/80 hover:text-emerald-200 inline-flex items-center gap-1"
                          >
                            View on Explorer
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {receipt.isSuccess && (
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-green-600/5">
                  <div className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-emerald-400" />
                    <div>
                      <div className="font-medium text-emerald-200">Transfer Successful!</div>
                      <div className="text-sm text-emerald-300/80">
                        Sent {normalizedAmount} {symbol} to {shortAddr(recipient)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Important Notice */}
          <div className="mt-6 p-4 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-amber-600/5">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-amber-200 mb-1">Important Notice</div>
                <div className="text-sm text-amber-300/80">
                  Token transfers are irreversible. Always verify the recipient address before confirming.
                  Some tokens may have transfer restrictions or fees.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}