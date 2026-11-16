<script lang="ts" generics="Row extends object">
  import { untrack } from "svelte";
  import { VirtualList } from "svelte-virtuallists";
  import { sortRows, type Column } from "../table-sort";
  import type { Sort } from "../ui-state";
  import { vscode } from "../vscode";
  const {
    rows,
    columns,
    label,
    layout,
    minWidth = 850,
    offset,
    onScroll,
    sort,
    onSort,
  }: {
    rows: Row[];
    columns: Array<Column<Row>>;
    label: string;
    layout: string;
    minWidth?: number;
    offset: number;
    onScroll: (offset: number) => void;
    sort: Sort | undefined;
    onSort: (sort: Sort | undefined) => void;
  } = $props();
  let startingOffset = $state(untrack(() => offset));
  const ordered = $derived(sortRows(rows, columns, sort));
  let selected = $state.raw<Row | undefined>();
  function toggleSort(column: string) {
    selected = undefined;
    startingOffset = 0;
    onSort(
      sort?.column !== column
        ? { column, direction: "ascending" }
        : sort.direction === "ascending"
          ? { column, direction: "descending" }
          : undefined,
    );
  }
  function copyRow() {
    if (selected === undefined) return;
    const row = selected;
    vscode.postMessage({
      type: "copy",
      text: columns
        .map((column) => `${column.label}\t${column.value(row)}`)
        .join("\n"),
    });
  }
</script>

{#if rows.length === 0}
  <p class="empty-state">No {label.toLowerCase()} to display.</p>
{:else}
  <div class="table-scroll">
    <div
      class="data-table"
      role="table"
      aria-label={label}
      aria-rowcount={rows.length + 1}
      style:min-width={minWidth + "px"}
      style:--columns="{layout} 64px"
    >
      <div class="table-row table-header" role="row">
        {#each columns as column (column.label)}
          <div
            role="columnheader"
            aria-sort={sort?.column === column.label ? sort.direction : "none"}
          >
            <button
              class="column-sort"
              onclick={() => toggleSort(column.label)}
            >
              {column.label}<span aria-hidden="true"
                >{sort?.column === column.label
                  ? sort.direction === "ascending"
                    ? "↑"
                    : "↓"
                  : ""}</span
              >
            </button>
          </div>
        {/each}
        <div role="columnheader"><span class="sr-only">Inspect</span></div>
      </div>
      {#key sort}
        <VirtualList
          items={ordered}
          scrollToOffset={startingOffset}
          onAfterScroll={(event) => onScroll(Number(event.offset))}
          style="height: 100%; width: 100%; min-height: 0; flex: 1;"
        >
          {#snippet vl_slot({
            item,
            index,
          }: {
            item: Row;
            index: number | string;
          })}
            <div
              class="table-row"
              class:selected={selected === item}
              role="row"
              aria-rowindex={Number(index) + 2}
            >
              {#each columns as column (column.label)}
                {@const text = column.value(item)}
                <div role="cell" title={text}>{text}</div>
              {/each}
              <div role="cell">
                <button
                  class="row-action"
                  aria-label="Inspect row {Number(index) + 1}"
                  onclick={() => (selected = item)}>Inspect</button
                >
              </div>
            </div>
          {/snippet}
        </VirtualList>
      {/key}
    </div>
  </div>
  {#if selected !== undefined}
    <section class="row-details" aria-label="Row details">
      <div class="details-toolbar">
        <h2>Row details</h2>
        <button class="secondary" onclick={copyRow}>Copy row</button><button
          class="secondary"
          onclick={() => (selected = undefined)}>Close details</button
        >
      </div>
      <dl>
        {#each columns as column (column.label)}<div>
            <dt>{column.label}</dt>
            <dd>{column.value(selected)}</dd>
          </div>{/each}
      </dl>
    </section>
  {/if}
{/if}
