"use client";

import { useEffect, useRef } from "react";

/**
 * Confetti cannons in the winning house's colours, fired from the bottom
 * corners and repeating until stopped. Drawn on a canvas rather than pulled
 * from a library: a few hundred rectangles is little code, and it keeps the
 * page free of third-party scripts.
 */
const BURST_INTERVAL_MS = 2200;
const PER_CANNON = 46;
const GRAVITY = 0.14;
const DRAG = 0.992;
const MAX_LIFE_MS = 5200;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  spin: number;
  width: number;
  height: number;
  colour: string;
  born: number;
  flutter: number;
};

export function Confetti({ colours, running }: { colours: string[]; running: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Held in a ref and read inside the draw loop, so the leading house changing
  // mid-celebration recolours the next burst without clearing what is in the air.
  const paletteRef = useRef(colours);
  useEffect(() => {
    paletteRef.current = colours;
  }, [colours]);

  useEffect(() => {
    if (!running) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const particles: Particle[] = [];

    const fire = (now: number) => {
      const palette = paletteRef.current;
      // One cannon in each bottom corner, angled up and inward.
      const cannons = [
        { x: 0, y: height, spread: [-Math.PI / 2.6, -Math.PI / 9] },
        { x: width, y: height, spread: [-Math.PI + Math.PI / 9, -Math.PI / 1.6] },
      ];

      for (const cannon of cannons) {
        for (let i = 0; i < PER_CANNON; i++) {
          const angle =
            cannon.spread[0] + Math.random() * (cannon.spread[1] - cannon.spread[0]);
          const speed = 13 + Math.random() * 11;
          particles.push({
            x: cannon.x,
            y: cannon.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            rotation: Math.random() * Math.PI * 2,
            spin: (Math.random() - 0.5) * 0.34,
            width: 7 + Math.random() * 7,
            height: 10 + Math.random() * 8,
            colour: palette[Math.floor(Math.random() * palette.length)],
            born: now,
            flutter: Math.random() * Math.PI * 2,
          });
        }
      }
    };

    let frame = 0;
    let last = performance.now();
    let nextBurst = last;

    const tick = (now: number) => {
      // Clamped so returning to a backgrounded tab does not teleport everything.
      const dt = Math.min((now - last) / 16.667, 3);
      last = now;

      if (now >= nextBurst) {
        fire(now);
        nextBurst = now + BURST_INTERVAL_MS;
      }

      ctx.clearRect(0, 0, width, height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        const age = now - p.born;
        if (age > MAX_LIFE_MS || p.y > height + 60) {
          particles.splice(i, 1);
          continue;
        }

        p.vy += GRAVITY * dt;
        p.vx *= Math.pow(DRAG, dt);
        p.vy *= Math.pow(DRAG, dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rotation += p.spin * dt;
        p.flutter += 0.12 * dt;

        // Fade out over the last second rather than vanishing mid-air.
        ctx.globalAlpha = Math.min(1, Math.max(0, (MAX_LIFE_MS - age) / 1000));
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        // Squashing the height fakes the paper turning edge-on as it falls.
        ctx.scale(1, Math.abs(Math.cos(p.flutter)) * 0.85 + 0.15);
        ctx.fillStyle = p.colour;
        ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [running]);

  if (!running) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40"
    />
  );
}

/** Mixes a hex colour towards white, for a lighter shade of the same house. */
export function lighten(hex: string, amount: number): string {
  const value = hex.replace("#", "");
  const num = Number.parseInt(
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value,
    16,
  );
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}
