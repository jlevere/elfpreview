<script lang="ts" generics="TData">
  import {
    createTable,
    type ColumnDef,
    type SortingState,
    type ColumnFiltersState,
    type CellContext,
    type HeaderContext,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
  } from "@tanstack/svelte-table";

  type Props = {
    data: TData[];
    columns: Array<ColumnDef<TData, any>>;
    height?: string;
  };

  const { data, columns, height = "350px" }: Props = $props();

  let sorting = $state<SortingState>([]);
  let columnFilters = $state<ColumnFiltersState>([]);
  let showFilters = $state(false);

  const table = createTable({
    get data() {
      return data;
    },
    get columns() {
      return columns;
    },
    state: {
      get sorting() {
        return sorting;
      },
      get columnFilters() {
        return columnFilters;
      },
    },
    onSortingChange: (updater) => {
      sorting = typeof updater === "function" ? updater(sorting) : updater;
    },
    onColumnFiltersChange: (updater) => {
      columnFilters =
        typeof updater === "function" ? updater(columnFilters) : updater;
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  function getSortIndicator(sorted: false | "asc" | "desc"): string {
    if (sorted === "asc") return " ▲";
    if (sorted === "desc") return " ▼";
    return "";
  }

  function renderHeader(header: HeaderContext<TData, unknown>): string {
    const def = header.column.columnDef.header;
    if (typeof def === "string") return def;
    if (typeof def === "function") return String(def(header) ?? "");
    return "";
  }

  function renderCell(cell: CellContext<TData, unknown>): string {
    const def = cell.column.columnDef.cell;
    if (typeof def === "function") return String(def(cell) ?? "");
    // Default: show the raw value
    const val = cell.getValue();
    return val != null ? `${val as string | number | bigint}` : "";
  }
</script>

<div class="datatable-wrapper">
  <div class="datatable-toolbar">
    <button
      class="filter-toggle"
      class:active={showFilters}
      onclick={() => (showFilters = !showFilters)}
      title="Toggle column filters"
    >
      ⛁ Filters
    </button>
    <span class="row-count">{table.getFilteredRowModel().rows.length} rows</span>
  </div>

  <div class="datatable-container" style="max-height: {height};">
    <table class="datatable">
      <thead>
        {#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
          <tr>
            {#each headerGroup.headers as header (header.id)}
              <th>
                {#if !header.isPlaceholder}
                  <button
                    class="sort-button"
                    class:sorted={header.column.getIsSorted() !== false}
                    onclick={header.column.getToggleSortingHandler()}
                  >
                    {renderHeader(header.getContext())}
                    <span class="sort-indicator"
                      >{getSortIndicator(
                        header.column.getIsSorted(),
                      )}</span
                    >
                  </button>
                {/if}
              </th>
            {/each}
          </tr>
          {#if showFilters}
            <tr class="filter-row">
              {#each headerGroup.headers as header (header.id)}
                <th>
                  {#if header.column.getCanFilter()}
                    <input
                      type="text"
                      class="column-filter"
                      placeholder="Filter..."
                      value={header.column.getFilterValue() ?? ""}
                      oninput={(e: Event) =>
                        header.column.setFilterValue(
                          (e.target as HTMLInputElement).value || undefined,
                        )}
                    />
                  {/if}
                </th>
              {/each}
            </tr>
          {/if}
        {/each}
      </thead>
      <tbody>
        {#each table.getRowModel().rows as row (row.id)}
          <tr>
            {#each row.getVisibleCells() as cell (cell.id)}
              <td title={String(cell.getValue() as string ?? "")}>
                {renderCell(cell.getContext())}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
  .datatable-wrapper {
    width: 100%;
    border: 1px solid var(--vscode-panel-border, #333);
    border-radius: 4px;
    overflow: hidden;
  }

  .datatable-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 8px;
    background-color: var(--vscode-editor-lineHighlightBackground, #2a2d2e);
    border-bottom: 1px solid var(--vscode-panel-border, #333);
  }

  .filter-toggle {
    background: none;
    border: 1px solid var(--vscode-panel-border, #555);
    color: var(--vscode-editor-foreground);
    padding: 3px 10px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
  }

  .filter-toggle:hover,
  .filter-toggle.active {
    background-color: var(--vscode-list-activeSelectionBackground);
    color: var(--vscode-list-activeSelectionForeground);
  }

  .row-count {
    font-size: 12px;
    opacity: 0.7;
  }

  .datatable-container {
    overflow: auto;
    width: 100%;
  }

  .datatable {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  .datatable thead {
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .datatable thead th {
    background-color: var(--vscode-editor-lineHighlightBackground, #2a2d2e);
    padding: 0;
    border-bottom: 1px solid var(--vscode-panel-border, #333);
    text-align: left;
  }

  .sort-button {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 8px;
    background: none;
    border: none;
    color: var(--vscode-editor-foreground);
    cursor: pointer;
    font-weight: 500;
    font-size: inherit;
    font-family: inherit;
    text-align: left;
    white-space: nowrap;
  }

  .sort-button:hover {
    background-color: var(--vscode-list-hoverBackground, #2a2d2e);
  }

  .sort-button.sorted {
    color: var(--vscode-list-activeSelectionForeground);
  }

  .sort-indicator {
    margin-left: 4px;
    font-size: 10px;
    opacity: 0.8;
  }

  .filter-row th {
    padding: 4px;
    background-color: var(--vscode-editor-lineHighlightBackground, #2a2d2e);
    border-bottom: 2px solid var(--vscode-panel-border, #333);
  }

  .column-filter {
    width: 100%;
    box-sizing: border-box;
    padding: 4px 6px;
    background-color: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border, #555);
    color: var(--vscode-editor-foreground);
    border-radius: 3px;
    font-size: 12px;
  }

  .column-filter:focus {
    outline: none;
    border-color: var(--vscode-focusBorder);
    box-shadow: 0 0 3px var(--vscode-focusBorder);
  }

  .datatable td {
    padding: 6px 8px;
    border-bottom: 1px solid var(--vscode-panel-border, #333);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .datatable tbody tr:hover {
    background-color: var(--vscode-list-hoverBackground, #2a2d2e);
  }
</style>
