// lib/hooks/useRecentTransfers.ts
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useAccount, useBlockNumber, useChainId, usePublicClient } from "wagmi";
import { parseAbiItem } from "viem";

export type TransferRow = {
  from: `0x${string}`;
  to: `0x${string}`;
  value: bigint;
  txHash: `0x${string}`;
  blockNumber: bigint;
  timestamp: number; // seconds
};

const TransferEvent = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

type Params = {
  token?: `0x${string}`;
  limit?: number;
  fromBlock?: bigint; // Changed from blockRange to fromBlock
  direction?: "sent" | "received" | "both";
  /** Optional: reduce RPC churn; only refetch if block advanced by at least this many blocks. */
  minBlockDelta?: bigint;
  /** Optional: internal scan window size when walking backwards through blocks. */
  scanChunkSize?: bigint;
};

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

export function useRecentTransfers(params: Params) {
  const token = params.token;
  const limit = params.limit ?? 10;
  const fromBlock = params.fromBlock ?? 0n; // Default to block 0 if not specified
  const direction = params.direction ?? "both";
  const minBlockDelta = params.minBlockDelta ?? 3n;
  const scanChunkSize = params.scanChunkSize ?? 20_000n; // Increased for better performance

  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: latestBlock } = useBlockNumber({ watch: true });

  const [rows, setRows] = useState<TransferRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  const lastFetchedToBlockRef = useRef<bigint | null>(null);
  const blockTsCacheRef = useRef<Map<bigint, number>>(new Map());
  const isFetchingRef = useRef(false);
  const cacheKeyRef = useRef<string>("");

  const fetchData = useCallback(async (force = false) => {
    if (!publicClient || !token || !address || isFetchingRef.current) return;

    isFetchingRef.current = true;
    const startTime = Date.now();

    try {
      const toBlock = (latestBlock ?? (await publicClient.getBlockNumber())) as bigint;
      
      // Don't fetch if toBlock is less than fromBlock (no blocks in range yet)
      if (toBlock < fromBlock) {
        console.log(`Current block ${toBlock} is before fromBlock ${fromBlock}, skipping fetch`);
        setRows([]);
        isFetchingRef.current = false;
        return;
      }

      const cacheKey = `${token}:${address}:${fromBlock}:${toBlock}:${direction}`;

      // Only refetch if forced or cache key changed or enough time passed
      const shouldRefetch = force || 
                          cacheKey !== cacheKeyRef.current ||
                          Date.now() - lastFetchTime > 30000; // 30 seconds

      if (!shouldRefetch) {
        isFetchingRef.current = false;
        return;
      }

      // Throttle: if the block hasn't advanced enough, skip
      const lastTo = lastFetchedToBlockRef.current;
      if (lastTo !== null && toBlock > lastTo && toBlock - lastTo < minBlockDelta && !force) {
        isFetchingRef.current = false;
        return;
      }

      setIsLoading(true);
      setError(null);
      cacheKeyRef.current = cacheKey;

      console.log(`Fetching transfers from block ${fromBlock} to ${toBlock} (range: ${toBlock - fromBlock} blocks)`);

      // Walk forward in chunks from starting block to current block
      const collected: Array<{
        from: `0x${string}`;
        to: `0x${string}`;
        value: bigint;
        txHash: `0x${string}`;
        blockNumber: bigint;
        logIndex: bigint;
      }> = [];

      const userAddress = address.toLowerCase() as `0x${string}`;
      const totalRange = toBlock - fromBlock;
      
      // Adjust chunk size based on total range for better performance
      let dynamicChunkSize = scanChunkSize;
      if (totalRange > 1000000n) {
        dynamicChunkSize = 100000n; // Larger chunks for very large ranges
      } else if (totalRange > 200000n) {
        dynamicChunkSize = 50000n;
      }

      let currentFrom = fromBlock;
      while (currentFrom <= toBlock) {
        const windowTo = currentFrom + dynamicChunkSize > toBlock ? toBlock : currentFrom + dynamicChunkSize;

        try {
          const logs = await publicClient.getLogs({
            address: token,
            event: TransferEvent,
            fromBlock: currentFrom,
            toBlock: windowTo,
          });

          console.log(`Found ${logs.length} transfer logs in blocks ${currentFrom} to ${windowTo}`);

          for (const l of logs) {
            if (!l.blockNumber || !l.transactionHash) continue;

            const args = l.args as unknown as {
              from: `0x${string}`;
              to: `0x${string}`;
              value: bigint;
            };

            // Filter by direction
            const isSent = args.from.toLowerCase() === userAddress;
            const isReceived = args.to.toLowerCase() === userAddress;
            
            if (direction === "sent" && !isSent) continue;
            if (direction === "received" && !isReceived) continue;
            if (direction === "both" && !isSent && !isReceived) continue;

            const logIndex =
              typeof l.logIndex === "number"
                ? BigInt(l.logIndex)
                : (l.logIndex ?? 0n);

            collected.push({
              from: args.from,
              to: args.to,
              value: args.value,
              txHash: l.transactionHash as `0x${string}`,
              blockNumber: l.blockNumber,
              logIndex,
            });
          }
        } catch (chunkError: any) {
          console.warn(`Failed to fetch logs for blocks ${currentFrom}-${windowTo}:`, chunkError);
          
          // If we get a "block range too wide" error, try smaller chunks
          if (chunkError.message?.includes("block range") || chunkError.message?.includes("too wide")) {
            dynamicChunkSize = dynamicChunkSize / 2n;
            if (dynamicChunkSize < 1000n) dynamicChunkSize = 1000n;
            console.log(`Reducing chunk size to ${dynamicChunkSize} due to range error`);
            continue; // Retry same range with smaller chunk
          }
          
          // Continue with next chunk for other errors
        }

        // Move to next chunk
        currentFrom = windowTo + 1n;
        
        // Small delay between chunks to avoid rate limiting
        if (currentFrom <= toBlock) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      // Dedupe by txHash+logIndex, sort newest-first
      const deduped = Array.from(
        new Map(collected.map((r) => [`${r.txHash}:${r.logIndex}`, r] as const)).values()
      );

      deduped.sort((a, b) => {
        if (a.blockNumber === b.blockNumber) return a.logIndex > b.logIndex ? -1 : 1;
        return a.blockNumber > b.blockNumber ? -1 : 1;
      });

      // Take limit
      const sliced = deduped.slice(0, limit);

      console.log(`Total unique transfers: ${deduped.length}, after limit: ${sliced.length}`);

      // Timestamp enrichment with caching and batch fetching
      const uniqBlocks = uniq(sliced.map((r) => r.blockNumber));
      const missingBlocks = uniqBlocks.filter((bn) => !blockTsCacheRef.current.has(bn));

      if (missingBlocks.length > 0) {
        console.log(`Fetching timestamps for ${missingBlocks.length} blocks`);
        
        // Fetch blocks in batches to avoid rate limits
        const batchSize = 50;
        for (let i = 0; i < missingBlocks.length; i += batchSize) {
          const batch = missingBlocks.slice(i, i + batchSize);
          const blockPromises = batch.map(async (bn) => {
            try {
              const block = await publicClient.getBlock({ blockNumber: bn });
              return { bn, timestamp: Number(block.timestamp) };
            } catch (err) {
              console.warn(`Failed to fetch block ${bn}:`, err);
              return { bn, timestamp: 0 };
            }
          });

          const results = await Promise.all(blockPromises);
          results.forEach(({ bn, timestamp }) => {
            blockTsCacheRef.current.set(bn, timestamp);
          });
          
          // Small delay between batches to avoid rate limiting
          if (i + batchSize < missingBlocks.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }

      const finalRows: TransferRow[] = sliced.map((r) => ({
        from: r.from,
        to: r.to,
        value: r.value,
        txHash: r.txHash,
        blockNumber: r.blockNumber,
        timestamp: blockTsCacheRef.current.get(r.blockNumber) ?? 0,
      }));

      setRows(finalRows);
      lastFetchedToBlockRef.current = toBlock;
      setLastFetchTime(Date.now());
      
      console.log(`Transfer fetch completed in ${Date.now() - startTime}ms, found ${finalRows.length} transfers, searched ${toBlock - fromBlock} blocks`);

    } catch (e) {
      console.error("Error in useRecentTransfers:", e);
      setError(e as Error);
      
      // Keep existing rows if we have them (don't clear on error)
      if (rows.length === 0) {
        setRows([]);
      }
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [publicClient, token, address, latestBlock, chainId, limit, fromBlock, minBlockDelta, scanChunkSize, direction, rows.length, lastFetchTime]);

  // Manual refetch function
  const refetch = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  // Initial fetch on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Cache for 30 seconds before auto-refetching on block change
  useEffect(() => {
    if (!isFetchingRef.current && Date.now() - lastFetchTime > 30000) {
      fetchData();
    }
  }, [latestBlock, fetchData, lastFetchTime]);

  // Calculate statistics
  const totalTransfers = useMemo(() => rows.length, [rows]);
  
  const sentCount = useMemo(() => {
    if (!address) return 0;
    const userAddr = address.toLowerCase();
    return rows.filter(r => r.from.toLowerCase() === userAddr).length;
  }, [rows, address]);
  
  const receivedCount = useMemo(() => {
    if (!address) return 0;
    const userAddr = address.toLowerCase();
    return rows.filter(r => r.to.toLowerCase() === userAddr).length;
  }, [rows, address]);
  
  const totalValue = useMemo(() => {
    if (!address) return 0n;
    const userAddr = address.toLowerCase();
    return rows.reduce((sum, r) => {
      if (r.from.toLowerCase() === userAddr) {
        return sum - r.value; // Sent (negative)
      } else if (r.to.toLowerCase() === userAddr) {
        return sum + r.value; // Received (positive)
      }
      return sum;
    }, 0n);
  }, [rows, address]);

  // Return refetch function and additional stats
  return { 
    rows, 
    totalTransfers, 
    sentCount, 
    receivedCount, 
    totalValue,
    isLoading, 
    error, 
    refetch 
  };
}