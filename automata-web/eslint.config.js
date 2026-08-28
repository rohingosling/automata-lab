// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    ESLint Configuration
// Version: 1.0.0
// Date:    2026-08-06
// Author:  Rohin Gosling
//
// Description:
//
//   Applies the TypeScript and React correctness rules used by source and tests.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import eslint from "@eslint/js";
import babelParser from "@babel/eslint-parser";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
    {
        ignores:
        [
            "dist/**",
            "node_modules/**",
            "playwright-report/**",
            "src/infrastructure/files/generated/**",
            "test-results/**",
        ],
    },
    eslint.configs.recommended,
    {
        files: [
            "src/**/*.{ts,tsx}",
            "tests/**/*.{ts,tsx}",
            "playwright.config.ts",
            "vite.config.ts",
            "vitest.config.ts",
        ],
        languageOptions:
        {
            parser: babelParser,
            parserOptions:
            {
                babelOptions:
                {
                    presets: [ "@babel/preset-typescript", "@babel/preset-react" ],
                },
                requireConfigFile: false,
            },
        },
        plugins:
        {
            "react-hooks":   reactHooks,
            "react-refresh": reactRefresh,
        },
        rules:
        {
            ...reactHooks.configs.flat.recommended.rules,
            "no-undef": "off",
            "no-unused-vars": "off",
            "react-refresh/only-export-components": [ "warn", { allowConstantExport: true } ],
        },
    },
    {
        files: [ "scripts/**/*.mjs" ],
        languageOptions:
        {
            globals:
            {
                Buffer:  "readonly",
                console: "readonly",
                process: "readonly",
            },
        },
    },
];
