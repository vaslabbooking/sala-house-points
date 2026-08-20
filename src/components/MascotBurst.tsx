"use client";

import { useEffect, useRef, useState } from "react";
import type { House } from "@/lib/houses";

const BURST_MS = 1500;

/** Where each house's artwork lives. Replace the file to change the mascot. */
export function mascotSrc(house: House): string {
  return `/mascots/${house.toLowerCase()}.svg`;
}

export function soundSrc(house: House): string {
  return `/sounds/${house.toLowerCase()}.mp3`;
}

/**
 * The winning house's mascot rushes the viewer: small at the centre, swelling
 * past the edges of the screen and fading as it passes, as though it burst
 * through. Mounted only when the reveal lands, so it plays exactly once.
 */
export function MascotBurst({
  house,
  sound,
  onSoundBlocked,
}: {
  house: House;
  sound: boolean;
  onSoundBlocked: () => void;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [hidden, setHidden] = useState(false);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    const element = imageRef.current;
    if (!element) return;

    const animation = element.animate(
      [
        { transform: "translate(-50%, -50%) scale(0.1)", opacity: 0 },
        { transform: "translate(-50%, -50%) scale(0.8)", opacity: 1, offset: 0.2 },
        { transform: "translate(-50%, -50%) scale(1.7)", opacity: 1, offset: 0.55 },
        { transform: "translate(-50%, -50%) scale(6)", opacity: 0 },
      ],
      { duration: BURST_MS, easing: "cubic-bezier(0.36, 0, 0.66, 1)", fill: "forwards" },
    );

    // Drop the element once it has passed, rather than leaving it invisible.
    const timer = setTimeout(() => setHidden(true), BURST_MS + 100);
    return () => {
      animation.cancel();
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!sound) return;
    const audio = new Audio(soundSrc(house));
    audio.volume = 0.85;

    audio.play().catch((error: DOMException) => {
      // Browsers refuse audio until the page has been interacted with. That is
      // worth surfacing so someone can click once. Every other failure — most
      // likely no sound file added yet — is ignored on purpose.
      if (error?.name === "NotAllowedError") onSoundBlocked();
    });

    return () => {
      audio.pause();
    };
  }, [house, sound, onSoundBlocked]);

  if (hidden || broken) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden" aria-hidden>
      {/* A plain <img>: the whole point is that this file can be swapped for a
          student-designed crest, and next/image would neither optimise an SVG
          nor tolerate one appearing without a rebuild. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imageRef}
        src={mascotSrc(house)}
        alt=""
        width={340}
        height={340}
        onError={() => setBroken(true)}
        className="absolute left-1/2 top-1/2 w-[min(42vw,340px)]"
        style={{ transform: "translate(-50%, -50%) scale(0.1)", opacity: 0 }}
      />
    </div>
  );
}
