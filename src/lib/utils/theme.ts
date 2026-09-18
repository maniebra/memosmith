export type AccentColor = "emerald" | "sky" | "violet" | "rose" | "amber";
export type ColorMode = "system" | "light" | "dark";
export type FontChoice = "system" | "inter" | "serif" | "mono";
export type CornerStyle = "soft" | "rounded" | "square" | "slanted";
export type Density = "comfortable" | "compact";
export type EditorLineHeight = "compact" | "comfortable" | "loose";
export type WindowButtons = "windows" | "macos" | "native";
/** Where drawings and diagrams open for editing: a full-screen modal or in place in the note. */
export type EmbedEditing = "modal" | "inline";

export type AppearanceSettings = {
  accentColor: AccentColor;
  uiFont: FontChoice;
  uiFontStack: string;
  editorFont: FontChoice;
  editorFontStack: string;
  cornerStyle: CornerStyle;
  density: Density;
  editorLineHeight: EditorLineHeight;
  windowButtons: WindowButtons;
  embedEditing: EmbedEditing;
  /** IntelliJ-style islands: panes float as rounded cards on a darker backdrop. */
  islands: boolean;
  /** Theme loaded from a `.memotheme` file; kept inline so it survives the file moving. */
  customTheme: MemoTheme | null;
};

/**
 * A `.memotheme` file: JSON naming CSS custom properties to override.
 * `accent` and `neutral` are shorthands for the emerald and stone scales
 * (keys 50..950, values any CSS color); `mode` pins light or dark.
 *
 * { "name": "Nord", "mode": "dark",
 *   "neutral": { "900": "#2e3440" }, "accent": { "600": "#88c0d0" },
 *   "variables": { "--ms-editor-line-height": "1.8" } }
 */
export type MemoTheme = {
  name: string;
  mode?: "light" | "dark";
  variables: Record<string, string>;
};

const scaleSteps = [
  "50",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
  "950",
];

function safeValue(value: unknown) {
  return typeof value === "string" &&
    value.length <= 200 &&
    !/[;{}<>]/.test(value)
    ? value.trim()
    : "";
}

/** Validates untrusted theme JSON; returns null when it is not a usable theme. */
export function parseMemoTheme(input: unknown): MemoTheme | null {
  let raw = input;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const data = raw as Record<string, unknown>;
  const variables: Record<string, string> = {};
  const scales = { accent: "--color-emerald-", neutral: "--color-stone-" };

  for (const [key, prefix] of Object.entries(scales)) {
    const scale = (data[key] ?? {}) as Record<string, unknown>;
    for (const step of scaleSteps) {
      const value = safeValue(scale[step]);
      if (value) {
        variables[prefix + step] = value;
      }
    }
  }
  for (const [name, value] of Object.entries(
    (data.variables ?? {}) as Record<string, unknown>,
  )) {
    const clean = safeValue(value);
    if (/^--[\w-]{1,80}$/.test(name) && clean) {
      variables[name] = clean;
    }
  }
  if (!Object.keys(variables).length) {
    return null;
  }

  const name = safeValue(data.name) || "Custom";
  const mode =
    data.mode === "light" || data.mode === "dark" ? data.mode : undefined;
  return mode ? { name, mode, variables } : { name, variables };
}

/** Window buttons that match the host OS: its own look on Windows and macOS, the real frame on Linux. */
function platformWindowButtons(): WindowButtons {
  const agent = typeof navigator === "undefined" ? "" : navigator.userAgent;

  if (/Mac/.test(agent)) {
    return "macos";
  }

  return /Windows/.test(agent) ? "windows" : "native";
}

export const defaultAppearanceSettings: AppearanceSettings = {
  accentColor: "emerald",
  uiFont: "system",
  uiFontStack: "",
  editorFont: "system",
  editorFontStack: "",
  cornerStyle: "soft",
  density: "comfortable",
  editorLineHeight: "comfortable",
  windowButtons: platformWindowButtons(),
  embedEditing: "modal",
  islands: false,
  customTheme: null,
};

export const accentOptions: {
  label: string;
  value: AccentColor;
  preview: string;
}[] = [
  { label: "Emerald", value: "emerald", preview: "rgb(5 150 105)" },
  { label: "Sky", value: "sky", preview: "rgb(2 132 199)" },
  { label: "Violet", value: "violet", preview: "rgb(124 58 237)" },
  { label: "Rose", value: "rose", preview: "rgb(225 29 72)" },
  { label: "Amber", value: "amber", preview: "rgb(217 119 6)" },
];

export const fontOptions: { label: string; value: FontChoice }[] = [
  { label: "System", value: "system" },
  { label: "Inter", value: "inter" },
  { label: "Serif", value: "serif" },
  { label: "Mono", value: "mono" },
];

export const cornerOptions: { label: string; value: CornerStyle }[] = [
  { label: "Soft", value: "soft" },
  { label: "Rounded", value: "rounded" },
  { label: "Square", value: "square" },
  { label: "Slanted", value: "slanted" },
];

export const densityOptions: { label: string; value: Density }[] = [
  { label: "Comfortable", value: "comfortable" },
  { label: "Compact", value: "compact" },
];

export const editorLineHeightOptions: {
  label: string;
  value: EditorLineHeight;
}[] = [
  { label: "Compact", value: "compact" },
  { label: "Comfortable", value: "comfortable" },
  { label: "Loose", value: "loose" },
];

const accentPalettes: Record<AccentColor, Record<string, string>> = {
  emerald: {
    "50": "236 253 245",
    "100": "209 250 229",
    "200": "167 243 208",
    "300": "110 231 183",
    "400": "52 211 153",
    "500": "16 185 129",
    "600": "5 150 105",
    "700": "4 120 87",
    "800": "6 95 70",
    "900": "6 78 59",
    "950": "2 44 34",
  },
  sky: {
    "50": "240 249 255",
    "100": "224 242 254",
    "200": "186 230 253",
    "300": "125 211 252",
    "400": "56 189 248",
    "500": "14 165 233",
    "600": "2 132 199",
    "700": "3 105 161",
    "800": "7 89 133",
    "900": "12 74 110",
    "950": "8 47 73",
  },
  violet: {
    "50": "245 243 255",
    "100": "237 233 254",
    "200": "221 214 254",
    "300": "196 181 253",
    "400": "167 139 250",
    "500": "139 92 246",
    "600": "124 58 237",
    "700": "109 40 217",
    "800": "91 33 182",
    "900": "76 29 149",
    "950": "46 16 101",
  },
  rose: {
    "50": "255 241 242",
    "100": "255 228 230",
    "200": "254 205 211",
    "300": "253 164 175",
    "400": "251 113 133",
    "500": "244 63 94",
    "600": "225 29 72",
    "700": "190 18 60",
    "800": "159 18 57",
    "900": "136 19 55",
    "950": "76 5 25",
  },
  amber: {
    "50": "255 251 235",
    "100": "254 243 199",
    "200": "253 230 138",
    "300": "252 211 77",
    "400": "251 191 36",
    "500": "245 158 11",
    "600": "217 119 6",
    "700": "180 83 9",
    "800": "146 64 14",
    "900": "120 53 15",
    "950": "69 26 3",
  },
};

const fontStacks: Record<FontChoice, string> = {
  system:
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  inter:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  serif: 'Charter, "Bitstream Charter", "Sitka Text", Cambria, serif',
  mono: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
};

const genericFontFamilies = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "emoji",
  "math",
  "fangsong",
]);

function cleanFontFamily(value: string) {
  const family = value
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();

  if (!family || /[;{}]/.test(family)) {
    return "";
  }

  return genericFontFamilies.has(family.toLowerCase())
    ? family.toLowerCase()
    : JSON.stringify(family);
}

export function normalizeFontStack(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .split(",")
    .map(cleanFontFamily)
    .filter(Boolean)
    .slice(0, 12)
    .join(", ");
}

function fontFamilyFor(choice: FontChoice, stack: string) {
  const normalizedStack = normalizeFontStack(stack);

  return normalizedStack
    ? `${normalizedStack}, ${fontStacks[choice]}`
    : fontStacks[choice];
}

const cornerVariables: Partial<Record<CornerStyle, Record<string, string>>> = {
  soft: {
    "--radius-sm": "0.25rem",
    "--radius-md": "0.375rem",
    "--radius-lg": "0.5rem",
    "--radius-xl": "0.75rem",
  },
  rounded: {
    "--radius-sm": "0.375rem",
    "--radius-md": "0.5rem",
    "--radius-lg": "0.75rem",
    "--radius-xl": "1rem",
  },
  square: {
    "--radius-sm": "0.125rem",
    "--radius-md": "0.1875rem",
    "--radius-lg": "0.25rem",
    "--radius-xl": "0.375rem",
  },
};

const lineHeights: Record<EditorLineHeight, string> = {
  compact: "1.55",
  comfortable: "1.75",
  loose: "1.95",
};

export function applyAppearanceTheme(
  theme: ColorMode,
  appearance: AppearanceSettings,
  systemPrefersDark: boolean,
  badges = true,
) {
  const root = document.documentElement;
  const custom = appearance.customTheme;
  const mode = custom?.mode ?? theme;
  const useDark = mode === "dark" || (mode === "system" && systemPrefersDark);
  const palette = accentPalettes[appearance.accentColor];

  // Drop the previous theme's overrides before the built-ins are set again.
  applyThemeVariables(root, {});

  root.classList.toggle("dark", useDark);
  root.style.colorScheme = useDark ? "dark" : "light";
  root.dataset.density = appearance.density;
  root.dataset.corners = appearance.cornerStyle;
  root.toggleAttribute("data-islands", appearance.islands);
  root.toggleAttribute("data-badges", badges);

  for (const [step, rgb] of Object.entries(palette)) {
    root.style.setProperty(`--color-emerald-${step}`, `rgb(${rgb})`);
  }

  root.style.setProperty("--ms-accent-rgb", palette["600"]);
  root.style.setProperty("--ms-accent-strong-rgb", palette["700"]);
  root.style.setProperty("--ms-accent-soft-rgb", palette["500"]);
  root.style.setProperty("--ms-accent-color", `rgb(${palette["600"]})`);
  root.style.setProperty("--ms-accent-strong", `rgb(${palette["700"]})`);
  root.style.setProperty("--ms-accent-soft", `rgb(${palette["500"]})`);
  root.style.setProperty(
    "--ms-ui-font",
    fontFamilyFor(appearance.uiFont, appearance.uiFontStack),
  );
  root.style.setProperty(
    "--ms-editor-font",
    fontFamilyFor(appearance.editorFont, appearance.editorFontStack),
  );
  root.style.setProperty(
    "--ms-editor-line-height",
    lineHeights[appearance.editorLineHeight],
  );

  for (const [name, value] of Object.entries(
    cornerVariables[appearance.cornerStyle] ?? {},
  )) {
    root.style.setProperty(name, value);
  }

  // Last, so a theme file wins over every built-in choice above.
  applyThemeVariables(root, custom?.variables ?? {});
}

let appliedThemeVariables: string[] = [];

function applyThemeVariables(
  root: HTMLElement,
  variables: Record<string, string>,
) {
  for (const name of appliedThemeVariables) {
    root.style.removeProperty(name);
  }
  appliedThemeVariables = Object.keys(variables);
  for (const [name, value] of Object.entries(variables)) {
    root.style.setProperty(name, value);
  }
}
