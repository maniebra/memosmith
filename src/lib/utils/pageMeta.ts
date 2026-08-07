export type PageIcon = {
  type: "emoji" | "lucide";
  value: string;
};

export type PageMeta = {
  icon?: PageIcon | null;
  cover?: string | null;
};

export type SpaceMeta = Record<string, PageMeta>;

export const lucideIconNames = [
  "BookOpen",
  "Briefcase",
  "Calendar",
  "CheckSquare",
  "Code",
  "FileText",
  "Folder",
  "Heart",
  "Image",
  "Lightbulb",
  "ListTodo",
  "Map",
  "Music",
  "PenLine",
  "Rocket",
  "Sparkles",
  "Star",
  "Tag",
  "Target",
  "Users",
] as const;

export const emojiIconChoices = [
  "📝",
  "📚",
  "💡",
  "✅",
  "⭐",
  "🎯",
  "🚀",
  "🧠",
  "📌",
  "🗓️",
  "🔖",
  "🧪",
] as const;

const lucideLookup = new Map(lucideIconNames.map((name) => [normalizeLucideName(name), name]));

export function cleanPageMeta(meta: PageMeta): PageMeta {
  const next: PageMeta = {};

  if (meta.icon?.value) {
    next.icon = meta.icon;
  }

  if (meta.cover) {
    next.cover = meta.cover;
  }

  return next;
}

export function hasPageMeta(meta: PageMeta) {
  return Boolean(meta.icon?.value || meta.cover);
}

export function parsePageIcon(input: string): PageIcon | null {
  const value = input.trim();

  if (!value) {
    return null;
  }

  const lucideMatch = value.match(/^lucide:(.+)$/i);
  const lucideName = lucideLookup.get(normalizeLucideName(lucideMatch?.[1] ?? value));

  if (lucideName) {
    return { type: "lucide", value: lucideName };
  }

  return { type: "emoji", value };
}

function normalizeLucideName(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}
