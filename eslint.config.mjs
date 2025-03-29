import { defineConfig } from "eslint/config";
import globals from "globals";
import eslint from "@eslint/js";
import ts from "typescript-eslint";
import svelte from "eslint-plugin-svelte";


export default defineConfig([
  eslint.configs.recommended,
  ...ts.configs.recommendedTypeChecked,
  ...svelte.configs["flat/recommended"],
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  },
  {
    ignores: [
      "**/elfpreview.ts",
    ]
  }
]);