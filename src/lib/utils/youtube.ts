import { attribute } from "./markdownInline";

/** Port of the loopback server that frames the player (see `youtube.rs`). */
let wrapperPort = 0;

export function setYoutubePort(port: number) {
  wrapperPort = port;
}

/** Whether the webview can decode what YouTube streams (see `youtube.rs`). */
let decodable = true;

export function setYoutubeDecodable(value: boolean) {
  decodable = value;
}

/** Video id and start second of a YouTube link, or null for anything else. */
export function youtubeVideo(source: string) {
  let url: URL;
  try {
    url = new URL(source.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  const path = url.pathname.split("/").filter(Boolean);
  const id =
    host === "youtu.be"
      ? path[0]
      : host === "youtube.com" || host === "youtube-nocookie.com"
        ? path[0] === "watch"
          ? url.searchParams.get("v")
          : ["embed", "shorts", "live", "v"].includes(path[0] ?? "")
            ? path[1]
            : null
        : null;
  if (!id || !/^[\w-]{11}$/.test(id)) {
    return null;
  }
  const time = url.searchParams.get("t") ?? url.searchParams.get("start") ?? "";
  const [, h = "0", m = "0", s = "0"] =
    /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(time) ?? [];
  const start = Number(h) * 3600 + Number(m) * 60 + Number(s);
  return { id, start };
}

/** What a pasted link becomes: a media line, so it aligns and resizes like one. */
export function youtubeMarkdown(source: string) {
  return youtubeVideo(source) ? `![YouTube](${source.trim()})` : null;
}

/**
 * The player, or a card linking out when the machine is offline, since the
 * player cannot load anything then.
 */
export function youtubeMedia(
  source: string,
  alt: string,
  size: string,
  online: boolean,
) {
  const video = youtubeVideo(source);
  if (!video) {
    return null;
  }
  const title = attribute(alt || "YouTube video");
  if (!online || !decodable) {
    const note = online
      ? "Can't play here: no H.264/VP9/AV1 decoder. Install gst-libav (and gst-plugins-bad), then restart."
      : `${title} · offline`;
    const thumb = online
      ? ` style="background-image:url(https://i.ytimg.com/vi/${video.id}/hqdefault.jpg)"`
      : "";
    return `<span class="md-media md-youtube md-youtube-offline"${size}><span class="md-youtube-thumb"${thumb}></span><a class="md-youtube-play" data-external-url="${attribute(
      source.trim(),
    )}" title="Open on YouTube"></a><span class="md-youtube-note">${note}</span><a class="md-youtube-link" data-external-url="${attribute(
      source.trim(),
    )}">Open on YouTube</a></span>`;
  }
  const start = video.start ? `?start=${video.start}` : "";
  // Without the loopback wrapper YouTube sees no referrer and shows error 153.
  const host = wrapperPort
    ? `http://127.0.0.1:${wrapperPort}`
    : "https://www.youtube-nocookie.com";
  return `<iframe class="md-media md-youtube" src="${host}/embed/${video.id}${start}" title="${title}"${size} allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
}
