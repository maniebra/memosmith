const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};
import {
  setYoutubeDecodable,
  youtubeMarkdown,
  youtubeMedia,
  youtubeVideo,
} from "../../../src/lib/utils/youtube";
import { renderDocument } from "../../../src/lib/utils/markdown";

const id = "dQw4w9WgXcQ";
for (const link of [
  `https://www.youtube.com/watch?v=${id}`,
  `https://youtu.be/${id}`,
  `https://m.youtube.com/shorts/${id}`,
  `https://www.youtube.com/embed/${id}`,
  `https://youtube.com/live/${id}?si=x`,
]) {
  assert(youtubeVideo(link)?.id === id, `parses ${link}`);
}
assert(youtubeVideo(`https://youtu.be/${id}?t=1m5s`)?.start === 65, "t=1m5s");
assert(youtubeVideo(`https://youtu.be/${id}?t=90`)?.start === 90, "t=90");
assert(
  youtubeVideo("https://example.com/watch?v=" + id) === null,
  "other host",
);
assert(youtubeVideo("https://youtube.com/watch?v=short") === null, "bad id");
assert(youtubeVideo("not a url") === null, "not a url");
assert(
  youtubeMarkdown(` https://youtu.be/${id} `) ===
    `![YouTube](https://youtu.be/${id})`,
  "paste becomes a media line",
);
assert(youtubeMarkdown("hello") === null, "plain text is left alone");

const player = youtubeMedia(`https://youtu.be/${id}?t=5`, "", "", true)!;
assert(player.includes(`/embed/${id}?start=5`), "player keeps the start");
const offline = youtubeMedia(`https://youtu.be/${id}`, "Talk", "", false)!;
assert(
  offline.includes("md-youtube-offline") && !offline.includes("<iframe"),
  "offline swaps the player for a card",
);

const line = `![YouTube|center|480](https://youtu.be/${id})`;
const html = renderDocument(line, (source) => source, { youtubeOnline: true });
assert(html.includes("<iframe"), "media lines render the player");
assert(html.includes("width:480px"), "width applies to the player");
assert(html.includes("justify-content:center"), "alignment applies");
assert(
  !renderDocument(line, (source) => source, {}).includes("<iframe"),
  "disabled leaves the image path alone",
);

setYoutubeDecodable(false);
const noCodecs = youtubeMedia(`https://youtu.be/${id}`, "", "", true)!;
assert(
  noCodecs.includes("gst-libav") &&
    noCodecs.includes("hqdefault") &&
    !noCodecs.includes("<iframe"),
  "missing decoders show a hint instead of a dead player",
);
