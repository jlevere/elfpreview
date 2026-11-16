import type {
  SectionInfo,
  ProgramInfo,
  SymbolInfo,
  RelocationInfo,
} from "../../../ts/src/protocol";
import type { Column } from "../table-sort";
export type { Column } from "../table-sort";
import { address } from "../ui-state";

export function sectionColumns(elfClass: string): Array<Column<SectionInfo>> {
  return [
    { label: "Index", value: (row) => String(row.index) },
    { label: "Name", value: (row) => row.name },
    { label: "Type", value: (row) => row.typename },
    {
      label: "File offset",
      value: (row) =>
        address(row.offset, elfClass) +
        (row.typename === "SHT_NOBITS" ? " (NOBITS)" : ""),
      order: (row) => BigInt(row.offset),
    },
    {
      label: "Flags",
      value: (row) => sectionFlags(row.flags),
      order: (row) => BigInt(row.flags),
    },
    {
      label: "Alignment",
      value: (row) => row.alignment,
      order: (row) => BigInt(row.alignment),
    },
    {
      label: "Entry size",
      value: (row) => row.entrySize,
      order: (row) => BigInt(row.entrySize),
    },
    {
      label: "Address",
      value: (row) => address(row.address, elfClass),
      order: (row) => BigInt(row.address),
    },
    {
      label: "Size",
      value: (row) => row.size,
      order: (row) => BigInt(row.size),
    },
  ];
}
export function programColumns(elfClass: string): Array<Column<ProgramInfo>> {
  return [
    { label: "Type", value: (row) => row.typename },
    { label: "Flags", value: (row) => row.flagstring },
    {
      label: "File offset",
      value: (row) => address(row.offset, elfClass),
      order: (row) => BigInt(row.offset),
    },
    {
      label: "Alignment",
      value: (row) => row.alignment,
      order: (row) => BigInt(row.alignment),
    },
    {
      label: "Virtual Address",
      value: (row) => address(row.vaddr, elfClass),
      order: (row) => BigInt(row.vaddr),
    },
    {
      label: "Physical Address",
      value: (row) => address(row.paddr, elfClass),
      order: (row) => BigInt(row.paddr),
    },
    {
      label: "File Size",
      value: (row) => row.filesz,
      order: (row) => BigInt(row.filesz),
    },
    {
      label: "Memory Size",
      value: (row) => row.memsz,
      order: (row) => BigInt(row.memsz),
    },
  ];
}
export function symbolColumns(elfClass: string): Array<Column<SymbolInfo>> {
  return [
    { label: "Index", value: (row) => String(row.index) },
    { label: "Section", value: (row) => symbolSection(row.sectionIndex) },
    {
      label: "Value",
      value: (row) => address(row.value, elfClass),
      order: (row) => BigInt(row.value),
    },
    {
      label: "Size",
      value: (row) => row.size,
      order: (row) => BigInt(row.size),
    },
    { label: "Type", value: (row) => row.typestr },
    { label: "Bind", value: (row) => row.bind },
    { label: "Visibility", value: (row) => row.vis },
    { label: "Name", value: (row) => row.name },
  ];
}

function symbolSection(index: number): string {
  switch (index) {
    case 0:
      return "UND";
    case 0xfff1:
      return "ABS";
    case 0xfff2:
      return "COMMON";
    case 0xffff:
      return "XINDEX";
    default:
      return String(index);
  }
}
function sectionFlags(value: string): string {
  const bits = BigInt(value);
  const names = [
    [1n, "W"],
    [2n, "A"],
    [4n, "X"],
    [0x10n, "M"],
    [0x20n, "S"],
    [0x40n, "I"],
    [0x80n, "L"],
    [0x100n, "O"],
    [0x200n, "G"],
    [0x400n, "T"],
    [0x800n, "C"],
  ] as const;
  return (
    "0x" +
    bits.toString(16) +
    " " +
    names
      .filter(([mask]) => (bits & mask) !== 0n)
      .map(([, name]) => name)
      .join("")
  );
}
export function relocationColumns(
  elfClass: string,
  fileType: string,
): Array<Column<RelocationInfo>> {
  return [
    { label: "Table", value: (row) => row.table },
    {
      label: fileType === "REL" ? "Section offset" : "Virtual address",
      value: (row) => address(row.offset, elfClass),
      order: (row) => BigInt(row.offset),
    },
    { label: "Target section", value: (row) => row.targetSection ?? "—" },
    { label: "Type", value: (row) => row.typeName + " (" + row.typeId + ")" },
    { label: "Symbol index", value: (row) => String(row.symbolIndex) },
    {
      label: "Symbol",
      value: (row) => row.symbolName || (row.symbolIndex ? "Unresolved" : "—"),
    },
    { label: "Addend", value: (row) => row.addend ?? "Implicit (REL)" },
  ];
}
