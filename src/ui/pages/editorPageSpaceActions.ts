import {
  chooseSpaceRoot,
  confirmDelete,
  createNote,
  listSpace,
  loadSpaceMeta,
  readNote,
} from "../../lib/tauri/files";
import {
  createDatabase,
  deleteDatabase,
  listDatabases,
} from "../../lib/tauri/databases";
import { saveSpaceRoot } from "../../lib/storage/space";
import { journal } from "../../lib/utils/journal";
import { defaultTable, slugify } from "../../lib/utils/database";
import {
  basename,
  dirNotePath,
  displayNotePath,
  withNoteExtension,
} from "../../lib/utils/path";
import {
  resolveWikilinkTarget,
  wikilinkCreatePath,
} from "../../lib/utils/wikilinks";
import type { EditorPageContext } from "./editorPageContext";
import { safeName } from "./editorPageUtils";

type CoreActions = {
  flushNoteSave: () => Promise<void>;
  focusEditor: (force?: boolean) => void;
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
    this.context.activeTab = null;
    this.context.activeDatabaseId = null;
    this.core.setEditorText("", null);
    await this.refreshSpace();
    this.context.statusMessage = this.context.t("app.space", {
      name: basename(this.context.spaceRoot),
    });
  }

  async selectSpaceNote(relativePath: string) {
    this.context.activeTab = relativePath;
    this.context.activeDatabaseId = null;
    await this.core.flushNoteSave();
    const notePath = this.spacePath(relativePath);
    const text = await readNote(notePath);
    this.context.noteContents = {
      ...this.context.noteContents,
      [relativePath]: text,
    };
    this.core.setEditorText(text, notePath);
    journal("selectSpaceNote:done", {
      relativePath,
      notePath,
      length: text.length,
    });
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
    this.context.activeTab = relativePath;
    this.context.activeDatabaseId = null;
    this.core.setEditorText("", this.spacePath(relativePath));
    this.context.noteContents = {
      ...this.context.noteContents,
      [relativePath]: "",
    };
    this.context.statusMessage = this.context.t("app.created", {
      name: displayNotePath(relativePath),
    });
    this.core.focusEditor(true);
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
    this.context.activeTab = relativePath;
    this.context.activeDatabaseId = null;
    this.core.setEditorText("", this.spacePath(relativePath));
    this.context.noteContents = {
      ...this.context.noteContents,
      [relativePath]: "",
    };
    this.context.statusMessage = this.context.t("app.created", {
      name: displayNotePath(relativePath),
    });
    this.core.focusEditor(true);
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
    this.context.activeTab = `db:${id}`;
    this.context.activeDatabaseId = id;
    this.context.databasesOpen = false;
    this.context.statusMessage = this.context.t("app.createdDatabase", {
      name,
    });
  }

  async selectDatabase(id: string) {
    journal("selectDatabase", { id, activeTab: this.context.activeTab });
    this.context.activeTab = `db:${id}`;
    this.context.activeDatabaseId = id;
    await this.core.flushNoteSave();
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
    if (this.context.activeTab === `db:${id}`) {
      this.context.activeTab = this.context.activeRelativePath;
    }
    await this.refreshSpace();
    this.context.statusMessage = this.context.t("app.deletedDatabase", {
      name,
    });
  }
}
