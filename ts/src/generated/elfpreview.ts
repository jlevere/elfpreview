/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/ban-types */
import * as $wcm from '@vscode/wasm-component-model';
import type { u32, u64, s64, i32, i64, ptr, result } from '@vscode/wasm-component-model';

export namespace Types {
	export type Sectioninfo = {
		index: u32;
		offset: u64;
		flags: u64;
		alignment: u64;
		entrySize: u64;
		name: string;
		size: u64;
		address: u64;
		typename: string;
	};

	export type Programinfo = {
		offset: u64;
		alignment: u64;
		typename: string;
		flagstring: string;
		vaddr: u64;
		paddr: u64;
		filesz: u64;
		memsz: u64;
	};

	export type Symbolinfo = {
		index: u32;
		sectionIndex: u32;
		name: string;
		typestr: string;
		bind: string;
		vis: string;
		value: u64;
		size: u64;
	};

	export type Fileinfo = {
		machine: string;
		entrypoint: u64;
		class: string;
		endianness: string;
		osabi: string;
		filetype: string;
		version: u32;
		stripped: boolean;
	};

	export type Dynlinkinfo = {
		isDynamic: boolean;
		interpreter?: string | undefined;
		neededLibs: string[];
		soname?: string | undefined;
		rpath?: string[] | undefined;
		runpath?: string[] | undefined;
	};

	export type Relocationinfo = {
		table: string;
		targetSection?: string | undefined;
		offset: u64;
		typeId: u32;
		typeName: string;
		symbolIndex: u32;
		symbolName?: string | undefined;
		addend?: s64 | undefined;
	};

	export type Elfinfo = {
		info: Fileinfo;
		sectionheaders: Sectioninfo[];
		programheaders: Programinfo[];
		symbols: Symbolinfo[];
		dynamicSymbols: Symbolinfo[];
		relocations: Relocationinfo[];
		dynlink: Dynlinkinfo;
	};
}
export type Types = {
};

export namespace Elfparser {
	export type Elfinfo = Types.Elfinfo;

	/**
	 * @throws $wcm.wstring.Error
	 */
	export type parseelf = (data: Uint8Array) => Elfinfo;
}
export type Elfparser = {
	parseelf: Elfparser.parseelf;
};
export namespace elfpreview {
	export type Imports = {
	};
	export namespace Imports {
		export type Promisified = $wcm.$imports.Promisify<Imports>;
	}
	export namespace imports {
		export type Promisify<T> = $wcm.$imports.Promisify<T>;
	}
	export type Exports = {
		elfparser: Elfparser;
	};
	export namespace Exports {
		export type Promisified = $wcm.$exports.Promisify<Exports>;
	}
	export namespace exports {
		export type Promisify<T> = $wcm.$exports.Promisify<T>;
	}
}

export namespace Types.$ {
	export const Sectioninfo = new $wcm.RecordType<Types.Sectioninfo>([
		['index', $wcm.u32],
		['offset', $wcm.u64],
		['flags', $wcm.u64],
		['alignment', $wcm.u64],
		['entrySize', $wcm.u64],
		['name', $wcm.wstring],
		['size', $wcm.u64],
		['address', $wcm.u64],
		['typename', $wcm.wstring],
	]);
	export const Programinfo = new $wcm.RecordType<Types.Programinfo>([
		['offset', $wcm.u64],
		['alignment', $wcm.u64],
		['typename', $wcm.wstring],
		['flagstring', $wcm.wstring],
		['vaddr', $wcm.u64],
		['paddr', $wcm.u64],
		['filesz', $wcm.u64],
		['memsz', $wcm.u64],
	]);
	export const Symbolinfo = new $wcm.RecordType<Types.Symbolinfo>([
		['index', $wcm.u32],
		['sectionIndex', $wcm.u32],
		['name', $wcm.wstring],
		['typestr', $wcm.wstring],
		['bind', $wcm.wstring],
		['vis', $wcm.wstring],
		['value', $wcm.u64],
		['size', $wcm.u64],
	]);
	export const Fileinfo = new $wcm.RecordType<Types.Fileinfo>([
		['machine', $wcm.wstring],
		['entrypoint', $wcm.u64],
		['class', $wcm.wstring],
		['endianness', $wcm.wstring],
		['osabi', $wcm.wstring],
		['filetype', $wcm.wstring],
		['version', $wcm.u32],
		['stripped', $wcm.bool],
	]);
	export const Dynlinkinfo = new $wcm.RecordType<Types.Dynlinkinfo>([
		['isDynamic', $wcm.bool],
		['interpreter', new $wcm.OptionType<string>($wcm.wstring)],
		['neededLibs', new $wcm.ListType<string>($wcm.wstring)],
		['soname', new $wcm.OptionType<string>($wcm.wstring)],
		['rpath', new $wcm.OptionType<string[]>(new $wcm.ListType<string>($wcm.wstring))],
		['runpath', new $wcm.OptionType<string[]>(new $wcm.ListType<string>($wcm.wstring))],
	]);
	export const Relocationinfo = new $wcm.RecordType<Types.Relocationinfo>([
		['table', $wcm.wstring],
		['targetSection', new $wcm.OptionType<string>($wcm.wstring)],
		['offset', $wcm.u64],
		['typeId', $wcm.u32],
		['typeName', $wcm.wstring],
		['symbolIndex', $wcm.u32],
		['symbolName', new $wcm.OptionType<string>($wcm.wstring)],
		['addend', new $wcm.OptionType<s64>($wcm.s64)],
	]);
	export const Elfinfo = new $wcm.RecordType<Types.Elfinfo>([
		['info', Fileinfo],
		['sectionheaders', new $wcm.ListType<Types.Sectioninfo>(Sectioninfo)],
		['programheaders', new $wcm.ListType<Types.Programinfo>(Programinfo)],
		['symbols', new $wcm.ListType<Types.Symbolinfo>(Symbolinfo)],
		['dynamicSymbols', new $wcm.ListType<Types.Symbolinfo>(Symbolinfo)],
		['relocations', new $wcm.ListType<Types.Relocationinfo>(Relocationinfo)],
		['dynlink', Dynlinkinfo],
	]);
}
export namespace Types._ {
	export const id = 'elfpreview:parser/types' as const;
	export const witName = 'types' as const;
	export const types: Map<string, $wcm.AnyComponentModelType> = new Map<string, $wcm.AnyComponentModelType>([
		['Sectioninfo', $.Sectioninfo],
		['Programinfo', $.Programinfo],
		['Symbolinfo', $.Symbolinfo],
		['Fileinfo', $.Fileinfo],
		['Dynlinkinfo', $.Dynlinkinfo],
		['Relocationinfo', $.Relocationinfo],
		['Elfinfo', $.Elfinfo]
	]);
	export type WasmInterface = {
	};
}

export namespace Elfparser.$ {
	export const Elfinfo = Types.$.Elfinfo;
	export const parseelf = new $wcm.FunctionType<Elfparser.parseelf>('parseelf',[
		['data', new $wcm.Uint8ArrayType()],
	], new $wcm.ResultType<Elfparser.Elfinfo, string>(Elfinfo, $wcm.wstring, $wcm.wstring.Error));
}
export namespace Elfparser._ {
	export const id = 'elfpreview:parser/elfparser' as const;
	export const witName = 'elfparser' as const;
	export const types: Map<string, $wcm.AnyComponentModelType> = new Map<string, $wcm.AnyComponentModelType>([
		['Elfinfo', $.Elfinfo]
	]);
	export const functions: Map<string, $wcm.FunctionType> = new Map([
		['parseelf', $.parseelf]
	]);
	export type WasmInterface = {
		'parseelf': (data_ptr: i32, data_len: i32, result: ptr<result<Elfinfo, string>>) => void;
	};
	export namespace imports {
		export type WasmInterface = _.WasmInterface;
	}
	export namespace exports {
		export type WasmInterface = _.WasmInterface;
	}
}
export namespace elfpreview.$ {
}
export namespace elfpreview._ {
	export const id = 'elfpreview:parser/elfpreview' as const;
	export const witName = 'elfpreview' as const;
	export namespace imports {
		export const interfaces: Map<string, $wcm.InterfaceType> = new Map<string, $wcm.InterfaceType>([
			['Types', Types._]
		]);
		export function create(service: elfpreview.Imports, context: $wcm.WasmContext): Imports {
			return $wcm.$imports.create<Imports>(_, service, context);
		}
		export function loop(service: elfpreview.Imports, context: $wcm.WasmContext): elfpreview.Imports {
			return $wcm.$imports.loop<elfpreview.Imports>(_, service, context);
		}
	}
	export type Imports = {
	};
	export namespace exports {
		export const interfaces: Map<string, $wcm.InterfaceType> = new Map<string, $wcm.InterfaceType>([
			['Elfparser', Elfparser._]
		]);
		export function bind(exports: Exports, context: $wcm.WasmContext): elfpreview.Exports {
			return $wcm.$exports.bind<elfpreview.Exports>(_, exports, context);
		}
	}
	export type Exports = {
		'elfpreview:parser/elfparser#parseelf': (data_ptr: i32, data_len: i32, result: ptr<result<Types.Elfinfo, string>>) => void;
	};
	export function bind(service: elfpreview.Imports, code: $wcm.Code, context?: $wcm.ComponentModelContext): Promise<elfpreview.Exports>;
	export function bind(service: elfpreview.Imports.Promisified, code: $wcm.Code, port: $wcm.RAL.ConnectionPort, context?: $wcm.ComponentModelContext): Promise<elfpreview.Exports.Promisified>;
	export function bind(service: elfpreview.Imports | elfpreview.Imports.Promisified, code: $wcm.Code, portOrContext?: $wcm.RAL.ConnectionPort | $wcm.ComponentModelContext, context?: $wcm.ComponentModelContext | undefined): Promise<elfpreview.Exports> | Promise<elfpreview.Exports.Promisified> {
		return $wcm.$main.bind(_, service, code, portOrContext, context);
	}
}