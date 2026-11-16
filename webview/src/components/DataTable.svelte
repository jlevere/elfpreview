<script lang="ts" generics="Row">
  import { untrack } from "svelte";
  import { VirtualList } from "svelte-virtuallists";
  import type { Column } from "./table";
  const {
    rows,
    columns,
    label,
    layout,
    offset,
    onScroll,
  }: {
    rows: Row[];
    columns: Array<Column<Row>>;
    label: string;
    layout: string;
    offset: number;
    onScroll: (offset: number) => void;
  } = $props();
  const initialOffset = untrack(() => offset);
</script>

{#if rows.length === 0}
  <p>No {label.toLowerCase()} to display.</p>
{:else}
  <div class="table-scroll">
    <div
      class="data-table"
      role="table"
      aria-label={label}
      aria-rowcount={rows.length + 1}
      style:--columns={layout}
    >
      <div class="table-row table-header" role="row">
        {#each columns as column (column.label)}<div role="columnheader">
            {column.label}
          </div>{/each}
      </div>
      <VirtualList
        items={rows}
        scrollToOffset={initialOffset}
        onAfterScroll={(event) => onScroll(Number(event.offset))}
        style="height: 350px; width: 100%;"
      >
        {#snippet vl_slot({
          item,
          index,
        }: {
          item: Row;
          index: number | string;
        })}
          <div class="table-row" role="row" aria-rowindex={Number(index) + 2}>
            {#each columns as column (column.label)}
              {@const text = column.value(item)}
              <div role="cell" title={text}>{text}</div>
            {/each}
          </div>
        {/snippet}
      </VirtualList>
    </div>
  </div>
{/if}
