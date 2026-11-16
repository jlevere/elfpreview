import { Memory, WasmContext } from "@vscode/wasm-component-model";
import { elfpreview, type Types } from "./generated/elfpreview";

const interfaceName = "elfpreview:parser/elfparser";

export class ElfParser {
  private constructor(
    private readonly api: elfpreview.Exports,
    private readonly memory: WebAssembly.Memory,
    private readonly cleanup: () => void,
  ) {}

  static async create(bytes: Uint8Array): Promise<ElfParser> {
    const context = new WasmContext.Default();
    const { instance } = await WebAssembly.instantiate(
      Uint8Array.from(bytes),
      elfpreview._.imports.create({}, context),
    );
    const memory = instance.exports.memory;
    if (!(memory instanceof WebAssembly.Memory))
      throw new Error("Parser has no exported memory");
    context.initialize(new Memory.Default(instance.exports));

    const key = `${interfaceName}#parseelf`;
    const invoke = instance.exports[key];
    const postReturn = instance.exports[`cabi_post_${key}`];
    if (typeof invoke !== "function" || typeof postReturn !== "function") {
      throw new Error("Parser is missing the parseelf ABI exports");
    }
    let resultPointer: number | undefined;
    const exports = {
      ...instance.exports,
      [key]: (...args: number[]) => {
        const pointer: unknown = Reflect.apply(invoke, undefined, args);
        if (typeof pointer !== "number")
          throw new Error("Invalid parseelf result pointer");
        resultPointer = pointer;
        return pointer;
      },
    };
    // The generated raw export declaration describes an out-parameter ABI.
    // wit-bindgen exports return pointers instead; the runtime lifts those correctly.
    const api = elfpreview._.exports.bind(exports, context);
    return new ElfParser(api, memory, () => {
      const pointer = resultPointer;
      resultPointer = undefined;
      if (pointer !== undefined)
        Reflect.apply(postReturn, undefined, [pointer]);
    });
  }

  get memoryBytes(): number {
    return this.memory.buffer.byteLength;
  }

  parse(data: Uint8Array): Types.Elfinfo {
    try {
      return this.api.elfparser.parseelf(data);
    } finally {
      this.cleanup();
    }
  }
}
