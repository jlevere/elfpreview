<script lang="ts">
  import { onMount } from "svelte";
  import type { HostMessage, PreviewState } from "../../ts/src/protocol";
  import { vscode } from "./vscode";
  import Details from "./components/Details.svelte";
  let preview = $state.raw<PreviewState>({
    status: "loading",
    filename: "ELF file",
  });
  let clipboard = $state("");
  onMount(() => {
    const receive = (event: MessageEvent<HostMessage>) => {
      if (event.data.type === "state") {
        preview = event.data.state;
        clipboard = "";
      } else if (event.data.type === "copied") clipboard = "Row copied";
    };
    window.addEventListener("message", receive);
    vscode.postMessage({ type: "ready" });
    return () => window.removeEventListener("message", receive);
  });
</script>

<main>
  <header class="file-heading">
    <h1>
      {preview.filename}
      {#if preview.status === "ready"}
        {#if preview.data.info.stripped === true}<span
            class="badge"
            title="No static symbol table">Stripped</span
          >
        {:else if preview.data.info.stripped === false}<span class="badge"
            >Static Symbols</span
          >{/if}
      {/if}
    </h1>
  </header>
  {#if preview.status === "loading"}<p role="status">Loading ELF…</p>
  {:else if preview.status === "error"}<div role="alert">
      <h2>Unable to preview ELF</h2>
      <pre>{preview.message}</pre>
    </div>
  {:else}<Details data={preview.data} />{/if}
  {#if clipboard}<p class="clipboard-status" role="status">{clipboard}</p>{/if}
</main>
