// lib/hooks/useRecentTransfers.ts
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useBlockNumber, useChainId, usePublicClient } from "wagmi";
import { hardhat } from "wagmi/chains";
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
  blockRange?: bigint;
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
  const blockRange = params.blockRange ?? 10_000n;
  const direction = params.direction ?? "both";
  const minBlockDelta = params.minBlockDelta ?? 3n;
  const scanChunkSize = params.scanChunkSize ?? 2_000n;

  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: latestBlock } = useBlockNumber({ watch: true });

  const [rows, setRows] = useState<TransferRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const lastFetchedToBlockRef = useRef<bigint | null>(null);
  const blockTsCacheRef = useRef<Map<bigint, number>>(new Map());

  useEffect(() => {
    let cancelled = false;

    async function run() {
      // Missing deps -> reset
      if (!publicClient || !token || !address) {
        if (!cancelled) {
          setRows([]);
          setIsLoading(false);
          setError(null);
        }
        return;
      }

      try {
        const toBlock = (latestBlock ?? (await publicClient.getBlockNumber())) as bigint;

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

        const addr = address as `0x${string}`;

        const fetchWindow = async (args?: { from?: `0x${string}`; to?: `0x${string}` }) => {
          const out: {
            from: `0x${string}`;
            to: `0x${string}`;
            value: bigint;
            txHash: `0x${string}`;
            blockNumber: bigint;
            logIndex: bigint;
          }[] = [];

          let windowTo = toBlock;

          while (windowTo >= floorFrom && out.length < limit) {
            const windowFrom = windowTo > scanChunkSize ? windowTo - scanChunkSize : 0n;
            const fromBlock = windowFrom < floorFrom ? floorFrom : windowFrom;

            const logs = await publicClient.getLogs({
              address: token,
              event: TransferEvent,
              args,
              fromBlock,
              toBlock: windowTo,
            });

            for (const l of logs) {
              if (!l.blockNumber || !l.transactionHash) continue;

              const a = l.args as unknown as {
                from: `0x${string}`;
                to: `0x${string}`;
                value: bigint;
              };

              const logIndex =
                typeof l.logIndex === "number"
                  ? BigInt(l.logIndex)
                  : (l.logIndex ?? 0n);

              out.push({
                from: a.from,
                to: a.to,
                value: a.value,
                txHash: l.transactionHash as `0x${string}`,
                blockNumber: l.blockNumber,
                logIndex,
              });
            }

            if (fromBlock === 0n) break;
            if (windowTo <= fromBlock) break;
            windowTo = fromBlock - 1n;
          }

          return out;
        };

        const sentArgs = { from: addr };
        const receivedArgs = { to: addr };

        const collected =
          direction === "sent"
            ? await fetchWindow(sentArgs)
            : direction === "received"
              ? await fetchWindow(receivedArgs)
              : [...(await fetchWindow(sentArgs)), ...(await fetchWindow(receivedArgs))];

        // Dedupe by txHash+logIndex
        const deduped = Array.from(
          new Map(collected.map((r) => [`${r.txHash}:${r.logIndex}`, r] as const)).values()
        );

        // Sort newest-first
        deduped.sort((a, b) => {
          if (a.blockNumber === b.blockNumber) return a.logIndex > b.logIndex ? -1 : 1;
          return a.blockNumber > b.blockNumber ? -1 : 1;
        });

        const sliced = deduped.slice(0, limit);

        // Timestamp enrichment (cached)
        const uniqBlocks = uniq(sliced.map((r) => r.blockNumber));
        const missing = uniqBlocks.filter((bn) => !blockTsCacheRef.current.has(bn));

        await Promise.all(
          missing.map(async (bn) => {
            const b = await publicClient.getBlock({ blockNumber: bn });
            blockTsCacheRef.current.set(bn, Number(b.timestamp));
          })
        );

        const finalRows: TransferRow[] = sliced.map((r) => ({
          from: r.from,
          to: r.to,
          value: r.value,
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
  }, [
    publicClient,
    token,
    address,
    latestBlock,
    chainId,
    limit,
    blockRange,
    direction,
    minBlockDelta,
    scanChunkSize,
  ]);

  const totalTransfers = useMemo(() => rows.length, [rows]);

  return { rows, totalTransfers, isLoading, error };
}
