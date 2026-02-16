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

const Hero = () => {
  const ref = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  
  // State for MetaMask integration
  const [metaMaskStatus, setMetaMaskStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [copied, setCopied] = useState(false);

  // Stats data (only two as per your image)
  const stats = [
    { label: "Total Supply", value: "21M", sub: "$AERA Tokens", icon: TrendingUp },
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
    setMetaMaskStatus("loading");
    
    try {
      const ethereum = (window as any).ethereum;

      if (!ethereum) {
        setMetaMaskStatus("error");
        window.open("https://metamask.io/download/", "_blank");
        setTimeout(() => setMetaMaskStatus("idle"), 3000);
        return;
      }

      await ethereum.request({ method: "eth_requestAccounts" });

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
        setTimeout(() => setMetaMaskStatus("idle"), 3000);
      } else {
        setMetaMaskStatus("idle");
      }
    } catch (error) {
      console.error("Error adding token to MetaMask:", error);
      setMetaMaskStatus("error");
      setTimeout(() => setMetaMaskStatus("idle"), 3000);
    }
  };

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

  // Floating animation for background orbs
  const floatingAnimation = {
    y: [0, -20, 0],
    transition: {
      duration: 6,
      repeat: Infinity,
      ease: "easeInOut",
    },
  };

  return (
    <section
      id="home"
      ref={ref}
      className="relative overflow-hidden bg-black pt-24 pb-16"
    >
      {/* Animated gradient orbs background */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
            x: ['-10%', '10%', '-10%'],
            y: ['-10%', '10%', '-10%'],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full
                     bg-gradient-to-r from-cyan-500/20 to-purple-500/20 blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            rotate: [0, -90, 0],
            x: ['10%', '-10%', '10%'],
            y: ['10%', '-10%', '10%'],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] rounded-full
                     bg-gradient-to-r from-purple-500/20 to-pink-500/20 blur-3xl"
        />
        {/* Grid overlay */}
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20" />
      </div>

      <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="max-w-6xl mx-auto text-center"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-flex items-center gap-3 px-4 py-2.5 rounded-full
                       bg-gradient-to-r from-cyan-900/30 via-purple-900/30 to-pink-900/30
                       border border-cyan-500/20 backdrop-blur-xl mb-6
                       shadow-lg shadow-cyan-500/10"
          >
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="text-xs sm:text-sm font-medium bg-gradient-to-r
                             from-cyan-300 via-purple-300 to-pink-300
                             bg-clip-text text-transparent">
              THE NEXT BITCOIN
            </span>
          </motion.div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight mb-4">
            <span className="block bg-gradient-to-r from-cyan-400 via-white to-purple-400 bg-clip-text text-transparent">
              Multi-Utility Web3 Ecosystem
            </span>
          </h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: 0.5, duration: 0.7 }}
            className="text-base sm:text-lg md:text-xl text-gray-300 mb-6
                       max-w-3xl mx-auto leading-relaxed"
          >
            Staera revolutionizes the blockchain space by unifying{" "}
            <span className="font-semibold text-cyan-300">DeFi</span>,{" "}
            <span className="font-semibold text-purple-300">AI Projects</span>,{" "}
            <span className="font-semibold text-purple-300">Real-World Assets</span>, and{" "}
            <span className="font-semibold text-purple-300">Web3 Gaming</span> into a single,
            seamless <span className="font-bold text-blue-300">$AERA</span> powered experience.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="flex flex-col sm:flex-row flex-wrap justify-center gap-4 mb-6"
          >
            <button className="group relative overflow-hidden px-8 py-4 rounded-2xl
                               bg-gradient-to-r from-cyan-600 via-purple-600 to-pink-600
                               hover:from-cyan-500 hover:via-purple-500 hover:to-pink-500
                               transition-all duration-500 shadow-lg hover:scale-[1.02]
                               active:scale-[0.98] flex-1 sm:flex-none min-w-[200px]
                               border border-white/10">
              <span className="relative flex items-center justify-center gap-3 text-base sm:text-lg font-bold text-white">
                <Rocket className="w-5 h-5" />
                Join Presale Now
                <ExternalLink className="w-5 h-5" />
              </span>
              <div className="absolute inset-0 -z-10 bg-gradient-to-r from-cyan-600 via-purple-600 to-pink-600 blur-xl opacity-0 group-hover:opacity-70 transition-opacity duration-500" />
            </button>

            <button
              onClick={addTokenToMetaMask}
              disabled={metaMaskStatus === "loading"}
              className={getButtonClasses()}
            >
              {getButtonContent()}
            </button>
          </motion.div>

          {/* Token Address Copy */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="flex items-center justify-center gap-2 mb-8"
          >
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl
                            bg-gray-900/50 border border-gray-800 backdrop-blur-sm">
              <span className="text-xs sm:text-sm text-gray-400 font-mono">
                {tokenDetails.address.slice(0, 6)}...{tokenDetails.address.slice(-4)}
              </span>
              <button
                onClick={copyToClipboard}
                className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Copy className={`w-4 h-4 ${copied ? 'text-green-400' : 'text-gray-400'}`} />
              </button>
            </div>
            <span className="text-xs text-gray-500">Token Address</span>
          </motion.div>

          {/* Stats Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="grid grid-cols-2 gap-4 max-w-2xl mx-auto"
          >
            {stats.map(({ label, value, sub, icon: Icon }, index) => (
              <motion.div
                key={label}
                whileHover={{ scale: 1.05, y: -5 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="p-5 rounded-2xl border border-gray-800
                           bg-gradient-to-b from-gray-900/60 to-black/60
                           backdrop-blur-xl hover:border-cyan-500/30
                           transition-all duration-300 group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-900/30 to-purple-900/30 
                                  border border-cyan-500/20 group-hover:border-cyan-400/50
                                  transition-colors duration-300">
                    <Icon className="w-4 h-4 text-cyan-400 group-hover:text-cyan-300" />
                  </div>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    {label}
                  </div>
                </div>
                <div className="text-xl font-bold text-white mb-1">{value}</div>
                <div className="text-xs text-gray-500">{sub}</div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;