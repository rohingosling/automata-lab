// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Solver Candidate Replay
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Replays normalized hard observations against partial candidate transitions and complete state
//   entry-action words.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { SolverCandidate } from "../model/contracts.js";
import type
{
    NormalizedSolverInterval,
    NormalizedSolverObservation,
    SolverObservationDiagnostic,
    SolverReplayResult,
} from "./contracts.js";

//--------------------------------------------------------------------------------------------------
// Function: actionWordsByState
//
// Description:
//
//   Derives the action words by state.
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

function actionWordsByState ( candidate: SolverCandidate ): ReadonlyMap<string, readonly string[]>
{
    // Initialize the local values needed by this operation.

    const actionsByState = new Map<string, string[]> ();

    // Process each state from the states collection in order.

    for ( const state of candidate.stateMachine.states )
    {
        actionsByState.set ( state.name, [] );
    }

    // Process each mapping from the entry collection in order.

    for ( const mapping of candidate.stateMachine.stateActions.entry )
    {
        actionsByState.get ( mapping.state )?.push ( mapping.action );
    }

    // Return the actions by state.

    return actionsByState;
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

    return left.length === right.length && left.every ( ( action, index ) => action === right [ index ] );
}

//--------------------------------------------------------------------------------------------------
// Function: intervalMatches
//
// Description:
//
//   Derives the interval matches.
//
// Parameters:
//
//   - interval:
//     The interval supplied to the operation.
//
//   - state:
//     The state supplied to the operation.
//
//   - actionsByState:
//     The actions by state supplied to the operation.
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

function intervalMatches (
    interval: NormalizedSolverInterval,
    state: string,
    actionsByState: ReadonlyMap<string, readonly string[]>,
): boolean
{
    // Return the computed result.

    return ( interval.explicitState === null || interval.explicitState === state ) &&
        actionWordsEqual ( interval.entryActions, actionsByState.get ( state ) ?? [] );
}

//--------------------------------------------------------------------------------------------------
// Function: replayDiagnostic
//
// Description:
//
//   Derives the replay diagnostic.
//
// Parameters:
//
//   - observation:
//     The observation supplied to the operation.
//
//   - interval:
//     The interval supplied to the operation.
//
//   - message:
//     The message supplied to the operation.
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

function replayDiagnostic (
    observation: NormalizedSolverObservation,
    interval: NormalizedSolverInterval,
    message: string,
): SolverObservationDiagnostic
{
    // Return the assembled result.

    return {
        code: "DETERMINISM_CONFLICT",
        severity: "error",
        message,
        remediation: "Review the candidate construction and the cited hard observation.",
        relatedLocations:
        [
            {
                sequenceName:      observation.name,
                tokenStart:        interval.tokenStart,
                tokenEndExclusive: interval.tokenEndExclusive,
            },
        ],
    };
}

//--------------------------------------------------------------------------------------------------
// Function: candidateStartStates
//
// Description:
//
//   Derives the candidate start states.
//
// Parameters:
//
//   - candidate:
//     The candidate supplied to the operation.
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

function candidateStartStates (
    candidate: SolverCandidate,
    observation: NormalizedSolverObservation,
): readonly string[]
{
    // Handle the case where observation start context matches the initial value.

    if ( observation.startContext === "initial" )
    {
        // Return the assembled result collection.

        return [ candidate.stateMachine.initialState ];
    }

    const stateNames = candidate.stateMachine.states.map ( state => state.name );

    // Return the result selected by the current condition.

    return observation.startContext === "infer"
        ? [ candidate.stateMachine.initialState, ...stateNames.filter ( state => state !== candidate.stateMachine.initialState ) ]
        : stateNames;
}

//--------------------------------------------------------------------------------------------------
// Function: replaySolverObservation
//
// Description:
//
//   Derives the replay solver observation.
//
// Parameters:
//
//   - candidate:
//     The candidate supplied to the operation.
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

export function replaySolverObservation (
    candidate: SolverCandidate,
    observation: NormalizedSolverObservation,
): SolverReplayResult
{
    // Initialize the local values needed by this operation.

    const actionsByState          = actionWordsByState ( candidate );
    const destinationByTransition = new Map<string, string> ( candidate.stateMachine.transitionTable.map ( transition =>
        [ JSON.stringify ( [ transition.state, transition.event ] ), transition.stateNext ] ) );
    const leadingInterval = observation.intervals [ 0 ];

    // Handle the case where leading interval matches undefined.

    if ( leadingInterval === undefined )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            stateNames: [],
            diagnostic:
            {
                code: "SOLVER_FAILURE",
                severity: "error",
                message: `Observation '${observation.name}' has no normalized leading interval.`,
                remediation: "Normalize the observation before replay.",
                relatedLocations: [],
            },
        };
    }

    let firstFailure: SolverObservationDiagnostic | null = null;

    // Process each start state from the candidate start states result collection in order.

    for ( const startState of candidateStartStates ( candidate, observation ) )
    {
        // Initialize the local values needed by this operation.

        const stateNames = [ startState ];
        let currentState = startState;

        // Handle the case where the interval matches result condition is not satisfied.

        if ( !intervalMatches ( leadingInterval, currentState, actionsByState ) )
        {
            firstFailure ??= replayDiagnostic (
                observation,
                leadingInterval,
                `Candidate state '${currentState}' does not match the leading state/action evidence.`,
            );
            continue;
        }

        let failed = false;

        // Repeat the operation across the bounded iteration range.

        for ( let intervalIndex = 1; intervalIndex < observation.intervals.length; intervalIndex++ )
        {
            // Initialize the local values needed by this operation.

            const interval = observation.intervals [ intervalIndex ];

            // Handle the case where at least one branch condition is satisfied.

            if ( interval === undefined || interval.incomingEvent === null )
            {
                failed = true;
                break;
            }

            const destination = destinationByTransition.get (
                JSON.stringify ( [ currentState, interval.incomingEvent ] ),
            );

            // Handle the case where destination matches undefined.

            if ( destination === undefined )
            {
                firstFailure ??= replayDiagnostic (
                    observation,
                    interval,
                    `Candidate transition '${currentState}' + '${interval.incomingEvent}' is undefined.`,
                );
                failed = true;
                break;
            }

            currentState = destination;
            stateNames.push ( currentState );

            // Handle the case where the interval matches result condition is not satisfied.

            if ( !intervalMatches ( interval, currentState, actionsByState ) )
            {
                firstFailure ??= replayDiagnostic (
                    observation,
                    interval,
                    `Candidate state '${currentState}' does not match the reached state/action evidence.`,
                );
                failed = true;
                break;
            }
        }

        // Handle the case where the failed condition is not satisfied.

        if ( !failed )
        {
            // Return the assembled result.

            return { isSuccessful: true, stateNames, diagnostic: null };
        }
    }

    // Return the assembled result.

    return {
        isSuccessful: false,
        stateNames: [],
        diagnostic: firstFailure ?? replayDiagnostic (
            observation,
            leadingInterval,
            `No candidate start state can replay observation '${observation.name}'.`,
        ),
    };
}
