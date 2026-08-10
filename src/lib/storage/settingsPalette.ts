import { defaultDatabasePalette } from "./settingsDefaults";
import type { PaletteColor } from "./settingsTypes";

function defaults() {
  return defaultDatabasePalette.map((color) => ({ ...color }));
}

/** Palette entries are user-typed, so ids and hexes are checked before use. */
export function readPalette(value: unknown): PaletteColor[] {
  if (!Array.isArray(value)) {
    return defaults();
  }
  const seen = new Set<string>();
  const palette: PaletteColor[] = [];
  for (const entry of value as Partial<PaletteColor>[]) {
    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    const hex = /^#[0-9a-f]{6}$/i.test(entry.hex ?? "") ? entry.hex! : "";
    if (!id || !hex || seen.has(id)) {
      continue;
    }
    seen.add(id);
    palette.push({
      id,
      label:
        typeof entry.label === "string" && entry.label.trim()
          ? entry.label.trim()
          : id,
      hex,
    });
  }
  // An empty palette would leave every chip colourless, so the defaults stand in.
  return palette.length ? palette : defaults();
}
