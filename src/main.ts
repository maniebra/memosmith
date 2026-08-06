import "./app.css";
import { mount } from "svelte";
import App from "./App.svelte";

const target = document.querySelector("#app");

if (!target) {
  throw new Error("Missing app root");
}

const app = mount(App, { target });

export default app;
