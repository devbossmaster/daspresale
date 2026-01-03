// app/transaction/page.tsx
"use client";

import { useMemo } from "react";
import {
  Wallet as WalletIcon,
  DollarSign,
  ShoppingBag,
  Clock,
  CheckCircle,
  ExternalLink,
} from "lucide-react";
import { useChainId, useChains } from "wagmi";
import { formatUnits } from "viem";
import { hardhat } from "wagmi/chains";

import { useMounted } from "@/lib/hooks/useMounted";
import { useRecentPurchases } from "@/lib/hooks/useRecentPurchases";
import { useTokenIcoDashboard } from "@/lib/hooks/useTokenIcoDashboard";

function shortAddr(a?: string) {
  if (!a) return "—";
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

// Safe decimal formatting without Number() precision issues
function formatDecimalStr(v?: string, maxFrac = 6) {
  if (!v) return "—";
  const [intRaw, fracRaw = ""] = v.split(".");
  const intPart = (intRaw || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = fracRaw.slice(0, maxFrac).replace(/0+$/, "");
  return frac.length ? `${intPart}.${frac}` : intPart;
}

function formatDateTimeClient(ts: number) {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  // format close to your screenshot: YYYY-MM-DD HH:mm:ss
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

export default function TransactionPage() {
  const mounted = useMounted();

  const chainId = useChainId();
  const chains = useChains();
  const chain = chains.find((c) => c.id === chainId);

  const explorerBase =
    chainId === hardhat.id ? undefined : chain?.blockExplorers?.default?.url;

  const { data: dash, isLoading: dashLoading, error: dashError } = useTokenIcoDashboard();

  // Increase limit/range on the dedicated page
  const { rows, isLoading: logsLoading, error: logsError } = useRecentPurchases({
    limit: 200,
    blockRange: 200_000n,
  });

  const tokenSymbol = dash?.symbol ?? "TOKEN";
  const tokenDecimals = dash?.decimals ?? 18;

  const paySymbol = dash?.paySymbol ?? "USDT";
  const payDecimals = dash?.payDecimals ?? 18;

  const isLoading = dashLoading || logsLoading;

  const txs = useMemo(() => {
    return rows.map((r) => {
      const paid = formatDecimalStr(formatUnits(r.amountPaid, payDecimals), 6);
      const bought = formatDecimalStr(formatUnits(r.tokensBought, tokenDecimals), 6);

      const dateTime = mounted ? formatDateTimeClient(r.timestamp) : "—";

      const txUrl = explorerBase ? `${explorerBase}/tx/${r.txHash}` : undefined;
      const addrUrl = explorerBase ? `${explorerBase}/address/${r.buyer}` : undefined;

      return {
        key: `${r.txHash}:${r.blockNumber.toString()}`,
        wallet: r.buyer,
        walletShort: shortAddr(r.buyer),
        paid,
        bought,
        dateTime,
        status: "Completed" as const,
        txUrl,
        addrUrl,
      };
    });
  }, [rows, payDecimals, tokenDecimals, explorerBase, mounted]);

  const pageError = (dashError as Error | null) || (logsError as Error | null);

  return (
    <div className="min-h-screen text-white bg-gradient-to-b from-[#140b24] via-[#06060b] to-black">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-6 sm:pt-8 pb-10">
        {/* Title */}
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
              Transaction
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-gray-400">
              Purchase History
              <span className="ml-2 text-gray-500">
                ({isLoading ? "Loading..." : `Showing ${txs.length} of ${txs.length} records`})
              </span>
            </p>
          </div>

          {/* Optional right-side links to match your screenshot style (remove if your layout already has nav) */}
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-400">
            <a className="hover:text-white transition-colors" href="#" onClick={(e) => e.preventDefault()}>
              Whitepaper
            </a>
            <a className="hover:text-white transition-colors" href="#" onClick={(e) => e.preventDefault()}>
              Linktum AI
            </a>
            <a className="hover:text-white transition-colors" href="#" onClick={(e) => e.preventDefault()}>
              Docs
            </a>
          </div>
        </div>

        {/* Error */}
        {pageError && (
          <div className="mb-5 p-3 rounded-xl border border-red-800/40 bg-red-900/20 text-sm text-red-200">
            {pageError.message}
          </div>
        )}

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-black/40 backdrop-blur-sm overflow-hidden shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
          {/* Header strip */}
          <div className="px-4 sm:px-6 py-4 border-b border-white/10">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20">
                <DollarSign className="h-4 w-4 text-fuchsia-300" />
              </span>
              <span>Purchase History</span>
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-gray-400 border-b border-white/10">
                  <th className="text-left px-6 py-4">
                    <span className="inline-flex items-center gap-2">
                      <WalletIcon className="h-4 w-4 text-gray-500" />
                      Wallet
                    </span>
                  </th>
                  <th className="text-left px-6 py-4">
                    <span className="inline-flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-gray-500" />
                      Payment
                    </span>
                  </th>
                  <th className="text-left px-6 py-4">
                    <span className="inline-flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4 text-gray-500" />
                      Bought Amount
                    </span>
                  </th>
                  <th className="text-left px-6 py-4">
                    <span className="inline-flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      Time &amp; Date
                    </span>
                  </th>
                  <th className="text-left px-6 py-4">Status</th>
                  <th className="text-left px-6 py-4">Tx</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {!isLoading && txs.length === 0 && (
                  <tr>
                    <td className="px-6 py-6 text-sm text-gray-400" colSpan={6}>
                      No purchases found in the scanned block range.
                    </td>
                  </tr>
                )}

                {txs.map((tx) => (
                  <tr key={tx.key} className="hover:bg-white/[0.03] transition-colors">
                    <td className="px-6 py-5">
                      {tx.addrUrl ? (
                        <a
                          href={tx.addrUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-fuchsia-300 hover:text-fuchsia-200 font-medium"
                        >
                          {tx.walletShort}
                        </a>
                      ) : (
                        <span className="text-fuchsia-300 font-medium">{tx.walletShort}</span>
                      )}
                    </td>

                    <td className="px-6 py-5">
                      <div className="text-sm font-semibold text-gray-200">
                        {tx.paid} {paySymbol}
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <div className="text-sm font-semibold text-gray-200">
                        {tx.bought} {tokenSymbol}
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <div className="text-sm text-gray-300">{tx.dateTime}</div>
                    </td>

                    <td className="px-6 py-5">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                        {tx.status}
                      </span>
                    </td>

                    <td className="px-6 py-5">
                      {tx.txUrl ? (
                        <a
                          href={tx.txUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200"
                        >
                          Explorer <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : (
                        <span className="text-xs text-gray-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}

                {isLoading && (
                  <tr>
                    <td className="px-6 py-6 text-sm text-gray-400" colSpan={6}>
                      Loading transactions...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden p-4 space-y-3">
            {!isLoading && txs.length === 0 && (
              <div className="p-4 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-gray-400">
                No purchases found in the scanned block range.
              </div>
            )}

            {txs.map((tx) => (
              <div key={tx.key} className="p-4 rounded-xl border border-white/10 bg-white/[0.03]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-gray-400">Wallet</div>
                    <div className="mt-1">
                      {tx.addrUrl ? (
                        <a
                          href={tx.addrUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-fuchsia-300 hover:text-fuchsia-200 font-medium"
                        >
                          {tx.walletShort}
                        </a>
                      ) : (
                        <span className="text-fuchsia-300 font-medium">{tx.walletShort}</span>
                      )}
                    </div>
                    <div className="mt-2 text-xs text-gray-400">Time &amp; Date</div>
                    <div className="mt-1 text-sm text-gray-300">{tx.dateTime}</div>
                  </div>

                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                    {tx.status}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 pt-3 border-t border-white/10">
                  <div>
                    <div className="text-xs text-gray-400">Payment</div>
                    <div className="mt-1 text-sm font-semibold text-gray-200">
                      {tx.paid} {paySymbol}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Bought</div>
                    <div className="mt-1 text-sm font-semibold text-gray-200">
                      {tx.bought} {tokenSymbol}
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  {tx.txUrl ? (
                    <a
                      href={tx.txUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-xs text-cyan-300 hover:text-cyan-200"
                    >
                      View on Explorer <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : (
                    <div className="text-xs text-gray-500">Explorer not available on local Hardhat.</div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="p-4 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-gray-400">
                Loading transactions...
              </div>
            )}
          </div>
        </div>

        {/* Small footer note */}
        <div className="mt-4 text-xs text-gray-500">
          Data is derived from on-chain <span className="text-gray-400">TokensPurchased</span> events.
        </div>
      </div>
    </div>
  );
}
