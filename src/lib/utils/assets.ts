import { basename } from "./path";

export type AssetFolder = "images" | "videos" | "audio" | "misc";

const MIME_FOLDERS: Record<string, AssetFolder> = {
  image: "images",
  video: "videos",
  audio: "audio",
};

const EXTENSION_FOLDERS: Record<string, AssetFolder> = {
  png: "images",
  jpg: "images",
  jpeg: "images",
  gif: "images",
  webp: "images",
  avif: "images",
  bmp: "images",
  svg: "images",
  mp4: "videos",
  webm: "videos",
  mov: "videos",
  mkv: "videos",
  avi: "videos",
  mp3: "audio",
  wav: "audio",
  ogg: "audio",
  flac: "audio",
  m4a: "audio",
  opus: "audio",
};

export function extension(name: string) {
  const dot = name.lastIndexOf(".");

  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

export function assetFolder(name: string, mime = ""): AssetFolder {
  return (
    MIME_FOLDERS[mime.split("/")[0]] ??
    EXTENSION_FOLDERS[extension(name)] ??
    "misc"
  );
}

/** Embed media so the editor can preview it; anything else stays a plain link. */
export function assetMarkdown(relativePath: string) {
  const name = basename(relativePath);
  const bang = assetFolder(name) === "misc" ? "" : "!";

  return `${bang}[${name}](${encodeURI(relativePath)})`;
}
