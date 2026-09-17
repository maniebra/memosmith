import type { GitlabInstance } from "../storage/settingsTypes";
import type { CellValue, Column, Row, Table } from "./databaseTypes";
import { BODY, emptyFilter } from "./database";

export type GitlabKind = "issues" | "merge_requests" | "epics";

export const GITLAB_KINDS: { kind: GitlabKind; name: string }[] = [
  { kind: "issues", name: "Issues" },
  { kind: "merge_requests", name: "Merge requests" },
  { kind: "epics", name: "Epics" },
];

/** Column ids are fixed so a re-sync writes into the same cells. */
const COLUMNS: Column[] = [
  { id: "title", name: "Title", type: "text" },
  { id: "state", name: "State", type: "select", options: [] },
  { id: "reference", name: "Reference", type: "text" },
  { id: "author", name: "Author", type: "text" },
  { id: "assignees", name: "Assignees", type: "multi_select", options: [] },
  { id: "labels", name: "Labels", type: "multi_select", options: [] },
  { id: "created", name: "Created", type: "date" },
  { id: "updated", name: "Updated", type: "date" },
  { id: "url", name: "URL", type: "url" },
];

export function gitlabDatabaseId(instance: GitlabInstance) {
  return `gitlab-${instance.id}`;
}

export function gitlabTables(): Table[] {
  return GITLAB_KINDS.map(({ kind, name }) => ({
    id: kind,
    name,
    columns: COLUMNS.map((column) => ({ ...column })),
    views: [
      {
        id: `${kind}-table`,
        name: "Table",
        type: "table",
        filter: emptyFilter(),
        sorts: [{ column: "updated", direction: "desc" }],
      },
      {
        id: `${kind}-board`,
        name: "Board",
        type: "board",
        groupBy: "state",
        filter: emptyFilter(),
        sorts: [],
      },
    ],
  }));
}

/** GitLab's REST base for an instance URL, e.g. `https://gitlab.com/api/v4`. */
export function apiBase(url: string) {
  return `${url.trim().replace(/\/+$/, "")}/api/v4`;
}

export function listPath(kind: GitlabKind, group: string) {
  const scope = group.trim()
    ? `/groups/${encodeURIComponent(group.trim())}`
    : "";
  return `${scope}/${kind}?per_page=100&order_by=updated_at&state=all&with_labels_details=true`;
}

type GitlabUser = { username?: string };
export type GitlabItem = {
  id: number;
  title?: string;
  description?: string | null;
  state?: string;
  references?: { full?: string };
  author?: GitlabUser;
  assignees?: GitlabUser[];
  labels?: (string | { name?: string; color?: string })[];
  created_at?: string;
  updated_at?: string;
  web_url?: string;
};

/** Label name -> GitLab colour, as JSON; the labels column only holds names. */
const LABEL_COLORS = "__label_colors";

const day = (value?: string) => (value ? value.slice(0, 10) : null);

export function itemCells(item: GitlabItem): Record<string, CellValue> {
  return {
    title: item.title ?? "",
    state: item.state ?? "",
    reference: item.references?.full ?? "",
    author: item.author?.username ?? "",
    assignees: (item.assignees ?? []).flatMap((user) =>
      user.username ? [user.username] : [],
    ),
    labels: (item.labels ?? []).flatMap((label) => {
      const name = typeof label === "string" ? label : label.name;
      return name ? [name] : [];
    }),
    created: day(item.created_at),
    updated: day(item.updated_at),
    url: item.web_url ?? "",
    [BODY]: item.description ?? "",
    [LABEL_COLORS]: JSON.stringify(
      Object.fromEntries(
        (item.labels ?? []).flatMap((label) =>
          typeof label === "object" && label.name && label.color
            ? [[label.name, label.color]]
            : [],
        ),
      ),
    ),
  };
}

/** Upserts items into a table, keeping any cells the user added to existing rows. */
export function mergeItems(
  table: Table,
  rows: Row[],
  items: GitlabItem[],
): Row[] {
  const existing = new Map(rows.map((row) => [row.id, row]));
  let position = rows.reduce((max, row) => Math.max(max, row.position), 0);
  const merged = items.map((item) => {
    const id = `${table.id}-${item.id}`;
    const row = existing.get(id);
    const data = { ...row?.data, ...itemCells(item) };
    return {
      id,
      tableId: table.id,
      position: row?.position ?? ++position,
      data,
    };
  });
  for (const column of table.columns) {
    if (!column.options) continue;
    const values = new Set(column.options);
    for (const row of merged) {
      const cell = row.data[column.id];
      for (const value of Array.isArray(cell) ? cell : [cell]) {
        if (typeof value === "string" && value) values.add(value);
      }
    }
    column.options = [...values];
  }
  return merged;
}

/** Synced rows no longer returned by GitLab; rows the user added are left alone. */
export function staleRowIds(table: Table, rows: Row[], synced: Row[]) {
  const keep = new Set(synced.map((row) => row.id));
  const pattern = new RegExp(`^${table.id}-\\d+$`);
  return rows
    .filter((row) => pattern.test(row.id) && !keep.has(row.id))
    .map((row) => row.id);
}

export function readGitlab(value: unknown): GitlabInstance[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    const item = (entry ?? {}) as Partial<GitlabInstance>;
    if (typeof item.id !== "string" || !item.id) {
      return [];
    }
    const text = (field: unknown) => (typeof field === "string" ? field : "");
    return [
      {
        id: item.id,
        enabled: item.enabled !== false,
        name: text(item.name),
        url: text(item.url),
        token: text(item.token),
        group: text(item.group),
        interval: text(item.interval),
      },
    ];
  });
}

/** Language of the fenced block that embeds one GitLab item as a card. */
export const GITLAB_LANGUAGE = "gitlab";

/** What a card shows; the fence keeps a copy so it renders before any sync. */
export type GitlabCard = {
  /** `<database id>/<row id>`, used to look up the latest synced cells. */
  key: string;
  kind: GitlabKind;
  title: string;
  state: string;
  reference: string;
  author: string;
  assignees: string[];
  labels: string[];
  labelColors?: Record<string, string>;
  updated: string;
  url: string;
};

const strings = (value: CellValue | undefined) =>
  Array.isArray(value) ? value : [];
const text = (value: CellValue | undefined) =>
  typeof value === "string" ? value : "";

function colorsOf(value: CellValue | undefined): Record<string, string> {
  try {
    const parsed = JSON.parse(text(value) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

const HEX = /^#[\da-f]{6}$/i;

/** Dark text on light colours, white on dark, the way GitLab picks it. */
function textOn(hex: string) {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#1f1e24" : "#ffffff";
}

/** `scope::value` splits on the last `::` into GitLab's two-part pill. */
export function labelHtml(name: string, color?: string) {
  const hex = color && HEX.test(color) ? color : "#6b7280";
  const style = `--label-bg:${hex};--label-fg:${textOn(hex)}`;
  const split = name.lastIndexOf("::");
  if (split > 0) {
    return `<span class="md-gitlab-label md-gitlab-scoped" style="${style}"><span class="md-gitlab-scope">${esc(
      name.slice(0, split),
    )}</span><span class="md-gitlab-value">${esc(name.slice(split + 2))}</span></span>`;
  }
  return `<span class="md-gitlab-label" style="${style}">${esc(name)}</span>`;
}

export function rowCard(databaseId: string, row: Row): GitlabCard {
  const data = row.data;
  return {
    key: `${databaseId}/${row.id}`,
    kind: row.tableId as GitlabKind,
    title: text(data.title),
    state: text(data.state),
    reference: text(data.reference),
    author: text(data.author),
    assignees: strings(data.assignees),
    labels: strings(data.labels),
    labelColors: colorsOf(data[LABEL_COLORS]),
    updated: text(data.updated),
    url: text(data.url),
  };
}

export function gitlabEmbed(card: GitlabCard) {
  return "```" + GITLAB_LANGUAGE + "\n" + JSON.stringify(card) + "\n```";
}

const ICONS: Record<GitlabKind, string> = {
  issues:
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
  merge_requests:
    '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M6 8.5v7M18 15.5V10a3 3 0 0 0-3-3h-4"/><path d="m13 5-2 2 2 2"/>',
  epics: '<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
};

const esc = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );

export function parseGitlabCard(source: string): GitlabCard | null {
  try {
    const card = JSON.parse(source) as Partial<GitlabCard>;
    return typeof card.key === "string" ? (card as GitlabCard) : null;
  } catch {
    return null;
  }
}

/** The card for a `gitlab` fence; synced data wins over the stored copy. */
export function gitlabPreview(
  group: number,
  source: string,
  resolve?: (key: string) => GitlabCard | undefined,
) {
  const stored = parseGitlabCard(source);
  const card = stored && (resolve?.(stored.key) ?? stored);
  const open = `<div class="md-preview md-gitlab-preview" data-code="${group}" contenteditable="false">`;
  if (!card) {
    return `${open}<p class="md-gitlab-empty">Invalid GitLab embed</p></div>`;
  }
  const state = card.state || "unknown";
  const chips = card.labels
    .map((label) => labelHtml(label, card.labelColors?.[label]))
    .join("");
  const people = [
    card.author && `by ${esc(card.author)}`,
    card.assignees.length && `→ ${card.assignees.map(esc).join(", ")}`,
    card.updated && `updated ${esc(card.updated)}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return `${open}<div class="md-gitlab-head"><svg class="md-gitlab-icon md-gitlab-${esc(
    state,
  )}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${
    ICONS[card.kind] ?? ICONS.issues
  }</svg><span class="md-gitlab-ref">${esc(
    card.reference,
  )}</span><span class="md-gitlab-state md-gitlab-${esc(state)}">${esc(
    state,
  )}</span></div><a class="md-gitlab-title" data-gitlab-url="${esc(
    card.url,
  )}">${esc(card.title)}</a>${
    chips || people
      ? `<div class="md-gitlab-meta">${chips}<span class="md-gitlab-people">${people}</span></div>`
      : ""
  }</div>`;
}

export function gitlabResolver(cards: GitlabCard[]) {
  const byKey = new Map(cards.map((card) => [card.key, card]));
  return (key: string) => byKey.get(key);
}

/** Slash menu entries: GitLab, then a kind, then its items. */
type GitlabMenuEntry = {
  label: string;
  hint: string;
  prefix: string;
  detail?: string;
  children?: GitlabMenuEntry[];
};

export function gitlabMenu(cards: GitlabCard[]): GitlabMenuEntry[] {
  const children = GITLAB_KINDS.map(({ kind, name }) => ({
    label: name,
    hint: "",
    prefix: "",
    children: cards
      .filter((card) => card.kind === kind)
      .map((card) => ({
        label: card.title || card.reference,
        hint: card.reference,
        detail: card.reference,
        prefix: gitlabEmbed(card),
      })),
  })).filter((command) => command.children.length);
  return children.length
    ? [{ label: "GitLab", hint: "embed", prefix: "", children }]
    : [];
}
