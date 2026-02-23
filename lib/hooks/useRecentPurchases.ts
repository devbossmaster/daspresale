"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function sortNewestFirst(a: { blockNumber: bigint; logIndex: bigint }, b: { blockNumber: bigint; logIndex: bigint }) {
  if (a.blockNumber === b.blockNumber) return a.logIndex > b.logIndex ? -1 : 1;
  return a.blockNumber > b.blockNumber ? -1 : 1;
}

/** Small concurrency limiter (prevents provider rate limiting) */
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>) {
  const results: R[] = [];
  let i = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  });

  await Promise.all(workers);
  return results;
}

export function useRecentPurchases(opts?: {
  limit?: number;
  blockRange?: bigint;
  /** Optional: reduce RPC churn; only refetch if block advanced by at least this many blocks. */
  minBlockDelta?: bigint;
  /** TTL for reusing the last successful result (ms). */
  ttlMs?: number;
  /**
   * Optional: filter purchases by buyer at the RPC level (FAST).
   * - If provided, we fetch only logs where buyer == this address.
   */
  buyer?: `0x${string}`;
  /**
   * Optional: if provider rejects large getLogs ranges, we fallback to chunking.
   * This defines chunk size for fallback.
   */
  fallbackChunkSize?: bigint;
  /** Timestamp fetch concurrency. */
  tsConcurrency?: number;
}) {
  const limit = opts?.limit ?? 50;
  const blockRange = opts?.blockRange ?? 500_000n;
  const minBlockDelta = opts?.minBlockDelta ?? 3n;
  const ttlMs = opts?.ttlMs ?? 25_000; // slightly faster refresh than your 30s
  const buyer = opts?.buyer;
  const fallbackChunkSize = opts?.fallbackChunkSize ?? 80_000n; // big chunks; fewer calls
  const tsConcurrency = opts?.tsConcurrency ?? 12;

  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: latestBlock } = useBlockNumber({ watch: true });

  const ico = getTokenIcoAddress(chainId);

  const [rows, setRows] = useState<PurchaseLogRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Caches / guards
  const isFetchingRef = useRef(false);
  const lastFetchedToBlockRef = useRef<bigint | null>(null);
  const lastSuccessAtRef = useRef<number>(0);
  const blockTsCacheRef = useRef<Map<bigint, number>>(new Map());

  const computeFromBlock = useCallback(
    (toBlock: bigint) => {
      if (chainId === hardhat.id) return 0n;
      if (blockRange === 0n) return toBlock;
      return toBlock > blockRange ? toBlock - blockRange : 0n;
    },
    [blockRange, chainId]
  );

  const fetchTimestamps = useCallback(
    async (blockNumbers: bigint[]) => {
      const uniqBlocks = uniq(blockNumbers);
      const missing = uniqBlocks.filter((bn) => !blockTsCacheRef.current.has(bn));
      if (!missing.length || !publicClient) return;

      // Concurrency-limited block fetch
      const results = await mapLimit(
        missing,
        tsConcurrency,
        async (bn) => {
          try {
            const block = await publicClient.getBlock({ blockNumber: bn });
            return { bn, ts: Number(block.timestamp) };
          } catch {
            return { bn, ts: 0 };
          }
        }
      );

      for (const r of results) blockTsCacheRef.current.set(r.bn, r.ts);
    },
    [publicClient, tsConcurrency]
  );

  const fetchLogsSingleRange = useCallback(
    async (fromBlock: bigint, toBlock: bigint) => {
      if (!publicClient || !ico) return [];

      // If buyer filter exists, we can filter at RPC using args when supported by viem for indexed params.
      // Many providers support this efficiently.
      return publicClient.getLogs({
        address: ico,
        event: TokensPurchasedEvent,
        fromBlock,
        toBlock,
        ...(buyer ? { args: { buyer } } : {}),
      });
    },
    [publicClient, ico, buyer]
  );

  const fetchLogsFallbackChunked = useCallback(
    async (fromBlock: bigint, toBlock: bigint) => {
      if (!publicClient || !ico) return [];

      const logsAll: any[] = [];

      // forward chunking (more cache/provider friendly than backwards)
      let cursor = fromBlock;
      while (cursor <= toBlock) {
        const end = cursor + fallbackChunkSize;
        const chunkTo = end > toBlock ? toBlock : end;

        const logs = await publicClient.getLogs({
          address: ico,
          event: TokensPurchasedEvent,
          fromBlock: cursor,
          toBlock: chunkTo,
          ...(buyer ? { args: { buyer } } : {}),
        });

        logsAll.push(...logs);

        if (chunkTo === toBlock) break;
        cursor = chunkTo + 1n;
      }

      return logsAll;
    },
    [publicClient, ico, fallbackChunkSize, buyer]
  );

  const buildRows = useCallback(
    async (logs: any[]) => {
      // Map logs => records with logIndex for stable sorting/dedupe
      const collected: Array<{
        buyer: `0x${string}`;
        amountPaid: bigint;
        tokensBought: bigint;
        txHash: `0x${string}`;
        blockNumber: bigint;
        logIndex: bigint;
      }> = [];

      for (const l of logs) {
        if (!l.blockNumber || !l.transactionHash) continue;

        const args = l.args as unknown as {
          buyer: `0x${string}`;
          amountPaid: bigint;
          tokensBought: bigint;
        };

        const logIndex =
          typeof l.logIndex === "number" ? BigInt(l.logIndex) : (l.logIndex ?? 0n);

        collected.push({
          buyer: args.buyer,
          amountPaid: args.amountPaid,
          tokensBought: args.tokensBought,
          txHash: l.transactionHash as `0x${string}`,
          blockNumber: l.blockNumber,
          logIndex,
        });
      }

      // Dedupe by txHash+logIndex (safe + stable)
      const deduped = Array.from(
        new Map(collected.map((r) => [`${r.txHash}:${r.logIndex}`, r] as const)).values()
      );

      deduped.sort(sortNewestFirst);

      const sliced = deduped.slice(0, limit);

      await fetchTimestamps(sliced.map((r) => r.blockNumber));

      const finalRows: PurchaseLogRow[] = sliced.map((r) => ({
        buyer: r.buyer,
        amountPaid: r.amountPaid,
        tokensBought: r.tokensBought,
        txHash: r.txHash,
        blockNumber: r.blockNumber,
        timestamp: blockTsCacheRef.current.get(r.blockNumber) ?? 0,
      }));

      return finalRows;
    },
    [limit, fetchTimestamps]
  );

  const fetchData = useCallback(
    async (force = false) => {
      if (!publicClient || !ico) return;
      if (isFetchingRef.current) return;

      const now = Date.now();

      // TTL guard: if we fetched recently and not forced, skip
      if (!force && lastSuccessAtRef.current && now - lastSuccessAtRef.current < ttlMs) {
        return;
      }

      const toBlock = (latestBlock ?? (await publicClient.getBlockNumber())) as bigint;
      const fromBlock = computeFromBlock(toBlock);

      // min block delta guard
      const lastTo = lastFetchedToBlockRef.current;
      if (!force && lastTo !== null && toBlock > lastTo && toBlock - lastTo < minBlockDelta) {
        return;
      }

      isFetchingRef.current = true;
      setIsLoading(true);
      setError(null);

      try {
        let logs: any[] = [];

        // Try the fast path: one getLogs call for full range
        try {
          logs = await fetchLogsSingleRange(fromBlock, toBlock);
        } catch (e) {
          // Provider may reject large ranges; fallback to chunked
          logs = await fetchLogsFallbackChunked(fromBlock, toBlock);
        }

        const nextRows = await buildRows(logs);

        // Only set if changed to reduce render churn/flicker
        setRows((prev) => {
          if (prev.length === nextRows.length) {
            let same = true;
            for (let i = 0; i < prev.length; i++) {
              if (prev[i].txHash !== nextRows[i].txHash) { same = false; break; }
            }
            if (same) return prev;
          }
          return nextRows;
        });

        lastFetchedToBlockRef.current = toBlock;
        lastSuccessAtRef.current = Date.now();
      } catch (e) {
        setError(e as Error);
        // Keep previous rows on error (do not blank UI)
      } finally {
        setIsLoading(false);
        isFetchingRef.current = false;
      }
    },
    [
      publicClient,
      ico,
      latestBlock,
      ttlMs,
      minBlockDelta,
      computeFromBlock,
      fetchLogsSingleRange,
      fetchLogsFallbackChunked,
      buildRows,
    ]
  );

  // Manual refetch
  const refetch = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  // Initial fetch
  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  // Auto refresh on new blocks, but TTL + min delta prevents spam
  useEffect(() => {
    fetchData(false);
  }, [latestBlock, fetchData]);

  const investorsCount = useMemo(() => {
    const s = new Set(rows.map((r) => r.buyer.toLowerCase()));
    return s.size;
  }, [rows]);

  return { rows, investorsCount, isLoading, error, refetch };
}
