// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Solver Observation Normalization
// Version: 1.0.0
// Date:    2026-08-09
// Author:  Rohin Gosling
//
// Description:
//
//   Converts typed token streams into event-delimited complete state/action constraints and
//   diagnoses hard conflicts.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type
{
    NormalizedSolverInterval,
    NormalizedSolverObservation,
    ParsedSolverObservation,
    SolverDiagnosticLocation,
    SolverNormalizationResult,
    SolverObservationDiagnostic,
    SolverObservationInput,
} from "./contracts.js";
import { MAXIMUM_SOLVER_TOKEN_COUNT } from "../model/limits.js";
import { parseSolverObservation } from "./parser.js";

//--------------------------------------------------------------------------------------------------
// Function: createLocation
//
// Description:
//
//   Creates location.
//
// Parameters:
//
//   - observation:
//     The observation supplied to the operation.
//
//   - tokenStart:
//     The token start supplied to the operation.
//
//   - tokenEndExclusive:
//     The token end exclusive supplied to the operation.
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

function createLocation (
    observation: ParsedSolverObservation,
    tokenStart: number,
    tokenEndExclusive: number,
): SolverDiagnosticLocation
{
    // Return the assembled result.

    return {
        sequenceName: observation.name,
        tokenStart,
        tokenEndExclusive,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: normalizeParsedObservation
//
// Description:
//
//   Normalizes parsed observation.
//
// Parameters:
//
//   - observation:
//     The observation supplied to the operation.
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

function normalizeParsedObservation (
    observation: ParsedSolverObservation,
): { readonly observation: NormalizedSolverObservation; readonly diagnostics: readonly SolverObservationDiagnostic[] }
{
    // Initialize the local values needed by this operation.

    const intervals: NormalizedSolverInterval[]            = [];
    const diagnostics: SolverObservationDiagnostic[]       = [];
    let incomingEvent: string | null                       = null;
    let explicitState: string | null                       = null;
    let entryActions: string[]                             = [];
    let intervalStateLocations: SolverDiagnosticLocation[] = [];
    let intervalStart                                      = 0;

    //----------------------------------------------------------------------------------------------
    // Function: finishInterval
    //
    // Description:
    //
    //   Finalizes the interval.
    //
    // Parameters:
    //
    //   - tokenEndExclusive:
    //     The token end exclusive supplied to the operation.
    //
    // Returns:
    //
    //   No value is returned.
    //
    // Preconditions:
    //
    //   - The supplied arguments satisfy their declared TypeScript contracts.
    //
    // Postconditions:
    //
    //   - The described side effects are complete when the callable returns.
    //
    //----------------------------------------------------------------------------------------------

    const finishInterval = ( tokenEndExclusive: number ): void =>
    {
        intervals.push (
            {
                incomingEvent,
                explicitState,
                entryActions,
                tokenStart: intervalStart,
                tokenEndExclusive,
            },
        );
    };

    // Process each token from the observation tokens collection in order.

    for ( const token of observation.tokens )
    {
        // Dispatch according to the token kind value.

        switch ( token.kind )
        {
            // Handle the "event" case.

            case "event":
                finishInterval ( token.tokenIndex );
                incomingEvent          = token.name;
                explicitState          = null;
                entryActions           = [];
                intervalStateLocations = [];
                intervalStart          = token.tokenIndex + 1;
                break;

            // Handle the "state" case.

            case "state":

                // Handle the case where explicit state matches an absent value.

                if ( explicitState === null )
                {
                    explicitState = token.name;
                    intervalStateLocations.push ( createLocation ( observation, token.tokenIndex, token.tokenIndex + 1 ) );
                }
                else if ( explicitState !== token.name )
                {
                    // Calculate the current location value from the current inputs.

                    const currentLocation = createLocation ( observation, token.tokenIndex, token.tokenIndex + 1 );

                    diagnostics.push (
                        {
                            code:        "MULTIPLE_STATES_IN_INTERVAL",
                            severity:    "error",
                            message:     `One event interval contains both '${explicitState}' and '${token.name}'.`,
                            remediation: "Separate different state observations with an event token.",
                            relatedLocations: [ ...intervalStateLocations, currentLocation ],
                        },
                    );
                    intervalStateLocations.push ( currentLocation );
                }
                break;

            // Handle the "action" case.

            case "action":
                entryActions = [ ...entryActions, token.name ];
                break;

        }
    }

    // Initialize the local values needed by this operation.

    const finalToken    = observation.tokens [ observation.tokens.length - 1 ];
    const finalTokenEnd = finalToken === undefined ? 0 : finalToken.tokenIndex + 1;

    finishInterval ( finalTokenEnd );

    // Return the assembled result.

    return {
        observation:
        {
            name:         observation.name,
            startContext: observation.startContext,
            intervals,
        },
        diagnostics,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: actionWordsEqual
//
// Description:
//
//   Derives the action words equal.
//
// Parameters:
//
//   - left:
//     The left supplied to the operation.
//
//   - right:
//     The right supplied to the operation.
//
// Returns:
//
//   True when the named condition is satisfied; otherwise, false.
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

function actionWordsEqual ( left: readonly string[], right: readonly string[] ): boolean
{
    // Return the computed result.

    return left.length === right.length && left.every ( ( action, actionIndex ) => action === right [ actionIndex ] );
}

//--------------------------------------------------------------------------------------------------
// Function: normalizeSolverObservations
//
// Description:
//
//   Normalizes solver observations.
//
// Parameters:
//
//   - inputs:
//     The inputs supplied to the operation.
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

export function normalizeSolverObservations (
    inputs: readonly SolverObservationInput[],
): SolverNormalizationResult
{
    // Initialize the local values needed by this operation.

    const observations: NormalizedSolverObservation[] = [];
    const diagnostics: SolverObservationDiagnostic[]  = [];
    const inputTokenCount                             = inputs.reduce ( ( total, input ) => total + input.rawTokens.length, 0 );

    // Handle the case where input token count exceeds maximum solver token count.

    if ( inputTokenCount > MAXIMUM_SOLVER_TOKEN_COUNT )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            diagnostics:
            [
                {
                    code: "CAPACITY_EXCEEDED",
                    severity: "error",
                    message: `The Solver input contains ${inputTokenCount} tokens; the limit is ${MAXIMUM_SOLVER_TOKEN_COUNT}.`,
                    remediation: "Reduce the number or length of observation sequences.",
                    relatedLocations: [],
                },
            ],
        };
    }

    // Handle the case where inputs length equals 0.

    if ( inputs.length === 0 )
    {
        // Return the assembled result.

        return {
            isSuccessful: true,
            observations,
            diagnostics:
            [
                {
                    code:        "NO_OBSERVATIONS",
                    severity:    "warning",
                    message:     "No usable Solver observations were supplied.",
                    remediation: "Add observations to constrain the generated candidate.",
                    relatedLocations: [],
                },
            ],
        };
    }

    // Process each input from the inputs collection in order.

    for ( const input of inputs )
    {
        // Initialize the local values needed by this operation.

        const parseResult = parseSolverObservation ( input );

        diagnostics.push ( ...parseResult.diagnostics );

        // Handle the case where the parse result is successful condition is not satisfied.

        if ( !parseResult.isSuccessful )
        {
            continue;
        }

        const normalized = normalizeParsedObservation ( parseResult.observation );

        observations.push ( normalized.observation );
        diagnostics.push ( ...normalized.diagnostics );
    }

    // Initialize the local values needed by this operation.

    const actionEvidenceByState = new Map<string, {
        readonly actions:  readonly string[];
        readonly location: SolverDiagnosticLocation;
    }> ();
    let initialStateEvidence: { readonly state: string; readonly location: SolverDiagnosticLocation } | null = null;

    // Process each observation from the observations collection in order.

    for ( const observation of observations )
    {
        // Process each interval from the observation intervals collection in order.

        for ( const interval of observation.intervals )
        {
            // Handle the case where interval explicit state matches an absent value.

            if ( interval.explicitState === null )
            {
                continue;
            }

            // Initialize the local values needed by this operation.

            const location: SolverDiagnosticLocation =
            {
                sequenceName:      observation.name,
                tokenStart:        interval.tokenStart,
                tokenEndExclusive: interval.tokenEndExclusive,
            };
            const previousEvidence = actionEvidenceByState.get ( interval.explicitState );

            // Handle the case where previous evidence matches undefined.

            if ( previousEvidence === undefined )
            {
                actionEvidenceByState.set (
                    interval.explicitState,
                    { actions: interval.entryActions, location },
                );
            }
            else if ( !actionWordsEqual ( previousEvidence.actions, interval.entryActions ) )
            {
                diagnostics.push (
                    {
                        code:        "ACTION_WORD_CONFLICT",
                        severity:    "error",
                        message:     `State '${interval.explicitState}' has conflicting complete entry-action observations.`,
                        remediation: "Make every observation of the explicit state use the same ordered action word.",
                        relatedLocations: [ previousEvidence.location, location ],
                    },
                );
            }
        }

        const leadingInterval = observation.intervals [ 0 ];

        // Handle the case where all required conditions are satisfied.

        if ( observation.startContext === "initial" && leadingInterval?.explicitState !== null &&
             leadingInterval?.explicitState !== undefined )
        {
            // Initialize the local values needed by this operation.

            const location: SolverDiagnosticLocation =
            {
                sequenceName:      observation.name,
                tokenStart:        leadingInterval.tokenStart,
                tokenEndExclusive: leadingInterval.tokenEndExclusive,
            };

            // Handle the case where initial state evidence matches an absent value.

            if ( initialStateEvidence === null )
            {
                initialStateEvidence = { state: leadingInterval.explicitState, location };
            }
            else if ( initialStateEvidence.state !== leadingInterval.explicitState )
            {
                diagnostics.push (
                    {
                        code:        "INITIAL_STATE_CONFLICT",
                        severity:    "error",
                        message:     `Initial observations identify both '${initialStateEvidence.state}' and '${leadingInterval.explicitState}'.`,
                        remediation: "Use one explicit initial state across all initial-context observations.",
                        relatedLocations: [ initialStateEvidence.location, location ],
                    },
                );
            }
        }
    }

    // Handle the case where some result is enabled.

    if ( diagnostics.some ( ( diagnostic ) => diagnostic.severity === "error" ) )
    {
        // Return the assembled result.

        return { isSuccessful: false, diagnostics };
    }

    // Return the assembled result.

    return { isSuccessful: true, observations, diagnostics };
}
