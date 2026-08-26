const HEX = /^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * MusicXML's `color` type matches `#[\dA-F]{6}([\dA-F][\dA-F])?` — uppercase
 * only — so a value the user types has to be normalised before it can be
 * written. Black is the default a chart falls back to, so it is rendered by
 * writing no colour at all; anything unparseable is treated the same way
 * rather than emitting an invalid attribute.
 */
export function normalizeColor(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const match = HEX.exec(value.trim());
  if (match === null) {
    return null;
  }
  const digits = match[0].replace("#", "");
  const full =
    digits.length === 3 ? digits.replace(/./g, (character) => character + character) : digits;
  const upper = full.toUpperCase();
  return upper === "000000" ? null : `#${upper}`;
}
