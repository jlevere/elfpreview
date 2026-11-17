import { symbolSection } from "../symbol-label";
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
    { label: "Index", width: 64, value: (row) => String(row.index) },
    { label: "Name", width: 220, value: (row) => row.name },
    { label: "Type", width: 140, value: (row) => row.typename },
    {
      label: "File offset",
      width: 180,
      value: (row) =>
        address(row.offset, elfClass) +
        (row.typename === "SHT_NOBITS" ? " (NOBITS)" : ""),
      order: (row) => BigInt(row.offset),
    },
    {
      label: "Flags",
      width: 110,
      value: (row) => sectionFlags(row.flags),
      order: (row) => BigInt(row.flags),
    },
    {
      label: "Alignment",
      width: 100,
      value: (row) => row.alignment,
      order: (row) => BigInt(row.alignment),
    },
    {
      label: "Entry size",
      width: 100,
      value: (row) => row.entrySize,
      order: (row) => BigInt(row.entrySize),
    },
    {
      label: "Address",
      width: 180,
      value: (row) => address(row.address, elfClass),
      order: (row) => BigInt(row.address),
    },
    {
      label: "Size",
      width: 90,
      value: (row) => row.size,
      order: (row) => BigInt(row.size),
    },
  ];
}
export function programColumns(elfClass: string): Array<Column<ProgramInfo>> {
  return [
    { label: "Type", width: 140, value: (row) => row.typename },
    { label: "Flags", width: 110, value: (row) => row.flagstring },
    {
      label: "File offset",
      width: 180,
      value: (row) => address(row.offset, elfClass),
      order: (row) => BigInt(row.offset),
    },
    {
      label: "Alignment",
      width: 100,
      value: (row) => row.alignment,
      order: (row) => BigInt(row.alignment),
    },
    {
      label: "Virtual Address",
      width: 180,
      value: (row) => address(row.vaddr, elfClass),
      order: (row) => BigInt(row.vaddr),
    },
    {
      label: "Physical Address",
      width: 180,
      value: (row) => address(row.paddr, elfClass),
      order: (row) => BigInt(row.paddr),
    },
    {
      label: "File Size",
      width: 110,
      value: (row) => row.filesz,
      order: (row) => BigInt(row.filesz),
    },
    {
      label: "Memory Size",
      width: 110,
      value: (row) => row.memsz,
      order: (row) => BigInt(row.memsz),
    },
  ];
}
export function symbolColumns(
  elfClass: string,
  sections: SectionInfo[],
  demangle: boolean,
): Array<Column<SymbolInfo>> {
  const names = new Map(
    sections.map((section) => [section.index, section.name]),
  );
  return [
    {
      label: "Name",
      detailLabel: "Original name",
      value: (row) => row.name,
      display: demangle ? (row) => row.demangledName ?? row.name : undefined,
      width: 380,
      grow: true,
    },
    {
      label: "Index",
      hidden: true,
      width: 64,
      value: (row) => String(row.index),
    },
    {
      label: "Section",
      value: (row) => symbolSection(row.sectionIndex, names),
      width: 160,
    },
    {
      label: "Value",
      width: 180,
      value: (row) => address(row.value, elfClass),
      order: (row) => BigInt(row.value),
    },
    {
      label: "Size",
      width: 90,
      value: (row) => row.size,
      order: (row) => BigInt(row.size),
    },
    { label: "Type", width: 90, value: (row) => row.typestr },
    { label: "Bind", hidden: true, width: 90, value: (row) => row.bind },
    { label: "Visibility", hidden: true, width: 100, value: (row) => row.vis },
  ];
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
    { label: "Table", width: 140, value: (row) => row.table },
    {
      label: fileType === "REL" ? "Section offset" : "Virtual address",
      width: 180,
      value: (row) => address(row.offset, elfClass),
      order: (row) => BigInt(row.offset),
    },
    {
      label: "Target section",
      width: 160,
      value: (row) => row.targetSection ?? "—",
    },
    {
      label: "Type",
      width: 140,
      value: (row) => row.typeName + " (" + row.typeId + ")",
    },
    {
      label: "Symbol index",
      width: 110,
      value: (row) => String(row.symbolIndex),
    },
    {
      label: "Symbol",
      width: 280,
      value: (row) => row.symbolName || (row.symbolIndex ? "Unresolved" : "—"),
    },
    {
      label: "Addend",
      width: 170,
      value: (row) => row.addend ?? "Implicit (REL)",
    },
  ];
}
