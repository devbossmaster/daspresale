"use client";

import { useMemo } from "react";
import { CheckCircle, ExternalLink, Clock, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { useAccount, useChainId, useChains } from "wagmi";
import { formatUnits, isAddress } from "viem";
import { erc20Abi } from "@/lib/contracts/abi/erc20Abi";
import { useReadContract } from "wagmi";
import { useRecentTransfers } from "@/lib/hooks/useRecentTransfers";
import { useTokenIcoDashboard } from "@/lib/hooks/useTokenIcoDashboard";
import { hardhat } from "wagmi/chains";
import { useMounted } from "@/lib/hooks/useMounted";

function asAddress(v?: string): `0x${string}` | undefined {
  if (!v) return undefined;
  return /^0x[a-fA-F0-9]{40}$/.test(v) ? (v as `0x${string}`) : undefined;
}

// IMPORTANT: static env access (Next can inline these)
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

function formatDateClient(ts: number) {
  if (!ts) return { date: "—", time: "—" };
  const d = new Date(ts * 1000);
  return {
    date: d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric" }),
    time: d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  };
}

export default function RecentTransfers() {
  const mounted = useMounted();
  const { address } = useAccount();

  const chainId = useChainId();
  const chains = useChains();
  const chain = chains.find((c) => c.id === chainId);

  const explorerBase =
    chainId === hardhat.id ? undefined : chain?.blockExplorers?.default?.url;

  const { data: dash } = useTokenIcoDashboard();

  // Choose token: env override > presale token
  const tokenAddr =
    (ENV_TOKEN && isAddress(ENV_TOKEN) ? ENV_TOKEN : dash?.tokenAddr) as
      | `0x${string}`
      | undefined;

  const tokenIsValid = !!tokenAddr && isAddress(tokenAddr);

  const tokenSymbol = useReadContract({
    address: tokenIsValid ? tokenAddr : undefined,
    abi: erc20Abi,
    functionName: "symbol",
    query: { enabled: tokenIsValid, refetchInterval: 30_000 },
  });

  const tokenDecimals = useReadContract({
    address: tokenIsValid ? tokenAddr : undefined,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: tokenIsValid, refetchInterval: 30_000 },
  });

  const symbol = (tokenSymbol.data ?? dash?.symbol ?? "TOKEN") as string;
  const decimals = (tokenDecimals.data ?? dash?.decimals ?? 18) as number;

  const { rows, totalTransfers, isLoading, error } = useRecentTransfers({
    token: tokenIsValid ? tokenAddr : undefined,
    limit: 10,
    direction: "both",
  });

  const transfers = useMemo(() => {
    const me = address?.toLowerCase();
    return rows.map((r) => {
      const isSent = me ? r.from.toLowerCase() === me : false;
      const counterparty = isSent ? r.to : r.from;

      const { date, time } = mounted ? formatDateClient(r.timestamp) : { date: "—", time: "—" };
      const amount = formatDecimalStr(formatUnits(r.value, decimals), 6);
      const txUrl = explorerBase ? `${explorerBase}/tx/${r.txHash}` : undefined;

      return {
        key: `${r.txHash}:${r.blockNumber.toString()}`,
        direction: isSent ? ("sent" as const) : ("received" as const),
        counterparty,
        counterpartyShort: shortAddr(counterparty),
        date,
        time,
        status: "Confirmed" as const,
        amount,
        txUrl,
        txHash: r.txHash,
      };
    });
  }, [rows, address, decimals, explorerBase, mounted]);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 sm:p-6 lg:p-8">
      <div className="flex items-start sm:items-center gap-3 mb-6 sm:mb-8">
        <div className="p-2 bg-orange-900/30 rounded-lg">
          <Clock className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Recent Transfers</h2>
          <p className="text-gray-400 text-xs sm:text-sm">
            {isLoading ? "Loading..." : `Latest ${transfers.length} transfers`}
          </p>
        </div>
      </div>

      {!tokenIsValid && (
        <div className="mb-5 p-3 rounded-xl border border-amber-800/40 bg-amber-900/20 text-sm text-amber-200">
          Token address is not available on this network.
        </div>
      )}

      {error && (
        <div className="mb-5 p-3 rounded-xl border border-red-800/40 bg-red-900/20 text-sm text-red-200">
          {error.message}
        </div>
      )}

      <div className="space-y-4 sm:space-y-6">
        {transfers.length === 0 && !isLoading && (
          <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/60 text-sm text-gray-400">
            No transfers found yet.
          </div>
        )}

        {transfers.map((t) => (
          <div key={t.key} className="p-4 sm:p-5 bg-gray-800/30 rounded-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-500" />
                <span className="text-sm sm:text-base font-bold">{symbol}</span>

                <span className="ml-2 inline-flex items-center gap-1 text-xs text-gray-400">
                  {t.direction === "sent" ? (
                    <>
                      <ArrowUpRight className="w-3.5 h-3.5 text-cyan-300" />
                      Sent
                    </>
                  ) : (
                    <>
                      <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-300" />
                      Received
                    </>
                  )}
                </span>
              </div>

              <div className="text-xs sm:text-sm text-gray-400">{t.time}</div>
            </div>

            <div className="mb-3">
              <div className="flex items-center gap-2">
                <div className="text-xs sm:text-sm text-gray-400">
                  {t.direction === "sent" ? "To:" : "From:"}
                </div>
                <div className="font-mono text-xs sm:text-sm break-all">{t.counterpartyShort}</div>

                {t.txUrl ? (
                  <a
                    className="p-1 hover:bg-gray-700 rounded"
                    href={t.txUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="View transaction on explorer"
                  >
                    <ExternalLink className="w-3 h-3 text-gray-400" />
                  </a>
                ) : (
                  <span className="text-xs text-gray-600">(no explorer)</span>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-xs sm:text-sm text-gray-400">{t.date}</div>
              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs sm:text-sm text-green-400 bg-green-900/20">
                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="font-medium">{t.status}</span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-700">
              <div className="text-lg sm:text-xl font-bold text-cyan-300">
                {t.amount} {symbol}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-800">
        <div className="space-y-3 text-xs sm:text-sm text-gray-400">
          <div className="flex items-center justify-between">
            <span>Total Transfers (shown)</span>
            <span className="font-bold text-gray-200">{totalTransfers}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Network</span>
            <span className="text-green-400">{chain?.name ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Gas Fee</span>
            <span className="text-gray-200">Paid in native gas token</span>
          </div>
        </div>
      </div>
    </div>
  );
}
