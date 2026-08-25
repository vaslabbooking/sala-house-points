"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HOUSES, type House } from "@/lib/houses";
import { mascotCandidates, soundCandidates } from "@/lib/mascots";

const BURST_MS = 1500;

/**
 * Resolves each house's artwork once, when the page loads.
 *
 * The burst begins several seconds later, so waiting until then to create the
 * <img> meant the browser was still fetching while the animation ran and the
 * first play showed a half-painted picture. `decode()` resolves only once the
 * image is downloaded *and* decoded, so by the time a house wins, its artwork
 * is ready to paint in full.
 *
 * All four are warmed rather than just the current leader, so a lead changing
 * between page load and the reveal cannot catch it out. The supplied files are
 * about a kilobyte each; if you replace them with large photographs, this is
 * the moment they are fetched.
 */
export function useMascotArtwork(): Partial<Record<House, string>> {
  const [resolved, setResolved] = useState<Partial<Record<House, string>>>({});

  useEffect(() => {
    let cancelled = false;

    const warm = async () => {
      for (const house of HOUSES) {
        for (const candidate of mascotCandidates(house)) {
          try {
            const image = new Image();
            image.src = candidate;
            await image.decode();
            if (!cancelled) {
              setResolved((current) => ({ ...current, [house]: candidate }));
            }
            break;
          } catch {
            // Not this format — try the next, and give up quietly if none load.
          }
        }
        if (cancelled) return;
      }
    };

    void warm();
    return () => {
      cancelled = true;
    };
  }, []);

  return resolved;
}

/**
 * The winning house's mascot rushes the viewer: small at the centre, swelling
 * past the edges of the screen and fading as it passes, as though it burst
 * through. Mounted only when the reveal lands, so it plays exactly once.
 */
export function MascotBurst({
  house,
  src,
  sound,
  onSoundBlocked,
}: {
  house: House;
  src: string;
  sound: boolean;
  onSoundBlocked: () => void;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [hidden, setHidden] = useState(false);
  // The warmed file is tried first; the remaining formats stay as a safety net
  // in case warming had not finished, so a slow connection costs a moment
  // rather than the whole mascot.
  const candidates = useMemo(() => {
    const all = mascotCandidates(house);
    return src ? [src, ...all.filter((option) => option !== src)] : all;
  }, [house, src]);
  const [attempt, setAttempt] = useState(0);
  const current = candidates[attempt];

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

    const candidates = soundCandidates(house);
    const audio = new Audio();
    audio.volume = 0.85;
    let index = 0;
    let cancelled = false;

    const attemptPlay = () => {
      if (cancelled || index >= candidates.length) return;
      audio.src = candidates[index++];
      audio.play().catch((error: DOMException) => {
        // Browsers refuse audio until the page has been interacted with. That
        // is worth surfacing so someone can click once. Anything else means
        // this format is not there, so try the next one.
        if (error?.name === "NotAllowedError") onSoundBlocked();
        else attemptPlay();
      });
    };
    attemptPlay();

    return () => {
      cancelled = true;
      audio.pause();
    };
  }, [house, sound, onSoundBlocked]);

  if (hidden || !current) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden" aria-hidden>
      {/* A plain <img>: the whole point is that this file can be swapped for a
          student-designed crest, and next/image would neither optimise an SVG
          nor tolerate one appearing without a rebuild. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imageRef}
        src={current}
        alt=""
        width={340}
        height={340}
        onError={() => setAttempt((index) => index + 1)}
        className="absolute left-1/2 top-1/2 w-[min(42vw,340px)]"
        style={{ transform: "translate(-50%, -50%) scale(0.1)", opacity: 0 }}
      />
    </div>
  );
}
