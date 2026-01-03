"use client";

import { useEffect, useRef } from "react";

export default function BackgroundFX() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (typeof window === "undefined" || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    resizeCanvas();
    const handleResize = () => resizeCanvas();
    window.addEventListener('resize', handleResize);

    // Color palette
    const colors = {
      primary: '#0a0a0a',
      secondary: '#1a1a2e',
      accent1: '#16213e',
      accent2: '#0f3460',
      highlight1: '#00c9ff',
      highlight2: '#92fe9d',
    };

    // Smooth gradient animation
    let time = 0;
    const particles: Array<{
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      color: string;
      alpha: number;
    }> = [];

    // Create floating particles
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.5,
        speedX: (Math.random() - 0.5) * 0.2,
        speedY: (Math.random() - 0.5) * 0.2,
        color: Math.random() > 0.5 ? colors.highlight1 : colors.highlight2,
        alpha: Math.random() * 0.3 + 0.1
      });
    }

    // Create gradient circles (blobs)
    const blobs: Array<{
      x: number;
      y: number;
      radius: number;
      color: string;
      alpha: number;
      speedX: number;
      speedY: number;
      pulseSpeed: number;
    }> = [];

    for (let i = 0; i < 4; i++) {
      blobs.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 200 + 100,
        color: i % 2 === 0 ? colors.accent1 : colors.accent2,
        alpha: 0.1 + Math.random() * 0.05,
        speedX: (Math.random() - 0.5) * 0.1,
        speedY: (Math.random() - 0.5) * 0.1,
        pulseSpeed: Math.random() * 0.002 + 0.001
      });
    }

    const animate = () => {
      time += 0.005;
      
      // Clear with fade effect for trails
      ctx.fillStyle = 'rgba(10, 10, 10, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw animated gradient background
      const gradient = ctx.createLinearGradient(
        0, 0, 
        canvas.width, canvas.height
      );
      
      // Animate gradient stops
      const offset = Math.sin(time) * 0.1;
      gradient.addColorStop(0, colors.primary);
      gradient.addColorStop(0.3 + offset, colors.secondary);
      gradient.addColorStop(0.6, colors.accent1);
      gradient.addColorStop(1, colors.accent2);
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw animated blobs
      blobs.forEach(blob => {
        // Update position
        blob.x += blob.speedX;
        blob.y += blob.speedY;
        
        // Bounce at edges
        if (blob.x < -blob.radius || blob.x > canvas.width + blob.radius) blob.speedX *= -1;
        if (blob.y < -blob.radius || blob.y > canvas.height + blob.radius) blob.speedY *= -1;
        
        // Pulsing effect
        const pulse = Math.sin(time * blob.pulseSpeed) * 20;
        const currentRadius = blob.radius + pulse;
        
        // Create radial gradient for blob
        const blobGradient = ctx.createRadialGradient(
          blob.x, blob.y, 0,
          blob.x, blob.y, currentRadius
        );
        blobGradient.addColorStop(0, `${blob.color}${Math.floor(blob.alpha * 255).toString(16).padStart(2, '0')}`);
        blobGradient.addColorStop(1, `${blob.color}00`);
        
        ctx.beginPath();
        ctx.arc(blob.x, blob.y, currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = blobGradient;
        ctx.fill();
      });

      // Draw floating particles
      particles.forEach(particle => {
        particle.x += particle.speedX;
        particle.y += particle.speedY;
        
        // Wrap around edges
        if (particle.x < -10) particle.x = canvas.width + 10;
        if (particle.x > canvas.width + 10) particle.x = -10;
        if (particle.y < -10) particle.y = canvas.height + 10;
        if (particle.y > canvas.height + 10) particle.y = -10;
        
        // Draw particle with glow
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        
        // Create glow effect
        const gradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, particle.size * 3
        );
        gradient.addColorStop(0, `${particle.color}${Math.floor(particle.alpha * 255).toString(16).padStart(2, '0')}`);
        gradient.addColorStop(1, `${particle.color}00`);
        
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Subtle twinkle
        particle.alpha = 0.1 + Math.sin(time * 2 + particle.x * 0.01) * 0.2;
      });

      // Draw connecting lines between close particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(100, 200, 255, ${(1 - distance / 100) * 0.1})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Add subtle grid overlay
      const gridSize = 50;
      const gridOffset = time * 10;
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.lineWidth = 0.5;
      
      // Vertical lines
      for (let x = -gridOffset % gridSize; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      
      // Horizontal lines
      for (let y = -gridOffset % gridSize; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Draw animated orbs
      for (let i = 0; i < 3; i++) {
        const orbX = canvas.width / 2 + Math.cos(time * 0.3 + i * 2) * (canvas.width / 3);
        const orbY = canvas.height / 2 + Math.sin(time * 0.4 + i * 1.5) * (canvas.height / 3);
        const orbRadius = 80 + Math.sin(time * 0.5 + i) * 20;
        
        const orbGradient = ctx.createRadialGradient(
          orbX, orbY, 0,
          orbX, orbY, orbRadius
        );
        orbGradient.addColorStop(0, 'rgba(0, 201, 255, 0.15)');
        orbGradient.addColorStop(1, 'rgba(0, 201, 255, 0)');
        
        ctx.beginPath();
        ctx.arc(orbX, orbY, orbRadius, 0, Math.PI * 2);
        ctx.fillStyle = orbGradient;
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <>
      {/* Main Canvas Background */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 -z-50"
        style={{
          width: '100%',
          height: '100%',
          display: 'block'
        }}
      />

      {/* Overlay gradient for depth */}
      <div className="fixed inset-0 -z-40 pointer-events-none">
        {/* Vignette effect */}
        <div className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at center, transparent 0%, rgba(0, 0, 0, 0.3) 100%)'
          }}
        />
        
        {/* Subtle noise texture */}
        <div className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />
        
        {/* Glowing center point */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(0, 201, 255, 0.1) 0%, rgba(0, 201, 255, 0.05) 30%, transparent 70%)',
            filter: 'blur(60px)',
            animation: 'pulseGlow 8s ease-in-out infinite'
          }}
        />

        {/* Floating corner accents */}
        <div className="absolute top-0 left-0 w-64 h-64"
          style={{
            background: 'radial-gradient(circle at top left, rgba(146, 254, 157, 0.1) 0%, transparent 50%)',
            filter: 'blur(40px)',
            animation: 'floatCorner 15s ease-in-out infinite'
          }}
        />
        
        <div className="absolute bottom-0 right-0 w-64 h-64"
          style={{
            background: 'radial-gradient(circle at bottom right, rgba(0, 201, 255, 0.1) 0%, transparent 50%)',
            filter: 'blur(40px)',
            animation: 'floatCorner 20s ease-in-out infinite reverse'
          }}
        />
      </div>

      <style jsx global>{`
        @keyframes pulseGlow {
          0%, 100% { 
            opacity: 0.3;
            transform: translate(-50%, -50%) scale(1);
          }
          50% { 
            opacity: 0.5;
            transform: translate(-50%, -50%) scale(1.1);
          }
        }
        
        @keyframes floatCorner {
          0%, 100% { 
            transform: translate(0, 0); 
          }
          25% { 
            transform: translate(20px, -20px); 
          }
          50% { 
            transform: translate(-15px, 15px); 
          }
          75% { 
            transform: translate(10px, 10px); 
          }
        }
        
        /* Smooth scrolling */
        html {
          scroll-behavior: smooth;
        }
        
        /* Performance optimizations */
        canvas {
          image-rendering: -moz-crisp-edges;
          image-rendering: -webkit-crisp-edges;
          image-rendering: pixelated;
          image-rendering: crisp-edges;
        }
        
        /* Prevent FOUC */
        body {
          opacity: 1;
          transition: opacity 0.3s ease-in;
        }
        
        body.loading {
          opacity: 0;
        }
      `}</style>
    </>
  );
}