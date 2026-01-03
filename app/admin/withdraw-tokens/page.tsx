"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Shield,
  Wallet,
  Copy,
  ExternalLink,
  Coins,
  CheckCircle,
} from "lucide-react";
import {
  useAccount,
  useChainId,
  useChains,
  usePublicClient,
  useBlockNumber,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { bsc } from "wagmi/chains";
import { formatUnits, parseAbiItem } from "viem";

import { erc20Abi } from "@/lib/contracts/abi/erc20Abi";
import { getTokenIcoAddress } from "@/lib/contracts/addresses";
import { useTokenIcoDashboard } from "@/lib/hooks/useTokenIcoDashboard";

const ownerAbi = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

const withdrawAbi = [
  {
    type: "function",
    name: "withdrawTokens",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
] as const;

const E_TokensWithdrawn = parseAbiItem("event TokensWithdrawn(uint256 amountTokens)");

type WithdrawRow = {
  amountTokens: bigint;
  txHash: `0x${string}`;
  blockNumber: bigint;
  timestamp: number;
  time: string;
  txUrl?: string;
};

function shortAddr(a?: string) {
  if (!a) return "—";
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

/** Format a decimal string safely without Number() precision loss. */
function formatDecimalStr(v?: string, maxFrac = 6) {
  if (!v) return "—";
  const [intRaw, fracRaw = ""] = v.split(".");
  const intPart = (intRaw || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = fracRaw.slice(0, maxFrac).replace(/0+$/, "");
  return frac.length ? `${intPart}.${frac}` : intPart;
}

async function copyText(txt: string) {
  try {
    await navigator.clipboard.writeText(txt);
  } catch {
    throw new Error("Copy failed. Please copy manually.");
  }
}

function formatDateTime(ts: number) {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function extractErrText(e: any) {
  return e?.shortMessage || e?.cause?.shortMessage || e?.details || e?.message || "";
}

function humanizeTxError(e: any) {
  const raw = String(extractErrText(e) || "").toLowerCase();
  if (!raw) return "Transaction failed. Please try again.";
  if (raw.includes("user rejected") || raw.includes("rejected the request"))
    return "Transaction was cancelled in your wallet.";
  if (raw.includes("insufficient funds"))
    return "Insufficient funds to pay gas for this transaction.";
  if (raw.includes("nonce"))
    return "Nonce issue detected. Please retry, or reset your wallet nonce if needed.";
  if (raw.includes("network") || raw.includes("chain"))
    return "Network error. Please ensure your wallet is connected to BNB Smart Chain (BSC).";
  return "Transaction failed. Please try again.";
}

export default function WithdrawTokensPage() {
  const chainId = useChainId();
  const onBsc = chainId === bsc.id;

  const chains = useChains();
  const chain = chains.find((c) => c.id === chainId);

  // Explorer only when on BSC
  const explorerBase = onBsc ? chain?.blockExplorers?.default?.url : undefined;

  const ico = getTokenIcoAddress(chainId);
  const publicClient = usePublicClient();
  const { data: latestBlock } = useBlockNumber({ watch: true });

  const { address: user } = useAccount();

  const [uiError, setUiError] = useState<string | null>(null);
  const [uiErrorDetails, setUiErrorDetails] = useState<string | null>(null);
  const [uiSuccess, setUiSuccess] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<`0x${string}` | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Sale token + ICO stats from your hook
  const { data: dash, isLoading: dashLoading } = useTokenIcoDashboard();
  const saleTokenAddr = dash?.tokenAddr as `0x${string}` | undefined;
  const saleSymbol = dash?.symbol ?? "TOKEN";
  const saleDecimals = dash?.decimals ?? 18;
  const tokensRemaining = dash?.tokensRemaining ?? 0n;

  const contractReady = onBsc && !!ico && !!publicClient;

  // Owner from contract (disable reads off-BSC or if no ICO)
  const owner = useReadContract({
    address: contractReady ? ico : undefined,
    abi: ownerAbi,
    functionName: "owner",
    query: { enabled: contractReady, refetchInterval: 8_000 },
  });

  const ownerAddr = (owner.data ?? undefined) as `0x${string}` | undefined;

  const isOwner = useMemo(() => {
    if (!user || !ownerAddr) return false;
    return user.toLowerCase() === ownerAddr.toLowerCase();
  }, [user, ownerAddr]);

  // Optional: token name from ERC20 (disable if token missing)
  const tokenName = useReadContract({
    address: contractReady && saleTokenAddr ? saleTokenAddr : undefined,
    abi: [
      ...erc20Abi,
      {
        type: "function",
        name: "name",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "string" }],
      },
    ] as const,
    functionName: "name",
    query: { enabled: contractReady && !!saleTokenAddr },
  });

  // Withdraw write
  const { writeContractAsync, isPending } = useWriteContract();

  const [confirmStage, setConfirmStage] = useState<"idle" | "armed">("idle");
  const [confirmChecked, setConfirmChecked] = useState(false);

  // Button logic:
  // - If idle: allow arming (owner + ready + has tokens + not pending)
  // - If armed: allow submit only if checkbox checked
  const canArm = isOwner && contractReady && tokensRemaining > 0n && !isPending;
  const canSubmit = canArm && confirmStage === "armed" && confirmChecked;

  function resetNotices() {
    setUiError(null);
    setUiErrorDetails(null);
    setUiSuccess(null);
    setLastTx(null);
  }

  async function handleWithdraw() {
    resetNotices();

    if (!onBsc) {
      setUiError("Please switch your wallet network to BNB Smart Chain (BSC).");
      return;
    }
    if (!ico) {
      setUiError("ICO address not configured for this chain.");
      return;
    }
    if (!isOwner) {
      setUiError("Only the contract owner can withdraw tokens.");
      return;
    }
    if (tokensRemaining === 0n) {
      setUiError("No tokens remaining in the ICO contract.");
      return;
    }
    if (!publicClient) {
      setUiError("Public client not ready.");
      return;
    }

    // First click arms the confirmation (no checkbox required)
    if (confirmStage === "idle") {
      setConfirmStage("armed");
      return;
    }

    // Second click submits (requires checkbox)
    if (!confirmChecked) {
      setUiError("Please confirm the irreversible action checkbox.");
      return;
    }

    try {
      const hash = await writeContractAsync({
        address: ico,
        abi: withdrawAbi,
        functionName: "withdrawTokens",
        args: [],
      });

      setLastTx(hash);
      await publicClient.waitForTransactionReceipt({ hash });

      setUiSuccess("Withdraw confirmed on-chain.");
      setConfirmStage("idle");
      setConfirmChecked(false);
    } catch (e: any) {
      setUiError(humanizeTxError(e));
      const details = extractErrText(e);
      setUiErrorDetails(details || null);
    }
  }

  // Recent withdrawals (TokensWithdrawn)
  const [recent, setRecent] = useState<WithdrawRow[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!contractReady || !ico) return;

      setRecentLoading(true);
      try {
        const toBlock = (latestBlock ?? (await publicClient!.getBlockNumber())) as bigint;
        const blockRange = 100_000n;
        const fromBlock = toBlock > blockRange ? toBlock - blockRange : 0n;

        const logs = await publicClient!.getLogs({
          address: ico,
          event: E_TokensWithdrawn,
          fromBlock,
          toBlock,
        });

        const base: WithdrawRow[] = logs
          .map((l) => {
            if (!l.blockNumber || !l.transactionHash) return null;
            const args = l.args as unknown as { amountTokens: bigint };
            return {
              amountTokens: args.amountTokens,
              txHash: l.transactionHash as `0x${string}`,
              blockNumber: l.blockNumber,
              timestamp: 0,
              time: "—",
              txUrl: explorerBase ? `${explorerBase}/tx/${l.transactionHash}` : undefined,
            } satisfies WithdrawRow;
          })
          .filter(Boolean) as WithdrawRow[];

        base.sort((a, b) => (a.blockNumber > b.blockNumber ? -1 : 1));
        const sliced = base.slice(0, 10);

        const uniqBlocks = Array.from(new Set(sliced.map((r) => r.blockNumber)));
        const tsMap = new Map<bigint, number>();

        await Promise.all(
          uniqBlocks.map(async (bn) => {
            const b = await publicClient!.getBlock({ blockNumber: bn });
            tsMap.set(bn, Number(b.timestamp));
          })
        );

        const final = sliced.map((r) => {
          const ts = tsMap.get(r.blockNumber) ?? 0;
          return { ...r, timestamp: ts, time: formatDateTime(ts) };
        });

        if (!cancelled) setRecent(final);
      } catch {
        // keep page usable even if logs fail
        if (!cancelled) setRecent([]);
      } finally {
        if (!cancelled) setRecentLoading(false);
      }
    }

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractReady, ico, latestBlock, explorerBase]);

  const remainingHuman = useMemo(() => {
    return formatDecimalStr(formatUnits(tokensRemaining, saleDecimals), 6);
  }, [tokensRemaining, saleDecimals]);

  const txUrl = lastTx && explorerBase ? `${explorerBase}/tx/${lastTx}` : null;

  return (
    <div className="space-y-6 md:space-y-8 lg:space-y-10 px-4 sm:px-6 pt-4 sm:pt-6 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight mb-1">
          Withdraw All Tokens
        </h1>
        <p className="text-sm md:text-base text-gray-400">
          Withdraw all remaining sale tokens from the ICO contract to the owner wallet.
        </p>
      </div>

      {/* Network gating */}
      {!onBsc && (
        <div className="p-3 rounded-xl border border-amber-800/40 bg-amber-900/20 text-sm text-amber-200">
          Please switch your wallet network to <b>BNB Smart Chain (BSC)</b> to use this page.
        </div>
      )}

      {(uiError || uiSuccess) && (
        <div className="space-y-3">
          {uiError && (
            <div className="p-3 rounded-xl border border-red-800/40 bg-red-900/20 text-sm text-red-200">
              <div className="font-semibold">Action failed</div>
              <div className="mt-1">{uiError}</div>

              {uiErrorDetails && (
                <button
                  type="button"
                  onClick={() => setUiErrorDetails((v) => (v ? null : uiErrorDetails))}
                  className="mt-2 text-xs text-red-200/80 hover:text-red-100 underline underline-offset-2"
                >
                  Hide details
                </button>
              )}

              {uiErrorDetails && (
                <div className="mt-2 text-xs text-red-200/80 whitespace-pre-wrap break-words">
                  {uiErrorDetails}
                </div>
              )}
            </div>
          )}

          {uiSuccess && (
            <div className="p-3 rounded-xl border border-emerald-800/40 bg-emerald-900/15 text-sm text-emerald-200">
              {uiSuccess}
              {txUrl && (
                <div className="mt-2">
                  <a
                    href={txUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-cyan-300 hover:text-cyan-200 text-sm"
                  >
                    View transaction <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)] gap-6 md:gap-8 items-start">
        {/* Left */}
        <div className="space-y-6 md:space-y-8">
          {/* Admin Only */}
          <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-red-900/20 to-orange-900/20 border border-red-800/30 rounded-2xl w-full sm:max-w-md">
            <Shield className="w-5 h-5 text-red-400" />
            <div className="text-sm sm:text-base font-bold">Admin Only</div>
          </div>

          {/* Admin Info */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 sm:p-6 lg:p-8 space-y-6">
            <h2 className="text-xl sm:text-2xl font-bold">Admin Information</h2>

            {/* ICO */}
            <div>
              <div className="text-xs sm:text-sm text-gray-400 mb-2">ICO Contract</div>
              <div className="flex items-start justify-between p-4 bg-gray-800/30 rounded-xl gap-3">
                <div className="font-mono text-xs sm:text-sm break-all">{ico ?? "—"}</div>
                <div className="flex gap-2 shrink-0">
                  {ico && (
                    <button
                      className="p-2 hover:bg-gray-700 rounded-lg"
                      onClick={async () => {
                        try {
                          await copyText(ico);
                          setCopied("ico");
                          setTimeout(() => setCopied(null), 1200);
                        } catch (e: any) {
                          setUiError(e?.message ?? "Copy failed.");
                        }
                      }}
                      title="Copy"
                      type="button"
                    >
                      <Copy className="w-4 h-4 text-gray-400" />
                    </button>
                  )}
                  {ico && explorerBase && (
                    <a
                      className="p-2 hover:bg-gray-700 rounded-lg"
                      href={`${explorerBase}/address/${ico}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Open in explorer"
                    >
                      <ExternalLink className="w-4 h-4 text-gray-400" />
                    </a>
                  )}
                </div>
              </div>
              {copied === "ico" && <div className="mt-2 text-xs text-emerald-300">Copied.</div>}
            </div>

            {/* Owner */}
            <div>
              <div className="text-xs sm:text-sm text-gray-400 mb-2">Owner</div>
              <div className="flex items-start justify-between p-4 bg-gray-800/30 rounded-xl gap-3">
                <div className="font-mono text-xs sm:text-sm break-all">
                  {ownerAddr ?? (owner.isLoading ? "Loading..." : "—")}
                </div>
                <div className="flex gap-2 shrink-0">
                  {ownerAddr && (
                    <button
                      className="p-2 hover:bg-gray-700 rounded-lg"
                      onClick={async () => {
                        try {
                          await copyText(ownerAddr);
                          setCopied("owner");
                          setTimeout(() => setCopied(null), 1200);
                        } catch (e: any) {
                          setUiError(e?.message ?? "Copy failed.");
                        }
                      }}
                      title="Copy"
                      type="button"
                    >
                      <Copy className="w-4 h-4 text-gray-400" />
                    </button>
                  )}
                  {ownerAddr && explorerBase && (
                    <a
                      className="p-2 hover:bg-gray-700 rounded-lg"
                      href={`${explorerBase}/address/${ownerAddr}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Open in explorer"
                    >
                      <ExternalLink className="w-4 h-4 text-gray-400" />
                    </a>
                  )}
                </div>
              </div>

              <div className="mt-2 text-xs text-gray-400">
                Connected wallet: <span className="font-mono">{user ? shortAddr(user) : "—"}</span>{" "}
                {isOwner ? (
                  <span className="text-emerald-400 font-medium">(Owner)</span>
                ) : (
                  <span className="text-yellow-400 font-medium">(Not owner)</span>
                )}
              </div>
              {copied === "owner" && <div className="mt-2 text-xs text-emerald-300">Copied.</div>}
            </div>

            {/* Network */}
            <div>
              <div className="text-xs sm:text-sm text-gray-400 mb-2">Network</div>
              <div className="p-4 bg-gray-800/30 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${onBsc ? "bg-green-500" : "bg-amber-500"} animate-pulse`} />
                  <span className="text-sm sm:text-base font-medium">{chain?.name ?? "—"}</span>
                </div>
                <div className={`text-xs sm:text-sm ${onBsc ? "text-green-400" : "text-amber-300"}`}>
                  {onBsc ? "Connected" : "Wrong network"}
                </div>
              </div>
            </div>
          </div>

          {/* Token Info */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 sm:p-6 lg:p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-900/30 rounded-lg">
                <Coins className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold">Sale Token</h2>
                <p className="text-xs sm:text-sm text-gray-400">On-chain token details</p>
              </div>
            </div>

            <div className="p-5 sm:p-6 bg-gradient-to-r from-cyan-900/20 to-purple-900/20 border border-cyan-800/30 rounded-2xl space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-cyan-900/30 to-purple-900/30 flex items-center justify-center">
                  <span className="text-lg sm:text-xl font-bold text-cyan-300">
                    {(saleSymbol?.[0] ?? "T").toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-bold">{saleSymbol}</div>
                  <div className="text-xs sm:text-sm text-gray-400">
                    {tokenName.data ?? "ERC-20 Token"}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs sm:text-sm text-gray-400 mb-2">Available Balance (in ICO)</div>
                <div className="text-3xl sm:text-4xl font-bold text-center mb-3 sm:mb-4">
                  {dashLoading ? "Loading..." : `${remainingHuman} ${saleSymbol}`}
                </div>

                <div className="text-center text-xs sm:text-sm text-gray-400">
                  Token Address:{" "}
                  {saleTokenAddr ? (
                    <span className="font-mono text-gray-200">{shortAddr(saleTokenAddr)}</span>
                  ) : (
                    <span className="text-red-400">Not set</span>
                  )}
                </div>

                {saleTokenAddr && explorerBase && (
                  <div className="mt-3 flex justify-center">
                    <a
                      href={`${explorerBase}/address/${saleTokenAddr}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-xs sm:text-sm text-cyan-300 hover:text-cyan-200"
                    >
                      View Token on Explorer <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                )}
              </div>

              <div className="text-center">
                <div className="inline-block px-4 py-2 bg-cyan-900/30 rounded-full text-xs sm:text-sm text-cyan-300 font-medium">
                  {saleSymbol}
                </div>
              </div>
            </div>
          </div>

          {/* Warning + Withdraw */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 sm:p-6 lg:p-8 space-y-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-900/30 rounded-lg flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-red-400 mb-2">Warning</h2>
                <p className="text-sm sm:text-base text-gray-300">
                  This will withdraw <span className="font-bold">ALL remaining</span> sale tokens
                  from the ICO contract to the owner wallet. This action cannot be reversed.
                </p>
              </div>
            </div>

            {/* Confirm area */}
            {confirmStage === "armed" && (
              <div className="p-4 bg-yellow-900/20 border border-yellow-800/30 rounded-xl">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="confirmWithdraw"
                    checked={confirmChecked}
                    onChange={(e) => setConfirmChecked(e.target.checked)}
                    className="mt-1 w-5 h-5 bg-gray-800 border-gray-700 rounded focus:ring-yellow-500 focus:ring-2"
                  />
                  <label htmlFor="confirmWithdraw" className="text-xs sm:text-sm text-yellow-300">
                    I understand this action is irreversible and will transfer all tokens to the owner wallet.
                  </label>
                </div>
              </div>
            )}

            <button
              onClick={handleWithdraw}
              disabled={confirmStage === "idle" ? !canArm : !canSubmit}
              className={`w-full py-3 sm:py-4 font-bold text-base sm:text-lg rounded-2xl transition-all duration-200 flex items-center justify-center gap-3
                ${
                  confirmStage === "armed"
                    ? "bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500"
                    : "bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500"
                }
                ${((confirmStage === "idle" ? !canArm : !canSubmit)) ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.01]"}
                active:scale-[0.99]
              `}
              type="button"
            >
              <Wallet className="w-5 h-5" />
              <span>
                {!onBsc
                  ? "Switch to BSC"
                  : !ico
                    ? "ICO not configured"
                    : !isOwner
                      ? "Owner only"
                      : tokensRemaining === 0n
                        ? "No tokens to withdraw"
                        : isPending
                          ? "Submitting..."
                          : confirmStage === "armed"
                            ? `Confirm Withdraw All ${saleSymbol}`
                            : `Withdraw All ${saleSymbol}`}
              </span>
            </button>

            {confirmStage === "armed" && (
              <div className="text-xs text-gray-400">
                Tick the checkbox, then click the button again to submit.
              </div>
            )}
          </div>
        </div>

        {/* Right: Recent Withdrawals */}
        <div className="lg:sticky lg:top-6">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 sm:p-6 lg:p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-900/30 rounded-lg">
                <Wallet className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold">Recent Withdrawals</h2>
                <p className="text-xs sm:text-sm text-gray-400">From on-chain events</p>
              </div>
            </div>

            {recentLoading ? (
              <div className="text-center py-10 sm:py-12 text-gray-400">Loading...</div>
            ) : recent.length === 0 ? (
              <div className="text-center py-10 sm:py-12">
                <div className="mb-4">
                  <div className="inline-block p-4 bg-gray-800/30 rounded-xl">
                    <AlertTriangle className="w-8 h-8 text-gray-500" />
                  </div>
                </div>
                <div className="text-lg sm:text-xl font-bold text-gray-400 mb-1">No recent withdrawals</div>
                <div className="text-xs sm:text-sm text-gray-500">No TokensWithdrawn events found</div>
              </div>
            ) : (
              <div className="space-y-3">
                {recent.map((r) => (
                  <div
                    key={`${r.txHash}:${r.blockNumber.toString()}`}
                    className="p-4 bg-gray-800/30 rounded-xl border border-gray-800"
                  >
                    <div className="text-xs text-gray-400">{r.time}</div>
                    <div className="mt-1 font-bold text-cyan-300">
                      {formatDecimalStr(formatUnits(r.amountTokens, saleDecimals), 6)} {saleSymbol}
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <div className="inline-flex items-center gap-2 text-xs text-emerald-300">
                        <CheckCircle className="w-4 h-4" />
                        Confirmed
                      </div>

                      {r.txUrl ? (
                        <a
                          href={r.txUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-xs text-cyan-300 hover:text-cyan-200"
                        >
                          View Tx <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="text-xs text-gray-500">—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="p-4 bg-gray-800/20 rounded-xl text-xs sm:text-sm text-gray-400">
              Withdrawals are immediate and cannot be cancelled once initiated.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
