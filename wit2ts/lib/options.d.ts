export type Options = {
    help: boolean;
    version: boolean;
    outDir: string | undefined;
    filter: string | undefined;
    input: string | undefined;
    target: 'ts';
    nameStyle: 'ts' | 'wit';
    stdin: boolean;
    structure: 'auto' | 'package' | 'namespace';
    singleWorld: boolean;
    keep?: {
        result: boolean;
        option: boolean;
        own: boolean;
        borrow: boolean;
    };
};
export type ResolvedOptions = Required<Options> & {
    input: string;
    outDir: string;
};
export declare namespace Options {
    const defaults: Options;
    function validate(options: Options): options is ResolvedOptions;
}
//# sourceMappingURL=options.d.ts.map