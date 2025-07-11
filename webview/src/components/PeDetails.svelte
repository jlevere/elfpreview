<script lang="ts">
  import { VirtualList } from "svelte-virtuallists";
  import { convertToBase16 } from "../utils";
  import type { Types } from "@bininspect";

  export let pe: Types.PeDetails;

  const { sections, imports, exports: peExports } = pe;
  let selectedTab = "Sections";
  function switchTab(tab: string) {
    selectedTab = tab;
  }
</script>

<div>
  <div class="tab">
    <button
      class:active={selectedTab === "Sections"}
      on:click={() => switchTab("Sections")}>Sections</button
    >
    <button
      class:active={selectedTab === "Imports"}
      on:click={() => switchTab("Imports")}>Imports</button
    >
    <button
      class:active={selectedTab === "Exports"}
      on:click={() => switchTab("Exports")}>Exports</button
    >
  </div>

  {#if selectedTab === "Sections"}
    <div class="tabcontent active">
      <h3>PE Sections</h3>
      <div class="virtual-table-container">
        <div class="table-header">
          <div class="name-col">Name</div>
          <div class="addr-col">Virt Addr</div>
          <div class="size-col">Virt Size</div>
          <div class="size-col">Raw Size</div>
          <div class="addr-col">Raw Ptr</div>
          <div class="type-col">Characteristics</div>
        </div>
        <VirtualList items={sections} class="vlist">
          {#snippet vl_slot({ item }: { item: Types.PeSectionInfo })}
            <div class="table-row">
              <div class="name-col">{item.name}</div>
              <div class="addr-col">
                0x{convertToBase16(item.virtualAddress, "")}
              </div>
              <div class="size-col">{item.virtualSize}</div>
              <div class="size-col">{item.sizeOfRawData}</div>
              <div class="addr-col">
                0x{convertToBase16(item.pointerToRawData, "")}
              </div>
              <div class="type-col">{item.characteristics}</div>
            </div>
          {/snippet}
        </VirtualList>
      </div>
    </div>
  {/if}

  {#if selectedTab === "Imports"}
    <div class="tabcontent active">
      <h3>Imported DLLs</h3>
      <div class="virtual-table-container">
        <div class="table-header">
          <div class="name-col">DLL</div>
          <div class="size-col">Functions</div>
        </div>
        <VirtualList items={imports} class="vlist">
          {#snippet vl_slot({ item }: { item: Types.PeImportInfo })}
            <div class="table-row">
              <div class="name-col">{item.dllName}</div>
              <div class="size-col">{item.functions.length}</div>
            </div>
          {/snippet}
        </VirtualList>
      </div>
    </div>
  {/if}

  {#if selectedTab === "Exports"}
    <div class="tabcontent active">
      <h3>Exported Symbols</h3>
      <div class="virtual-table-container">
        <div class="table-header">
          <div class="name-col">Name</div>
          <div class="size-col">Ordinal</div>
          <div class="addr-col">RVA</div>
        </div>
        <VirtualList items={peExports} class="vlist">
          {#snippet vl_slot({ item }: { item: Types.PeExportInfo })}
            <div class="table-row">
              <div class="name-col">{item.name}</div>
              <div class="size-col">{item.ordinal}</div>
              <div class="addr-col">0x{convertToBase16(item.rva, "")}</div>
            </div>
          {/snippet}
        </VirtualList>
      </div>
    </div>
  {/if}
</div>
