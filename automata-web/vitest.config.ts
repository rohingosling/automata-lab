// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Vitest Configuration
// Version: 1.0.0
// Date:    2026-08-06
// Author:  Rohin Gosling
//
// Description:
//
//   Configures framework-independent and DOM-backed unit tests in one deterministic test inventory.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig (
    {
        define:
        {
            __AUTOMATA_CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED__: "true",
        },
        plugins: [ react () ],
        test:
        {
            environment: "node",
            exclude: [ "dist/**", "node_modules/**", "tests/browser/**" ],
            setupFiles: [ "./tests/setup.ts" ],
        },
    }
);
