import { savePageMeta } from "../../lib/tauri/files";
import {
  cleanPageMeta,
  hasPageMeta,
  type PageIcon,
  type PageMeta,
} from "../../lib/utils/pageMeta";
import type { EditorPageContext } from "./editorPageContext";

export function createMetaActions(context: EditorPageContext) {
  async function updateActiveMeta(nextMeta: PageMeta) {
    if (!context.spaceRoot || !context.activeEntryPath) {
      return;
    }
    const cleaned = cleanPageMeta(nextMeta);
    await savePageMeta(context.spaceRoot, context.activeEntryPath, cleaned);
    if (hasPageMeta(cleaned)) {
      context.spaceMeta = {
        ...context.spaceMeta,
        [context.activeEntryPath]: cleaned,
      };
    } else {
      const { [context.activeEntryPath]: _removed, ...rest } =
        context.spaceMeta;
      context.spaceMeta = rest;
    }
  }

  function updateActiveIcon(icon: PageIcon | null) {
    return updateActiveMeta({ ...context.activePageMeta, icon });
  }

  function updateActiveCover(cover: string | null) {
    return updateActiveMeta({ ...context.activePageMeta, cover });
  }

  return { updateActiveCover, updateActiveIcon };
}
