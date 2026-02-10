<script lang="ts">
  import { onMount } from "svelte";
  import type { Types } from "../../ts/src/elfpreview";
  import type { ColumnDef } from "@tanstack/svelte-table";
  import DataTable from "./DataTable.svelte";

  const {
    initialData,
  }: {
    initialData: {
      filename?: string;
      fileinfo?: Types.Fileinfo;
    };
  } = $props();

  // Destructure types for easier usage
  type Sectioninfo = Types.Sectioninfo;
  type Programinfo = Types.Programinfo;
  type Symbolinfo = Types.Symbolinfo;
  type Fileinfo = Types.Fileinfo;
  type Dynlinkinfo = Types.Dynlinkinfo;

  // hydrated props
  const filename = initialData.filename || "Unknown ELF File";
  const fileInfo = $state<Fileinfo | null>(initialData?.fileinfo || null);

  // Rest of component state
  let sectionHeaders = $state<Sectioninfo[]>([]);
  let programHeaders = $state<Programinfo[]>([]);
  let symbols = $state<Symbolinfo[]>([]);
  let dynInfo = $state<Dynlinkinfo>();
  let sectionsLoaded = $state(false);
  let programsLoaded = $state(false);
  let symbolsLoaded = $state(false);
  let stripped = $state("");
  let dynamic = $state(false);

  // Message types for staged loading
  type MessageType =
    | "strip-info"
    | "dyn-info"
    | "section-info"
    | "program-info"
    | "symbol-info"
    | "request-elf-info";

  type Payload = {
    type: MessageType;
    data?: Sectioninfo[] | Programinfo[] | Symbolinfo[] | Dynlinkinfo | string;
    error?: string;
  };

  // Handle incoming messages with staged loading
  function handleMessage(event: MessageEvent<Payload>) {
    const { type, data } = event.data;

    switch (type) {
      case "strip-info":
        stripped = (data as string) || "";
        break;

      case "dyn-info":
        dynInfo = (data as Dynlinkinfo) || null;
        dynamic = dynInfo?.isDynamic ?? false;
        console.log("dynInfo:", dynInfo);
        break;

      case "section-info":
        sectionHeaders = (data as Sectioninfo[]) || [];
        sectionsLoaded = true;
        break;

      case "program-info":
        programHeaders = (data as Programinfo[]) || [];
        programsLoaded = true;
        break;

      case "symbol-info":
        symbols = (data as Symbolinfo[]) || [];
        symbolsLoaded = true;
        break;
    }
  }

  onMount(() => {
    // Setup message listener
    window.addEventListener("message", handleMessage);

    // Cleanup listener on unmount
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  });

  let selectedTab = $state("Sections");

  // Tab switching
  function switchTab(tab: string) {
    selectedTab = tab;
  }

  // we assume numeric values have been converted to base 10
  // by the extention.  It takes bigint, but this is just type
  // weirdness, its actually a string.
  function convertToBase16(
    value: bigint | string,
    className: string = "UNKNOWN_CLASS",
  ): string {
    const hexString = BigInt(value).toString(16);

    if (className === "UNKNOWN_CLASS") {
      return hexString;
    }
    return hexString.padStart(8, "0");
  }

  // Column definitions for section headers table
  const sectionColumns: Array<ColumnDef<Sectioninfo, any>> = [
    {
      accessorKey: "name",
      header: "Name",
    },
    {
      accessorKey: "typename",
      header: "Type",
    },
    {
      accessorKey: "address",
      header: "Address",
      cell: (info) =>
        `0x${convertToBase16(info.getValue() as bigint, fileInfo?.class)}`,
      enableColumnFilter: false,
    },
    {
      accessorKey: "size",
      header: "Size",
      enableColumnFilter: false,
    },
  ];

  // Column definitions for program headers table
  const programColumns: Array<ColumnDef<Programinfo, any>> = [
    {
      accessorKey: "typename",
      header: "Type",
    },
    {
      accessorKey: "flagstring",
      header: "Flags",
    },
    {
      accessorKey: "vaddr",
      header: "Virtual Address",
      cell: (info) =>
        `0x${convertToBase16(info.getValue() as bigint, fileInfo?.class)}`,
      enableColumnFilter: false,
    },
    {
      accessorKey: "paddr",
      header: "Physical Address",
      cell: (info) =>
        `0x${convertToBase16(info.getValue() as bigint, fileInfo?.class)}`,
      enableColumnFilter: false,
    },
    {
      accessorKey: "filesz",
      header: "File Size",
      enableColumnFilter: false,
    },
    {
      accessorKey: "memsz",
      header: "Mem Size",
      enableColumnFilter: false,
    },
  ];

  // Column definitions for symbols table
  const symbolColumns: Array<ColumnDef<Symbolinfo, any>> = [
    {
      accessorKey: "value",
      header: "Value",
      cell: (info) =>
        `0x${convertToBase16(info.getValue() as bigint, fileInfo?.class)}`,
      enableColumnFilter: false,
    },
    {
      accessorKey: "size",
      header: "Size",
      enableColumnFilter: false,
    },
    {
      accessorKey: "typestr",
      header: "Type",
    },
    {
      accessorKey: "bind",
      header: "Bind",
    },
    {
      accessorKey: "vis",
      header: "Vis",
    },
    {
      accessorKey: "name",
      header: "Name",
    },
  ];
</script>

<div class="container">
  <h1>
    {filename}
    {#if stripped == "true"}
      <span class="badge" title="Debug symbols have been removed">Stripped</span
      >
    {:else if stripped == "false"}
      <span class="badge debug-symbols">Debug Symbols</span>
    {/if}
  </h1>

  <div class="basic-info">
    <h2>File Information</h2>
    <div class="file-info-grid">
      <div class="file-metadata">
        <table>
          <thead>
            <tr><th>File Type:</th><td>{fileInfo?.filetype}</td></tr>
            <tr><th>Machine Architecture:</th><td>{fileInfo?.machine}</td></tr>
            <tr><th>Class:</th><td>{fileInfo?.class}</td></tr>
            <tr><th>Endianness:</th><td>{fileInfo?.endianness}</td></tr>
            <tr><th>OS ABI:</th><td>{fileInfo?.osabi}</td></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="file-metadata">
        <table>
          <thead>
            <tr>
              <th>Entry Point:</th>
              <td>
                0x{fileInfo?.entrypoint
                  ? convertToBase16(fileInfo.entrypoint, fileInfo?.class)
                  : "N/A"}
              </td>
            </tr>
            <tr><th>ELF Version:</th><td>{fileInfo?.version}</td></tr>
            <tr><th>Symbols:</th><td>{symbols.length}</td></tr>
            <tr><th>Sections:</th><td>{sectionHeaders.length}</td></tr>
            {#if dynamic}
              <tr><th>Interpreter:</th><td>{dynInfo?.interpreter}</td></tr>
            {/if}
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="tab">
    <button
      class:active={selectedTab === "Sections"}
      onclick={() => switchTab("Sections")}>Sections</button
    >
    <button
      class:active={selectedTab === "Programs"}
      onclick={() => switchTab("Programs")}>Program Headers</button
    >
    <button
      class:active={selectedTab === "Symbols"}
      onclick={() => switchTab("Symbols")}>Symbols</button
    >
    {#if dynamic}
      <button
        class:active={selectedTab === "Dynamic"}
        onclick={() => switchTab("Dynamic")}>Dynamic Info</button
      >
    {/if}
  </div>

  {#if selectedTab === "Sections"}
    <div class="tabcontent active">
      <h3>Section Headers</h3>
      {#if !sectionsLoaded}
        <p>Loading Sections...</p>
      {:else}
        <DataTable data={sectionHeaders} columns={sectionColumns} />
      {/if}
    </div>
  {/if}

  {#if selectedTab === "Programs"}
    <div class="tabcontent active">
      <h3>Program Headers</h3>
      {#if !programsLoaded}
        <p>Loading Program Headers...</p>
      {:else}
        <DataTable data={programHeaders} columns={programColumns} />
      {/if}
    </div>
  {/if}

  {#if selectedTab === "Symbols"}
    <div class="tabcontent active">
      <h3>Symbols</h3>
      {#if !symbolsLoaded}
        <p>Loading Symbols...</p>
      {:else}
        <DataTable data={symbols} columns={symbolColumns} />
      {/if}
    </div>
  {/if}

  {#if selectedTab === "Dynamic" && dynamic}
    <div class="tabcontent active">
      <h3>Dynamic Linking Information</h3>
      {#if dynInfo?.isDynamic}
        <div class="virtual-table-container">
          <div class="table-header">
            <div class="name-col">Property</div>
            <div class="value-col">Value</div>
          </div>

          {#if dynInfo.soname}
            <div class="table-row">
              <div class="name-col">SONAME</div>
              <div class="value-col">{dynInfo.soname}</div>
            </div>
          {/if}

          <div class="table-row">
            <div class="value-col">
              {#if dynInfo.neededLibs?.length}
                {#each dynInfo.neededLibs as lib, i (lib)}
                  <div class="table-row">
                    {#if i === 0}
                      <div class="name-col">DT_NEEDED</div>
                    {:else}
                      <div class="name-col"></div>
                    {/if}
                    <div
                      class="value-col"
                      role="tooltip"
                      title="Resolved at load time, so no path"
                    >
                      {lib}
                    </div>
                  </div>
                {/each}
              {:else}
                <div class="table-row">
                  <div class="name-col">DT_NEEDED</div>
                  <div class="value-col">None</div>
                </div>
              {/if}
            </div>
          </div>

          <div class="table-row">
            <div class="name-col">RPATH</div>
            <div class="value-col">
              {#if dynInfo.rpath?.length}
                <ul>
                  {#each dynInfo.rpath as path (path)}
                    <li role="tooltip" title={path}>{path}</li>
                  {/each}
                </ul>
              {:else}
                None
              {/if}
            </div>
          </div>

          <div class="table-row">
            <div class="name-col">RUNPATH</div>
            <div class="value-col">
              {#if dynInfo.runpath?.length}
                <ul>
                  {#each dynInfo.runpath as path (path)}
                    <li role="tooltip" title={path}>{path}</li>
                  {/each}
                </ul>
              {:else}
                None
              {/if}
            </div>
          </div>
        </div>
      {:else}
        <p>This binary is statically linked.</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  :global(body) {
    font-family: var(--vscode-editor-font-family);
    padding: 0;
    margin: 0;
    color: var(--vscode-editor-foreground);
    background-color: var(--vscode-editor-background);
  }

  .container {
    padding: 20px;
  }

  h1,
  h2,
  h3 {
    color: var(--vscode-editor-foreground);
    border-bottom: 1px solid var(--vscode-panel-border);
    padding-bottom: 5px;
  }

  table {
    border-collapse: collapse;
    width: 100%;
    margin-bottom: 20px;
  }

  th,
  td {
    border: 1px solid var(--vscode-panel-border);
    padding: 8px;
    text-align: left;
  }

  th {
    background-color: var(--vscode-panel-background);
  }

  tr:nth-child(even) {
    background-color: var(--vscode-list-inactiveSelectionBackground);
  }

  .tab {
    overflow: hidden;
    border: 1px solid var(--vscode-panel-border);
    background-color: var(--vscode-panel-background);
  }

  .tab button {
    background-color: inherit;
    color: var(--vscode-editor-foreground);
    float: left;
    border: none;
    outline: none;
    cursor: pointer;
    padding: 10px 16px;
    transition: 0.3s;
  }

  .tab button.active {
    background-color: var(--vscode-list-activeSelectionBackground);
    color: var(--vscode-list-activeSelectionForeground);
  }

  .tabcontent {
    display: none;
    padding: 6px 12px;
    border: 1px solid var(--vscode-panel-border);
    border-top: none;
  }

  .tabcontent.active {
    display: block;
  }

  .file-info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }

  .file-metadata {
    margin-bottom: 20px;
  }

  .badge {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 4px;
    margin-left: 10px;
    font-size: 12px;
    background-color: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
  }

  .debug-symbols {
    color: black;
    background-color: var(--vscode-debugIcon-startForeground);
  }

  /* Dynamic Info section layout (not using DataTable) */
  .virtual-table-container {
    width: 100%;
    border: 1px solid var(--vscode-panel-border, #333333);
    border-radius: 4px;
    overflow: hidden;
  }

  .table-header,
  .table-row {
    display: flex;
    width: 100%;
    box-sizing: border-box;
  }

  .table-header {
    background-color: var(--vscode-editor-lineHighlightBackground, #2a2d2e);
    font-weight: 500;
    border-bottom: 1px solid var(--vscode-panel-border, #333333);
  }

  .table-header > div,
  .table-row > div {
    padding: 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .table-row {
    border-bottom: 1px solid var(--vscode-panel-border, #333333);
  }

  .table-row:hover {
    background-color: var(--vscode-list-hoverBackground, #2a2d2e);
  }

  .name-col {
    flex: 1;
    min-width: 120px;
  }

  .value-col {
    flex: 2;
    min-width: 200px;
  }

  @media (max-width: 768px) {
    .file-info-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
