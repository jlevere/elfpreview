"use strict";
/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Options = void 0;
var Options;
(function (Options) {
    Options.defaults = {
        help: false,
        version: false,
        outDir: undefined,
        filter: undefined,
        input: undefined,
        target: 'ts',
        nameStyle: 'ts',
        stdin: false,
        structure: 'auto',
        singleWorld: false
    };
    function validate(options) {
        if (options.stdin === false && !options.input) {
            process.stderr.write('Missing file argument.\n');
            return false;
        }
        if (!options.outDir) {
            process.stderr.write('Missing outDir argument.\n');
            return false;
        }
        if (!options.keep) {
            options.keep = { result: false, option: false, own: false, borrow: false };
        }
        return true;
    }
    Options.validate = validate;
})(Options || (exports.Options = Options = {}));
//# sourceMappingURL=options.js.map