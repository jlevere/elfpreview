<script lang="ts" generics="Row extends object">
  import { untrack } from "svelte";
  import TableRows from "./TableRows.svelte";
  import { sortRows, type Column } from "../table-sort";
  import type { ColumnSettings } from "../column-state";
  import ColumnHeader from "./ColumnHeader.svelte";
  import ColumnPicker from "./ColumnPicker.svelte";
  import type { Sort } from "../ui-state";
  import { vscode } from "../vscode";
  const {
    rows,
    columns,
    label,
    offset,
    onScroll,
    sort,
    onSort,
    settings,
    onSettings,
    extraDetails = [],
  }: {
    rows: Row[];
    columns: Array<Column<Row>>;
    label: string;
    offset: number;
    onScroll: (offset: number) => void;
    sort: Sort | undefined;
    onSort: (sort: Sort | undefined) => void;
    settings: ColumnSettings | undefined;
    onSettings: (settings: ColumnSettings) => void;
    extraDetails?: Array<Column<Row>>;
  } = $props();
  let startingOffset = $state(untrack(() => offset));
  const ordered = $derived(sortRows(rows, columns, sort));
  const defaults = $derived(
    columns.filter((column) => column.hidden).map((column) => column.label),
  );
  const hidden = $derived(settings?.hidden ?? defaults);
  const detailColumns = $derived([
    ...columns.slice(0, 1),
    ...extraDetails,
    ...columns.slice(1),
  ]);
  const visible = $derived.by(() => {
    const result = columns.filter((column) => !hidden.includes(column.label));
    return result.length ? result : columns.slice(0, 1);
  });
  const widths = $derived(
    visible.map(
      (column) => settings?.widths[column.label] ?? column.width ?? 120,
    ),
  );
  const tableWidth = $derived(widths.reduce((sum, width) => sum + width, 0));
  const tracks = $derived(
    visible
      .map((column, index) =>
        column.grow && settings?.widths[column.label] === undefined
          ? `minmax(${widths[index]}px, 1fr)`
          : `${widths[index]}px`,
      )
      .join(" "),
  );
  let selected = $state.raw<Row | undefined>();
  let rowsView = $state.raw<{ focusRow(index: number): void }>();
  function closeDetails() {
    if (selected === undefined) return;
    const index = ordered.indexOf(selected);
    selected = undefined;
    if (index >= 0) rowsView?.focusRow(index);
  }
  function setWidth(column: string, width: number) {
    onSettings({
      hidden,
      widths: { ...settings?.widths, [column]: width },
    });
  }
  function setVisible(column: string, shown: boolean) {
    if (!shown && visible.length === 1) return;
    if (!shown && sort?.column === column) toggleSort(undefined);
    onSettings({
      widths: settings?.widths ?? {},
      hidden: shown
        ? hidden.filter((name) => name !== column)
        : [...hidden, column],
    });
  }
  function toggleSort(column: string | undefined) {
    startingOffset = 0;
    onSort(
      column === undefined
        ? undefined
        : sort?.column !== column
          ? { column, direction: "ascending" }
          : sort.direction === "ascending"
            ? { column, direction: "descending" }
            : undefined,
    );
  }
  function copyValue(column: Column<Row>) {
    if (selected !== undefined)
      vscode.postMessage({ type: "copy", text: column.value(selected) });
  }
  function copyRow() {
    if (selected === undefined) return;
    const row = selected;
    vscode.postMessage({
      type: "copy",
      text: detailColumns
        .map(
          (column) =>
            `${column.detailLabel ?? column.label}\t${column.value(row)}`,
        )
        .join("\n"),
    });
  }
</script>

<div class="table-toolbar">
  {#if sort}<span class="sort-description"
      >Sorted by {sort.column}, {sort.direction}</span
    >{/if}
  <ColumnPicker
    columns={columns.map((column) => column.label)}
    shown={visible.map((column) => column.label)}
    onChange={setVisible}
    onReset={() => onSettings({ widths: {}, hidden: defaults })}
  />
</div>
{#if rows.length === 0}
  <p class="empty-state">No {label.toLowerCase()} to display.</p>
{:else}
  <div class="table-scroll">
    <div
      class="data-table"
      role="table"
      aria-label={label}
      aria-rowcount={rows.length + 1}
      style:min-width={tableWidth + "px"}
      style:--columns={tracks}
    >
      <div class="table-row table-header" role="row">
        {#each visible as column, index (column.label)}
          <ColumnHeader
            label={column.label}
            width={widths[index]}
            defaultWidth={column.width ?? 120}
            direction={sort?.column === column.label
              ? sort.direction
              : undefined}
            onSort={() => toggleSort(column.label)}
            onResize={(width: number) => setWidth(column.label, width)}
          />
        {/each}
      </div>
      {#key sort}
        <TableRows
          bind:this={rowsView}
          rows={ordered}
          columns={visible}
          {selected}
          onInspect={(row: Row | undefined) => (selected = row)}
          offset={startingOffset}
          {onScroll}
        />
      {/key}
    </div>
  </div>
  {#if selected !== undefined}
    <section class="row-details" aria-label="Row details">
      <div class="details-toolbar">
        <h2>Row details</h2>
        <button class="secondary" onclick={copyRow}>Copy row</button><button
          class="secondary"
          onclick={closeDetails}>Close details</button
        >
      </div>
      <dl>
        {#each detailColumns as column (column.label)}<div>
            <dt>{column.detailLabel ?? column.label}</dt>
            <dd>{column.value(selected)}</dd>
            <button
              class="field-copy"
              aria-label="Copy {column.detailLabel ?? column.label}"
              onclick={() => copyValue(column)}>Copy</button
            >
          </div>{/each}
      </dl>
    </section>
  {/if}
{/if}
