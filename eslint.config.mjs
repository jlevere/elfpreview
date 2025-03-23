import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
    {
        files: ["**/*.ts"],
        plugins: {
            "@typescript-eslint": typescriptEslint,
        },
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: "module",
                project: "./ts/tsconfig.json",
            },
        },
        rules: {
            "@typescript-eslint/naming-convention": [
                "warn",
                {
                    selector: "import",
                    format: ["camelCase", "PascalCase"],
                },
                {
                    selector: "variable",
                    format: ["camelCase", "UPPER_CASE", "PascalCase"],
                },
                {
                    selector: "function",
                    format: ["camelCase", "PascalCase"],
                },
                {
                    selector: "typeLike",
                    format: ["PascalCase"],
                },
            ],
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/explicit-function-return-type": "off",
            "semi": "warn",

            "curly": "warn",
            "eqeqeq": "warn",
            "no-throw-literal": "warn",
            "semi": "off",
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": "warn",
        },
    },

    {
        files: ["**/elfpreview.ts"],
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/naming-convention": "off",
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": "off",
            "@typescript-eslint/no-non-null-assertion": "off",
            "@typescript-eslint/ban-ts-comment": "off",
        },
    },

    {
        files: ["**/extension/**/*.ts"],
        rules: {
            "@typescript-eslint/no-non-null-assertion": "off",
        },
    },

    {
        ignores: ["**/*.rs", "**/*.wit"],
    },

    {
        files: ["**/wasm/**/*.js"],
        rules: {
            "no-undef": "off",
            "no-unused-vars": "off",
        },
    },
];