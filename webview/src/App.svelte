<script lang="ts">
  import { onMount } from "svelte";
  import type { Types } from "@bininspect";
  import ElfDetails from "./components/ElfDetails.svelte";
  import PeDetails from "./components/PeDetails.svelte";
  import MachDetails from "./components/MachDetails.svelte";
  import { convertToBase16 } from "./utils";

  const {
    initialData,
  }: { initialData: { filename?: string; basicInfo?: Types.BasicInfo } } =
    $props();

  const filename = initialData.filename || "Unknown Binary";
  let basicInfo = $state<Types.BasicInfo | null>(initialData.basicInfo || null);
  let details = $state<Types.Details | null>(null);
  let parseComplete = $state(false);
  let magicBytes = $state<string | null>(null);
  let errorMsg = $state<string | null>(null);

  type MessageType =
    | "basic-info"
    | "details"
    | "magic-bytes"
    | "parse-complete"
    | "error";
  type Payload = { type: MessageType; data?: unknown; error?: string };

  function handleMessage(event: MessageEvent<Payload>) {
    const { type, data } = event.data;
    switch (type) {
      case "basic-info":
        basicInfo = data as Types.BasicInfo;
        break;
      case "details":
        details = data as Types.Details;
        break;
      case "parse-complete":
        parseComplete = true;
        break;
      case "magic-bytes":
        magicBytes = data as string;
        break;
      case "error":
        errorMsg = event.data.error ?? "Unknown error";
        break;
    }
  }

  onMount(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
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
            <tr><th>Format:</th><td>{basicInfo?.format}</td></tr>
            <tr><th>Arch:</th><td>{basicInfo?.arch}</td></tr>
            <tr><th>Bitness:</th><td>{basicInfo?.bitness}</td></tr>
            <tr><th>Endianness:</th><td>{basicInfo?.endianness}</td></tr>
            <tr><th>Type:</th><td>{basicInfo?.fileType}</td></tr>
            {#if basicInfo?.entryPoint != null}
              <tr
                ><th>Entry Point:</th><td
                  >0x{convertToBase16(basicInfo.entryPoint, "")}</td
                ></tr
              >
            {/if}
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
