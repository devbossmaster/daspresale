"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";

export default function AeraPrismVisual() {
  const reduceMotion = useReducedMotion();

  const SPLINE_IFRAME_URL =
    "https://my.spline.design/clonercubesimplecopy-rlVxVx8Kl8hgHZgD5znrFDT7/";

  return (
    <div className="relative h-[480px] sm:h-[500px] lg:h-[580px]">
      {/* Ultra-soft ambient glow */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-[12%] z-[1] h-44 w-44 -translate-x-1/2 rounded-full"
        animate={
          reduceMotion
            ? undefined
            : { opacity: [0.2, 0.4, 0.2], scale: [1, 1.08, 1] }
        }
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="pointer-events-none absolute left-1/2 bottom-[8%] z-[1] h-24 w-[70%] -translate-x-1/2 rounded-full bg-sky-400/8 blur-2xl"
        animate={reduceMotion ? undefined : { opacity: [0.15, 0.35, 0.15] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Transparent Spline container */}
      <div className="absolute inset-0 z-[2] overflow-hidden rounded-[1.75rem] bg-transparent">
        <iframe
          src={SPLINE_IFRAME_URL}
          title="AERA 3D Hero Visual"
          className="absolute inset-0 h-full w-full pointer-events-none md:pointer-events-auto"
          style={{
            border: "none",
            background: "transparent",
            transform: "translateY(-6px)",
          }}
          loading="lazy"
          allow="fullscreen"
        />

        {/* ===== Spline badge cover (mobile + desktop) ===== */}
        {/* This hides the bottom-right 'Built with Spline' badge by covering its area */}
        <div
          aria-hidden="true"
          className="
            pointer-events-none absolute bottom-3 right-3 z-30
            h-12 w-[170px]
            sm:bottom-4 sm:right-4 sm:h-12 sm:w-[185px]
            lg:bottom-5 lg:right-5 lg:h-12 lg:w-[190px]
            rounded-2xl
            bg-[linear-gradient(135deg,rgba(7,3,20,0.92),rgba(8,9,24,0.88))]
            backdrop-blur-md
            shadow-[0_10px_30px_rgba(0,0,0,0.35)]
          "
        />

        {/* optional subtle blend edge so cover looks intentional */}
        <div
          aria-hidden="true"
          className="
            pointer-events-none absolute bottom-2 right-2 z-[29]
            h-14 w-[182px]
            sm:bottom-3 sm:right-3 sm:h-14 sm:w-[198px]
            lg:bottom-4 lg:right-4 lg:h-14 lg:w-[204px]
            rounded-2xl
            bg-violet-500/8 blur-xl
          "
        />

        {/* Your custom brand chip (sits on top of the cover) */}
        <motion.div
          className="
            absolute bottom-3 right-3 z-40
            inline-flex items-center gap-2
            rounded-xl border border-white/10
            bg-black/35 px-3 py-2
            backdrop-blur-xl
            sm:bottom-4 sm:right-4
          "
          animate={reduceMotion ? undefined : { y: [0, -2, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full  ring-1 ring-white/10">
            <Sparkles className="h-3.5 w-3.5 text-violet-200" />
          </span>

          <div className="leading-tight">
            {/* mobile text */}
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/45 sm:hidden">
              Staera
            </p>
            <p className="text-sm font-semibold text-white/90 sm:hidden">
              Ecosystem
            </p>

            {/* desktop text */}
            <p className="hidden text-[10px] uppercase tracking-[0.16em] text-white/45 sm:block">
              Interactive Visual
            </p>
            <p className="hidden text-sm font-semibold text-white/90 sm:block">
              Staera Brand Core
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}