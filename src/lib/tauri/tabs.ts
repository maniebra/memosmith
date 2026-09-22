import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { detachedTabUrl } from "../utils/detachedTab";

const windowLabel = () => `tab-${crypto.randomUUID()}`;

/** Opens a new MemoSmith window, seeded with exactly one tab. */
export function openDetachedTab(tab: string) {
  const window = new WebviewWindow(windowLabel(), {
    url: detachedTabUrl(tab),
    title: "MemoSmith",
    width: 1100,
    height: 760,
    minWidth: 560,
    minHeight: 420,
    center: true,
    decorations: false,
    dragDropEnabled: false,
  });

  return new Promise<void>((resolve, reject) => {
    void window.once("tauri://created", () => resolve());
    void window.once("tauri://error", (event) => reject(event.payload));
  });
}
