import { symbolSection } from "../webview/src/symbol-label";
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

void test("column preferences validate widths and reject malformed persisted state", () => {
  const state = readUiState({
    demangle: true,
    columns: {
      symbols: {
        widths: {
          Name: 470,
          Size: -1,
          Value: Infinity,
          Index: 999999,
          Bind: "wide",
        },
        hidden: ["Index", 1, null],
      },
      sections: null,
    },
  });
  assert.equal(state.demangle, true);
  assert.deepEqual(state.columns.symbols, {
    widths: { Name: 470, Size: 48, Index: 1200 },
    hidden: ["Index"],
  });
  assert.deepEqual(state.columns.sections, { widths: {}, hidden: [] });
  assert.equal(readUiState({ demangle: "true" }).demangle, false);
});

void test("display names sort independently of original values used for copying", () => {
  const rows = [
    { name: "_Z2aav", display: "zeta()" },
    { name: "_Z2zzv", display: "alpha()" },
  ];
  const columns: Array<Column<(typeof rows)[number]>> = [
    { label: "Name", value: (row) => row.name, display: (row) => row.display },
  ];
  assert.deepEqual(
    sortRows(rows, columns, { column: "Name", direction: "ascending" }).map(
      (row) => row.name,
    ),
    ["_Z2zzv", "_Z2aav"],
  );
  assert.equal(columns[0].value(rows[0]), "_Z2aav");
});

void test("section labels include names only for ordinary indexes present in the file", () => {
  const names = new Map([
    [15, ".text"],
    [0xfff1, "misleading reserved name"],
  ]);
  assert.equal(symbolSection(15, names), "15 (.text)");
  assert.equal(symbolSection(16, names), "16");
  assert.equal(symbolSection(0, names), "0 (UND)");
  assert.equal(symbolSection(0xfff1, names), "65521 (ABS)");
  assert.equal(symbolSection(0xffff, names), "65535 (XINDEX)");
});
