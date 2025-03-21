"use strict";
/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.processDocument = processDocument;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const wit_json_1 = require("./wit-json");
function processDocument(document, options) {
    options.singleWorld = false;
    const documentEmitter = new DocumentEmitter(document, options);
    documentEmitter.build();
    documentEmitter.postBuild();
    documentEmitter.emit();
}
class Imports {
    starImports = new Map();
    baseTypes = new Map();
    imports = new Map();
    uniqueName = 1;
    constructor() {
    }
    get size() {
        return this.imports.size;
    }
    getUniqueName() {
        return `$${this.uniqueName++}`;
    }
    addBaseType(name) {
        const value = this.baseTypes.get(name);
        if (value === undefined) {
            this.baseTypes.set(name, 1);
        }
        else {
            this.baseTypes.set(name, value + 1);
        }
    }
    removeBaseType(name) {
        let value = this.baseTypes.get(name);
        if (value === undefined) {
            return;
        }
        value -= 1;
        if (value === 0) {
            this.baseTypes.delete(name);
        }
        else {
            this.baseTypes.set(name, value);
        }
    }
    getBaseTypes() {
        return Array.from(this.baseTypes.keys());
    }
    add(value, from) {
        let values = this.imports.get(from);
        if (values === undefined) {
            values = new Set();
            this.imports.set(from, values);
        }
        values.add(value);
    }
    addStar(from, as) {
        this.starImports.set(from, as);
    }
    entries() {
        return this.imports.entries();
    }
    [Symbol.iterator]() {
        return this.imports[Symbol.iterator]();
    }
}
class Code {
    imports;
    source;
    indent;
    constructor(code) {
        this.imports = code !== undefined ? code.imports : new Imports();
        this.source = [];
        this.indent = code !== undefined ? code.indent : 0;
    }
    increaseIndent() {
        this.indent += 1;
    }
    decreaseIndent() {
        this.indent -= 1;
    }
    push(content) {
        if (content !== undefined && content.length > 0) {
            this.source.push(`${new Array(this.indent).fill('\t').join('')}${content}`);
        }
        else {
            this.source.push('');
        }
    }
    toString() {
        this.source.unshift('');
        for (const [from, values] of this.imports) {
            this.source.unshift(`import { ${Array.from(values).join(', ')} } from '${from}';`);
        }
        const baseTypes = this.imports.getBaseTypes();
        if (baseTypes.length > 0) {
            this.source.unshift(`import type { ${baseTypes.join(', ')} } from '@vscode/wasm-component-model';`);
        }
        const starImports = this.imports.starImports;
        for (const from of Array.from(starImports.keys()).reverse()) {
            this.source.unshift(`import * as ${starImports.get(from)} from '${from}';`);
        }
        this.source.unshift(`import * as $wcm from '@vscode/wasm-component-model';`);
        this.source.unshift('/* eslint-disable @typescript-eslint/ban-types */');
        this.source.unshift(' *--------------------------------------------------------------------------------------------*/');
        this.source.unshift(' *  Licensed under the MIT License. See License.txt in the project root for license information.');
        this.source.unshift(' *  Copyright (c) Microsoft Corporation. All rights reserved.');
        this.source.unshift('/*---------------------------------------------------------------------------------------------');
        return this.source.join('\n');
    }
    append(code) {
        this.source.push(...code.source);
    }
}
var _TypeScriptNameProvider;
(function (_TypeScriptNameProvider) {
    const keywords = new Map([
        ['this', 'this_'],
        ['in', 'in_']
    ]);
    let pack;
    (function (pack) {
        function name(pkg) {
            let name = pkg.name;
            let index = name.indexOf(':');
            if (index >= 0) {
                name = name.substring(index + 1);
            }
            index = name.lastIndexOf('@');
            if (index >= 0) {
                name = name.substring(0, index);
            }
            return _asPropertyName(name);
        }
        pack.name = name;
        function fileName(pkg) {
            return `${name(pkg)}.ts`;
        }
        pack.fileName = fileName;
        function importName(pkg) {
            return name(pkg);
        }
        pack.importName = importName;
        function parts(pkg) {
            let namespace;
            let version;
            let name = pkg.name;
            let index = name.indexOf(':');
            if (index >= 0) {
                namespace = name.substring(0, index);
                name = name.substring(index + 1);
            }
            index = name.lastIndexOf('@');
            if (index >= 0) {
                version = name.substring(index + 1);
                name = name.substring(0, index);
            }
            return { namespace, name, version };
        }
        pack.parts = parts;
    })(pack = _TypeScriptNameProvider.pack || (_TypeScriptNameProvider.pack = {}));
    let world;
    (function (world_1) {
        function name(world) {
            return _asPropertyName(world.name);
        }
        world_1.name = name;
        function fileName(world) {
            return `${name(world)}.ts`;
        }
        world_1.fileName = fileName;
    })(world = _TypeScriptNameProvider.world || (_TypeScriptNameProvider.world = {}));
    let iface;
    (function (iface_1) {
        function typeName(iface) {
            return _asTypeName(iface.name);
        }
        iface_1.typeName = typeName;
        function moduleName(iface) {
            return _asTypeName(iface.name);
        }
        iface_1.moduleName = moduleName;
        function propertyName(iface) {
            return _asPropertyName(iface.name);
        }
        iface_1.propertyName = propertyName;
    })(iface = _TypeScriptNameProvider.iface || (_TypeScriptNameProvider.iface = {}));
    let type;
    (function (type_1) {
        function name(type) {
            if (type.name === null) {
                throw new Error(`Type ${JSON.stringify(type)} has no name.`);
            }
            return _asTypeName(type.name);
        }
        type_1.name = name;
        function parameterName(type) {
            if (type.name === null) {
                throw new Error(`Type ${JSON.stringify(type)} has no name.`);
            }
            return _asTypeName(type.name);
        }
        type_1.parameterName = parameterName;
    })(type = _TypeScriptNameProvider.type || (_TypeScriptNameProvider.type = {}));
    let func;
    (function (func_1) {
        function name(func) {
            return _asPropertyName(func.name);
        }
        func_1.name = name;
    })(func = _TypeScriptNameProvider.func || (_TypeScriptNameProvider.func = {}));
    let method;
    (function (method_1) {
        function name(method) {
            return _asMethodName(method.name);
        }
        method_1.name = name;
        function staticName(method) {
            return _asMethodName(method.name);
        }
        method_1.staticName = staticName;
        function constructorName(method) {
            return _asMethodName(method.name);
        }
        method_1.constructorName = constructorName;
    })(method = _TypeScriptNameProvider.method || (_TypeScriptNameProvider.method = {}));
    let parameter;
    (function (parameter) {
        function name(param) {
            return _asPropertyName(param.name);
        }
        parameter.name = name;
    })(parameter = _TypeScriptNameProvider.parameter || (_TypeScriptNameProvider.parameter = {}));
    let enumeration;
    (function (enumeration) {
        function caseName(c) {
            return _asPropertyName(c.name);
        }
        enumeration.caseName = caseName;
    })(enumeration = _TypeScriptNameProvider.enumeration || (_TypeScriptNameProvider.enumeration = {}));
    let variant;
    (function (variant) {
        function caseName(c) {
            return _asPropertyName(c.name);
        }
        variant.caseName = caseName;
    })(variant = _TypeScriptNameProvider.variant || (_TypeScriptNameProvider.variant = {}));
    let flag;
    (function (flag_1) {
        function name(flag) {
            return _asPropertyName(flag.name);
        }
        flag_1.name = name;
    })(flag = _TypeScriptNameProvider.flag || (_TypeScriptNameProvider.flag = {}));
    let field;
    (function (field_1) {
        function name(field) {
            return _asPropertyName(field.name);
        }
        field_1.name = name;
    })(field = _TypeScriptNameProvider.field || (_TypeScriptNameProvider.field = {}));
    // function _asNamespaceName(name: string): string {
    // 	const parts = name.split('-');
    // 	// In VS Code namespace names start with lower case
    // 	parts[0] = parts[0][0].toLowerCase() + parts[0].substring(1);
    // 	for (let i = 1; i < parts.length; i++) {
    // 		parts[i] = parts[i][0].toUpperCase() + parts[i].substring(1);
    // 	}
    // 	return parts.join('');
    // }
    function _asTypeName(name) {
        const parts = name.split('-');
        for (let i = 0; i < parts.length; i++) {
            parts[i] = parts[i][0].toUpperCase() + parts[i].substring(1);
        }
        return parts.join('');
    }
    function _asPropertyName(name) {
        const parts = name.split('-');
        for (let i = 1; i < parts.length; i++) {
            parts[i] = parts[i][0].toUpperCase() + parts[i].substring(1);
        }
        const result = parts.join('');
        return keywords.get(result) ?? result;
    }
    function _asMethodName(name) {
        if (name.startsWith('[constructor]')) {
            return 'constructor';
        }
        const index = name.indexOf('.');
        if (index === -1) {
            return _asPropertyName(name);
        }
        else {
            return _asPropertyName(name.substring(index + 1));
        }
    }
})(_TypeScriptNameProvider || (_TypeScriptNameProvider = {}));
const TypeScriptNameProvider = _TypeScriptNameProvider;
var _WitNameProvider;
(function (_WitNameProvider) {
    const keywords = new Map([
        ['this', 'this_'],
        ['in', 'in_'],
        ['delete', 'delete_']
    ]);
    let pack;
    (function (pack) {
        function name(pkg) {
            let name = pkg.name;
            let index = name.indexOf(':');
            if (index >= 0) {
                name = name.substring(index + 1);
            }
            index = name.lastIndexOf('@');
            if (index >= 0) {
                name = name.substring(0, index);
            }
            return toTs(name);
        }
        pack.name = name;
        function fileName(pkg) {
            return `${name(pkg)}.ts`;
        }
        pack.fileName = fileName;
        function importName(pkg) {
            return name(pkg);
        }
        pack.importName = importName;
        function parts(pkg) {
            let namespace;
            let version;
            let name = pkg.name;
            let index = name.indexOf(':');
            if (index >= 0) {
                namespace = name.substring(0, index);
                name = name.substring(index + 1);
            }
            index = name.lastIndexOf('@');
            if (index >= 0) {
                version = name.substring(index + 1);
                name = name.substring(0, index);
            }
            return { namespace, name, version };
        }
        pack.parts = parts;
    })(pack = _WitNameProvider.pack || (_WitNameProvider.pack = {}));
    let world;
    (function (world_2) {
        function name(world) {
            return toTs(world.name);
        }
        world_2.name = name;
        function fileName(world) {
            return `${name(world)}.ts`;
        }
        world_2.fileName = fileName;
    })(world = _WitNameProvider.world || (_WitNameProvider.world = {}));
    let iface;
    (function (iface_2) {
        function typeName(iface) {
            return toTs(iface.name);
        }
        iface_2.typeName = typeName;
        function moduleName(iface) {
            return toTs(iface.name);
        }
        iface_2.moduleName = moduleName;
        function propertyName(iface) {
            return toTs(iface.name);
        }
        iface_2.propertyName = propertyName;
    })(iface = _WitNameProvider.iface || (_WitNameProvider.iface = {}));
    let type;
    (function (type_2) {
        function name(type) {
            if (type.name === null) {
                throw new Error(`Type ${JSON.stringify(type)} has no name.`);
            }
            return toTs(type.name);
        }
        type_2.name = name;
        function parameterName(type) {
            if (type.name === null) {
                throw new Error(`Type ${JSON.stringify(type)} has no name.`);
            }
            return toTs(type.name);
        }
        type_2.parameterName = parameterName;
    })(type = _WitNameProvider.type || (_WitNameProvider.type = {}));
    let func;
    (function (func_2) {
        function name(func) {
            return toTs(func.name);
        }
        func_2.name = name;
    })(func = _WitNameProvider.func || (_WitNameProvider.func = {}));
    let method;
    (function (method_2) {
        function name(method) {
            return _asMethodName(method.name);
        }
        method_2.name = name;
        function staticName(method) {
            return _asMethodName(method.name);
        }
        method_2.staticName = staticName;
        function constructorName(method) {
            return _asMethodName(method.name);
        }
        method_2.constructorName = constructorName;
    })(method = _WitNameProvider.method || (_WitNameProvider.method = {}));
    let parameter;
    (function (parameter) {
        function name(param) {
            return toTs(param.name);
        }
        parameter.name = name;
    })(parameter = _WitNameProvider.parameter || (_WitNameProvider.parameter = {}));
    let enumeration;
    (function (enumeration) {
        function caseName(c) {
            return toTs(c.name);
        }
        enumeration.caseName = caseName;
    })(enumeration = _WitNameProvider.enumeration || (_WitNameProvider.enumeration = {}));
    let variant;
    (function (variant) {
        function caseName(c) {
            return toTs(c.name);
        }
        variant.caseName = caseName;
    })(variant = _WitNameProvider.variant || (_WitNameProvider.variant = {}));
    let flag;
    (function (flag_2) {
        function name(flag) {
            return toTs(flag.name);
        }
        flag_2.name = name;
    })(flag = _WitNameProvider.flag || (_WitNameProvider.flag = {}));
    let field;
    (function (field_2) {
        function name(field) {
            return toTs(field.name);
        }
        field_2.name = name;
    })(field = _WitNameProvider.field || (_WitNameProvider.field = {}));
    function toTs(name) {
        let result = name.replace(/-/g, '_');
        if (result[0] === '%') {
            result = result.substring(1);
        }
        return keywords.get(result) ?? result;
    }
    function _asMethodName(name) {
        const index = name.indexOf('.');
        if (index === -1) {
            return toTs(name);
        }
        else {
            return toTs(name.substring(index + 1));
        }
    }
})(_WitNameProvider || (_WitNameProvider = {}));
const WitNameProvider = _WitNameProvider;
class Types {
    symbols;
    nameProvider;
    constructor(symbols, nameProvider) {
        this.symbols = symbols;
        this.nameProvider = nameProvider;
    }
    getFullyQualifiedName(type) {
        if (typeof type === 'string') {
            return type;
        }
        else if (typeof type === 'number') {
            type = this.symbols.getType(type);
        }
        let name = type.name !== null ? this.nameProvider.type.name(type) : undefined;
        if (name === undefined) {
            throw new Error(`Type ${JSON.stringify(type)} has no name.`);
        }
        if (type.owner !== null) {
            if (wit_json_1.Owner.isInterface(type.owner)) {
                const iface = this.symbols.getInterface(type.owner.interface);
                return `${this.symbols.interfaces.getFullyQualifiedModuleName(iface)}.${name}`;
            }
            else if (wit_json_1.Owner.isWorld(type.owner)) {
                const world = this.symbols.getWorld(type.owner.world);
                return `${this.symbols.worlds.getFullyQualifiedName(world)}.${name}`;
            }
            else {
                throw new Error(`Unsupported owner ${type.owner}`);
            }
        }
        else {
            return name;
        }
    }
}
class Interfaces {
    symbols;
    nameProvider;
    options;
    constructor(symbols, nameProvider, options) {
        this.symbols = symbols;
        this.nameProvider = nameProvider;
        this.options = options;
    }
    getFullyQualifiedModuleName(iface, separator = '.') {
        if (typeof iface === 'number') {
            iface = this.symbols.getInterface(iface);
        }
        let qualifier = '';
        if (iface.world !== undefined) {
            qualifier = `${iface.world.kind}.`;
        }
        if (this.options.singleWorld) {
            return `${qualifier}${this.nameProvider.iface.moduleName(iface)}`;
        }
        else {
            const pkg = this.symbols.getPackage(iface.package);
            return `${this.nameProvider.pack.name(pkg)}${separator}${qualifier}${this.nameProvider.iface.moduleName(iface)}`;
        }
    }
    getFullyQualifiedTypeName(iface, separator = '.') {
        if (typeof iface === 'number') {
            iface = this.symbols.getInterface(iface);
        }
        if (this.options.singleWorld) {
            return this.nameProvider.iface.moduleName(iface);
        }
        else {
            const pkg = this.symbols.getPackage(iface.package);
            return `${this.nameProvider.pack.name(pkg)}${separator}${this.nameProvider.iface.typeName(iface)}`;
        }
    }
}
class Worlds {
    symbols;
    nameProvider;
    options;
    constructor(symbols, nameProvider, options) {
        this.symbols = symbols;
        this.nameProvider = nameProvider;
        this.options = options;
    }
    getFullyQualifiedName(world, separator = '.') {
        if (typeof world === 'number') {
            world = this.symbols.getWorld(world);
        }
        if (this.options.singleWorld) {
            return this.nameProvider.world.name(world);
        }
        else {
            const pkg = this.symbols.getPackage(world.package);
            return `${this.nameProvider.pack.name(pkg)}${separator}${this.nameProvider.world.name(world)}`;
        }
    }
}
class SymbolTable {
    document;
    methods;
    resultErrorTypes;
    worlds;
    interfaces;
    types;
    constructor(document, nameProvider, options) {
        this.document = document;
        this.methods = new Map();
        this.resultErrorTypes = new Set();
        this.worlds = new Worlds(this, nameProvider, options);
        this.interfaces = new Interfaces(this, nameProvider, options);
        this.types = new Types(this, nameProvider);
        const seenCallables = new Set();
        const checkForResultError = (callable) => {
            if (seenCallables.has(callable)) {
                return;
            }
            const result = callable.result;
            if (result !== undefined && wit_json_1.TypeReference.isNumber(result)) {
                const type = this.getType(result);
                if (wit_json_1.TypeKind.isResult(type.kind)) {
                    if (type.kind.result.err !== null) {
                        if (wit_json_1.TypeReference.isString(type.kind.result.err)) {
                            this.resultErrorTypes.add(type.kind.result.err);
                        }
                        else {
                            let errorType = this.getType(type.kind.result.err);
                            while (wit_json_1.TypeKind.isReference(errorType.kind)) {
                                errorType = this.getType(errorType.kind.type);
                            }
                            this.resultErrorTypes.add(errorType);
                        }
                    }
                }
            }
            seenCallables.add(callable);
        };
        const seenInterfaces = new Set();
        const processInterface = (iface) => {
            if (seenInterfaces.has(iface)) {
                return;
            }
            for (const callable of Object.values(iface.functions)) {
                if (wit_json_1.Callable.isMethod(callable) || wit_json_1.Callable.isStaticMethod(callable) || wit_json_1.Callable.isConstructor(callable)) {
                    const type = this.getType(wit_json_1.Callable.containingType(callable));
                    let values = this.methods.get(type);
                    if (values === undefined) {
                        values = [];
                        this.methods.set(type, values);
                    }
                    values.push(callable);
                }
                checkForResultError(callable);
            }
            seenInterfaces.add(iface);
        };
        for (const iface of document.interfaces) {
            processInterface(iface);
        }
        for (const world of document.worlds) {
            for (const item of Object.values(world.exports)) {
                if (wit_json_1.ObjectKind.isFuncObject(item)) {
                    checkForResultError(item.function);
                }
                else if (wit_json_1.ObjectKind.isInterfaceObject(item)) {
                    processInterface(this.getInterface(item.interface));
                }
            }
        }
    }
    getType(ref) {
        return this.document.types[ref];
    }
    isErrorResultType(item) {
        if (typeof item === 'number') {
            item = this.getType(item);
        }
        if (typeof item !== 'string') {
            while (wit_json_1.TypeKind.isReference(item.kind)) {
                item = this.getType(item.kind.type);
            }
        }
        return this.resultErrorTypes.has(item);
    }
    getInterface(ref) {
        if (wit_json_1.InterfaceObjectId.isNumber(ref)) {
            return this.document.interfaces[ref];
        }
        else if (wit_json_1.InterfaceObjectId.isId(ref)) {
            return this.document.interfaces[ref.id];
        }
        else {
            throw new Error(`Unknown interface object id ${JSON.stringify(ref)}`);
        }
    }
    getPackage(ref) {
        return this.document.packages[ref];
    }
    getWorld(ref) {
        return this.document.worlds[ref];
    }
    getWorldIndex(world) {
        return this.document.worlds.indexOf(world);
    }
    getMethods(type) {
        return this.methods.get(type);
    }
    resolveOwner(owner) {
        if (wit_json_1.Owner.isWorld(owner)) {
            return this.getWorld(owner.world);
        }
        else if (wit_json_1.Owner.isInterface(owner)) {
            return this.getInterface(owner.interface);
        }
        else {
            throw new Error(`Unknown owner kind ${JSON.stringify(owner)}`);
        }
    }
}
class AbstractTypePrinter {
    symbols;
    constructor(symbols) {
        this.symbols = symbols;
    }
    print(type, context) {
        if (wit_json_1.Type.isBaseType(type)) {
            return this.printBase(type, context);
        }
        else if (wit_json_1.Type.isReferenceType(type)) {
            return this.printReference(type, context);
        }
        else if (wit_json_1.Type.isListType(type)) {
            return this.printList(type, context);
        }
        else if (wit_json_1.Type.isOptionType(type)) {
            return this.printOption(type, context);
        }
        else if (wit_json_1.Type.isTupleType(type)) {
            return this.printTuple(type, context);
        }
        else if (wit_json_1.Type.isResultType(type)) {
            return this.printResult(type, context);
        }
        else if (wit_json_1.Type.isRecordType(type)) {
            return this.printRecord(type, context);
        }
        else if (wit_json_1.Type.isEnumType(type)) {
            return this.printEnum(type, context);
        }
        else if (wit_json_1.Type.isFlagsType(type)) {
            return this.printFlags(type, context);
        }
        else if (wit_json_1.Type.isVariantType(type)) {
            return this.printVariant(type, context);
        }
        else if (wit_json_1.Type.isResourceType(type)) {
            return this.printResource(type, context);
        }
        else if (wit_json_1.Type.isBorrowHandleType(type)) {
            return this.printBorrowHandle(type, context);
        }
        else if (wit_json_1.Type.isOwnHandleType(type)) {
            return this.printOwnHandle(type, context);
        }
        throw new Error(`Unknown type kind ${JSON.stringify(type)}`);
    }
    printReference(type, context) {
        return this.print(this.resolve(type), context);
    }
    printBase(type, context) {
        return this.printBaseReference(type.kind.type, context);
    }
    printTypeReference(type, context) {
        if (wit_json_1.TypeReference.isNumber(type)) {
            return this.print(this.symbols.getType(type), context);
        }
        else {
            return this.printBaseReference(type, context);
        }
    }
    resolve(type) {
        return this.symbols.getType(type.kind.type);
    }
}
var TypeUsage;
(function (TypeUsage) {
    TypeUsage["parameter"] = "parameter";
    TypeUsage["witFunction"] = "witFunction";
    TypeUsage["wasmFunction"] = "wasmFunction";
    TypeUsage["property"] = "property";
    TypeUsage["typeDeclaration"] = "typeDeclaration";
})(TypeUsage || (TypeUsage = {}));
var MetaModel;
(function (MetaModel) {
    MetaModel.qualifier = '$wcm';
    MetaModel.WasmContext = `${MetaModel.qualifier}.WasmContext`;
    MetaModel.Module = `${MetaModel.qualifier}.Module`;
    MetaModel.Handle = `${MetaModel.qualifier}.Handle`;
    MetaModel.Resource = `${MetaModel.qualifier}.Resource`;
    MetaModel.ResourceManager = `${MetaModel.qualifier}.ResourceManager`;
    MetaModel.DefaultResource = `${MetaModel.qualifier}.Resource.Default`;
    MetaModel.ResourceType = `${MetaModel.qualifier}.ResourceType`;
    MetaModel.ResourceHandle = `${MetaModel.qualifier}.ResourceHandle`;
    MetaModel.ResourceHandleType = `${MetaModel.qualifier}.ResourceHandleType`;
    MetaModel.ResourceRepresentation = `${MetaModel.qualifier}.ResourceRepresentation`;
    MetaModel.OwnType = `${MetaModel.qualifier}.OwnType`;
    MetaModel.FunctionType = `${MetaModel.qualifier}.FunctionType`;
    MetaModel.WasmInterfaces = `${MetaModel.qualifier}.WasmInterfaces`;
    MetaModel.imports = `${MetaModel.qualifier}.$imports`;
    MetaModel.exports = `${MetaModel.qualifier}.$exports`;
    MetaModel.InterfaceType = `${MetaModel.qualifier}.InterfaceType`;
    MetaModel.WorldType = `${MetaModel.qualifier}.WorldType`;
    MetaModel.WorkerConnection = `${MetaModel.qualifier}.WorkerConnection`;
    MetaModel.MainConnection = `${MetaModel.qualifier}.MainConnection`;
    MetaModel.ComponentModelContext = `${MetaModel.qualifier}.ComponentModelContext`;
    MetaModel.ImportPromisify = `${MetaModel.qualifier}.$imports.Promisify`;
    MetaModel.ExportPromisify = `${MetaModel.qualifier}.$exports.Promisify`;
    MetaModel.Code = `${MetaModel.qualifier}.Code`;
    MetaModel.ConnectionPort = `${MetaModel.qualifier}.RAL.ConnectionPort`;
    MetaModel.bind = `${MetaModel.qualifier}.$main.bind`;
    MetaModel.ResultError = `${MetaModel.qualifier}.ResultError`;
    function qualify(name) {
        return `${MetaModel.qualifier}.${name}`;
    }
    MetaModel.qualify = qualify;
    let ErrorClassUsage;
    (function (ErrorClassUsage) {
        ErrorClassUsage["result"] = "result";
        ErrorClassUsage["metaModel"] = "metaModel";
    })(ErrorClassUsage = MetaModel.ErrorClassUsage || (MetaModel.ErrorClassUsage = {}));
    class ErrorClassPrinter extends AbstractTypePrinter {
        nameProvider;
        constructor(symbols, nameProvider) {
            super(symbols);
            this.nameProvider = nameProvider;
        }
        printBaseReference(type) {
            if (type === 'string') {
                type = 'wstring';
            }
            return `${qualify(type)}.Error`;
        }
        printList(type) {
            const base = type.kind.list;
            if (wit_json_1.TypeReference.isString(base)) {
                switch (base) {
                    case 'u8':
                        return `${MetaModel.qualifier}.Uint8ArrayType.Error`;
                    case 'u16':
                        return `${MetaModel.qualifier}.Uint16ArrayType.Error`;
                    case 'u32':
                        return `${MetaModel.qualifier}.Uint32ArrayType.Error`;
                    case 'u64':
                        return `${MetaModel.qualifier}.BigUint64ArrayType.Error`;
                    case 's8':
                        return `${MetaModel.qualifier}.Int8ArrayType.Error`;
                    case 's16':
                        return `${MetaModel.qualifier}.Int16ArrayType.Error`;
                    case 's32':
                        return `${MetaModel.qualifier}.Int32ArrayType.Error`;
                    case 's64':
                        return `${MetaModel.qualifier}.BigInt64ArrayType.Error`;
                    case 'f32':
                    case 'float32':
                        return `${MetaModel.qualifier}.Float32ArrayType.Error`;
                    case 'f64':
                    case 'float64':
                        return `${MetaModel.qualifier}.Float64ArrayType.Error`;
                    default:
                        return `${MetaModel.qualifier}.list.Error`;
                }
            }
            else {
                return `${MetaModel.qualifier}.list.Error`;
            }
        }
        printOption() {
            return `${qualify('option')}.Error`;
        }
        printTuple() {
            return `${qualify('tuple')}.Error`;
        }
        printResult() {
            throw new Error('Can\'t use result type as an error result type.');
        }
        printRecord(type, usage) {
            return this.printErrorType(type, usage);
        }
        printEnum(type, usage) {
            return this.printErrorType(type, usage);
        }
        printFlags(type, usage) {
            return this.printErrorType(type, usage);
        }
        printVariant(type, usage) {
            return this.printErrorType(type, usage);
        }
        printResource(type, usage) {
            return this.printErrorType(type, usage);
        }
        printBorrowHandle() {
            throw new Error('Can\'t use own type as an error result type.');
        }
        printOwnHandle() {
            throw new Error('Can\'t use own type as an error result type.');
        }
        printErrorType(type, usage) {
            if (usage === ErrorClassUsage.metaModel) {
                return `${this.symbols.types.getFullyQualifiedName(type)}.Error_`;
            }
            else {
                return `${this.nameProvider.type.name(type)}.Error_`;
            }
        }
    }
    MetaModel.ErrorClassPrinter = ErrorClassPrinter;
    class TypePrinter extends AbstractTypePrinter {
        nameProvider;
        typeParamPrinter;
        errorClassPrinter;
        constructor(symbols, nameProvider, imports, options) {
            super(symbols);
            this.nameProvider = nameProvider;
            this.typeParamPrinter = new TypeParamPrinter(symbols, nameProvider, imports, options);
            this.errorClassPrinter = new ErrorClassPrinter(symbols, nameProvider);
        }
        perform(type, usage) {
            return this.print(type, usage);
        }
        print(type, usage) {
            if (type.name !== null && (usage === TypeUsage.parameter || usage === TypeUsage.witFunction || usage === TypeUsage.wasmFunction || usage === TypeUsage.property)) {
                return this.nameProvider.type.name(type);
            }
            return super.print(type, usage);
        }
        printReference(type, usage) {
            if (type.name !== null && (usage === TypeUsage.parameter || usage === TypeUsage.witFunction || usage === TypeUsage.wasmFunction || usage === TypeUsage.property)) {
                return this.nameProvider.type.name(type);
            }
            return super.printReference(type, usage);
        }
        printBase(type, usage) {
            if (type.name !== null && (usage === TypeUsage.parameter || usage === TypeUsage.witFunction || usage === TypeUsage.wasmFunction || usage === TypeUsage.property)) {
                return this.nameProvider.type.name(type);
            }
            return super.printBase(type, usage);
        }
        printList(type, usage) {
            const base = type.kind.list;
            if (wit_json_1.TypeReference.isString(base)) {
                switch (base) {
                    case 'u8':
                        return `new ${MetaModel.qualifier}.Uint8ArrayType()`;
                    case 'u16':
                        return `new ${MetaModel.qualifier}.Uint16ArrayType()`;
                    case 'u32':
                        return `new ${MetaModel.qualifier}.Uint32ArrayType()`;
                    case 'u64':
                        return `new ${MetaModel.qualifier}.BigUint64ArrayType()`;
                    case 's8':
                        return `new ${MetaModel.qualifier}.Int8ArrayType()`;
                    case 's16':
                        return `new ${MetaModel.qualifier}.Int16ArrayType()`;
                    case 's32':
                        return `new ${MetaModel.qualifier}.Int32ArrayType()`;
                    case 's64':
                        return `new ${MetaModel.qualifier}.BigInt64ArrayType()`;
                    case 'f32':
                    case 'float32':
                        return `new ${MetaModel.qualifier}.Float32ArrayType()`;
                    case 'f64':
                    case 'float64':
                        return `new ${MetaModel.qualifier}.Float64ArrayType()`;
                    default:
                        const typeParam = this.typeParamPrinter.perform(type);
                        return `new ${MetaModel.qualifier}.ListType<${typeParam}>(${this.printTypeReference(type.kind.list, usage)})`;
                }
            }
            else {
                const typeParam = this.typeParamPrinter.perform(type);
                return `new ${MetaModel.qualifier}.ListType<${typeParam}>(${this.printTypeReference(type.kind.list, usage)})`;
            }
        }
        printOption(type, usage) {
            const typeParam = this.typeParamPrinter.perform(type);
            return `new ${MetaModel.qualifier}.OptionType<${typeParam}>(${this.printTypeReference(type.kind.option, usage)})`;
        }
        printTuple(type, usage) {
            const typeParam = this.typeParamPrinter.perform(type);
            return `new ${MetaModel.qualifier}.TupleType<${typeParam}>([${type.kind.tuple.types.map(t => this.printTypeReference(t, usage)).join(', ')}])`;
        }
        printResult(type, usage) {
            let ok = 'undefined';
            const result = type.kind.result;
            if (result.ok !== null) {
                ok = this.printTypeReference(result.ok, usage);
            }
            let error = 'undefined';
            let errorError = undefined;
            if (result.err !== null) {
                error = this.printTypeReference(result.err, usage);
                if (this.symbols.isErrorResultType(result.err)) {
                    errorError = this.errorClassPrinter.printTypeReference(result.err, ErrorClassUsage.metaModel);
                }
            }
            return `new ${MetaModel.qualifier}.ResultType<${this.typeParamPrinter.perform(type)}>(${ok}, ${error}${errorError !== undefined ? `, ${errorError}` : ''})`;
        }
        printBorrowHandle(type, usage) {
            const typeParam = this.typeParamPrinter.perform(type);
            return `new ${MetaModel.qualifier}.BorrowType<${typeParam}>(${this.printTypeReference(type.kind.handle.borrow, usage)})`;
        }
        printOwnHandle(type, usage) {
            const typeParam = this.typeParamPrinter.perform(type);
            return `new ${MetaModel.qualifier}.OwnType<${typeParam}>(${this.printTypeReference(type.kind.handle.own, usage)})`;
        }
        printRecord(type, _usage) {
            return this.nameProvider.type.name(type);
        }
        printEnum(type, _usage) {
            return this.nameProvider.type.name(type);
        }
        printFlags(type, _usage) {
            return this.nameProvider.type.name(type);
        }
        printVariant(type, _usage) {
            return this.nameProvider.type.name(type);
        }
        printResource(type, _usage) {
            return this.nameProvider.type.name(type);
        }
        printBaseReference(base) {
            switch (base) {
                case 'u8':
                    return qualify('u8');
                case 'u16':
                    return qualify('u16');
                case 'u32':
                    return qualify('u32');
                case 'u64':
                    return qualify('u64');
                case 's8':
                    return qualify('s8');
                case 's16':
                    return qualify('s16');
                case 's32':
                    return qualify('s32');
                case 's64':
                    return qualify('s64');
                case 'f32':
                case 'float32':
                    return qualify('float32');
                case 'f64':
                case 'float64':
                    return qualify('float64');
                case 'bool':
                    return qualify('bool');
                case 'string':
                    return qualify('wstring');
                case 'char':
                    return qualify('char');
                default:
                    throw new Error(`Unknown base type ${base}`);
            }
        }
    }
    MetaModel.TypePrinter = TypePrinter;
    class TypeParamPrinter extends AbstractTypePrinter {
        imports;
        options;
        typeScriptPrinter;
        constructor(symbols, nameProvider, imports, options) {
            super(symbols);
            this.imports = imports;
            this.options = options;
            this.typeScriptPrinter = new TypeScript.TypePrinter(symbols, nameProvider, imports, options);
        }
        perform(type) {
            return this.print(type, 0);
        }
        printReference(type, depth) {
            if (type.name !== null) {
                return this.symbols.types.getFullyQualifiedName(type);
            }
            return super.printReference(type, depth);
        }
        printBase(type, _depth) {
            if (type.name !== null) {
                return this.symbols.types.getFullyQualifiedName(type);
            }
            return this.typeScriptPrinter.printBase(type, TypeScript.TypePrinterContext.create(TypeUsage.property));
        }
        printBaseReference(type) {
            return this.typeScriptPrinter.printBaseReference(type);
        }
        printList(type, depth) {
            const base = type.kind.list;
            if (wit_json_1.TypeReference.isString(base)) {
                switch (base) {
                    case 'u8':
                        return 'Uint8Array';
                    case 'u16':
                        return 'Uint16Array';
                    case 'u32':
                        return 'Uint32Array';
                    case 'u64':
                        return 'BigUint64Array';
                    case 's8':
                        return 'Int8Array';
                    case 's16':
                        return 'Int16Array';
                    case 's32':
                        return 'Int32Array';
                    case 's64':
                        return 'BigInt64Array';
                    case 'f32':
                    case 'float32':
                        return 'Float32Array';
                    case 'f64':
                    case 'float64':
                        return 'Float64Array';
                    default:
                        const result = this.printTypeReference(type.kind.list, depth + 1);
                        return depth === 0 ? result : `${result}[]`;
                }
            }
            else {
                const result = this.printTypeReference(type.kind.list, depth + 1);
                return depth === 0 ? result : `${result}[]`;
            }
        }
        printOption(type, depth) {
            const result = this.printTypeReference(type.kind.option, depth + 1);
            return depth === 0 ? result : `${result} | undefined`;
        }
        printTuple(type, depth) {
            return `[${type.kind.tuple.types.map(t => this.printTypeReference(t, depth + 1)).join(', ')}]`;
        }
        printResult(type, depth) {
            const result = type.kind.result;
            const ok = result.ok !== null ? this.printTypeReference(result.ok, depth + 1) : 'void';
            const error = result.err !== null ? this.printTypeReference(result.err, depth + 1) : 'void';
            if (depth > 0) {
                this.imports.addBaseType('result');
            }
            return depth === 0 ? `${ok}, ${error}` : `result<${ok}, ${error}>`;
        }
        printBorrowHandle(type, depth) {
            const borrowed = this.printTypeReference(type.kind.handle.borrow, depth + 1);
            if (this.options.keep.borrow) {
                if (depth > 0) {
                    this.imports.addBaseType('borrow');
                }
                return depth === 0 ? borrowed : `borrow<${borrowed}>`;
            }
            else {
                return borrowed;
            }
        }
        printOwnHandle(type, depth) {
            const owned = this.printTypeReference(type.kind.handle.own, depth + 1);
            if (this.options.keep.own) {
                if (depth > 0) {
                    this.imports.addBaseType('own');
                }
                return depth === 0 ? owned : `own<${owned}>`;
            }
            else {
                return owned;
            }
        }
        printRecord(type, _depth) {
            return this.symbols.types.getFullyQualifiedName(type);
        }
        printEnum(type, _depth) {
            return this.symbols.types.getFullyQualifiedName(type);
        }
        printFlags(type, _depth) {
            return this.symbols.types.getFullyQualifiedName(type);
        }
        printVariant(type, _depth) {
            return this.symbols.types.getFullyQualifiedName(type);
        }
        printResource(type, _depth) {
            return this.symbols.types.getFullyQualifiedName(type);
        }
    }
})(MetaModel || (MetaModel = {}));
var TypeScript;
(function (TypeScript) {
    let TypePrinterContext;
    (function (TypePrinterContext) {
        function create(usage) {
            return { usage, errorClasses: [] };
        }
        TypePrinterContext.create = create;
    })(TypePrinterContext = TypeScript.TypePrinterContext || (TypeScript.TypePrinterContext = {}));
    class TypePrinter extends AbstractTypePrinter {
        nameProvider;
        imports;
        options;
        errorClassPrinter;
        constructor(symbols, nameProvider, imports, options) {
            super(symbols);
            this.nameProvider = nameProvider;
            this.imports = imports;
            this.options = options;
            this.errorClassPrinter = new MetaModel.ErrorClassPrinter(symbols, nameProvider);
        }
        perform(type, context) {
            return this.print(type, context);
        }
        print(type, context) {
            const { usage } = context;
            if (type.name !== null && (usage === TypeUsage.parameter || usage === TypeUsage.witFunction || usage === TypeUsage.wasmFunction || usage === TypeUsage.property)) {
                return this.nameProvider.type.name(type);
            }
            return super.print(type, context);
        }
        printReference(type, context) {
            const { usage } = context;
            if (type.name !== null && (usage === TypeUsage.parameter || usage === TypeUsage.witFunction || usage === TypeUsage.wasmFunction || usage === TypeUsage.property)) {
                return this.nameProvider.type.name(type);
            }
            return super.printReference(type, context);
        }
        printBase(type, context) {
            const { usage } = context;
            if (type.name !== null && (usage === TypeUsage.parameter || usage === TypeUsage.witFunction || usage === TypeUsage.wasmFunction || usage === TypeUsage.property)) {
                return this.nameProvider.type.name(type);
            }
            return super.printBase(type, context);
        }
        printList(type, context) {
            const base = type.kind.list;
            if (wit_json_1.TypeReference.isString(base)) {
                switch (base) {
                    case 'u8':
                        return 'Uint8Array';
                    case 'u16':
                        return 'Uint16Array';
                    case 'u32':
                        return 'Uint32Array';
                    case 'u64':
                        return 'BigUint64Array';
                    case 's8':
                        return 'Int8Array';
                    case 's16':
                        return 'Int16Array';
                    case 's32':
                        return 'Int32Array';
                    case 's64':
                        return 'BigInt64Array';
                    case 'f32':
                    case 'float32':
                        return 'Float32Array';
                    case 'f64':
                    case 'float64':
                        return 'Float64Array';
                    default:
                        return `${this.printBaseReference(base)}[]`;
                }
            }
            else {
                return `${this.printTypeReference(base, context)}[]`;
            }
        }
        printOption(type, context) {
            return `${this.printTypeReference(type.kind.option, context)} | undefined`;
        }
        printTuple(type, context) {
            return `[${type.kind.tuple.types.map(t => this.printTypeReference(t, context)).join(', ')}]`;
        }
        printResult(type, context) {
            let ok = 'void';
            const result = type.kind.result;
            if (result.ok !== null) {
                ok = this.printTypeReference(result.ok, context);
            }
            const { usage } = context;
            if (usage === TypeUsage.witFunction && !this.options.keep.result) {
                if (result.err !== null) {
                    context.errorClasses.push(this.errorClassPrinter.printTypeReference(result.err, MetaModel.ErrorClassUsage.result));
                }
                return ok;
            }
            else {
                this.imports.addBaseType('result');
                let error = 'void';
                if (result.err !== null) {
                    error = this.printTypeReference(result.err, context);
                }
                return `result<${ok}, ${error}>`;
            }
        }
        printBorrowHandle(type, context) {
            const borrowed = this.printTypeReference(type.kind.handle.borrow, context);
            if (this.options.keep.borrow) {
                this.imports.addBaseType('borrow');
                return `borrow<${borrowed}>`;
            }
            else {
                return borrowed;
            }
        }
        printOwnHandle(type, context) {
            const owned = this.printTypeReference(type.kind.handle.own, context);
            if (this.options.keep.own) {
                this.imports.addBaseType('own');
                return `own<${owned}>`;
            }
            else {
                return owned;
            }
        }
        printRecord(type, _context) {
            return this.nameProvider.type.name(type);
        }
        printEnum(type, _context) {
            return this.nameProvider.type.name(type);
        }
        printFlags(type, _context) {
            return this.nameProvider.type.name(type);
        }
        printVariant(type, _context) {
            return this.nameProvider.type.name(type);
        }
        printResource(type, _context) {
            return this.nameProvider.type.name(type);
        }
        printBaseReference(base) {
            switch (base) {
                case 'u8':
                    this.imports.addBaseType('u8');
                    return 'u8';
                case 'u16':
                    this.imports.addBaseType('u16');
                    return 'u16';
                case 'u32':
                    this.imports.addBaseType('u32');
                    return 'u32';
                case 'u64':
                    this.imports.addBaseType('u64');
                    return 'u64';
                case 's8':
                    this.imports.addBaseType('s8');
                    return 's8';
                case 's16':
                    this.imports.addBaseType('s16');
                    return 's16';
                case 's32':
                    this.imports.addBaseType('s32');
                    return 's32';
                case 's64':
                    this.imports.addBaseType('s64');
                    return 's64';
                case 'f32':
                case 'float32':
                    this.imports.addBaseType('float32');
                    return 'float32';
                case 'f64':
                case 'float64':
                    this.imports.addBaseType('float64');
                    return 'float64';
                case 'bool':
                    return 'boolean';
                case 'string':
                    return 'string';
                default:
                    throw new Error(`Unknown base type ${base}`);
            }
        }
    }
    TypeScript.TypePrinter = TypePrinter;
})(TypeScript || (TypeScript = {}));
class TypeFlattener {
    symbols;
    nameProvider;
    imports;
    static baseTypes = new Map([
        ['u8', 'i32'],
        ['u16', 'i32'],
        ['u32', 'i32'],
        ['u64', 'i64'],
        ['s8', 'i32'],
        ['s16', 'i32'],
        ['s32', 'i32'],
        ['s64', 'i64'],
        ['f32', 'f32'],
        ['float32', 'f32'],
        ['f64', 'f64'],
        ['float64', 'f64'],
        ['bool', 'i32'],
    ]);
    constructor(symbols, nameProvider, imports) {
        this.symbols = symbols;
        this.nameProvider = nameProvider;
        this.imports = imports;
    }
    flattenParams(callable) {
        const result = [];
        for (const param of callable.params) {
            this.flattenParam(result, param);
        }
        return result;
    }
    flattenResult(callable) {
        const result = [];
        if (callable.result === undefined) {
            result.push('void');
        }
        else {
            this.flattenResultType(result, callable.result);
        }
        return result;
    }
    flattenParam(result, param) {
        this.flattenParamType(result, param.type, this.nameProvider.parameter.name(param));
    }
    flattenParamType(result, type, prefix) {
        if (wit_json_1.TypeReference.is(type)) {
            if (wit_json_1.TypeReference.isString(type)) {
                this.handleParamBaseType(result, type, prefix);
            }
            else if (wit_json_1.TypeReference.isNumber(type)) {
                const ref = this.symbols.getType(type);
                this.flattenParamType(result, ref, prefix);
            }
        }
        else if (wit_json_1.Type.isBaseType(type)) {
            this.handleParamBaseType(result, type.kind.type, prefix);
        }
        else if (wit_json_1.Type.isReferenceType(type)) {
            const ref = this.symbols.getType(type.kind.type);
            this.flattenParamType(result, ref, this.prefix(type, prefix));
        }
        else if (wit_json_1.Type.isListType(type)) {
            result.push({ name: `${prefix}_ptr`, type: 'i32' });
            result.push({ name: `${prefix}_len`, type: 'i32' });
        }
        else if (wit_json_1.Type.isTupleType(type)) {
            for (let i = 0; i < type.kind.tuple.types.length; i++) {
                this.flattenParamType(result, type.kind.tuple.types[i], `${prefix}_${i}`);
            }
        }
        else if (wit_json_1.Type.isOptionType(type)) {
            this.imports.addBaseType('i32');
            result.push({ name: `${prefix}_case`, type: 'i32' });
            this.flattenParamType(result, type.kind.option, `${prefix}_option`);
        }
        else if (wit_json_1.Type.isResultType(type)) {
            const cases = [];
            cases.push(type.kind.result.ok === null ? undefined : type.kind.result.ok);
            cases.push(type.kind.result.err === null ? undefined : type.kind.result.err);
            this.flattenParamVariantType(result, cases, prefix);
        }
        else if (wit_json_1.Type.isVariantType(type)) {
            const cases = [];
            for (const c of type.kind.variant.cases) {
                cases.push(c.type === null ? undefined : c.type);
            }
            this.flattenParamVariantType(result, cases, prefix);
        }
        else if (wit_json_1.Type.isEnumType(type)) {
            this.imports.addBaseType('i32');
            result.push({ name: `${prefix}_${this.nameProvider.type.parameterName(type)}`, type: 'i32' });
        }
        else if (wit_json_1.Type.isFlagsType(type)) {
            const flatTypes = TypeFlattener.flagsFlatTypes(type.kind.flags.flags.length);
            if (flatTypes.length > 0) {
                this.imports.addBaseType(flatTypes[0]);
            }
            if (flatTypes.length === 1) {
                result.push({ name: `${prefix}`, type: flatTypes[0] });
            }
            else {
                for (let i = 0; i < flatTypes.length; i++) {
                    result.push({ name: `${prefix}_${i}`, type: flatTypes[i] });
                }
            }
        }
        else if (wit_json_1.Type.isRecordType(type)) {
            for (const field of type.kind.record.fields) {
                this.flattenParamType(result, field.type, `${prefix}_${this.nameProvider.field.name(field)}`);
            }
        }
        else if (wit_json_1.Type.isResourceType(type)) {
            this.imports.addBaseType('i32');
            result.push({ name: `${prefix}`, type: 'i32' });
        }
        else if (wit_json_1.Type.isBorrowHandleType(type)) {
            this.imports.addBaseType('i32');
            result.push({ name: `${prefix}`, type: 'i32' });
        }
        else if (wit_json_1.Type.isOwnHandleType(type)) {
            this.imports.addBaseType('i32');
            result.push({ name: `${prefix}`, type: 'i32' });
        }
        else {
            throw new Error(`Unexpected type ${JSON.stringify(type)}.`);
        }
    }
    flattenParamVariantType(result, cases, prefix) {
        this.imports.addBaseType('i32');
        result.push({ name: `${prefix}_case`, type: 'i32' });
        const variantResult = [];
        for (const c of cases) {
            if (c === undefined) {
                continue;
            }
            const caseFlatTypes = [];
            this.flattenParamType(caseFlatTypes, c, '');
            for (let i = 0; i < caseFlatTypes.length; i++) {
                const want = caseFlatTypes[i];
                if (i < variantResult.length) {
                    const currentWasmType = this.assertWasmTypeName(variantResult[i].type);
                    const wantWasmType = this.assertWasmTypeName(want.type);
                    const use = TypeFlattener.joinFlatType(currentWasmType, wantWasmType);
                    this.imports.addBaseType(use);
                    this.imports.removeBaseType(currentWasmType);
                    this.imports.removeBaseType(wantWasmType);
                    variantResult[i].type = use;
                }
                else {
                    this.imports.addBaseType(want.type);
                    variantResult.push({ name: `${prefix}_${i}`, type: want.type });
                }
            }
        }
        result.push(...variantResult);
    }
    handleParamBaseType(result, type, prefix) {
        if (type === 'string') {
            result.push({ name: `${prefix}_ptr`, type: 'i32' });
            result.push({ name: `${prefix}_len`, type: 'i32' });
            this.imports.addBaseType('i32');
        }
        else {
            const t = TypeFlattener.baseTypes.get(type);
            if (t === undefined) {
                throw new Error(`Unknown base type ${type}`);
            }
            this.imports.addBaseType(t);
            result.push({ name: prefix, type: t });
        }
    }
    flattenResultType(result, type) {
        if (wit_json_1.TypeReference.is(type)) {
            if (wit_json_1.TypeReference.isString(type)) {
                this.handleResultBaseType(result, type);
            }
            else if (wit_json_1.TypeReference.isNumber(type)) {
                const ref = this.symbols.getType(type);
                this.flattenResultType(result, ref);
            }
        }
        else if (wit_json_1.Type.isBaseType(type)) {
            this.handleResultBaseType(result, type.kind.type);
        }
        else if (wit_json_1.Type.isReferenceType(type)) {
            const ref = this.symbols.getType(type.kind.type);
            this.flattenResultType(result, ref);
        }
        else if (wit_json_1.Type.isListType(type)) {
            this.imports.addBaseType('i32');
            result.push('i32', 'i32');
        }
        else if (wit_json_1.Type.isTupleType(type)) {
            for (let i = 0; i < type.kind.tuple.types.length; i++) {
                this.flattenResultType(result, type.kind.tuple.types[i]);
            }
        }
        else if (wit_json_1.Type.isOptionType(type)) {
            this.imports.addBaseType('i32');
            result.push('i32');
            this.flattenResultType(result, type.kind.option);
        }
        else if (wit_json_1.Type.isResultType(type)) {
            const cases = [];
            cases.push(type.kind.result.ok === null ? undefined : type.kind.result.ok);
            cases.push(type.kind.result.err === null ? undefined : type.kind.result.err);
            this.flattenResultVariantType(result, cases);
        }
        else if (wit_json_1.Type.isVariantType(type)) {
            const cases = [];
            for (const c of type.kind.variant.cases) {
                cases.push(c.type === null ? undefined : c.type);
            }
            this.flattenResultVariantType(result, cases);
        }
        else if (wit_json_1.Type.isEnumType(type)) {
            this.imports.addBaseType('i32');
            result.push('i32');
        }
        else if (wit_json_1.Type.isFlagsType(type)) {
            const flatTypes = TypeFlattener.flagsFlatTypes(type.kind.flags.flags.length);
            if (flatTypes.length > 0) {
                this.imports.addBaseType(flatTypes[0]);
            }
            result.push(...flatTypes);
        }
        else if (wit_json_1.Type.isRecordType(type)) {
            for (const field of type.kind.record.fields) {
                this.flattenResultType(result, field.type);
            }
        }
        else if (wit_json_1.Type.isResourceType(type)) {
            this.imports.addBaseType('i32');
            result.push('i32');
        }
        else if (wit_json_1.Type.isBorrowHandleType(type)) {
            this.imports.addBaseType('i32');
            result.push('i32');
        }
        else if (wit_json_1.Type.isOwnHandleType(type)) {
            this.imports.addBaseType('i32');
            result.push('i32');
        }
        else {
            throw new Error(`Unexpected type ${JSON.stringify(type)}.`);
        }
    }
    flattenResultVariantType(result, cases) {
        this.imports.addBaseType('i32');
        result.push('i32');
        const variantResult = [];
        for (const c of cases) {
            if (c === undefined) {
                continue;
            }
            const caseFlatTypes = [];
            this.flattenResultType(caseFlatTypes, c);
            for (let i = 0; i < caseFlatTypes.length; i++) {
                const want = caseFlatTypes[i];
                if (i < variantResult.length) {
                    const currentWasmType = this.assertWasmTypeName(variantResult[i]);
                    const wantWasmType = this.assertWasmTypeName(want);
                    const use = TypeFlattener.joinFlatType(currentWasmType, wantWasmType);
                    this.imports.addBaseType(use);
                    this.imports.removeBaseType(currentWasmType);
                    this.imports.removeBaseType(wantWasmType);
                    variantResult[i] = use;
                }
                else {
                    this.imports.addBaseType(want);
                    variantResult.push(want);
                }
            }
        }
        result.push(...variantResult);
    }
    assertWasmTypeName(type) {
        if (type === 'i32' || type === 'i64' || type === 'f32' || type === 'f64') {
            return type;
        }
        throw new Error(`Type ${type} is not a wasm type name.`);
    }
    handleResultBaseType(result, type) {
        if (type === 'string') {
            this.imports.addBaseType('i32');
            result.push('i32', 'i32');
        }
        else {
            const t = TypeFlattener.baseTypes.get(type);
            if (t === undefined) {
                throw new Error(`Unknown base type ${type}`);
            }
            this.imports.addBaseType(t);
            result.push(t);
        }
    }
    prefix(type, prefix) {
        if (type.name !== null) {
            return `${prefix}_${this.nameProvider.type.parameterName(type)}`;
        }
        else {
            return prefix;
        }
    }
    static flagsFlatTypes(fields) {
        return new Array(this.num32Flags(fields)).fill('i32');
    }
    static num32Flags(fields) {
        return Math.ceil(fields / 32);
    }
    static joinFlatType(a, b) {
        if (a === b) {
            return a;
        }
        if ((a === 'i32' && b === 'f32') || (a === 'f32' && b === 'i32')) {
            return 'i32';
        }
        return 'i64';
    }
}
class Emitter {
    context;
    constructor(context) {
        this.context = context;
    }
    emitDocumentation(item, code, emitNewLine = false) {
        if (item.docs !== undefined && item.docs.contents !== null) {
            emitNewLine && code.push('');
            code.push(`/**`);
            const lines = item.docs.contents.split('\n');
            for (const line of lines) {
                code.push(` * ${line}`);
            }
            code.push(` */`);
        }
    }
    emitFunctionDocumentation(item, code, exceptions, emitNewLine = false) {
        const hasDocumentation = item.docs !== undefined && item.docs.contents !== null;
        const hasExceptions = exceptions !== undefined && exceptions.length > 0;
        if (hasDocumentation || hasExceptions) {
            emitNewLine && code.push('');
            code.push(`/**`);
            if (hasDocumentation) {
                const lines = item.docs.contents.split('\n');
                for (const line of lines) {
                    code.push(` * ${line}`);
                }
            }
            if (hasExceptions) {
                if (hasDocumentation) {
                    code.push(` *`);
                }
                for (const exception of exceptions) {
                    code.push(` * @throws ${exception}`);
                }
            }
            code.push(` */`);
        }
    }
    emitNamespace(_code) {
    }
    emitTypeDeclaration(_code) {
    }
    emitMetaModel(_code) {
    }
    emitWasmInterface(_code, _qualifier) {
    }
    emitWasmExport(_code, _property) {
        throw new Error('Needs to be implemented in concrete subclasses');
    }
    emitWorldMember(_code, _scope) {
        throw new Error('Needs to be implemented in concrete subclasses');
    }
    emitWorldWasmImport(_code) {
        throw new Error('Needs to be implemented in concrete subclasses');
    }
    emitWorldWasmExport(_code) {
        throw new Error('Needs to be implemented in concrete subclasses');
    }
    emitHost(_code) {
    }
}
class DocumentEmitter {
    document;
    options;
    mainCode;
    nameProvider;
    packages;
    exports;
    constructor(document, options) {
        this.document = document;
        this.options = options;
        this.mainCode = new Code();
        this.nameProvider = this.options.nameStyle === 'wit' ? WitNameProvider : TypeScriptNameProvider;
        this.packages = [];
        this.exports = [];
    }
    build() {
        const regExp = this.options.filter !== undefined ? new RegExp(`${this.options.filter}:`) : undefined;
        const package2Worlds = new Map();
        for (const world of this.document.worlds) {
            // Ignore import worlds. They are used to include in other worlds
            // which again are flattened by the wit parser.
            if (world.name === 'imports') {
                continue;
            }
            const worlds = package2Worlds.get(world.package);
            if (worlds === undefined) {
                package2Worlds.set(world.package, [world]);
            }
            else {
                worlds.push(world);
            }
        }
        const ifaceEmitters = new Map();
        const typeEmitters = new Map();
        const symbols = new SymbolTable(this.document, this.nameProvider, this.options);
        for (const [index, pkg] of this.document.packages.entries()) {
            if (regExp !== undefined && !regExp.test(pkg.name)) {
                continue;
            }
            const code = new Code();
            const printers = {
                typeScript: new TypeScript.TypePrinter(symbols, this.nameProvider, code.imports, this.options),
                metaModel: new MetaModel.TypePrinter(symbols, this.nameProvider, code.imports, this.options)
            };
            const typeFlattener = new TypeFlattener(symbols, this.nameProvider, code.imports);
            const context = { symbols, printers, nameProvider: this.nameProvider, typeFlattener, options: this.options, ifaceEmitters: ifaceEmitters, typeEmitters };
            const pkgEmitter = new PackageEmitter(pkg, package2Worlds.get(index) ?? [], context);
            pkgEmitter.build();
            this.packages.push({ emitter: pkgEmitter, code });
        }
    }
    postBuild() {
        for (const pack of this.packages) {
            pack.emitter.postBuild();
        }
    }
    emit() {
        const typeDeclarations = [];
        if (this.packages.length === 1 && this.packages[0].emitter.hasSingleWorlds() && this.options.structure === 'auto') {
            this.options.singleWorld = true;
            const { emitter, code } = this.packages[0];
            const world = emitter.getWorld(0);
            const fileName = this.nameProvider.world.fileName(world.world);
            emitter.emit(code);
            fs.writeFileSync(path.join(this.options.outDir, fileName), code.toString());
            return;
        }
        else {
            for (const { emitter, code } of this.packages) {
                const pkgName = emitter.pkgName;
                emitter.emit(code);
                this.exports.push(pkgName);
                const fileName = this.nameProvider.pack.fileName(emitter.pkg);
                fs.writeFileSync(path.join(this.options.outDir, fileName), code.toString());
                this.mainCode.push(`import { ${pkgName} } from './${this.nameProvider.pack.importName(emitter.pkg)}';`);
                typeDeclarations.push(`${pkgName}?: ${pkgName}`);
            }
        }
        if (this.packages.length === 1 && this.options.structure !== 'namespace') {
            return;
        }
        const pkg = this.packages[0].emitter.pkg;
        const parts = this.nameProvider.pack.parts(pkg);
        if (parts.namespace === undefined) {
            return;
        }
        const code = this.mainCode;
        const namespace = parts.namespace;
        code.push();
        code.push(`namespace ${namespace}._ {`);
        code.increaseIndent();
        code.push(`export const packages: Map<string, ${MetaModel.qualifier}.PackageType> =  new Map<string, ${MetaModel.qualifier}.PackageType>([`);
        code.increaseIndent();
        for (const { emitter } of this.packages) {
            const pkgName = this.nameProvider.pack.name(emitter.pkg);
            code.push(`['${pkgName}', ${pkgName}._],`);
        }
        code.decreaseIndent();
        code.push(`]);`);
        code.decreaseIndent();
        code.push(`}`);
        code.push(`export { ${this.exports.join(', ')} };`);
        code.push(`export default ${namespace};`);
        fs.writeFileSync(path.join(this.options.outDir, `${namespace}.ts`), code.toString());
    }
}
class PackageEmitter extends Emitter {
    pkg;
    worlds;
    pkgName;
    ifaceEmitters;
    worldEmitters;
    constructor(pkg, worlds, context) {
        super(context);
        this.pkg = pkg;
        this.worlds = worlds;
        this.pkgName = context.nameProvider.pack.name(pkg);
        this.ifaceEmitters = [];
        this.worldEmitters = [];
    }
    getId() {
        return this.pkg.name;
    }
    hasSingleWorlds() {
        return this.worldEmitters.length === 1;
    }
    getWorld(index) {
        return this.worldEmitters[index];
    }
    build() {
        const { symbols } = this.context;
        for (const ref of Object.values(this.pkg.interfaces)) {
            const iface = symbols.getInterface(ref);
            const emitter = new InterfaceEmitter(iface, this.pkg, this.context);
            emitter.build();
            this.ifaceEmitters.push(emitter);
        }
        for (const world of this.worlds) {
            const emitter = new WorldEmitter(world, this.pkg, this.context);
            emitter.build();
            this.worldEmitters.push(emitter);
        }
    }
    postBuild() {
        for (const ifaceEmitter of this.ifaceEmitters) {
            ifaceEmitter.postBuild();
        }
        for (const worldEmitter of this.worldEmitters) {
            worldEmitter.postBuild();
        }
    }
    emit(code) {
        this.emitNamespace(code);
        this.emitTypeDeclaration(code);
        this.emitMetaData(code);
        this.emitApi(code);
    }
    emitNamespace(code) {
        const pkgName = this.pkgName;
        if (!this.context.options.singleWorld) {
            code.push(`export namespace ${pkgName} {`);
            code.increaseIndent();
        }
        for (const [index, ifaceEmitter] of this.ifaceEmitters.entries()) {
            ifaceEmitter.emitNamespace(code);
            ifaceEmitter.emitTypeDeclaration(code);
            if (index < this.ifaceEmitters.length - 1) {
                code.push('');
            }
        }
        for (const [index, worldEmitter] of this.worldEmitters.entries()) {
            worldEmitter.emitNamespace(code);
            if (index < this.worldEmitters.length - 1) {
                code.push('');
            }
        }
        if (!this.context.options.singleWorld) {
            code.decreaseIndent();
            code.push(`}`);
        }
    }
    emitTypeDeclaration(_code) {
    }
    emitMetaData(code) {
        const pkgName = this.pkgName;
        code.push('');
        if (!this.context.options.singleWorld) {
            code.push(`export namespace ${pkgName} {`);
            code.increaseIndent();
        }
        for (let i = 0; i < this.ifaceEmitters.length; i++) {
            const ifaceEmitter = this.ifaceEmitters[i];
            ifaceEmitter.emitMetaModel(code);
            ifaceEmitter.emitAPI(code);
            if (i < this.ifaceEmitters.length - 1) {
                code.push('');
            }
        }
        for (const [index, worldEmitter] of this.worldEmitters.entries()) {
            worldEmitter.emitMetaModel(code);
            worldEmitter.emitAPI(code);
            if (index < this.worldEmitters.length - 1) {
                code.push('');
            }
        }
        if (!this.context.options.singleWorld) {
            code.decreaseIndent();
            code.push(`}`);
        }
    }
    emitApi(code) {
        if (this.context.options.singleWorld) {
            return;
        }
        const { nameProvider } = this.context;
        const pkgName = this.pkgName;
        code.push('');
        code.push(`export namespace ${pkgName}._ {`);
        code.increaseIndent();
        const version = this.getVersion();
        if (version !== undefined) {
            code.push(`export const version = '${version}' as const;`);
        }
        code.push(`export const id = '${this.getId()}' as const;`);
        code.push(`export const witName = '${this.getWitName()}' as const;`);
        code.push(`export const interfaces: Map<string, ${MetaModel.InterfaceType}> = new Map<string, ${MetaModel.InterfaceType}>([`);
        code.increaseIndent();
        for (let i = 0; i < this.ifaceEmitters.length; i++) {
            const ifaceEmitter = this.ifaceEmitters[i];
            const name = nameProvider.iface.moduleName(ifaceEmitter.iface);
            code.push(`['${name}', ${name}._]${i < this.ifaceEmitters.length - 1 ? ',' : ''}`);
        }
        code.decreaseIndent();
        code.push(`]);`);
        if (this.worldEmitters.length > 0) {
            code.push(`export const worlds: Map<string, ${MetaModel.WorldType}> = new Map<string, ${MetaModel.WorldType}>([`);
            code.increaseIndent();
            for (const [index, emitter] of this.worldEmitters.entries()) {
                const name = nameProvider.world.name(emitter.world);
                code.push(`['${name}', ${name}._]${index < this.ifaceEmitters.length - 1 ? ',' : ''}`);
            }
            code.decreaseIndent();
            code.push(`]);`);
        }
        code.decreaseIndent();
        code.push(`}`);
    }
    getWitName() {
        let name = this.pkg.name;
        let index = name.indexOf(':');
        if (index >= 0) {
            name = name.substring(index + 1);
        }
        index = name.lastIndexOf('@');
        if (index >= 0) {
            name = name.substring(0, index);
        }
        return name;
    }
    getVersion() {
        let name = this.pkg.name;
        let index = name.lastIndexOf('@');
        return index >= 0 ? name.substring(index + 1) : undefined;
    }
}
class WorldEmitter extends Emitter {
    world;
    pkg;
    imports;
    exports;
    constructor(world, pkg, context) {
        super(context);
        this.world = world;
        this.pkg = pkg;
        this.imports = {
            funcEmitters: [],
            interfaceEmitters: [],
            typeEmitters: [],
            locals: {
                typeEmitters: [],
                interfaceEmitter: [],
                resourceEmitters: []
            }
        };
        this.exports = {
            funcEmitters: [],
            interfaceEmitters: [],
            typeEmitters: [],
            locals: {
                typeEmitters: [],
                interfaceEmitter: [],
                resourceEmitters: []
            }
        };
    }
    build() {
        const ImportEmitter = CallableEmitter(WorldImportFunctionEmitter);
        const imports = Object.values(this.world.imports);
        for (const item of imports) {
            if (wit_json_1.ObjectKind.isFuncObject(item)) {
                this.imports.funcEmitters.push(new ImportEmitter(item.function, this.world, this.context));
            }
        }
        const ExportEmitter = CallableEmitter(WorldExportFunctionEmitter);
        const exports = Object.values(this.world.exports);
        for (const item of exports) {
            if (wit_json_1.ObjectKind.isFuncObject(item)) {
                this.exports.funcEmitters.push(new ExportEmitter(item.function, this.world, this.context));
            }
        }
    }
    postBuild() {
        const imports = Object.keys(this.world.imports);
        for (const key of imports) {
            const item = this.world.imports[key];
            if (wit_json_1.ObjectKind.isInterfaceObject(item)) {
                this.handleInterfaceImport(key, item);
            }
            else if (wit_json_1.ObjectKind.isTypeObject(item)) {
                this.handleTypeImport(key, item);
            }
        }
        const exports = Object.keys(this.world.exports);
        for (const key of exports) {
            const item = this.world.exports[key];
            if (wit_json_1.ObjectKind.isInterfaceObject(item)) {
                this.handleInterfaceExports(key, item);
            }
            else if (wit_json_1.ObjectKind.isTypeObject(item)) {
                this.handleTypeExports(key, item);
            }
        }
    }
    getId() {
        let name = this.pkg.name;
        const index = name.indexOf('@');
        let version;
        if (index >= 0) {
            version = name.substring(index + 1);
            name = name.substring(0, index);
        }
        return `${name}/${this.world.name}${version !== undefined ? `@${version}` : ''}`;
    }
    handleInterfaceImport(name, item) {
        const { symbols } = this.context;
        let iface = symbols.getInterface(item.interface);
        const emitter = this.findInterfaceEmitter(iface);
        if (emitter !== undefined) {
            this.imports.interfaceEmitters.push(emitter);
            return;
        }
        iface.world = { ref: symbols.getWorldIndex(this.world), kind: 'imports' };
        this.imports.locals.interfaceEmitter.push(this.createInterfaceEmitter(name, iface));
    }
    handleInterfaceExports(name, item) {
        const { symbols } = this.context;
        let iface = symbols.getInterface(item.interface);
        const emitter = this.findInterfaceEmitter(iface);
        if (emitter !== undefined) {
            this.exports.interfaceEmitters.push(emitter);
            return;
        }
        iface.world = { ref: symbols.getWorldIndex(this.world), kind: 'exports' };
        this.exports.locals.interfaceEmitter.push(this.createInterfaceEmitter(name, iface));
    }
    findInterfaceEmitter(iface) {
        return this.context.ifaceEmitters.get(iface);
    }
    createInterfaceEmitter(name, iface) {
        if (iface.name === null) {
            iface = Object.assign(Object.create(null), iface, { name });
        }
        else if (iface.name.match(/interface-\d+/)) {
            throw new Error(`Invalid interface name: ${iface.name}`);
        }
        const result = new InterfaceEmitter(iface, this.world, this.context);
        result.build();
        const { symbols } = this.context;
        symbols.resolveOwner;
        return result;
    }
    handleTypeImport(name, item) {
        const { symbols } = this.context;
        if (wit_json_1.TypeReference.isString(item.type)) {
            throw new Error(`Named type references are not supported in worlds. Type: ${item.type}`);
        }
        const type = symbols.getType(item.type);
        const emitter = this.findTypeEmitter(type);
        if (emitter !== undefined) {
            this.imports.typeEmitters.push(emitter);
            return;
        }
        this.imports.locals.typeEmitters.push(this.createTypeEmitter(name, type));
    }
    handleTypeExports(name, item) {
        const { symbols } = this.context;
        if (wit_json_1.TypeReference.isString(item.type)) {
            throw new Error(`Named type references are not supported in worlds. Type: ${item.type}`);
        }
        const type = symbols.getType(item.type);
        const emitter = this.findTypeEmitter(type);
        if (emitter !== undefined) {
            this.exports.typeEmitters.push(emitter);
            return;
        }
        this.exports.locals.typeEmitters.push(this.createTypeEmitter(name, type));
    }
    findTypeEmitter(type) {
        return this.context.typeEmitters.get(type);
    }
    createTypeEmitter(name, type) {
        if (type.name === null) {
            type = Object.assign(Object.create(null), type, { name });
        }
        const result = TypeEmitter.create(type, this.world, this.context);
        return result;
    }
    emitNamespace(code) {
        const { nameProvider } = this.context;
        code.push(`export namespace ${nameProvider.world.name(this.world)} {`);
        code.increaseIndent();
        for (const emitter of [...this.imports.locals.typeEmitters, ...this.exports.locals.typeEmitters]) {
            emitter.emitNamespace(code);
        }
        if (this.imports.locals.interfaceEmitter.length > 0) {
            code.push(`export namespace imports {`);
            code.increaseIndent();
            for (const emitter of this.imports.locals.interfaceEmitter) {
                emitter.emitNamespace(code);
                if (emitter.hasCode()) {
                    emitter.emitTypeDeclaration(code);
                }
            }
            code.decreaseIndent();
            code.push(`}`);
        }
        code.push(`export type Imports = {`);
        code.increaseIndent();
        for (const emitter of this.imports.funcEmitters) {
            emitter.emitWorldMember(code, 'imports');
        }
        for (const emitter of this.imports.interfaceEmitters.concat(this.imports.locals.interfaceEmitter)) {
            if (!emitter.hasCode()) {
                continue;
            }
            if (this.pkg !== emitter.getPkg()) {
                emitter.emitImport(code);
            }
            emitter.emitWorldMember(code, 'imports');
        }
        code.decreaseIndent();
        code.push(`};`);
        code.push(`export namespace Imports {`);
        code.increaseIndent();
        code.push(`export type Promisified = ${MetaModel.ImportPromisify}<Imports>;`);
        code.decreaseIndent();
        code.push(`}`);
        code.push(`export namespace imports {`);
        code.increaseIndent();
        code.push(`export type Promisify<T> = ${MetaModel.ImportPromisify}<T>;`);
        code.decreaseIndent();
        code.push(`}`);
        if (this.exports.locals.interfaceEmitter.length > 0) {
            code.push(`export namespace exports {`);
            code.increaseIndent();
            for (const emitter of this.exports.locals.interfaceEmitter) {
                emitter.emitNamespace(code);
                if (emitter.hasCode()) {
                    emitter.emitTypeDeclaration(code);
                }
            }
            code.decreaseIndent();
            code.push(`}`);
        }
        code.push(`export type Exports = {`);
        code.increaseIndent();
        for (const emitter of this.exports.funcEmitters) {
            emitter.emitWorldMember(code, 'exports');
        }
        for (const emitter of this.exports.interfaceEmitters.concat(this.exports.locals.interfaceEmitter)) {
            if (!emitter.hasCode()) {
                continue;
            }
            if (this.pkg !== emitter.getPkg()) {
                emitter.emitImport(code);
            }
            emitter.emitWorldMember(code, 'exports');
        }
        code.decreaseIndent();
        code.push(`};`);
        code.push(`export namespace Exports {`);
        code.increaseIndent();
        code.push(`export type Promisified = ${MetaModel.ExportPromisify}<Exports>;`);
        code.decreaseIndent();
        code.push(`}`);
        code.push(`export namespace exports {`);
        code.increaseIndent();
        code.push(`export type Promisify<T> = ${MetaModel.ExportPromisify}<T>;`);
        code.decreaseIndent();
        code.push(`}`);
        code.decreaseIndent();
        code.push('}');
    }
    emitMetaModel(code) {
        const { nameProvider } = this.context;
        const name = nameProvider.world.name(this.world);
        code.push(`export namespace ${name}.$ {`);
        code.increaseIndent();
        for (const emitter of this.imports.locals.typeEmitters) {
            emitter.emitMetaModel(code);
        }
        for (const emitter of this.imports.typeEmitters) {
            emitter.emitMetaModel(code);
        }
        for (const emitter of this.exports.locals.typeEmitters) {
            emitter.emitMetaModel(code);
        }
        for (const emitter of this.exports.typeEmitters) {
            emitter.emitMetaModel(code);
        }
        if (this.imports.funcEmitters.length > 0) {
            code.push(`export namespace imports {`);
            code.increaseIndent();
            for (const emitter of this.imports.funcEmitters) {
                emitter.emitMetaModel(code);
            }
            for (const emitter of this.imports.locals.interfaceEmitter) {
                emitter.emitMetaModel(code);
            }
            for (const emitter of this.imports.locals.resourceEmitters) {
                emitter.emitMetaModel(code);
            }
            code.decreaseIndent();
            code.push('}');
        }
        if (this.exports.funcEmitters.length > 0) {
            code.push(`export namespace exports {`);
            code.increaseIndent();
            for (const emitter of this.exports.funcEmitters) {
                emitter.emitMetaModel(code);
            }
            for (const emitter of this.exports.locals.interfaceEmitter) {
                emitter.emitMetaModel(code);
            }
            for (const emitter of this.exports.locals.resourceEmitters) {
                emitter.emitMetaModel(code);
            }
            code.decreaseIndent();
            code.push('}');
        }
        code.decreaseIndent();
        code.push('}');
    }
    emitAPI(code) {
        const { nameProvider } = this.context;
        const name = nameProvider.world.name(this.world);
        code.push(`export namespace ${name}._ {`);
        code.increaseIndent();
        code.push(`export const id = '${this.getId()}' as const;`);
        code.push(`export const witName = '${this.world.name}' as const;`);
        const importsAllInterfaceEmitters = this.imports.locals.interfaceEmitter.concat(this.imports.interfaceEmitters);
        const exportsAllInterfaceEmitters = this.exports.locals.interfaceEmitter.concat(this.exports.interfaceEmitters);
        if (this.imports.funcEmitters.length > 0) {
            code.push(`export type $Root = {`);
            code.increaseIndent();
            for (const emitter of this.imports.funcEmitters) {
                emitter.emitWorldWasmImport(code);
            }
            code.decreaseIndent();
            code.push(`};`);
        }
        if (this.imports.funcEmitters.length + this.imports.interfaceEmitters.length + this.exports.interfaceEmitters.reduce((acc, emitter) => acc + (emitter.hasResources() ? 1 : 0), 0) > 0) {
            code.push(`export namespace imports {`);
            code.increaseIndent();
            for (const emitter of this.imports.locals.interfaceEmitter) {
                emitter.emitAPI(code);
            }
            if (this.imports.funcEmitters.length > 0) {
                code.push(`export const functions: Map<string, ${MetaModel.FunctionType}> = new Map([`);
                code.increaseIndent();
                for (const [index, emitter] of this.imports.funcEmitters.entries()) {
                    const name = nameProvider.func.name(emitter.callable);
                    code.push(`['${name}', $.imports.${name}]${index < this.imports.funcEmitters.length - 1 ? ',' : ''}`);
                }
                code.decreaseIndent();
                code.push(']);');
            }
            if (importsAllInterfaceEmitters.length > 0) {
                code.push(`export const interfaces: Map<string, ${MetaModel.qualifier}.InterfaceType> = new Map<string, ${MetaModel.qualifier}.InterfaceType>([`);
                code.increaseIndent();
                for (const [index, emitter] of importsAllInterfaceEmitters.entries()) {
                    const iface = emitter.iface;
                    const qualifier = iface.world !== undefined ? `${iface.world.kind}.` : '';
                    const name = nameProvider.iface.moduleName(emitter.iface);
                    if (this.pkg === emitter.getPkg()) {
                        code.push(`['${name}', ${qualifier}${name}._]${index < importsAllInterfaceEmitters.length - 1 ? ',' : ''}`);
                    }
                    else {
                        const pkgName = nameProvider.pack.name(emitter.getPkg());
                        code.push(`['${pkgName}.${name}', ${pkgName}.${qualifier}${name}._]${index < importsAllInterfaceEmitters.length - 1 ? ',' : ''}`);
                    }
                }
                code.decreaseIndent();
                code.push(`]);`);
            }
            code.push(`export function create(service: ${name}.Imports, context: ${MetaModel.WasmContext}): Imports {`);
            code.increaseIndent();
            code.push(`return ${MetaModel.imports}.create<Imports>(_, service, context);`);
            code.decreaseIndent();
            code.push('}');
            code.push(`export function loop(service: ${name}.Imports, context: ${MetaModel.WasmContext}): ${name}.Imports {`);
            code.increaseIndent();
            code.push(`return ${MetaModel.imports}.loop<${name}.Imports>(_, service, context);`);
            code.decreaseIndent();
            code.push('}');
            code.decreaseIndent();
            code.push('}');
            code.push(`export type Imports = {`);
            code.increaseIndent();
            if (this.imports.funcEmitters.length > 0) {
                code.push(`'$root': $Root;`);
            }
            for (const emitter of importsAllInterfaceEmitters) {
                if (!emitter.hasCode()) {
                    continue;
                }
                emitter.emitWorldWasmImport(code);
            }
            for (const emitter of exportsAllInterfaceEmitters) {
                if (!emitter.hasResources()) {
                    continue;
                }
                emitter.emitWorldWasmExportImport(code);
            }
            code.decreaseIndent();
            code.push(`};`);
        }
        if (this.exports.funcEmitters.length + this.exports.interfaceEmitters.length > 0) {
            code.push(`export namespace exports {`);
            code.increaseIndent();
            for (const emitter of this.exports.locals.interfaceEmitter) {
                emitter.emitAPI(code);
            }
            if (this.exports.funcEmitters.length > 0) {
                code.push(`export const functions: Map<string, ${MetaModel.FunctionType}> = new Map([`);
                code.increaseIndent();
                for (const [index, emitter] of this.exports.funcEmitters.entries()) {
                    const name = nameProvider.func.name(emitter.callable);
                    code.push(`['${name}', $.exports.${name}]${index < this.exports.funcEmitters.length - 1 ? ',' : ''}`);
                }
                code.decreaseIndent();
                code.push(']);');
            }
            if (exportsAllInterfaceEmitters.length > 0) {
                code.push(`export const interfaces: Map<string, ${MetaModel.qualifier}.InterfaceType> = new Map<string, ${MetaModel.qualifier}.InterfaceType>([`);
                code.increaseIndent();
                for (const [index, emitter] of exportsAllInterfaceEmitters.entries()) {
                    const iface = emitter.iface;
                    const qualifier = iface.world !== undefined ? `${iface.world.kind}.` : '';
                    const name = nameProvider.iface.moduleName(iface);
                    if (this.pkg === emitter.getPkg()) {
                        code.push(`['${name}', ${qualifier}${name}._]${index < exportsAllInterfaceEmitters.length - 1 ? ',' : ''}`);
                    }
                    else {
                        const pkgName = nameProvider.pack.name(emitter.getPkg());
                        code.push(`['${pkgName}.${name}', ${pkgName}.${qualifier}${name}._]${index < exportsAllInterfaceEmitters.length - 1 ? ',' : ''}`);
                    }
                }
                code.decreaseIndent();
                code.push(`]);`);
            }
            code.push(`export function bind(exports: Exports, context: ${MetaModel.WasmContext}): ${name}.Exports {`);
            code.increaseIndent();
            code.push(`return ${MetaModel.exports}.bind<${name}.Exports>(_, exports, context);`);
            code.decreaseIndent();
            code.push('}');
            code.decreaseIndent();
            code.push('}');
            code.push(`export type Exports = {`);
            code.increaseIndent();
            for (const emitter of this.exports.funcEmitters) {
                emitter.emitWorldWasmExport(code);
            }
            for (const emitter of exportsAllInterfaceEmitters) {
                if (!emitter.hasCode()) {
                    continue;
                }
                emitter.emitWorldWasmExport(code);
            }
            code.decreaseIndent();
            code.push(`};`);
        }
        code.push(`export function bind(service: ${name}.Imports, code: ${MetaModel.Code}, context?: ${MetaModel.ComponentModelContext}): Promise<${name}.Exports>;`);
        code.push(`export function bind(service: ${name}.Imports.Promisified, code: ${MetaModel.Code}, port: ${MetaModel.ConnectionPort}, context?: ${MetaModel.ComponentModelContext}): Promise<${name}.Exports.Promisified>;`);
        code.push(`export function bind(service: ${name}.Imports | ${name}.Imports.Promisified, code: ${MetaModel.Code}, portOrContext?: ${MetaModel.ConnectionPort} | ${MetaModel.ComponentModelContext}, context?: ${MetaModel.ComponentModelContext} | undefined): Promise<${name}.Exports> | Promise<${name}.Exports.Promisified> {`);
        code.increaseIndent();
        code.push(`return ${MetaModel.bind}(_, service, code, portOrContext, context);`);
        code.decreaseIndent();
        code.push(`}`);
        code.decreaseIndent();
        code.push('}');
    }
}
class InterfaceEmitter extends Emitter {
    container;
    iface;
    typeEmitters;
    functionEmitters;
    resourceEmitters;
    constructor(iface, container, context) {
        super(context);
        this.iface = iface;
        this.container = container;
        this.typeEmitters = [];
        this.functionEmitters = [];
        this.resourceEmitters = [];
        context.ifaceEmitters.set(iface, this);
    }
    getPkg() {
        const { symbols } = this.context;
        if (wit_json_1.World.is(this.container)) {
            return symbols.getPackage(this.container.package);
        }
        else {
            return this.container;
        }
    }
    getId() {
        const pkg = this.getPkg();
        let name = pkg.name;
        const index = name.indexOf('@');
        let version;
        if (index >= 0) {
            version = name.substring(index + 1);
            name = name.substring(0, index);
        }
        return `${name}/${this.iface.name}${version !== undefined ? `@${version}` : ''}`;
    }
    hasVersion() {
        return this.getPkg().name.indexOf('@') >= 0;
    }
    build() {
        const { symbols } = this.context;
        for (const t of Object.values(this.iface.types)) {
            const type = symbols.getType(t);
            const emitter = TypeEmitter.create(type, this.iface, this.context);
            if (emitter instanceof ResourceEmitter) {
                this.resourceEmitters.push(emitter);
            }
            else {
                this.typeEmitters.push(emitter);
            }
        }
        const Emitter = CallableEmitter(FunctionEmitter);
        for (const func of Object.values(this.iface.functions)) {
            if (!wit_json_1.Callable.isFunction(func)) {
                continue;
            }
            this.functionEmitters.push(new Emitter(func, this.iface, this.context));
        }
    }
    postBuild() {
    }
    hasCode() {
        return this.functionEmitters.length > 0 || this.resourceEmitters.length > 0;
    }
    hasResources() {
        return this.resourceEmitters.length > 0;
    }
    emitNamespace(code) {
        const { nameProvider } = this.context;
        const name = nameProvider.iface.moduleName(this.iface);
        this.emitDocumentation(this.iface, code);
        code.push(`export namespace ${name} {`);
        code.increaseIndent();
        const emitters = [...this.typeEmitters, ...this.resourceEmitters, ...this.functionEmitters];
        for (const [index, type] of emitters.entries()) {
            type.emitNamespace(code);
            if (index < emitters.length - 1) {
                code.push('');
            }
        }
        code.decreaseIndent();
        code.push(`}`);
    }
    emitTypeDeclaration(code) {
        const { nameProvider } = this.context;
        const name = nameProvider.iface.typeName(this.iface);
        code.push(`export type ${name} = {`);
        code.increaseIndent();
        for (const resource of this.resourceEmitters) {
            resource.emitTypeDeclaration(code);
        }
        for (const func of this.functionEmitters) {
            func.emitTypeDeclaration(code);
        }
        code.decreaseIndent();
        code.push('};');
    }
    emitMetaModel(code) {
        const { nameProvider, symbols } = this.context;
        const name = nameProvider.iface.moduleName(this.iface);
        code.push(`export namespace ${name}.$ {`);
        code.increaseIndent();
        const order = new Map();
        for (const type of this.typeEmitters) {
            order.set(type.type, type);
        }
        for (const resource of this.resourceEmitters) {
            order.set(resource.resource, resource);
        }
        for (const t of Object.values(this.iface.types)) {
            const type = symbols.getType(t);
            const emitter = order.get(type);
            emitter?.emitMetaModel(code);
        }
        for (const resource of this.resourceEmitters) {
            resource.emitMetaModelFunctions(code);
        }
        for (const func of this.functionEmitters) {
            func.emitMetaModel(code);
        }
        code.decreaseIndent();
        code.push('}');
    }
    emitAPI(code) {
        const { nameProvider } = this.context;
        const name = nameProvider.iface.moduleName(this.iface);
        const types = [];
        const resources = [];
        for (const type of this.typeEmitters) {
            types.push(nameProvider.type.name(type.type));
        }
        for (const resource of this.resourceEmitters) {
            const name = nameProvider.type.name(resource.resource);
            types.push(name);
            resources.push(name);
        }
        code.push(`export namespace ${name}._ {`);
        code.increaseIndent();
        code.push(`export const id = '${this.getId()}' as const;`);
        code.push(`export const witName = '${this.iface.name}' as const;`);
        for (const emitter of this.resourceEmitters) {
            emitter.emitAPI(code);
        }
        let qualifier = '';
        if (this.iface.world !== undefined) {
            // calculator.$.imports.Iface.
            const { symbols } = this.context;
            const world = symbols.getWorld(this.iface.world.ref);
            qualifier = `${nameProvider.world.name(world)}.$.${this.iface.world.kind}.${nameProvider.iface.typeName(this.iface)}.`;
        }
        if (types.length > 0) {
            code.push(`export const types: Map<string, ${MetaModel.qualifier}.AnyComponentModelType> = new Map<string, ${MetaModel.qualifier}.AnyComponentModelType>([`);
            code.increaseIndent();
            for (let i = 0; i < types.length; i++) {
                code.push(`['${types[i]}', ${qualifier}$.${types[i]}]${i < types.length - 1 ? ',' : ''}`);
            }
            code.decreaseIndent();
            code.push(']);');
        }
        if (this.functionEmitters.length > 0) {
            code.push(`export const functions: Map<string, ${MetaModel.FunctionType}> = new Map([`);
            code.increaseIndent();
            for (let i = 0; i < this.functionEmitters.length; i++) {
                const name = nameProvider.func.name(this.functionEmitters[i].callable);
                code.push(`['${name}', ${qualifier}$.${name}]${i < this.functionEmitters.length - 1 ? ',' : ''}`);
            }
            code.decreaseIndent();
            code.push(']);');
        }
        if (resources.length > 0) {
            const mapType = `Map<string, ${MetaModel.qualifier}.ResourceType>`;
            code.push(`export const resources: ${mapType} = new ${mapType}([`);
            code.increaseIndent();
            for (const [index, resource] of resources.entries()) {
                code.push(`['${resource}', ${qualifier}$.${resource}]${index < resources.length - 1 ? ',' : ''}`);
            }
            code.decreaseIndent();
            code.push(']);');
        }
        code.push(`export type WasmInterface = {`);
        code.increaseIndent();
        for (const func of this.functionEmitters) {
            func.emitWasmInterface(code);
        }
        code.decreaseIndent();
        code.push(`};`);
        if (this.functionEmitters.length + this.resourceEmitters.length > 0) {
            code.push('export namespace imports {');
            code.increaseIndent();
            if (this.resourceEmitters.length > 0) {
                const resourceWasmInterfaces = [];
                for (const emitter of this.resourceEmitters) {
                    resourceWasmInterfaces.push(`${nameProvider.type.name(emitter.resource)}.imports.WasmInterface`);
                }
                code.push(`export type WasmInterface = _.WasmInterface & ${resourceWasmInterfaces.join(' & ')};`);
            }
            else {
                code.push('export type WasmInterface = _.WasmInterface;');
            }
            code.decreaseIndent();
            code.push('}');
            code.push('export namespace exports {');
            code.increaseIndent();
            if (this.resourceEmitters.length > 0) {
                const resourceWasmInterfaces = [];
                for (const emitter of this.resourceEmitters) {
                    resourceWasmInterfaces.push(`${nameProvider.type.name(emitter.resource)}.exports.WasmInterface`);
                }
                code.push(`export type WasmInterface = _.WasmInterface & ${resourceWasmInterfaces.join(' & ')};`);
            }
            else {
                code.push('export type WasmInterface = _.WasmInterface;');
            }
            if (this.resourceEmitters.length > 0) {
                code.push('export namespace imports {');
                code.increaseIndent();
                code.push(`export type WasmInterface = {`);
                code.increaseIndent();
                for (const emitter of this.resourceEmitters) {
                    emitter.emitWasmExportImport(code);
                }
                code.decreaseIndent();
                code.push(`};`);
                code.decreaseIndent();
                code.push('}');
            }
            code.decreaseIndent();
            code.push(`}`);
        }
        code.decreaseIndent();
        code.push(`}`);
    }
    emitImport(code) {
        const { nameProvider } = this.context;
        const name = nameProvider.pack.name(this.getPkg());
        code.imports.add(name, `./${name}`);
    }
    emitWorldMember(code, scope) {
        const { symbols, nameProvider } = this.context;
        const name = wit_json_1.World.is(this.container) ? `${scope}.${nameProvider.iface.typeName(this.iface)}` : symbols.interfaces.getFullyQualifiedTypeName(this.iface);
        code.push(`${nameProvider.iface.propertyName(this.iface)}: ${name};`);
    }
    emitWorldWasmImport(code) {
        const { symbols } = this.context;
        const [name, version] = this.getQualifierAndVersion(this.getPkg());
        const property = `${name}/${this.iface.name}${version !== undefined ? `@${version}` : ''}`;
        code.push(`'${property}': ${symbols.interfaces.getFullyQualifiedModuleName(this.iface)}._.imports.WasmInterface;`);
    }
    emitWorldWasmExportImport(code) {
        const { symbols } = this.context;
        const [name, version] = this.getQualifierAndVersion(this.getPkg());
        const property = `[export]${name}/${this.iface.name}${version !== undefined ? `@${version}` : ''}`;
        code.push(`'${property}': ${symbols.interfaces.getFullyQualifiedModuleName(this.iface)}._.exports.imports.WasmInterface;`);
    }
    emitWorldWasmExport(code) {
        const [name, version] = this.getQualifierAndVersion(this.getPkg());
        const property = `${name}/${this.iface.name}${version !== undefined ? `@${version}` : ''}`;
        for (const func of this.functionEmitters) {
            func.emitWasmExport(code, property);
        }
        for (const resource of this.resourceEmitters) {
            resource.emitWasmExport(code);
        }
    }
    emitWorldCreateImport(code, result) {
        const { symbols, nameProvider } = this.context;
        const [name, version] = this.getQualifierAndVersion(this.getPkg());
        const property = `${name}/${this.iface.name}${version !== undefined ? `@${version}` : ''}`;
        code.push(`${result}['${property}'] = ${symbols.interfaces.getFullyQualifiedModuleName(this.iface)}._.imports.create(service.${nameProvider.iface.propertyName(this.iface)}, context);`);
    }
    emitWorldBindExport(code, result) {
        const { symbols, nameProvider } = this.context;
        const qualifier = `${symbols.interfaces.getFullyQualifiedModuleName(this.iface)}._`;
        code.push(`${result}.${nameProvider.iface.propertyName(this.iface)} = ${qualifier}.exports.bind(${qualifier}.exports.filter(exports, context), context);`);
    }
    getFullQualifiedTypeName() {
        const { nameProvider, options } = this.context;
        const ifaceName = nameProvider.iface.typeName(this.iface);
        if (options.singleWorld) {
            if (wit_json_1.Package.is(this.container)) {
                return ifaceName;
            }
            else {
                return `${nameProvider.world.name(this.container)}.${ifaceName}`;
            }
        }
        else {
            const pkg = nameProvider.pack.name(this.getPkg());
            if (wit_json_1.Package.is(this.container)) {
                return `${pkg}.${ifaceName}`;
            }
            else {
                return `${pkg}.${nameProvider.world.name(this.container)}.${ifaceName}`;
            }
        }
    }
    getQualifierAndVersion(pkg) {
        let name = pkg.name;
        let version;
        let index = name.lastIndexOf('@');
        if (index >= 0) {
            version = name.substring(index + 1);
            name = name.substring(0, index);
        }
        return [name, version];
    }
}
class MemberEmitter extends Emitter {
    container;
    member;
    owner;
    constructor(container, member, context) {
        super(context);
        this.container = container;
        this.member = member;
        this.owner = this.getOwner();
    }
    getOwner() {
        const { symbols } = this.context;
        const member = this.member;
        if (wit_json_1.Callable.is(member)) {
            if (wit_json_1.Callable.isFunction(member)) {
                return this.container;
            }
            else {
                const ref = wit_json_1.Callable.containingType(member);
                const type = symbols.getType(ref);
                if (wit_json_1.Type.isResourceType(type) && type.owner !== null) {
                    const result = symbols.resolveOwner(type.owner);
                    return wit_json_1.Interface.is(result) ? result : undefined;
                }
                else {
                    return undefined;
                }
            }
        }
        else {
            const result = member.owner !== null ? symbols.resolveOwner(member.owner) : undefined;
            return wit_json_1.Interface.is(result) ? result : undefined;
        }
    }
    getMergeQualifier() {
        if (this.owner === undefined) {
            return '';
        }
        return `${this.getOwnerName(this.owner)}.`;
    }
    getQualifier() {
        if (this.owner === undefined) {
            return '';
        }
        const { symbols, nameProvider, options } = this.context;
        let ownerName = this.getOwnerName(this.owner);
        if (wit_json_1.Interface.is(this.owner)) {
            // The interface is local to a world
            if (this.owner.world !== undefined) {
                const world = symbols.getWorld(this.owner.world.ref);
                ownerName = `${nameProvider.world.name(world)}.${this.owner.world.kind}.${ownerName}`;
            }
        }
        if (options.singleWorld) {
            return `${ownerName}.`;
        }
        else {
            const pkg = nameProvider.pack.name(symbols.getPackage(this.owner.package));
            return `${pkg}.${ownerName}.`;
        }
    }
    getOwnerName(owner) {
        const { nameProvider } = this.context;
        return wit_json_1.Interface.is(owner) ? nameProvider.iface.moduleName(owner) : nameProvider.world.name(owner);
    }
    getContainerName() {
        const { nameProvider } = this.context;
        return wit_json_1.Interface.is(this.container) ? nameProvider.iface.moduleName(this.container) : nameProvider.world.name(this.container);
    }
    emitErrorIfNecessary(code) {
        const { symbols, nameProvider } = this.context;
        if (wit_json_1.Member.isType(this.member) && symbols.isErrorResultType(this.member)) {
            const name = nameProvider.type.name(this.member);
            code.push(`export namespace ${name} {`);
            code.increaseIndent();
            code.push(`export class Error_ extends ${MetaModel.ResultError}<${name}> {`);
            code.increaseIndent();
            code.push(`constructor(cause: ${name}) {`);
            code.increaseIndent();
            code.push(`super(\`${name}: \${cause}\`, cause);`);
            code.decreaseIndent();
            code.push(`}`);
            code.decreaseIndent();
            code.push(`}`);
            code.decreaseIndent();
            code.push(`}`);
        }
    }
}
class FunctionEmitter extends MemberEmitter {
    func;
    callable;
    constructor(func, container, context) {
        super(container, func, context);
        this.func = func;
        this.callable = func;
    }
    getName() {
        return this.context.nameProvider.func.name(this.func);
    }
    doEmitNamespace(code, params, returnType, _exceptions) {
        if (returnType === undefined) {
            returnType = 'void';
        }
        const name = this.context.nameProvider.func.name(this.func);
        code.push(`export type ${name} = (${params.join(', ')}) => ${returnType};`);
    }
    emitTypeDeclaration(code) {
        const name = this.context.nameProvider.func.name(this.func);
        code.push(`${name}: ${this.getMergeQualifier()}${name};`);
    }
    doEmitMetaModel(code, params, result) {
        const name = this.context.nameProvider.func.name(this.func);
        if (params.length === 0) {
            code.push(`export const ${name} = new $wcm.FunctionType<${this.getTypeParam()}>('${this.func.name}', [], ${result});`);
        }
        else {
            code.push(`export const ${name} = new $wcm.FunctionType<${this.getTypeParam()}>('${this.func.name}',[`);
            code.increaseIndent();
            for (const [name, type] of params) {
                code.push(`['${name}', ${type}],`);
            }
            code.decreaseIndent();
            code.push(`], ${result});`);
        }
    }
    getTypeParam() {
        const name = this.context.nameProvider.func.name(this.func);
        const qualifier = this.getQualifier();
        return `${qualifier}${name}`;
    }
}
class WorldImportFunctionEmitter extends FunctionEmitter {
    constructor(func, world, context) {
        super(func, world, context);
    }
    getTypeParam() {
        const name = this.context.nameProvider.func.name(this.func);
        const qualifier = this.getMergeQualifier();
        return `${qualifier}Imports['${name}']`;
    }
}
class WorldExportFunctionEmitter extends FunctionEmitter {
    constructor(func, world, context) {
        super(func, world, context);
    }
    getTypeParam() {
        const name = this.context.nameProvider.func.name(this.func);
        const qualifier = this.getMergeQualifier();
        return `${qualifier}Exports['${name}']`;
    }
}
class InterfaceMemberEmitter extends MemberEmitter {
    constructor(container, member, context) {
        super(container, member, context);
    }
}
class TypeDeclarationEmitter extends MemberEmitter {
    type;
    constructor(type, container, context) {
        super(container, type, context);
        this.type = type;
        context.typeEmitters.set(type, this);
    }
    emitNamespace(code) {
        const { nameProvider, printers } = this.context;
        const name = nameProvider.type.name(this.type);
        this.emitDocumentation(this.type, code);
        code.push(`export type ${name} = ${printers.typeScript.print(this.type, TypeScript.TypePrinterContext.create(TypeUsage.typeDeclaration))};`);
    }
    emitMetaModel(code) {
        const { nameProvider, printers } = this.context;
        const name = nameProvider.type.name(this.type);
        code.push(`export const ${name} = ${printers.metaModel.print(this.type, TypeUsage.typeDeclaration)};`);
    }
}
class TypeReferenceEmitter extends MemberEmitter {
    type;
    constructor(type, container, context) {
        super(container, type, context);
        this.type = type;
        this.context.typeEmitters.set(type, this);
    }
    emitNamespace(code) {
        if (!wit_json_1.TypeKind.isReference(this.type.kind)) {
            throw new Error('Expected reference type');
        }
        const { nameProvider } = this.context;
        const referencedTypeName = this.getReferenceName(code, '');
        const tsName = nameProvider.type.name(this.type);
        this.emitDocumentation(this.type, code);
        code.push(`export type ${tsName} = ${referencedTypeName};`);
        const final = this.getFinalReferencedType();
        if (this.isReferencedTypeErrorResult() || wit_json_1.Type.isEnumType(final) || wit_json_1.Type.isVariantType(final) || wit_json_1.Type.isFlagsType(final)) {
            code.push(`export const ${tsName} = ${referencedTypeName};`);
        }
    }
    emitMetaModel(code) {
        const { nameProvider } = this.context;
        const referencedTypeName = this.getReferenceName(code, '$.');
        const tsName = nameProvider.type.name(this.type);
        code.push(`export const ${tsName} = ${referencedTypeName};`);
    }
    getReferenceName(code, separator) {
        const { nameProvider, symbols } = this.context;
        const referenced = this.getReferencedType();
        const referencedName = nameProvider.type.name(referenced);
        const qualifier = referenced.owner !== null ? this.computeQualifier(code, symbols.resolveOwner(referenced.owner)) : undefined;
        return qualifier !== undefined ? `${qualifier}.${separator}${referencedName}` : referencedName;
    }
    getReferencedType() {
        if (!wit_json_1.TypeKind.isReference(this.type.kind)) {
            throw new Error('Expected reference type');
        }
        const { symbols } = this.context;
        const referenced = symbols.getType(this.type.kind.type);
        if (wit_json_1.Type.hasName(referenced)) {
            return referenced;
        }
        throw new Error(`Cannot reference type ${JSON.stringify(referenced)} from ${JSON.stringify(this.container)}`);
    }
    getFinalReferencedType() {
        if (!wit_json_1.TypeKind.isReference(this.type.kind)) {
            throw new Error('Expected reference type');
        }
        const { symbols } = this.context;
        let referenced = symbols.getType(this.type.kind.type);
        while (wit_json_1.TypeKind.isReference(referenced.kind)) {
            referenced = symbols.getType(referenced.kind.type);
        }
        return referenced;
    }
    isReferencedTypeErrorResult() {
        if (!wit_json_1.Type.isReferenceType(this.type)) {
            throw new Error('Expected reference type');
        }
        const { symbols } = this.context;
        let type = this.type;
        while (!symbols.isErrorResultType(type) && wit_json_1.Type.isReferenceType(type)) {
            type = symbols.getType(type.kind.type);
        }
        return symbols.isErrorResultType(type);
    }
    computeQualifier(code, reference) {
        const scope = this.container;
        if (scope === reference) {
            return undefined;
        }
        const { nameProvider, symbols } = this.context;
        if (wit_json_1.World.is(scope) && wit_json_1.Interface.is(reference)) {
            if (scope.package === reference.package) {
                return `${nameProvider.iface.moduleName(reference)}`;
            }
        }
        else if (wit_json_1.Interface.is(scope) && wit_json_1.Interface.is(reference)) {
            if (scope.package === reference.package) {
                const { options } = this.context;
                if (options.singleWorld) {
                    return `${nameProvider.iface.moduleName(reference)}`;
                }
                else {
                    const referencedPackage = symbols.getPackage(reference.package);
                    const parts = nameProvider.pack.parts(referencedPackage);
                    return `${parts.name}.${nameProvider.iface.moduleName(reference)}`;
                }
            }
            else {
                const typePackage = symbols.getPackage(scope.package);
                const referencedPackage = symbols.getPackage(reference.package);
                const typeParts = nameProvider.pack.parts(typePackage);
                const referencedParts = nameProvider.pack.parts(referencedPackage);
                if (typeParts.namespace === referencedParts.namespace) {
                    const referencedTypeName = nameProvider.iface.moduleName(reference);
                    code.imports.add(referencedParts.name, `./${referencedParts.name}`);
                    return `${referencedParts.name}.${referencedTypeName}`;
                }
            }
        }
        throw new Error(`Cannot compute qualifier to import $import { type } into scope  ${JSON.stringify(scope)}.`);
    }
}
class RecordEmitter extends MemberEmitter {
    type;
    constructor(record, container, context) {
        super(container, record, context);
        this.type = record;
        this.context.typeEmitters.set(record, this);
    }
    emitNamespace(code) {
        const kind = this.type.kind;
        const { nameProvider, symbols, printers } = this.context;
        const name = nameProvider.type.name(this.type);
        this.emitDocumentation(this.type, code);
        code.push(`export type ${name} = {`);
        code.increaseIndent();
        for (const field of kind.record.fields) {
            this.emitDocumentation(field, code, true);
            const isOptional = wit_json_1.TypeReference.isString(field.type)
                ? false
                : wit_json_1.Type.isOptionType(symbols.getType(field.type));
            const fieldName = nameProvider.field.name(field);
            code.push(`${fieldName}${isOptional ? '?' : ''}: ${printers.typeScript.printTypeReference(field.type, TypeScript.TypePrinterContext.create(TypeUsage.property))};`);
        }
        code.decreaseIndent();
        code.push(`};`);
    }
    emitMetaModel(code) {
        const { nameProvider, printers } = this.context;
        const name = nameProvider.type.name(this.type);
        code.push(`export const ${name} = new $wcm.RecordType<${this.getQualifier()}${name}>([`);
        code.increaseIndent();
        for (const field of this.type.kind.record.fields) {
            const name = nameProvider.field.name(field);
            const type = printers.metaModel.printTypeReference(field.type, TypeUsage.property);
            code.push(`['${name}', ${type}],`);
        }
        code.decreaseIndent();
        code.push(`]);`);
    }
}
class VariantEmitter extends MemberEmitter {
    type;
    constructor(variant, container, context) {
        super(container, variant, context);
        this.type = variant;
        this.context.typeEmitters.set(variant, this);
    }
    emitNamespace(code) {
        function ensureVarName(name) {
            return name === 'delete' ? 'delete_' : name;
        }
        function asTagName(name) {
            if (name[0] === name[0].toLowerCase()) {
                return ensureVarName(name);
            }
            let isAllUpperCase = true;
            for (let i = 1; i < name.length; i++) {
                if (name[i] !== name[i].toUpperCase()) {
                    isAllUpperCase = false;
                    break;
                }
            }
            if (isAllUpperCase) {
                return ensureVarName(name.toLowerCase());
            }
            else {
                return ensureVarName(name[0].toLowerCase() + name.substring(1));
            }
        }
        const kind = this.type.kind;
        const { nameProvider, printers } = this.context;
        const variantName = nameProvider.type.name(this.type);
        this.emitDocumentation(this.type, code);
        code.push(`export namespace ${variantName} {`);
        code.increaseIndent();
        const cases = [];
        for (const item of kind.variant.cases) {
            const name = nameProvider.variant.caseName(item);
            const typeName = nameProvider.type.name(item);
            let type;
            if (item.type !== null) {
                type = printers.typeScript.printTypeReference(item.type, TypeScript.TypePrinterContext.create(TypeUsage.property));
            }
            else {
                type = undefined;
            }
            cases.push({ name, typeName, tagName: asTagName(name), type });
        }
        for (let i = 0; i < cases.length; i++) {
            this.emitDocumentation(kind.variant.cases[i], code, true);
            const c = cases[i];
            code.push(`export const ${c.tagName} = '${c.name}' as const;`);
            if (c.type !== undefined) {
                code.push(`export type ${c.typeName} = { readonly tag: typeof ${c.tagName}; readonly value: ${c.type} } & _common;`);
                code.push(`export function ${c.typeName}(value: ${c.type}): ${c.typeName} {`);
                code.increaseIndent();
                code.push(`return new VariantImpl(${c.tagName}, value) as ${c.typeName};`);
                code.decreaseIndent();
                code.push(`}`);
            }
            else {
                code.push(`export type ${c.typeName} = { readonly tag: typeof ${c.tagName} } & _common;`);
                code.push(`export function ${c.typeName}(): ${c.typeName} {`);
                code.increaseIndent();
                code.push(`return new VariantImpl(${c.tagName}, undefined) as ${c.typeName};`);
                code.decreaseIndent();
                code.push(`}`);
            }
            code.push('');
        }
        code.push(`export type _tt = ${cases.map(value => `typeof ${value.tagName}`).join(' | ')};`);
        let needsUndefined = false;
        const items = [];
        for (const c of cases) {
            if (c.type === undefined) {
                needsUndefined = true;
            }
            else {
                items.push(c.type);
            }
        }
        if (needsUndefined) {
            items.push('undefined');
        }
        code.push(`export type _vt = ${items.join(' | ')};`);
        code.push(`type _common = Omit<VariantImpl, 'tag' | 'value'>;`);
        code.push(`export function _ctor(t: _tt, v: _vt): ${variantName} {`);
        code.increaseIndent();
        code.push(`return new VariantImpl(t, v) as ${variantName};`);
        code.decreaseIndent();
        code.push(`}`);
        code.push(`class VariantImpl {`);
        code.increaseIndent();
        code.push(`private readonly _tag: _tt;`);
        code.push(`private readonly _value${needsUndefined ? '?' : ''}: _vt;`);
        code.push(`constructor(t: _tt, value: _vt) {`);
        code.increaseIndent();
        code.push(`this._tag = t;`);
        code.push(`this._value = value;`);
        code.decreaseIndent();
        code.push(`}`);
        code.push(`get tag(): _tt {`);
        code.increaseIndent();
        code.push(`return this._tag;`);
        code.decreaseIndent();
        code.push(`}`);
        code.push(`get value(): _vt {`);
        code.increaseIndent();
        code.push(`return this._value;`);
        code.decreaseIndent();
        code.push(`}`);
        for (let i = 0; i < cases.length; i++) {
            const c = cases[i];
            code.push(`is${c.typeName}(): this is ${c.typeName} {`);
            code.increaseIndent();
            code.push(`return this._tag === ${variantName}.${c.tagName};`);
            code.decreaseIndent();
            code.push(`}`);
        }
        // class
        code.decreaseIndent();
        code.push(`}`);
        //namespace
        code.decreaseIndent();
        code.push(`}`);
        code.push(`export type ${variantName} = ${cases.map(value => `${variantName}.${value.typeName}`).join(' | ')};`);
        this.emitErrorIfNecessary(code);
    }
    emitMetaModel(code) {
        const { nameProvider, printers } = this.context;
        const name = nameProvider.type.name(this.type);
        const cases = [];
        for (const item of this.type.kind.variant.cases) {
            const name = nameProvider.variant.caseName(item);
            const type = item.type === null ? 'undefined' : printers.metaModel.printTypeReference(item.type, TypeUsage.property);
            cases.push(`['${name}', ${type}]`);
        }
        const typeName = `${this.getQualifier()}${name}`;
        code.push(`export const ${name} = new $wcm.VariantType<${typeName}, ${typeName}._tt, ${typeName}._vt>([${cases.join(', ')}], ${typeName}._ctor);`);
    }
}
class EnumEmitter extends MemberEmitter {
    type;
    constructor(type, container, context) {
        super(container, type, context);
        this.type = type;
        this.context.typeEmitters.set(type, this);
    }
    emitNamespace(code) {
        const { nameProvider } = this.context;
        const kind = this.type.kind;
        const enumName = nameProvider.type.name(this.type);
        this.emitDocumentation(this.type, code);
        code.push(`export enum ${enumName} {`);
        code.increaseIndent();
        for (let i = 0; i < kind.enum.cases.length; i++) {
            const item = kind.enum.cases[i];
            const name = nameProvider.enumeration.caseName(item);
            this.emitDocumentation(kind.enum.cases[i], code, true);
            code.push(`${name} = '${name}'${i < kind.enum.cases.length - 1 ? ',' : ''}`);
        }
        code.decreaseIndent();
        code.push(`}`);
        this.emitErrorIfNecessary(code);
    }
    emitMetaModel(code) {
        const { nameProvider } = this.context;
        const enumName = nameProvider.type.name(this.type);
        const cases = [];
        for (const item of this.type.kind.enum.cases) {
            cases.push(`'${nameProvider.enumeration.caseName(item)}'`);
        }
        code.push(`export const ${enumName} = new $wcm.EnumType<${this.getQualifier()}${enumName}>([${cases.join(', ')}]);`);
    }
}
class FlagsEmitter extends MemberEmitter {
    type;
    constructor(flags, container, context) {
        super(container, flags, context);
        this.type = flags;
        this.context.typeEmitters.set(flags, this);
    }
    emitNamespace(code) {
        const { nameProvider } = this.context;
        const kind = this.type.kind;
        const flagsName = nameProvider.type.name(this.type);
        const flagSize = FlagsEmitter.getFlagSize(kind.flags.flags.length);
        this.emitDocumentation(this.type, code);
        code.push(`export const ${flagsName} = Object.freeze({`);
        code.increaseIndent();
        for (let i = 0; i < kind.flags.flags.length; i++) {
            const flag = kind.flags.flags[i];
            const name = nameProvider.flag.name(flag);
            this.emitDocumentation(flag, code, true);
            if (flagSize <= 4) {
                code.push(`${name}: 1 << ${i},`);
            }
            else {
                code.push(`${name}: 1n << ${i}n,`);
            }
        }
        code.decreaseIndent();
        code.push(`});`);
        switch (flagSize) {
            case 0:
            case 1:
            case 2:
            case 4:
                code.imports.addBaseType('u32');
                code.push(`export type ${flagsName} = u32;`);
                break;
            default:
                code.push(`export type ${flagsName} = bigint;`);
        }
    }
    emitMetaModel(code) {
        const { nameProvider } = this.context;
        const kind = this.type.kind;
        const flagsName = nameProvider.type.name(this.type);
        code.push(`export const ${flagsName} = new $wcm.FlagsType<${this.getQualifier()}${flagsName}>(${kind.flags.flags.length});`);
    }
    static getFlagSize(numberOfFlags) {
        if (numberOfFlags === 0) {
            return 0;
        }
        else if (numberOfFlags <= 8) {
            return 1;
        }
        else if (numberOfFlags <= 16) {
            return 2;
        }
        else {
            return 4 * this.num32Flags(numberOfFlags);
        }
    }
    static num32Flags(numberOfFlags) {
        return Math.ceil(numberOfFlags / 32);
    }
}
class ResourceEmitter extends InterfaceMemberEmitter {
    resource;
    conztructor;
    statics;
    methods;
    destructor;
    emitters;
    constructor(resource, iface, context) {
        super(iface, resource, context);
        this.resource = resource;
        this.conztructor = undefined;
        this.destructor = new ResourceEmitter.DestructorEmitter(resource, context);
        this.statics = [];
        this.methods = [];
        this.emitters = [];
        this.context.typeEmitters.set(resource, this);
    }
    get type() {
        return this.resource;
    }
    build() {
        const methods = this.context.symbols.getMethods(this.resource);
        if (methods !== undefined && methods.length >= 0) {
            for (const method of methods) {
                if (wit_json_1.Callable.isMethod(method)) {
                    const emitter = new ResourceEmitter.MethodEmitter(method, this.resource, this.context);
                    this.emitters.push(emitter);
                    this.methods.push(emitter);
                }
                else if (wit_json_1.Callable.isStaticMethod(method)) {
                    const emitter = new ResourceEmitter.StaticMethodEmitter(method, this.resource, this.context);
                    this.emitters.push(emitter);
                    this.statics.push(emitter);
                }
                else if (wit_json_1.Callable.isConstructor(method)) {
                    const emitter = new ResourceEmitter.ConstructorEmitter(method, this.resource, this.context);
                    this.emitters.push(emitter);
                    if (this.conztructor !== undefined) {
                        throw new Error(`Resource ${this.resource.name} has multiple constructors, which is not supported in JavaScript.`);
                    }
                    this.conztructor = emitter;
                }
            }
        }
    }
    getId() {
        const rName = this.resource.name;
        const iName = this.container.name;
        const pkg = this.context.symbols.getPackage(this.container.package);
        let pkgName = pkg.name;
        return `${pkgName}/${iName}/${rName}`;
    }
    hasConstructors() {
        return this.conztructor !== undefined;
    }
    emitNamespace(code) {
        const type = this.resource;
        const { nameProvider } = this.context;
        const tsName = nameProvider.type.name(type);
        const iName = `${tsName}.Interface`;
        code.push(`export namespace ${tsName} {`);
        code.increaseIndent();
        code.push(`export interface Interface extends ${MetaModel.Resource} {`);
        code.increaseIndent();
        for (const [index, method] of this.methods.entries()) {
            method.emitInterfaceDeclaration(code);
            if (index < this.methods.length - 1) {
                code.push();
            }
        }
        code.decreaseIndent();
        code.push(`}`);
        code.push(`export type Statics = {`);
        code.increaseIndent();
        if (this.conztructor !== undefined) {
            this.conztructor.emitStaticConstructorDeclaration(code);
        }
        for (const method of this.statics) {
            method.emitStaticsDeclaration(code);
        }
        code.decreaseIndent();
        code.push('};');
        code.push(`export type Class = Statics & {`);
        code.increaseIndent();
        if (this.conztructor !== undefined) {
            this.conztructor.emitConstructorDeclaration(code);
        }
        code.decreaseIndent();
        code.push(`};`);
        code.decreaseIndent();
        code.push(`}`);
        code.push(`export type ${tsName} = ${iName};`);
    }
    emitTypeDeclaration(code) {
        if (this.emitters.length === 0) {
            return;
        }
        const { nameProvider } = this.context;
        const container = this.getContainerName();
        const name = nameProvider.type.name(this.resource);
        code.push(`${name}: ${container}.${name}.Class;`);
    }
    emitMetaModel(code) {
        const { nameProvider } = this.context;
        const name = nameProvider.type.name(this.resource);
        code.push(`export const ${name} = new ${MetaModel.ResourceType}<${this.getQualifier()}${name}>('${this.resource.name}', '${this.getId()}');`);
        code.push(`export const ${name}_Handle = new ${MetaModel.ResourceHandleType}('${this.resource.name}');`);
    }
    emitMetaModelFunctions(code) {
        this.destructor.emitMetaModel(code);
        for (const emitter of this.emitters) {
            emitter.emitMetaModel(code);
        }
    }
    emitAPI(code) {
        const { nameProvider } = this.context;
        const name = nameProvider.type.name(this.resource);
        code.push(`export namespace ${name} {`);
        code.increaseIndent();
        code.push(`export type WasmInterface = {`);
        code.increaseIndent();
        for (const emitter of this.emitters) {
            emitter.emitWasmInterface(code);
        }
        code.decreaseIndent();
        code.push(`};`);
        code.push('export namespace imports {');
        code.increaseIndent();
        code.push(`export type WasmInterface = ${name}.WasmInterface & { ${this.destructor.getWasmImportSignature()} };`);
        code.decreaseIndent();
        code.push('}');
        code.push('export namespace exports {');
        code.increaseIndent();
        code.push(`export type WasmInterface = ${name}.WasmInterface & { ${this.destructor.getWasmExportSignature()} };`);
        code.decreaseIndent();
        code.push(`}`);
        code.decreaseIndent();
        code.push(`}`);
    }
    emitWasmExport(code) {
        const iName = this.container.name;
        const pkg = this.context.symbols.getPackage(this.container.package);
        const qualifier = `${pkg.name}/${iName}#`;
        for (const emitter of this.emitters) {
            emitter.emitWasmInterface(code, qualifier);
        }
    }
    emitWasmExportImport(code) {
        code.push(`'[resource-new]${this.resource.name}': (rep: i32) => i32;`);
        code.push(`'[resource-rep]${this.resource.name}': (handle: i32) => i32;`);
        code.push(`'[resource-drop]${this.resource.name}': (handle: i32) => void;`);
    }
    getImportDestructorSignature() {
        return `'[resource-drop]${this.resource.name}': (self: i32) => void`;
    }
}
(function (ResourceEmitter) {
    class ResourceElementEmitter extends Emitter {
        resource;
        constructor(resource, context) {
            super(context);
            this.resource = resource;
        }
        getPackageQualifier() {
            const type = this.resource;
            const { symbols, nameProvider } = this.context;
            if (type.owner === null) {
                return nameProvider.type.name(type);
            }
            const owner = symbols.resolveOwner(type.owner);
            if (wit_json_1.Interface.is(owner)) {
                const pkg = symbols.getPackage(owner.package);
                if (this.context.options.singleWorld) {
                    return `${nameProvider.iface.moduleName(owner)}.${nameProvider.type.name(type)}`;
                }
                else {
                    return `${nameProvider.pack.name(pkg)}.${nameProvider.iface.moduleName(owner)}.${nameProvider.type.name(type)}`;
                }
            }
            else {
                return nameProvider.type.name(type);
            }
        }
    }
    ResourceEmitter.ResourceElementEmitter = ResourceElementEmitter;
    class ResourceFunctionEmitter extends ResourceElementEmitter {
        method;
        constructor(method, resource, context) {
            super(resource, context);
            this.method = method;
        }
        doEmitNamespace() {
        }
        doEmitMetaModel(code, params, result) {
            const { nameProvider } = this.context;
            const methodName = this.getMethodName();
            const resourceName = nameProvider.type.name(this.resource);
            const typeParam = `${this.getPackageQualifier()}.${this.getTypeQualifier()}['${methodName}']`;
            const [addMethod, metaModelType] = this.getMetaModelInfo();
            if (params.length === 0) {
                code.push(`${resourceName}.${addMethod}('${methodName}', new $wcm.${metaModelType}<${typeParam}>('${this.method.name}', [], ${result}));`);
            }
            else {
                code.push(`${resourceName}.${addMethod}('${methodName}', new $wcm.${metaModelType}<${typeParam}>('${this.method.name}', [`);
                code.increaseIndent();
                for (const [name, type] of params) {
                    code.push(`['${name}', ${type}],`);
                }
                code.decreaseIndent();
                code.push(`], ${result}));`);
            }
        }
        getName() {
            return this.getMethodName();
        }
        getSignatureParts(start, omitReturn = false) {
            const { nameProvider, printers } = this.context;
            const params = [];
            const paramNames = [];
            for (let i = start; i < this.method.params.length; i++) {
                const param = this.method.params[i];
                const paramName = nameProvider.parameter.name(param);
                const paramType = printers.typeScript.printTypeReference(param.type, TypeScript.TypePrinterContext.create(TypeUsage.parameter));
                paramNames.push(paramName);
                params.push(`${paramName}: ${paramType}`);
            }
            let returnType = 'void';
            const context = TypeScript.TypePrinterContext.create(TypeUsage.witFunction);
            if (this.method.result !== undefined && omitReturn === false) {
                returnType = printers.typeScript.printTypeReference(this.method.result, context);
            }
            return [params, paramNames, returnType, context.errorClasses.length > 0 ? context.errorClasses : undefined];
        }
    }
    ResourceEmitter.ResourceFunctionEmitter = ResourceFunctionEmitter;
    class _MethodEmitter extends ResourceFunctionEmitter {
        callable;
        constructor(method, resource, context) {
            super(method, resource, context);
            this.callable = method;
        }
        getMethodName() {
            return this.context.nameProvider.method.name(this.callable);
        }
        getMetaModelInfo() {
            return ['addMethod', 'MethodType'];
        }
        getTypeQualifier() {
            return 'Interface';
        }
        emitInterfaceDeclaration(code) {
            const [params, , returnType, exceptions] = this.getSignatureParts(1);
            this.emitFunctionDocumentation(this.callable, code, exceptions);
            code.push(`${this.getMethodName()}(${params.join(', ')}): ${returnType};`);
        }
    }
    class _StaticMethodEmitter extends ResourceFunctionEmitter {
        callable;
        constructor(method, resource, context) {
            super(method, resource, context);
            this.callable = method;
        }
        getMethodName() {
            return this.context.nameProvider.method.staticName(this.callable);
        }
        getMetaModelInfo() {
            return ['addStaticMethod', 'StaticMethodType'];
        }
        getTypeQualifier() {
            return 'Statics';
        }
        emitStaticsDeclaration(code) {
            const [params, , returnType, exceptions] = this.getSignatureParts(0);
            this.emitFunctionDocumentation(this.callable, code, exceptions);
            code.push(`${this.getMethodName()}(${params.join(', ')}): ${returnType};`);
        }
    }
    class _ConstructorEmitter extends ResourceFunctionEmitter {
        callable;
        constructor(method, resource, context) {
            super(method, resource, context);
            this.callable = method;
        }
        getMethodName() {
            return this.context.nameProvider.method.constructorName(this.callable);
        }
        getMetaModelInfo() {
            return ['addConstructor', 'ConstructorType'];
        }
        getTypeQualifier() {
            return 'Class';
        }
        emitConstructorDeclaration(code) {
            const [params] = this.getSignatureParts(0, true);
            this.emitDocumentation(this.callable, code);
            code.push(`new(${params.join(', ')}): Interface;`);
        }
        emitStaticConstructorDeclaration(code) {
            const [params] = this.getSignatureParts(0, true);
            code.push(`$new?(${params.join(', ')}): Interface;`);
        }
    }
    class _DestructorEmitter extends ResourceElementEmitter {
        constructor(resource, context) {
            super(resource, context);
        }
        emitMetaModel(code) {
            const resourceName = this.context.nameProvider.type.name(this.resource);
            code.push(`${resourceName}.addDestructor('$drop', new $wcm.DestructorType('[resource-drop]${this.resource.name}', [['inst', ${resourceName}]]));`);
        }
        emitWasmInterface(code, qualifier = '') {
            code.push(`${qualifier}${this.getWasmImportSignature()};`);
        }
        getWasmImportSignature() {
            return `'[resource-drop]${this.resource.name}': (self: i32) => void`;
        }
        getWasmExportSignature() {
            return `'[dtor]${this.resource.name}': (self: i32) => void`;
        }
    }
    ResourceEmitter.ConstructorEmitter = CallableEmitter(_ConstructorEmitter);
    ResourceEmitter.DestructorEmitter = _DestructorEmitter;
    ResourceEmitter.StaticMethodEmitter = CallableEmitter(_StaticMethodEmitter);
    ResourceEmitter.MethodEmitter = CallableEmitter(_MethodEmitter);
})(ResourceEmitter || (ResourceEmitter = {}));
var TypeEmitter;
(function (TypeEmitter) {
    function create(type, container, context) {
        if (wit_json_1.Type.isRecordType(type)) {
            return new RecordEmitter(type, container, context);
        }
        else if (wit_json_1.Type.isVariantType(type)) {
            return new VariantEmitter(type, container, context);
        }
        else if (wit_json_1.Type.isEnumType(type)) {
            return new EnumEmitter(type, container, context);
        }
        else if (wit_json_1.Type.isFlagsType(type)) {
            return new FlagsEmitter(type, container, context);
        }
        else if (wit_json_1.TypeKind.isReference(type.kind)) {
            return new TypeReferenceEmitter(type, container, context);
        }
        else if (wit_json_1.Type.isResourceType(type)) {
            if (wit_json_1.Interface.is(container)) {
                const emitter = new ResourceEmitter(type, container, context);
                emitter.build();
                return emitter;
            }
            else {
                throw new Error('Resource type can only be declared in an interface.');
            }
        }
        else {
            return new TypeDeclarationEmitter(type, container, context);
        }
    }
    TypeEmitter.create = create;
})(TypeEmitter || (TypeEmitter = {}));
const MAX_FLAT_PARAMS = 16;
const MAX_FLAT_RESULTS = 1;
function CallableEmitter(base) {
    return class extends base {
        callable;
        parent;
        constructor(callable, parent, context) {
            super(callable, parent, context);
            this.callable = callable;
            this.parent = parent;
        }
        emitNamespace(code) {
            const [params, returnType, exceptions] = this.getParamsReturnAndExceptionType();
            this.emitFunctionDocumentation(this.callable, code, exceptions);
            this.doEmitNamespace(code, params, returnType, exceptions);
        }
        getParamsReturnAndExceptionType() {
            const params = [];
            for (const param of this.callable.params) {
                const paramName = this.context.nameProvider.parameter.name(param);
                params.push(`${paramName}: ${this.context.printers.typeScript.printTypeReference(param.type, TypeScript.TypePrinterContext.create(TypeUsage.parameter))}`);
            }
            const item = this.getReturnAndExceptionType(TypeUsage.witFunction);
            return [params, item.return, item.exceptions];
        }
        emitMetaModel(code) {
            const [params, returnType] = this.getMetaModelParamsAndReturnType();
            this.doEmitMetaModel(code, params, returnType);
        }
        getMetaModelParamsAndReturnType() {
            const { nameProvider } = this.context;
            const metaDataParams = [];
            const start = wit_json_1.Callable.isMethod(this.callable) ? 1 : 0;
            for (let i = start; i < this.callable.params.length; i++) {
                const param = this.callable.params[i];
                const paramName = this.context.nameProvider.parameter.name(param);
                const typeName = this.context.printers.metaModel.printTypeReference(param.type, TypeUsage.parameter);
                metaDataParams.push([paramName, typeName]);
            }
            let metaReturnType = undefined;
            if (wit_json_1.Callable.isConstructor(this.callable)) {
                const pName = nameProvider.type.name(this.parent);
                metaReturnType = `new ${MetaModel.OwnType}(${pName}_Handle)`;
            }
            else {
                if (this.callable.result !== undefined) {
                    metaReturnType = this.context.printers.metaModel.printTypeReference(this.callable.result, TypeUsage.witFunction);
                }
            }
            return [metaDataParams, metaReturnType];
        }
        emitWasmInterface(code, qualifier = '') {
            code.push(`'${qualifier}${this.callable.name}': ${this.getWasmSignature(code.imports)};`);
        }
        emitWasmExport(code, prefix) {
            code.push(`'${prefix}#${this.callable.name}': ${this.getWasmSignature(code.imports)};`);
        }
        emitWorldMember(code) {
            let [params, returnType, exceptions] = this.getParamsReturnAndExceptionType();
            if (returnType === undefined) {
                returnType = 'void';
            }
            this.emitFunctionDocumentation(this.callable, code, exceptions);
            code.push(`${this.getName()}: (${params.join(', ')}) => ${returnType};`);
        }
        emitWorldWasmImport(code) {
            code.push(`'${this.callable.name}': ${this.getWasmSignature(code.imports)};`);
        }
        emitWorldWasmExport(code) {
            code.push(`'${this.callable.name}': ${this.getWasmSignature(code.imports)};`);
        }
        getWasmSignature(imports) {
            const { typeFlattener } = this.context;
            const flattenedParams = typeFlattener.flattenParams(this.callable);
            let returnType;
            const flattenedResults = typeFlattener.flattenResult(this.callable);
            if (flattenedResults.length === 0) {
                returnType = 'void';
            }
            else if (flattenedResults.length <= MAX_FLAT_RESULTS) {
                returnType = flattenedResults[0];
            }
            else {
                returnType = 'void';
                imports.addBaseType('ptr');
                const result = this.getReturnAndExceptionType(TypeUsage.wasmFunction);
                flattenedParams.push({ name: 'result', type: `ptr<${result.return}>` });
            }
            if (flattenedParams.length <= MAX_FLAT_PARAMS) {
                return `(${flattenedParams.map(p => `${p.name}: ${p.type}`).join(', ')}) => ${returnType}`;
            }
            else {
                imports.addBaseType('ptr');
                const params = [];
                for (const param of this.callable.params) {
                    params.push(this.context.printers.metaModel.printTypeReference(param.type, TypeUsage.parameter));
                }
                return `(args: ptr<[${params.join(', ')}]>) => ${returnType}`;
            }
        }
        getReturnAndExceptionType(usage) {
            const result = { return: undefined, exceptions: undefined };
            const context = TypeScript.TypePrinterContext.create(usage);
            let returnType = undefined;
            if (this.callable.result !== undefined) {
                returnType = this.context.printers.typeScript.printTypeReference(this.callable.result, context);
            }
            result.return = returnType;
            result.exceptions = context.errorClasses.length > 0 ? context.errorClasses : undefined;
            return result;
        }
    };
}
//# sourceMappingURL=wit2ts.js.map