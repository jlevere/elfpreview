import type { Types } from "./generated/elfpreview";

type Wire<T> = T extends bigint
  ? string
  : T extends Array<infer Item>
    ? Array<Wire<Item>>
    : T extends object
      ? { [Key in keyof T]: Wire<T[Key]> }
      : T;

export type ElfInfo = Wire<Types.Elfinfo>;
export type FileInfo = ElfInfo["info"];
export type SectionInfo = ElfInfo["sectionheaders"][number];
export type ProgramInfo = ElfInfo["programheaders"][number];
export type SymbolInfo = ElfInfo["symbols"][number];
export type DynamicInfo = ElfInfo["dynlink"];

export type PreviewState = { filename: string } & (
  | { status: "loading" }
  | { status: "ready"; data: ElfInfo }
  | { status: "error"; message: string }
);
export type HostMessage = { type: "state"; state: PreviewState };
export type ViewMessage = { type: "ready" };

export function isReadyMessage(message: unknown): message is ViewMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "ready"
  );
}

export function toWire(data: Types.Elfinfo): ElfInfo {
  return {
    info: { ...data.info, entrypoint: data.info.entrypoint.toString() },
    sectionheaders: data.sectionheaders.map((section) => ({
      ...section,
      address: section.address.toString(),
      size: section.size.toString(),
    })),
    programheaders: data.programheaders.map((program) => ({
      ...program,
      vaddr: program.vaddr.toString(),
      paddr: program.paddr.toString(),
      filesz: program.filesz.toString(),
      memsz: program.memsz.toString(),
    })),
    symbols: data.symbols.map((symbol) => ({
      ...symbol,
      value: symbol.value.toString(),
      size: symbol.size.toString(),
    })),
    dynlink: data.dynlink,
  };
}
