import "katex/dist/katex.min.css";
import "./app.css";
import { mount } from "svelte";
import App from "./App.svelte";
import { startYoutubeWrapper } from "./lib/tauri/youtube";

const target = document.querySelector("#app");

if (!target) {
  throw new Error("Missing app root");
}

// Players are rendered with the wrapper's port, so it is known before the first note.
await startYoutubeWrapper().catch(() => {});

const app = mount(App, { target });

export default app;
