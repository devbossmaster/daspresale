"use client";

import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import {
  Rocket,
  Shield,
  ExternalLink,
  Sparkles,
  Globe,
  Cpu,
  TrendingUp,
  Wallet,
  CheckCircle,
  XCircle,
  Loader2,
  Copy,
} from "lucide-react";
import PresaleCard from "./PresaleCard";

const Hero = () => {
  const ref = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  
  // State for MetaMask integration
  const [metaMaskStatus, setMetaMaskStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [copied, setCopied] = useState(false);

  const stats = [
    { label: "Supply", value: "1B", sub: "$AERA Tokens", icon: TrendingUp },
    { label: "Network", value: "BSC", sub: "Binance Smart Chain", icon: Globe },
  ];

  // Token details
  const tokenDetails = {
    address: "0x799aE8cc69Ae5Bb69888B39518F4B4ED18afd4b3",
    symbol: "AERA",
    decimals: 18,
    image: "", // Add your token logo URL here
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(tokenDetails.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addTokenToMetaMask = async () => {
    // Reset status
    setMetaMaskStatus("loading");
    
    try {
      const ethereum = (window as any).ethereum;

      if (!ethereum) {
        setMetaMaskStatus("error");
        // Open MetaMask download page in new tab
        window.open("https://metamask.io/download/", "_blank");
        return;
      }

      // Request account access if needed
      await ethereum.request({ method: "eth_requestAccounts" });

      // Add token to MetaMask
      const wasAdded = await ethereum.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address: tokenDetails.address,
            symbol: tokenDetails.symbol,
            decimals: tokenDetails.decimals,
            image: tokenDetails.image,
          },
        },
      });

      if (wasAdded) {
        setMetaMaskStatus("success");
        // Reset to idle after 3 seconds
        setTimeout(() => setMetaMaskStatus("idle"), 3000);
      } else {
        setMetaMaskStatus("idle");
      }
    } catch (error) {
      console.error("Error adding token to MetaMask:", error);
      setMetaMaskStatus("error");
      // Reset to idle after 3 seconds
      setTimeout(() => setMetaMaskStatus("idle"), 3000);
    }
  };

  // Get button content based on status
  const getButtonContent = () => {
    switch (metaMaskStatus) {
      case "loading":
        return (
          <>
            <Loader2 className="w-5 h-5 text-purple-300 animate-spin" />
            <span className="text-base sm:text-lg font-semibold text-gray-200">
              Adding...
            </span>
          </>
        );
      case "success":
        return (
          <>
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-base sm:text-lg font-semibold text-green-400">
              Added Successfully!
            </span>
          </>
        );
      case "error":
        return (
          <>
            <XCircle className="w-5 h-5 text-red-400" />
            <span className="text-base sm:text-lg font-semibold text-red-400">
              Install MetaMask
            </span>
          </>
        );
      default:
        return (
          <>
            <Wallet className="w-5 h-5 text-purple-300" />
            <span className="text-base sm:text-lg font-semibold text-gray-200">
              Add $AERA to MetaMask
            </span>
          </>
        );
    }
  };

  // Get button classes based on status
  const getButtonClasses = () => {
    const baseClasses = `px-8 py-4 rounded-2xl backdrop-blur-xl
      transition-all duration-300 flex items-center justify-center gap-3
      flex-1 sm:flex-none min-w-[200px] disabled:opacity-50 disabled:cursor-not-allowed`;
    
    switch (metaMaskStatus) {
      case "loading":
        return `${baseClasses} border border-purple-500/50 bg-purple-900/30 cursor-wait`;
      case "success":
        return `${baseClasses} border border-green-500/50 bg-green-900/20`;
      case "error":
        return `${baseClasses} border border-red-500/50 bg-red-900/20`;
      default:
        return `${baseClasses} border border-gray-700 bg-gray-900/50
          hover:border-purple-400/50 hover:bg-gray-800/50
          hover:scale-[1.02] active:scale-[0.98]`;
    }
  };

  return (
    <section
      id="home"
      ref={ref}
      className="relative mt-6 flex flex-col items-center"
    >
      <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 space-y-12">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="max-w-5xl mx-auto text-center"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-flex items-center gap-3 px-4 py-2.5 rounded-full
                       bg-gradient-to-r from-cyan-900/30 via-purple-900/30 to-pink-900/30
                       border border-cyan-500/20 backdrop-blur-xl mb-6 sm:mb-8"
          >
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="text-xs sm:text-sm font-medium bg-gradient-to-r
                             from-cyan-300 via-purple-300 to-pink-300
                             bg-clip-text text-transparent">
              NEXT-GEN WEB3 ECOSYSTEM
            </span>
          </motion.div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight mb-6">
            <span className="block bg-gradient-to-r from-cyan-400 via-white to-purple-400 bg-clip-text text-transparent">
              Multi-Utility Web3 Ecosystem
            </span>
          </h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: 0.5, duration: 0.7 }}
            className="text-base sm:text-lg md:text-xl text-gray-300 mb-1
                       max-w-3xl mx-auto leading-relaxed"
          >
            Staera revolutionizes the blockchain space by unifying{" "}
            <span className="font-semibold text-cyan-300">De-fi</span>,{" "}
            <span className="font-semibold text-purple-300">AI Projects</span>,{" "}
            <span className="font-semibold text-purple-300">Real-World Assets</span>, and{" "}
            <span className="font-semibold text-purple-300">Web3 Gaming</span> into a single,
            seamless <span className="font-bold text-blue-300">$AERA</span> powered experience.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="flex flex-col sm:flex-row flex-wrap justify-center gap-4 mb-10"
          >
            <button className="group relative mt-5 overflow-hidden px-8 py-4 rounded-2xl
                               bg-gradient-to-r from-cyan-600 via-purple-600 to-pink-600
                               hover:from-cyan-500 hover:via-purple-500 hover:to-pink-500
                               transition-all duration-500 shadow-lg hover:scale-[1.02]
                               active:scale-[0.98] flex-1 sm:flex-none min-w-[200px]">
              <span className="relative flex items-center justify-center gap-3 text-base sm:text-lg font-bold">
                <Rocket className="w-5 h-5" />
                Join Presale Now
                <ExternalLink className="w-5 h-5" />
              </span>
            </button>

            {/* Enhanced Add to MetaMask Button */}
            <button
              onClick={addTokenToMetaMask}
              disabled={metaMaskStatus === "loading"}
              className={getButtonClasses()}
            >
              {getButtonContent()}
            </button>

            {/* Token Address Copy Button */}
          
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="grid grid-cols-2 md:grid-cols-2 gap-4"
          >
            {stats.map(({ label, value, sub, icon: Icon }) => (
              <div
                key={label}
                className="p-5 rounded-2xl border border-gray-800
                           bg-gradient-to-b from-gray-900/60 to-black/60
                           backdrop-blur-xl hover:border-cyan-500/30
                           transition-all duration-300 hover:scale-[1.02]"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-900/30 to-purple-900/30 border border-cyan-500/20">
                    <Icon className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    {label}
                  </div>
                </div>
                <div className="text-xl font-bold text-white mb-1">{value}</div>
                <div className="text-xs text-gray-500">{sub}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;