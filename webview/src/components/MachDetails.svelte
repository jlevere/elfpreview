<script lang="ts">
  import { VirtualList } from "svelte-virtuallists";
  import { convertToBase16 } from "../utils";
  import type { Types } from "@bininspect";

  export let mach: Types.MachDetails;
  const { segments, dylibs } = mach;
  let selectedTab = "Segments";
  function switchTab(tab: string) {
    selectedTab = tab;
  }
</script>

<div>
  <div class="tab">
    <button
      class:active={selectedTab === "Segments"}
      on:click={() => switchTab("Segments")}>Segments</button
    >
    <button
      class:active={selectedTab === "Dylibs"}
      on:click={() => switchTab("Dylibs")}>Dylibs</button
    >
  </div>

  {#if selectedTab === "Segments"}
    <div class="tabcontent active">
      <h3>Segments</h3>
      <div class="virtual-table-container">
        <div class="table-header">
          <div class="name-col">Name</div>
          <div class="addr-col">VM Addr</div>
          <div class="size-col">VM Size</div>
          <div class="addr-col">File Off</div>
          <div class="size-col">File Size</div>
          <div class="type-col">Prot</div>
        </div>
        <VirtualList items={segments} class="vlist">
          {#snippet vl_slot({ item }: { item: Types.MachSegmentInfo })}
            <div class="table-row">
              <div class="name-col">{item.name}</div>
              <div class="addr-col">0x{convertToBase16(item.vmaddr, "")}</div>
              <div class="size-col">{item.vmsize}</div>
              <div class="addr-col">0x{convertToBase16(item.fileoff, "")}</div>
              <div class="size-col">{item.filesize}</div>
              <div class="type-col">{item.prot}</div>
            </div>
          {/snippet}
        </VirtualList>
      </div>
    </div>
  {/if}

  {#if selectedTab === "Dylibs"}
    <div class="tabcontent active">
      <h3>Linked Dylibs</h3>
      <div class="virtual-table-container">
        <div class="table-header">
          <div class="name-col">Name</div>
          <div class="type-col">Version</div>
        </div>
        <VirtualList items={dylibs} class="vlist">
          {#snippet vl_slot({ item }: { item: Types.MachDylibInfo })}
            <div class="table-row">
              <div class="name-col">{item.name}</div>
              <div class="type-col">{item.currentVersion}</div>
            </div>
          {/snippet}
        </VirtualList>
      </div>
    </div>
  {/if}
</div>
