import { listen } from "@tauri-apps/api/event";

/** Replays a right click the webview saw inside an iframe (see `frame_menu.rs`) on the iframe itself. */
export function forwardFrameContextMenus() {
  return listen<{ x: number; y: number }>(
    "frame-context-menu",
    ({ payload }) => {
      document.elementFromPoint(payload.x, payload.y)?.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: payload.x,
          clientY: payload.y,
          button: 2,
        }),
      );
    },
  );
}
