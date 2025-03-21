export interface Document {
    worlds: World[];
    interfaces: Interface[];
    types: Type[];
    packages: Package[];
}
export interface Documentation {
    contents: string | null;
}
export interface World {
    name: string;
    docs?: Documentation | undefined;
    imports: NameMap<ObjectKind>;
    exports: NameMap<ObjectKind>;
    package: number;
}
export declare namespace World {
    function is(value: any): value is World;
}
export interface PackageNameParts {
    namespace?: string | undefined;
    name: string;
    version?: string | undefined;
}
export interface Package {
    name: string;
    docs?: Documentation | undefined;
    interfaces: References;
    worlds: References;
}
export declare namespace Package {
    function is(value: any): value is Package;
}
export interface Interface {
    name: string;
    docs?: Documentation;
    types: References;
    functions: NameMap<Callable>;
    world?: {
        ref: number;
        kind: 'imports' | 'exports';
    };
    package: number;
}
export declare namespace Interface {
    function is(value: any): value is Interface;
}
export type Callable = Func | Method | StaticMethod | Constructor;
export declare namespace Callable {
    function isFunction(value: Callable): value is Func;
    function isStaticMethod(value: Callable): value is StaticMethod;
    function isConstructor(value: Callable): value is Constructor;
    function isMethod(value: Callable): value is Method;
    function is(value: any): value is Callable;
    function containingType(value: Method | StaticMethod | Constructor): number;
}
interface AbstractCallable {
    name: string;
    docs?: Documentation | undefined;
    params: Param[];
    result?: TypeReference | undefined;
}
export interface Func extends AbstractCallable {
    kind: 'freestanding';
}
export interface StaticMethod extends AbstractCallable {
    kind: {
        static: number;
    };
}
export interface Constructor extends AbstractCallable {
    kind: {
        constructor: number;
    };
}
export interface Method extends AbstractCallable {
    kind: {
        method: number;
    };
}
export type Type = BaseType | ReferenceType | ListType | OptionType | TupleType | ResultType | RecordType | EnumType | FlagsType | VariantType | ResourceType | BorrowHandleType | OwnHandleType;
export declare namespace Type {
    function isBaseType(type: Type): type is BaseType;
    function isReferenceType(type: Type): type is ReferenceType;
    function isListType(type: Type): type is ListType;
    function isOptionType(type: Type): type is OptionType;
    function isTupleType(type: Type): type is TupleType;
    function isResultType(type: Type): type is ResultType;
    function isResourceType(type: Type): type is ResourceType;
    function isRecordType(type: Type): type is RecordType;
    function isEnumType(type: Type): type is EnumType;
    function isFlagsType(type: Type): type is FlagsType;
    function isVariantType(type: Type): type is VariantType;
    function isBorrowHandleType(type: Type): type is BorrowHandleType;
    function isOwnHandleType(type: Type): type is OwnHandleType;
    function hasName(type: Type): type is Type & {
        name: string;
    };
    function is(value: any): value is Type;
}
export interface AbstractType {
    name: string | null;
    docs?: Documentation | undefined;
    owner: Owner | null;
}
export interface BaseType extends AbstractType {
    kind: BaseKind;
}
export interface ReferenceType extends AbstractType {
    kind: ReferenceKind;
}
export interface ListType extends AbstractType {
    kind: ListKind;
}
export interface OptionType extends AbstractType {
    kind: OptionKind;
}
export interface TupleType extends AbstractType {
    kind: TupleKind;
}
export interface ResultType extends AbstractType {
    kind: ResultKind;
}
export interface RecordType extends AbstractType {
    kind: RecordKind;
}
export interface EnumType extends AbstractType {
    kind: EnumKind;
}
export interface FlagsType extends AbstractType {
    kind: FlagsKind;
}
export interface VariantType extends AbstractType {
    kind: VariantKind;
}
export interface BorrowHandleType extends AbstractType {
    kind: BorrowHandleKind;
}
export interface OwnHandleType extends AbstractType {
    kind: OwnHandleKind;
}
export interface ResourceType extends AbstractType {
    kind: 'resource';
}
export declare namespace Owner {
    function isWorld(owner: Owner): owner is {
        world: number;
    };
    function isInterface(owner: Owner): owner is {
        interface: number;
    };
    function kind(owner: Owner): OwnerKind;
}
export type Owner = {
    world: number;
} | {
    interface: number;
};
export declare enum OwnerKind {
    World = "world",
    Interface = "interface"
}
export type TypeKind = TypeObject | RecordKind | VariantKind | EnumKind | FlagsKind | TupleKind | ListKind | OptionKind | BorrowHandleKind | OwnHandleKind | ResultKind | BaseKind | ReferenceKind | 'resource';
export declare namespace TypeKind {
    function isBase(kind: TypeKind): kind is BaseKind;
    function isReference(kind: TypeKind): kind is ReferenceKind;
    function isTypeObject(kind: TypeKind): kind is TypeObject;
    function isRecord(kind: TypeKind): kind is RecordKind;
    function isVariant(kind: TypeKind): kind is VariantKind;
    function isEnum(kind: TypeKind): kind is EnumKind;
    function isFlags(kind: TypeKind): kind is FlagsKind;
    function isTuple(kind: TypeKind): kind is TupleKind;
    function isList(kind: TypeKind): kind is ListKind;
    function isOption(kind: TypeKind): kind is OptionKind;
    function isResult(kind: TypeKind): kind is ResultKind;
    function isBorrowHandle(kind: TypeKind): kind is BorrowHandleKind;
    function isOwnHandle(kind: TypeKind): kind is OwnHandleKind;
    function isResource(kind: TypeKind): kind is 'resource';
}
export interface BaseKind {
    type: string;
}
export interface ReferenceKind {
    type: number;
}
export interface RecordKind {
    record: {
        fields: Field[];
    };
}
export interface Field {
    name: string;
    docs: Documentation;
    type: TypeReference;
}
export interface VariantKind {
    variant: {
        cases: VariantCase[];
    };
}
export interface VariantCase {
    name: string;
    docs: Documentation;
    type: TypeReference | null;
}
export interface EnumKind {
    enum: {
        cases: EnumCase[];
    };
}
export interface EnumCase {
    name: string;
    docs: Documentation;
}
export interface FlagsKind {
    flags: {
        flags: Flag[];
    };
}
export interface Flag {
    name: string;
    docs: Documentation;
}
export interface TupleKind {
    tuple: {
        types: TypeReference[];
    };
}
export interface ListKind {
    list: TypeReference;
}
export interface OptionKind {
    option: TypeReference;
}
export interface ResultKind {
    result: {
        ok: TypeReference | null;
        err: TypeReference | null;
    };
}
export interface BorrowHandleKind {
    handle: {
        borrow: TypeReference;
    };
}
export interface OwnHandleKind {
    handle: {
        own: TypeReference;
    };
}
export type ObjectKind = TypeObject | FuncObject | InterfaceObject;
export declare namespace ObjectKind {
    function isTypeObject(kind: ObjectKind): kind is TypeObject;
    function isFuncObject(kind: ObjectKind): kind is FuncObject;
    function isInterfaceObject(kind: ObjectKind): kind is InterfaceObject;
}
export interface TypeObject {
    type: number | string;
}
export interface FuncObject {
    function: Func;
}
export type InterfaceObjectId = number | {
    id: number;
};
export declare namespace InterfaceObjectId {
    function isNumber(value: InterfaceObjectId): value is number;
    function isId(value: InterfaceObjectId): value is {
        id: number;
    };
    function is(value: InterfaceObjectId): value is {
        id: number;
    };
}
export interface InterfaceObject {
    interface: InterfaceObjectId;
}
export type TypeReference = number | string;
export declare namespace TypeReference {
    function is(value: TypeReference | Type): value is TypeReference;
    function isNumber(ref: TypeReference): ref is number;
    function isString(ref: TypeReference): ref is string;
}
export interface Param {
    name: string;
    type: TypeReference;
}
export type References = NameMap<number>;
export interface NameMap<T> {
    [name: string]: T;
}
export declare namespace Member {
    function isCallable(member: Callable | Type): member is Callable;
    function isType(member: Callable | Type): member is Type;
}
export {};
//# sourceMappingURL=wit-json.d.ts.map