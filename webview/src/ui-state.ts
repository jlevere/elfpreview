import { readColumnSettings, type ColumnSettings } from "./column-state";
export const tabs = [
  "sections",
  "programs",
  "symbols",
  "dynamicSymbols",
  "relocations",
  "dynamic",
] as const;
export type Tab = (typeof tabs)[number];
export type Sort = { column: string; direction: "ascending" | "descending" };
export type UiState = {
  tab: Tab;
  filter: string;
  dynamicFilter: string;
  relocationFilter: string;
  offsets: Record<Tab, number>;
  sorts: Partial<Record<Tab, Sort>>;
  columns: Partial<Record<Tab, ColumnSettings>>;
  demangle: boolean;
};

export function readUiState(value: unknown): UiState {
  const result: UiState = {
    sorts: {},
    columns: {},
    demangle: false,
    tab: "sections",
    filter: "",
    dynamicFilter: "",
    relocationFilter: "",
    offsets: {
      sections: 0,
      programs: 0,
      symbols: 0,
      dynamicSymbols: 0,
      relocations: 0,
      dynamic: 0,
    },
  };
  if (!value || typeof value !== "object") return result;
  if ("tab" in value)
    result.tab = tabs.find((tab) => tab === value.tab) ?? "sections";
  if ("filter" in value && typeof value.filter === "string")
    result.filter = value.filter;
  for (const key of ["dynamicFilter", "relocationFilter"] as const) {
    const filter: unknown = Reflect.get(value, key);
    if (typeof filter === "string") result[key] = filter;
  }
  if (
    "offsets" in value &&
    value.offsets &&
    typeof value.offsets === "object"
  ) {
    for (const tab of tabs) {
      const offset: unknown = Reflect.get(value.offsets, tab);
      if (typeof offset === "number" && Number.isFinite(offset) && offset >= 0)
        result.offsets[tab] = offset;
    }
  }
  if ("sorts" in value && value.sorts && typeof value.sorts === "object") {
    for (const tab of tabs) {
      const sort: unknown = Reflect.get(value.sorts, tab);
      if (
        sort &&
        typeof sort === "object" &&
        "column" in sort &&
        typeof sort.column === "string" &&
        "direction" in sort &&
        (sort.direction === "ascending" || sort.direction === "descending")
      ) {
        result.sorts[tab] = { column: sort.column, direction: sort.direction };
      }
    }
  }
  if ("demangle" in value && typeof value.demangle === "boolean")
    result.demangle = value.demangle;
  if (
    "columns" in value &&
    value.columns &&
    typeof value.columns === "object"
  ) {
    for (const tab of tabs) {
      if (tab in value.columns)
        result.columns[tab] = readColumnSettings(
          Reflect.get(value.columns, tab),
        );
    }
  }
  return result;
}

export function address(value: string, elfClass: string): string {
  return (
    "0x" +
    BigInt(value)
      .toString(16)
      .padStart(elfClass === "ELF64" ? 16 : 8, "0")
  );
}
