type IconNodeElement = {
  tag: string;
  attrs: Record<string, string>;
};

export const CALLOUT_ICON_OPTIONS = [
  { value: "Info", label: "Info" },
  { value: "Lightbulb", label: "Lightbulb" },
  { value: "BadgeAlert", label: "Badge alert" },
  { value: "TriangleAlert", label: "Triangle alert" },
  { value: "CircleX", label: "Circle X" },
  { value: "CircleQuestionMark", label: "Question" },
  { value: "Star", label: "Star" },
  { value: "Zap", label: "Zap" },
];

const CALLOUT_ICON_NAMES = new Set(CALLOUT_ICON_OPTIONS.map((icon) => icon.value));

const LEGACY_ICON_NAMES: Record<string, string> = {
  i: "Info",
  "*": "Lightbulb",
  "!": "TriangleAlert",
  x: "CircleX",
  "?": "CircleQuestionMark",
};

const ICON_NODES: Record<string, IconNodeElement[]> = {
  Info: [
    { tag: "circle", attrs: { cx: "12", cy: "12", r: "10" } },
    { tag: "path", attrs: { d: "M12 16v-4" } },
    { tag: "path", attrs: { d: "M12 8h.01" } },
  ],
  Lightbulb: [
    {
      tag: "path",
      attrs: {
        d: "M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5",
      },
    },
    { tag: "path", attrs: { d: "M9 18h6" } },
    { tag: "path", attrs: { d: "M10 22h4" } },
  ],
  BadgeAlert: [
    {
      tag: "path",
      attrs: {
        d: "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z",
      },
    },
    { tag: "line", attrs: { x1: "12", x2: "12", y1: "8", y2: "12" } },
    { tag: "line", attrs: { x1: "12", x2: "12.01", y1: "16", y2: "16" } },
  ],
  TriangleAlert: [
    {
      tag: "path",
      attrs: { d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" },
    },
    { tag: "path", attrs: { d: "M12 9v4" } },
    { tag: "path", attrs: { d: "M12 17h.01" } },
  ],
  CircleX: [
    { tag: "circle", attrs: { cx: "12", cy: "12", r: "10" } },
    { tag: "path", attrs: { d: "m15 9-6 6" } },
    { tag: "path", attrs: { d: "m9 9 6 6" } },
  ],
  CircleQuestionMark: [
    { tag: "circle", attrs: { cx: "12", cy: "12", r: "10" } },
    { tag: "path", attrs: { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" } },
    { tag: "path", attrs: { d: "M12 17h.01" } },
  ],
  Star: [
    {
      tag: "path",
      attrs: {
        d: "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z",
      },
    },
  ],
  Zap: [
    {
      tag: "path",
      attrs: {
        d: "M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z",
      },
    },
  ],
};

function svgAttrs(attrs: Record<string, string>) {
  return Object.entries(attrs)
    .map(([key, value]) => `${key}="${value}"`)
    .join(" ");
}

export function normalizeCalloutIcon(value: unknown) {
  if (typeof value !== "string") {
    return "Info";
  }

  const trimmed = value.trim();
  const legacy = LEGACY_ICON_NAMES[trimmed.toLowerCase()] ?? LEGACY_ICON_NAMES[trimmed];

  if (legacy) {
    return legacy;
  }

  return CALLOUT_ICON_NAMES.has(trimmed) ? trimmed : "Info";
}

export function calloutIconSvg(value: string) {
  const name = normalizeCalloutIcon(value);
  const nodes = ICON_NODES[name] ?? ICON_NODES.Info;
  const body = nodes.map((node) => `<${node.tag} ${svgAttrs(node.attrs)} />`).join("");

  return `<svg class="md-callout-lucide lucide lucide-${name}" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
