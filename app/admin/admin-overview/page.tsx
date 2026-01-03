"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Settings,
  DollarSign,
  Package,
  Eye,
  Link as LinkIcon,
  Calendar,
  Wallet,
  Copy,
  ExternalLink,
  PauseCircle,
  PlayCircle,
} from "lucide-react";
import {
  useAccount,
  useChainId,
  useChains,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { bsc } from "wagmi/chains";
import { isAddress, parseUnits } from "viem";

import { getTokenIcoAddress } from "@/lib/contracts/addresses";
import { useTokenIcoDashboard } from "@/lib/hooks/useTokenIcoDashboard";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

const ownerAbi = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

const adminWriteAbi = [
  {
    type: "function",
    name: "setSaleToken",
    stateMutability: "nonpayable",
    inputs: [{ name: "_token", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "updateTokenPrice",
    stateMutability: "nonpayable",
    inputs: [{ name: "newPrice", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "pause",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "unpause",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "setSaleWindow",
    stateMutability: "nonpayable",
    inputs: [
      { name: "start", type: "uint64" },
      { name: "end", type: "uint64" },
    ],
    outputs: [],
  },
] as const;

const adminSections = [
  { id: "overview", label: "Overview", icon: Eye },
  { id: "token-config", label: "Token Config", icon: Settings },
  { id: "price-settings", label: "Price Settings", icon: DollarSign },
  { id: "sale-controls", label: "Sale Controls", icon: PauseCircle },
] as const;

type SectionId = (typeof adminSections)[number]["id"];

function shortAddr(a?: string) {
  if (!a) return "—";
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

async function copyText(txt: string) {
  try {
    await navigator.clipboard.writeText(txt);
  } catch {
    // Clipboard can fail (permissions/browser); handle via UI message where called
    throw new Error("Copy failed. Please copy manually.");
  }
}

function fmtDateTime(ts?: number) {
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

function safeToUint64(s: string) {
  const n = Number(s.trim());
  if (!Number.isFinite(n) || n < 0) return null;
  if (n > Number.MAX_SAFE_INTEGER) return null;
  return BigInt(Math.floor(n));
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

function humanizeReadError(e: any) {
  const raw = String(extractErrText(e) || "").toLowerCase();
  if (!raw) return "Unable to load contract data. Please try again.";
  if (raw.includes("network") || raw.includes("chain"))
    return "Network error. Please ensure your wallet is connected to BNB Smart Chain (BSC).";
  if (raw.includes("timeout")) return "Request timed out. Please try again.";
  return "Unable to load contract data. Please try again.";
}

export default function AdminPage() {
  const [activeSection, setActiveSection] = useState<SectionId>("overview");

  const chainId = useChainId();
  const onBsc = chainId === bsc.id;

  const chains = useChains();
  const chain = chains.find((c) => c.id === chainId);
  const explorerBase = onBsc ? chain?.blockExplorers?.default?.url : undefined;

  const ico = getTokenIcoAddress(chainId);
  const publicClient = usePublicClient();
  const { address: user } = useAccount();

  const {
    data: dash,
    isLoading: dashLoading,
    error: dashError,
  } = useTokenIcoDashboard();

  // Owner
  const owner = useReadContract({
    address: onBsc ? ico : undefined,
    abi: ownerAbi,
    functionName: "owner",
    query: { enabled: !!ico && onBsc, refetchInterval: 8_000 },
  });

  const ownerAddr = owner.data as `0x${string}` | undefined;

  const isOwner = useMemo(() => {
    if (!user || !ownerAddr) return false;
    return user.toLowerCase() === ownerAddr.toLowerCase();
  }, [user, ownerAddr]);

  // Latest block timestamp (Last updated)
  const [lastUpdated, setLastUpdated] = useState<number | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!publicClient || !onBsc) return;
      try {
        const b = await publicClient.getBlock();
        if (!cancelled) setLastUpdated(Number(b.timestamp));
      } catch {
        // ignore
      }
    }

    run();
    const t = setInterval(run, 12_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [publicClient, onBsc]);

  // UI feedback
  const [uiError, setUiError] = useState<string | null>(null);
  const [uiErrorDetails, setUiErrorDetails] = useState<string | null>(null);
  const [uiSuccess, setUiSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<`0x${string}` | null>(null);

  const [showDashDetails, setShowDashDetails] = useState(false);
  const [showUiDetails, setShowUiDetails] = useState(false);

  const { writeContractAsync, isPending } = useWriteContract();

  function resetNotices() {
    setUiError(null);
    setUiErrorDetails(null);
    setUiSuccess(null);
    setLastTx(null);
    setShowUiDetails(false);
  }

  async function runWrite(label: string, args: Parameters<typeof writeContractAsync>[0]) {
    resetNotices();

    try {
      if (!onBsc) throw new Error("Please switch your wallet network to BNB Smart Chain (BSC).");
      if (!ico) throw new Error("ICO address is not configured for this chain.");
      if (!isOwner) throw new Error("Only the contract owner can perform this action.");
      if (!publicClient) throw new Error("Public client not ready.");

      const hash = await writeContractAsync(args);
      setLastTx(hash);

      await publicClient.waitForTransactionReceipt({ hash });
      setUiSuccess(`${label} confirmed on-chain.`);
    } catch (e: any) {
      const details = extractErrText(e);
      setUiError(humanizeTxError(e));
      setUiErrorDetails(details || null);
    }
  }

  // ===== Token Config =====
  const [saleTokenInput, setSaleTokenInput] = useState("");
  const saleTokenAlreadySet = useMemo(() => {
    const t = dash?.tokenAddr as `0x${string}` | undefined;
    return !!t && t !== ZERO_ADDRESS;
  }, [dash?.tokenAddr]);

  async function onSetSaleToken() {
    const addr = saleTokenInput.trim();
    if (!isAddress(addr)) {
      setUiError("Invalid sale token address.");
      setUiErrorDetails(null);
      return;
    }

    await runWrite("Set sale token", {
      address: ico!,
      abi: adminWriteAbi,
      functionName: "setSaleToken",
      args: [addr as `0x${string}`],
    });

    setSaleTokenInput("");
  }

  // ===== Price Settings =====
  const payDecimals = dash?.payDecimals ?? 18;
  const paySymbol = dash?.paySymbol ?? "USDT";

  const [priceInput, setPriceInput] = useState(""); // "0.01"
  async function onUpdatePrice() {
    const v = priceInput.trim();
    if (!v || Number(v) <= 0) {
      setUiError("Enter a valid price greater than 0.");
      setUiErrorDetails(null);
      return;
    }

    let newPrice: bigint;
    try {
      newPrice = parseUnits(v.replace(/,/g, ""), payDecimals);
    } catch {
      setUiError(`Invalid number format. Max decimals for ${paySymbol}: ${payDecimals}.`);
      setUiErrorDetails(null);
      return;
    }

    await runWrite("Update token price", {
      address: ico!,
      abi: adminWriteAbi,
      functionName: "updateTokenPrice",
      args: [newPrice],
    });

    setPriceInput("");
  }

  // ===== Sale Controls =====
  const isPaused = dash?.paused ?? false;
  const [startInput, setStartInput] = useState<string>("");
  const [endInput, setEndInput] = useState<string>("");

  useEffect(() => {
    if (dash?.start !== undefined) setStartInput(String(dash.start));
    if (dash?.end !== undefined) setEndInput(String(dash.end));
  }, [dash?.start, dash?.end]);

  const saleWindowEnabled = useMemo(() => {
    const s = dash?.start ?? 0;
    const e = dash?.end ?? 0;
    return s !== 0 || e !== 0;
  }, [dash?.start, dash?.end]);

  async function onPause() {
    await runWrite("Pause sale", {
      address: ico!,
      abi: adminWriteAbi,
      functionName: "pause",
      args: [],
    });
  }

  async function onUnpause() {
    await runWrite("Unpause sale", {
      address: ico!,
      abi: adminWriteAbi,
      functionName: "unpause",
      args: [],
    });
  }

  async function onSetSaleWindow() {
    const s = safeToUint64(startInput);
    const e = safeToUint64(endInput);

    if (s === null || e === null) {
      setUiError("Invalid start/end unix seconds.");
      setUiErrorDetails(null);
      return;
    }

    const disabled = s === 0n && e === 0n;
    if (!disabled) {
      if (s === 0n || e === 0n || s >= e) {
        setUiError("Invalid sale window. Use (start < end), or set both to 0 to disable.");
        setUiErrorDetails(null);
        return;
      }
    }

    await runWrite("Update sale window", {
      address: ico!,
      abi: adminWriteAbi,
      functionName: "setSaleWindow",
      args: [s, e],
    });
  }

  async function onDisableSaleWindow() {
    setStartInput("0");
    setEndInput("0");
    await runWrite("Disable sale window", {
      address: ico!,
      abi: adminWriteAbi,
      functionName: "setSaleWindow",
      args: [0n, 0n],
    });
  }

  const saleSymbol = dash?.symbol ?? "TOKEN";
  const tokensRemainingHuman = dash?.tokensRemainingHuman ?? "—";
  const totalTokensSoldHuman = dash?.totalTokensSoldHuman ?? "—";

  const txUrl = lastTx && explorerBase ? `${explorerBase}/tx/${lastTx}` : null;

  const dashDetails = dashError ? extractErrText(dashError as any) : null;
  const dashMsg = dashError ? humanizeReadError(dashError as any) : null;

  return (
    <div className="w-full min-h-screen bg-transparent text-white space-y-8 px-4 sm:px-6 lg:px-8 pt-6 pb-10">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Admin</h1>
        <p className="text-gray-400">Administrator dashboard for managing sale settings</p>

        <div className="mt-2 text-xs text-gray-500">
          Connected: <span className="font-mono">{user ? shortAddr(user) : "—"}</span>{" "}
          {isOwner ? (
            <span className="text-emerald-400">(Owner)</span>
          ) : (
            <span className="text-yellow-400">(Not owner)</span>
          )}
        </div>

        {!onBsc && (
          <div className="mt-3 text-xs sm:text-sm text-amber-200 bg-amber-900/20 border border-amber-800/30 rounded-xl px-3 py-2 inline-block">
            Please switch your wallet network to BNB Smart Chain (BSC) to use Admin.
          </div>
        )}

        {onBsc && !ico && (
          <div className="mt-3 text-xs sm:text-sm text-red-200 bg-red-900/20 border border-red-800/30 rounded-xl px-3 py-2 inline-block">
            ICO address is not configured for this network.
          </div>
        )}
      </div>

      {/* Notices */}
      {(dashError || uiError || uiSuccess) && (
        <div className="max-w-3xl mx-auto space-y-3">
          {dashError && (
            <div className="p-3 rounded-xl border border-red-800/40 bg-red-900/20 text-sm text-red-100">
              <div className="font-semibold">Unable to load contract data</div>
              <div className="mt-1 text-red-200">{dashMsg}</div>

              {dashDetails && (
                <button
                  type="button"
                  onClick={() => setShowDashDetails((v) => !v)}
                  className="mt-2 text-xs text-red-200/80 hover:text-red-100 underline underline-offset-2"
                >
                  {showDashDetails ? "Hide details" : "Show details"}
                </button>
              )}

              {showDashDetails && dashDetails && (
                <div className="mt-2 text-xs text-red-200/80 whitespace-pre-wrap break-words">
                  {dashDetails}
                </div>
              )}
            </div>
          )}

          {uiError && (
            <div className="p-3 rounded-xl border border-red-800/40 bg-red-900/20 text-sm text-red-100">
              <div className="font-semibold">Action failed</div>
              <div className="mt-1 text-red-200">{uiError}</div>

              {uiErrorDetails && (
                <button
                  type="button"
                  onClick={() => setShowUiDetails((v) => !v)}
                  className="mt-2 text-xs text-red-200/80 hover:text-red-100 underline underline-offset-2"
                >
                  {showUiDetails ? "Hide details" : "Show details"}
                </button>
              )}

              {showUiDetails && uiErrorDetails && (
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

      {/* Nav Tabs (responsive scroll) */}
      <div className="flex justify-center">
        <div className="w-full max-w-4xl overflow-x-auto">
          <div className="inline-flex min-w-max bg-gray-900 border border-gray-800 rounded-2xl p-1 gap-1">
            {adminSections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => {
                    resetNotices();
                    setActiveSection(section.id);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 text-sm font-medium ${
                    isActive
                      ? "bg-gradient-to-r from-cyan-600/30 to-purple-600/30 text-white border border-cyan-500/40"
                      : "text-gray-400 hover:text-white hover:bg-gray-800"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{section.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row gap-6 justify-center items-start">
        {/* Left Column */}
        <div className="flex-1 w-full max-w-3xl space-y-6">
          {activeSection === "overview" && (
            <div className="rounded-2xl bg-gray-900 border border-gray-800 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-cyan-900/30 rounded-lg">
                  <Eye className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Overview</h2>
                  <p className="text-gray-400 text-sm">Live contract summary</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 bg-gray-800/40 rounded-xl border border-gray-800">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-cyan-900/30 rounded-lg">
                      <Package className="w-4 h-4 text-cyan-400" />
                    </div>
                    <span className="text-gray-400 text-sm">Sale Token Remaining</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {dashLoading ? "Loading..." : `${tokensRemainingHuman} ${saleSymbol}`}
                  </div>
                </div>

                <div className="p-5 bg-gray-800/40 rounded-xl border border-gray-800">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-purple-900/30 rounded-lg">
                      <DollarSign className="w-4 h-4 text-purple-400" />
                    </div>
                    <span className="text-gray-400 text-sm">Total Tokens Sold</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {dashLoading ? "Loading..." : `${totalTokensSoldHuman} ${saleSymbol}`}
                  </div>
                </div>

                <div className="p-5 bg-gray-800/40 rounded-xl border border-gray-800">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-green-900/30 rounded-lg">
                      <LinkIcon className="w-4 h-4 text-green-400" />
                    </div>
                    <span className="text-gray-400 text-sm">Contract Address</span>
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <div className="font-mono font-bold text-sm break-all">{ico ?? "—"}</div>
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
                              setUiErrorDetails(null);
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

                <div className="p-5 bg-gray-800/40 rounded-xl border border-gray-800">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-orange-900/30 rounded-lg">
                      <Wallet className="w-4 h-4 text-orange-400" />
                    </div>
                    <span className="text-gray-400 text-sm">Owner (Admin)</span>
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <div className="font-mono font-bold text-sm break-all">
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
                              setUiErrorDetails(null);
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

                  {copied === "owner" && <div className="mt-2 text-xs text-emerald-300">Copied.</div>}
                </div>
              </div>

              <div className="pt-4 mt-6 border-t border-gray-800 text-gray-400 text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>Last updated: {fmtDateTime(lastUpdated)}</span>
              </div>
            </div>
          )}

          {activeSection === "token-config" && (
            <div className="rounded-2xl bg-gray-900 border border-gray-800 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-cyan-900/30 rounded-lg">
                  <Settings className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Token Configuration</h2>
                  <p className="text-gray-400 text-sm">Set the sale token (one-time)</p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="text-xs text-gray-400">
                  Current sale token:{" "}
                  <span className="font-mono text-gray-200">
                    {saleTokenAlreadySet ? shortAddr(dash?.tokenAddr) : "Not set"}
                  </span>
                </div>

                <div>
                  <label className="text-gray-400 text-sm mb-2 block">Token Address</label>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={saleTokenInput}
                    onChange={(e) => setSaleTokenInput(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <button
                  disabled={!onBsc || !ico || !isOwner || isPending || saleTokenAlreadySet}
                  onClick={onSetSaleToken}
                  className={`w-full py-3 rounded-xl font-bold transition-all duration-200 ${
                    !onBsc || !ico || !isOwner || isPending || saleTokenAlreadySet
                      ? "bg-gray-700 text-gray-300 cursor-not-allowed"
                      : "bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500"
                  }`}
                  type="button"
                >
                  {saleTokenAlreadySet
                    ? "Sale Token Already Set"
                    : isPending
                      ? "Submitting..."
                      : "Set Sale Token"}
                </button>

                {!isOwner && (
                  <div className="text-xs text-yellow-400">Only the contract owner can set the sale token.</div>
                )}
              </div>
            </div>
          )}

          {activeSection === "price-settings" && (
            <div className="rounded-2xl bg-gray-900 border border-gray-800 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-purple-900/30 rounded-lg">
                  <DollarSign className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Price Settings</h2>
                  <p className="text-gray-400 text-sm">
                    Update token price ({paySymbol} per 1 token). Decimals: {payDecimals}
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="text-xs text-gray-400">
                  Current price:{" "}
                  <span className="text-gray-200 font-semibold">
                    {dashLoading ? "Loading..." : dash?.priceUsdt ? `${dash.priceUsdt} ${paySymbol}` : "—"}
                  </span>
                </div>

                <div>
                  <label className="text-gray-400 text-sm mb-2 block">
                    New Price ({paySymbol} per token)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={priceInput}
                      onChange={(e) => setPriceInput(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-2xl font-bold text-right focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                      {paySymbol}
                    </span>
                  </div>
                </div>

                <button
                  disabled={!onBsc || !ico || !isOwner || isPending || !saleTokenAlreadySet}
                  onClick={onUpdatePrice}
                  className={`w-full py-3 rounded-xl font-bold transition-all duration-200 ${
                    !onBsc || !ico || !isOwner || isPending || !saleTokenAlreadySet
                      ? "bg-gray-700 text-gray-300 cursor-not-allowed"
                      : "bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500"
                  }`}
                  type="button"
                >
                  {isPending ? "Submitting..." : "Update Token Price"}
                </button>

                {!saleTokenAlreadySet && (
                  <div className="text-xs text-yellow-400">
                    You must set the sale token before updating the price.
                  </div>
                )}
                {!isOwner && (
                  <div className="text-xs text-yellow-400">Only the contract owner can update the price.</div>
                )}
              </div>
            </div>
          )}

          {activeSection === "sale-controls" && (
            <div className="rounded-2xl bg-gray-900 border border-gray-800 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-cyan-900/30 rounded-lg">
                  <PauseCircle className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Sale Controls</h2>
                  <p className="text-gray-400 text-sm">Pause/unpause and configure the sale window</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-4 rounded-xl border border-gray-800 bg-gray-800/30 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-400">Status</div>
                    <div className="mt-1 text-lg font-bold">{dashLoading ? "Loading..." : isPaused ? "Paused" : "Live"}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      Sale window:{" "}
                      {dashLoading ? "—" : saleWindowEnabled ? "Enabled" : "Disabled (always open)"}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      disabled={!onBsc || !ico || !isOwner || isPending || dashLoading || isPaused}
                      onClick={onPause}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${
                        !onBsc || !ico || !isOwner || isPending || dashLoading || isPaused
                          ? "bg-gray-700 text-gray-300 border-gray-700 cursor-not-allowed"
                          : "bg-red-900/20 text-red-200 border-red-800/40 hover:bg-red-900/30"
                      }`}
                      type="button"
                    >
                      <PauseCircle className="w-4 h-4" />
                      Pause
                    </button>

                    <button
                      disabled={!onBsc || !ico || !isOwner || isPending || dashLoading || !isPaused}
                      onClick={onUnpause}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${
                        !onBsc || !ico || !isOwner || isPending || dashLoading || !isPaused
                          ? "bg-gray-700 text-gray-300 border-gray-700 cursor-not-allowed"
                          : "bg-emerald-900/15 text-emerald-200 border-emerald-800/40 hover:bg-emerald-900/25"
                      }`}
                      type="button"
                    >
                      <PlayCircle className="w-4 h-4" />
                      Unpause
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-gray-800 bg-gray-800/30 space-y-4">
                  <div className="text-sm font-semibold">Sale Window (unix seconds)</div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400">Start</label>
                      <input
                        value={startInput}
                        onChange={(e) => setStartInput(e.target.value)}
                        className="mt-1 w-full px-4 py-2.5 rounded-xl bg-gray-900 border border-gray-700 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">End</label>
                      <input
                        value={endInput}
                        onChange={(e) => setEndInput(e.target.value)}
                        className="mt-1 w-full px-4 py-2.5 rounded-xl bg-gray-900 border border-gray-700 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="text-xs text-gray-500">
                    Use <span className="text-gray-300 font-mono">start=0</span> and{" "}
                    <span className="text-gray-300 font-mono">end=0</span> to disable the window (always open).
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      disabled={!onBsc || !ico || !isOwner || isPending}
                      onClick={onSetSaleWindow}
                      className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                        !onBsc || !ico || !isOwner || isPending
                          ? "bg-gray-700 text-gray-300 cursor-not-allowed"
                          : "bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500"
                      }`}
                      type="button"
                    >
                      {isPending ? "Submitting..." : "Update Window"}
                    </button>

                    <button
                      disabled={!onBsc || !ico || !isOwner || isPending}
                      onClick={onDisableSaleWindow}
                      className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                        !onBsc || !ico || !isOwner || isPending
                          ? "bg-gray-700 text-gray-300 border-gray-700 cursor-not-allowed"
                          : "bg-gray-900 text-gray-200 border-gray-700 hover:bg-gray-800"
                      }`}
                      type="button"
                    >
                      Disable Window
                    </button>
                  </div>
                </div>

                {!isOwner && (
                  <div className="text-xs text-yellow-400">
                    Sale controls are restricted to the contract owner.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="w-full max-w-sm lg:sticky lg:top-6">
          <div className="rounded-2xl bg-gray-900 border border-gray-800 p-6 space-y-5">
            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-cyan-900/20 to-purple-900/20 rounded-xl border border-cyan-800/30">
              <div className="w-10 h-10 bg-cyan-900/30 rounded-lg flex items-center justify-center">
                <Settings className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <div className="font-bold">{isOwner ? "Connected as Admin" : "Connected"}</div>
                <div className="text-sm text-gray-400">{isOwner ? "Administrator Mode" : "Read-only Mode"}</div>
              </div>
            </div>

            <div className="p-4 bg-gray-800/30 rounded-xl">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <Calendar className="w-4 h-4" />
                <span>Last update:</span>
              </div>
              <div className="font-mono text-sm">{fmtDateTime(lastUpdated)}</div>
            </div>

            <div className="p-4 bg-gray-800/20 rounded-xl text-xs sm:text-sm text-gray-400 space-y-2">
              <div className="flex justify-between">
                <span>Network</span>
                <span className="text-gray-200">{chain?.name ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span>ICO</span>
                <span className="font-mono text-gray-200">{ico ? shortAddr(ico) : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span>Sale Token</span>
                <span className="font-mono text-gray-200">
                  {dash?.tokenAddr ? shortAddr(dash.tokenAddr) : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Payment</span>
                <span className="text-gray-200">{paySymbol}</span>
              </div>
            </div>

            {explorerBase && ico && (
              <a
                href={`${explorerBase}/address/${ico}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm font-bold text-gray-200"
              >
                Open Contract <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
