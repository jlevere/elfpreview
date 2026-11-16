import type {
  SectionInfo,
  ProgramInfo,
  SymbolInfo,
} from "../../../ts/src/protocol";
import type { Column } from "../table-sort";
export type { Column } from "../table-sort";
import { address } from "../ui-state";

export function sectionColumns(elfClass: string): Array<Column<SectionInfo>> {
  return [
    { label: "Name", value: (row) => row.name },
    { label: "Type", value: (row) => row.typename },
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
