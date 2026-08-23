export type DisplayOptions = {
  animate: boolean;
  mascot: boolean;
  sound: boolean;
};

/**
 * The admin settings are the school-wide default. A single screen can differ
 * from that default through its URL, which is what a lobby or reception
 * display needs: bookmark the quiet URL on that machine and leave every other
 * screen — classrooms, the auditorium — showing the full reveal.
 *
 * Held in the URL rather than on the device so a screen's behaviour is visible
 * from the address bar and survives a browser reset or a replacement machine.
 */
const FALSEY = new Set(["0", "off", "false", "no"]);

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Present but valueless (`?quiet`) counts as on; `?quiet=0` counts as off. */
function asFlag(value: string | string[] | undefined): boolean | undefined {
  const raw = first(value);
  if (raw === undefined) return undefined;
  return !FALSEY.has(raw.trim().toLowerCase());
}

export function resolveDisplayOptions(
  params: Record<string, string | string[] | undefined>,
  defaults: DisplayOptions,
): DisplayOptions {
  // `quiet` shifts the baseline for the whole screen; the individual
  // parameters still win, so `?quiet&mascot=1` keeps just the mascot.
  const quiet = asFlag(params.quiet) === true;
  const base: DisplayOptions = quiet
    ? { animate: false, mascot: false, sound: false }
    : defaults;

  return {
    animate: asFlag(params.animate) ?? base.animate,
    mascot: asFlag(params.mascot) ?? base.mascot,
    sound: asFlag(params.sound) ?? base.sound,
  };
}
