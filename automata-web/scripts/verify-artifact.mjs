// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Artifact Verification Entry Point
// Version: 1.0.0
// Date:    2026-08-21
// Author:  Rohin Gosling
//
// Description:
//
//   Runs the fail-closed production artifact inventory, content, privacy, CSP, and bundle-budget
//   verifier.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { verifyProductionArtifact } from "./artifact-verifier.mjs";

verifyProductionArtifact ().catch ( error =>
{
    console.error ( error instanceof Error ? error.message : String ( error ) );
    process.exitCode = 1;
} );
