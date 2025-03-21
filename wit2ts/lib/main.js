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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const cp = __importStar(require("node:child_process"));
const fs = __importStar(require("node:fs/promises"));
const yargs = __importStar(require("yargs"));
const semverParse = require("semver/functions/parse");
const semverGte = require("semver/functions/gte");
const node_path_1 = __importDefault(require("node:path"));
const options_1 = require("./options");
const wit2ts_1 = require("./wit2ts");
async function run(options) {
    if (options.help) {
        return 0;
    }
    if (options.version) {
        process.stdout.write(`${require('../../package.json').version}\n`);
        return 0;
    }
    if (!options_1.Options.validate(options)) {
        yargs.showHelp();
        return 1;
    }
    else {
    }
    try {
        if (options.stdin) {
            let data = '';
            process.stdin.on('data', async (chunk) => {
                data = data + chunk.toString();
            });
            process.stdin.on('end', async () => {
                const content = JSON.parse(data);
                (0, wit2ts_1.processDocument)(content, options);
            });
        }
        else {
            const stat = await fs.stat(options.input, { bigint: true });
            if (stat.isFile() && node_path_1.default.extname(options.input) === '.json') {
                const content = JSON.parse(await fs.readFile(options.input, { encoding: 'utf8' }));
                (0, wit2ts_1.processDocument)(content, options);
            }
            else if (stat.isDirectory() || stat.isFile() && node_path_1.default.extname(options.input) === '.wit') {
                try {
                    const output = cp.execFileSync('wasm-tools', ['--version'], { shell: true, encoding: 'utf8' });
                    const version = output.trim().split(' ')[1];
                    const semVersion = semverParse(version);
                    if (semVersion === null) {
                        process.stderr.write(`wasm-tools --version didn't provide a parsable version number. Output was ${output}.\n`);
                        return 1;
                    }
                    else if (!semverGte(semVersion, '1.226.0')) {
                        process.stderr.write(`wit2ts required wasm-tools >= 1.226.0, but found version ${version}.\n`);
                        return 1;
                    }
                    let data;
                    try {
                        data = cp.execFileSync('wasm-tools', ['component', 'wit', '--json', options.input], { shell: true, encoding: 'utf8' });
                    }
                    catch (error) {
                        // The wasm-tools reported an error and wrote to output to stderr. So
                        // we simply return a failure.
                        return 1;
                    }
                    const content = JSON.parse(data);
                    (0, wit2ts_1.processDocument)(content, options);
                }
                catch (error) {
                    process.stderr.write(`Failed to process document\n${error.stack}\n`);
                    return 1;
                }
            }
            else {
                process.stderr.write(`${options.input} doesn't exist.\n`);
                return 1;
            }
        }
        return 0;
    }
    catch (error) {
        process.stderr.write(`Creating TypeScript file failed\n${error.toString()}\n`);
        return 1;
    }
}
async function main() {
    yargs.
        parserConfiguration({ 'camel-case-expansion': false }).
        exitProcess(false).
        usage(`Tool to generate a TypeScript file and the corresponding meta data from a WIT JSON file.\nVersion: ${require('../../package.json').version}\nUsage: wit2ts [options] [wasi.json]`).
        example(`wit2ts --outDir . wasi.json`, `Creates a TypeScript file for the given Wit JSON file and writes the files into the provided output directory.`).
        example(`wit2ts --outDir . ./wit`, `Creates a TypeScript file for the files in the given wit directory and writes the files into the provided output directory. Requires a wasm-tools installation.`).
        version(false).
        wrap(Math.min(100, yargs.terminalWidth())).
        option('v', {
        alias: 'version',
        description: 'Output the version number',
        boolean: true
    }).
        option('h', {
        alias: 'help',
        description: 'Output usage information',
        boolean: true,
    }).
        option('outDir', {
        description: 'The directory the TypeScript files are written to.',
        string: true
    }).
        option('filter', {
        description: 'A regular expression to filter the packages to be included.',
        string: true
    }).
        option('target', {
        description: 'The target language. Currently only TypeScript is supported.',
        enum: ['ts'],
        default: 'ts'
    }).
        option('nameStyle', {
        description: 'The style of the generated names.',
        enum: ['ts', 'wit'],
        default: 'ts'
    }).
        option('stdin', {
        description: 'Read the input from stdin.',
        boolean: true,
        default: false
    }).
        option('structure', {
        description: 'By default wit2ts only generate the structure necessary to make names unique. This options force wit2ts to generate the package and or namespace names, even if they are not necessary.',
        enum: ['auto', 'package', 'namespace'],
        default: 'auto'
    }).
        command('$0 [input]', 'Process the JSON file or WIT directory', (yargs) => {
        yargs.positional('input', {
            describe: 'File or directory to process',
            type: 'string',
            demandOption: false
        });
    }).
        strict();
    const parsed = await yargs.argv;
    const options = Object.assign({}, options_1.Options.defaults, parsed);
    return run(options);
}
if (module === require.main) {
    main().then((exitCode) => process.exitCode = exitCode).catch((error) => { process.exitCode = 1; process.stderr.write(`${error.toString()}`); });
}
//# sourceMappingURL=main.js.map