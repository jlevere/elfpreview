export const tabs = ["sections", "programs", "symbols", "dynamic"] as const;
export type Tab = (typeof tabs)[number];
export type Sort = { column: string; direction: "ascending" | "descending" };
export type UiState = {
  tab: Tab;
  filter: string;
  offsets: Record<Tab, number>;
  sorts: Partial<Record<Tab, Sort>>;
};

export function readUiState(value: unknown): UiState {
  const result: UiState = {
    sorts: {},
    tab: "sections",
    filter: "",
    offsets: { sections: 0, programs: 0, symbols: 0, dynamic: 0 },
  };
  if (!value || typeof value !== "object") return result;
  if ("tab" in value)
    result.tab = tabs.find((tab) => tab === value.tab) ?? "sections";
  if ("filter" in value && typeof value.filter === "string")
    result.filter = value.filter;
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
