import { assetFolder } from "./assets";
import { attribute } from "./markdownInline";

export const MEDIA_LINE = /^(\s*)!\[([^\]\n]*)\]\(([^)\n]+)\)\s*$/;

export type MediaOptions = {
  width?: number;
  align?: "left" | "center" | "right";
};

export function isMediaLine(line: string) {
  return MEDIA_LINE.test(line);
}

/** Pipe options in the alt text: `![alt|center|400](src)`. */
export function mediaOptions(line: string): MediaOptions {
  const parts = MEDIA_LINE.exec(line)?.[2].split("|").slice(1) ?? [];
  const width = parts.find((part) => /^\d+$/.test(part));
  const align = parts.find((part) => /^(left|center|right)$/.test(part));

  return {
    width: width ? Number(width) : undefined,
    align: align as MediaOptions["align"],
  };
}

export function withMediaOptions(line: string, options: MediaOptions) {
  const media = MEDIA_LINE.exec(line);

  if (!media) {
    return line;
  }

  const [, indent, alt, source] = media;
  const { width, align } = { ...mediaOptions(line), ...options };
  const parts = [alt.split("|")[0], align, width].filter(Boolean);

  return `${indent}![${parts.join("|")}](${source})`;
}

export function mediaPreview(
  line: string,
  alt: string,
  source: string,
  resolveAsset: (source: string) => string,
) {
  const url = attribute(resolveAsset(source));
  const folder = assetFolder(source);
  const { width, align } = mediaOptions(line);
  const size = width ? ` style="width:${width}px"` : "";
  const media =
    folder === "videos"
      ? `<video class="md-media" src="${url}"${size} controls></video>`
      : folder === "audio"
        ? `<audio class="md-media" src="${url}" controls></audio>`
        : `<img class="md-media" src="${url}" alt="${attribute(alt.split("|")[0])}"${size}>`;

  // The handle is a drag target only; the editor rewrites the source line on release.
  const handle =
    folder === "audio"
      ? ""
      : `<span class="md-resize" aria-hidden="true"></span>`;

  return `<div class="md-preview md-media-preview" style="justify-content:${
    align === "center"
      ? "center"
      : align === "right"
        ? "flex-end"
        : "flex-start"
  }" contenteditable="false"><span class="md-media-wrap">${media}${handle}</span></div>`;
}
