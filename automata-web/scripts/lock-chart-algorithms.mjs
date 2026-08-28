// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Chart Algorithm Re-lock
// Version: 1.0.0
// Date:    2026-08-20
// Author:  Rohin Gosling
//
// Description:
//
//   Runs the chart algorithm lock suite in update mode so the manifest records the current source
//   digests.
//
//   All of the logic lives in tests/chart/chart-algorithm-lock.test.ts, which owns the locked area,
//   the digests, and the configuration values. This wrapper exists only to set the environment
//   variable that switches that test from verifying the manifest to rewriting it, in a way that
//   works the same on every platform.
//
//   Run it only when the algorithm change is intentional because the command rewrites the stored
//   digests used by ordinary verification.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { spawnSync } from "node:child_process";

const result = spawnSync (
    "npx",
    [ "vitest", "run", "tests/chart" ],
    {
        env:   { ...process.env, CHART_ALGORITHM_LOCK_UPDATE: "1" },
        shell: true,
        stdio: "inherit",
    },
);

process.exit ( result.status ?? 1 );
