const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};
import { assetFolder, assetMarkdown } from "./assets";

assert(assetFolder("shot.PNG") === "images", "extension match ignores case");
assert(assetFolder("clip.mp4") === "videos", "video extension");
assert(assetFolder("song.flac") === "audio", "audio extension");
assert(
  assetFolder("report.pdf") === "misc",
  "unknown extension falls back to misc",
);
assert(
  assetFolder("image", "image/png") === "images",
  "mime wins when the name has no extension",
);

assert(
  assetMarkdown("assets/images/a b.png") ===
    "![a b.png](assets/images/a%20b.png)",
  "media embeds, spaces escaped",
);
assert(
  assetMarkdown("assets/misc/report.pdf") ===
    "[report.pdf](assets/misc/report.pdf)",
  "misc stays a link",
);
