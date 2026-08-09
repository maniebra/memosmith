import {
  chooseSpaceRoot,
  confirmDelete,
  createNote,
  deletePageMeta,
  deletePath,
  listSpace,
  loadSpaceMeta,
  pruneAssets,
  readNote,
  renamePageMeta,
  renamePath,
} from "../../lib/tauri/files";
import {
  createDatabase,
  deleteDatabase,
  listDatabases,
} from "../../lib/tauri/databases";
import { saveSpaceRoot } from "../../lib/storage/space";
import { defaultTable, slugify } from "../../lib/utils/database";
import {
  basename,
  dirNoteName,
  dirNotePath,
  displayNotePath,
  withNoteExtension,
} from "../../lib/utils/path";
import {
  resolveWikilinkTarget,
  wikilinkCreatePath,
} from "../../lib/utils/wikilinks";
import type { EditorPageContext } from "./editorPageContext";
import {
  deletedMeta,
  deletedNoteContents,
  renamedMeta,
  renamedNoteContents,
  safeName,
} from "./editorPageUtils";

type CoreActions = {
  flushNoteSave: () => Promise<void>;
  focusEditor: () => void;
  setEditorText: (text: string, nextPath: string | null) => void;
};

export function createSpaceActions(
  context: EditorPageContext,
  core: CoreActions,
) {
  const service = new SpaceActions(context, core);
  return {
    chooseSpace: service.chooseSpace.bind(service),
    createSpaceNote: service.createSpaceNote.bind(service),
    openWikilink: service.openWikilink.bind(service),
    refreshSpace: service.refreshSpace.bind(service),
    selectSpaceNote: service.selectSpaceNote.bind(service),
    spacePath: service.spacePath.bind(service),
  };
}

class SpaceActions {
  constructor(
    private context: EditorPageContext,
    private core: CoreActions,
  ) {}

  spacePath(relativePath: string) {
    return `${this.context.spaceRoot}/${relativePath}`;
  }

  async refreshSpace() {
    if (!this.context.spaceRoot) {
      this.context.spaceNotes = [];
      this.context.spaceMeta = {};
      this.context.databases = [];
      this.context.noteContents = {};
      return;
    }
    const root = this.context.spaceRoot;
    const notes = await listSpace(root);
    const [meta, databaseSummaries] = await Promise.all([
      loadSpaceMeta(root),
      listDatabases(root),
    ]);
    this.context.noteContents = await loadNoteContents(root, notes);
    this.context.spaceNotes = notes;
    this.context.spaceMeta = meta;
    this.context.databases = databaseSummaries;
  }

  async chooseSpace() {
    const selectedRoot = await chooseSpaceRoot();
    if (!selectedRoot) {
      return;
    }
    this.context.spaceRoot = selectedRoot;
    saveSpaceRoot(this.context.spaceRoot);
    this.core.setEditorText("", null);
    await this.refreshSpace();
    this.context.statusMessage = this.context.t("app.space", {
      name: basename(this.context.spaceRoot),
    });
  }

  async selectSpaceNote(relativePath: string) {
    await this.core.flushNoteSave();
    this.context.activeDatabaseId = null;
    const notePath = this.spacePath(relativePath);
    const text = await readNote(notePath);
    this.context.noteContents = {
      ...this.context.noteContents,
      [relativePath]: text,
    };
    this.core.setEditorText(text, notePath);
    this.context.statusMessage = this.context.t("app.selected", {
      name: displayNotePath(relativePath),
    });
    this.core.focusEditor();
  }

  async createSpaceNote(parentPath: string, name: string, folder = false) {
    await this.core.flushNoteSave();
    const parent = parentPath ? `${parentPath}/` : "";
    const relativePath = folder
      ? dirNotePath(`${parent}${safeName(name)}`)
      : `${parent}${withNoteExtension(safeName(name))}`;
    await createNote(this.spacePath(relativePath));
    await this.refreshSpace();
    this.core.setEditorText("", this.spacePath(relativePath));
    this.context.noteContents = {
      ...this.context.noteContents,
      [relativePath]: "",
    };
    this.context.statusMessage = this.context.t("app.created", {
      name: displayNotePath(relativePath),
    });
    this.core.focusEditor();
  }

  async openWikilink(rawTarget: string) {
    if (!this.context.spaceRoot) {
      return;
    }
    await this.core.flushNoteSave();
    const resolved = resolveWikilinkTarget(
      rawTarget,
      this.context.spaceNotes,
      this.context.activeRelativePath,
    );
    if (resolved.path) {
      await this.selectSpaceNote(resolved.path);
      return;
    }
    await this.createMissingWikilink(rawTarget);
  }

  private async createMissingWikilink(rawTarget: string) {
    const relativePath = wikilinkCreatePath(
      rawTarget,
      this.context.activeRelativePath,
    );
    if (!relativePath) {
      this.context.statusMessage = this.context.t("app.invalidWikilink");
      return;
    }
    await createNote(this.spacePath(relativePath));
    await this.refreshSpace();
    this.core.setEditorText("", this.spacePath(relativePath));
    this.context.noteContents = {
      ...this.context.noteContents,
      [relativePath]: "",
    };
    this.context.statusMessage = this.context.t("app.created", {
      name: displayNotePath(relativePath),
    });
    this.core.focusEditor();
  }
}

async function loadNoteContents(root: string, notes: string[]) {
  const entries = await Promise.all(
    notes.map(
      async (note) => [note, await readNote(`${root}/${note}`)] as const,
    ),
  );
  return Object.fromEntries(entries);
}

export function createDatabaseActions(
  context: EditorPageContext,
  core: Pick<CoreActions, "flushNoteSave">,
  refreshSpace: () => Promise<void>,
) {
  const service = new DatabaseActions(context, core, refreshSpace);
  return {
    createSpaceDatabase: service.createSpaceDatabase.bind(service),
    deleteSpaceDatabase: service.deleteSpaceDatabase.bind(service),
    selectDatabase: service.selectDatabase.bind(service),
  };
}

class DatabaseActions {
  constructor(
    private context: EditorPageContext,
    private core: Pick<CoreActions, "flushNoteSave">,
    private refreshSpace: () => Promise<void>,
  ) {}

  async createSpaceDatabase(name: string) {
    if (!this.context.spaceRoot) {
      return;
    }
    await this.core.flushNoteSave();
    const id = slugify(name);
    await createDatabase(this.context.spaceRoot, id, name, [defaultTable()]);
    await this.refreshSpace();
    this.context.activeDatabaseId = id;
    this.context.databasesOpen = false;
    this.context.statusMessage = this.context.t("app.createdDatabase", {
      name,
    });
  }

  async selectDatabase(id: string) {
    await this.core.flushNoteSave();
    this.context.activeDatabaseId = id;
    this.context.databasesOpen = false;
    this.context.statusMessage = this.context.t("app.opened", {
      name: this.context.databases.find((entry) => entry.id === id)?.name ?? id,
    });
  }

  async deleteSpaceDatabase(id: string) {
    const name =
      this.context.databases.find((entry) => entry.id === id)?.name ?? id;
    if (!this.context.spaceRoot || !(await confirmDelete(name))) {
      return;
    }
    await deleteDatabase(this.context.spaceRoot, id);
    if (this.context.activeDatabaseId === id) {
      this.context.activeDatabaseId = null;
    }
    await this.refreshSpace();
    this.context.statusMessage = this.context.t("app.deletedDatabase", {
      name,
    });
  }
}

export function createEntryActions(
  context: EditorPageContext,
  core: Pick<CoreActions, "flushNoteSave" | "setEditorText">,
  refreshSpace: () => Promise<void>,
  spacePath: (relativePath: string) => string,
) {
  const service = new EntryActions(context, core, refreshSpace, spacePath);
  return {
    deleteSpaceEntry: service.deleteSpaceEntry.bind(service),
    renameSpaceEntry: service.renameSpaceEntry.bind(service),
  };
}

class EntryActions {
  constructor(
    private context: EditorPageContext,
    private core: Pick<CoreActions, "flushNoteSave" | "setEditorText">,
    private refreshSpace: () => Promise<void>,
    private spacePath: (relativePath: string) => string,
  ) {}

  async renameSpaceEntry(relativePath: string, name: string) {
    await this.core.flushNoteSave();
    const next = renameTarget(this.context.spaceNotes, relativePath, name);
    await renamePath(this.spacePath(relativePath), this.spacePath(next.path));
    await renameDirectoryNote(this.context, relativePath, next, this.spacePath);
    this.updateOpenPath(relativePath, next);
    await renamePageMeta(
      this.context.spaceRoot!,
      relativePath,
      next.path,
      next.folder,
    );
    this.context.spaceMeta = renamedMeta(
      this.context.spaceMeta,
      relativePath,
      next.path,
      next.folder,
    );
    this.context.noteContents = renamedNoteContents(
      this.context.noteContents,
      relativePath,
      next.path,
      next.folder,
    );
    await this.refreshSpace();
    this.context.statusMessage = this.context.t("app.renamedTo", {
      name: displayNotePath(next.path),
    });
  }

  async deleteSpaceEntry(relativePath: string) {
    await this.core.flushNoteSave();
    if (!(await confirmDelete(relativePath))) {
      return;
    }
    await deletePath(this.spacePath(relativePath));
    if (this.context.path === this.spacePath(relativePath)) {
      this.core.setEditorText("", null);
    }
    const isFolder = !this.context.spaceNotes.includes(relativePath);
    await deletePageMeta(this.context.spaceRoot!, relativePath, isFolder);
    this.context.spaceMeta = deletedMeta(
      this.context.spaceMeta,
      relativePath,
      isFolder,
    );
    this.context.noteContents = deletedNoteContents(
      this.context.noteContents,
      relativePath,
      isFolder,
    );
    await pruneAssets(this.pruneRoot(relativePath));
    await this.refreshSpace();
    this.context.statusMessage = this.context.t("app.deleted", {
      name: displayNotePath(relativePath),
    });
  }

  private updateOpenPath(
    from: string,
    next: ReturnType<typeof renameTarget>,
  ) {
    const fromPath = this.spacePath(from);
    if (this.context.path === fromPath) {
      this.context.path = this.spacePath(next.path);
    } else if (next.folder && this.context.path?.startsWith(`${fromPath}/`)) {
      this.context.path = this.context.path.replace(
        fromPath,
        this.spacePath(next.path),
      );
    }
  }

  private pruneRoot(relativePath: string) {
    const parent = relativePath.includes("/")
      ? relativePath.slice(0, relativePath.lastIndexOf("/"))
      : "";
    return parent ? this.spacePath(parent) : this.context.spaceRoot!;
  }
}

function renameTarget(notes: string[], relativePath: string, name: string) {
  const parent = relativePath.includes("/")
    ? `${relativePath.slice(0, relativePath.lastIndexOf("/"))}/`
    : "";
  const folder = !notes.includes(relativePath);
  const relativeName = folder
    ? safeName(name)
    : withNoteExtension(safeName(name));
  return { folder, path: `${parent}${relativeName}` };
}

async function renameDirectoryNote(
  context: EditorPageContext,
  from: string,
  next: ReturnType<typeof renameTarget>,
  spacePath: (relativePath: string) => string,
) {
  if (!next.folder) {
    return;
  }
  const dirNote = `${from}/${dirNoteName(basename(from))}`;
  if (!context.spaceNotes.includes(dirNote)) {
    return;
  }
  await renamePath(
    spacePath(`${next.path}/${dirNoteName(basename(from))}`),
    spacePath(dirNotePath(next.path)),
  );
}
