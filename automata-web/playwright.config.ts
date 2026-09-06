// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Playwright Configuration
// Version: 1.0.0
// Date:    2026-08-06
// Author:  Rohin Gosling
//
// Description:
//
//   Runs shell, visual, responsive, and accessibility checks against the emitted Pages subpath.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { defineConfig, devices } from "@playwright/test";

export default defineConfig (
    {
        globalSetup: "./tests/browser/global-setup.ts",
        expect:
        {
            timeout: 10_000,
            toHaveScreenshot:
            {
                animations: "disabled",
                maxDiffPixelRatio: 0.015,
            },
        },
        forbidOnly: true,
        outputDir: "test-results",
        projects: [
            {
                name: "chromium",
                metadata: { visualBaseline: process.platform === "win32" },
                use:
                {
                    ...devices [ "Desktop Chrome" ],
                    viewport: { height: 900, width: 1440 },
                },
            },
            {
                name: "firefox",
                metadata: { visualBaseline: false },
                use:
                {
                    ...devices [ "Desktop Firefox" ],
                    viewport: { height: 900, width: 1440 },
                },
            },
            {
                name: "webkit",
                metadata: { visualBaseline: false },
                use:
                {
                    ...devices [ "Desktop Safari" ],
                    viewport: { height: 900, width: 1440 },
                },
            },
        ],
        reporter: "list",
        retries: process.env [ "CI" ] === undefined ? 0 : 2,
        testDir: "tests/browser",
        timeout: 45_000,
        use:
        {
            baseURL: "http://127.0.0.1:4187/automata-lab/",
            colorScheme: "light",
            screenshot: "only-on-failure",
            trace: "retain-on-failure",
        },
        workers: 1,
    }
);
