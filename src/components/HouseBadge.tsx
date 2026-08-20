import { HOUSE_THEME, type House } from "@/lib/houses";

/**
 * Colours come from inline styles rather than Tailwind classes because the
 * house is data — Tailwind's scanner cannot see class names built at runtime.
 */
export function HouseBadge({
  house,
  size = "md",
}: {
  house: House;
  size?: "sm" | "md";
}) {
  const theme = HOUSE_THEME[house];
  return (
    <span
      className={
        size === "sm"
          ? "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide"
          : "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide"
      }
      style={{ backgroundColor: theme.base, color: theme.ink }}
    >
      {house}
    </span>
  );
}

export function HouseDot({ house }: { house: House }) {
  return (
    <span
      aria-hidden
      className="inline-block size-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: HOUSE_THEME[house].base }}
    />
  );
}
