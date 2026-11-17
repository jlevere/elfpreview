export function symbolSection(
  index: number,
  names: ReadonlyMap<number, string>,
): string {
  switch (index) {
    case 0:
      return "0 (UND)";
    case 0xfff1:
      return `${index} (ABS)`;
    case 0xfff2:
      return `${index} (COMMON)`;
    case 0xffff:
      return `${index} (XINDEX)`;
    default:
      return index < 0xff00 && names.get(index)
        ? `${index} (${names.get(index)})`
        : String(index);
  }
}
