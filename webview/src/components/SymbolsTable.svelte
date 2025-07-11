<script lang="ts">
  import { VirtualList } from "svelte-virtuallists";
  import type { Types } from "@bininspect";
  import { convertToBase16 } from "../utils";

  export let symbols: Types.ElfSymbolInfo[] = [];

  let symbolFilter = "";
  $: filteredSymbols = symbols.filter((symbol) =>
    symbol.name.toLowerCase().includes(symbolFilter.toLowerCase()),
  );
</script>

<div class="filter-container">
  <input type="text" bind:value={symbolFilter} placeholder="Filter name..." />
  <span class="count-badge"
    >{filteredSymbols.length} of {symbols.length} symbols</span
  >
</div>

<div class="virtual-table-container">
  <div class="table-header">
    <div class="sym-value-col">Value</div>
    <div class="size-col">Size</div>
    <div class="sym-type-col">Type</div>
    <div class="bind-col">Bind</div>
    <div class="vis-col">Vis</div>
    <div class="name-col">Name</div>
  </div>
  <VirtualList items={filteredSymbols} class="vlist">
    {#snippet vl_slot({ item }: { item: Types.ElfSymbolInfo })}
      <div class="table-row">
        <div class="sym-value-col">0x{convertToBase16(item.value, "")}</div>
        <div class="size-col">{item.size}</div>
        <div class="sym-type-col">{item.kind}</div>
        <div class="bind-col">{item.bind}</div>
        <div class="vis-col">{item.vis}</div>
        <div class="name-col" role="tooltip" title={item.name}>{item.name}</div>
      </div>
    {/snippet}
  </VirtualList>
</div>
