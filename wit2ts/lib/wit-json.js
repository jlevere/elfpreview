"use strict";
/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Member = exports.TypeReference = exports.InterfaceObjectId = exports.ObjectKind = exports.TypeKind = exports.OwnerKind = exports.Owner = exports.Type = exports.Callable = exports.Interface = exports.Package = exports.World = void 0;
var World;
(function (World) {
    function is(value) {
        return typeof value === 'object'
            && typeof value.name === 'string'
            && typeof value.imports === 'object'
            && typeof value.exports === 'object'
            && typeof value.package === 'number';
    }
    World.is = is;
})(World || (exports.World = World = {}));
var Package;
(function (Package) {
    function is(value) {
        return typeof value === 'object'
            && typeof value.name === 'string'
            && typeof value.interfaces === 'object'
            && typeof value.worlds === 'object';
    }
    Package.is = is;
})(Package || (exports.Package = Package = {}));
var Interface;
(function (Interface) {
    function is(value) {
        return typeof value === 'object'
            && typeof value.name === 'string'
            && typeof value.types === 'object'
            && typeof value.functions === 'object'
            && typeof value.package === 'number';
    }
    Interface.is = is;
})(Interface || (exports.Interface = Interface = {}));
var Callable;
(function (Callable) {
    function isFunction(value) {
        const candidate = value;
        return candidate.kind === 'freestanding';
    }
    Callable.isFunction = isFunction;
    function isStaticMethod(value) {
        const candidate = value;
        return typeof candidate.kind === 'object' && typeof candidate.kind.static === 'number';
    }
    Callable.isStaticMethod = isStaticMethod;
    function isConstructor(value) {
        const candidate = value;
        return typeof candidate.kind === 'object' && typeof candidate.kind.constructor === 'number';
    }
    Callable.isConstructor = isConstructor;
    function isMethod(value) {
        const candidate = value;
        return typeof candidate.kind === 'object' && typeof candidate.kind.method === 'number';
    }
    Callable.isMethod = isMethod;
    function is(value) {
        return isFunction(value) || isStaticMethod(value) || isConstructor(value) || isMethod(value);
    }
    Callable.is = is;
    function containingType(value) {
        if (isMethod(value)) {
            return value.kind.method;
        }
        else if (isStaticMethod(value)) {
            return value.kind.static;
        }
        else if (isConstructor(value)) {
            return value.kind.constructor;
        }
        throw new Error(`Unknown callable kind ${JSON.stringify(value)}`);
    }
    Callable.containingType = containingType;
})(Callable || (exports.Callable = Callable = {}));
var Type;
(function (Type) {
    function isBaseType(type) {
        return TypeKind.isBase(type.kind);
    }
    Type.isBaseType = isBaseType;
    function isReferenceType(type) {
        return TypeKind.isReference(type.kind);
    }
    Type.isReferenceType = isReferenceType;
    function isListType(type) {
        return TypeKind.isList(type.kind);
    }
    Type.isListType = isListType;
    function isOptionType(type) {
        return TypeKind.isOption(type.kind);
    }
    Type.isOptionType = isOptionType;
    function isTupleType(type) {
        return TypeKind.isTuple(type.kind);
    }
    Type.isTupleType = isTupleType;
    function isResultType(type) {
        return TypeKind.isResult(type.kind);
    }
    Type.isResultType = isResultType;
    function isResourceType(type) {
        return TypeKind.isResource(type.kind);
    }
    Type.isResourceType = isResourceType;
    function isRecordType(type) {
        return TypeKind.isRecord(type.kind);
    }
    Type.isRecordType = isRecordType;
    function isEnumType(type) {
        return TypeKind.isEnum(type.kind);
    }
    Type.isEnumType = isEnumType;
    function isFlagsType(type) {
        return TypeKind.isFlags(type.kind);
    }
    Type.isFlagsType = isFlagsType;
    function isVariantType(type) {
        return TypeKind.isVariant(type.kind);
    }
    Type.isVariantType = isVariantType;
    function isBorrowHandleType(type) {
        return TypeKind.isBorrowHandle(type.kind);
    }
    Type.isBorrowHandleType = isBorrowHandleType;
    function isOwnHandleType(type) {
        return TypeKind.isOwnHandle(type.kind);
    }
    Type.isOwnHandleType = isOwnHandleType;
    function hasName(type) {
        return typeof type.name === 'string';
    }
    Type.hasName = hasName;
    function is(value) {
        return isBaseType(value) || isReferenceType(value) || isListType(value) || isOptionType(value) || isTupleType(value) || isResultType(value) || isRecordType(value) || isEnumType(value) || isFlagsType(value) || isVariantType(value) || isResourceType(value) || isBorrowHandleType(value) || isOwnHandleType(value);
    }
    Type.is = is;
})(Type || (exports.Type = Type = {}));
var Owner;
(function (Owner) {
    function isWorld(owner) {
        return typeof owner.world === 'number';
    }
    Owner.isWorld = isWorld;
    function isInterface(owner) {
        return typeof owner.interface === 'number';
    }
    Owner.isInterface = isInterface;
    function kind(owner) {
        if (isWorld(owner)) {
            return OwnerKind.World;
        }
        else if (isInterface(owner)) {
            return OwnerKind.Interface;
        }
        else {
            throw new Error(`Unknown owner kind ${JSON.stringify(owner)}`);
        }
    }
    Owner.kind = kind;
})(Owner || (exports.Owner = Owner = {}));
var OwnerKind;
(function (OwnerKind) {
    OwnerKind["World"] = "world";
    OwnerKind["Interface"] = "interface";
})(OwnerKind || (exports.OwnerKind = OwnerKind = {}));
var TypeKind;
(function (TypeKind) {
    function isBase(kind) {
        return typeof kind.type === 'string';
    }
    TypeKind.isBase = isBase;
    function isReference(kind) {
        return typeof kind.type === 'number';
    }
    TypeKind.isReference = isReference;
    function isTypeObject(kind) {
        const candidate = kind;
        return typeof candidate.type === 'number' || typeof candidate.type === 'string';
    }
    TypeKind.isTypeObject = isTypeObject;
    function isRecord(kind) {
        return typeof kind.record === 'object';
    }
    TypeKind.isRecord = isRecord;
    function isVariant(kind) {
        const candidate = kind;
        return typeof candidate.variant === 'object';
    }
    TypeKind.isVariant = isVariant;
    function isEnum(kind) {
        const candidate = kind;
        return typeof candidate.enum === 'object';
    }
    TypeKind.isEnum = isEnum;
    function isFlags(kind) {
        const candidate = kind;
        return typeof candidate.flags === 'object';
    }
    TypeKind.isFlags = isFlags;
    function isTuple(kind) {
        const candidate = kind;
        return typeof candidate.tuple === 'object';
    }
    TypeKind.isTuple = isTuple;
    function isList(kind) {
        const candidate = kind;
        return typeof candidate.list === 'number' || typeof candidate.list === 'string';
    }
    TypeKind.isList = isList;
    function isOption(kind) {
        const candidate = kind;
        return typeof candidate.option === 'number' || typeof candidate.option === 'string';
    }
    TypeKind.isOption = isOption;
    function isResult(kind) {
        const candidate = kind;
        const ok = candidate.result?.ok;
        const err = candidate.result?.err;
        return (ok !== undefined && (typeof ok === 'number' || typeof ok === 'string' || ok === null))
            && (err !== undefined && (typeof err === 'number' || typeof err === 'string' || err === null));
    }
    TypeKind.isResult = isResult;
    function isBorrowHandle(kind) {
        const candidate = kind;
        return typeof candidate.handle === 'object' && TypeReference.is(candidate.handle.borrow);
    }
    TypeKind.isBorrowHandle = isBorrowHandle;
    function isOwnHandle(kind) {
        const candidate = kind;
        return typeof candidate.handle === 'object' && TypeReference.is(candidate.handle.own);
    }
    TypeKind.isOwnHandle = isOwnHandle;
    function isResource(kind) {
        return kind === 'resource';
    }
    TypeKind.isResource = isResource;
})(TypeKind || (exports.TypeKind = TypeKind = {}));
var ObjectKind;
(function (ObjectKind) {
    function isTypeObject(kind) {
        return typeof kind.type === 'number';
    }
    ObjectKind.isTypeObject = isTypeObject;
    function isFuncObject(kind) {
        return typeof kind.function === 'object';
    }
    ObjectKind.isFuncObject = isFuncObject;
    function isInterfaceObject(kind) {
        return InterfaceObjectId.is(kind.interface);
    }
    ObjectKind.isInterfaceObject = isInterfaceObject;
})(ObjectKind || (exports.ObjectKind = ObjectKind = {}));
var InterfaceObjectId;
(function (InterfaceObjectId) {
    function isNumber(value) {
        return typeof value === 'number';
    }
    InterfaceObjectId.isNumber = isNumber;
    function isId(value) {
        return typeof value === 'object' && typeof value.id === 'number';
    }
    InterfaceObjectId.isId = isId;
    function is(value) {
        return isNumber(value) || isId(value);
    }
    InterfaceObjectId.is = is;
})(InterfaceObjectId || (exports.InterfaceObjectId = InterfaceObjectId = {}));
var TypeReference;
(function (TypeReference) {
    function is(value) {
        const candidate = value;
        return isNumber(candidate) || isString(candidate);
    }
    TypeReference.is = is;
    function isNumber(ref) {
        return typeof ref === 'number';
    }
    TypeReference.isNumber = isNumber;
    function isString(ref) {
        return typeof ref === 'string';
    }
    TypeReference.isString = isString;
})(TypeReference || (exports.TypeReference = TypeReference = {}));
var Member;
(function (Member) {
    function isCallable(member) {
        const candidate = member;
        return Callable.is(candidate);
    }
    Member.isCallable = isCallable;
    function isType(member) {
        const candidate = member;
        return Type.is(candidate);
    }
    Member.isType = isType;
})(Member || (exports.Member = Member = {}));
//# sourceMappingURL=wit-json.js.map