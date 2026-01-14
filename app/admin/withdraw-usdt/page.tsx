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
  History,
  Loader2,
  Download,
  Info,
  Clock,
  ArrowUpRight,
  Settings,
  Users,
  DollarSign,
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
import { formatUnits, parseAbiItem, isAddress } from "viem";

import { erc20Abi } from "@/lib/contracts/abi/erc20Abi";
import { getTokenIcoAddress } from "@/lib/contracts/addresses";
import { useTokenIcoDashboard } from "@/lib/hooks/useTokenIcoDashboard";

// Change this if your contract uses withdrawUSDT* instead of rescueUSDT*
const USE_RESCUE_USDT_FN = true;

// If you have a USDTWithdrawn(uint256) event, this will show recent withdrawals.
// If your event name differs, update it here.
const E_USDTWithdrawn = parseAbiItem("event USDTWithdrawn(uint256 amountUSDT)");

type WithdrawRow = {
  amount: bigint;
  txHash: `0x${string}`;
  blockNumber: bigint;
  timestamp: number;
  time: string;
  explorerLink?: string;
};

function shortAddr(addr?: string) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function trimDecimals(value: string, max: number) {
  if (!value.includes(".")) return value;
  const [i, f] = value.split(".");
  return `${i}.${f.slice(0, max)}`.replace(/\.?0+$/, "");
}

function formatTimeAgo(ts: number) {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - ts;

  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;

  const d = new Date(ts * 1000);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function humanizeTxError(e: any) {
  const msg = e?.shortMessage || e?.cause?.shortMessage || e?.message || "";
  const s = String(msg).toLowerCase();

  if (s.includes("user rejected") || s.includes("rejected the request"))
    return "Transaction was cancelled in your wallet.";
  if (s.includes("insufficient funds"))
    return "Insufficient funds to pay gas.";
  if (s.includes("network") || s.includes("chain"))
    return "Please connect to BNB Smart Chain.";
  if (s.includes("notauthorized") || s.includes("ownableunauthorizedaccount") || s.includes("accesscontrol"))
    return "You are not authorized to perform this action.";
  return "Transaction failed. Please try again.";
}

export default function WithdrawUsdtAndAdminPage() {
  const chainId = useChainId();
  const onBsc = chainId === bsc.id;
  const chains = useChains();
  const chain = chains.find((c) => c.id === chainId);
  const { address: user } = useAccount();

  const ico = getTokenIcoAddress(chainId);
  const publicClient = usePublicClient();
  const { data: latestBlock } = useBlockNumber({ watch: true });

  const explorerBase = onBsc ? chain?.blockExplorers?.default?.url : undefined;
  const contractReady = onBsc && !!ico && !!publicClient;

  // Dashboard data (your existing hook)
  const { data: dash } = useTokenIcoDashboard();
  const payDecimals = dash?.payDecimals ?? 18;
  const paySymbol = dash?.paySymbol ?? "USDT";

  // Owner
  const { data: ownerAddr } = useReadContract({
    address: contractReady ? ico : undefined,
    abi: [{ type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] }],
    functionName: "owner",
    query: { enabled: contractReady, staleTime: 10000 },
  });

  const isOwner = useMemo(() => {
    if (!user || !ownerAddr) return false;
    return user.toLowerCase() === ownerAddr.toLowerCase();
  }, [user, ownerAddr]);

  // Treasury + payToken address
  const { data: treasuryAddr, refetch: refetchTreasury } = useReadContract({
    address: contractReady ? ico : undefined,
    abi: [{ type: "function", name: "treasury", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] }],
    functionName: "treasury",
    query: { enabled: contractReady, staleTime: 10000 },
  });

  const { data: payTokenAddr } = useReadContract({
    address: contractReady ? ico : undefined,
    abi: [{ type: "function", name: "payToken", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] }],
    functionName: "payToken",
    query: { enabled: contractReady, staleTime: 10000 },
  });

  // USDT balance held by ICO contract (should be ~0 if forwarding to treasury, but can be >0 if sent accidentally)
  const { data: usdtBalance } = useReadContract({
    address: contractReady && payTokenAddr ? (payTokenAddr as `0x${string}`) : undefined,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: contractReady && ico ? [ico] : undefined,
    query: { enabled: contractReady && !!payTokenAddr },
  });

  const usdtBalanceHuman = useMemo(() => {
    const bal = usdtBalance ?? 0n;
    return trimDecimals(formatUnits(bal, payDecimals), 6);
  }, [usdtBalance, payDecimals]);

  // Roles check
  const OPERATOR_ROLE = useMemo(() => {
    // keccak256("OPERATOR_ROLE")
    return "0x" + "0".repeat(64); // placeholder not used; we call setOperator() which doesn't require role hash
  }, []);
  const TREASURER_ROLE_HASH = useMemo(() => {
    // keccak256("TREASURER_ROLE")
    // IMPORTANT: we can query hasRole with the bytes32 constant by reading the public constant (preferred),
    // but easiest is to read it from contract.
    return null as null | `0x${string}`;
  }, []);

  // Read TREASURER_ROLE constant from contract (so we don't hardcode)
  const { data: treasurerRoleValue } = useReadContract({
    address: contractReady ? ico : undefined,
    abi: [{ type: "function", name: "TREASURER_ROLE", stateMutability: "view", inputs: [], outputs: [{ type: "bytes32" }] }],
    functionName: "TREASURER_ROLE",
    query: { enabled: contractReady, staleTime: 60000 },
  });

  const { data: isUserTreasurer } = useReadContract({
    address: contractReady ? ico : undefined,
    abi: [
      {
        type: "function",
        name: "hasRole",
        stateMutability: "view",
        inputs: [{ type: "bytes32" }, { type: "address" }],
        outputs: [{ type: "bool" }],
      },
    ],
    functionName: "hasRole",
    args: contractReady && user && treasurerRoleValue ? [treasurerRoleValue, user] : undefined,
    query: { enabled: contractReady && !!user && !!treasurerRoleValue, staleTime: 10000 },
  });

  const canTreasuryOps = isOwner; // only owner can set treasury + assign roles
  const canUsdtRescue = isOwner || !!isUserTreasurer;

  // Writes
  const { writeContractAsync, isPending } = useWriteContract();

  // UI state
  const [uiError, setUiError] = useState<string | null>(null);
  const [uiSuccess, setUiSuccess] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<`0x${string}` | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Inputs
  const [newTreasury, setNewTreasury] = useState("");
  const [roleWallet, setRoleWallet] = useState("");
  const [roleType, setRoleType] = useState<"operator" | "treasurer">("treasurer");
  const [roleEnable, setRoleEnable] = useState(true);

  const [withdrawTo, setWithdrawTo] = useState(""); // optional
  const [withdrawAmount, setWithdrawAmount] = useState(""); // optional human amount

  // Recent USDT withdrawals
  const [cachedWithdrawals, setCachedWithdrawals] = useState<WithdrawRow[] | null>(null);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false);
  const [hasInitialWithdrawals, setHasInitialWithdrawals] = useState(false);
  const [blockRange, setBlockRange] = useState<bigint>(200_000n);

  const txUrl = lastTx && explorerBase ? `${explorerBase}/tx/${lastTx}` : null;

  // Copy
  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setUiError("Copy failed. Please copy manually.");
    }
  };

  // Fetch withdrawals
  useEffect(() => {
    let cancelled = false;

    async function fetchWithdrawals() {
      if (!contractReady || !ico) return;

      setWithdrawalsLoading(true);
      try {
        const toBlock = (latestBlock ?? (await publicClient!.getBlockNumber())) as bigint;
        const fromBlock = toBlock > blockRange ? toBlock - blockRange : 0n;

        const logs = await publicClient!.getLogs({
          address: ico,
          event: E_USDTWithdrawn,
          fromBlock,
          toBlock,
        });

        const rows = await Promise.all(
          logs.map(async (log) => {
            if (!log.blockNumber || !log.transactionHash) return null;
            const args = log.args as unknown as { amountUSDT: bigint };
            const block = await publicClient!.getBlock({ blockNumber: log.blockNumber });
            return {
              amount: args.amountUSDT,
              txHash: log.transactionHash as `0x${string}`,
              blockNumber: log.blockNumber,
              timestamp: Number(block.timestamp),
              time: formatTimeAgo(Number(block.timestamp)),
              explorerLink: explorerBase ? `${explorerBase}/tx/${log.transactionHash}` : undefined,
            };
          })
        );

        const valid = rows.filter(Boolean) as WithdrawRow[];
        valid.sort((a, b) => (a.blockNumber > b.blockNumber ? -1 : 1));

        if (!cancelled) {
          setCachedWithdrawals(valid.slice(0, 10));
          setHasInitialWithdrawals(true);
        }
      } catch {
        if (!cancelled) setCachedWithdrawals([]);
      } finally {
        if (!cancelled) setWithdrawalsLoading(false);
      }
    }

    fetchWithdrawals();
    return () => {
      cancelled = true;
    };
  }, [contractReady, ico, latestBlock, explorerBase, blockRange, publicClient]);

  const stableWithdrawals = hasInitialWithdrawals ? (cachedWithdrawals || []) : (withdrawalsLoading ? [] : cachedWithdrawals || []);

  // Actions
  const doSetTreasury = async () => {
    setUiError(null);
    setUiSuccess(null);

    if (!contractReady || !ico) return;
    if (!canTreasuryOps) return setUiError("Only owner can set the treasury wallet.");
    if (!isAddress(newTreasury)) return setUiError("Enter a valid treasury address.");

    try {
      const hash = await writeContractAsync({
        address: ico,
        abi: [{ type: "function", name: "setTreasuryWallet", stateMutability: "nonpayable", inputs: [{ type: "address" }], outputs: [] }],
        functionName: "setTreasuryWallet",
        args: [newTreasury as `0x${string}`],
      });
      setLastTx(hash);
      await publicClient!.waitForTransactionReceipt({ hash });
      setUiSuccess("Treasury wallet updated successfully.");
      setNewTreasury("");
      await refetchTreasury();
    } catch (e: any) {
      setUiError(humanizeTxError(e));
    }
  };

  const doSetRole = async () => {
    setUiError(null);
    setUiSuccess(null);

    if (!contractReady || !ico) return;
    if (!canTreasuryOps) return setUiError("Only owner can assign/revoke roles.");
    if (!isAddress(roleWallet)) return setUiError("Enter a valid wallet address.");

    const fn = roleType === "operator" ? "setOperator" : "setTreasurer";

    try {
      const hash = await writeContractAsync({
        address: ico,
        abi: [{ type: "function", name: fn, stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "bool" }], outputs: [] }],
        functionName: fn as any,
        args: [roleWallet as `0x${string}`, roleEnable],
      });
      setLastTx(hash);
      await publicClient!.waitForTransactionReceipt({ hash });
      setUiSuccess(`${roleType === "operator" ? "Operator" : "Treasurer"} role updated successfully.`);
      setRoleWallet("");
    } catch (e: any) {
      setUiError(humanizeTxError(e));
    }
  };



  const canSetTreasury = canTreasuryOps && contractReady && !isPending;
  const canSetRole = canTreasuryOps && contractReady && !isPending;
  const canWithdrawUsdt = canUsdtRescue && contractReady && !isPending;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Treasury & USDT Admin</h1>
        <p className="text-gray-400">Manage treasury, roles, and rescue any USDT held by the contract</p>
      </div>

      {!onBsc && (
        <div className="rounded-xl border border-amber-800/40 bg-gradient-to-r from-amber-900/20 to-orange-900/10 p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <span className="font-medium">Switch to BNB Smart Chain to continue</span>
          </div>
        </div>
      )}

      {(uiError || uiSuccess) && (
        <div className="space-y-3">
          {uiError && (
            <div className="rounded-xl border border-red-800/40 bg-gradient-to-r from-red-900/20 to-pink-900/10 p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <div className="font-medium text-red-200">{uiError}</div>
              </div>
            </div>
          )}
          {uiSuccess && (
            <div className="rounded-xl border border-emerald-800/40 bg-gradient-to-r from-emerald-900/20 to-teal-900/10 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <div className="font-medium text-emerald-200">{uiSuccess}</div>
                </div>
                {txUrl && (
                  <a
                    href={txUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-300 hover:text-cyan-200 text-sm flex items-center gap-2"
                  >
                    View <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contract info */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900/50 to-black/50 p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-3">
              <Shield className="w-6 h-6 text-cyan-400" />
              Contract Information
            </h2>

            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-400 mb-2">ICO Contract</div>
                <div className="flex items-center gap-2 p-3 bg-gray-800/30 rounded-xl">
                  <code className="font-mono text-sm truncate flex-1">{ico || "—"}</code>
                  {ico && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCopy(ico, "ico")}
                        className="p-2 hover:bg-gray-700/50 rounded-lg"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      {explorerBase && (
                        <a
                          href={`${explorerBase}/address/${ico}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 hover:bg-gray-700/50 rounded-lg"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-400 mb-2">Owner Address</div>
                <div className="flex items-center gap-2 p-3 bg-gray-800/30 rounded-xl">
                  <code className="font-mono text-sm truncate flex-1">
                    {ownerAddr ? shortAddr(ownerAddr) : "—"}
                  </code>
                  {ownerAddr && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCopy(ownerAddr, "owner")}
                        className="p-2 hover:bg-gray-700/50 rounded-lg"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      {explorerBase && (
                        <a
                          href={`${explorerBase}/address/${ownerAddr}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 hover:bg-gray-700/50 rounded-lg"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-2 text-sm">
                  <span className={isOwner ? "text-emerald-400" : "text-red-400"}>
                    {user ? (isOwner ? "✓ You are the owner" : "✗ You are not the owner") : "Connect wallet to check"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-400 mb-2">Treasury Wallet</div>
                  <div className="flex items-center gap-2 p-3 bg-gray-800/30 rounded-xl">
                    <code className="font-mono text-sm truncate flex-1">
                      {treasuryAddr ? shortAddr(treasuryAddr as string) : "—"}
                    </code>
                    {treasuryAddr && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCopy(String(treasuryAddr), "treasury")}
                          className="p-2 hover:bg-gray-700/50 rounded-lg"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        {explorerBase && (
                          <a
                            href={`${explorerBase}/address/${treasuryAddr}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 hover:bg-gray-700/50 rounded-lg"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-400 mb-2">Contract USDT Balance</div>
                  <div className="p-3 bg-gray-800/30 rounded-xl">
                    <div className="font-bold text-cyan-300">
                      {usdtBalanceHuman} {paySymbol}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Normally 0 if you forward payments to treasury; non-zero indicates accidental transfers or legacy flow.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Treasury management */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900/50 to-black/50 p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-3">
              <Settings className="w-6 h-6 text-purple-400" />
              Treasury Management
            </h2>

            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-cyan-900/10 to-purple-900/10 rounded-xl border border-cyan-800/30">
                <div className="text-sm text-gray-300 mb-2">
                  Owner can update the treasury wallet at any time.
                </div>
                <input
                  value={newTreasury}
                  onChange={(e) => setNewTreasury(e.target.value)}
                  placeholder="New treasury address (0x...)"
                  className="w-full px-4 py-3 rounded-xl bg-gray-900/40 border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                />
                <button
                  onClick={doSetTreasury}
                  disabled={!canSetTreasury}
                  className={`mt-3 w-full py-3 font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2
                    ${canSetTreasury ? "bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500" : "bg-gray-800 opacity-50 cursor-not-allowed"}`}
                >
                  {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wallet className="w-5 h-5" />}
                  Set Treasury Wallet
                </button>
                {!isOwner && (
                  <div className="text-sm text-amber-300 mt-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Owner only.
                  </div>
                )}
              </div>
            </div>
          </div>         

          {/* Role assignment */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900/50 to-black/50 p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-3">
              <Users className="w-6 h-6 text-emerald-400" />
              Role Assignment (Owner Only)
            </h2>

            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  value={roleWallet}
                  onChange={(e) => setRoleWallet(e.target.value)}
                  placeholder="Wallet address (0x...)"
                  className="w-full px-4 py-3 rounded-xl bg-gray-900/40 border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 md:col-span-2"
                />

                <select
                  value={roleType}
                  onChange={(e) => setRoleType(e.target.value as any)}
                  className="w-full px-4 py-3 rounded-xl bg-gray-900/40 border border-white/10"
                >
                  <option value="operator">Operator</option>
                  <option value="treasurer">Treasurer</option>
                </select>
              </div>

              <div className="flex items-center justify-between gap-3 p-3 bg-gray-800/20 rounded-xl border border-white/10">
                <div className="text-sm text-gray-300">
                  {roleEnable ? "Enable role for wallet" : "Revoke role from wallet"}
                </div>
                <button
                  onClick={() => setRoleEnable((v) => !v)}
                  className={`px-4 py-2 rounded-lg border transition-colors
                    ${roleEnable ? "border-emerald-500/40 text-emerald-300 bg-emerald-900/10" : "border-red-500/40 text-red-300 bg-red-900/10"}`}
                >
                  {roleEnable ? "Enabled" : "Revoked"}
                </button>
              </div>

              <button
                onClick={doSetRole}
                disabled={!canSetRole}
                className={`w-full py-3 font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2
                  ${canSetRole ? "bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500" : "bg-gray-800 opacity-50 cursor-not-allowed"}`}
              >
                {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Users className="w-5 h-5" />}
                Update Role
              </button>

              {!isOwner && (
                <div className="text-sm text-amber-300 mt-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Owner only.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
