"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  Zap,
  ExternalLink,
  Brain,
  GraduationCap,
  Building2,
  Gamepad2,
  ShieldCheck,
  Flame,
} from "lucide-react";

type FeatureItem = {
  icon: LucideIcon;
  title: string;
  description: string;
  accent: "violet" | "blue" | "cyan";
};

const FeaturesSection = () => {
  const ref = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const features: FeatureItem[] = [
    {
      icon: Brain,
      title: "DeFi Projects",
      description:
        "DeFi products and utility modules with subscriptions and ecosystem access payable in $AERA.",
      accent: "violet",
    },
    {
      icon: GraduationCap,
      title: "Digital Academy",
      description:
        "Premium education in trading, business, and real estate with practical learning and guided growth paths.",
      accent: "blue",
    },
    {
      icon: Building2,
      title: "Real Estate Projects",
      description:
        "Fractional access to global properties with rental-yield opportunities and utility-driven participation.",
      accent: "cyan",
    },
    {
      icon: Gamepad2,
      title: "Play-to-Earn Gaming",
      description:
        "Web3 gaming ecosystem with rewards, progression systems, and competitive experiences powered by token utility.",
      accent: "violet",
    },
    {
      icon: ShieldCheck,
      title: "Staking Vault",
      description:
        "Flexible and long-term staking options with boosted APR structures for committed ecosystem participants.",
      accent: "blue",
    },
    {
      icon: Flame,
      title: "Hard-Capped & Burnable Token",
      description:
        "Scarcity-focused tokenomics with capped supply and burn mechanics designed to support long-term value.",
      accent: "cyan",
    },
  ];

  const accentMap = {
    violet: {
      glow: "bg-violet-400/20",
      line: "from-transparent via-violet-300/70 to-transparent",
      iconBg:
        "bg-gradient-to-br from-violet-500/20 via-fuchsia-400/10 to-transparent",
      iconText: "text-violet-200",
      ring: "border-violet-300/20",
      hoverGlow: "group-hover:shadow-[0_0_40px_rgba(168,85,247,0.12)]",
    },
    blue: {
      glow: "bg-blue-400/20",
      line: "from-transparent via-blue-300/70 to-transparent",
      iconBg:
        "bg-gradient-to-br from-blue-500/20 via-indigo-400/10 to-transparent",
      iconText: "text-blue-200",
      ring: "border-blue-300/20",
      hoverGlow: "group-hover:shadow-[0_0_40px_rgba(59,130,246,0.12)]",
    },
    cyan: {
      glow: "bg-cyan-400/20",
      line: "from-transparent via-cyan-300/70 to-transparent",
      iconBg:
        "bg-gradient-to-br from-cyan-500/20 via-sky-400/10 to-transparent",
      iconText: "text-cyan-200",
      ring: "border-cyan-300/20",
      hoverGlow: "group-hover:shadow-[0_0_40px_rgba(34,211,238,0.12)]",
    },
  } as const;

  return (
  <section
    id="features"
    ref={ref}
    className="relative isolate overflow-x-clip overflow-y-hidden py-20 sm:py-24 lg:py-28"
  >
 

    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55 }}
        className="mx-auto mb-12 max-w-4xl text-center sm:mb-14"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ delay: 0.08, duration: 0.4 }}
          className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 backdrop-blur-xl"
        >
          <Zap className="h-4 w-4 text-violet-300" />
          <span className="text-[11px] sm:text-xs font-medium tracking-[0.16em] uppercase text-white/70">
            Core Ecosystem
          </span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 18 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-white"
        >
          Best Features
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.22, duration: 0.5 }}
          className="mx-auto mt-4 max-w-3xl text-sm sm:text-base leading-7 text-white/55"
        >
          AERA powers a multi-utility ecosystem across DeFi, education, real estate,
          gaming, staking, and scarcity-driven tokenomics — all in one unified Web3 stack.
        </motion.p>
      </motion.div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-12">
        {features.map((feature, index) => {
          const accent = accentMap[feature.accent];
          const Icon = feature.icon;

          const spanClass =
            index < 3 ? "xl:col-span-4" : index < 5 ? "xl:col-span-6" : "xl:col-span-12";

          return (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20, scale: 0.985 }}
              animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{ delay: 0.28 + index * 0.06, duration: 0.45 }}
              whileHover={{ y: -4 }}
              className={`group relative min-w-0 ${spanClass}`}
            >
              <div
                className={[
                  "relative h-full max-w-full overflow-hidden rounded-3xl border border-white/10",
                  "bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))]",
                  "backdrop-blur-xl p-6 sm:p-7",
                  "transition-all duration-300",
                  "hover:border-white/15",
                  accent.hoverGlow,
                ].join(" ")}
              >
                {/* Neon top border line */}
                <div
                  className={`pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r ${accent.line} opacity-90`}
                />
                <div
                  className={`pointer-events-none absolute inset-x-12 top-0 h-[2px] bg-gradient-to-r ${accent.line} blur-sm opacity-60`}
                />

                {/* Neon bottom border line */}
                <div
                  className={`pointer-events-none absolute inset-x-8 bottom-0 h-px bg-gradient-to-r ${accent.line} opacity-80`}
                />
                <div
                  className={`pointer-events-none absolute inset-x-12 bottom-0 h-[2px] bg-gradient-to-r ${accent.line} blur-sm opacity-50`}
                />

                {/* Corner glow */}
                <div
                  className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full ${accent.glow} blur-2xl opacity-50`}
                />
                <div
                  className={`pointer-events-none absolute -left-8 bottom-2 h-20 w-20 rounded-full ${accent.glow} blur-2xl opacity-20`}
                />

                {/* Inner subtle gradient sweep */}
                <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.06),transparent_45%)]" />
                </div>

                {/* Icon */}
                <div className="relative mb-5">
                  <div
                    className={[
                      "inline-flex h-14 w-14 items-center justify-center rounded-2xl",
                      "border border-white/10 bg-black/20 backdrop-blur-xl",
                      "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
                      accent.ring,
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "absolute inset-0 rounded-2xl opacity-70",
                        accent.iconBg,
                      ].join(" ")}
                    />
                    <Icon className={`relative h-6 w-6 ${accent.iconText}`} />
                  </div>
                </div>

                {/* Content */}
                <h3 className="relative text-xl sm:text-2xl font-semibold tracking-tight text-white break-words">
                  {feature.title}
                </h3>

                <p className="relative mt-3 max-w-[60ch] text-sm sm:text-base leading-7 text-white/55 break-words">
                  {feature.description}
                </p>

                {/* Footer CTA */}
                <div className="relative mt-6 flex min-w-0 items-center justify-between">
                  <button className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3 py-2 text-xs font-medium text-white/75 backdrop-blur-md transition-all duration-300 hover:bg-white/[0.05] hover:text-white hover:border-white/20">
                    Learn more
                    <ExternalLink className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                  </button>

                  <div className="ml-4 h-px min-w-0 flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  </section>
);
}

export default FeaturesSection;