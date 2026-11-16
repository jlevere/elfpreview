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

    let pendingCleanup: (() => void) | undefined;
    const exports = { ...instance.exports };
    for (const name of ["parseelf", "quickparseelf", "validateelf"]) {
      const key = `${interfaceName}#${name}`;
      const invoke = exports[key];
      const postReturn = exports[`cabi_post_${key}`];
      if (typeof invoke !== "function" || typeof postReturn !== "function") {
        throw new Error(`Parser is missing the ${name} ABI exports`);
      }
      exports[key] = (...args: number[]) => {
        const pointer: unknown = (invoke as (...args: number[]) => unknown)(
          ...args,
        );
        if (typeof pointer !== "number")
          throw new Error(`Invalid ${name} result pointer`);
        pendingCleanup = () => {
          (postReturn as (pointer: number) => void)(pointer);
        };
        return pointer;
      };
    }
    // The generated raw export declaration describes an out-parameter ABI.
    // wit-bindgen exports return pointers instead; the runtime lifts those correctly.
    const api = elfpreview._.exports.bind(
      exports as unknown as elfpreview._.Exports,
      context,
    );
    return new ElfParser(api, memory, () => {
      const release = pendingCleanup;
      pendingCleanup = undefined;
      release?.();
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

  header(data: Uint8Array): Types.Fileinfo {
    try {
      return this.api.elfparser.quickparseelf(data);
    } finally {
      this.cleanup();
    }
  }

  validate(data: Uint8Array): boolean {
    try {
      return this.api.elfparser.validateelf(data);
    } finally {
      this.cleanup();
    }
  }
}
