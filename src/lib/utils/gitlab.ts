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
  return `${scope}/${kind}?per_page=100&order_by=updated_at&state=all`;
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
  labels?: (string | { name?: string })[];
  created_at?: string;
  updated_at?: string;
  web_url?: string;
};

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
        name: text(item.name),
        url: text(item.url),
        token: text(item.token),
        group: text(item.group),
        interval: text(item.interval),
      },
    ];
  });
}
