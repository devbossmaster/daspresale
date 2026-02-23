"use client";

import { useMemo, useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { TrendingUp, CheckCircle2, Sparkles } from "lucide-react";

type PhaseStatus = "done" | "current" | "upcoming";

type RoadmapPhase = {
  phase: string;
  title: string;
  period: string;
  items: string[];
  status: PhaseStatus;
};

const phases: RoadmapPhase[] = [
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
      "100,000+ holders target",
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

function getStatusStyles(status: PhaseStatus) {
  switch (status) {
    case "done":
      return {
        dot: "bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.6)]",
        badge: "text-emerald-300",
        border: "border-emerald-300/20",
      };
    case "current":
      return {
        dot: "bg-violet-300 shadow-[0_0_20px_rgba(196,181,253,0.95)]",
        badge: "text-violet-200",
        border: "border-violet-300/20",
      };
    default:
      return {
        dot: "bg-white/50 shadow-[0_0_10px_rgba(255,255,255,0.25)]",
        badge: "text-white/60",
        border: "border-white/10",
      };
  }
}

function RoadmapCard({
  phase,
  index,
  isInView,
  mobile = false,
}: {
  phase: RoadmapPhase;
  index: number;
  isInView: boolean;
  mobile?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const statusUI = getStatusStyles(phase.status);

  return (
    <motion.div
      initial={{ opacity: 0, y: mobile ? 18 : 22 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: 0.14 + index * 0.1, duration: 0.5 }}
      whileHover={mobile ? undefined : { y: -4, scale: 1.01 }}
      className={`group relative overflow-hidden rounded-2xl sm:rounded-3xl border ${statusUI.border}
      bg-white/[0.03] backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.4)]
      ${mobile ? "p-5" : "p-6"}`}
    >
      {/* Card glow & neon lines */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.03),transparent_42%,rgba(139,92,246,0.04))]" />
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-blue-200/20 to-transparent" />
      <div className="pointer-events-none absolute inset-x-10 bottom-0 h-px bg-gradient-to-r from-transparent via-violet-200/15 to-transparent" />

      {!reduceMotion && !mobile && (
        <motion.div
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/8 to-transparent"
          animate={{ x: ["0%", "420%"] }}
          transition={{
            duration: 4,
            delay: index * 0.25,
            repeat: Infinity,
            repeatDelay: 2.3,
            ease: "easeInOut",
          }}
        />
      )}

      <div className="relative mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
            {phase.phase}
          </div>
          <h3 className={`${mobile ? "text-lg" : "text-2xl"} mt-1 font-semibold text-white leading-tight`}>
            {phase.title}
          </h3>
        </div>

        <div className="text-right shrink-0">
          <div className={`${mobile ? "text-xs" : "text-sm"} font-semibold text-white/80`}>
            {phase.period}
          </div>
          {phase.status === "current" && (
            <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200">
              <Sparkles className="h-3 w-3" />
              Live
            </div>
          )}
        </div>
      </div>

      <ul className="relative space-y-2.5">
        {phase.items.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm leading-6 text-white/75">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

export default function RoadmapSection() {
  const ref = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const reduceMotion = useReducedMotion();

  const currentIndex = useMemo(
    () => Math.max(0, phases.findIndex((p) => p.status === "current")),
    []
  );

  const progressPct = useMemo(() => {
    if (phases.length <= 1) return 0;
    return ((currentIndex + 0.18) / (phases.length - 1)) * 100;
  }, [currentIndex]);

  return (
    <section
      id="roadmap"
      ref={ref}
      className="relative py-20 sm:py-24 lg:py-28 overflow-visible"
    >
      {/* Ambient background (soft only) */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,rgba(99,102,241,0.10),transparent_34%),radial-gradient(circle_at_78%_14%,rgba(59,130,246,0.10),transparent_38%),radial-gradient(circle_at_50%_88%,rgba(168,85,247,0.08),transparent_45%)]" />
        <div className="absolute left-1/4 top-16 h-64 w-64 rounded-full bg-violet-500/8 blur-3xl" />
        <div className="absolute right-1/4 top-20 h-72 w-72 rounded-full bg-blue-500/8 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55 }}
          className="mb-12 sm:mb-14 text-center"
        >
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 backdrop-blur-xl">
            <TrendingUp className="h-4 w-4 text-violet-300" />
            <span className="text-xs font-medium tracking-[0.16em] uppercase text-white/75">
              Strategic Vision
            </span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
            <span className="bg-gradient-to-r from-white via-violet-200 to-blue-200 bg-clip-text text-transparent">
              Development Roadmap
            </span>
          </h2>

          <p className="mx-auto mt-4 max-w-3xl text-sm sm:text-base leading-7 text-white/60">
            A staged execution plan for utility expansion, listings, ecosystem growth,
            and long-term adoption.
          </p>
        </motion.div>

        {/* MOBILE — vertical timeline */}
        <div className="lg:hidden">
          <div className="relative pl-10">
            {/* Rail */}
            <div className="absolute left-3 top-2 bottom-2 w-px bg-white/10" />
            <div
              className="absolute left-3 top-2 w-px bg-gradient-to-b from-blue-300 via-violet-300 to-cyan-300 shadow-[0_0_10px_rgba(147,197,253,0.45)]"
              style={{ height: `${Math.max(12, (progressPct / 100) * 92)}%` }}
            />

            {!reduceMotion && (
              <motion.div
                className="absolute left-[9px] top-2 h-10 w-3 -translate-x-1/2 rounded-full bg-blue-300/55 blur-[6px]"
                animate={{ y: [0, 420, 0], opacity: [0.35, 0.85, 0.35] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              />
            )}

            <div className="space-y-5">
              {phases.map((phase, index) => {
                const statusUI = getStatusStyles(phase.status);

                return (
                  <div key={`${phase.phase}-${phase.title}`} className="relative">
                    {/* Node */}
                    <div className="absolute -left-10 top-5 flex h-6 w-6 items-center justify-center">
                      {phase.status === "current" && !reduceMotion && (
                        <motion.span
                          className="absolute h-5 w-5 rounded-full bg-violet-300/25"
                          animate={{ scale: [1, 1.8, 1], opacity: [0.35, 0, 0.35] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                        />
                      )}
                      <span className={`relative h-2.5 w-2.5 rounded-full ${statusUI.dot}`} />
                    </div>

                    {/* little connector glow */}
                    <div className="absolute -left-[13px] top-6 h-px w-5 bg-gradient-to-r from-blue-300/50 to-transparent" />

                    <RoadmapCard phase={phase} index={index} isInView={isInView} mobile />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* DESKTOP — evenly distributed alternating cards */}
        <div className="hidden lg:block">
          {/* horizontal safety for smaller laptops */}
          <div className="overflow-x-auto pb-2">
            <div className="min-w-[1100px] xl:min-w-0">
              {/* Top row (even indexes) */}
              <div className="grid grid-cols-4 gap-6 items-end">
                {phases.map((phase, index) => (
                  <div key={`top-${phase.phase}`} className="min-w-0">
                    {index % 2 === 0 ? (
                      <RoadmapCard phase={phase} index={index} isInView={isInView} />
                    ) : (
                      <div className="h-4" />
                    )}
                  </div>
                ))}
              </div>

              {/* Timeline row */}
              <div className="relative my-4 h-24">
                {/* Base line */}
                <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-white/10" />

                {/* Neon glow line */}
                <div className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 bg-gradient-to-r from-transparent via-blue-300/15 to-transparent" />

                {/* Progress line */}
                <motion.div
                  initial={{ width: 0 }}
                  animate={isInView ? { width: `${progressPct}%` } : {}}
                  transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
                  className="absolute left-0 top-1/2 h-[2px] -translate-y-1/2 bg-gradient-to-r from-blue-300 via-violet-300 to-cyan-300 shadow-[0_0_14px_rgba(147,197,253,0.55)]"
                />

                {/* Scanner beam */}
                {!reduceMotion && (
                  <motion.div
                    className="pointer-events-none absolute top-1/2 h-5 w-28 -translate-y-1/2 rounded-full bg-blue-300/40 blur-md"
                    animate={{ left: ["-2%", "94%", "-2%"], opacity: [0.45, 0.85, 0.45] }}
                    transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                  />
                )}

                {/* Connectors + Dots aligned with 4 columns */}
                <div className="relative grid h-full grid-cols-4 gap-6">
                  {phases.map((phase, index) => {
                    const statusUI = getStatusStyles(phase.status);
                    const isTop = index % 2 === 0;

                    return (
                      <div key={`line-${phase.phase}`} className="relative">
                        {/* vertical connector */}
                        <div
                          className={`absolute left-1/2 -translate-x-1/2 w-px ${
                            isTop ? "top-0 bottom-1/2" : "top-1/2 bottom-0"
                          }`}
                        >
                          <div className="absolute inset-0 bg-white/10" />
                          <div className="absolute inset-0 bg-gradient-to-b from-blue-300/20 via-violet-300/20 to-transparent" />
                        </div>

                        {/* tiny branch glow */}
                        <div
                          className={`absolute left-1/2 w-8 -translate-x-[1px] h-px ${
                            isTop ? "top-0" : "bottom-0"
                          } bg-gradient-to-r from-blue-300/20 to-transparent`}
                        />

                        {/* node */}
                        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
                          {phase.status === "current" && !reduceMotion && (
                            <>
                              <motion.span
                                className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-300/20"
                                animate={{ scale: [1, 1.8, 1], opacity: [0.4, 0, 0.4] }}
                                transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
                              />
                              <motion.span
                                className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-300/20"
                                animate={{ scale: [1, 1.5, 1], opacity: [0.35, 0.05, 0.35] }}
                                transition={{ duration: 1.7, repeat: Infinity, ease: "easeOut" }}
                              />
                            </>
                          )}
                          <span
                            className={`block h-3.5 w-3.5 rounded-full border border-white/20 ${statusUI.dot}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom row (odd indexes) */}
              <div className="grid grid-cols-4 gap-6 items-start">
                {phases.map((phase, index) => (
                  <div key={`bottom-${phase.phase}`} className="min-w-0">
                    {index % 2 !== 0 ? (
                      <RoadmapCard phase={phase} index={index} isInView={isInView} />
                    ) : (
                      <div className="h-4" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}