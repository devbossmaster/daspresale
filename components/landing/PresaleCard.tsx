"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, AlertTriangle, ExternalLink } from "lucide-react";
import { AppKitButton, AppKitNetworkButton } from "@reown/appkit/react";
import {
  useAccount,
  useChainId,
  useChains,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { formatUnits, isAddress, maxUint256, parseUnits, type Address, type Hex } from "viem";

import { tokenIcoAbi } from "@/lib/contracts/abi/tokenIcoAbi";
import { erc20Abi } from "@/lib/contracts/abi/erc20Abi";
import { getTokenIcoAddress } from "@/lib/contracts/addresses";
import { useTokenIcoDashboard } from "@/lib/hooks/useTokenIcoDashboard";

function fmtNum(s?: string, maxFrac = 6) {
  if (!s) return "—";
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  return n.toLocaleString(undefined, { maximumFractionDigits: maxFrac });
}

function trimDecimalsStr(v: string, max = 6) {
  if (!v.includes(".")) return v;
  const [i, f] = v.split(".");
  return `${i}.${f.slice(0, max)}`.replace(/\.?0+$/, "");
}

function safeParseUnits(input: string, decimals: number) {
  try {
    const cleaned = (input || "")
      .replace(/,/g, "")
      .trim()
      .replace(/[^0-9.]/g, "");

    if (!cleaned || cleaned === ".") return 0n;

    // prevent "1.2.3"
    const parts = cleaned.split(".");
    const normalized = parts.length <= 2 ? cleaned : `${parts[0]}.${parts.slice(1).join("")}`;

    return parseUnits(normalized, decimals);
  } catch {
    return 0n;
  }
}

function fmtTs(ts?: number) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

interface PresaleCardProps {
  stage?: string;
}

export default function PresaleCard({ stage = "Stage 1" }: PresaleCardProps) {
  const chainId = useChainId();
  const chains = useChains();
  const chain = chains.find((c) => c.id === chainId);
  const explorerBase = chain?.blockExplorers?.default?.url;

  const ico = getTokenIcoAddress(chainId) as Address | undefined;

  const { address: user, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const { data: dash, isLoading: dashLoading, error: dashError } = useTokenIcoDashboard();

  const tokenAddr = dash?.tokenAddr as Address | undefined;
  const tokenSymbol = dash?.symbol ?? "TOKEN";
  const tokenDecimals = dash?.decimals ?? 18;

  const payTokenAddr = dash?.payToken as Address | undefined;
  const paySymbol = dash?.paySymbol ?? "USDT";
  const payDecimals = dash?.payDecimals ?? 18;

  const tokenPrice = dash?.tokenPrice ?? 0n;
  const tokensRemaining = dash?.tokensRemaining ?? 0n;

  const paused = dash?.paused ?? false;
  const saleStart = dash?.start ?? 0;
  const saleEnd = dash?.end ?? 0;

  const minBuyUSDT = dash?.minBuyUSDT ?? 0n;
  const maxBuyUSDT = dash?.maxBuyUSDT ?? 0n;

  const progressPct = dash?.progressPct ?? 0;

  // ---- time sync for sale window UX
  const [nowSec, setNowSec] = useState<number>(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 5_000);
    return () => clearInterval(t);
  }, []);

  const saleWindowEnabled = saleStart !== 0 || saleEnd !== 0;
  const saleActive = !saleWindowEnabled ? true : nowSec >= saleStart && nowSec <= saleEnd;

  // ---- user input + UI state
  const [usdtInput, setUsdtInput] = useState("");
  const [uiError, setUiError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [lastBuyHash, setLastBuyHash] = useState<Hex | null>(null);

  // ---- pay token balance + allowance
  const userPayBal = useReadContract({
    address: payTokenAddr,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: user ? [user] : undefined,
    query: { enabled: !!payTokenAddr && !!user, refetchInterval: 8_000 },
  });

  const allowance = useReadContract({
    address: payTokenAddr,
    abi: erc20Abi,
    functionName: "allowance",
    args: user && ico ? [user, ico] : undefined,
    query: { enabled: !!payTokenAddr && !!user && !!ico, refetchInterval: 8_000 },
  });

  const usdtAmountUnits = useMemo(() => safeParseUnits(usdtInput, payDecimals), [usdtInput, payDecimals]);

  const userPayBalUnits = (userPayBal.data as bigint | undefined) ?? 0n;
  const allowanceUnits = (allowance.data as bigint | undefined) ?? 0n;

  const hasEnoughBalance = usdtAmountUnits > 0n ? userPayBalUnits >= usdtAmountUnits : true;
  const needsApproval = usdtAmountUnits > 0n && allowanceUnits < usdtAmountUnits;

  // ---- token out
  const tokensOutUnits = useMemo(() => {
    if (!tokenPrice || tokenPrice === 0n) return 0n;
    if (usdtAmountUnits === 0n) return 0n;
    const scale = 10n ** BigInt(tokenDecimals);
    return (usdtAmountUnits * scale) / tokenPrice; // integer division (rounds down)
  }, [usdtAmountUnits, tokenPrice, tokenDecimals]);

  const tokensOutHuman = useMemo(() => {
    if (tokensOutUnits === 0n) return "";
    return trimDecimalsStr(formatUnits(tokensOutUnits, tokenDecimals), 6);
  }, [tokensOutUnits, tokenDecimals]);

  const tokensRemainingHuman = useMemo(() => {
    try {
      return fmtNum(trimDecimalsStr(formatUnits(tokensRemaining, tokenDecimals), 2), 2);
    } catch {
      return "—";
    }
  }, [tokensRemaining, tokenDecimals]);

  const priceHuman = useMemo(() => {
    if (!tokenPrice || tokenPrice === 0n) return "—";
    return fmtNum(trimDecimalsStr(formatUnits(tokenPrice, payDecimals), 6), 6);
  }, [tokenPrice, payDecimals]);

  const userPayBalHuman = useMemo(() => {
    if (userPayBal.data === undefined) return "—";
    return fmtNum(trimDecimalsStr(formatUnits(userPayBalUnits, payDecimals), 6), 6);
  }, [userPayBal.data, userPayBalUnits, payDecimals]);

  // ---- min/max checks (wallet limits)
  const minOk = minBuyUSDT === 0n || usdtAmountUnits >= minBuyUSDT;
  const maxOk = maxBuyUSDT === 0n || usdtAmountUnits <= maxBuyUSDT;

  // ---- remaining tokens check
  const remainingOk = tokensOutUnits === 0n ? true : tokensOutUnits <= tokensRemaining;

  const contractReady =
    !!ico &&
    isAddress(ico) &&
    !!tokenAddr &&
    isAddress(tokenAddr) &&
    !!payTokenAddr &&
    isAddress(payTokenAddr);

  const canBuy =
    contractReady &&
    isConnected &&
    !dashLoading &&
    !isWorking &&
    !paused &&
    saleActive &&
    tokenPrice > 0n &&
    usdtAmountUnits > 0n &&
    tokensOutUnits > 0n &&
    hasEnoughBalance &&
    minOk &&
    maxOk &&
    remainingOk;

  async function handleBuy() {
    setUiError(null);
    setLastBuyHash(null);

    try {
      if (!ico) throw new Error("ICO address not configured for this network.");
      if (!user) throw new Error("Connect your wallet first.");
      if (!publicClient) throw new Error("Client not ready.");
      if (!payTokenAddr) throw new Error("Payment token not available.");
      if (paused) throw new Error("Sale is paused.");
      if (!saleActive) throw new Error("Sale is not active (outside the sale window).");
      if (!tokenPrice || tokenPrice === 0n) throw new Error("Token price not set.");
      if (usdtAmountUnits === 0n) throw new Error(`Enter a ${paySymbol} amount.`);
      if (!hasEnoughBalance) throw new Error(`Insufficient ${paySymbol} balance.`);
      if (!minOk) throw new Error(`Minimum buy is ${formatUnits(minBuyUSDT, payDecimals)} ${paySymbol}.`);
      if (!maxOk) throw new Error(`Maximum buy is ${formatUnits(maxBuyUSDT, payDecimals)} ${paySymbol}.`);
      if (!remainingOk) throw new Error("Not enough tokens remaining to fulfill this purchase.");

      setIsWorking(true);

      // 1) Approve (USDT-safe flow: approve(0) then approve(max) if needed)
      if (needsApproval) {
        if (allowanceUnits > 0n) {
          const resetHash = await writeContractAsync({
            address: payTokenAddr,
            abi: erc20Abi,
            functionName: "approve",
            args: [ico, 0n],
          });
          await publicClient.waitForTransactionReceipt({ hash: resetHash as Hex });
        }

        const approveHash = await writeContractAsync({
          address: payTokenAddr,
          abi: erc20Abi,
          functionName: "approve",
          args: [ico, maxUint256],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash as Hex });
      }

      // 2) Buy
      const buyHash = await writeContractAsync({
        address: ico,
        abi: tokenIcoAbi,
        functionName: "buyToken",
        args: [usdtAmountUnits],
      });

      setLastBuyHash(buyHash as Hex);
      await publicClient.waitForTransactionReceipt({ hash: buyHash as Hex });

      setUsdtInput("");
    } catch (e: any) {
      setUiError(e?.shortMessage || e?.message || "Transaction failed.");
    } finally {
      setIsWorking(false);
    }
  }

  async function addToMetaMask() {
    const ethereum = typeof window !== "undefined" ? (window as any).ethereum : undefined;
    if (!ethereum?.request) return;
    if (!tokenAddr) return;

    try {
      await ethereum.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address: tokenAddr,
            symbol: tokenSymbol.slice(0, 11),
            decimals: tokenDecimals,
          },
        },
      });
    } catch {
      // ignore (user rejected or wallet not supported)
    }
  }

  const txUrl = lastBuyHash && explorerBase ? `${explorerBase}/tx/${lastBuyHash}` : undefined;

  return (
    <div className="w-full flex justify-center">
      <div className="w-full max-w-3xl rounded-2xl bg-black/70 backdrop-blur-md px-5 py-6 sm:px-8 sm:py-8 border border-white/10 shadow-lg">
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-2 mb-6">
          <span className="inline-flex items-center rounded-full border border-fuchsia-400/60 bg-fuchsia-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-fuchsia-100">
            Limited Time Offer
          </span>
          <h3 className="text-lg sm:text-xl font-semibold text-white">
            {stage} – Buy {tokenSymbol} Now
          </h3>
          <p className="text-[11px] text-zinc-500">
            {paused ? "Sale is paused" : saleWindowEnabled ? `Window: ${fmtTs(saleStart)} → ${fmtTs(saleEnd)}` : "USDT-only presale"}
          </p>
        </div>

        {/* Critical errors / config */}
        {(dashError || !ico) && (
          <div className="mb-4 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-xs text-red-200 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <div>
              <div className="font-semibold">Contract not ready</div>
              <div className="opacity-90">
                {dashError ? "Failed to load contract data." : "ICO address not configured for this chain."}
              </div>
            </div>
          </div>
        )}

        {uiError && (
          <div className="mb-4 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-xs text-red-200">
            {uiError}
          </div>
        )}

        {/* Price + Available */}
        <div className="flex justify-between text-xs sm:text-sm text-zinc-400 mb-3">
          <div>
            <div className="text-[11px] sm:text-xs uppercase tracking-[0.18em] text-zinc-500">Current Price</div>
            <div className="mt-1 text-base sm:text-lg font-semibold text-white">
              {dashLoading ? "Loading..." : `${priceHuman} ${paySymbol}`}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] sm:text-xs uppercase tracking-[0.18em] text-zinc-500">Available</div>
            <div className="mt-1 text-base sm:text-lg font-semibold text-emerald-300">
              {dashLoading ? "Loading..." : `${tokensRemainingHuman} ${tokenSymbol}`}
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-4">
          <div className="flex justify-between text-[11px] sm:text-xs text-zinc-500 mb-1">
            <span className="truncate">
              {paused ? "Paused" : saleActive ? "Sale Active" : "Sale Inactive"}
            </span>
            <span className="text-fuchsia-300 font-semibold">{Number(progressPct ?? 0).toFixed(1)}% Complete</span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(0, Math.min(100, progressPct ?? 0))}%` }}
              transition={{ duration: 0.9 }}
              className="h-full rounded-full bg-gradient-to-r from-[#FF6FD8] via-[#FFCFE9] to-[#6F8BFF]"
            />
          </div>
        </div>

        {/* 1 token = price */}
        <div className="mt-6 mb-6 rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex items-center justify-between">
          <span className="text-xs sm:text-sm text-zinc-400 uppercase tracking-[0.18em]">1 {tokenSymbol}</span>
          <span className="text-base sm:text-lg font-semibold text-white">= {priceHuman} {paySymbol}</span>
        </div>

        {/* Reown buttons */}
        <div className="flex items-center justify-center gap-2 mb-5">
          <AppKitButton label={isConnected ? "Account" : "Connect Wallet"} />
          <AppKitNetworkButton />
        </div>

        {!isConnected ? (
          <div className="space-y-3">
            <button
              disabled
              className="w-full rounded-xl bg-zinc-900/80 px-6 py-3 text-sm font-semibold text-zinc-500 border border-white/10 cursor-default"
            >
              CONNECT WALLET TO ENTER AMOUNT
            </button>

            <button
              disabled
              className="w-full rounded-xl px-6 py-2.5 text-xs font-semibold text-zinc-500 flex items-center justify-center gap-2 bg-zinc-800 border border-white/10 cursor-not-allowed"
            >
              <Plus className="h-3 w-3" />
              Add Token to MetaMask
            </button>
          </div>
        ) : (
          <>
            {/* Balance + limits */}
            <div className="text-[11px] sm:text-xs text-center text-zinc-500 mb-4 space-y-1">
              <div>
                {paySymbol} Balance: <span className="text-zinc-300">{userPayBalHuman}</span>
              </div>
              {(minBuyUSDT > 0n || maxBuyUSDT > 0n) && (
                <div>
                  Limits:{" "}
                  <span className="text-zinc-300">
                    {minBuyUSDT > 0n ? `${fmtNum(formatUnits(minBuyUSDT, payDecimals), 6)} min` : "—"}{" "}
                    /{" "}
                    {maxBuyUSDT > 0n ? `${fmtNum(formatUnits(maxBuyUSDT, payDecimals), 6)} max` : "—"}{" "}
                    {paySymbol}
                  </span>
                </div>
              )}
            </div>

            {/* Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-[11px] sm:text-xs text-zinc-500 mb-2">Pay with {paySymbol}</label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={usdtInput}
                    onChange={(e) => setUsdtInput(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm font-semibold text-white placeholder:text-zinc-600 outline-none focus:border-[#FF6FD8]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      // Max = min(balance, maxBuy if set)
                      const cap = maxBuyUSDT > 0n ? (userPayBalUnits < maxBuyUSDT ? userPayBalUnits : maxBuyUSDT) : userPayBalUnits;
                      const raw = formatUnits(cap, payDecimals);
                      setUsdtInput(trimDecimalsStr(raw, 6));
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-cyan-300 hover:text-cyan-200"
                  >
                    MAX
                  </button>
                </div>

                {!hasEnoughBalance && usdtAmountUnits > 0n && (
                  <div className="mt-2 text-[11px] text-red-300">Insufficient {paySymbol} balance.</div>
                )}
                {!minOk && usdtAmountUnits > 0n && (
                  <div className="mt-2 text-[11px] text-yellow-300">
                    Below minimum buy.
                  </div>
                )}
                {!maxOk && usdtAmountUnits > 0n && (
                  <div className="mt-2 text-[11px] text-yellow-300">
                    Above maximum buy.
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] sm:text-xs text-zinc-500 mb-2">Receive {tokenSymbol}</label>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value={tokensOutHuman ? fmtNum(tokensOutHuman, 6) : ""}
                    placeholder="0"
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm font-semibold text-white placeholder:text-zinc-600 outline-none"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold bg-clip-text text-transparent bg-gradient-to-r from-[#FF6FD8] to-[#6F8BFF]">
                    {tokenSymbol}
                  </span>
                </div>

                {!remainingOk && tokensOutUnits > 0n && (
                  <div className="mt-2 text-[11px] text-yellow-300">
                    Not enough tokens remaining for this amount.
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <motion.button
                whileHover={{ scale: canBuy ? 1.02 : 1 }}
                whileTap={{ scale: canBuy ? 0.98 : 1 }}
                disabled={!canBuy}
                onClick={handleBuy}
                className={`w-full rounded-xl px-6 py-3 text-sm font-semibold flex items-center justify-center gap-2 ${
                  !canBuy
                    ? "bg-zinc-800 text-zinc-500 border border-white/10 cursor-not-allowed"
                    : "bg-gradient-to-r from-[#FF6FD8] via-[#FFCFE9] to-[#6F8BFF] text-black"
                }`}
              >
                {isWorking ? "Processing..." : needsApproval ? `Approve ${paySymbol} & Buy` : `Buy with ${paySymbol}`}
              </motion.button>

              <button
                disabled
                className="w-full rounded-xl bg-zinc-900/80 px-6 py-3 text-sm font-semibold text-zinc-500 border border-white/10 cursor-default"
              >
                {saleActive ? (paused ? "PAUSED" : "READY") : "SALE NOT ACTIVE"}
              </button>

              <button
                disabled={!tokenAddr || !isAddress(tokenAddr)}
                onClick={addToMetaMask}
                className={`w-full rounded-xl px-6 py-2.5 text-xs font-semibold text-white flex items-center justify-center gap-2 ${
                  !tokenAddr ? "bg-zinc-800 text-zinc-500 border border-white/10 cursor-not-allowed" : "bg-gradient-to-r from-[#FF6FD8] to-[#6F8BFF]"
                }`}
              >
                <Plus className="h-3 w-3" />
                Add {tokenSymbol} to MetaMask
              </button>

              {lastBuyHash && (
                <div className="text-center text-[11px] text-zinc-500">
                  Last Tx:{" "}
                  {txUrl ? (
                    <a href={txUrl} target="_blank" rel="noreferrer" className="text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1">
                      View on Explorer <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-zinc-300">{lastBuyHash}</span>
                  )}
                </div>
              )}

              {explorerBase && ico && (
                <a
                  className="block text-center text-[11px] text-zinc-500 hover:text-zinc-300"
                  href={`${explorerBase}/address/${ico}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View Presale Contract on Explorer
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
