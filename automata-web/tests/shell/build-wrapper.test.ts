// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Build Wrapper Tests
// Version: 1.0.0
// Date:    2026-08-06
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies that the friendly Windows wrapper preserves locked installation, verification, and
//   failure propagation.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const testDirectory    = dirname ( fileURLToPath ( import.meta.url ) );
const buildWrapperPath = resolve ( testDirectory, "../../../build.bat" );
const packagePath      = resolve ( testDirectory, "../../package.json" );
const packageLockPath  = resolve ( testDirectory, "../../package-lock.json" );

describe ( "Phase 1 build wrapper", () =>
{
    it ( "runs the locked graph, pinned browsers, complete verification, and returns the captured exit code", () =>
    {
        // Initialize the local values needed by this operation.

        const wrapper      = readFileSync ( buildWrapperPath, "utf8" );
        const installIndex = wrapper.indexOf ( "call npm.cmd ci" );
        const browserIndex = wrapper.indexOf ( "call npm.cmd run test:browser:install" );
        const verifyIndex  = wrapper.indexOf ( "call npm.cmd run verify" );

        expect ( installIndex ).toBeGreaterThanOrEqual ( 0 );
        expect ( browserIndex ).toBeGreaterThan ( installIndex );
        expect ( verifyIndex ).toBeGreaterThan ( browserIndex );
        expect ( wrapper ).toContain ( "exit /b %AUTOMATA_BUILD_EXIT_CODE%" );
    } );

    it ( "uses the package-local Playwright CLI at the exact locked version", () =>
    {
        // Initialize the local values needed by this operation.

        const packageText     = readFileSync ( packagePath, "utf8" );
        const packageLockText = readFileSync ( packageLockPath, "utf8" );

        expect ( packageText ).toContain (
            `"test:browser:install": "playwright install chromium firefox webkit"`,
        );
        expect ( packageText ).toContain ( `"@playwright/test": "1.62.1"` );
        expect ( packageLockText ).toMatch ( /"node_modules\/playwright":\s*\{[\s\S]*?"version": "1\.62\.1"/u );
    } );
} );
