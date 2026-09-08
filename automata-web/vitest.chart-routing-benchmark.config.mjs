// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Vitest Chart Routing Benchmark Configuration
// Version: 1.1.0
// Date:    2026-08-22
// Author:  Rohin Gosling
//
// Description:
//
//   Runs only the opt-in Chart routing benchmark with compile-time performance diagnostics enabled.
//   Its benchmark suffix keeps it outside ordinary Vitest discovery and the existing reference
//   performance command.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { defineConfig } from "vitest/config";

export default defineConfig (
    {
        define:
        {
            __AUTOMATA_CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED__: "true",
        },
        test:
        {
            environment: "node",
            include:     [ "tests/performance/chart-routing.benchmark.ts" ],
            testTimeout: 900_000,
        },
    }
);
