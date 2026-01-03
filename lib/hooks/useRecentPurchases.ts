// lib/hooks/useRecentPurchases.ts
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useBlockNumber, useChainId, usePublicClient } from "wagmi";
import { parseAbiItem } from "viem";
import { hardhat } from "wagmi/chains";
import { getTokenIcoAddress } from "@/lib/contracts/addresses";

export type PurchaseLogRow = {
  buyer: `0x${string}`;
  amountPaid: bigint;
  tokensBought: bigint;
  txHash: `0x${string}`;
  blockNumber: bigint;
  timestamp: number; // seconds
};

const TokensPurchasedEvent = parseAbiItem(
  "event TokensPurchased(address indexed buyer, uint256 amountPaid, uint256 tokensBought)"
);

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

export function useRecentPurchases(opts?: {
  limit?: number;
  blockRange?: bigint;
  /** Optional: reduce RPC churn; only refetch if block advanced by at least this many blocks. */
  minBlockDelta?: bigint;
  /** Optional: internal scan window size when walking backwards through blocks. */
  scanChunkSize?: bigint;
}) {
  const limit = opts?.limit ?? 10;
  const blockRange = opts?.blockRange ?? 5_000n;
  const minBlockDelta = opts?.minBlockDelta ?? 3n;
  const scanChunkSize = opts?.scanChunkSize ?? 2_000n;

  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: latestBlock } = useBlockNumber({ watch: true });

  const ico = getTokenIcoAddress(chainId);

  const [rows, setRows] = useState<PurchaseLogRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const lastFetchedToBlockRef = useRef<bigint | null>(null);
  const blockTsCacheRef = useRef<Map<bigint, number>>(new Map());

  useEffect(() => {
    let cancelled = false;

    async function run() {
      // If dependencies missing, reset to safe UI state (prevents stale rows after chain switch)
      if (!publicClient || !ico) {
        if (!cancelled) {
          setRows([]);
          setIsLoading(false);
          setError(null);
        }
        return;
      }

      try {
        const toBlock = (latestBlock ?? (await publicClient.getBlockNumber())) as bigint;

        // Throttle: if the block hasn't advanced enough, skip
        const lastTo = lastFetchedToBlockRef.current;
        if (lastTo !== null && toBlock > lastTo && toBlock - lastTo < minBlockDelta) {
          return;
        }
        lastFetchedToBlockRef.current = toBlock;

        setIsLoading(true);
        setError(null);

        const floorFrom =
          chainId === hardhat.id
            ? 0n
            : blockRange === 0n
              ? toBlock
              : toBlock > blockRange
                ? toBlock - blockRange
                : 0n;

        // Walk backwards in chunks to avoid provider log limits and reduce RPC.
        // Stop early once we have enough logs to satisfy `limit`.
        const collected: {
          buyer: `0x${string}`;
          amountPaid: bigint;
          tokensBought: bigint;
          txHash: `0x${string}`;
          blockNumber: bigint;
          logIndex: bigint;
        }[] = [];

        let windowTo = toBlock;
        while (windowTo >= floorFrom && collected.length < limit) {
          const windowFrom =
            windowTo > scanChunkSize ? windowTo - scanChunkSize : 0n;

          const fromBlock = windowFrom < floorFrom ? floorFrom : windowFrom;

          const logs = await publicClient.getLogs({
            address: ico,
            event: TokensPurchasedEvent,
            fromBlock,
            toBlock: windowTo,
          });

          for (const l of logs) {
            if (!l.blockNumber || !l.transactionHash) continue;

            const args = l.args as unknown as {
              buyer: `0x${string}`;
              amountPaid: bigint;
              tokensBought: bigint;
            };

            const logIndex =
              typeof l.logIndex === "number"
                ? BigInt(l.logIndex)
                : (l.logIndex ?? 0n);

            collected.push({
              buyer: args.buyer,
              amountPaid: args.amountPaid,
              tokensBought: args.tokensBought,
              txHash: l.transactionHash as `0x${string}`,
              blockNumber: l.blockNumber,
              logIndex,
            });
          }

          if (fromBlock === 0n) break;
          if (windowTo <= fromBlock) break;
          windowTo = fromBlock - 1n;
        }

        // Dedupe by txHash+logIndex, sort newest-first, and slice
        const deduped = Array.from(
          new Map(collected.map((r) => [`${r.txHash}:${r.logIndex}`, r] as const)).values()
        );

        deduped.sort((a, b) => {
          if (a.blockNumber === b.blockNumber) return a.logIndex > b.logIndex ? -1 : 1;
          return a.blockNumber > b.blockNumber ? -1 : 1;
        });

        const sliced = deduped.slice(0, limit);

        // Timestamp enrichment (cache across runs)
        const uniqBlocks = uniq(sliced.map((r) => r.blockNumber));
        const missing = uniqBlocks.filter((bn) => !blockTsCacheRef.current.has(bn));

        await Promise.all(
          missing.map(async (bn) => {
            const b = await publicClient.getBlock({ blockNumber: bn });
            blockTsCacheRef.current.set(bn, Number(b.timestamp));
          })
        );

        const finalRows: PurchaseLogRow[] = sliced.map((r) => ({
          buyer: r.buyer,
          amountPaid: r.amountPaid,
          tokensBought: r.tokensBought,
          txHash: r.txHash,
          blockNumber: r.blockNumber,
          timestamp: blockTsCacheRef.current.get(r.blockNumber) ?? 0,
        }));

        if (!cancelled) setRows(finalRows);
      } catch (e) {
        if (!cancelled) setError(e as Error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [publicClient, ico, latestBlock, chainId, limit, blockRange, minBlockDelta, scanChunkSize]);

  const investorsCount = useMemo(() => {
    const s = new Set(rows.map((r) => r.buyer.toLowerCase()));
    return s.size;
  }, [rows]);

  return { rows, investorsCount, isLoading, error };
}
