// components/dashboard/RaisedFunds.tsx
"use client";

import { useMemo } from "react";
import { useChainId, useChains } from "wagmi";
import { bsc, hardhat } from "wagmi/chains";
import { formatUnits } from "viem";
import { DollarSign, Target, Globe, AlertTriangle } from "lucide-react";
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

  const { data, isLoading: dashLoading } = useTokenIcoDashboard();

  // Investors from on-chain events (recent range; for full history use an indexer/subgraph)
  const { investorsCount, isLoading: investorsLoading } = useRecentPurchases({
    limit: 500,
    blockRange: chainId === hardhat.id ? 0n : 50_000n,
  });

  const payDecimals = data?.payDecimals ?? 18;
  const paySymbol = data?.paySymbol ?? "USDT";

  const priceRaw = data?.tokenPrice; // bigint (payToken smallest units per 1 token)
  const raisedRaw = data?.usdtRaised ?? 0n; // bigint (payToken)
  const hardCapUsdtRaw = data?.hardCapUSDT ?? 0n; // bigint (payToken)
  const hardCapTokensRaw = data?.hardCapTokens ?? 0n; // bigint (token)
  const totalTokensSoldRaw = data?.totalTokensSold ?? 0n; // bigint (token)

  const pricePay = priceRaw ? trimDecimals(formatUnits(priceRaw, payDecimals), 6) : null;
  const raisedPay = trimDecimals(formatUnits(raisedRaw, payDecimals), 4);

  const tokenDecimals = data?.decimals ?? 18;
  const totalTokensSoldHuman = trimDecimals(formatUnits(totalTokensSoldRaw, tokenDecimals), 4);

  const hasTokenCap = hardCapTokensRaw > 0n;
  const hasUsdtCap = hardCapUsdtRaw > 0n;

  const targetLabel = useMemo(() => {
    if (hasTokenCap) return `Target: ${trimDecimals(formatUnits(hardCapTokensRaw, tokenDecimals), 2)} ${data?.symbol ?? "TOKEN"}`;
    if (hasUsdtCap) return `Target: ${trimDecimals(formatUnits(hardCapUsdtRaw, payDecimals), 2)} ${paySymbol}`;
    return "Target: Not set";
  }, [hasTokenCap, hasUsdtCap, hardCapTokensRaw, hardCapUsdtRaw, tokenDecimals, payDecimals, paySymbol, data?.symbol]);

  const progress = data?.progressPct ?? null;
  const progressSafe = clamp(progress ?? 0);

  const status = computeSaleStatus({
    paused: data?.paused,
    start: data?.start,
    end: data?.end,
    tokenAddr: data?.tokenAddr,
    tokenPrice: data?.tokenPrice,
    tokensRemaining: data?.tokensRemaining,
  });

  const statusPill =
    status.tone === "success"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
      : status.tone === "warning"
        ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
        : "bg-red-500/10 text-red-200 border-red-500/30";

  const expectedUsdt = getUsdtAddress(chainId);
  const payToken = data?.payToken;
  const payTokenMismatch =
    !!expectedUsdt && !!payToken && expectedUsdt.toLowerCase() !== payToken.toLowerCase();

  const isLoading = dashLoading || investorsLoading;

  return (
    <div className="relative overflow-hidden rounded-xl md:rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-950 to-black p-4 md:p-6 shadow-lg">
      <div className="absolute inset-0 opacity-5 bg-[linear-gradient(45deg,transparent_25%,rgba(168,85,247,0.1)_50%,transparent_75%)] bg-[length:20px_20px]" />

      <div className="relative space-y-5 md:space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg md:text-xl font-semibold">Funding Overview</h2>
            <p className="text-xs md:text-sm text-gray-400 mt-0.5">
              {data?.symbol ? `${data.symbol} Presale` : "Presale"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusPill}`}>
              {status.label}
            </span>
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/10 border border-purple-500/30">
              <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-purple-300" />
            </div>
          </div>
        </div>

        {payTokenMismatch && (
          <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 md:p-4">
            <AlertTriangle className="w-5 h-5 text-red-200 mt-0.5" />
            <div className="text-sm text-red-100">
              <div className="font-semibold">Payment token mismatch</div>
              <div className="text-red-200/90">
                The ICO contract payToken does not match the configured USDT address for this network. Disable buys until this is corrected.
              </div>
            </div>
          </div>
        )}

        <div className="p-4 md:p-5 bg-black/40 rounded-xl border border-slate-800 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs md:text-sm text-gray-400">Current Price</p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl md:text-3xl font-bold">
                  {isLoading || !pricePay ? "—" : `${pricePay} ${paySymbol}`}
                </span>
                <span className="text-xs text-gray-400">per token</span>
              </div>
            </div>

            <div className="px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-cyan-500/30">
              <span className="text-xs md:text-sm font-medium text-cyan-300">Fixed</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs md:text-sm text-gray-400">Total Raised</span>
            <span className="text-sm md:text-base font-semibold">
              {isLoading ? "Loading..." : `${raisedPay} ${paySymbol}`}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs md:text-sm text-gray-400">Total Tokens Sold</span>
            <span className="text-sm md:text-base font-semibold">
              {isLoading ? "Loading..." : `${totalTokensSoldHuman} ${data?.symbol ?? "TOKEN"}`}
            </span>
          </div>

          <div className="relative h-2.5 md:h-3 rounded-full bg-slate-900 overflow-hidden">
            <div
              className="absolute h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-400 transition-all duration-700"
              style={{ width: `${progress === null ? 0 : progressSafe}%` }}
            />
          </div>

          <div className="flex justify-between text-xs text-gray-400">
            <span>0</span>
            <span>{targetLabel}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:gap-4">
          <div className="p-3 md:p-4 bg-black/30 rounded-xl border border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <Target className="w-4 h-4 md:w-5 md:h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Unique Buyers</p>
                <p className="text-lg md:text-xl font-bold mt-0.5">
                  {isLoading ? "—" : investorsCount}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Recent range
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 md:p-4 bg-black/30 rounded-xl border border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Globe className="w-4 h-4 md:w-5 md:h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Network</p>
                <p className="text-lg md:text-xl font-bold mt-0.5">
                  {chainId === hardhat.id
                    ? "Hardhat"
                    : chainId === bsc.id
                      ? "BSC"
                      : chain?.name ?? "—"}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">Chain ID: {chainId}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 md:p-4 bg-gradient-to-r from-slate-900/50 to-black/50 rounded-xl border border-slate-800">
          <p className="text-xs md:text-sm text-gray-300 leading-relaxed">
            Presale closes when the hard cap is reached (USDT or tokens) or the sale window ends (if configured).
          </p>
        </div>
      </div>
    </div>
  );
}
