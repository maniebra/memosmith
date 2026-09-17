import { fetch } from "@tauri-apps/plugin-http";
import { openUrl } from "@tauri-apps/plugin-opener";
import { derived, writable } from "svelte/store";
import type { GitlabInstance } from "../storage/settingsTypes";
import {
  apiBase,
  GITLAB_KINDS,
  gitlabDatabaseId,
  gitlabTables,
  listPath,
  mergeItems,
  rowCard,
  type GitlabCard,
  staleRowIds,
  type GitlabItem,
  type GitlabKind,
} from "../utils/gitlab";
import { rowsOf, tableOf } from "../utils/databaseTypes";
import {
  createDatabase,
  deleteDatabaseRow,
  listDatabases,
  loadDatabase,
  saveDatabaseMeta,
  saveDatabaseRow,
} from "./databases";

const lastSync = new Map<string, number>();

/** Synced items of each enabled instance, for embeds and the slash menu. */
const cardsByInstance = writable<Record<string, GitlabCard[]>>({});
export const gitlabCards = derived(cardsByInstance, (all) =>
  Object.values(all).flat(),
);

function setCards(instanceId: string, cards: GitlabCard[] | null) {
  cardsByInstance.update((all) => {
    const next = { ...all };
    if (cards) next[instanceId] = cards;
    else delete next[instanceId];
    return next;
  });
}

async function loadCards(root: string, instance: GitlabInstance) {
  const id = gitlabDatabaseId(instance);
  if (!(await listDatabases(root)).some((db) => db.id === id)) return;
  const database = await loadDatabase(root, id);
  setCards(
    instance.id,
    database.rows.map((row) => rowCard(id, row)),
  );
}

async function fetchAll(instance: GitlabInstance, kind: GitlabKind) {
  const items: GitlabItem[] = [];
  let page = "1";
  while (page) {
    const response = await fetch(
      `${apiBase(instance.url)}${listPath(kind, instance.group)}&page=${page}`,
      { headers: { "PRIVATE-TOKEN": instance.token.trim() } },
    );
    // Epics need a group on a Premium tier; anything else answers 403/404.
    if (kind === "epics" && [403, 404].includes(response.status)) {
      return null;
    }
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(
        `GitLab ${kind}: ${payload?.message ?? payload?.error ?? response.status}`,
      );
    }
    items.push(...(payload as GitlabItem[]));
    page = response.headers.get("x-next-page") ?? "";
  }
  return items;
}

/** Pulls issues, merge requests and epics into the space database of an instance. */
export async function syncGitlab(root: string, instance: GitlabInstance) {
  lastSync.set(instance.id, Date.now());
  if (!instance.url.trim() || !instance.token.trim()) {
    throw new Error("GitLab URL and token are required");
  }
  const id = gitlabDatabaseId(instance);
  const name = `GitLab · ${instance.name || instance.url}`;
  const exists = (await listDatabases(root)).some((db) => db.id === id);
  if (!exists) {
    await createDatabase(root, id, name, gitlabTables());
  }
  const database = await loadDatabase(root, id);
  const counts: Record<string, number> = {};
  const cards: GitlabCard[] = [];
  for (const { kind } of GITLAB_KINDS) {
    const table = tableOf(database, kind);
    if (table?.id !== kind) continue;
    const items =
      kind === "epics" && !instance.group.trim()
        ? null
        : await fetchAll(instance, kind);
    if (!items) continue;
    const rows = rowsOf(database, kind);
    const synced = mergeItems(table, rows, items);
    for (const row of synced) {
      cards.push(rowCard(id, row));
      await saveDatabaseRow(root, id, row);
    }
    for (const rowId of staleRowIds(table, rows, synced)) {
      await deleteDatabaseRow(root, id, rowId);
    }
    counts[kind] = items.length;
  }
  await saveDatabaseMeta(root, id, name, database.tables);
  setCards(instance.id, cards);
  return counts;
}

/**
 * Checks every minute for instances whose interval has passed and syncs them.
 */
export function scheduleGitlabSync(
  current: () => { root: string | null; instances: GitlabInstance[] },
  onError: (message: string) => void,
) {
  const running = new Set<string>();
  let loadedFor = "";
  /** Reloads cards when the space or the set of enabled instances changes. */
  const refresh = (..._dependencies: unknown[]) => {
    const { root, instances } = current();
    const enabled = instances.filter((instance) => instance.enabled);
    const signature = `${root}|${enabled.map((item) => item.id)}`;
    if (signature === loadedFor) return;
    loadedFor = signature;
    cardsByInstance.set({});
    for (const instance of root ? enabled : []) {
      loadCards(root!, instance).catch(() => {});
    }
  };
  const tick = () => {
    refresh();
    const { root, instances } = current();
    const enabled = instances.filter((instance) => instance.enabled);
    if (!root) return;
    for (const instance of enabled) {
      const minutes = Number(instance.interval);
      const due = (lastSync.get(instance.id) ?? 0) + minutes * 60_000;
      if (!(minutes > 0) || Date.now() < due || running.has(instance.id)) {
        continue;
      }
      running.add(instance.id);
      syncGitlab(root, instance)
        .catch((error) =>
          onError(error instanceof Error ? error.message : String(error)),
        )
        .finally(() => running.delete(instance.id));
    }
  };
  const timer = setInterval(tick, 60_000);
  tick();
  return { refresh, stop: () => clearInterval(timer) };
}

export function openGitlabUrl(url: string) {
  if (/^https?:\/\//.test(url)) {
    openUrl(url).catch(() => {});
  }
}
