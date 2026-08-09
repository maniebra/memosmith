import { renderDocument, type WikilinkEmbed } from "../../lib/utils/markdown";
import { displayNotePath } from "../../lib/utils/path";
import { resolveWikilinkTarget } from "../../lib/utils/wikilinks";
import type { EditorPageContext } from "./editorPageContext";

type AssetActions = {
  resolveAssetFromDir: (dir: string | null, source: string) => string;
};

export function createWikilinkActions(
  context: EditorPageContext,
  assets: AssetActions,
  spacePath: (relativePath: string) => string,
) {
  function resolveActiveWikilink(rawTarget: string) {
    return resolveWikilinkTarget(
      rawTarget,
      context.spaceNotes,
      context.activeRelativePath,
    );
  }

  function renderActiveWikilinkEmbed(
    rawTarget: string,
    depth: number,
  ): WikilinkEmbed | null {
    const resolved = resolveActiveWikilink(rawTarget);
    if (!resolved.exists || !resolved.path) {
      return { title: rawTarget, html: "", exists: false };
    }
    const embeddedPath = spacePath(resolved.path);
    const embeddedDir = embeddedPath.includes("/")
      ? embeddedPath.slice(0, embeddedPath.lastIndexOf("/"))
      : context.spaceRoot;
    return {
      title: displayNotePath(resolved.path),
      html: renderDocument(
        embeddedText(context, resolved.path),
        (source) => assets.resolveAssetFromDir(embeddedDir, source),
        renderOptions(context, resolved.path, depth, renderActiveWikilinkEmbed),
      ),
      exists: true,
    };
  }

  return { renderActiveWikilinkEmbed, resolveActiveWikilink };
}

function embeddedText(context: EditorPageContext, path: string) {
  return path === context.activeRelativePath
    ? context.contents
    : (context.noteContents[path] ?? "");
}

function renderOptions(
  context: EditorPageContext,
  path: string,
  depth: number,
  renderActiveWikilinkEmbed: (
    target: string,
    depth: number,
  ) => WikilinkEmbed | null,
) {
  const maxDepth = 2;
  return {
    fancyTableEditor: false,
    callouts: context.settings.features.callouts,
    calloutDefinitions: context.settings.callouts,
    drawings: context.settings.features.drawings,
    diagrams: context.settings.features.diagrams,
    plantuml: context.settings.features.plantuml,
    mermaid: context.settings.features.mermaid,
    staticDiagramPreviews: true,
    resolveWikilink: (target: string) =>
      resolveWikilinkTarget(target, context.spaceNotes, path),
    renderWikilinkEmbed:
      depth + 1 >= maxDepth ? undefined : renderActiveWikilinkEmbed,
    wikilinkEmbedDepth: depth + 1,
  };
}
