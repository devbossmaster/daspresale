"use client";

import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  r: number;
  alpha: number;
  twinkle: number;
  speed: number;
};

type GlowBlob = {
  x: number;
  y: number;
  radius: number;
  color: string;
  alpha: number;
  dx: number;
  dy: number;
  drift: number;
};

export default function BackgroundFX() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === "undefined") return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let width = 0;
    let height = 0;
    let dpr = 1;

    const stars: Star[] = [];
    const blobs: GlowBlob[] = [];

    const palette = {
      black: "#040406",
      deep: "#070A14",
      navy: "#0A1030",
      indigo: "#111A48",
      violet: "#7C3AED", // purple glow
      violetSoft: "#A855F7",
      blue: "#2563EB",
      cyan: "#38BDF8",
      white: "#FFFFFF",
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      // draw in CSS pixels
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Regenerate particles on resize for correct density
      stars.length = 0;
      blobs.length = 0;

      const starCount = width < 768 ? 55 : 95;
      for (let i = 0; i < starCount; i++) {
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: Math.random() * 1.4 + 0.2,
          alpha: Math.random() * 0.5 + 0.15,
          twinkle: Math.random() * Math.PI * 2,
          speed: Math.random() * 0.004 + 0.0015,
        });
      }

      // Big cinematic glows (positioned similarly to premium hero backgrounds)
      const baseBlobs: GlowBlob[] = [
        {
          x: width * 0.18,
          y: height * 0.12,
          radius: Math.max(width, height) * 0.22,
          color: palette.violet,
          alpha: 0.13,
          dx: 0.06,
          dy: 0.03,
          drift: 0.9,
        },
        {
          x: width * 0.82,
          y: height * 0.16,
          radius: Math.max(width, height) * 0.25,
          color: palette.violetSoft,
          alpha: 0.1,
          dx: -0.05,
          dy: 0.025,
          drift: 0.75,
        },
        {
          x: width * 0.68,
          y: height * 0.72,
          radius: Math.max(width, height) * 0.28,
          color: palette.blue,
          alpha: 0.1,
          dx: -0.03,
          dy: -0.02,
          drift: 0.55,
        },
        {
          x: width * 0.34,
          y: height * 0.82,
          radius: Math.max(width, height) * 0.24,
          color: palette.cyan,
          alpha: 0.05,
          dx: 0.02,
          dy: -0.015,
          drift: 0.45,
        },
      ];

      blobs.push(...baseBlobs);
    };

    const drawBaseGradient = (time: number) => {
      // Base deep dark gradient
      const g = ctx.createLinearGradient(0, 0, 0, height);
      g.addColorStop(0, palette.deep);
      g.addColorStop(0.45, palette.black);
      g.addColorStop(1, "#020203");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);

      // Subtle top-space tint
      const topGlow = ctx.createRadialGradient(
        width * 0.5,
        height * 0.08,
        0,
        width * 0.5,
        height * 0.08,
        width * 0.9
      );
      topGlow.addColorStop(0, "rgba(80, 70, 255, 0.14)");
      topGlow.addColorStop(0.35, "rgba(55, 40, 180, 0.08)");
      topGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = topGlow;
      ctx.fillRect(0, 0, width, height);

      // Gentle moving vertical beam (very subtle)
      const beamX = width * 0.72 + Math.sin(time * 0.35) * width * 0.03;
      const beam = ctx.createLinearGradient(beamX - 220, 0, beamX + 220, 0);
      beam.addColorStop(0, "rgba(255,255,255,0)");
      beam.addColorStop(0.5, "rgba(140,120,255,0.05)");
      beam.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = beam;
      ctx.fillRect(0, 0, width, height);

      // Bottom horizon bloom (like premium hero ambience)
      const horizonY = height * 0.92;
      const horizon = ctx.createRadialGradient(
        width * 0.52,
        horizonY,
        0,
        width * 0.52,
        horizonY,
        width * 0.65
      );
      horizon.addColorStop(0, "rgba(56, 189, 248, 0.22)");
      horizon.addColorStop(0.25, "rgba(59, 130, 246, 0.12)");
      horizon.addColorStop(0.5, "rgba(124, 58, 237, 0.07)");
      horizon.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = horizon;
      ctx.fillRect(0, 0, width, height);

      // Thin horizon line glow
      ctx.save();
      ctx.globalAlpha = 0.18;
      const line = ctx.createLinearGradient(0, horizonY, width, horizonY);
      line.addColorStop(0, "rgba(255,255,255,0)");
      line.addColorStop(0.25, "rgba(120,170,255,0.25)");
      line.addColorStop(0.5, "rgba(180,220,255,0.55)");
      line.addColorStop(0.75, "rgba(120,170,255,0.25)");
      line.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = line;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(width * 0.08, horizonY);
      ctx.quadraticCurveTo(width * 0.5, horizonY - 12, width * 0.92, horizonY);
      ctx.stroke();
      ctx.restore();
    };

    const drawBlobs = (time: number) => {
      ctx.save();
      ctx.globalCompositeOperation = "screen";

      blobs.forEach((b, i) => {
        // slow drift / breathing
        const ox = Math.sin(time * b.drift + i) * 30;
        const oy = Math.cos(time * (b.drift * 0.8) + i * 1.37) * 20;

        const x = b.x + ox;
        const y = b.y + oy;
        const r = b.radius + Math.sin(time * 0.5 + i) * 18;

        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, hexToRgba(b.color, b.alpha));
        grad.addColorStop(0.45, hexToRgba(b.color, b.alpha * 0.45));
        grad.addColorStop(1, hexToRgba(b.color, 0));

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();
    };

    const drawStars = (time: number) => {
      ctx.save();

      for (const s of stars) {
        const tw = (Math.sin(time * 2 + s.twinkle * 30) + 1) * 0.5; // 0..1
        const a = Math.max(0.05, s.alpha * (0.55 + tw * 0.65));

        // tiny drift
        s.y += s.speed;
        if (s.y > height + 2) {
          s.y = -2;
          s.x = Math.random() * width;
        }

        // glow
        const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 4);
        grad.addColorStop(0, `rgba(255,255,255,${a})`);
        grad.addColorStop(0.45, `rgba(180,210,255,${a * 0.45})`);
        grad.addColorStop(1, "rgba(255,255,255,0)");

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 4, 0, Math.PI * 2);
        ctx.fill();

        // core
        ctx.fillStyle = `rgba(255,255,255,${Math.min(0.95, a + 0.12)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    };

    const drawVignette = () => {
      // Edge darkening (canvas side, plus DOM overlay later)
      const vg = ctx.createRadialGradient(
        width * 0.5,
        height * 0.45,
        Math.min(width, height) * 0.15,
        width * 0.5,
        height * 0.45,
        Math.max(width, height) * 0.8
      );
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(0.6, "rgba(0,0,0,0.12)");
      vg.addColorStop(1, "rgba(0,0,0,0.65)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, width, height);
    };

    let start = performance.now();

    const render = (now: number) => {
      const time = (now - start) * 0.001;

      ctx.clearRect(0, 0, width, height);
      drawBaseGradient(time);
      drawBlobs(time);
      drawStars(time);
      drawVignette();

      if (!prefersReducedMotion) {
        rafRef.current = requestAnimationFrame(render);
      }
    };

    resize();
    render(performance.now());

    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    if (!prefersReducedMotion) {
      rafRef.current = requestAnimationFrame(render);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <>
      {/* Canvas layer */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 -z-50 pointer-events-none"
        aria-hidden="true"
      />

      {/* DOM overlays for extra polish */}
      <div className="fixed inset-0 -z-40 pointer-events-none">
        {/* Purple top corner glows */}
        <div
          className="absolute -top-24 -left-24 h-[26rem] w-[26rem] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(168,85,247,0.22) 0%, rgba(124,58,237,0.12) 35%, transparent 70%)",
          }}
        />
        <div
          className="absolute -top-16 right-[-5rem] h-[24rem] w-[24rem] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(129,140,248,0.18) 0%, rgba(59,130,246,0.10) 35%, transparent 70%)",
          }}
        />

        {/* Bottom ambient glow */}
        <div
          className="absolute left-1/2 bottom-[-10rem] h-[22rem] w-[70rem] -translate-x-1/2 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(56,189,248,0.16) 0%, rgba(59,130,246,0.10) 35%, rgba(124,58,237,0.06) 55%, transparent 75%)",
          }}
        />

        {/* Top fade + bottom fade for hero readability */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.35),rgba(0,0,0,0.08)_28%,rgba(0,0,0,0.16)_70%,rgba(0,0,0,0.42))]" />

        {/* Edge vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(0,0,0,0.55)_100%)]" />

        {/* Subtle noise */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
          }}
        />
      </div>
    </>
  );
}

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  const bigint = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}