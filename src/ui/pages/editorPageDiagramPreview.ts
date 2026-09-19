import type { DiagramPreview } from "../../lib/utils/diagramPreview";
import type { EditorPageContext } from "./editorPageContext";

export function createDiagramPreviewTabs(
  state: Pick<
    EditorPageContext,
    "activeDatabaseId" | "activeTab" | "diagramPreviews"
  >,
  flushNoteSave: () => Promise<void>,
) {
  let count = 0;

  return {
    async open(preview: DiagramPreview) {
      await flushNoteSave();
      const id = `preview:${Date.now()}-${count++}`;

      state.diagramPreviews = { ...state.diagramPreviews, [id]: preview };
      state.activeTab = id;
      state.activeDatabaseId = null;
    },
    async select(id: string) {
      if (!state.diagramPreviews[id]) {
        return;
      }

      await flushNoteSave();
      state.activeTab = id;
      state.activeDatabaseId = null;
    },
    close(id: string) {
      const { [id]: _closed, ...remaining } = state.diagramPreviews;

      state.diagramPreviews = remaining;
    },
  };
}
