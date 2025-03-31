import { defineConfig } from "eslint/config";
import globals from "globals";
import eslint from "@eslint/js";
import ts from "typescript-eslint";
import svelteConfig from "@sveltejs/eslint-config";
import eslintConfigPrettier from "eslint-config-prettier/flat";

export default defineConfig([
  eslint.configs.recommended,
  ...ts.configs.recommendedTypeChecked,
  ...svelteConfig,
  eslintConfigPrettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
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
