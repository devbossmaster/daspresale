"use client";

import { useEffect, useMemo, useState } from "react";
import { ShoppingCart, AlertCircle } from "lucide-react";
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

function readableError(e: any) {
  return (
    e?.shortMessage ||
    e?.cause?.shortMessage ||
    e?.details ||
    e?.message ||
    "Transaction failed."
  );
}

export default function PurchaseTokens() {
  const [usdtAmountText, setUsdtAmountText] = useState<string>("");
  const [uiError, setUiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const chainId = useChainId();
  const ico = getTokenIcoAddress(chainId);

  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const { data: dash, isLoading: dashLoading, error: dashError } =
    useTokenIcoDashboard();

  const tokenSymbol = dash?.symbol ?? "TOKEN";
  const tokenDecimals = dash?.decimals ?? 18;

  const payToken = dash?.payToken; // USDT
  const payDecimals = dash?.payDecimals ?? 18;
  const paySymbol = dash?.paySymbol ?? "USDT";

  const tokenPrice = dash?.tokenPrice ?? 0n;

  // --- Read contributed (wallet max enforcement / Max button accuracy)
  const contributedRead = useReadContract({
    address: ico,
    abi: tokenIcoAbi,
    functionName: "usdtContributed",
    args: address ? [address] : undefined,
    query: { enabled: !!ico && !!address, refetchInterval: 8_000 },
  });
  const contributed = (contributedRead.data as bigint | undefined) ?? 0n;

  // --- Chain time from latest block timestamp
  const { data: latestBlock } = useBlockNumber({ watch: true });
  const [chainNowSec, setChainNowSec] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    async function syncTime() {
      if (!publicClient) return;
      try {
        const bn =
          (latestBlock ?? (await publicClient.getBlockNumber())) as bigint;
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

  const saleWindowEnabled = saleStart !== 0 || saleEnd !== 0;
  const saleActive = !saleWindowEnabled
    ? true
    : chainNowSec >= saleStart && chainNowSec <= saleEnd;

  const minBuyUSDT = dash?.minBuyUSDT ?? 0n;
  const maxBuyUSDT = dash?.maxBuyUSDT ?? 0n;

  const hardCapUSDT = dash?.hardCapUSDT ?? 0n;
  const hardCapTokens = dash?.hardCapTokens ?? 0n;
  const totalUSDTRaised = dash?.usdtRaised ?? 0n;
  const totalTokensSold = dash?.totalTokensSold ?? 0n;

  const tokensRemaining = dash?.tokensRemaining ?? 0n;

  // ----- Read balances / allowance -----
  const usdtBalRead = useReadContract({
    address: payToken && !isZeroAddress(payToken) ? payToken : undefined,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!payToken && !!address && !isZeroAddress(payToken),
      refetchInterval: 8_000,
    },
  });

  const allowanceRead = useReadContract({
    address: payToken && !isZeroAddress(payToken) ? payToken : undefined,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && ico ? [address, ico] : undefined,
    query: {
      enabled: !!payToken && !!address && !!ico && !isZeroAddress(payToken),
      refetchInterval: 8_000,
    },
  });

  const usdtBal = (usdtBalRead.data as bigint | undefined) ?? 0n;
  const allowance = (allowanceRead.data as bigint | undefined) ?? 0n;

  // ----- Parse input safely -----
  const normalizedInput = useMemo(
    () => normalizeDecimalInput(usdtAmountText, payDecimals),
    [usdtAmountText, payDecimals]
  );

  const { usdtAmount, inputError } = useMemo(() => {
    try {
      if (!normalizedInput)
        return { usdtAmount: 0n, inputError: null as string | null };
      if (normalizedInput === "." || normalizedInput === "0.")
        return { usdtAmount: 0n, inputError: null };

      const v = parseUnits(normalizedInput, payDecimals);
      return { usdtAmount: v, inputError: null };
    } catch {
      return { usdtAmount: 0n, inputError: "Invalid amount format." };
    }
  }, [normalizedInput, payDecimals]);

  // ----- Tokens to receive -----
  const tokensToReceive = useMemo(() => {
    if (!tokenPrice || tokenPrice === 0n) return 0n;
    const denom = 10n ** BigInt(tokenDecimals);
    return (usdtAmount * denom) / tokenPrice;
  }, [usdtAmount, tokenPrice, tokenDecimals]);

  const tokensHuman = useMemo(() => {
    return formatDecimalStr(formatUnits(tokensToReceive, tokenDecimals), 6);
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
    return safeSub(maxBuyUSDT, contributed);
  }, [maxBuyUSDT, contributed]);

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
    const lim = [
      usdtBal,
      walletRemaining,
      hardCapRemaining,
      maxSpendByTokenCap,
      maxSpendByLiquidity,
    ].filter((x) => x !== MAX);
    if (lim.length === 0) return usdtBal;
    return minBigint(usdtBal, ...lim);
  }, [usdtBal, walletRemaining, hardCapRemaining, maxSpendByTokenCap, maxSpendByLiquidity]);

  const hasEnoughBalance = usdtBal >= usdtAmount;
  const belowMin = minBuyUSDT !== 0n && usdtAmount > 0n && usdtAmount < minBuyUSDT;
  const aboveWalletMax = maxBuyUSDT !== 0n && usdtAmount > walletRemaining;
  const exceedsHardCap = hardCapUSDT !== 0n && usdtAmount > hardCapRemaining;
  const exceedsTokenCap = hardCapTokens !== 0n && usdtAmount > maxSpendByTokenCap;
  const exceedsLiquidity = usdtAmount > maxSpendByLiquidity;

  const needsApproval = useMemo(
    () => usdtAmount > 0n && allowance < usdtAmount,
    [allowance, usdtAmount]
  );

  const contractNotReady =
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

    try {
      if (!ico) throw new Error("ICO address not configured for this chain.");
      if (!address) throw new Error("Connect your wallet first.");
      if (!payToken || isZeroAddress(payToken))
        throw new Error("Payment token address not available.");
      if (!publicClient) throw new Error("Public client not ready.");
      if (isPaused) throw new Error("Sale is paused.");
      if (!saleActive) throw new Error("Sale is not active (outside sale window).");
      if (tokenPrice === 0n) throw new Error("Token price not set.");
      if (inputError) throw new Error(inputError);
      if (usdtAmount === 0n) throw new Error(`Enter a ${paySymbol} amount.`);
      if (!hasEnoughBalance) throw new Error(`Insufficient ${paySymbol} balance.`);
      if (tokensToReceive === 0n) throw new Error("Amount too small (would receive 0 tokens).");
      if (belowMin)
        throw new Error(
          `Below minimum buy. Min is ${formatDecimalStr(
            formatUnits(minBuyUSDT, payDecimals),
            6
          )} ${paySymbol}.`
        );
      if (aboveWalletMax)
        throw new Error(
          `Above your wallet maximum remaining. Remaining max is ${formatDecimalStr(
            formatUnits(walletRemaining, payDecimals),
            6
          )} ${paySymbol}.`
        );
      if (exceedsHardCap) throw new Error("Presale hard cap in USDT would be exceeded.");
      if (exceedsTokenCap) throw new Error("Presale token cap would be exceeded.");
      if (exceedsLiquidity)
        throw new Error("Not enough tokens left in the contract to fulfill this purchase.");

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

      await Promise.allSettled([
        usdtBalRead.refetch?.(),
        allowanceRead.refetch?.(),
        contributedRead.refetch?.(),
      ]);

      setUsdtAmountText("");
    } catch (e: any) {
      setUiError(readableError(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  const balanceHuman = useMemo(() => {
    return formatDecimalStr(formatUnits(usdtBal, payDecimals), 6);
  }, [usdtBal, payDecimals]);

  const maxSpendHuman = useMemo(() => {
    return formatDecimalStr(formatUnits(maxSpend, payDecimals), 6);
  }, [maxSpend, payDecimals]);

  const saleWindowText = useMemo(() => {
    if (!saleWindowEnabled) return null;
    const start = saleStart ? new Date(saleStart * 1000).toLocaleString() : "—";
    const end = saleEnd ? new Date(saleEnd * 1000).toLocaleString() : "—";
    return { start, end };
  }, [saleWindowEnabled, saleStart, saleEnd]);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-start sm:items-center gap-3 mb-6 sm:mb-8">
        <div className="p-2 bg-purple-900/30 rounded-lg">
          <ShoppingCart className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Purchase Tokens</h2>
          <p className="text-gray-400 text-xs sm:text-sm">
            Buy {tokenSymbol} with {paySymbol}
          </p>
        </div>
      </div>

      {(uiError || dashError) && (
        <div className="mb-5 p-3 rounded-xl border border-red-800/40 bg-red-900/20 text-sm text-red-200">
          {uiError ?? dashError?.message}
        </div>
      )}

      {!ico && (
        <div className="mb-5 p-3 rounded-xl border border-amber-800/40 bg-amber-900/20 text-sm text-amber-200">
          ICO address is not configured for this network.
        </div>
      )}

      {/* Pay With */}
      <div className="mb-6 sm:mb-8">
        <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          <span>Pay With {paySymbol}</span>
        </h3>

        <div className="space-y-4">
          <div className="p-4 bg-gray-800/30 rounded-xl">
            <div className="text-xs sm:text-sm text-gray-400 mb-2">{paySymbol} Amount:</div>

            <div className="relative">
              <input
                inputMode="decimal"
                type="text"
                value={normalizedInput}
                onChange={(e) => setUsdtAmountText(e.target.value)}
                className="w-full pl-14 pr-4 py-2.5 sm:py-3 bg-gray-900 border border-gray-700 rounded-xl text-xl sm:text-2xl font-bold text-right focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="0.0"
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-xs sm:text-sm text-gray-400 font-medium">
                {paySymbol}
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between text-xs sm:text-sm text-gray-400">
              <span>
                Rate:{" "}
                {rateTokensPer1Usdt
                  ? `1 ${paySymbol} = ${rateTokensPer1Usdt} ${tokenSymbol}`
                  : "—"}
              </span>

              <button
                type="button"
                className="text-cyan-300 hover:text-cyan-200 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!payToken || !address || dashLoading}
                onClick={() => {
                  if (!payToken || !address) return;
                  setUsdtAmountText(formatUnits(maxSpend, payDecimals));
                }}
              >
                Max
              </button>
            </div>

            <div className="mt-2 text-xs text-gray-500">
              Balance: {balanceHuman} {paySymbol}{" "}
              <span className="text-gray-600">•</span>{" "}
              Max spend (caps/limits): {maxSpendHuman} {paySymbol}
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-400">
              <div>
                Min buy:{" "}
                {minBuyUSDT === 0n
                  ? "Not set"
                  : `${formatDecimalStr(formatUnits(minBuyUSDT, payDecimals), 6)} ${paySymbol}`}
              </div>
              <div>
                Wallet max:{" "}
                {maxBuyUSDT === 0n
                  ? "Not set"
                  : `${formatDecimalStr(formatUnits(maxBuyUSDT, payDecimals), 6)} ${paySymbol}`}
              </div>
              <div>
                Your contributed: {formatDecimalStr(formatUnits(contributed, payDecimals), 6)}{" "}
                {paySymbol}
              </div>
              <div>
                Remaining wallet max:{" "}
                {maxBuyUSDT === 0n
                  ? "—"
                  : `${formatDecimalStr(formatUnits(walletRemaining, payDecimals), 6)} ${paySymbol}`}
              </div>
            </div>

            {saleWindowText && (
              <div className="mt-3 text-xs text-gray-500">
                Sale window: <span className="text-gray-300">{saleWindowText.start}</span> →{" "}
                <span className="text-gray-300">{saleWindowText.end}</span>
              </div>
            )}

            {!saleActive && (
              <div className="mt-2 text-xs text-yellow-300">
                Sale is not active (outside sale window).
              </div>
            )}
            {isPaused && <div className="mt-2 text-xs text-yellow-300">Sale is paused.</div>}
            {inputError && <div className="mt-2 text-xs text-red-300">{inputError}</div>}
          </div>

          {/* Receive */}
          <div className="p-4 bg-gradient-to-br from-cyan-900/20 to-purple-900/20 rounded-xl border border-cyan-800/30">
            <div className="text-xs sm:text-sm text-gray-400 mb-2">You will receive:</div>
            <div className="text-2xl sm:text-3xl font-bold text-center mb-4">
              {dashLoading ? "Loading..." : `${tokensHuman} ${tokenSymbol}`}
            </div>

            <button
              type="button"
              onClick={handlePurchase}
              disabled={buttonDisabled}
              className="w-full py-2.5 sm:py-3 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm sm:text-base font-bold rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
            >
              {isSubmitting
                ? "Processing..."
                : !address
                ? "Connect Wallet"
                : needsApproval
                ? `Approve ${paySymbol} & Buy`
                : `Buy with ${paySymbol}`}
            </button>

            {!hasEnoughBalance && usdtAmount > 0n && (
              <div className="mt-2 text-xs text-red-300 text-center">
                Insufficient {paySymbol} balance.
              </div>
            )}
            {belowMin && (
              <div className="mt-2 text-xs text-red-300 text-center">Below minimum buy.</div>
            )}
            {aboveWalletMax && (
              <div className="mt-2 text-xs text-red-300 text-center">
                Above your remaining wallet max.
              </div>
            )}
            {(exceedsHardCap || exceedsTokenCap || exceedsLiquidity) && (
              <div className="mt-2 text-xs text-red-300 text-center">
                Amount exceeds sale caps/remaining liquidity.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Warning Note */}
      <div className="pt-4 sm:pt-6 border-t border-gray-800">
        <div className="flex items-start gap-3 p-3 sm:p-4 bg-yellow-900/20 border border-yellow-800/30 rounded-xl">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm text-yellow-300">
            <p className="font-semibold mb-1">Important Notice</p>
            <p className="text-yellow-200/80">
              Purchases are final. Approval is required before buying. Tokens are transferred after confirmation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
