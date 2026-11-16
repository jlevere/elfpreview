import type {
  SectionInfo,
  ProgramInfo,
  SymbolInfo,
} from "../../../ts/src/protocol";
import { address } from "../ui-state";
export type Column<Row> = { label: string; value: (row: Row) => string };

export function sectionColumns(elfClass: string): Array<Column<SectionInfo>> {
  return [
    { label: "Name", value: (row) => row.name },
    { label: "Type", value: (row) => row.typename },
    { label: "Address", value: (row) => address(row.address, elfClass) },
    { label: "Size", value: (row) => row.size },
  ];
}
export function programColumns(elfClass: string): Array<Column<ProgramInfo>> {
  return [
    { label: "Type", value: (row) => row.typename },
    { label: "Flags", value: (row) => row.flagstring },
    { label: "Virtual Address", value: (row) => address(row.vaddr, elfClass) },
    { label: "Physical Address", value: (row) => address(row.paddr, elfClass) },
    { label: "File Size", value: (row) => row.filesz },
    { label: "Memory Size", value: (row) => row.memsz },
  ];
}
export function symbolColumns(elfClass: string): Array<Column<SymbolInfo>> {
  return [
    { label: "Value", value: (row) => address(row.value, elfClass) },
    { label: "Size", value: (row) => row.size },
    { label: "Type", value: (row) => row.typestr },
    { label: "Bind", value: (row) => row.bind },
    { label: "Visibility", value: (row) => row.vis },
    { label: "Name", value: (row) => row.name },
  ];
}
