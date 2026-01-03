"use client";

import { useMemo } from "react";
import { History, CheckCircle, ExternalLink, User } from "lucide-react";
import { useChainId, useChains } from "wagmi";
import { formatUnits } from "viem";
import { useTokenIcoDashboard } from "@/lib/hooks/useTokenIcoDashboard";
import { useRecentPurchases } from "@/lib/hooks/useRecentPurchases";
import { useMounted } from "@/lib/hooks/useMounted";
import { hardhat } from "wagmi/chains";

function shortAddr(a: string) {
  return a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "—";
}

function formatDecimalStr(v?: string, maxFrac = 4) {
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
    date: d.toLocaleString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" }),
    time: d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  };
}

export default function RecentTransactions() {
  const mounted = useMounted();
  const { data: dash, error: dashError } = useTokenIcoDashboard();
  const { rows, isLoading, error: logsError } = useRecentPurchases({ limit: 10, blockRange: 50_000n });

  const tokenSymbol = dash?.symbol ?? "TOKEN";
  const tokenDecimals = dash?.decimals ?? 18;
  const paySymbol = dash?.paySymbol ?? "USDT";
  const payDecimals = dash?.payDecimals ?? 18;

  const chainId = useChainId();
  const chains = useChains();
  const chain = chains.find((c) => c.id === chainId);

  const explorerBase =
    chainId === hardhat.id ? undefined : chain?.blockExplorers?.default?.url;

  const txs = useMemo(() => {
    return rows.map((r) => {
      const { date, time } = mounted ? formatDateClient(r.timestamp) : { date: "—", time: "—" };

      return {
        date: `${date} ${time}`,
        buyerShort: shortAddr(r.buyer),
        paid: `${formatDecimalStr(formatUnits(r.amountPaid, payDecimals), 4)} ${paySymbol}`,
        tokens: `${formatDecimalStr(formatUnits(r.tokensBought, tokenDecimals), 4)} ${tokenSymbol}`,
        status: "Complete",
        txUrl: explorerBase ? `${explorerBase}/tx/${r.txHash}` : undefined,
        txHash: r.txHash,
      };
    });
  }, [rows, tokenDecimals, tokenSymbol, payDecimals, paySymbol, explorerBase, mounted]);

  const totals = useMemo(() => {
    const totalTx = txs.length;
    const volTokens = rows.reduce((acc, r) => acc + r.tokensBought, 0n);
    return {
      totalTx,
      volTokensHuman: formatDecimalStr(formatUnits(volTokens, tokenDecimals), 4),
    };
  }, [txs.length, rows, tokenDecimals]);

  const readError = dashError || logsError;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-start sm:items-center gap-3 mb-6 sm:mb-8">
        <div className="p-2 bg-orange-900/30 rounded-lg">
          <History className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Recent Transactions</h2>
          <p className="text-gray-400 text-xs sm:text-sm">Latest on-chain purchases</p>
        </div>
      </div>

      {readError && (
        <div className="mb-5 p-3 rounded-xl border border-red-800/40 bg-red-900/20 text-sm text-red-200">
          {readError.message}
        </div>
      )}

      {/* Mobile: card list */}
      <div className="space-y-4 sm:hidden">
        {!isLoading && txs.length === 0 && (
          <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/60 text-sm text-gray-400">
            No purchases found yet.
          </div>
        )}

        {txs.map((tx) => (
          <div key={tx.txHash} className="p-4 rounded-xl border border-gray-800 bg-gray-900/60">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-xs text-gray-400">{tx.date}</div>
                <div className="mt-1 text-sm font-medium flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  {tx.buyerShort}
                </div>
              </div>

              <div className="flex items-center gap-1 rounded-full bg-green-900/20 px-2 py-1 text-[11px] text-green-400">
                <CheckCircle className="w-3 h-3" />
                <span>{tx.status}</span>
              </div>
            </div>

            <div className="mt-2 text-sm font-semibold text-cyan-300">{tx.tokens}</div>
            <div className="mt-1 text-sm text-purple-300">Paid: {tx.paid}</div>

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
              <div className="mt-3 text-xs text-gray-500">Explorer not available on this network.</div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop / Tablet: table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left p-3 text-xs sm:text-sm font-semibold text-gray-400">Date</th>
              <th className="text-left p-3 text-xs sm:text-sm font-semibold text-gray-400">Buyer</th>
              <th className="text-left p-3 text-xs sm:text-sm font-semibold text-gray-400">Tokens</th>
              <th className="text-left p-3 text-xs sm:text-sm font-semibold text-gray-400">Paid</th>
              <th className="text-left p-3 text-xs sm:text-sm font-semibold text-gray-400">Status</th>
              <th className="text-left p-3 text-xs sm:text-sm font-semibold text-gray-400">Tx</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-800">
            {!isLoading && txs.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-sm text-gray-400">
                  No purchases found yet.
                </td>
              </tr>
            )}

            {txs.map((tx) => (
              <tr key={tx.txHash} className="hover:bg-gray-800/30 transition-colors">
                <td className="p-3 text-gray-300 text-sm">{tx.date}</td>
                <td className="p-3 text-sm text-gray-200">{tx.buyerShort}</td>
                <td className="p-3 text-sm font-bold text-cyan-300">{tx.tokens}</td>
                <td className="p-3 text-sm text-purple-300">{tx.paid}</td>
                <td className="p-3 text-sm">
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="w-4 h-4" />
                    <span>{tx.status}</span>
                  </div>
                </td>
                <td className="p-3 text-sm">
                  {tx.txUrl ? (
                    <a
                      href={tx.txUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-cyan-300 hover:text-cyan-200"
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

      {/* Additional Info */}
      <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-800">
        <div className="text-xs sm:text-sm text-gray-400 space-y-2">
          <div className="flex justify-between">
            <span>Transactions Shown</span>
            <span className="font-semibold">{isLoading ? "—" : totals.totalTx}</span>
          </div>
          <div className="flex justify-between">
            <span>Volume (shown)</span>
            <span className="font-semibold text-cyan-300">
              {isLoading ? "—" : `${totals.volTokensHuman} ${tokenSymbol}`}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Network</span>
            <span className="text-green-400">{chain?.name ?? "—"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
