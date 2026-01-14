"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { TrendingUp, CheckCircle } from "lucide-react";

const RoadmapSection = () => {
  const ref = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const phases = [
    {
      phase: "Phase 1",
      title: "Foundation",
      period: "Q1–Q2 2026",
      items: [
        "Token deployment & audit",
        "Website + brand launch",
        "Presale rounds",
        "PancakeSwap listing",
        "Basic staking live",
      ],
      status: "current",
    },
    {
      phase: "Phase 2",
      title: "Ecosystem Growth",
      period: "Q3–Q4 2026",
      items: [
        "AI Trading Hub beta",
        "Travel marketplace MVP",
        "Influencer campaigns",
        "MEXC & BitMart listings",
      ],
      status: "upcoming",
    },
    {
      phase: "Phase 3",
      title: "Expansion",
      period: "2026",
      items: [
        "Real-estate tokenization pilot",
        "100,000+ holders",
        "KuCoin / Bybit listing",
        "Staera Academy launch",
      ],
      status: "upcoming",
    },
    {
      phase: "Phase 4",
      title: "Mass Adoption",
      period: "2027",
      items: [
        "Global ambassador program",
        "AI super-app integration",
        "1M+ holders target",
        "Tier-1 CEX exploration",
      ],
      status: "upcoming",
    },
  ];

  return (
    <section
      id="roadmap"
      ref={ref}
      className="relative py-20 sm:py-28 overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute bottom-0 left-1/4 h-[450px] w-[450px] rounded-full bg-gradient-to-r from-[#6F8BFF]/12 via-transparent to-[#FF6FD8]/12 blur-3xl" />
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
            <TrendingUp className="h-4 w-4" />
            STRATEGIC VISION
          </motion.div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-3">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6FD8] via-[#FFCFE9] to-[#6F8BFF]">
              Development Roadmap
            </span>
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 max-w-3xl mx-auto">
            A clear path from launch to large-scale adoption, focused on real
            utility, listings and community growth.
          </p>
        </motion.div>

        {/* timeline */}
        <div className="relative">
          {/* center line on desktop / left line on mobile */}
          <div className="absolute left-4 md:left-1/2 md:-translate-x-1/2 top-0 bottom-0 w-[2px] bg-gradient-to-b from-[#FF6FD8] via-[#A855F7] to-[#6F8BFF]" />

          <div className="space-y-10">
            {phases.map((phase, index) => (
              <motion.div
                key={phase.phase}
                initial={{ opacity: 0, x: index % 2 === 0 ? -40 : 40 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.2 + index * 0.15 }}
                className={`relative flex flex-col md:flex-row ${
                  index % 2 === 0 ? "md:flex-row-reverse" : ""
                } items-center gap-6`}
              >
                {/* dot */}
                <div className="absolute left-4 md:left-1/2 md:-translate-x-1/2">
                  <div
                    className={`h-5 w-5 rounded-full border-4 border-black ${
                      phase.status === "current"
                        ? "bg-gradient-to-r from-[#FF6FD8] to-[#6F8BFF] animate-pulse"
                        : "bg-white/10"
                    }`}
                  />
                </div>

                {/* card */}
                <div
                  className={`ml-12 md:ml-0 md:w-5/12 ${
                    index % 2 === 0 ? "md:pr-8" : "md:pl-8"
                  }`}
                >
                  <motion.div
                    whileHover={{ scale: 1.02, y: -4 }}
                    className="rounded-3xl border border-white/10 bg-black/50 backdrop-blur-xl p-7 shadow-[0_18px_60px_rgba(0,0,0,0.7)]"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-[11px] font-semibold text-transparent bg-clip-text bg-gradient-to-r from-[#FF6FD8] to-[#6F8BFF]">
                          {phase.phase}
                        </div>
                        <h3 className="text-xl font-bold text-white">
                          {phase.title}
                        </h3>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-white">
                          {phase.period}
                        </div>
                        {phase.status === "current" && (
                          <div className="text-xs text-emerald-400 font-semibold">
                            ● LIVE
                          </div>
                        )}
                      </div>
                    </div>

                    <ul className="space-y-2.5">
                      {phase.items.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-2.5 text-sm text-zinc-300"
                        >
                          <CheckCircle className="h-4.5 w-4.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default RoadmapSection;
