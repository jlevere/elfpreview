/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/ban-types */
import * as $wcm from '@vscode/wasm-component-model';
import type { u64, u32, u16, i32, ptr, result, i64 } from '@vscode/wasm-component-model';

export namespace Types {
	/**
	 * ------------------------------------------------------------------------
	 * Basic identification enums
	 * ------------------------------------------------------------------------
	 * Supported binary container formats.
	 */
	export enum Format {
		elf = 'elf',
		pe = 'pe',
		mach = 'mach',
		unknown = 'unknown'
	}

	/**
	 * CPU bit-width of the binary.
	 */
	export enum Bitness {
		bits32 = 'bits32',
		bits64 = 'bits64'
	}

	/**
	 * Endianness of encoded integers.
	 */
	export enum Endianness {
		little = 'little',
		big = 'big'
	}

	export namespace FileKind {
		export const known = 'known' as const;
		export type Known = { readonly tag: typeof known; readonly value: Format } & _common;
		export function Known(value: Format): Known {
			return new VariantImpl(known, value) as Known;
		}

		export const other = 'other' as const;
		export type Other = { readonly tag: typeof other; readonly value: string } & _common;
		export function Other(value: string): Other {
			return new VariantImpl(other, value) as Other;
		}

		export const unknown = 'unknown' as const;
		export type Unknown = { readonly tag: typeof unknown } & _common;
		export function Unknown(): Unknown {
			return new VariantImpl(unknown, undefined) as Unknown;
		}

		export type _tt = typeof known | typeof other | typeof unknown;
		export type _vt = Format | string | undefined;
		type _common = Omit<VariantImpl, 'tag' | 'value'>;
		export function _ctor(t: _tt, v: _vt): FileKind {
			return new VariantImpl(t, v) as FileKind;
		}
		class VariantImpl {
			private readonly _tag: _tt;
			private readonly _value?: _vt;
			constructor(t: _tt, value: _vt) {
				this._tag = t;
				this._value = value;
			}
			get tag(): _tt {
				return this._tag;
			}
			get value(): _vt {
				return this._value;
			}
			isKnown(): this is Known {
				return this._tag === FileKind.known;
			}
			isOther(): this is Other {
				return this._tag === FileKind.other;
			}
			isUnknown(): this is Unknown {
				return this._tag === FileKind.unknown;
			}
		}
	}
	export type FileKind = FileKind.Known | FileKind.Other | FileKind.Unknown;

	/**
	 * ------------------------------------------------------------------------
	 * ELF-specific structures
	 * ------------------------------------------------------------------------
	 */
	export type ElfSectionInfo = {
		name: string;
		size: u64;
		address: u64;
		kind: string;
	};

	export type ElfProgramHeader = {
		kind: string;
		flagString: string;
		vaddr: u64;
		paddr: u64;
		fileSize: u64;
		memSize: u64;
	};

	export type ElfSymbolInfo = {
		name: string;
		kind: string;
		bind: string;
		vis: string;
		value: u64;
		size: u64;
	};

	export type ElfDynlinkInfo = {
		isDynamic: boolean;
		interpreter?: string | undefined;
		neededLibs: string[];
		soname?: string | undefined;
		rpath?: string[] | undefined;

		/**
		 * DT_RPATH
		 */
		runpath?: string[] | undefined;
	};

	export type ElfDetails = {
		sections: ElfSectionInfo[];
		programHeaders: ElfProgramHeader[];
		symbols: ElfSymbolInfo[];
		dynlink: ElfDynlinkInfo;
	};

	/**
	 * ------------------------------------------------------------------------
	 * PE-specific structures
	 * ------------------------------------------------------------------------
	 */
	export type PeSectionInfo = {
		name: string;
		virtualSize: u32;
		virtualAddress: u32;
		sizeOfRawData: u32;
		pointerToRawData: u32;
		characteristics: string;
	};

	export type PeImportInfo = {
		dllName: string;
		functions: string[];
	};

	export type PeExportInfo = {
		name: string;
		ordinal: u16;
		rva: u32;
	};

	export type PeDetails = {
		sections: PeSectionInfo[];
		imports: PeImportInfo[];
		exports: PeExportInfo[];
		subsystem: string;
		dllCharacteristics: string;
		imageBase: u64;
	};

	/**
	 * ------------------------------------------------------------------------
	 * Mach-O specific structures
	 * ------------------------------------------------------------------------
	 */
	export type MachSegmentInfo = {
		name: string;
		vmaddr: u64;
		vmsize: u64;
		fileoff: u64;
		filesize: u64;
		prot: string;
	};

	export type MachDylibInfo = {
		name: string;
		currentVersion: string;
	};

	export type MachDetails = {
		segments: MachSegmentInfo[];
		dylibs: MachDylibInfo[];
	};

	/**
	 * ------------------------------------------------------------------------
	 * Aggregate parse result – easy to extend in the future
	 * ------------------------------------------------------------------------
	 */
	export namespace Details {
		export const elf = 'elf' as const;
		export type Elf = { readonly tag: typeof elf; readonly value: ElfDetails } & _common;
		export function Elf(value: ElfDetails): Elf {
			return new VariantImpl(elf, value) as Elf;
		}

		export const pe = 'pe' as const;
		export type Pe = { readonly tag: typeof pe; readonly value: PeDetails } & _common;
		export function Pe(value: PeDetails): Pe {
			return new VariantImpl(pe, value) as Pe;
		}

		export const mach = 'mach' as const;
		export type Mach = { readonly tag: typeof mach; readonly value: MachDetails } & _common;
		export function Mach(value: MachDetails): Mach {
			return new VariantImpl(mach, value) as Mach;
		}

		export const unsupported = 'unsupported' as const;
		export type Unsupported = { readonly tag: typeof unsupported } & _common;
		export function Unsupported(): Unsupported {
			return new VariantImpl(unsupported, undefined) as Unsupported;
		}

		export type _tt = typeof elf | typeof pe | typeof mach | typeof unsupported;
		export type _vt = ElfDetails | PeDetails | MachDetails | undefined;
		type _common = Omit<VariantImpl, 'tag' | 'value'>;
		export function _ctor(t: _tt, v: _vt): Details {
			return new VariantImpl(t, v) as Details;
		}
		class VariantImpl {
			private readonly _tag: _tt;
			private readonly _value?: _vt;
			constructor(t: _tt, value: _vt) {
				this._tag = t;
				this._value = value;
			}
			get tag(): _tt {
				return this._tag;
			}
			get value(): _vt {
				return this._value;
			}
			isElf(): this is Elf {
				return this._tag === Details.elf;
			}
			isPe(): this is Pe {
				return this._tag === Details.pe;
			}
			isMach(): this is Mach {
				return this._tag === Details.mach;
			}
			isUnsupported(): this is Unsupported {
				return this._tag === Details.unsupported;
			}
		}
	}
	export type Details = Details.Elf | Details.Pe | Details.Mach | Details.Unsupported;
}
export type Types = {
};

/**
 * --------------------------------------------------------------------------
 * Public inspector interface
 * --------------------------------------------------------------------------
 */
export namespace Inspector {
	export type FileKind = Types.FileKind;
	export const FileKind = Types.FileKind;

	export type Details = Types.Details;
	export const Details = Types.Details;

	/**
	 * Fast identification based only on the container header (akin to the `file` utility).
	 *
	 * @throws $wcm.wstring.Error
	 */
	export type identify = (data: Uint8Array) => FileKind;

	/**
	 * Full parse of the binary, returning format-specific information.
	 * The caller should typically invoke `identify` first and only call this
	 * when the reported format is something they want to inspect deeply.
	 *
	 * @throws $wcm.wstring.Error
	 */
	export type parse = (data: Uint8Array) => Details;
}
export type Inspector = {
	identify: Inspector.identify;
	parse: Inspector.parse;
};
export namespace bininspect {
	export type Imports = {
	};
	export namespace Imports {
		export type Promisified = $wcm.$imports.Promisify<Imports>;
	}
	export namespace imports {
		export type Promisify<T> = $wcm.$imports.Promisify<T>;
	}
	export type Exports = {
		inspector: Inspector;
	};
	export namespace Exports {
		export type Promisified = $wcm.$exports.Promisify<Exports>;
	}
	export namespace exports {
		export type Promisify<T> = $wcm.$exports.Promisify<T>;
	}
}

export namespace Types.$ {
	export const Format = new $wcm.EnumType<Types.Format>(['elf', 'pe', 'mach', 'unknown']);
	export const Bitness = new $wcm.EnumType<Types.Bitness>(['bits32', 'bits64']);
	export const Endianness = new $wcm.EnumType<Types.Endianness>(['little', 'big']);
	export const FileKind = new $wcm.VariantType<Types.FileKind, Types.FileKind._tt, Types.FileKind._vt>([['known', Format], ['other', $wcm.wstring], ['unknown', undefined]], Types.FileKind._ctor);
	export const ElfSectionInfo = new $wcm.RecordType<Types.ElfSectionInfo>([
		['name', $wcm.wstring],
		['size', $wcm.u64],
		['address', $wcm.u64],
		['kind', $wcm.wstring],
	]);
	export const ElfProgramHeader = new $wcm.RecordType<Types.ElfProgramHeader>([
		['kind', $wcm.wstring],
		['flagString', $wcm.wstring],
		['vaddr', $wcm.u64],
		['paddr', $wcm.u64],
		['fileSize', $wcm.u64],
		['memSize', $wcm.u64],
	]);
	export const ElfSymbolInfo = new $wcm.RecordType<Types.ElfSymbolInfo>([
		['name', $wcm.wstring],
		['kind', $wcm.wstring],
		['bind', $wcm.wstring],
		['vis', $wcm.wstring],
		['value', $wcm.u64],
		['size', $wcm.u64],
	]);
	export const ElfDynlinkInfo = new $wcm.RecordType<Types.ElfDynlinkInfo>([
		['isDynamic', $wcm.bool],
		['interpreter', new $wcm.OptionType<string>($wcm.wstring)],
		['neededLibs', new $wcm.ListType<string>($wcm.wstring)],
		['soname', new $wcm.OptionType<string>($wcm.wstring)],
		['rpath', new $wcm.OptionType<string[]>(new $wcm.ListType<string>($wcm.wstring))],
		['runpath', new $wcm.OptionType<string[]>(new $wcm.ListType<string>($wcm.wstring))],
	]);
	export const ElfDetails = new $wcm.RecordType<Types.ElfDetails>([
		['sections', new $wcm.ListType<Types.ElfSectionInfo>(ElfSectionInfo)],
		['programHeaders', new $wcm.ListType<Types.ElfProgramHeader>(ElfProgramHeader)],
		['symbols', new $wcm.ListType<Types.ElfSymbolInfo>(ElfSymbolInfo)],
		['dynlink', ElfDynlinkInfo],
	]);
	export const PeSectionInfo = new $wcm.RecordType<Types.PeSectionInfo>([
		['name', $wcm.wstring],
		['virtualSize', $wcm.u32],
		['virtualAddress', $wcm.u32],
		['sizeOfRawData', $wcm.u32],
		['pointerToRawData', $wcm.u32],
		['characteristics', $wcm.wstring],
	]);
	export const PeImportInfo = new $wcm.RecordType<Types.PeImportInfo>([
		['dllName', $wcm.wstring],
		['functions', new $wcm.ListType<string>($wcm.wstring)],
	]);
	export const PeExportInfo = new $wcm.RecordType<Types.PeExportInfo>([
		['name', $wcm.wstring],
		['ordinal', $wcm.u16],
		['rva', $wcm.u32],
	]);
	export const PeDetails = new $wcm.RecordType<Types.PeDetails>([
		['sections', new $wcm.ListType<Types.PeSectionInfo>(PeSectionInfo)],
		['imports', new $wcm.ListType<Types.PeImportInfo>(PeImportInfo)],
		['exports', new $wcm.ListType<Types.PeExportInfo>(PeExportInfo)],
		['subsystem', $wcm.wstring],
		['dllCharacteristics', $wcm.wstring],
		['imageBase', $wcm.u64],
	]);
	export const MachSegmentInfo = new $wcm.RecordType<Types.MachSegmentInfo>([
		['name', $wcm.wstring],
		['vmaddr', $wcm.u64],
		['vmsize', $wcm.u64],
		['fileoff', $wcm.u64],
		['filesize', $wcm.u64],
		['prot', $wcm.wstring],
	]);
	export const MachDylibInfo = new $wcm.RecordType<Types.MachDylibInfo>([
		['name', $wcm.wstring],
		['currentVersion', $wcm.wstring],
	]);
	export const MachDetails = new $wcm.RecordType<Types.MachDetails>([
		['segments', new $wcm.ListType<Types.MachSegmentInfo>(MachSegmentInfo)],
		['dylibs', new $wcm.ListType<Types.MachDylibInfo>(MachDylibInfo)],
	]);
	export const Details = new $wcm.VariantType<Types.Details, Types.Details._tt, Types.Details._vt>([['elf', ElfDetails], ['pe', PeDetails], ['mach', MachDetails], ['unsupported', undefined]], Types.Details._ctor);
}
export namespace Types._ {
	export const id = 'bininspect:api/types' as const;
	export const witName = 'types' as const;
	export const types: Map<string, $wcm.AnyComponentModelType> = new Map<string, $wcm.AnyComponentModelType>([
		['Format', $.Format],
		['Bitness', $.Bitness],
		['Endianness', $.Endianness],
		['FileKind', $.FileKind],
		['ElfSectionInfo', $.ElfSectionInfo],
		['ElfProgramHeader', $.ElfProgramHeader],
		['ElfSymbolInfo', $.ElfSymbolInfo],
		['ElfDynlinkInfo', $.ElfDynlinkInfo],
		['ElfDetails', $.ElfDetails],
		['PeSectionInfo', $.PeSectionInfo],
		['PeImportInfo', $.PeImportInfo],
		['PeExportInfo', $.PeExportInfo],
		['PeDetails', $.PeDetails],
		['MachSegmentInfo', $.MachSegmentInfo],
		['MachDylibInfo', $.MachDylibInfo],
		['MachDetails', $.MachDetails],
		['Details', $.Details]
	]);
	export type WasmInterface = {
	};
}

export namespace Inspector.$ {
	export const FileKind = Types.$.FileKind;
	export const Details = Types.$.Details;
	export const identify = new $wcm.FunctionType<Inspector.identify>('identify',[
		['data', new $wcm.Uint8ArrayType()],
	], new $wcm.ResultType<Inspector.FileKind, string>(FileKind, $wcm.wstring, $wcm.wstring.Error));
	export const parse = new $wcm.FunctionType<Inspector.parse>('parse',[
		['data', new $wcm.Uint8ArrayType()],
	], new $wcm.ResultType<Inspector.Details, string>(Details, $wcm.wstring, $wcm.wstring.Error));
}
export namespace Inspector._ {
	export const id = 'bininspect:api/inspector' as const;
	export const witName = 'inspector' as const;
	export const types: Map<string, $wcm.AnyComponentModelType> = new Map<string, $wcm.AnyComponentModelType>([
		['FileKind', $.FileKind],
		['Details', $.Details]
	]);
	export const functions: Map<string, $wcm.FunctionType> = new Map([
		['identify', $.identify],
		['parse', $.parse]
	]);
	export type WasmInterface = {
		'identify': (data_ptr: i32, data_len: i32, result: ptr<result<FileKind, string>>) => void;
		'parse': (data_ptr: i32, data_len: i32, result: ptr<result<Details, string>>) => void;
	};
	export namespace imports {
		export type WasmInterface = _.WasmInterface;
	}
	export namespace exports {
		export type WasmInterface = _.WasmInterface;
	}
}
export namespace bininspect.$ {
}
export namespace bininspect._ {
	export const id = 'bininspect:api/bininspect' as const;
	export const witName = 'bininspect' as const;
	export namespace imports {
		export const interfaces: Map<string, $wcm.InterfaceType> = new Map<string, $wcm.InterfaceType>([
			['Types', Types._]
		]);
		export function create(service: bininspect.Imports, context: $wcm.WasmContext): Imports {
			return $wcm.$imports.create<Imports>(_, service, context);
		}
		export function loop(service: bininspect.Imports, context: $wcm.WasmContext): bininspect.Imports {
			return $wcm.$imports.loop<bininspect.Imports>(_, service, context);
		}
	}
	export type Imports = {
	};
	export namespace exports {
		export const interfaces: Map<string, $wcm.InterfaceType> = new Map<string, $wcm.InterfaceType>([
			['Inspector', Inspector._]
		]);
		export function bind(exports: Exports, context: $wcm.WasmContext): bininspect.Exports {
			return $wcm.$exports.bind<bininspect.Exports>(_, exports, context);
		}
	}
	export type Exports = {
		'bininspect:api/inspector#identify': (data_ptr: i32, data_len: i32, result: ptr<result<Types.FileKind, string>>) => void;
		'bininspect:api/inspector#parse': (data_ptr: i32, data_len: i32, result: ptr<result<Types.Details, string>>) => void;
	};
	export function bind(service: bininspect.Imports, code: $wcm.Code, context?: $wcm.ComponentModelContext): Promise<bininspect.Exports>;
	export function bind(service: bininspect.Imports.Promisified, code: $wcm.Code, port: $wcm.RAL.ConnectionPort, context?: $wcm.ComponentModelContext): Promise<bininspect.Exports.Promisified>;
	export function bind(service: bininspect.Imports | bininspect.Imports.Promisified, code: $wcm.Code, portOrContext?: $wcm.RAL.ConnectionPort | $wcm.ComponentModelContext, context?: $wcm.ComponentModelContext | undefined): Promise<bininspect.Exports> | Promise<bininspect.Exports.Promisified> {
		return $wcm.$main.bind(_, service, code, portOrContext, context);
	}
}