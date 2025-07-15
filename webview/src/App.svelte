<script lang="ts">
  import { onMount } from "svelte";
  import type { Types } from "@bininspect";
  import ElfDetails from "./components/elf/ElfDetails.svelte";
  import PeDetails from "./components/pe/PeDetails.svelte";
  import MachDetails from "./components/mach/MachDetails.svelte";

  import { trpc } from "./trpcClient";
  import type { PanelContext } from "../../ts/src/trpc";

  const { initialData }: { initialData: { filename?: string } } = $props();

  const filename = initialData.filename || "Unknown Binary";
  let fileKind = $state<string | null>(null);
  let details = $state<Types.Details | null>(null);
  let parseComplete = $state(false);
  let magicBytes = $state<string | null>(null);
  let errorMsg = $state<string | null>(null);

  function updateState(state: PanelContext["state"]) {
    fileKind = state.fileKind?.tag ?? null;
    details = state.details ?? null;
    parseComplete = state.parseComplete ?? false;
    magicBytes = state.magicBytes ?? null;
    errorMsg = state.error ?? null;
  }

  onMount(() => {
    void trpc.getInitialState
      .query()
      .then(updateState)
      .catch((e: unknown) => {
        errorMsg = (e as Error).message;
      });

    const sub = trpc.onStateChange.subscribe(undefined, {
      onData: updateState,
      onError: (e) => (errorMsg = (e as Error).message),
    });

    return () => sub.unsubscribe();
  });
</script>

<div class="container">
  <h1>{filename}</h1>

  <div class="basic-info">
    <h2>File Information</h2>
    <div class="file-info-grid">
      <div class="file-metadata">
        <table>
          <thead>
            <tr><th>Format:</th><td>{fileKind}</td></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
      {#if details?.tag === "elf"}
        <div class="file-metadata">
          <table>
            <thead>
              <tr><th>Sections:</th><td>{details.value.sections.length}</td></tr
              >
              <tr><th>Symbols:</th><td>{details.value.symbols.length}</td></tr>
            </thead><tbody></tbody>
          </table>
        </div>
      {/if}
    </div>
  </div>

  {#if errorMsg}
    <div class="error-banner">
      <strong>Error:</strong>
      {errorMsg}
    </div>
  {/if}

  {#if !parseComplete && !details && !errorMsg}
    <p>Parsing binary…</p>
  {/if}

  {#if details}
    {#if details.tag === "elf"}
      <ElfDetails elf={details.value} />
    {:else if details.tag === "pe"}
      <PeDetails pe={details.value} />
    {:else if details.tag === "mach"}
      <MachDetails mach={details.value} />
    {:else}
      <p>Unsupported format.</p>
      {#if magicBytes}
        <pre>{magicBytes}</pre>
      {/if}
    {/if}
  {:else if magicBytes}
    <pre>{magicBytes}</pre>
  {/if}
</div>
