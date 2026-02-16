"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Send,
  Copy,
  Check,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Wallet,
  Shield,
} from "lucide-react";
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
    refetch: refetchDashboard,
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

  useEffect(() => {
    if (tokenSymbolRead.data && !tokenSymbolRead.isLoading) {
      setCachedSymbol(tokenSymbolRead.data as string);
    }
    if (tokenDecimalsRead.data && !tokenDecimalsRead.isLoading) {
      setCachedDecimals(tokenDecimalsRead.data as number);
    }
  }, [
    tokenSymbolRead.data,
    tokenSymbolRead.isLoading,
    tokenDecimalsRead.data,
    tokenDecimalsRead.isLoading,
  ]);

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
    return (
      onBsc &&
      !!address &&
      tokenIsValid &&
      recipientValid &&
      notSelf &&
      hasAmount &&
      hasEnough &&
      !isPending &&
      !receipt.isLoading &&
      !amountError
    );
  }, [
    onBsc,
    address,
    tokenIsValid,
    recipientValid,
    notSelf,
    hasAmount,
    hasEnough,
    isPending,
    receipt.isLoading,
    amountError,
  ]);

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

      setAmountText("");
    } catch (e: any) {
      setUiError(humanizeTxError(e));
      setUiErrorDetails(extractErrText(e) || null);
    }
  }

  const txUrl = txHash && explorerBase ? `${explorerBase}/tx/${txHash}` : undefined;

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-56 sm:h-64">
        <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-t-2 border-b-2 border-cyan-500" />
      </div>
    );
  }

  return (
  <div className="min-h-screen w-full bg-gradient-to-br from-[#12082a] via-[#070a18] to-black">
    {/* Page container */}
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      {/* Page header (matches your screenshot style) */}
      <header className="mb-6 lg:mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
          Transfer
        </h1>
        <p className="mt-1 text-sm sm:text-base text-white/60">
          Send an ERC-20 token to another wallet address.
        </p>
      </header>

      {/* Layout: form left, empty/extra content right (lg+) */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,540px)_1fr] lg:items-start">
        {/* LEFT: Transfer card */}
        <section className="w-full">
          <div
            className="
              relative overflow-hidden rounded-2xl
              border border-white/10 bg-white/[0.04] backdrop-blur-xl
              shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]
            "
          >
            {/* Subtle animated-ish background layers */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/10" />
            <div className="pointer-events-none absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            <div className="relative p-4 sm:p-6 lg:p-8">
              {/* Header */}
              <div className="mb-6 sm:mb-8 flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="shrink-0 rounded-xl border border-white/10 bg-white/5 p-2.5">
                    <Send className="h-5 w-5 sm:h-6 sm:w-6 text-blue-300" />
                  </div>

                  <div className="min-w-0">
                    <h2 className="text-lg sm:text-2xl font-semibold text-white truncate">
                      Transfer Tokens
                    </h2>
                    <p className="text-xs sm:text-sm text-white/55 truncate">
                      Send {symbol} to another wallet
                    </p>
                  </div>
                </div>

                {hasInitialData && !dashLoading && (
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="shrink-0 rounded-lg border border-white/10 bg-white/5 p-2 hover:bg-white/10 transition disabled:opacity-50"
                    aria-label="Refresh data"
                  >
                    <RefreshCw
                      className={`h-4 w-4 text-white/60 ${isRefreshing ? "animate-spin" : ""}`}
                    />
                  </button>
                )}
              </div>

              {/* Error Messages */}
              {(uiError || dashError || writeError) && (
                <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-300 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-red-100">Transfer Failed</div>
                      <div className="mt-1 text-sm text-red-100/80 break-words">
                        {uiError ||
                          humanizeTxError(writeError) ||
                          "Unable to load token data. Please try again."}
                      </div>
                      {uiErrorDetails && (
                        <details className="mt-2">
                          <summary className="text-xs text-red-100/60 cursor-pointer select-none">
                            Show details
                          </summary>
                          <div className="mt-2 text-xs text-red-100/50 whitespace-pre-wrap break-words">
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
                <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-300 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-amber-100">Wrong Network</div>
                      <div className="mt-1 text-sm text-amber-100/80 break-words">
                        Please switch to BSC Mainnet to transfer tokens.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!address && (
                <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <Wallet className="h-5 w-5 text-amber-300 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-amber-100">Wallet Not Connected</div>
                      <div className="mt-1 text-sm text-amber-100/80 break-words">
                        Connect your wallet to transfer tokens.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Token Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/55 mb-2">Token</div>
                  <div className="text-lg font-semibold text-white break-words">{symbol}</div>
                  <div className="text-xs text-white/40 mt-1">ERC-20 Token</div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/55 mb-2">Decimals</div>
                  <div className="text-lg font-semibold text-white">{decimals}</div>
                  <div className="text-xs text-white/40 mt-1">Token precision</div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/55 mb-2">Network</div>
                  <div className={`text-lg font-semibold ${onBsc ? "text-emerald-300" : "text-amber-300"}`}>
                    {onBsc ? "BSC Mainnet" : "Wrong Network"}
                  </div>
                  <div className="text-xs text-white/40 mt-1">Chain ID: {chainId}</div>
                </div>
              </div>

              {/* Token Address */}
              <div className="mb-6">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-base font-semibold text-white">Token Address</h3>

                  {tokenIsValid && (
                    <button
                      onClick={handleCopyTokenAddress}
                      className="
                        w-full sm:w-auto
                        rounded-xl border border-white/10 bg-white/5
                        px-3 py-2 text-xs text-white/70
                        hover:bg-white/10 transition
                        flex items-center justify-center gap-2
                      "
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-300" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copy
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="font-mono text-xs sm:text-sm break-all text-white/70">
                    {tokenAddr || "Token address not available"}
                  </div>
                </div>
              </div>

              {/* Balance */}
              <div className="mb-6">
                <h3 className="text-base font-semibold text-white mb-3">Your Balance</h3>
                <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-blue-500/10 to-cyan-500/5 p-4">
                  {balanceLoading ? (
                    <div className="h-10 sm:h-12 w-44 sm:w-48 bg-white/10 rounded-xl animate-pulse" />
                  ) : (
                    <>
                      <div className="text-2xl sm:text-3xl font-bold text-white mb-2 break-words">
                        {formatDecimalStr(balanceHuman, 6)}{" "}
                        <span className="text-cyan-200">{symbol}</span>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-xs text-white/55">Available for transfer</div>
                        <button
                          onClick={() => {
                            if (balanceHuman !== "—") setAmountText(balanceHuman);
                          }}
                          disabled={balanceHuman === "—" || !tokenIsValid || !onBsc}
                          className="
                            w-full sm:w-auto rounded-xl
                            border border-white/10 bg-white/5
                            px-4 py-2 text-sm text-white/75
                            hover:bg-white/10 transition
                            disabled:opacity-50
                          "
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
                    onChange={(e) => setRecipient(e.target.value)}  // ✅ don’t trim while typing
                    onBlur={(e) => setRecipient(e.target.value.trim())} // ✅ normalize on blur
                    className="
                      w-full rounded-2xl border border-white/10 bg-black/30
                      px-4 py-3 font-mono text-xs sm:text-sm text-white
                      placeholder:text-white/35
                      focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-transparent
                      disabled:opacity-60
                    "
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
                      className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 hover:bg-white/10 transition"
                      title="View address on explorer"
                    >
                      <ExternalLink className="h-4 w-4 text-white/60" />
                    </a>
                  )}
                </div>

                {recipient.length > 0 && !recipientValid && (
                  <div className="mt-2 text-xs text-red-300 flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Invalid recipient address
                  </div>
                )}
                {recipientValid && !notSelf && (
                  <div className="mt-2 text-xs text-amber-300 flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5" />
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
                    className="
                      w-full rounded-2xl border border-white/10 bg-black/30
                      px-4 py-3 text-right text-lg sm:text-xl font-semibold text-white
                      placeholder:text-white/35
                      focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-transparent
                      disabled:opacity-60
                    "
                    placeholder="0.0"
                    spellCheck={false}
                    autoComplete="off"
                    disabled={!address}
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/55 text-sm sm:text-base">
                    {symbol}
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        if (balanceHuman !== "—") {
                          const half = (parseFloat(balanceHuman) / 2).toString();
                          setAmountText(half);
                        }
                      }}
                      disabled={balanceHuman === "—" || !tokenIsValid || !onBsc}
                      className="
                        flex-1 sm:flex-none rounded-xl
                        border border-white/10 bg-white/5
                        px-3 py-2 text-xs text-white/75
                        hover:bg-white/10 transition
                        disabled:opacity-50
                      "
                    >
                      50%
                    </button>

                    <button
                      onClick={() => {
                        if (balanceHuman !== "—") setAmountText(balanceHuman);
                      }}
                      disabled={balanceHuman === "—" || !tokenIsValid || !onBsc}
                      className="
                        flex-1 sm:flex-none rounded-xl
                        border border-white/10 bg-white/5
                        px-3 py-2 text-xs text-white/75
                        hover:bg-white/10 transition
                        disabled:opacity-50
                      "
                    >
                      MAX
                    </button>
                  </div>

                  {normalizedAmount && (
                    <button
                      onClick={() => setAmountText("")}
                      className="text-xs text-white/55 hover:text-white transition self-end sm:self-auto"
                      type="button"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {amountError && <div className="mt-2 text-xs text-red-300">{amountError}</div>}
                {!amountError && normalizedAmount && hasAmount && !hasEnough && (
                  <div className="mt-2 text-xs text-red-300">
                    Amount exceeds your available balance
                  </div>
                )}
              </div>

              {/* Transfer Button */}
              <div className="pt-4 border-t border-white/10">
                <button
                  onClick={handleTransfer}
                  disabled={!canTransfer}
                  className={`
                    w-full rounded-2xl font-semibold transition
                    flex items-center justify-center gap-3
                    py-3 sm:py-4 text-base sm:text-lg
                    ${
                      !canTransfer
                        ? "bg-white/10 text-white/45 cursor-not-allowed border border-white/10"
                        : "bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white shadow-[0_18px_50px_-25px_rgba(34,211,238,0.6)] hover:-translate-y-0.5"
                    }
                  `}
                  type="button"
                >
                  {isPending ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="h-5 w-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      Confirming in wallet...
                    </div>
                  ) : receipt.isLoading ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="h-5 w-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      Waiting for confirmation...
                    </div>
                  ) : !address ? (
                    <div className="flex items-center justify-center gap-3">
                      <Wallet className="h-5 w-5" />
                      Connect Wallet to Transfer
                    </div>
                  ) : (
                    <>
                      <Send className="h-5 w-5" />
                      Transfer {normalizedAmount ? `${normalizedAmount} ${symbol}` : symbol}
                    </>
                  )}
                </button>

                {/* Transaction Status */}
                {(txHash || receipt.isSuccess) && (
                  <div className="mt-4 space-y-3">
                    {txHash && (
                      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-emerald-100">
                              Transaction Submitted
                            </div>
                            {txUrl && (
                              <a
                                href={txUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-emerald-100/75 hover:text-emerald-100 inline-flex items-center gap-1 break-all"
                              >
                                View on Explorer
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {receipt.isSuccess && (
                      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                        <div className="flex items-start gap-3">
                          <Check className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <div className="font-medium text-emerald-100">Transfer Successful!</div>
                            <div className="text-sm text-emerald-100/75 break-words">
                              Sent {normalizedAmount} {symbol} to {shortAddr(recipient)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Important Notice */}
                <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-amber-300 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-amber-100 mb-1">Important Notice</div>
                      <div className="text-sm text-amber-100/75 break-words">
                        Token transfers are irreversible. Always verify the recipient address before confirming.
                        Some tokens may have transfer restrictions or fees.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* /Transfer Button */}
            </div>
          </div>
        </section>

        {/* RIGHT: Optional panel (only on lg+) to avoid “empty space” and look pro */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6">
              <h3 className="text-base font-semibold text-white">Checklist</h3>
              <ul className="mt-3 space-y-2 text-sm text-white/65">
                <li>• Confirm you’re on BSC Mainnet</li>
                <li>• Double-check the recipient address</li>
                <li>• Keep some BNB for gas fees</li>
                <li>• Transfers can’t be reversed</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6">
              <h3 className="text-base font-semibold text-white">Need help?</h3>
              <p className="mt-2 text-sm text-white/65">
                If you paste an address, use the explorer icon to verify it before sending.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  </div>
);
}
