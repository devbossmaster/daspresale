"use client";

import { useRef, useState, useCallback } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  Rocket,
  ExternalLink,
  Sparkles,
  Globe,
  TrendingUp,
  Wallet,
  CheckCircle,
  XCircle,
  Loader2,
  Copy,
} from "lucide-react";
import Link from "next/link";
import AeraPrismVisual from "./AeraPrismVisual";
import { SwapCountdown } from "./SwapCountdown";

type MetaMaskStatus = "idle" | "loading" | "success" | "error";

const BSC_CHAIN_ID = "0x38"; // 56

const BSC_PARAMS = {
  chainId: BSC_CHAIN_ID,
  chainName: "BNB Smart Chain",
  nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  rpcUrls: ["https://bnb-mainnet.g.alchemy.com/v2/6UaUjDBWPAHXTN_IPZ7GR"],
  blockExplorerUrls: ["https://bscscan.com/"],
};

const getEthereum = () => (window as any)?.ethereum as any | undefined;

const ensureBSCNetwork = async (ethereum: any) => {
  const currentChainId = await ethereum.request({ method: "eth_chainId" });
  if (currentChainId === BSC_CHAIN_ID) return;

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BSC_CHAIN_ID }],
    });
  } catch (switchErr: any) {
    if (switchErr?.code === 4902) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [BSC_PARAMS],
      });
    } else {
      throw switchErr;
    }
  }
};

const watchAsset = async (ethereum: any, token: any) => {
  return await ethereum.request({
    method: "wallet_watchAsset",
    params: {
      type: "ERC20",
      options: {
        address: token.address,
        symbol: token.symbol,
        decimals: token.decimals,
        image: token.image || undefined,
      },
    },
  });
};

export default function Hero() {
  const ref = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const [metaMaskStatus, setMetaMaskStatus] = useState<MetaMaskStatus>("idle");
  const [copied, setCopied] = useState(false);

 

  const tokenDetails = {
    address: "0x2191f59b994E7Ad5BFf3C2F3abDe36167570822F",
    symbol: "AERA",
    decimals: 18,
    image: "",
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(tokenDetails.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      console.error("Clipboard copy failed:", e);
    }
  };

  const addTokenToMetaMask = useCallback(async () => {
    setMetaMaskStatus("loading");

    try {
      const ethereum = getEthereum();

      if (!ethereum?.isMetaMask) {
        setMetaMaskStatus("error");
        window.open("https://metamask.io/download/", "_blank", "noopener,noreferrer");
        setTimeout(() => setMetaMaskStatus("idle"), 1600);
        return;
      }

      await ensureBSCNetwork(ethereum);

      try {
        const wasAdded = await watchAsset(ethereum, tokenDetails);

        if (wasAdded) {
          setMetaMaskStatus("success");
          setTimeout(() => setMetaMaskStatus("idle"), 1600);
        } else {
          setMetaMaskStatus("idle");
        }
        return;
      } catch (err: any) {
        const needsPermissions =
          err?.code === 4100 || err?.message?.toLowerCase?.().includes("unauthorized");

        if (!needsPermissions) throw err;
      }

      await ethereum.request({ method: "eth_requestAccounts" });
      const wasAdded = await watchAsset(ethereum, tokenDetails);

      if (wasAdded) {
        setMetaMaskStatus("success");
        setTimeout(() => setMetaMaskStatus("idle"), 1600);
      } else {
        setMetaMaskStatus("idle");
      }
    } catch (error: any) {
      if (error?.code === 4001) {
        setMetaMaskStatus("idle");
        return;
      }

      if (error?.code === -32002) {
        setMetaMaskStatus("loading");
        setTimeout(() => setMetaMaskStatus("idle"), 1600);
        return;
      }

      console.error("Error adding token to MetaMask:", error);
      setMetaMaskStatus("error");
      setTimeout(() => setMetaMaskStatus("idle"), 1600);
    }
  }, [tokenDetails.address, tokenDetails.symbol, tokenDetails.decimals, tokenDetails.image]);

  const getButtonContent = () => {
    switch (metaMaskStatus) {
      case "loading":
        return (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-violet-300" />
            <span className="text-sm sm:text-base font-medium text-white/90">Adding...</span>
          </>
        );
      case "success":
        return (
          <>
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            <span className="text-sm sm:text-base font-medium text-emerald-300">Added</span>
          </>
        );
      case "error":
        return (
          <>
            <XCircle className="h-4 w-4 text-red-400" />
            <span className="text-sm sm:text-base font-medium text-red-300">Install MetaMask</span>
          </>
        );
      default:
        return (
          <>
            <Wallet className="h-4 w-4 text-violet-300" />
            <span className="text-sm sm:text-base font-medium text-white/90">Add to MetaMask</span>
          </>
        );
    }
  };

  return (
    <section
      id="home"
      ref={ref}
        className="relative overflow-hidden pt-12"
    >
   {/* Hero-only overlays (transparent feel, no dark wash layer) */}
  <div className="pointer-events-none absolute inset-0">
    {/* removed heavy black gradient overlay for transparent hero look */}
    <div className="absolute -top-20 left-1/2 h-[20rem] w-[40rem] -translate-x-1/2 rounded-full bg-violet-500/8 blur-3xl" />
    <div className="absolute top-8 right-[-8rem] h-[16rem] w-[16rem] rounded-full bg-indigo-500/8 blur-3xl" />
    <div className="absolute bottom-[-5rem] left-1/2 h-[12rem] w-[52rem] -translate-x-1/2 rounded-full bg-sky-400/8 blur-3xl" />
  </div>
      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-start gap-8 lg:items-center lg:gap-10 lg:grid-cols-12">
          {/* LEFT SIDE */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7 }}
            className="min-w-0 lg:col-span-6 xl:col-span-6"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: 0.1, duration: 0.45 }}
              className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-2 backdrop-blur-xl"
            >
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/25 to-sky-400/20 ring-1 ring-white/10">
                <Sparkles className="h-3.5 w-3.5 text-violet-200" />
              </span>
              <span className="truncate text-[11px] sm:text-xs font-medium tracking-[0.18em] uppercase text-white/70">
                THE NEXT BITCOIN
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-[2.2rem] leading-[0.95] font-bold tracking-tight text-white sm:text-5xl md:text-6xl xl:text-7xl"
              style={{ textShadow: "0 8px 30px rgba(0,0,0,0.32)" }}
            >
              Bring Real-World <br />
              Assets On-{" "}
              <span className="bg-gradient-to-r from-violet-300 to-violet-500 bg-clip-text text-transparent">
                Chain
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.32, duration: 0.55 }}
              className="mt-5 max-w-xl text-sm leading-7 text-white/70 sm:text-base sm:leading-8 md:text-lg"
            >
             <SwapCountdown
  targetDate="2026-02-27T05:26:00Z"
  title="Swap Opens In"
  subtitle="Countdown to $AERA swap launch • Feb 27, 11:11 AM NPT"
/>
              Staera unifies <span className="font-semibold text-white/90">DeFi</span>,{" "}
              <span className="font-semibold text-white/90">AI projects</span>,{" "}
              <span className="font-semibold text-white/90">real-world assets</span>, and{" "}
              <span className="font-semibold text-white/90">Web3 gaming</span> into one seamless
              ecosystem powered by <span className="font-bold text-violet-300">$AERA</span>.
            </motion.p>

          {/* CTA Buttons - mobile 2x2 grid / desktop keeps current style */}
<motion.div
  initial={{ opacity: 0, y: 16 }}
  animate={isInView ? { opacity: 1, y: 0 } : {}}
  transition={{ delay: 0.42, duration: 0.55 }}
  className="mt-7 grid max-w-md grid-cols-2 gap-3 sm:max-w-xl sm:grid-cols-2"
>
  {/* Buy $AERA */}
  <Link
    href="/token-sale"
    className="group inline-flex h-14 w-full min-w-0 items-center justify-center gap-2 rounded-full px-4
               text-sm sm:text-base font-semibold text-white
               bg-gradient-to-r from-violet-500 to-purple-600
               shadow-[0_8px_30px_rgba(124,58,237,0.35)]
               hover:shadow-[0_12px_40px_rgba(124,58,237,0.45)]
               hover:-translate-y-0.5 transition-all duration-300"
  >
    <Rocket className="h-4 w-4 shrink-0" />
    <span className="truncate">Buy $AERA</span>
    <ExternalLink className="h-4 w-4 shrink-0" />
  </Link>

  {/* Add to MetaMask */}
  <button
    onClick={addTokenToMetaMask}
    disabled={metaMaskStatus === "loading"}
    className="inline-flex h-14 w-full min-w-0 items-center justify-center gap-2 rounded-full
               border border-white/10 bg-white/[0.03] backdrop-blur-xl
               px-4 text-sm sm:text-base font-medium text-white/90
               hover:bg-white/[0.06] hover:border-white/20
               hover:-translate-y-0.5 transition-all duration-300
               disabled:opacity-70 disabled:cursor-not-allowed"
  >
    <AnimatePresence mode="wait">
      <motion.span
        key={metaMaskStatus}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.15 }}
        className="inline-flex min-w-0 items-center gap-2"
      >
        {getButtonContent()}
      </motion.span>
    </AnimatePresence>
  </button>

  {/* Whitepaper - mobile grid item / desktop full-width row */}
  <Link
    href="/staera.pdf"
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex h-12 w-full min-w-0 items-center justify-center gap-2 rounded-full
               border border-white/10 bg-black/20 px-4 text-sm text-white/80 backdrop-blur-xl
               transition hover:bg-white/[0.04] hover:border-violet-300/20
               sm:col-span-2"
  >
    <span className="truncate">Whitepaper</span>
    <ExternalLink className="h-4 w-4 shrink-0 text-violet-300" />
  </Link>

  {/* BscScan - MOBILE ONLY (becomes 4th grid item) */}
  <a
    href={`https://bscscan.com/token/${tokenDetails.address}`}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex h-12 w-full items-center justify-center gap-1 rounded-full
               border border-white/10 bg-white/[0.02] px-4 text-sm text-white/70
               transition hover:bg-white/[0.06] hover:text-white sm:hidden"
  >
    BscScan
    <ExternalLink className="h-3.5 w-3.5" />
  </a>
</motion.div>
</motion.div>

        {/* RIGHT SIDE - Animated Visual */}
<motion.div
  initial={{ opacity: 0, x: 24 }}
  animate={isInView ? { opacity: 1, x: 0 } : {}}
  transition={{ delay: 0.2, duration: 0.65 }}
  className="min-w-0 lg:col-span-6 xl:col-span-6 lg:-mt-2"
>
  <div className="relative mx-auto w-full max-w-[680px]">
    {/* Visual (transparent, no frame) */}
    <div className="relative overflow-visible rounded-3xl bg-transparent">
      <AeraPrismVisual />
    </div>

    {/* Floating chips - hidden on mobile for clean layout */}
    <motion.div
      className="absolute left-4 top-6 hidden rounded-xl border border-white/10 bg-black/25 px-3 py-2 backdrop-blur-xl sm:block"
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    >
      <p className="text-[10px] uppercase tracking-[0.16em] text-white/50">Network</p>
      <p className="text-sm font-semibold text-white">BNB Smart Chain</p>
    </motion.div>

    <motion.div
      className="absolute right-6 bottom-5 hidden rounded-xl border border-violet-300/15 bg-black/70 px-4 py-2 backdrop-blur-xl sm:block"
      animate={{ y: [0, 4, 0], opacity: [0.9, 1, 0.9] }}
      transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
    >
      <p className="text-[10px] uppercase tracking-[0.16em] text-white/50">Token</p>
      <p className="text-sm font-semibold text-violet-200">$AERA</p>
    </motion.div>
  </div>
</motion.div>
        </div>
      </div>
    </section>
  );
}