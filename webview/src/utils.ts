export function convertToBase16(
  value: bigint | number | string,
  className: string = "UNKNOWN_CLASS",
): string {
  const hexString = BigInt(value).toString(16);

  if (className === "UNKNOWN_CLASS" || !className) {
    return hexString;
  }
  return hexString.padStart(8, "0");
}
