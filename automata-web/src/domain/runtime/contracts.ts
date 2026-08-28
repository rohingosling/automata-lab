// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Runtime Contracts
// Version: 1.0.0
// Date:    2026-08-09
// Author:  Rohin Gosling
//
// Description:
//
//   Defines immutable compiled-model, session, trace, warning, and operation-result values.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

//--------------------------------------------------------------------------------------------------
// Interface: CompiledState
//
// Description:
//
//   Defines the structure of compiled state.
//
//--------------------------------------------------------------------------------------------------

export interface CompiledState
{
    readonly name:         string;
    readonly entryActions: readonly string[];
    readonly exitActions:  readonly string[];
}

//--------------------------------------------------------------------------------------------------
// Interface: CompiledTransition
//
// Description:
//
//   Defines the structure of compiled transition.
//
//--------------------------------------------------------------------------------------------------

export interface CompiledTransition
{
    readonly sourceState:      string;
    readonly event:            string;
    readonly destinationState: string;
}

//--------------------------------------------------------------------------------------------------
// Interface: CompiledModel
//
// Description:
//
//   Defines the structure of compiled model.
//
//--------------------------------------------------------------------------------------------------

export interface CompiledModel
{
    readonly initialState:    string;
    readonly eventNames:      ReadonlySet<string>;
    readonly statesByName:    ReadonlyMap<string, CompiledState>;
    readonly transitionsByKey: ReadonlyMap<string, CompiledTransition>;
}

//--------------------------------------------------------------------------------------------------
// Interface: RuntimeTransitionTraceEntry
//
// Description:
//
//   Defines the structure of runtime transition trace entry.
//
//--------------------------------------------------------------------------------------------------

export interface RuntimeTransitionTraceEntry
{
    readonly event:            string;
    readonly sourceState:      string;
    readonly destinationState: string;
    readonly outcome:          "NO_TRANSITION" | "TRANSITION" | "UNKNOWN_EVENT";
}

//--------------------------------------------------------------------------------------------------
// Interface: RuntimeActionTraceEntry
//
// Description:
//
//   Defines the structure of runtime action trace entry.
//
//--------------------------------------------------------------------------------------------------

export interface RuntimeActionTraceEntry
{
    readonly action: string;
    readonly state:  string;
    readonly phase:  "entry" | "exit";
}

//--------------------------------------------------------------------------------------------------
// Interface: RuntimeSession
//
// Description:
//
//   Defines the structure of runtime session.
//
//--------------------------------------------------------------------------------------------------

export interface RuntimeSession
{
    readonly currentState:               string;
    readonly initialEntryActionsPending: boolean;
    readonly transitionTrace:            readonly RuntimeTransitionTraceEntry[];
    readonly actionTrace:                readonly RuntimeActionTraceEntry[];
}

//--------------------------------------------------------------------------------------------------
// Interface: RuntimeWarning
//
// Description:
//
//   Defines the structure of runtime warning.
//
//--------------------------------------------------------------------------------------------------

export interface RuntimeWarning
{
    readonly code:    "NO_TRANSITION" | "UNKNOWN_EVENT";
    readonly event?:  string;
    readonly message: string;
}

//--------------------------------------------------------------------------------------------------
// Interface: RuntimeOperationResult
//
// Description:
//
//   Describes the result produced by runtime operation.
//
//--------------------------------------------------------------------------------------------------

export interface RuntimeOperationResult
{
    readonly session:            RuntimeSession;
    readonly consumedEventCount: number;
    readonly emittedActions:     readonly string[];
    readonly warnings:           readonly RuntimeWarning[];
}
