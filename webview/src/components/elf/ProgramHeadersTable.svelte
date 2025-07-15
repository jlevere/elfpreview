<script lang="ts">
  import { VirtualList } from "svelte-virtuallists";
  import type { Types } from "@bininspect";
  import { convertToBase16 } from "../../utils";

  export let programHeaders: Types.ElfProgramHeader[] = [];
</script>

<div class="virtual-table-container">
  <div class="table-header">
    <div class="type-col">Type</div>
    <div class="flags-col">Flags</div>
    <div class="vaddr-col">Virtual Address</div>
    <div class="paddr-col">Physical Address</div>
    <div class="filesz-col">File Size</div>
    <div class="memsz-col">Mem Size</div>
  </div>
  <VirtualList items={programHeaders} class="vlist">
    {#snippet vl_slot({ item }: { item: Types.ElfProgramHeader })}
      <div class="table-row">
        <div class="type-col">{item.kind}</div>
        <div class="flags-col">{item.flagString}</div>
        <div class="vaddr-col">0x{convertToBase16(item.vaddr, "")}</div>
        <div class="paddr-col">0x{convertToBase16(item.paddr, "")}</div>
        <div class="filesz-col">{item.fileSize}</div>
        <div class="memsz-col">{item.memSize}</div>
      </div>
    {/snippet}
  </VirtualList>
</div>
