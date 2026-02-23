"use client";

import Link from "next/link";
import RaisedFunds from "@/components/dashboard/RaisedFunds";
import { useAccount, useChainId } from "wagmi";
import { bsc } from "wagmi/chains";
import { getTokenIcoAddress } from "@/lib/contracts/addresses";
import TokenStats from "@/components/dashboard/TokenStats";

export default function DashboardPage() {
  const chainId = useChainId();
  const { isConnected } = useAccount();

  const onBsc = chainId === bsc.id;
  const ico = onBsc ? getTokenIcoAddress(chainId) : undefined;
  const canUseApp = isConnected && onBsc && !!ico;

  return (
    <div className="space-y-6 md:space-y-8 lg:space-y-10 px-4 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between pt-4 sm:pt-6">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">
              Dashboard
            </h1>

            {!onBsc && (
              <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300">
                Switch to BSC
              </span>
            )}

            {onBsc && !ico && (
              <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-200">
                ICO address not configured
              </span>
            )}
          </div>

          <p className="text-sm md:text-base text-gray-400">
            Overview of your token holdings and recent presale activity
          </p>

          {!isConnected && (
            <p className="text-xs md:text-sm text-gray-500">
              Connect your wallet to see your balances and activity.
            </p>
          )}
        </div>

        <div className="mt-2 sm:mt-0">
          <Link
            href="/token-sale"
            aria-disabled={!canUseApp}
            tabIndex={!canUseApp ? -1 : 0}
            className={[
              "inline-flex w-full sm:w-auto items-center justify-center px-4 py-2.5",
              "bg-gradient-to-r from-cyan-500 to-blue-600",
              "hover:from-cyan-600 hover:to-blue-700",
              "text-white font-medium rounded-lg transition-all duration-200 text-sm md:text-base",
              !canUseApp ? "pointer-events-none opacity-50" : "",
            ].join(" ")}
          >
            Buy Tokens
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6">
        <div className="lg:col-span-2">
          <TokenStats />
        </div>
        <div className="lg:col-span-1">
          <RaisedFunds />
        </div>
      </div>

    </div>
  );
}
