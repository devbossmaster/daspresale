"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Clock3 } from "lucide-react";

type SwapCountdownProps = {
  targetDate: string; // ISO date string, e.g. "2026-03-15T12:00:00Z"
  title?: string;
  subtitle?: string;
};

function pad(num: number) {
  return String(num).padStart(2, "0");
}

function getRemaining(targetMs: number) {
  const now = Date.now();
  const diff = Math.max(0, targetMs - now);

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return {
    diff,
    days,
    hours,
    minutes,
    seconds,
    isLive: diff <= 0,
  };
}

export function SwapCountdown({
  targetDate,
  title = "Swap Opens In",
  subtitle = "Countdown to $AERA swap launch",
}: SwapCountdownProps) {
  const targetMs = useMemo(() => new Date(targetDate).getTime(), [targetDate]);
  const [time, setTime] = useState(() => getRemaining(targetMs));

  useEffect(() => {
    const tick = () => setTime(getRemaining(targetMs));
    tick(); // run immediately
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetMs]);

  const units = [
    { label: "Days", value: String(time.days) },
    { label: "Hours", value: pad(time.hours) },
    { label: "Min", value: pad(time.minutes) },
    { label: "Sec", value: pad(time.seconds) },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="mt-6"
    >
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 backdrop-blur-xl">
        {/* Glow accents */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-10 left-8 h-24 w-24 rounded-full bg-violet-500/10 blur-2xl" />
          <div className="absolute -bottom-10 right-8 h-24 w-24 rounded-full bg-sky-400/10 blur-2xl" />
        </div>

        <div className="relative z-10">
          {/* Header */}
          <div className="mb-4 flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-violet-500/20 to-sky-400/15">
              <Clock3 className="h-4 w-4 text-violet-200" />
            </span>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.18em] text-white/55">
                {time.isLive ? "Live Now" : title}
              </p>
              <p className="truncate text-sm font-medium text-white/85">{subtitle}</p>
            </div>
          </div>

          {/* Countdown / Live State */}
          {time.isLive ? (
            <div className="rounded-xl border border-violet-300/20 bg-violet-500/10 px-4 py-3 text-center">
              <p className="text-sm font-semibold text-violet-200">
                🚀 Swap is now open
              </p>
              <p className="mt-1 text-xs text-white/60">
                You can now enable your swap CTA / link.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              {units.map((u) => (
                <motion.div
                  key={u.label}
                  className="rounded-xl border border-white/10 bg-black/20 px-2 py-3 text-center sm:px-3"
                  animate={{ y: [0, -1, 0] }}
                  transition={{
                    duration: 2.8,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <div className="text-lg font-bold leading-none text-white sm:text-2xl">
                    {u.value}
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/50 sm:text-[11px]">
                    {u.label}
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          <p className="mt-3 text-[11px] text-white/45 sm:text-xs">
  Launch time:{" "}
  {new Date(targetDate).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kathmandu",
  })}{" "}
  (Nepal Time)
</p>
        </div>
      </div>
    </motion.div>
  );
}