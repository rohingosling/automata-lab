// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Constrained State-Merging Solver Property Tests
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Generates consistent Moore-style evidence and checks determinism, replay, action words, and
//   sparse transitions.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import fc from "fast-check";
import { expect, it } from "vitest";

import
{
    inferSolverCandidate,
    normalizeSolverObservations,
    replaySolverObservation,
    serializeCanonicalSolverCandidate,
} from "../../src/domain/solver/index.js";
import type { SolverObservationInput } from "../../src/domain/solver/index.js";

const EVENT_NAMES = [ "event_a", "event_b" ] as const;

//--------------------------------------------------------------------------------------------------
// Function: actionsForState
//
// Description:
//
//   Derives the actions for state.
//
// Parameters:
//
//   - stateNumber:
//     The state number supplied to the operation.
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

function actionsForState ( stateNumber: number ): readonly string[]
{
    // Return the result selected by the current condition.

    return stateNumber % 2 === 0 ? [ "action_even" ] : [ "action_odd", "action_odd" ];
}

//--------------------------------------------------------------------------------------------------
// Function: destination
//
// Description:
//
//   Derives the destination.
//
// Parameters:
//
//   - stateNumber:
//     The state number supplied to the operation.
//
//   - eventName:
//     The event name supplied to the operation.
//
//   - stateCount:
//     The state count supplied to the operation.
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

function destination ( stateNumber: number, eventName: string, stateCount: number ): number
{
    // Return the result selected by the current condition.

    return eventName === "event_a" ? ( stateNumber + 1 ) % stateCount : ( stateNumber * 2 + 1 ) % stateCount;
}

//--------------------------------------------------------------------------------------------------
// Function: createObservation
//
// Description:
//
//   Creates observation for the test scenario.
//
// Parameters:
//
//   - name:
//     The name supplied to the operation.
//
//   - initialState:
//     The initial state supplied to the operation.
//
//   - events:
//     The events supplied to the operation.
//
//   - stateCount:
//     The state count supplied to the operation.
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

function createObservation (
    name: string,
    initialState: number,
    events: readonly string[],
    stateCount: number,
): SolverObservationInput
{
    // Initialize the local values needed by this operation.

    const rawTokens: string[] = [ `state_${initialState}`, ...actionsForState ( initialState ) ];
    let currentState          = initialState;

    // Process each event name from the events collection in order.

    for ( const eventName of events )
    {
        currentState = destination ( currentState, eventName, stateCount );
        rawTokens.push ( eventName, ...actionsForState ( currentState ), `state_${currentState}` );
    }

    // Return the assembled result.

    return { name, startContext: initialState === 0 ? "initial" : "continuation", rawTokens };
}

it ( "replays generated consistent evidence with deterministic sparse candidates", () =>
{
    fc.assert (
        fc.property (
            fc.integer ( { min: 2, max: 4 } ),
            fc.array ( fc.array ( fc.constantFrom ( ...EVENT_NAMES ), { minLength: 1, maxLength: 5 } ),
                { minLength: 1, maxLength: 6 } ),
            ( stateCount, eventWords ) =>
            {
                // Initialize the local values needed by this operation.

                const observations = [
                    createObservation ( "initial", 0, EVENT_NAMES, stateCount ),
                    ...eventWords.map ( ( events, index ) =>
                        createObservation ( `fragment-${index}`, index % stateCount, events, stateCount ) ),
                ];
                const request =
                {
                    documentRevision: 1,
                    solverRevision: 1,
                    observations,
                };
                const result   = inferSolverCandidate ( request );
                const reversed = inferSolverCandidate ( { ...request, observations: [ ...observations ].reverse () } );

                expect ( result.status ).toBe ( "success" );
                expect ( reversed.status ).toBe ( "success" );

                // Handle the case where all required conditions are satisfied.

                if ( result.status === "success" && reversed.status === "success" )
                {
                    expect ( serializeCanonicalSolverCandidate ( result.candidate ) ).toBe (
                        serializeCanonicalSolverCandidate ( reversed.candidate ),
                    );
                    expect ( result.candidate.stateMachine.stateActions.exit ).toEqual ( [] );
                    expect ( result.candidate.stateMachine.transitionTable.length ).toBeLessThanOrEqual (
                        result.candidate.stateMachine.states.length * result.candidate.stateMachine.events.length,
                    );

                    const normalization = normalizeSolverObservations ( observations );

                    expect ( normalization.isSuccessful ).toBe ( true );

                    // Handle the case where normalization is successful is enabled.

                    if ( normalization.isSuccessful )
                    {
                        // Process each observation from the normalization observations collection
                        // in order.

                        for ( const observation of normalization.observations )
                        {
                            expect ( replaySolverObservation ( result.candidate, observation ).isSuccessful ).toBe ( true );
                        }
                    }
                }
            },
        ),
        { numRuns: 60 },
    );
}, 20_000 );
