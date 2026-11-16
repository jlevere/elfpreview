export const tabs = ["sections", "programs", "symbols", "dynamic"] as const;
export type Tab = (typeof tabs)[number];
export type UiState = {
  tab: Tab;
  filter: string;
  offsets: Record<Tab, number>;
};

export function readUiState(value: unknown): UiState {
  const result: UiState = {
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
