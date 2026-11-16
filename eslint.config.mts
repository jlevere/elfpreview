import { defineConfig } from "eslint/config";
import globals from "globals";
import eslint from "@eslint/js";
import ts from "typescript-eslint";
import svelte from "eslint-plugin-svelte";
import eslintConfigPrettier from "eslint-config-prettier/flat";

export default defineConfig([
  eslint.configs.recommended,
  ...ts.configs.recommendedTypeChecked,
  ...svelte.configs["flat/recommended"],
  eslintConfigPrettier,
  {
    files: ["**/*.svelte"],
    languageOptions: { parserOptions: { parser: ts.parser } },
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: [".svelte"],
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    ignores: ["**/elfpreview.ts"],
  },
]);
