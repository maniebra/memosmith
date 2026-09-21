import {
  confirmDelete,
  deletePageMeta,
  deletePath,
  pruneAssets,
  renamePageMeta,
  renamePath,
  saveSpaceMeta,
} from "../../lib/tauri/files";
import { cleanPageMeta } from "../../lib/utils/pageMeta";
import {
  basename,
  dirNoteName,
  dirNotePath,
  displayNotePath,
  entryPathFromNote,
} from "../../lib/utils/path";
import type { EditorPageContext } from "./editorPageContext";
import {
  deletedMeta,
  deletedNoteContents,
  moveTarget,
  pathTaken,
  renameTarget,
  renamedMeta,
  renamedNoteContents,
} from "./editorPageUtils";

type EntryCore = {
  flushNoteSave: () => Promise<void>;
  setEditorText: (text: string, nextPath: string | null) => void;
};

export function createEntryActions(
  context: EditorPageContext,
  core: EntryCore,
  refreshSpace: () => Promise<void>,
  spacePath: (relativePath: string) => string,
) {
  const service = new EntryActions(context, core, refreshSpace, spacePath);
  return {
    deleteSpaceEntry: service.deleteSpaceEntry.bind(service),
    moveSpaceEntry: service.moveSpaceEntry.bind(service),
    orderSiblings: service.applySiblingOrder.bind(service),
    renameSpaceEntry: service.renameSpaceEntry.bind(service),
  };
}

class EntryActions {
  constructor(
    private context: EditorPageContext,
    private core: EntryCore,
    private refreshSpace: () => Promise<void>,
    private spacePath: (relativePath: string) => string,
  ) {}

  async renameSpaceEntry(relativePath: string, name: string) {
    // A folder's <name>.dir.md is the folder: rename the folder instead.
    const target = entryPathFromNote(relativePath);
    await this.applyMove(
      target,
      renameTarget(this.context.spaceNotes, target, name),
    );
  }

  /**
   * Moves an entry into `destFolder` ("" = space root), keeping its name.
   * `siblingOrder` are the destination's sibling paths in their wanted order.
   */
  async moveSpaceEntry(
    relativePath: string,
    destFolder: string,
    siblingOrder: string[] = [],
  ) {
    const target = moveTarget(relativePath, destFolder);

    if (target && pathTaken(this.context.spaceNotes, target)) {
      this.context.statusMessage = this.context.t("app.moveConflict", {
        name: displayNotePath(target),
      });
      return;
    }

    if (target) {
      const folder = !this.context.spaceNotes.includes(relativePath);
      await this.applyMove(relativePath, { folder, path: target });
    }

    await this.applySiblingOrder(siblingOrder);
  }

  /** Pins siblings to their listed positions so name sorting stops applying. */
  async applySiblingOrder(paths: string[]) {
    if (paths.length < 2) {
      return;
    }

    const meta = { ...this.context.spaceMeta };

    paths.forEach((path, index) => {
      meta[path] = cleanPageMeta({ ...meta[path], order: index });
    });

    this.context.spaceMeta = meta;
    await saveSpaceMeta(this.context.spaceRoot!, meta);
  }

  private async applyMove(
    relativePath: string,
    next: ReturnType<typeof renameTarget>,
  ) {
    await this.core.flushNoteSave();
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
    const isFolder = !this.context.spaceNotes.includes(relativePath);
    await deletePath(this.spacePath(relativePath));
    if (this.activeTabDeleted(relativePath, isFolder)) {
      this.context.activeTab = null;
      this.context.activeDatabaseId = null;
    }
    if (
      this.context.path === this.spacePath(relativePath) ||
      (isFolder &&
        this.context.path?.startsWith(`${this.spacePath(relativePath)}/`))
    ) {
      this.core.setEditorText("", null);
    }
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
    this.updateActiveTabPath(from, next);
    const fromDirNote = this.spacePath(dirNotePath(from));

    if (next.folder && this.context.path === fromDirNote) {
      this.context.path = this.spacePath(dirNotePath(next.path));
    } else if (this.context.path === fromPath) {
      this.context.path = this.spacePath(next.path);
    } else if (next.folder && this.context.path?.startsWith(`${fromPath}/`)) {
      this.context.path = this.context.path.replace(
        fromPath,
        this.spacePath(next.path),
      );
    }
  }

  private updateActiveTabPath(
    from: string,
    next: ReturnType<typeof renameTarget>,
  ) {
    const active = this.context.activeTab;

    if (!active || active.startsWith("db:")) {
      return;
    }

    if (next.folder && active === dirNotePath(from)) {
      this.context.activeTab = dirNotePath(next.path);
    } else if (active === from) {
      this.context.activeTab = next.path;
    } else if (next.folder && active.startsWith(`${from}/`)) {
      this.context.activeTab = `${next.path}/${active.slice(from.length + 1)}`;
    }
  }

  private activeTabDeleted(relativePath: string, folder: boolean) {
    const active = this.context.activeTab;

    return Boolean(
      active &&
        !active.startsWith("db:") &&
        (active === relativePath ||
          (folder && active.startsWith(`${relativePath}/`))),
    );
  }

  private pruneRoot(relativePath: string) {
    const parent = relativePath.includes("/")
      ? relativePath.slice(0, relativePath.lastIndexOf("/"))
      : "";
    return parent ? this.spacePath(parent) : this.context.spaceRoot!;
  }
}

async function renameDirectoryNote(
  context: EditorPageContext,
  from: string,
  next: ReturnType<typeof renameTarget>,
  spacePath: (relativePath: string) => string,
) {
  if (!next.folder || basename(from) === basename(next.path)) {
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
