<script lang="ts">
  import type { ElfInfo } from "../../../ts/src/protocol";
  import { vscode } from "../vscode";
  import { readUiState, tabs, type Tab } from "../ui-state";
  import FileSummary from "./FileSummary.svelte";
  import DynamicInfo from "./DynamicInfo.svelte";
  import DataTable from "./DataTable.svelte";
  import { sectionColumns, programColumns, symbolColumns } from "./table";
  const { data }: { data: ElfInfo } = $props();
  const saved = readUiState(vscode.getState());
  let selected = $state(saved.tab);
  let filter = $state(saved.filter);
  const offsets = $state(saved.offsets);
  const labels: Record<Tab, string> = {
    sections: "Sections",
    programs: "Program Headers",
    symbols: "Symbols",
    dynamic: "Dynamic Info",
  };
  const query = $derived(filter.toLowerCase());
  const names = $derived(
    data.symbols.map((symbol) => symbol.name.toLowerCase()),
  );
  const filtered = $derived(
    query
      ? data.symbols.filter((_, index) => names[index].includes(query))
      : data.symbols,
  );
  const sections = $derived(sectionColumns(data.info.class));
  const programs = $derived(programColumns(data.info.class));
  const symbols = $derived(symbolColumns(data.info.class));
  $effect(() => {
    vscode.setState({ tab: selected, filter, offsets: { ...offsets } });
  });

  function keydown(event: KeyboardEvent) {
    const index = tabs.indexOf(selected);
    let next: number;
    switch (event.key) {
      case "ArrowRight":
        next = (index + 1) % tabs.length;
        break;
      case "ArrowLeft":
        next = (index + tabs.length - 1) % tabs.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = tabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    selected = tabs[next];
    document.getElementById(`tab-${selected}`)?.focus();
  }
</script>

<FileSummary {data} />
<div class="tabs" role="tablist" aria-label="ELF details">
  {#each tabs as tab (tab)}
    <button
      role="tab"
      id="tab-{tab}"
      aria-controls="panel"
      aria-selected={selected === tab}
      tabindex={selected === tab ? 0 : -1}
      onclick={() => (selected = tab)}
      onkeydown={keydown}>{labels[tab]}</button
    >
  {/each}
</div>
<div id="panel" role="tabpanel" aria-labelledby="tab-{selected}" tabindex="0">
  {#if selected === "sections"}
    <h2>Section Headers</h2>
    <DataTable
      rows={data.sectionheaders}
      columns={sections}
      label="Sections"
      layout="minmax(220px, 2fr) 1fr 180px 100px"
      offset={offsets.sections}
      onScroll={(value: number) => (offsets.sections = value)}
    />
  {:else if selected === "programs"}
    <h2>Program Headers</h2>
    <DataTable
      rows={data.programheaders}
      columns={programs}
      label="Program headers"
      layout="1fr 70px 180px 180px 110px 110px"
      offset={offsets.programs}
      onScroll={(value: number) => (offsets.programs = value)}
    />
  {:else if selected === "symbols"}
    <h2>Static Symbol Table</h2>
    <div class="filter">
      <label for="symbol-filter">Filter symbols</label>
      <input
        id="symbol-filter"
        type="search"
        value={filter}
        oninput={(event) => {
          const next = event.currentTarget.value;
          if (next.toLowerCase() !== query) offsets.symbols = 0;
          filter = next;
        }}
      />
      <span role="status"
        >{filtered.length} of {data.symbols.length} symbols</span
      >
    </div>
    {#key query}
      <DataTable
        rows={filtered}
        columns={symbols}
        label="Symbols"
        layout="180px 80px 80px 80px 90px minmax(220px, 1fr)"
        offset={offsets.symbols}
        onScroll={(value: number) => (offsets.symbols = value)}
      />
    {/key}
  {:else}
    <DynamicInfo data={data.dynlink} />
  {/if}
</div>
