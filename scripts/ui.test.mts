import assert from "node:assert/strict";
import test from "node:test";
import { sortRows, type Column } from "../webview/src/table-sort";
import { readUiState } from "../webview/src/ui-state";

void test("table sorting retains exact u64 ordering, stable ties and original order", () => {
  const rows = [
    { value: "18446744073709551615", name: "large" },
    { value: "9007199254740993", name: "first" },
    { value: "9007199254740992", name: "small" },
    { value: "9007199254740993", name: "second" },
  ];
  const columns: Array<Column<(typeof rows)[number]>> = [
    {
      label: "Value",
      value: (row) => row.value,
      order: (row) => BigInt(row.value),
    },
  ];
  const original = [...rows];
  assert.deepEqual(
    sortRows(rows, columns, { column: "Value", direction: "ascending" }).map(
      (row) => row.name,
    ),
    ["small", "first", "second", "large"],
  );
  assert.deepEqual(
    sortRows(rows, columns, { column: "Value", direction: "descending" }).map(
      (row) => row.name,
    ),
    ["large", "first", "second", "small"],
  );
  assert.deepEqual(rows, original);
  assert.equal(sortRows(rows, columns, undefined), rows);
  assert.equal(
    sortRows(rows, columns, {
      column: "Removed column",
      direction: "ascending",
    }),
    rows,
  );
});

void test("saved table state validates sorts and offsets independently", () => {
  const state = readUiState({
    tab: "symbols",
    filter: "fmt",
    offsets: { symbols: 500, sections: -1, programs: Infinity },
    sorts: {
      symbols: { column: "Size", direction: "descending" },
      sections: { column: 1, direction: "ascending" },
      programs: { column: "Type", direction: "invalid" },
    },
  });
  assert.equal(state.offsets.symbols, 500);
  assert.equal(state.offsets.sections, 0);
  assert.equal(state.offsets.programs, 0);
  assert.deepEqual(state.sorts, {
    symbols: { column: "Size", direction: "descending" },
  });
});
