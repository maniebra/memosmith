import { fetch } from "@tauri-apps/plugin-http";
import type { GitlabInstance } from "../storage/settingsTypes";
import {
  apiBase,
  GITLAB_KINDS,
  gitlabDatabaseId,
  gitlabTables,
  listPath,
  mergeItems,
  type GitlabItem,
  type GitlabKind,
} from "../utils/gitlab";
import { rowsOf, tableOf } from "../utils/databaseTypes";
import {
  createDatabase,
  listDatabases,
  loadDatabase,
  saveDatabaseMeta,
  saveDatabaseRow,
} from "./databases";

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
  for (const { kind } of GITLAB_KINDS) {
    const table = tableOf(database, kind);
    if (table?.id !== kind) continue;
    const items =
      kind === "epics" && !instance.group.trim()
        ? null
        : await fetchAll(instance, kind);
    if (!items) continue;
    for (const row of mergeItems(table, rowsOf(database, kind), items)) {
      await saveDatabaseRow(root, id, row);
    }
    counts[kind] = items.length;
  }
  await saveDatabaseMeta(root, id, name, database.tables);
  return counts;
}
