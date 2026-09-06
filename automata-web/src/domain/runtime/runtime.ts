// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Deterministic State-Machine Runtime
// Version: 1.0.0
// Date:    2026-08-09
// Author:  Rohin Gosling
//
// Description:
//
//   Compiles valid documents and applies Reset, Run, and Step as pure operations.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { AutomataDocument } from "../model/contracts.js";
import type
{
    CompiledModel,
    CompiledState,
    CompiledTransition,
    RuntimeActionTraceEntry,
    RuntimeOperationResult,
    RuntimeSession,
    RuntimeTransitionTraceEntry,
    RuntimeWarning,
} from "./contracts.js";

//--------------------------------------------------------------------------------------------------
// Function: transitionKey
//
// Description:
//
//   Derives the transition key.
//
// Parameters:
//
//   - stateName:
//     The state name supplied to the operation.
//
//   - eventName:
//     The event name supplied to the operation.
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

function transitionKey ( stateName: string, eventName: string ): string
{
    // Return the stringify result.

    return JSON.stringify ( [ stateName, eventName ] );
}

//--------------------------------------------------------------------------------------------------
// Function: compileDocument
//
// Description:
//
//   Derives the compile document.
//
// Parameters:
//
//   - document:
//     The document to process.
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

export function compileDocument ( document: AutomataDocument ): CompiledModel
{
    // Initialize the local values needed by this operation.

    const entryActionsByState = new Map<string, string[]> ();
    const exitActionsByState  = new Map<string, string[]> ();

    // Process each mapping from the entry collection in order.

    for ( const mapping of document.stateMachine.stateActions.entry )
    {
        // Initialize the local values needed by this operation.

        const actions = entryActionsByState.get ( mapping.state ) ?? [];

        actions.push ( mapping.action );
        entryActionsByState.set ( mapping.state, actions );
    }

    // Process each mapping from the exit collection in order.

    for ( const mapping of document.stateMachine.stateActions.exit )
    {
        // Initialize the local values needed by this operation.

        const actions = exitActionsByState.get ( mapping.state ) ?? [];

        actions.push ( mapping.action );
        exitActionsByState.set ( mapping.state, actions );
    }

    const statesByName = new Map<string, CompiledState> ();

    // Process each state from the states collection in order.

    for ( const state of document.stateMachine.states )
    {
        statesByName.set (
            state.name,
            {
                name:         state.name,
                entryActions: [ ...( entryActionsByState.get ( state.name ) ?? [] ) ],
                exitActions:  [ ...( exitActionsByState.get ( state.name ) ?? [] ) ],
            },
        );
    }

    const transitionsByKey = new Map<string, CompiledTransition> ();

    // Process each transition from the transition table collection in order.

    for ( const transition of document.stateMachine.transitionTable )
    {
        transitionsByKey.set (
            transitionKey ( transition.state, transition.event ),
            {
                sourceState:      transition.state,
                event:            transition.event,
                destinationState: transition.stateNext,
            },
        );
    }

    // Return the assembled result.

    return {
        initialState: document.stateMachine.initialState,
        eventNames:   new Set ( document.stateMachine.events.map ( ( event ) => event.name ) ),
        statesByName,
        transitionsByKey,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: resetRuntimeSession
//
// Description:
//
//   Resets the runtime session.
//
// Parameters:
//
//   - model:
//     The model supplied to the operation.
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

export function resetRuntimeSession ( model: CompiledModel ): RuntimeSession
{
    // Return the assembled result.

    return {
        currentState:               model.initialState,
        initialEntryActionsPending: true,
        transitionTrace:            [],
        actionTrace:                [],
    };
}

//--------------------------------------------------------------------------------------------------
// Function: requireState
//
// Description:
//
//   Validates and returns the state.
//
// Parameters:
//
//   - model:
//     The model supplied to the operation.
//
//   - stateName:
//     The state name supplied to the operation.
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

function requireState ( model: CompiledModel, stateName: string ): CompiledState
{
    // Initialize the local values needed by this operation.

    const state = model.statesByName.get ( stateName );

    // Handle the case where state matches undefined.

    if ( state === undefined )
    {
        throw new Error ( `Compiled model does not contain state '${stateName}'.` );
    }

    // Return the state.

    return state;
}

//--------------------------------------------------------------------------------------------------
// Function: appendActions
//
// Description:
//
//   Appends the actions.
//
// Parameters:
//
//   - actions:
//     The actions supplied to the operation.
//
//   - stateName:
//     The state name supplied to the operation.
//
//   - phase:
//     The phase supplied to the operation.
//
//   - actionTrace:
//     The action trace supplied to the operation.
//
//   - emittedActions:
//     The emitted actions supplied to the operation.
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
//--------------------------------------------------------------------------------------------------

function appendActions (
    actions: readonly string[],
    stateName: string,
    phase: "entry" | "exit",
    actionTrace: RuntimeActionTraceEntry[],
    emittedActions: string[],
): void
{
    // Process each action from the actions collection in order.

    for ( const action of actions )
    {
        emittedActions.push ( action );
        actionTrace.push ( { action, state: stateName, phase } );
    }
}

//--------------------------------------------------------------------------------------------------
// Function: executeEvents
//
// Description:
//
//   Executes the events.
//
// Parameters:
//
//   - model:
//     The model supplied to the operation.
//
//   - session:
//     The session supplied to the operation.
//
//   - events:
//     The events supplied to the operation.
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

function executeEvents (
    model: CompiledModel,
    session: RuntimeSession,
    events: readonly string[],
): RuntimeOperationResult
{
    // Initialize the local values needed by this operation.

    let currentState                 = session.currentState;
    let initialEntryActionsPending   = session.initialEntryActionsPending;
    let consumedEventCount           = 0;
    const transitionTrace            = [ ...session.transitionTrace ];
    const actionTrace                = [ ...session.actionTrace ];
    const emittedActions: string[]   = [];
    const warnings: RuntimeWarning[] = [];

    // Handle the case where initial entry actions pending is enabled.

    if ( initialEntryActionsPending )
    {
        // Initialize the local values needed by this operation.

        const initialState = requireState ( model, currentState );

        appendActions ( initialState.entryActions, currentState, "entry", actionTrace, emittedActions );
        initialEntryActionsPending = false;
    }

    // Process each event name from the events collection in order.

    for ( const eventName of events )
    {
        // Initialize the local values needed by this operation.

        const sourceState = currentState;

        consumedEventCount++;

        // Handle the case where the has result condition is not satisfied.

        if ( !model.eventNames.has ( eventName ) )
        {
            // Initialize the local values needed by this operation.

            const traceEntry: RuntimeTransitionTraceEntry =
            {
                event:            eventName,
                sourceState,
                destinationState: sourceState,
                outcome:          "UNKNOWN_EVENT",
            };

            transitionTrace.push ( traceEntry );
            warnings.push (
                {
                    code:    "UNKNOWN_EVENT",
                    event:   eventName,
                    message: `Event '${eventName}' is not declared and was consumed without changing state.`,
                },
            );
            continue;
        }

        const transition = model.transitionsByKey.get ( transitionKey ( sourceState, eventName ) );

        // Handle the case where transition matches undefined.

        if ( transition === undefined )
        {
            transitionTrace.push (
                {
                    event:            eventName,
                    sourceState,
                    destinationState: sourceState,
                    outcome:          "NO_TRANSITION",
                },
            );
            warnings.push (
                {
                    code:    "NO_TRANSITION",
                    event:   eventName,
                    message: `State '${sourceState}' has no transition for event '${eventName}'.`,
                },
            );
            continue;
        }

        // Initialize the local values needed by this operation.

        const sourceStateDefinition      = requireState ( model, sourceState );
        const destinationStateDefinition = requireState ( model, transition.destinationState );

        appendActions ( sourceStateDefinition.exitActions, sourceState, "exit", actionTrace, emittedActions );
        currentState = transition.destinationState;
        appendActions (
            destinationStateDefinition.entryActions,
            currentState,
            "entry",
            actionTrace,
            emittedActions,
        );
        transitionTrace.push (
            {
                event:            eventName,
                sourceState,
                destinationState: currentState,
                outcome:          "TRANSITION",
            },
        );

    }

    // Return the assembled result.

    return {
        session:
        {
            currentState,
            initialEntryActionsPending,
            transitionTrace,
            actionTrace,
        },
        consumedEventCount,
        emittedActions,
        warnings,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: runRuntimeSession
//
// Description:
//
//   Runs the runtime session.
//
// Parameters:
//
//   - model:
//     The model supplied to the operation.
//
//   - session:
//     The session supplied to the operation.
//
//   - eventBuffer:
//     The event buffer supplied to the operation.
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

export function runRuntimeSession (
    model: CompiledModel,
    session: RuntimeSession,
    eventBuffer: readonly string[],
): RuntimeOperationResult
{
    // Return the execute events result.

    return executeEvents ( model, session, eventBuffer );
}

//--------------------------------------------------------------------------------------------------
// Function: stepRuntimeSession
//
// Description:
//
//   Advances the runtime session.
//
// Parameters:
//
//   - model:
//     The model supplied to the operation.
//
//   - session:
//     The session supplied to the operation.
//
//   - eventBuffer:
//     The event buffer supplied to the operation.
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

export function stepRuntimeSession (
    model: CompiledModel,
    session: RuntimeSession,
    eventBuffer: readonly string[],
): RuntimeOperationResult
{
    // Return the execute events result.

    return executeEvents ( model, session, eventBuffer.slice ( 0, 1 ) );
}
