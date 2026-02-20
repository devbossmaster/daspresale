"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Sparkles } from "lucide-react";
import {
  ArcElement,
  Chart as ChartJS,
  Legend,
  Tooltip,
  ChartOptions,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

const TokenomicsSection = () => {
  const ref = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const tokenData = {
    totalSupply: "21,000,000",
    allocations: [
      { label: "Public Presale", value: 15, color: "#FF6FD8" },
      { label: "Liquidity Pool", value: 25, color: "#3eb44f" },
      { label: "Rewards", value: 25, color: "#6F8BFF" },
      { label: "Ecosystem Growth", value: 5, color: "#A855F7" },
      { label: "Team", value: 10, color: "#8B5CF6" },
      { label: "Strategic Partnership", value: 5, color: "#EC4899" },
      { label: "Treasury", value: 10, color: "#3B82F6" },
      { label: "Marketing & Airdrop", value: 5, color: "#F97316" },
    ],
  };

  const chartData = {
    labels: tokenData.allocations.map((a) => a.label),
    datasets: [
      {
        data: tokenData.allocations.map((a) => a.value),
        backgroundColor: tokenData.allocations.map((a) => a.color),
        borderWidth: 2,
        borderColor: "#020617", // near-slate-950
        hoverBorderColor: "#020617",
        spacing: 3,
        borderRadius: 12,
      },
    ],
  };

  const chartOptions: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "75%",
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => `${context.label}: ${context.raw}%`,
        },
      },
    },
    animation: {
      animateRotate: true,
      animateScale: true,
    },
  };

  return (
    <section
      id="tokenomics"
      ref={ref}
      className="relative py-20 sm:py-28 overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/3 h-72 w-72 rounded-full bg-[#FF6FD8]/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/3 h-72 w-72 rounded-full bg-[#6F8BFF]/10 blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-4 py-1.5 text-xs font-medium text-purple-100 backdrop-blur-xl mb-5">
            <Sparkles className="h-4 w-4" />
            TOKEN DISTRIBUTION
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6FD8] via-[#FFCFE9] to-[#6F8BFF]">
              Tokenomics
            </span>
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto">
            Fixed supply of 21,000,000 $AERA with allocations optimized for
            long-term ecosystem growth, rewards, and liquidity.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* chart */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={isInView ? { opacity: 1, scale: 1, y: 0 } : {}}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="relative max-w-md mx-auto w-full"
          >
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#FF6FD8]/20 via-transparent to-[#6F8BFF]/20 blur-3xl" />
            <div className="relative rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl p-6">
              <div className="h-[260px] sm:h-[320px]">
                <Doughnut data={chartData} options={chartOptions} />
              </div>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    Total Supply
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-white mt-1">
                    {tokenData.totalSupply}
                  </div>
                  <div className="text-sm font-semibold bg-clip-text text-transparent bg-gradient-to-r from-[#FF6FD8] to-[#6F8BFF] mt-1">
                    $AERA
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* allocation list */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="space-y-4"
          >
            {tokenData.allocations.map((allocation, index) => (
              <motion.div
                key={allocation.label}
                initial={{ opacity: 0, y: 16 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.35 + index * 0.05 }}
                className="group rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: allocation.color }}
                    />
                    <span className="text-sm font-semibold text-white">
                      {allocation.label}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-white">
                    {allocation.value}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${allocation.value}%` }}
                    transition={{ duration: 1, delay: 0.6 + index * 0.05 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: allocation.color }}
                  />
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default TokenomicsSection;
