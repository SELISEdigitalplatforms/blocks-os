import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
  { ignores: ["node_modules/**", "dist/**", "coverage/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
    settings: {
      react: { version: "detect" },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      react,
      "react-hooks": reactHooks,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // Confirmed false positives, disabled with justification (see CONTRIBUTING.md):
      // - react/prop-types is redundant in this TypeScript codebase; props are
      //   type-checked by the compiler, so the rule only fires on typed components.
      // - react/no-unknown-property allows the cmdk library's DOM data attribute.
      "react/no-unknown-property": ["error", { ignore: ["cmdk-input-wrapper"] }],
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
      "no-unused-vars": "off",
      "no-console": ["error", { allow: ["error"] }],
      "@typescript-eslint/no-empty-object-type": [
        "error",
        { allowInterfaces: "with-single-extends" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Naming conventions. Kept intentionally permissive to match the code that exists today
      // (see CONTRIBUTING.md for the target conventions); ratchet toward stricter formats over time.
      // Object/property/import names are left unchecked because they mirror server wire fields.
      "@typescript-eslint/naming-convention": [
        "warn",
        {
          selector: "variableLike",
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
        },
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
        {
          // Enums in this repo use both PascalCase and UPPER_CASE names; allow both for now.
          selector: "enum",
          format: ["PascalCase", "UPPER_CASE"],
        },
        {
          selector: "interface",
          format: ["PascalCase"],
          // Some interfaces use an I prefix, some do not; do not force either yet.
        },
        {
          selector: ["property", "objectLiteralProperty", "typeProperty", "enumMember"],
          format: null,
        },
        {
          selector: "import",
          format: null,
        },
      ],
    },
  },
  prettier,
];
