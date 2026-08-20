/**
 * The four houses spell B.E.S.T — the school motto is "be your BEST".
 * Order here is the canonical display order for anywhere houses are listed
 * without a ranking (admin pickers, whole-house award buttons).
 */
export const HOUSES = ["Bears", "Eagles", "Sharks", "Tigers"] as const;

export type House = (typeof HOUSES)[number];

export function isHouse(value: unknown): value is House {
  return typeof value === "string" && (HOUSES as readonly string[]).includes(value);
}

type HouseTheme = {
  /** Human-facing colour name, as staff refer to it. */
  colourName: string;
  /** Solid house colour — backgrounds, bars, badges. */
  base: string;
  /** Darker shade for gradients and borders. */
  dark: string;
  /** Text colour that meets contrast on `base`. */
  ink: string;
};

/**
 * Yellow needs dark ink to stay legible; the other three carry white.
 * These are used on a projector at the back of a hall, so contrast matters
 * more than subtlety.
 */
export const HOUSE_THEME: Record<House, HouseTheme> = {
  Bears: { colourName: "Green", base: "#1a9c5b", dark: "#0f6b3d", ink: "#ffffff" },
  Eagles: { colourName: "Yellow", base: "#f2c012", dark: "#b8880a", ink: "#231d05" },
  Sharks: { colourName: "Blue", base: "#1f6fd0", dark: "#144a8f", ink: "#ffffff" },
  Tigers: { colourName: "Red", base: "#d62b2b", dark: "#951c1c", ink: "#ffffff" },
};
