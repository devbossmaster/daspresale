"use client";

import { useMemo, useState } from "react";
import { Send, Copy, Check, ExternalLink, AlertCircle } from "lucide-react";
import {
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChains,
} from "wagmi";
import { bsc } from "wagmi/chains";
import { formatUnits, isAddress, parseUnits } from "viem";
import { erc20Abi } from "@/lib/contracts/abi/erc20Abi";
import { useTokenIcoDashboard } from "@/lib/hooks/useTokenIcoDashboard";

function asAddress(v?: string): `0x${string}` | undefined {
  if (!v) return undefined;
  return /^0x[a-fA-F0-9]{40}$/.test(v) ? (v as `0x${string}`) : undefined;
}

// IMPORTANT: static env access (Next can inline these)
const ENV_TOKEN = asAddress(process.env.NEXT_PUBLIC_TMSAT_TOKEN_ADDRESS);

function shortAddr(a?: string) {
  if (!a) return "—";
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

function formatDecimalStr(v?: string, maxFrac = 6) {
  if (!v) return "—";
  const [intRaw, fracRaw = ""] = v.split(".");
  const intPart = (intRaw || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = fracRaw.slice(0, maxFrac).replace(/0+$/, "");
  return frac.length ? `${intPart}.${frac}` : intPart;
}

/** Allow only digits + one dot; clamp fractional digits. */
function normalizeDecimalInput(raw: string, decimals: number) {
  const v = raw.replace(/,/g, "").trim();
  if (v === "") return "";

  let out = "";
  let dotSeen = false;

  for (const ch of v) {
    if (ch >= "0" && ch <= "9") out += ch;
    else if (ch === "." && !dotSeen) {
      dotSeen = true;
      out += ".";
    }
  }

  if (out.startsWith(".")) out = `0${out}`;

  if (dotSeen) {
    const [i, f = ""] = out.split(".");
    out = `${i}.${f.slice(0, Math.max(0, decimals))}`;
  } else {
    out = out.replace(/^0+(?=\d)/, "");
    if (out === "") out = "0";
  }

  // normalize leading zeros for integer part
  if (out.includes(".")) {
    const [i, f = ""] = out.split(".");
    const i2 = i.replace(/^0+(?=\d)/, "") || "0";
    out = `${i2}.${f}`;
  }

  return out;
}

function extractErrText(e: any) {
  return e?.shortMessage || e?.cause?.shortMessage || e?.details || e?.message || "";
}

function humanizeTxError(e: any) {
  const raw = String(extractErrText(e) || "").toLowerCase();

  if (!raw) return "Transaction failed. Please try again.";

  if (raw.includes("user rejected") || raw.includes("rejected the request")) {
    return "Transaction was rejected in your wallet.";
  }
  if (raw.includes("insufficient funds")) {
    return "Insufficient BNB to pay gas fees.";
  }
  if (raw.includes("nonce")) {
    return "Nonce issue detected. Please retry in your wallet, or wait for pending transactions to confirm.";
  }
  if (raw.includes("replacement transaction underpriced")) {
    return "Gas price too low for a replacement transaction. Increase gas and retry.";
  }

  return "Transaction failed. Please try again.";
}

export default function TransferForm() {
  const { address } = useAccount();
  const chainId = useChainId();
  const onBsc = chainId === bsc.id;

  const chains = useChains();
  const chain = chains.find((c) => c.id === chainId);

  const explorerBase = onBsc ? chain?.blockExplorers?.default?.url : undefined;

  const { data: dash, error: dashError, isLoading: dashLoading } = useTokenIcoDashboard();

  // Prefer env token override, else presale token
  const tokenAddr =
    (ENV_TOKEN && isAddress(ENV_TOKEN) ? ENV_TOKEN : dash?.tokenAddr) as
      | `0x${string}`
      | undefined;

  const tokenIsValid = !!tokenAddr && isAddress(tokenAddr);

  const tokenSymbol = useReadContract({
    address: tokenIsValid ? tokenAddr : undefined,
    abi: erc20Abi,
    functionName: "symbol",
    query: { enabled: tokenIsValid && onBsc, refetchInterval: 30_000 },
  });

  const tokenDecimals = useReadContract({
    address: tokenIsValid ? tokenAddr : undefined,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: tokenIsValid && onBsc, refetchInterval: 30_000 },
  });

  const decimals = (tokenDecimals.data ?? dash?.decimals ?? 18) as number;
  const symbol = (tokenSymbol.data ?? dash?.symbol ?? "TOKEN") as string;

  const balance = useReadContract({
    address: tokenIsValid ? tokenAddr : undefined,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && tokenIsValid && onBsc, refetchInterval: 8_000 },
  });

  const balanceRaw = (balance.data as bigint | undefined) ?? 0n;

  const balanceHuman = useMemo(() => {
    if (balance.data === undefined) return "—";
    return formatUnits(balanceRaw, decimals);
  }, [balance.data, balanceRaw, decimals]);

  const [recipient, setRecipient] = useState("");
  const [amountText, setAmountText] = useState("");

  const normalizedAmount = useMemo(
    () => normalizeDecimalInput(amountText, decimals),
    [amountText, decimals]
  );

  const { amountRaw, amountError } = useMemo(() => {
    try {
      if (!normalizedAmount) return { amountRaw: 0n, amountError: null as string | null };
      if (normalizedAmount === "." || normalizedAmount === "0.") return { amountRaw: 0n, amountError: null };
      return { amountRaw: parseUnits(normalizedAmount, decimals), amountError: null };
    } catch {
      return { amountRaw: 0n, amountError: "Invalid amount format." };
    }
  }, [normalizedAmount, decimals]);

  const recipientValid = recipient ? isAddress(recipient) : false;
  const notSelf =
    address && recipientValid ? address.toLowerCase() !== recipient.toLowerCase() : true;
  const hasAmount = amountRaw > 0n;
  const hasEnough = amountRaw <= balanceRaw;

  const [copied, setCopied] = useState(false);
  const handleCopyTokenAddress = async () => {
    try {
      if (!tokenAddr) return;
      await navigator.clipboard.writeText(tokenAddr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors (e.g., permission denied)
    }
  };

  const { writeContractAsync, data: txHash, isPending, error: writeError } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: txHash });

  const [uiError, setUiError] = useState<string | null>(null);
  const [uiErrorDetails, setUiErrorDetails] = useState<string | null>(null);

  const canTransfer =
    onBsc &&
    !!address &&
    tokenIsValid &&
    recipientValid &&
    notSelf &&
    hasAmount &&
    hasEnough &&
    !isPending &&
    !receipt.isLoading &&
    !amountError;

  async function handleTransfer() {
    setUiError(null);
    setUiErrorDetails(null);

    if (!onBsc) {
      setUiError("Please switch your wallet network to BNB Smart Chain (BSC).");
      return;
    }
    if (!canTransfer || !tokenAddr) return;

    try {
      await writeContractAsync({
        address: tokenAddr,
        abi: erc20Abi,
        functionName: "transfer",
        args: [recipient as `0x${string}`, amountRaw],
      });

      // Optional UX: keep recipient, clear amount
      setAmountText("");
    } catch (e: any) {
      setUiError(humanizeTxError(e));
      setUiErrorDetails(extractErrText(e) || null);
    }
  }

  const txUrl = txHash && explorerBase ? `${explorerBase}/tx/${txHash}` : undefined;

  const headerLine = isPending
    ? "Confirm in wallet…"
    : receipt.isLoading
      ? "Waiting confirmation…"
      : `Transfer ${symbol}`;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 sm:p-6 lg:p-8">
      <div className="flex items-start sm:items-center gap-3 mb-6 sm:mb-8">
        <div className="p-2 bg-gradient-to-br from-cyan-900/30 to-purple-900/30 rounded-lg">
          <Send className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Transfer</h2>
          <p className="text-gray-400 text-xs sm:text-sm">Send {symbol} to another wallet.</p>
        </div>
      </div>

      {!onBsc && (
        <div className="mb-5 p-3 rounded-xl border border-amber-800/40 bg-amber-900/20 text-sm text-amber-200">
          Please switch your wallet network to BNB Smart Chain (BSC) to use transfers.
        </div>
      )}

      {(uiError || dashError || writeError) && (
        <div className="mb-5 p-3 rounded-xl border border-red-800/40 bg-red-900/20 text-sm text-red-100">
          <div className="font-semibold">Action required</div>
          <div className="mt-1 text-red-200">
            {uiError ?? humanizeTxError(writeError) ?? "Unable to load token data. Please try again."}
          </div>

          {uiErrorDetails && (
            <details className="mt-2 text-xs text-red-200/80">
              <summary className="cursor-pointer select-none">Details</summary>
              <div className="mt-2 whitespace-pre-wrap break-words opacity-80">{uiErrorDetails}</div>
            </details>
          )}
        </div>
      )}

      {onBsc && !dashLoading && !tokenIsValid && (
        <div className="mb-5 p-3 rounded-xl border border-amber-800/40 bg-amber-900/20 text-sm text-amber-200">
          Token address is not available. Set NEXT_PUBLIC_TMSAT_TOKEN_ADDRESS or ensure the presale token is configured.
        </div>
      )}

      {/* Connected */}
      <div className="mb-6 sm:mb-8">
        <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Wallet</h3>
        <div className="p-3 sm:p-4 bg-gray-800/30 rounded-xl">
          <div className="text-xs sm:text-sm text-gray-400 mb-1">Connected as</div>
          <div className="text-lg sm:text-xl font-bold">{shortAddr(address)}</div>
        </div>
      </div>

      {/* Token Address */}
      <div className="mb-6 sm:mb-8">
        <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Token Address</h3>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 bg-gray-800/30 rounded-xl">
          <div className="font-mono text-xs sm:text-sm break-all">{tokenAddr ?? "—"}</div>
          <button
            onClick={handleCopyTokenAddress}
            className="self-start sm:self-auto p-2 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!tokenIsValid}
            type="button"
            title="Copy token address"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
          </button>
        </div>
      </div>

      {/* Balance */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-gray-800/30 rounded-xl">
          <div>
            <div className="text-xs sm:text-sm text-gray-400">Your Balance</div>
            <div className="text-xl sm:text-2xl font-bold">
              {balance.isLoading ? "Loading..." : `${formatDecimalStr(balanceHuman, 6)} ${symbol}`}
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs sm:text-sm text-green-400">Available</div>
            <button
              onClick={() => {
                if (balanceHuman !== "—") setAmountText(balanceHuman);
              }}
              className="text-xs sm:text-sm text-cyan-400 hover:text-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={balanceHuman === "—" || !tokenIsValid || !onBsc}
              type="button"
            >
              Max
            </button>
          </div>
        </div>
      </div>

      {/* Recipient */}
      <div className="mb-6 sm:mb-8">
        <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Recipient Address</h3>
        <div className="relative">
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value.trim())}
            className="w-full px-4 py-2.5 sm:py-3 bg-gray-800 border border-gray-700 rounded-xl font-mono text-xs sm:text-sm break-all focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            placeholder="0x..."
            spellCheck={false}
            autoComplete="off"
          />
          {explorerBase && recipientValid && (
            <a
              href={`${explorerBase}/address/${recipient}`}
              target="_blank"
              rel="noreferrer"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-700 rounded"
              title="View address on explorer"
            >
              <ExternalLink className="w-4 h-4 text-gray-400" />
            </a>
          )}
        </div>

        {recipient.length > 0 && !recipientValid && (
          <p className="mt-2 text-xs text-yellow-300">Invalid recipient address.</p>
        )}
        {recipientValid && !notSelf && (
          <p className="mt-2 text-xs text-yellow-300">Recipient cannot be your own address.</p>
        )}
      </div>

      {/* Amount */}
      <div className="mb-6 sm:mb-8">
        <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Amount</h3>

        <div className="relative">
          <input
            inputMode="decimal"
            type="text"
            value={normalizedAmount}
            onChange={(e) => setAmountText(e.target.value)}
            className="w-full px-4 py-2.5 sm:py-3 bg-gray-800 border border-gray-700 rounded-xl text-lg sm:text-2xl font-bold text-right focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            placeholder="0.0"
            spellCheck={false}
            autoComplete="off"
          />

          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-xs sm:text-sm text-gray-400">
            {symbol}
          </div>

          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <button
              onClick={() => setAmountText("")}
              className="text-xs sm:text-sm text-gray-400 hover:text-white"
              type="button"
            >
              Clear
            </button>
          </div>
        </div>

        {amountError && <p className="mt-2 text-xs text-yellow-300">{amountError}</p>}
        {!amountError && normalizedAmount && hasAmount && !hasEnough && (
          <p className="mt-2 text-xs text-yellow-300">Amount exceeds your balance.</p>
        )}
      </div>

      {/* Action */}
      <div className="pt-4 sm:pt-6 border-t border-gray-800 space-y-3">
        <button
          onClick={handleTransfer}
          disabled={!canTransfer}
          className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm sm:text-lg rounded-xl transition-all duration-300 flex items-center justify-center gap-2"
          type="button"
        >
          <Send className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>{headerLine}</span>
        </button>

        {!address && (
          <div className="flex items-start gap-2 text-xs sm:text-sm text-amber-200 bg-amber-900/20 border border-amber-800/40 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <span>Connect your wallet to transfer tokens.</span>
          </div>
        )}

        {txHash && (
          <div className="text-xs sm:text-sm text-gray-300">
            Tx:{" "}
            {txUrl ? (
              <a className="text-cyan-300 hover:text-cyan-200" href={txUrl} target="_blank" rel="noreferrer">
                {shortAddr(txHash)}
              </a>
            ) : (
              shortAddr(txHash)
            )}
          </div>
        )}

        {receipt.isSuccess && (
          <div className="text-xs sm:text-sm text-green-300">Transfer confirmed.</div>
        )}
      </div>
    </div>
  );
}
