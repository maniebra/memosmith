import { invoke } from "@tauri-apps/api/core";
import { setYoutubeDecodable, setYoutubePort } from "../utils/youtube";

/** Starts the player wrapper server; players render once the port is known. */
export async function startYoutubeWrapper() {
  setYoutubeDecodable(await invoke<boolean>("youtube_decodable"));
  setYoutubePort(await invoke<number>("youtube_port"));
}
