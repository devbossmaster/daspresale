"use client";

import { useMemo } from "react";
import { useAccount, useChainId, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { tokenIcoAbi } from "@/lib/contracts/abi/tokenIcoAbi";
import { erc20Abi } from "@/lib/contracts/abi/erc20Abi";
import { getTokenIcoAddress } from "@/lib/contracts/addresses";
import { fmtNum } from "@/lib/utils/format";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as const;
function isZeroAddress(a?: `0x${string}`) {
  return !a || a.toLowerCase() === ZERO_ADDR;
}

type GetContractInfoReturn = readonly [
  `0x${string}`, // tokenAddr
  string, // symbol
  number, // tokenDecimals (uint8)
  bigint, // price
  bigint, // tokensRemaining
  bigint // usdtRaised
];

type GetPresaleSettingsReturn = readonly [
  boolean, // paused
  bigint, // start (uint64)
  bigint, // end (uint64)
  bigint, // hardCapUSDT
  bigint, // hardCapTokens
  bigint, // minBuyUSDT
  bigint, // maxBuyUSDT
  bigint // totalTokensSold
];

function safeTs(v: bigint) {
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  return v > max ? 0 : Number(v);
}

export function useTokenIcoDashboard() {
  const chainId = useChainId();
  const ico = getTokenIcoAddress(chainId);
  const { address: user } = useAccount();

  const contractInfo = useReadContract({
    address: ico,
    abi: tokenIcoAbi,
    functionName: "getContractInfo",
    query: { enabled: !!ico, refetchInterval: 8_000 },
  });

  const presaleSettings = useReadContract({
    address: ico,
    abi: tokenIcoAbi,
    functionName: "getPresaleSettings",
    query: { enabled: !!ico, refetchInterval: 8_000 },
  });

  const payTokenRead = useReadContract({
    address: ico,
    abi: tokenIcoAbi,
    functionName: "payToken",
    query: { enabled: !!ico, refetchInterval: 60_000 },
  });

  const payDecimalsRead = useReadContract({
    address: ico,
    abi: tokenIcoAbi,
    functionName: "payDecimals",
    query: { enabled: !!ico, refetchInterval: 60_000 },
  });

  const payTokenAddr = (payTokenRead.data as `0x${string}` | undefined) ?? undefined;

  const paySymbolRead = useReadContract({
    address: !isZeroAddress(payTokenAddr) ? payTokenAddr : undefined,
    abi: erc20Abi,
    functionName: "symbol",
    query: { enabled: !!payTokenAddr && !isZeroAddress(payTokenAddr), refetchInterval: 60_000 },
  });

  // Parse dashboard data from ICO contract reads
  const parsed = useMemo(() => {
    const ci = contractInfo.data as GetContractInfoReturn | undefined;
    const ps = presaleSettings.data as GetPresaleSettingsReturn | undefined;

    if (!ico || !ci || !ps) return null;

    const [tokenAddr, symbol, tokenDecimalsRaw, tokenPrice, tokensRemaining, usdtRaised] = ci;
    const [paused, start, end, hardCapUSDT, hardCapTokens, minBuyUSDT, maxBuyUSDT, totalTokensSold] = ps;

    const decimals = Number(tokenDecimalsRaw ?? 18);

    const payDecimalsRaw = payDecimalsRead.data as number | undefined;
    const payDecimals = payDecimalsRaw !== undefined ? Number(payDecimalsRaw) : 18;

    const payToken = payTokenAddr;
    const paySymbol = (paySymbolRead.data as string | undefined) ?? "USDT";

    const priceUsdt = tokenPrice ? formatUnits(tokenPrice, payDecimals) : "0";
    const usdtRaisedHuman = formatUnits(usdtRaised ?? 0n, payDecimals);
    const tokensRemainingHuman = formatUnits(tokensRemaining ?? 0n, decimals);
    const totalTokensSoldHuman = formatUnits(totalTokensSold ?? 0n, decimals);

    // Progress: prefer explicit caps; fallback to sold / (sold + remaining)
    let progressPct: number | null = null;

    if (hardCapTokens > 0n) {
      progressPct = Math.min(100, Number((totalTokensSold * 10000n) / hardCapTokens) / 100);
    } else if (hardCapUSDT > 0n) {
      progressPct = Math.min(100, Number((usdtRaised * 10000n) / hardCapUSDT) / 100);
    } else {
      const impliedCap = totalTokensSold + tokensRemaining;
      if (impliedCap > 0n) {
        progressPct = Math.min(100, Number((totalTokensSold * 10000n) / impliedCap) / 100);
      }
    }

    return {
      ico,

      // sale token
      tokenAddr,
      symbol,
      decimals,

      // pay token
      payToken,
      paySymbol,
      payDecimals,

      // sale state
      paused,
      start: safeTs(start),
      end: safeTs(end),

      // economics
      tokenPrice,
      priceUsdt,
      usdtRaised,
      usdtRaisedHuman,
      tokensRemaining,
      tokensRemainingHuman,

      // limits/caps
      hardCapUSDT,
      hardCapTokens,
      minBuyUSDT,
      maxBuyUSDT,

      // totals
      totalTokensSold,
      totalTokensSoldHuman,

      progressPct,
    };
  }, [
    ico,
    contractInfo.data,
    presaleSettings.data,
    payTokenAddr,
    payDecimalsRead.data,
    paySymbolRead.data,
  ]);

  // FIX #1: Read user's SALE TOKEN balance correctly (tokenAddr + enabled)
  const saleTokenAddr = parsed?.tokenAddr;

  const userTokenBalance = useReadContract({
    address: saleTokenAddr,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: user ? [user] : undefined,
    query: {
      enabled: !!user && !!saleTokenAddr && !isZeroAddress(saleTokenAddr),
      refetchInterval: 8_000,
    },
  });

  const userBalHuman = useMemo(() => {
    if (!parsed) return "—";
    if (userTokenBalance.data === undefined) return "—";
    return fmtNum(formatUnits(userTokenBalance.data as bigint, parsed.decimals), 1);
  }, [userTokenBalance.data, parsed]);

  // Combined refetch function
  const refetchAll = async () => {
    const results = await Promise.allSettled([
      contractInfo.refetch(),
      presaleSettings.refetch(),
      payTokenRead.refetch(),
      payDecimalsRead.refetch(),
      paySymbolRead.refetch(),
      userTokenBalance.refetch(),
    ]);

    const errors = results.filter((r) => r.status === "rejected");
    if (errors.length > 0) {
      console.error("Refetch errors:", errors);
    }

    return results;
  };

  return {
    ico,
    isLoading:
      contractInfo.isLoading ||
      presaleSettings.isLoading ||
      payTokenRead.isLoading ||
      payDecimalsRead.isLoading ||
      paySymbolRead.isLoading ||
      userTokenBalance.isLoading,
    error:
      contractInfo.error ||
      presaleSettings.error ||
      payTokenRead.error ||
      payDecimalsRead.error ||
      paySymbolRead.error ||
      userTokenBalance.error,
    data: parsed,
    userBalHuman,
    refetch: refetchAll,
  };
}
