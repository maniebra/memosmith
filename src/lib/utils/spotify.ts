import { attribute } from "./markdownInline";

const KINDS = ["track", "album", "playlist", "episode", "show", "artist"];

/** Kind and id of a Spotify link (`open.spotify.com/...` or `spotify:kind:id`), or null. */
export function spotifyItem(source: string) {
  const text = source.trim();
  const uri = /^spotify:(\w+):([A-Za-z0-9]{22})$/.exec(text);
  let parts: string[];
  if (uri) {
    parts = [uri[1], uri[2]];
  } else {
    let url: URL;
    try {
      url = new URL(text);
    } catch {
      return null;
    }
    if (url.hostname !== "open.spotify.com") {
      return null;
    }
    // Drops locale (`/intl-de/`) and embed prefixes.
    parts = url.pathname
      .split("/")
      .filter((part) => part && part !== "embed" && !part.startsWith("intl-"));
  }
  const [kind, id] = parts;
  if (!KINDS.includes(kind) || !/^[A-Za-z0-9]{22}$/.test(id ?? "")) {
    return null;
  }
  return { kind, id };
}

/** What a pasted link becomes: a media line, so it aligns and resizes like one. */
export function spotifyMarkdown(source: string) {
  return spotifyItem(source) ? `![Spotify](${source.trim()})` : null;
}

/** The embedded player, or a card linking out when offline. */
export function spotifyMedia(
  source: string,
  alt: string,
  size: string,
  online: boolean,
) {
  const item = spotifyItem(source);
  if (!item) {
    return null;
  }
  const title = attribute(alt || "Spotify");
  const link = attribute(`https://open.spotify.com/${item.kind}/${item.id}`);
  if (!online) {
    return `<span class="md-media md-spotify md-spotify-offline"${size}><span class="md-spotify-note">${title} · offline</span><a class="md-spotify-link" data-external-url="${link}">Open in Spotify</a></span>`;
  }
  const compact = item.kind === "track" || item.kind === "episode";
  return `<iframe class="md-media md-spotify${compact ? "" : " md-spotify-tall"}" src="https://open.spotify.com/embed/${item.kind}/${item.id}" title="${title}"${size} allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
}
