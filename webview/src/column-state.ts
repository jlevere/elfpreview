export const minColumnWidth = 48;
export const maxColumnWidth = 1200;
export type ColumnSettings = {
  widths: Record<string, number>;
  hidden: string[];
};

export function columnWidth(value: number): number {
  return Math.min(maxColumnWidth, Math.max(minColumnWidth, Math.round(value)));
}

export function readColumnSettings(value: unknown): ColumnSettings {
  const result: ColumnSettings = { widths: {}, hidden: [] };
  if (!value || typeof value !== "object") return result;
  if ("hidden" in value && Array.isArray(value.hidden)) {
    result.hidden = value.hidden
      .filter(
        (label): label is string =>
          typeof label === "string" && label.length <= 80,
      )
      .slice(0, 64);
  }
  if ("widths" in value && value.widths && typeof value.widths === "object") {
    for (const [label, width] of Object.entries(value.widths).slice(0, 64)) {
      if (
        label.length <= 80 &&
        typeof width === "number" &&
        Number.isFinite(width)
      )
        result.widths[label] = columnWidth(width);
    }
  }
  return result;
}
