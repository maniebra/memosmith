import { writable } from "svelte/store";
import { defaultDatabasePalette } from "../storage/settingsDefaults";
import type { PaletteColor } from "../storage/settingsTypes";
import type { Column } from "./databaseTypes";

export type { PaletteColor };

/**
 * The palette every chip reads. Settings own it; `EditorPage` pushes each change
 * in here so the chips deep inside a database do not need it drilled through.
 */
export const palette = writable<PaletteColor[]>(
  defaultDatabasePalette.map((color) => ({ ...color })),
);

function channels(hex: string) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((offset) =>
    Number.parseInt(value.slice(offset, offset + 2), 16),
  );
}

function rgba([red, green, blue]: number[], alpha: number) {
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

/** Blends towards white or near-black, so a chip's text stays readable on its fill. */
function shade(parts: number[], towards: number, ratio: number) {
  return `rgb(${parts
    .map((part) => Math.round(part + (towards - part) * ratio))
    .join(", ")})`;
}

/**
 * Both themes at once, as custom properties: `.db-chip` in `app.css` reads the
 * light pair and its `.dark` rule reads the dark one, so a chip needs no theme
 * knowledge and no Tailwind class per colour.
 */
export function chipStyle(hex: string) {
  const parts = channels(hex);
  return [
    `--chip-bg: ${rgba(parts, 0.16)}`,
    `--chip-fg: ${shade(parts, 0, 0.35)}`,
    `--chip-bg-dark: ${rgba(parts, 0.22)}`,
    `--chip-fg-dark: ${shade(parts, 255, 0.45)}`,
  ].join("; ");
}

export function entryFor(colors: PaletteColor[], id: string) {
  return colors.find((color) => color.id === id);
}

/** Stable per-name colour, so untouched options still look varied, not all grey. */
function fallbackId(colors: PaletteColor[], option: string) {
  let hash = 0;
  for (const character of option) {
    hash = (hash * 31 + character.charCodeAt(0)) % 1_000_003;
  }
  return colors[hash % colors.length]?.id ?? "";
}

/** Palette id a value shows in: the column's choice, else one derived from its name. */
export function colorOf(
  column: Column,
  option: string,
  colors: PaletteColor[],
) {
  const chosen = column.optionColors?.[option];
  return chosen && entryFor(colors, chosen)
    ? chosen
    : fallbackId(colors, option);
}

/** Inline style for a value's chip; an unknown colour falls back to the first swatch. */
export function optionChipStyle(
  column: Column,
  option: string,
  colors: PaletteColor[],
) {
  const entry =
    entryFor(colors, colorOf(column, option, colors)) ??
    colors[0] ??
    defaultDatabasePalette[0];
  return chipStyle(entry.hex);
}

/** True for the column types whose values are chips. */
export function hasOptionColors(column: Column) {
  return (
    column.type === "select" ||
    column.type === "status" ||
    column.type === "multi_select"
  );
}
