// components/dashboard/TransactionHistory.tsx
"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useChains, useChainId } from "wagmi";
import { hardhat } from "wagmi/chains";
import { formatUnits } from "viem";
import { CheckCircle, ExternalLink, User } from "lucide-react";

import { useMounted } from "@/lib/hooks/useMounted";
import { useRecentPurchases } from "@/lib/hooks/useRecentPurchases";
import { useTokenIcoDashboard } from "@/lib/hooks/useTokenIcoDashboard";
import { getTokenIcoAddress } from "@/lib/contracts/addresses";

function shortAddr(addr: `0x${string}`) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function trimDecimals(value: string, max: number) {
  if (!value.includes(".")) return value;
  const [i, f] = value.split(".");
  return `${i}.${f.slice(0, max)}`.replace(/\.?0+$/, "");
}

function formatDateClient(ts: number) {
  if (!ts) return { date: "—", time: "—" };
  const d = new Date(ts * 1000);
  return {
    date: d.toLocaleString(undefined, { month: "short", day: "numeric" }),
    time: d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  };
}

export default function TransactionHistory() {
  const mounted = useMounted();
  const chainId = useChainId();
  const chains = useChains();
  const chain = chains.find((c) => c.id === chainId);

  const ico = getTokenIcoAddress(chainId);
  const { data: dash } = useTokenIcoDashboard();

  const { rows, isLoading, error } = useRecentPurchases({ limit: 10 });

  const tokenDecimals = dash?.decimals ?? 18;
  const tokenSymbol = dash?.symbol ?? "TOKEN";
  const payDecimals = dash?.payDecimals ?? 18;
  const paySymbol = dash?.paySymbol ?? "USDT";

  // Hardhat has no real explorer
  const explorerBase = chainId === hardhat.id ? undefined : chain?.blockExplorers?.default?.url;
  const contractUrl = explorerBase && ico ? `${explorerBase}/address/${ico}` : undefined;

  const txs = useMemo(() => {
    return rows.map((r) => {
      const { date, time } = mounted ? formatDateClient(r.timestamp) : { date: "—", time: "—" };

      return {
        wallet: shortAddr(r.buyer),
        amountTokens: trimDecimals(formatUnits(r.tokensBought, tokenDecimals), 4),
        amountPaid: trimDecimals(formatUnits(r.amountPaid, payDecimals), 4),
        date,
        time,
        txHash: r.txHash,
        txUrl: explorerBase ? `${explorerBase}/tx/${r.txHash}` : undefined,
      };
    });
  }, [rows, mounted, tokenDecimals, payDecimals, explorerBase]);

  return (
    <div className="relative overflow-hidden rounded-xl md:rounded-2xl border border-slate-800 bg-gradient-to-b from-black to-slate-950 shadow-lg">
      <div className="p-4 md:p-6 border-b border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg md:text-xl font-semibold">Recent Purchases</h2>
            <p className="text-xs md:text-sm text-gray-400 mt-1">
              {isLoading ? "Loading..." : `Showing last ${txs.length} purchases`}
            </p>
          </div>

          {contractUrl ? (
            <a
              href={contractUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 rounded-lg border border-cyan-500/30 transition-all duration-200 text-sm font-medium w-full sm:w-auto"
            >
              View Contract
              <ExternalLink className="w-4 h-4" />
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-500/10 text-cyan-300 rounded-lg border border-cyan-500/30 opacity-50 cursor-not-allowed text-sm font-medium w-full sm:w-auto"
            >
              View Contract
              <ExternalLink className="w-4 h-4" />
            </button>
          )}
        </div>

        {!ico && (
          <div className="mt-4 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-sm text-amber-200">
            ICO address not configured for this network. Purchases cannot be queried.
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-200">
            {error.message}
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3 p-4">
        {!isLoading && !error && txs.length === 0 && (
          <div className="p-4 bg-black/30 rounded-xl border border-slate-800 text-sm text-gray-400">
            No purchases found yet.
          </div>
        )}

        {txs.map((tx) => (
          <div key={tx.txHash} className="p-4 bg-black/30 rounded-xl border border-slate-800">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/10 to-purple-500/20">
                  <User className="w-4 h-4 text-gray-300" />
                </div>
                <div>
                  <p className="text-sm font-medium">{tx.wallet}</p>
                  <p className="text-xs text-gray-400">
                    {tx.date} • {tx.time}
                  </p>
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <CheckCircle className="w-3 h-3" />
                Completed
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-800/50">
              <div>
                <p className="text-xs text-gray-400">Tokens</p>
                <p className="text-base font-bold text-cyan-300">
                  {tx.amountTokens} {tokenSymbol}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Paid</p>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 mt-1 rounded-full bg-purple-500/10 text-purple-300 text-xs">
                  {tx.amountPaid} {paySymbol}
                </div>
              </div>
            </div>

            {tx.txUrl ? (
              <a
                href={tx.txUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-2 text-xs text-cyan-300 hover:text-cyan-200"
              >
                View on Explorer <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <div className="mt-3 text-xs text-gray-500">
                Explorer not available on local Hardhat.
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left p-4 text-sm font-medium text-gray-300">Wallet</th>
              <th className="text-left p-4 text-sm font-medium text-gray-300">Paid</th>
              <th className="text-left p-4 text-sm font-medium text-gray-300">Tokens</th>
              <th className="text-left p-4 text-sm font-medium text-gray-300">Time & Date</th>
              <th className="text-left p-4 text-sm font-medium text-gray-300">Status</th>
              <th className="text-left p-4 text-sm font-medium text-gray-300">Tx</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800">
            {!isLoading && !error && txs.length === 0 && (
              <tr>
                <td className="p-4 text-sm text-gray-400" colSpan={6}>
                  No purchases found yet.
                </td>
              </tr>
            )}

            {txs.map((tx) => (
              <tr key={tx.txHash} className="hover:bg-slate-900/30 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/10 to-purple-500/20">
                      <User className="w-4 h-4 text-gray-300" />
                    </div>
                    <span className="font-medium">{tx.wallet}</span>
                  </div>
                </td>

                <td className="p-4">
                  <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-purple-500/10 text-purple-300 text-sm font-medium">
                    {tx.amountPaid} {paySymbol}
                  </div>
                </td>

                <td className="p-4">
                  <div className="text-base font-bold text-cyan-300">
                    {tx.amountTokens} {tokenSymbol}
                  </div>
                </td>

                <td className="p-4 text-gray-300">
                  <div>
                    <div className="font-medium">{tx.date}</div>
                    <div className="text-xs text-gray-400">{tx.time}</div>
                  </div>
                </td>

                <td className="p-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle className="w-4 h-4" />
                    Completed
                  </div>
                </td>

                <td className="p-4">
                  {tx.txUrl ? (
                    <a
                      href={tx.txUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200"
                    >
                      Explorer <ExternalLink className="w-4 h-4" />
                    </a>
                  ) : (
                    <span className="text-xs text-gray-500">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {isLoading && <div className="p-4 text-sm text-gray-400">Loading transactions...</div>}
      </div>
    </div>
  );
}
