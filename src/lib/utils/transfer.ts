/**
 * WebKitGTK leaves `files` empty for clipboard images and file-manager drags;
 * the same files still come through `items`, or as `file://` URIs.
 */
export function transferredAssets(
  data: Pick<DataTransfer, "files" | "items" | "getData">,
) {
  const files = Array.from(data.files ?? []);

  if (!files.length) {
    for (const item of Array.from(data.items ?? [])) {
      const file = item.kind === "file" ? item.getAsFile() : null;
      if (file) {
        files.push(file);
      }
    }
  }

  const paths = files.length
    ? []
    : data
        .getData("text/uri-list")
        .split(/\r?\n/)
        .filter((line) => line.startsWith("file://"))
        .map((line) => decodeURIComponent(new URL(line).pathname));

  return { files, paths };
}

/** WebKitGTK may hand a file over with no type, so the extension decides. */
export function isImage(name: string, type = "") {
  return (
    type.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|svg|bmp|avif|ico|tiff?)$/i.test(name)
  );
}
