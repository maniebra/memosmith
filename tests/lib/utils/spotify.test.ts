const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};
import {
  spotifyItem,
  spotifyMarkdown,
  spotifyMedia,
} from "../../../src/lib/utils/spotify";
import { renderDocument } from "../../../src/lib/utils/markdown";

const id = "4cOdK2wGLETKBW3PvgPWqT";
for (const link of [
  `https://open.spotify.com/track/${id}`,
  `https://open.spotify.com/track/${id}?si=abc`,
  `https://open.spotify.com/intl-de/track/${id}`,
  `https://open.spotify.com/embed/track/${id}`,
  `spotify:track:${id}`,
]) {
  const item = spotifyItem(link);
  assert(item?.kind === "track" && item.id === id, `parses ${link}`);
}
assert(
  spotifyItem(`https://open.spotify.com/album/${id}`)?.kind === "album",
  "album",
);
assert(spotifyItem(`https://example.com/track/${id}`) === null, "other host");
assert(
  spotifyItem(`https://open.spotify.com/user/${id}`) === null,
  "unknown kind",
);
assert(spotifyItem("https://open.spotify.com/track/short") === null, "bad id");
assert(spotifyItem("hello") === null, "not a link");
assert(
  spotifyMarkdown(` https://open.spotify.com/track/${id} `) ===
    `![Spotify](https://open.spotify.com/track/${id})`,
  "paste becomes a media line",
);

const player = spotifyMedia(`spotify:track:${id}`, "", "", true)!;
assert(player.includes(`open.spotify.com/embed/track/${id}"`), "player src");
const offline = spotifyMedia(`spotify:track:${id}`, "", "", false)!;
assert(
  offline.includes("md-spotify-offline") && !offline.includes("<iframe"),
  "offline swaps the player for a card",
);

const line = `![Spotify|center|300](https://open.spotify.com/track/${id})`;
const html = renderDocument(line, (source) => source, { spotifyOnline: true });
assert(
  html.includes("<iframe") && html.includes("width:300px"),
  "renders player",
);
assert(
  !renderDocument(line, (source) => source, {}).includes("<iframe"),
  "disabled leaves the image path alone",
);
