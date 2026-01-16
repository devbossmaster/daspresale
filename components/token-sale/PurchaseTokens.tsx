"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ShoppingCart, AlertCircle, RefreshCw, Wallet, TrendingUp, CheckCircle, Zap } from "lucide-react";
import {
  useAccount,
  useBlockNumber,
  useChainId,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { tokenIcoAbi } from "@/lib/contracts/abi/tokenIcoAbi";
import { erc20Abi } from "@/lib/contracts/abi/erc20Abi";
import { getTokenIcoAddress } from "@/lib/contracts/addresses";
import { useTokenIcoDashboard } from "@/lib/hooks/useTokenIcoDashboard";
import { bsc } from "viem/chains";
import { useMounted } from "@/lib/hooks/useMounted";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as const;

function isZeroAddress(a?: `0x${string}`) {
  return !a || a.toLowerCase() === ZERO_ADDR;
}

/** Format a decimal string safely without Number() precision loss. */
function formatDecimalStr(v?: string, maxFrac = 6) {
  if (!v) return "—";
  const [intRaw, fracRaw = ""] = v.split(".");
  const intPart = (intRaw || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = fracRaw.slice(0, maxFrac).replace(/0+$/, "");
  return frac.length ? `${intPart}.${frac}` : intPart;
}

/** Keep only digits and one dot; clamp fractional digits to `decimals`. */
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
  }

  if (!out.includes(".")) {
    out = out.replace(/^0+(?=\d)/, "");
    if (out === "") out = "0";
  } else {
    const [i, f = ""] = out.split(".");
    const i2 = i.replace(/^0+(?=\d)/, "") || "0";
    out = `${i2}.${f}`;
  }

  return out;
}

function minBigint(...vals: bigint[]) {
  return vals.reduce((m, v) => (v < m ? v : m), vals[0] ?? 0n);
}

function safeSub(a: bigint, b: bigint) {
  return a > b ? a - b : 0n;
}

function extractErrText(e: any) {
  return e?.shortMessage || e?.cause?.shortMessage || e?.details || e?.message || "";
}

function humanizeUiError(e: any) {
  const raw = String(extractErrText(e) || "").toLowerCase();

  if (!raw) return "Transaction failed. Please try again.";

  if (raw.includes("user rejected") || raw.includes("rejected the request")) {
    return "Transaction cancelled in your wallet";
  }

  if (raw.includes("insufficient funds")) {
    return "Insufficient BNB for gas fees";
  }

  if (raw.includes("below min buy")) {
    return "Amount below minimum purchase limit";
  }

  if (raw.includes("above max buy")) {
    return "Amount above maximum purchase limit";
  }

  if (raw.includes("sale not active")) {
    return "Presale is not active at this time";
  }

  if (raw.includes("hard cap")) {
    return "Presale hard cap would be exceeded";
  }

  if (
    raw.includes("failed to fetch") ||
    raw.includes("http request failed") ||
    raw.includes("network error")
  ) {
    return "Network connection issue. Please check RPC";
  }

  if (raw.includes("execution reverted") || raw.includes("contractfunctionexecutionerror")) {
    return "Transaction reverted by contract. Check amount/sale status";
  }

  return "Transaction failed. Please try again.";
}

export default function PurchaseTokens() {
  const mounted = useMounted();
  const [usdtAmountText, setUsdtAmountText] = useState<string>("");
  const [uiError, setUiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [txSuccess, setTxSuccess] = useState(false);

  const chainId = useChainId();
  const onBsc = chainId === bsc.id;
  const ico = onBsc ? getTokenIcoAddress(chainId) : undefined;

  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  // State for caching
  const [cachedDashboard, setCachedDashboard] = useState<any>(null);
  const [cachedUsdtBalance, setCachedUsdtBalance] = useState<bigint>(0n);
  const [cachedAllowance, setCachedAllowance] = useState<bigint>(0n);
  const [cachedContributed, setCachedContributed] = useState<bigint>(0n);
  const [hasInitialData, setHasInitialData] = useState(false);

  /**
   * Dashboard data often refetches in the background. We cache the last good `dash`
   * so UI doesn't flash "Loading..." or reset derived values on refetch.
   */
  const { 
    data: dashLive, 
    isLoading: dashLoadingLive, 
    error: dashError,
    refetch: refetchDashboard 
  } = useTokenIcoDashboard();

  // Update cache when new data arrives
  useEffect(() => {
    if (dashLive && !dashLoadingLive) {
      setCachedDashboard(dashLive);
      setHasInitialData(true);
    }
  }, [dashLive, dashLoadingLive]);

  const dash = hasInitialData ? (dashLive || cachedDashboard) : dashLive;
  const dashLoading = dashLoadingLive && !hasInitialData;

  const tokenSymbol = dash?.symbol ?? "AERA";
  const tokenDecimals = dash?.decimals ?? 18;

  const payToken = dash?.payToken; // USDT
  const payDecimals = dash?.payDecimals ?? 18;
  const paySymbol = dash?.paySymbol ?? "USDT";

  const tokenPrice = dash?.tokenPrice ?? 0n;

  /**
   * Reduce needless refetch pressure.
   */
  const readEnabled = onBsc && !!ico && !!address;

  // --- Read contributed (wallet max enforcement / Max button accuracy)
  const contributedRead = useReadContract({
    address: ico,
    abi: tokenIcoAbi,
    functionName: "usdtContributed",
    args: address ? [address] : undefined,
    query: {
      enabled: readEnabled,
      refetchOnWindowFocus: false,
    },
  });

  // Update contributed cache
  useEffect(() => {
    if (contributedRead.data !== undefined && !contributedRead.isLoading) {
      setCachedContributed(contributedRead.data as bigint);
    }
  }, [contributedRead.data, contributedRead.isLoading]);

  // --- Chain time from latest block timestamp
  const { data: latestBlock } = useBlockNumber({ watch: onBsc });
  const [chainNowSec, setChainNowSec] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    async function syncTime() {
      if (!publicClient) return;
      try {
        const bn = (latestBlock ?? (await publicClient.getBlockNumber())) as bigint;
        const b = await publicClient.getBlock({ blockNumber: bn });
        if (!cancelled) setChainNowSec(Number(b.timestamp));
      } catch {
        // keep previous value
      }
    }

    syncTime();
    return () => {
      cancelled = true;
    };
  }, [publicClient, latestBlock]);

  // ----- Sale checks -----
  const isPaused = dash?.paused ?? false;
  const saleStart = dash?.start ?? 0;
  const saleEnd = dash?.end ?? 0;

  // If either start or end is set, treat as window (your previous code used OR here too).
  const saleWindowEnabled = saleStart !== 0 || saleEnd !== 0;

  // If only one boundary is set, behave sensibly:
  const saleActive = !saleWindowEnabled
    ? true
    : (saleStart === 0 || chainNowSec >= saleStart) && (saleEnd === 0 || chainNowSec <= saleEnd);

  const minBuyUSDT = dash?.minBuyUSDT ?? 0n;
  const maxBuyUSDT = dash?.maxBuyUSDT ?? 0n;

  const hardCapUSDT = dash?.hardCapUSDT ?? 0n;
  const hardCapTokens = dash?.hardCapTokens ?? 0n;
  const totalUSDTRaised = dash?.usdtRaised ?? 0n;
  const totalTokensSold = dash?.totalTokensSold ?? 0n;

  const tokensRemaining = (() => {
    const v = dash?.tokensRemaining;
    if (v === undefined) return 0n;
    return typeof v === "bigint" ? v : BigInt(v as any);
  })();

  // ----- Read balances / allowance -----
  const usdtReadEnabled =
    onBsc && !!address && !!payToken && !isZeroAddress(payToken) && !!ico;

  const usdtBalRead = useReadContract({
    address: payToken && !isZeroAddress(payToken) ? payToken : undefined,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: usdtReadEnabled,
      refetchOnWindowFocus: false,
    },
  });

  const allowanceRead = useReadContract({
    address: payToken && !isZeroAddress(payToken) ? payToken : undefined,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && ico ? [address, ico] : undefined,
    query: {
      enabled: usdtReadEnabled,
      refetchOnWindowFocus: false,
    },
  });

  // Update balance and allowance cache
  useEffect(() => {
    if (usdtBalRead.data !== undefined && !usdtBalRead.isLoading) {
      setCachedUsdtBalance(usdtBalRead.data as bigint);
    }
  }, [usdtBalRead.data, usdtBalRead.isLoading]);

  useEffect(() => {
    if (allowanceRead.data !== undefined && !allowanceRead.isLoading) {
      setCachedAllowance(allowanceRead.data as bigint);
    }
  }, [allowanceRead.data, allowanceRead.isLoading]);

  const usdtBal = hasInitialData ? (usdtBalRead.data || cachedUsdtBalance) : (usdtBalRead.data || 0n);
  const allowance = hasInitialData ? (allowanceRead.data || cachedAllowance) : (allowanceRead.data || 0n);
  const contributedStable = hasInitialData ? (contributedRead.data || cachedContributed) : (contributedRead.data || 0n);

  // Handle manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.allSettled([
        refetchDashboard?.(),
        usdtBalRead.refetch?.(),
        allowanceRead.refetch?.(),
        contributedRead.refetch?.(),
      ]);
    } catch (error) {
      console.error("Refresh failed:", error);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // ----- Parse input safely -----
  const normalizedInput = useMemo(
    () => normalizeDecimalInput(usdtAmountText, payDecimals),
    [usdtAmountText, payDecimals]
  );

  const { usdtAmount, inputError } = useMemo(() => {
    try {
      if (!normalizedInput) return { usdtAmount: 0n, inputError: null as string | null };
      if (normalizedInput === "." || normalizedInput === "0.") return { usdtAmount: 0n, inputError: null };

      const v = parseUnits(normalizedInput, payDecimals);
      return { usdtAmount: v, inputError: null };
    } catch {
      return { usdtAmount: 0n, inputError: "Invalid amount format" };
    }
  }, [normalizedInput, payDecimals]);

  // ----- Tokens to receive -----
  const tokensToReceive = useMemo(() => {
    if (!tokenPrice || tokenPrice === 0n) return 0n;
    const denom = 10n ** BigInt(tokenDecimals);
    return (usdtAmount * denom) / tokenPrice;
  }, [usdtAmount, tokenPrice, tokenDecimals]);

  const tokensHuman = useMemo(() => {
    return formatDecimalStr(formatUnits(tokensToReceive, tokenDecimals), 2);
  }, [tokensToReceive, tokenDecimals]);

  // 1 USDT -> X tokens
  const rateTokensPer1Usdt = useMemo(() => {
    if (!tokenPrice || tokenPrice === 0n) return null;
    const oneUsdt = 10n ** BigInt(payDecimals);
    const denom = 10n ** BigInt(tokenDecimals);
    const tokens = (oneUsdt * denom) / tokenPrice;
    return formatDecimalStr(formatUnits(tokens, tokenDecimals), 6);
  }, [tokenPrice, payDecimals, tokenDecimals]);

  // ---- Limits / caps validation ----
  const walletRemaining = useMemo(() => {
    if (maxBuyUSDT === 0n) return 2n ** 256n - 1n;
    return safeSub(maxBuyUSDT, contributedStable);
  }, [maxBuyUSDT, contributedStable]);

  const hardCapRemaining = useMemo(() => {
    if (hardCapUSDT === 0n) return 2n ** 256n - 1n;
    return safeSub(hardCapUSDT, totalUSDTRaised);
  }, [hardCapUSDT, totalUSDTRaised]);

  const denomToken = useMemo(() => 10n ** BigInt(tokenDecimals), [tokenDecimals]);

  const maxSpendByTokenCap = useMemo(() => {
    if (hardCapTokens === 0n || tokenPrice === 0n) return 2n ** 256n - 1n;
    const tokensRemainingCap = safeSub(hardCapTokens, totalTokensSold);
    return (tokensRemainingCap * tokenPrice) / denomToken;
  }, [hardCapTokens, totalTokensSold, tokenPrice, denomToken]);

  const maxSpendByLiquidity = useMemo(() => {
    if (tokenPrice === 0n) return 0n;
    return (tokensRemaining * tokenPrice) / denomToken;
  }, [tokensRemaining, tokenPrice, denomToken]);

  const maxSpend = useMemo(() => {
    const MAX = 2n ** 256n - 1n;
    const lim = [usdtBal, walletRemaining, hardCapRemaining, maxSpendByTokenCap, maxSpendByLiquidity].filter(
      (x) => x !== MAX
    );
    if (lim.length === 0) return usdtBal;
    return minBigint(usdtBal, ...lim);
  }, [usdtBal, walletRemaining, hardCapRemaining, maxSpendByTokenCap, maxSpendByLiquidity]);

  const hasEnoughBalance = usdtBal >= usdtAmount;
  const belowMin = minBuyUSDT !== 0n && usdtAmount > 0n && usdtAmount < minBuyUSDT;
  const aboveWalletMax = maxBuyUSDT !== 0n && usdtAmount > walletRemaining;
  const exceedsHardCap = hardCapUSDT !== 0n && usdtAmount > hardCapRemaining;
  const exceedsTokenCap = hardCapTokens !== 0n && usdtAmount > maxSpendByTokenCap;
  const exceedsLiquidity = usdtAmount > maxSpendByLiquidity;

  const needsApproval = useMemo(() => usdtAmount > 0n && allowance < usdtAmount, [allowance, usdtAmount]);

  const contractNotReady =
    !onBsc ||
    !ico ||
    !address ||
    !payToken ||
    isZeroAddress(payToken) ||
    tokenPrice === 0n ||
    isPaused ||
    !saleActive;

  const invalidForPurchase =
    inputError ||
    usdtAmount === 0n ||
    tokensToReceive === 0n ||
    !hasEnoughBalance ||
    belowMin ||
    aboveWalletMax ||
    exceedsHardCap ||
    exceedsTokenCap ||
    exceedsLiquidity;

  const buttonDisabled = dashLoading || isSubmitting || contractNotReady || !!invalidForPurchase;

  async function handlePurchase() {
    setUiError(null);
    setTxSuccess(false);

    try {
      if (!ico) throw new Error("ICO address not configured for this chain.");
      if (!address) throw new Error("Connect your wallet first.");
      if (!payToken || isZeroAddress(payToken)) throw new Error("Payment token address not available.");
      if (!publicClient) throw new Error("Public client not ready.");
      if (isPaused) throw new Error("Sale is paused.");
      if (!saleActive) throw new Error("Sale is not active (outside sale window).");
      if (tokenPrice === 0n) throw new Error("Token price not set.");
      if (inputError) throw new Error(inputError);
      if (usdtAmount === 0n) throw new Error(`Enter a ${paySymbol} amount.`);
      if (!hasEnoughBalance) throw new Error(`Insufficient ${paySymbol} balance.`);
      if (tokensToReceive === 0n) throw new Error("Amount too small (would receive 0 tokens).");

      if (belowMin) {
        throw new Error(
          `Below minimum buy. Min is ${formatDecimalStr(formatUnits(minBuyUSDT, payDecimals), 6)} ${paySymbol}.`
        );
      }
      if (aboveWalletMax) {
        throw new Error(
          `Above your wallet maximum remaining. Remaining max is ${formatDecimalStr(
            formatUnits(walletRemaining, payDecimals),
            6
          )} ${paySymbol}.`
        );
      }
      if (exceedsHardCap) throw new Error("Presale hard cap in USDT would be exceeded.");
      if (exceedsTokenCap) throw new Error("Presale token cap would be exceeded.");
      if (exceedsLiquidity) throw new Error("Not enough tokens left in the contract to fulfill this purchase.");

      setIsSubmitting(true);

      // 1) LIMITED approval (EXACT amount only)
      if (needsApproval) {
        const targetAllowance = usdtAmount;

        // Some ERC20s require allowance reset to 0 before changing
        if (allowance > 0n && allowance < targetAllowance) {
          const resetHash = await writeContractAsync({
            address: payToken,
            abi: erc20Abi,
            functionName: "approve",
            args: [ico, 0n],
          });
          await publicClient.waitForTransactionReceipt({ hash: resetHash });
        }

        const approveHash = await writeContractAsync({
          address: payToken,
          abi: erc20Abi,
          functionName: "approve",
          args: [ico, targetAllowance],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      // 2) Buy
      const buyHash = await writeContractAsync({
        address: ico,
        abi: tokenIcoAbi,
        functionName: "buyToken",
        args: [usdtAmount],
      });
      await publicClient.waitForTransactionReceipt({ hash: buyHash });

      // Success
      setTxSuccess(true);
      
      // Refresh reads after success
      await Promise.allSettled([
        usdtBalRead.refetch?.(),
        allowanceRead.refetch?.(),
        contributedRead.refetch?.(),
      ]);

      // Reset form after delay
      setTimeout(() => {
        setUsdtAmountText("");
        setTxSuccess(false);
      }, 3000);

    } catch (e: any) {
      setUiError(humanizeUiError(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  const balanceHuman = useMemo(() => {
    return formatDecimalStr(formatUnits(usdtBal, payDecimals), 2);
  }, [usdtBal, payDecimals]);

  const maxSpendHuman = useMemo(() => {
    return formatDecimalStr(formatUnits(maxSpend, payDecimals), 2);
  }, [maxSpend, payDecimals]);

  const saleWindowText = useMemo(() => {
    if (!saleWindowEnabled) return null;
    const start = saleStart ? new Date(saleStart * 1000).toLocaleDateString() : "—";
    const end = saleEnd ? new Date(saleEnd * 1000).toLocaleDateString() : "—";
    return { start, end };
  }, [saleWindowEnabled, saleStart, saleEnd]);

  // Don't render until mounted to avoid hydration mismatch
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
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
      
      <div className="relative p-5 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6 sm:mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-600/20 border border-purple-500/30">
              <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">Purchase Tokens</h2>
              <p className="text-sm text-gray-400">
                Buy {tokenSymbol} with {paySymbol}
              </p>
            </div>
          </div>
          
          {hasInitialData && !dashLoading && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-lg hover:bg-white/10 transition-all duration-200 disabled:opacity-50"
              aria-label="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {/* Success Message */}
        {txSuccess && (
          <div className="mb-6 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-green-600/5 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-medium text-emerald-200">Transaction Successful!</div>
                <div className="mt-1 text-sm text-emerald-300/80">
                  You purchased {tokensHuman} {tokenSymbol} for {normalizedInput} {paySymbol}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Messages */}
        {(uiError || dashError) && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-gradient-to-r from-red-500/10 to-red-600/5 p-4 backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-red-200">Transaction Failed</div>
                <div className="mt-1 text-sm text-red-300/80">
                  {uiError ? uiError : humanizeUiError(dashError)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Network Warnings */}
        {!onBsc && isConnected && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-amber-600/5 p-4 backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-amber-200">Wrong Network</div>
                <div className="mt-1 text-sm text-amber-300/80">
                  Please switch to BSC Mainnet to purchase tokens
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
                  Connect your wallet to purchase tokens
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pay With Section */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              Pay With {paySymbol}
            </h3>
            
            {/* Rate Display */}
            {rateTokensPer1Usdt && (
              <div className="text-xs sm:text-sm px-3 py-1 rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-300 border border-cyan-500/30">
                1 {paySymbol} = {rateTokensPer1Usdt} {tokenSymbol}
              </div>
            )}
          </div>

          <div className="space-y-4">
            {/* Input Card */}
            <div className="group p-4 rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/30 to-black/20 backdrop-blur-sm hover:border-purple-500/30 transition-all duration-300">
              <div className="mb-3">
                <div className="text-sm text-gray-400 mb-2 flex justify-between">
                  <span>{paySymbol} Amount</span>
                  <span className="text-gray-500">
                    Balance: <span className="text-cyan-300">{balanceHuman} {paySymbol}</span>
                  </span>
                </div>

                <div className="relative">
                  <input
                    inputMode="decimal"
                    type="text"
                    value={normalizedInput}
                    onChange={(e) => setUsdtAmountText(e.target.value)}
                    className="w-full pl-14 pr-4 py-3 bg-black/30 border border-white/10 rounded-xl text-xl sm:text-2xl font-bold text-right text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-gray-500"
                    placeholder="0.0"
                    disabled={!address || !onBsc}
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-300 font-medium">
                    {paySymbol}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="px-3 py-1.5 text-xs bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-gray-300 rounded-lg transition-colors"
                      onClick={() => setUsdtAmountText(formatUnits(maxSpend / 2n, payDecimals))}
                      disabled={!payToken || !address || dashLoading}
                    >
                      50%
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1.5 text-xs bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-gray-300 rounded-lg transition-colors"
                      onClick={() => setUsdtAmountText(formatUnits(maxSpend, payDecimals))}
                      disabled={!payToken || !address || dashLoading}
                    >
                      MAX
                    </button>
                  </div>
                  
                  <div className="text-xs text-gray-400">
                    Max spend: <span className="text-emerald-300">{maxSpendHuman} {paySymbol}</span>
                  </div>
                </div>
              </div>

              {/* Validation Errors */}
              <div className="space-y-2 pt-3 border-t border-white/10">
                {hasEnoughBalance === false && usdtAmount > 0n && (
                  <div className="flex items-center gap-2 text-xs text-red-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    Insufficient {paySymbol} balance
                  </div>
                )}
                {belowMin && (
                  <div className="flex items-center gap-2 text-xs text-red-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    Below minimum buy of {formatDecimalStr(formatUnits(minBuyUSDT, payDecimals), 6)} {paySymbol}
                  </div>
                )}
                {aboveWalletMax && (
                  <div className="flex items-center gap-2 text-xs text-red-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    Above your remaining wallet limit
                  </div>
                )}
                {(exceedsHardCap || exceedsTokenCap || exceedsLiquidity) && (
                  <div className="flex items-center gap-2 text-xs text-red-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    Exceeds sale caps or remaining liquidity
                  </div>
                )}
              </div>
            </div>

            {/* Receive Card */}
            <div className="group p-4 rounded-xl border border-white/10 bg-gradient-to-br from-cyan-900/20 to-purple-900/20 backdrop-blur-sm hover:border-cyan-500/30 transition-all duration-300">
              <div className="mb-4">
                <div className="text-sm text-gray-400 mb-3">You Will Receive</div>
                
                {dashLoading ? (
                  <div className="h-10 w-48 bg-gray-800/50 rounded-lg animate-pulse mx-auto" />
                ) : (
                  <div className="text-2xl sm:text-3xl font-bold text-center text-white mb-4">
                    {tokensHuman} <span className="text-cyan-300">{tokenSymbol}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handlePurchase}
                  disabled={buttonDisabled}
                  className={`
                    w-full py-3 rounded-xl font-bold text-sm sm:text-base transition-all duration-300
                    ${buttonDisabled
                      ? 'bg-gradient-to-r from-gray-700 to-gray-800 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white hover:shadow-xl hover:-translate-y-0.5'
                    }
                  `}
                >
                  {isSubmitting ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      Processing...
                    </div>
                  ) : !address ? (
                    <div className="flex items-center justify-center gap-2">
                      <Wallet className="w-4 h-4" />
                      Connect Wallet
                    </div>
                  ) : needsApproval ? (
                    <div className="flex items-center justify-center gap-2">
                      <Zap className="w-4 h-4" />
                      Approve & Purchase
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <ShoppingCart className="w-4 h-4" />
                      Purchase Tokens
                    </div>
                  )}
                </button>
              </div>

              {/* Sale Status */}
              <div className="pt-3 border-t border-white/10">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="text-gray-400 mb-1">Sale Status</div>
                    <div className={`font-medium ${
                      isPaused ? 'text-red-400' : 
                      saleActive ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      {isPaused ? 'Paused' : saleActive ? 'Active' : 'Not Active'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 mb-1">Remaining</div>
                    <div className="font-medium text-cyan-300">
                      {formatDecimalStr(formatUnits(tokensRemaining, tokenDecimals), 2)} {tokenSymbol}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Limits & Information */}
        <div className="pt-4 border-t border-white/10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="p-3 rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/30 to-black/20">
              <div className="text-xs text-gray-400 mb-1">Your Contribution</div>
              <div className="font-medium text-white">
                {formatDecimalStr(formatUnits(contributedStable, payDecimals), 2)} {paySymbol}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {maxBuyUSDT === 0n 
                  ? 'No wallet limit'
                  : `Limit: ${formatDecimalStr(formatUnits(maxBuyUSDT, payDecimals), 0)} ${paySymbol}`
                }
              </div>
            </div>
            
            <div className="p-3 rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/30 to-black/20">
              <div className="text-xs text-gray-400 mb-1">Hard Cap</div>
              <div className="font-medium text-white">
                {hardCapUSDT === 0n 
                  ? 'Not set' 
                  : `${formatDecimalStr(formatUnits(totalUSDTRaised, payDecimals), 2)} / ${formatDecimalStr(formatUnits(hardCapUSDT, payDecimals), 2)} ${paySymbol}`
                }
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {hardCapTokens === 0n 
                  ? 'No token cap'
                  : `${formatDecimalStr(formatUnits(totalTokensSold, tokenDecimals), 2)} / ${formatDecimalStr(formatUnits(hardCapTokens, tokenDecimals), 2)} ${tokenSymbol}`
                }
              </div>
            </div>
            
            <div className="p-3 rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/30 to-black/20">
              <div className="text-xs text-gray-400 mb-1">Allowance</div>
              <div className="font-medium text-white">
                {formatDecimalStr(formatUnits(allowance, payDecimals), 2)} {paySymbol}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {needsApproval ? 'Requires approval' : 'Sufficient allowance'}
              </div>
            </div>
          </div>

          {/* Sale Window Info */}
          {saleWindowText && (
            <div className="p-3 rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/30 to-black/20">
              <div className="text-xs text-gray-400 mb-1">Sale Window</div>
              <div className="text-sm text-white">
                {saleStart ? new Date(saleStart * 1000).toLocaleDateString() : 'Not set'} → 
                {saleEnd ? new Date(saleEnd * 1000).toLocaleDateString() : 'Not set'}
              </div>
              {!saleActive && (
                <div className="text-xs text-amber-400 mt-1">
                  {saleStart && chainNowSec < saleStart ? 'Sale starts soon' : 'Sale has ended'}
                </div>
              )}
            </div>
          )}

          {/* Important Notice */}
          <div className="mt-4 p-4 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-amber-600/5">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-amber-200 mb-1">Important Notice</div>
                <div className="text-sm text-amber-300/80">
                  Purchases are final. You must approve {paySymbol} spending before buying. 
                  Tokens are transferred immediately after successful transaction confirmation.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}