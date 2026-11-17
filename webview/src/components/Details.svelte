<script lang="ts">
  import type { ColumnSettings } from "../column-state";
  import type { ElfInfo, SymbolInfo } from "../../../ts/src/protocol";
  import { vscode } from "../vscode";
  import { readUiState, tabs, type Tab, type Sort } from "../ui-state";
  import FileSummary from "./FileSummary.svelte";
  import DynamicInfo from "./DynamicInfo.svelte";
  import DataTable from "./DataTable.svelte";
  import {
    sectionColumns,
    programColumns,
    symbolColumns,
    relocationColumns,
  } from "./table";
  const { data }: { data: ElfInfo } = $props();
  const saved = readUiState(vscode.getState());
  let selected = $state(saved.tab);
  let staticFilter = $state(saved.filter);
  let dynamicFilter = $state(saved.dynamicFilter);
  let relocationFilter = $state(saved.relocationFilter);
  const filter = $derived(
    selected === "dynamicSymbols" ? dynamicFilter : staticFilter,
  );
  const symbolRows = $derived(
    selected === "dynamicSymbols" ? data.dynamicSymbols : data.symbols,
  );
  const offsets = $state(saved.offsets);
  const sorts = $state(saved.sorts);
  const columnSettings = $state(saved.columns);
  let demangle = $state(saved.demangle);
  function changeSort(tab: Tab, sort: Sort | undefined) {
    offsets[tab] = 0;
    sorts[tab] = sort;
  }
  const labels: Record<Tab, string> = {
    sections: "Sections",
    programs: "Program Headers",
    symbols: "Symbols",
    dynamicSymbols: "Dynamic Symbols",
    relocations: "Relocations",
    dynamic: "Dynamic Info",
  };
  const query = $derived(filter.toLowerCase());
  const names = $derived(
    symbolRows.map((symbol) =>
      `${symbol.name} ${symbol.demangledName ?? ""}`.toLowerCase(),
    ),
  );
  const filtered = $derived(
    query
      ? symbolRows.filter((_, index) => names[index].includes(query))
      : symbolRows,
  );
  const sections = $derived(sectionColumns(data.info.class));
  const programs = $derived(programColumns(data.info.class));
  const symbols = $derived(
    symbolColumns(data.info.class, data.sectionheaders, demangle),
  );
  const relocations = $derived(
    relocationColumns(data.info.class, data.info.filetype),
  );
  const relocationNames = $derived(
    data.relocations.map((row) =>
      `${row.table} ${row.typeName} ${row.typeId} ${row.symbolName ?? ""}`.toLowerCase(),
    ),
  );
  const relocationQuery = $derived(relocationFilter.toLowerCase());
  const filteredRelocations = $derived(
    relocationQuery
      ? data.relocations.filter((_, index) =>
          relocationNames[index].includes(relocationQuery),
        )
      : data.relocations,
  );
  $effect(() => {
    vscode.setState({
      tab: selected,
      filter: staticFilter,
      dynamicFilter,
      relocationFilter,
      offsets: { ...offsets },
      sorts: { ...sorts },
      columns: { ...columnSettings },
      demangle,
    });
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
  {#key selected}
    {#if selected === "sections"}
      <h2 class="sr-only">Section Headers</h2>
      <DataTable
        rows={data.sectionheaders}
        columns={sections}
        label="Sections"
        offset={offsets.sections}
        settings={columnSettings.sections}
        onSettings={(settings: ColumnSettings) =>
          (columnSettings.sections = settings)}
        sort={sorts.sections}
        onSort={(sort: Sort | undefined) => changeSort("sections", sort)}
        onScroll={(value: number) => (offsets.sections = value)}
      />
    {:else if selected === "programs"}
      <h2 class="sr-only">Program Headers</h2>
      <DataTable
        rows={data.programheaders}
        columns={programs}
        label="Program headers"
        offset={offsets.programs}
        settings={columnSettings.programs}
        onSettings={(settings: ColumnSettings) =>
          (columnSettings.programs = settings)}
        sort={sorts.programs}
        onSort={(sort: Sort | undefined) => changeSort("programs", sort)}
        onScroll={(value: number) => (offsets.programs = value)}
      />
    {:else if selected === "symbols" || selected === "dynamicSymbols"}
      <h2 class="sr-only">
        {selected === "symbols" ? "Static" : "Dynamic"} Symbol Table
      </h2>
      <div class="filter">
        <label for="symbol-filter"
          >{selected === "symbols"
            ? "Filter symbols"
            : "Filter dynamic symbols"}</label
        >
        <input
          id="symbol-filter"
          type="search"
          placeholder="Original or demangled name"
          title="Search original and demangled names"
          value={filter}
          oninput={(event) => {
            const next = event.currentTarget.value;
            if (next.toLowerCase() !== query) offsets[selected] = 0;
            if (selected === "dynamicSymbols") dynamicFilter = next;
            else staticFilter = next;
          }}
        />
        <label
          class="demangle-toggle"
          title="Show Rust and Itanium C++ names when available; original names remain in row details"
          ><input type="checkbox" bind:checked={demangle} />Demangle names</label
        >
        <span role="status"
          >{filtered.length} of {symbolRows.length} symbols</span
        >
      </div>
      {#key query}
        <DataTable
          rows={filtered}
          columns={symbols}
          label={labels[selected]}
          offset={offsets[selected]}
          settings={columnSettings[selected]}
          onSettings={(settings: ColumnSettings) =>
            (columnSettings[selected] = settings)}
          extraDetails={[
            {
              label: "Demangled name",
              value: (row: SymbolInfo) => row.demangledName ?? "—",
            },
          ]}
          sort={sorts[selected]}
          onSort={(sort: Sort | undefined) => changeSort(selected, sort)}
          onScroll={(value: number) => (offsets[selected] = value)}
        />
      {/key}
    {:else if selected === "relocations"}
      <div class="filter">
        <label for="relocation-filter">Filter relocations</label><input
          id="relocation-filter"
          type="search"
          value={relocationFilter}
          oninput={(event) => {
            const next = event.currentTarget.value;
            if (next.toLowerCase() !== relocationQuery) offsets.relocations = 0;
            relocationFilter = next;
          }}
        /><span role="status"
          >{filteredRelocations.length} of {data.relocations.length} relocations</span
        >
      </div>
      <p class="table-note">
        {data.info.filetype === "REL"
          ? "Offsets are relative to the target section."
          : "Addresses are recorded virtual addresses, before loading."} REL addends
        are implicit in the target bytes.
      </p>
      {#key relocationQuery}
        <DataTable
          rows={filteredRelocations}
          columns={relocations}
          label="Relocations"
          offset={offsets.relocations}
          settings={columnSettings.relocations}
          onSettings={(settings: ColumnSettings) =>
            (columnSettings.relocations = settings)}
          sort={sorts.relocations}
          onSort={(sort: Sort | undefined) => changeSort("relocations", sort)}
          onScroll={(value: number) => (offsets.relocations = value)}
        />
      {/key}
    {:else}
      <DynamicInfo data={data.dynlink} />
    {/if}
  {/key}
</div>
