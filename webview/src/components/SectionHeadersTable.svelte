<script lang="ts">
  import { VirtualList } from "svelte-virtuallists";
  import type { Types } from "@bininspect";
  import { convertToBase16 } from "../utils";

  export let sections: Types.ElfSectionInfo[] = [];
</script>

<div class="virtual-table-container">
  <div class="table-header">
    <div class="name-col">Name</div>
    <div class="type-col">Type</div>
    <div class="addr-col">Address</div>
    <div class="size-col">Size</div>
  </div>
  <VirtualList items={sections} class="vlist">
    {#snippet vl_slot({ item }: { item: Types.ElfSectionInfo })}
      <div class="table-row">
        <div class="name-col">{item.name}</div>
        <div class="type-col">{item.kind}</div>
        <div class="addr-col">0x{convertToBase16(item.address, "")}</div>
        <div class="size-col">{item.size}</div>
      </div>
    {/snippet}
  </VirtualList>
</div>
