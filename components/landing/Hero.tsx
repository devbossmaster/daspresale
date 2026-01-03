"use client";

import { useRef } from "react";
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
} from "lucide-react";
import PresaleCard from "./PresaleCard";

const Hero = () => {
  const ref = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const stats = [
    { label: "Supply", value: "1B", sub: "$AERA Tokens", icon: TrendingUp },
    { label: "Network", value: "BSC", sub: "Binance Smart Chain", icon: Globe },
  ];

  const addTokenToMetaMask = async () => {
    try {
      // AERA Token Details
      const tokenAddress = "0x799aE8cc69Ae5Bb69888B39518F4B4ED18afd4b3"; // AERA token address
      const tokenSymbol = "AERA";
      const tokenDecimals = 18;
      const tokenImage = ""; // Add your token logo URL here

      // Narrow or cast window.ethereum to any so TypeScript allows request()
      const ethereum = (typeof window !== "undefined" ? (window as any).ethereum : undefined);

      if (ethereum && ethereum.isMetaMask) {
        await ethereum.request({
          method: "wallet_watchAsset",
          params: {
            type: "ERC20",
            options: {
              address: tokenAddress,
              symbol: tokenSymbol,
              decimals: tokenDecimals,
              image: tokenImage,
            },
          },
        });
      } else {
        alert("Please install MetaMask to add tokens!");
      }
    } catch (error) {
      console.error("Error adding token to MetaMask:", error);
    }
  };

  return (
    <section
      id="home"
      ref={ref}
      // NOTE: no bg-* here => transparent, uses page background
      className="relative mt-6 flex flex-col items-center"
    >
      {/* Main content – free, full width like other pages */}
      <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Top text block */}
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
          <h1 className="text-3xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight mb-6">
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
            <span className="font-semibold text-cyan-300">AI trading</span>,{" "}
            <span className="font-semibold text-purple-300">travel</span>,{" "}
            <span className="font-semibold text-pink-300">real-estate</span>, and{" "}
            <span className="font-semibold text-white">gaming</span> into a single,
            seamless <span className="font-bold text-white">$AERA</span>-powered experience.
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
                               transition-all duration-500 shadow-lg
                               flex-1 sm:flex-none min-w-[200px]">
              <span className="relative flex items-center justify-center gap-3 text-base sm:text-lg font-bold">
                <Rocket className="w-5 h-5" />
                Join Presale Now
                <ExternalLink className="w-5 h-5" />
              </span>
            </button>

            <button className="px-8 py-4 rounded-2xl border border-gray-700
                               bg-gray-900/50 backdrop-blur-xl
                               hover:border-cyan-400/50 hover:bg-gray-800/50
                               transition-all duration-300 flex items-center justify-center gap-3
                               flex-1 sm:flex-none min-w-[200px]">
              <Shield className="w-5 h-5 text-gray-300" />
              <span className="text-base sm:text-lg font-semibold text-gray-200">
                View Whitepaper
              </span>
            </button>

            <button 
              onClick={addTokenToMetaMask}
              className="px-8 py-4 rounded-2xl border border-gray-700
                         bg-gray-900/50 backdrop-blur-xl
                         hover:border-purple-400/50 hover:bg-gray-800/50
                         transition-all duration-300 flex items-center justify-center gap-3
                         flex-1 sm:flex-none min-w-[200px]">
              <Wallet className="w-5 h-5 text-purple-300" />
              <span className="text-base sm:text-lg font-semibold text-gray-200">
                Add to MetaMask
              </span>
            </button>
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
                           transition-all duration-300"
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