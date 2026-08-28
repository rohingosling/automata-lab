// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Candidate Chart Layout
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Provides deterministic separator-aware name wrapping for the Solver candidate state chart.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { CHART_NAME_CHARACTER_LIMIT, wrapChartName } from "../chart/chart-name-wrapping.js";

//--------------------------------------------------------------------------------------------------
// Function: wrapCandidateChartName
//
// Description:
//
//   Derives the wrap candidate chart name.
//
// Parameters:
//
//   - name:
//     The name supplied to the operation.
//
//   - wrappingEnabled:
//     The wrapping enabled supplied to the operation.
//
//   - characterLimit:
//     The character limit supplied to the operation.
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

export function wrapCandidateChartName (
    name: string,
    wrappingEnabled: boolean,
    characterLimit: number = CHART_NAME_CHARACTER_LIMIT,
): readonly string[]
{
    // Return the wrap chart name result.

    return wrapChartName ( name, wrappingEnabled, characterLimit );
}
