import type { Sort } from "./ui-state";
export type Column<Row> = {
  label: string;
  value: (row: Row) => string;
  order?: (row: Row) => bigint;
};
const collator = new Intl.Collator(undefined, { numeric: true });
export function sortRows<Row>(
  rows: Row[],
  columns: Array<Column<Row>>,
  sort: Sort | undefined,
): Row[] {
  const column = columns.find((column) => column.label === sort?.column);
  if (!column || !sort) return rows;
  const direction = sort.direction === "ascending" ? 1 : -1;
  return rows
    .map((row) => ({
      row,
      key: column.order ? column.order(row) : column.value(row),
    }))
    .sort(
      (a, b) =>
        direction *
        (typeof a.key === "bigint" && typeof b.key === "bigint"
          ? a.key < b.key
            ? -1
            : a.key > b.key
              ? 1
              : 0
          : collator.compare(String(a.key), String(b.key))),
    )
    .map(({ row }) => row);
}
