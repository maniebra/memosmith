import { AlignCenter, AlignLeft, AlignRight, Link } from "@lucide/svelte";
import { MEDIA_LINE } from "../../../lib/utils/markdownMedia";
import { spotifyItem } from "../../../lib/utils/spotify";
import { youtubeVideo } from "../../../lib/utils/youtube";
import type { ContextMenuItem } from "../ContextMenu.svelte";
import type { Editor } from "./types";

/** Menu of a right-clicked media preview: alignment, plus a player's link. */
export function mediaMenuItems(e: Editor, preview: HTMLElement) {
  const range = e.lineRangeFor(preview);
  const line = range ? e.value.slice(range.start, range.end) : "";
  const source = MEDIA_LINE.exec(line)?.[3]?.trim() ?? "";
  const link = spotifyItem(source) || youtubeVideo(source) ? source : null;
  const items: ContextMenuItem[] = [];

  if (e.props.editable && range) {
    const aligns = [
      ["left", "editor.alignLeft", AlignLeft],
      ["center", "editor.alignCenter", AlignCenter],
      ["right", "editor.alignRight", AlignRight],
    ] as const;

    for (const [align, label, icon] of aligns) {
      items.push({
        label: e.t(label),
        icon,
        onSelect: () => e.setMediaOption(range, { align }),
      });
    }
  }

  if (link) {
    if (items.length) {
      items.push({ separator: true });
    }

    items.push({
      label: e.t("editor.copyLink"),
      icon: Link,
      onSelect: () => navigator.clipboard.writeText(link),
    });
  }

  return items;
}
