// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Authoring Draft Factory
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Creates the intentionally incomplete but structurally coherent draft used by the New document
//   workflow.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { AuthoringDraft } from "./contracts.js";

//--------------------------------------------------------------------------------------------------
// Function: createEmptyAuthoringDraft
//
// Description:
//
//   Creates empty authoring draft.
//
// Parameters:
//
//   - legacyStateOriginCentered:
//     The legacy state origin centered supplied to the operation.
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

export function createEmptyAuthoringDraft ( legacyStateOriginCentered?: boolean ): AuthoringDraft
{
    // The optional argument keeps older callers source-compatible; new drafts always use canonical
    // top-left geometry.

    void legacyStateOriginCentered;

    // Return the assembled result.

    return {
        settings:
        {
            name:        "Untitled State Machine",
            description: "",
            version:     "1.0.0",
        },
        stateMachine:
        {
            initialState:   null,
            events:         [],
            states:         [],
            actions:        [],
            stateActions:
            {
                entry: [],
                exit:  [],
            },
            transitionTable: [],
        },
        chart:
        {
            settings:
            {
                expandStates: false,
            },
            indicators:
            {
                initialStateIndicator:    null,
                terminalStateIndicators:  [],
                terminalStateTransitions: [],
            },
            states:           [],
            draftTransitions: [],
        },
        solver:    { sequences: [] },
        simulator: { sequences: [] },
    };
}
