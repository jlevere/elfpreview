import { mount } from "svelte";
import Root from "./App.svelte";
import "./App.css";
import type { Types } from "@bininspect";

declare global {
  interface Window {
    __INITIAL_DATA__?: {
      filename?: string;
      basicInfo?: Types.BasicInfo;
    };
  }
}

const initialData = window.__INITIAL_DATA__!;

const app = mount(Root, {
  target: document.getElementById("app")!,
  props: {
    initialData,
  },
});

export default app;
