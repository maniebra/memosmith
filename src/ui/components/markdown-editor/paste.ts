import { spotifyMarkdown } from "../../../lib/utils/spotify";
import { youtubeMarkdown } from "../../../lib/utils/youtube";
import type { Editor } from "./types";

/** Paste into the editor: files become assets, a link may become a player. */
export function handlePaste(e: Editor, event: ClipboardEvent) {
  const files = Array.from(event.clipboardData?.files ?? []);

  if (files.length) {
    event.preventDefault();
    void e.props.onAssets({ files }).then(e.insertAssets);
    return;
  }

  const text = event.clipboardData?.getData("text/plain");
  const subblockBody = e.subblockBodyForNode(event.target as Node | null);
  if (subblockBody && text !== undefined) {
    event.preventDefault();
    e.replaceSubblockSelection(subblockBody, text);
    return;
  }

  const offset = e.caretOffset();
  const table = e.tableSelection();

  if (table && text !== undefined) {
    event.preventDefault();
    e.replaceTableCellSelection(table.cell, text);
    return;
  }

  if (offset === null || !text) {
    return;
  }

  event.preventDefault();
  const video =
    (e.props.youtube ? youtubeMarkdown(text) : null) ??
    (e.props.spotify ? spotifyMarkdown(text) : null);

  if (video) {
    // The player needs a line of its own.
    const before = e.value.slice(0, offset);
    const lead = before === "" || before.endsWith("\n") ? "" : "\n";
    e.replace(offset, offset, `${lead}${video}\n`);
    return;
  }

  e.replace(offset, offset, text);
  }
