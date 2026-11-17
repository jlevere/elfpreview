<script lang="ts" generics="Row extends object">
  import { onDestroy, tick } from "svelte";
  import { VirtualList } from "svelte-virtuallists";
  import type { Column } from "../table-sort";
  const {
    rows,
    columns,
    selected,
    onInspect,
    offset,
    onScroll,
  }: {
    rows: Row[];
    columns: Array<Column<Row>>;
    selected: Row | undefined;
    onInspect: (row: Row | undefined) => void;
    offset: number;
    onScroll: (offset: number) => void;
  } = $props();
  const rowHeight = 28;
  let viewport: HTMLDivElement;
  let focused = $state(0);
  let range = $state({ start: 0, end: 0 });
  const tabStop = $derived(
    focused >= range.start && focused <= range.end ? focused : range.start,
  );
  let pendingFocus: MutationObserver | undefined;
  onDestroy(() => pendingFocus?.disconnect());

  function inspect(event: MouseEvent, row: Row, index: number) {
    pendingFocus?.disconnect();
    if (window.getSelection()?.isCollapsed === false) return;
    onInspect(row);
    void navigate(index, false);
  }
  export function focusRow(index: number): void {
    void navigate(index, false);
  }
  async function navigate(index: number, updateSelection = true) {
    focused = Math.max(0, Math.min(rows.length - 1, index));
    const targetIndex = focused;
    if (updateSelection && selected !== undefined) onInspect(rows[targetIndex]);
    await tick();
    if (!viewport?.isConnected) return;
    pendingFocus?.disconnect();
    const focus = () => {
      const row = viewport.querySelector(`[data-row-index="${targetIndex}"]`);
      if (!(row instanceof HTMLElement)) return false;
      row.focus({ preventScroll: true });
      pendingFocus?.disconnect();
      return true;
    };
    // Virtual rows may not exist yet. Focus follows the render notification,
    // rather than waiting a guessed interval or polling for an element.
    if (!focus()) {
      pendingFocus = new MutationObserver(focus);
      pendingFocus.observe(viewport, { childList: true, subtree: true });
    }
    const list = viewport.querySelector(".vtlist");
    if (list instanceof HTMLElement) {
      const top = targetIndex * rowHeight;
      if (top < list.scrollTop) list.scrollTop = top;
      else if (top + rowHeight > list.scrollTop + list.clientHeight)
        list.scrollTop = top + rowHeight - list.clientHeight;
    }
  }
  // VS Code forwards bubbling keys to workbench commands even when default is prevented.
  // Keep keys consumed by this table inside the table.
  function keydown(event: KeyboardEvent, row: Row, index: number) {
    const list = viewport.querySelector(".vtlist");
    const page = Math.max(
      1,
      Math.floor((list?.clientHeight ?? rowHeight) / rowHeight),
    );
    let next: number;
    switch (event.key) {
      case "Enter":
      case " ":
        event.preventDefault();
        event.stopPropagation();
        onInspect(row);
        void navigate(index, false);
        return;
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        onInspect(undefined);
        return;
      case "ArrowDown":
        next = index + 1;
        break;
      case "ArrowUp":
        next = index - 1;
        break;
      case "PageDown":
        next = index + page;
        break;
      case "PageUp":
        next = index - page;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = rows.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    void navigate(next);
  }
</script>

<div
  class="row-viewport"
  role="rowgroup"
  bind:this={viewport}
  style:--row-height={rowHeight + "px"}
>
  <VirtualList
    items={rows}
    scrollToOffset={offset}
    onVisibleRangeUpdate={(value) => (range = value)}
    onAfterScroll={(event) => onScroll(Number(event.offset))}
    style="height: 100%; width: 100%; min-height: 0; flex: 1;"
  >
    {#snippet vl_slot({ item, index }: { item: Row; index: number | string })}
      <div
        class="table-row"
        class:selected={selected === item}
        role="row"
        aria-selected={selected === item}
        aria-rowindex={Number(index) + 2}
        aria-label="Inspect row {Number(index) + 1}"
        data-row-index={index}
        tabindex={Number(index) === tabStop ? 0 : -1}
        onfocus={() => (focused = Number(index))}
        onclick={(event) => inspect(event, item, Number(index))}
        onkeydown={(event) => keydown(event, item, Number(index))}
      >
        {#each columns as column (column.label)}
          {@const text = (column.display ?? column.value)(item)}
          <div role="cell" title={text}>{text}</div>
        {/each}
      </div>
    {/snippet}
  </VirtualList>
</div>
