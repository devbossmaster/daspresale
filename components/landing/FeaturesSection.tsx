"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Zap, ExternalLink } from "lucide-react";

const FeaturesSection = () => {
  const ref = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const features = [
    {
      icon: "🤖",
      title: "AI Trading Hub",
      description:
        "AI-driven signals, automated bots and copy-trading with subscriptions payable in $AERA.",
      gradient: "from-[#FF6FD8] to-[#FFB86C]",
    },
    {
      icon: "✈️",
      title: "Travel Marketplace",
      description:
        "Web3-native booking portal for flights, hotels and packages with loyalty rewards.",
      gradient: "from-[#6F8BFF] to-[#8F8CFF]",
    },
    {
      icon: "🎓",
      title: "Digital Academy",
      description:
        "Premium education in trading, business and real estate with revenue sharing to holders.",
      gradient: "from-[#FFB86C] to-[#FF6FD8]",
    },
    {
      icon: "🏠",
      title: "Real Estate Tokenization",
      description:
        "Fractional ownership of global properties with rental yields distributed in $AERA.",
      gradient: "from-[#8F8CFF] to-[#6F8BFF]",
    },
    {
      icon: "🎮",
      title: "Gaming & Engagement",
      description:
        "Play-to-earn loops, quests, leaderboards and spin-to-win mechanics.",
      gradient: "from-[#FF6FD8] to-[#8F8CFF]",
    },
    {
      icon: "💰",
      title: "Staking Vault",
      description:
        "Flexible and long-term staking options with boosted APR for committed holders.",
      gradient: "from-[#6F8BFF] to-[#FF6FD8]",
    },
  ];

  return (
    <section
      id="features"
      ref={ref}
      className="relative overflow-hidden mt-12"
    >
      {/* subtle bg */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-1/3 left-1/3 h-[500px] w-[500px] rounded-full bg-gradient-to-r from-[#FF6FD8]/10 via-transparent to-[#6F8BFF]/10 blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-14"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-4 py-1.5 text-xs font-medium text-purple-100 backdrop-blur-xl mb-5"
          >
            <Zap className="h-4 w-4" />
            CORE ECOSYSTEM
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4"
          >
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6FD8] via-[#FFCFE9] to-[#6F8BFF]">
              Multi-Utility Ecosystem
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.3 }}
            className="text-sm sm:text-base text-zinc-400 max-w-3xl mx-auto"
          >
            One token powers everything: AI trading, travel, education, real
            estate, gaming and staking in a unified Web3 stack.
          </motion.p>
        </motion.div>

        {/* grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{ delay: 0.35 + index * 0.05 }}
              whileHover={{ y: -6, scale: 1.02 }}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 p-7 backdrop-blur-xl hover:border-white/25 transition-all duration-300"
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500`}
              />

              {/* icon */}
              <div className="mb-5 relative">
                <div
                  className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${feature.gradient} text-2xl shadow-lg`}
                >
                  {feature.icon}
                </div>
              </div>

              <h3 className="relative text-lg font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="relative text-sm text-zinc-400 leading-relaxed mb-4">
                {feature.description}
              </p>

              <button className="relative flex items-center gap-2 text-xs font-medium text-transparent bg-clip-text bg-gradient-to-r from-[#FF6FD8] to-[#6F8BFF] group-hover:gap-3 transition-all">
                Learn more
                <ExternalLink className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
