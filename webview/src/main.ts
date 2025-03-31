import { mount } from "svelte";
import App from "./App.svelte";
import type { Types } from "../../ts/src/elfpreview";

declare global {
  interface Window {
    __INITIAL_DATA__?: {
      filename?: string;
      fileinfo?: Types.Fileinfo;
    };
  }
}

const initialData = window.__INITIAL_DATA__!;

const app = mount(App, {
  target: document.getElementById("app")!,
  props: {
    initialData,
  },
});

export default app;
