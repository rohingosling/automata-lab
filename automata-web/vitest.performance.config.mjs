// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Vitest Performance Configuration
// Version: 1.0.0
// Date:    2026-08-21
// Author:  Rohin Gosling
//
// Description:
//
//   Runs the opt-in reference performance harness outside ordinary unit-test discovery.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { defineConfig } from "vitest/config";

export default defineConfig (
    {
        test:
        {
            environment: "node",
            include:     [ "tests/performance/**/*.performance.ts" ],
            testTimeout: 120_000,
        },
    }
);
