// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Solver Candidate Canonicalization
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Produces byte-stable candidate evidence for determinism and equivalent-order tests.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { SolverCandidate } from "../model/contracts.js";

//--------------------------------------------------------------------------------------------------
// Function: serializeCanonicalSolverCandidate
//
// Description:
//
//   Serializes canonical solver candidate.
//
// Parameters:
//
//   - candidate:
//     The candidate supplied to the operation.
//
// Returns:
//
//   The value produced by the operation.
//
// Preconditions:
//
//   - The supplied arguments satisfy their declared TypeScript contracts.
//
// Postconditions:
//
//   - The returned value represents the result described above.
//
//--------------------------------------------------------------------------------------------------

export function serializeCanonicalSolverCandidate ( candidate: SolverCandidate ): string
{
    // Return the computed result.

    return `${JSON.stringify ( candidate, null, 2 )}\n`;
}
