// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Simulator Workspace Coordination
// Version: 1.0.0
// Date:    2026-08-17
// Author:  Rohin Gosling
//
// Description:
//
//   Provides the browser-neutral Simulator use-case helpers: the one shared event-buffer cleanup
//   function, the Step cursor arithmetic, and the composed Run/Step/Reset availability decision.
//
//   Execution itself is not implemented here. The pure runtime functions live in the server worker,
//   and this module only prepares requests for it and projects the immutable session snapshots it
//   returns.
//   
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { SimulatorSequence } from "../domain/model/contracts.js";
import type { RuntimeWarning } from "../domain/runtime/contracts.js";
import type { HostedSessionDto } from "./server-contracts.js";

// A Run/Step/Reset precondition that is not currently satisfied. The order of this union is the
// order in which blockers are reported, so the reason shown to the user is stable rather than
// dependent on evaluation order.
//
// An in-flight server request is deliberately absent from this vocabulary. It disables the three
// commands through isEnabled below -- but it is not a precondition: a precondition is something the
// user must go and resolve, while a request in flight resolves itself within a frame or two.
// Admitting it here made the page insert and remove a reason on every Step.

//--------------------------------------------------------------------------------------------------
// Type: SimulatorCommandBlocker
//
// Description:
//
//   Defines the supported simulator command blocker alternatives.
//
//--------------------------------------------------------------------------------------------------

export type SimulatorCommandBlocker =
    | "document_missing"
    | "document_invalid"
    | "server_not_ready"
    | "hosted_revision_missing";

//--------------------------------------------------------------------------------------------------
// Interface: SimulatorCommandAvailabilityInput
//
// Description:
//
//   Defines the structure of simulator command availability input.
//
//--------------------------------------------------------------------------------------------------

export interface SimulatorCommandAvailabilityInput
{
    readonly documentOpen:        boolean;
    readonly documentValid:       boolean;
    readonly hostedRevision:      string | null;
    readonly isOperationPending:  boolean;
    readonly isServerReady:       boolean;
}

//--------------------------------------------------------------------------------------------------
// Interface: SimulatorCommandAvailability
//
// Description:
//
//   Defines the structure of simulator command availability.
//
//--------------------------------------------------------------------------------------------------

export interface SimulatorCommandAvailability
{
    readonly blockers:  readonly SimulatorCommandBlocker[];
    readonly isEnabled: boolean;
}

//--------------------------------------------------------------------------------------------------
// Interface: SimulatorSessionState
//
// Description:
//
//   Defines the structure of simulator session state.
//
//--------------------------------------------------------------------------------------------------

export interface SimulatorSessionState
{
    readonly lastWarnings: readonly RuntimeWarning[];
    readonly session:      HostedSessionDto | null;
    readonly stepCursor:   number;
}

const BLOCKER_ORDER: readonly SimulatorCommandBlocker[] =
[
    "document_missing",
    "document_invalid",
    "server_not_ready",
    "hosted_revision_missing",
];

// /////////////////////////////////////////////////////////////////////////////////////////////////
// Event buffer cleanup.
//
//   One cleanup function is shared by the editor commit path and the Run/Step submission path, so a
//   submitted buffer can never differ from the committed sequence. It removes blank lines and trims
//   each line. It deliberately does not reorder, deduplicate, or case-fold because event matching
//   is exact and case-sensitive, and undeclared events must survive for negative testing.
// /////////////////////////////////////////////////////////////////////////////////////////////////

//--------------------------------------------------------------------------------------------------
// Function: cleanEventLines
//
// Description:
//
//   Cleans the event lines.
//
// Parameters:
//
//   - value:
//     The value supplied to the operation.
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

export function cleanEventLines ( value: string ): readonly string[]
{
    // Return the filtered collection.

    return value.split ( /\r?\n/gu ).map ( eventName => eventName.trim () ).filter ( eventName => eventName.length > 0 );
}

//--------------------------------------------------------------------------------------------------
// Function: eventLinesText
//
// Description:
//
//   Derives the event lines text.
//
// Parameters:
//
//   - sequence:
//     The sequence supplied to the operation.
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

export function eventLinesText ( sequence: SimulatorSequence | undefined ): string
{
    // Return the result selected by the current condition.

    return sequence === undefined ? "" : sequence.sequence.join ( "\n" );
}

// /////////////////////////////////////////////////////////////////////////////////////////////////
// Step cursor.
//
//   The cursor is the index of the next unconsumed event. It is application state, never document
//   data, so it is not persisted and it resets whenever the session resets or the selected sequence
//   changes.
// /////////////////////////////////////////////////////////////////////////////////////////////////

//--------------------------------------------------------------------------------------------------
// Function: runEventBuffer
//
// Description:
//
//   Selects the complete event buffer for a new Run, or its unconsumed suffix after one or more
//   Steps.
//
// Parameters:
//
//   - events:
//     The events supplied to the operation.
//
//   - stepCursor:
//     The step cursor supplied to the operation.
//
// Returns:
//
//   The event buffer that Run should submit.
//
// Preconditions:
//
//   - The supplied arguments satisfy their declared TypeScript contracts.
//
// Postconditions:
//
//   - A partially consumed sequence omits every event already consumed by Step.
//   - A new or exhausted sequence remains available as a complete Run buffer.
//
//--------------------------------------------------------------------------------------------------

export function runEventBuffer ( events: readonly string[], stepCursor: number ): readonly string[]
{
    const boundedCursor = Math.max ( 0, Math.min ( stepCursor, events.length ) );

    // Preserve complete-buffer Run behavior before any Step and after the buffer is exhausted.

    return boundedCursor === 0 || boundedCursor === events.length ? events : events.slice ( boundedCursor );
}

//--------------------------------------------------------------------------------------------------
// Function: stepEventBuffer
//
// Description:
//
//   Advances the event buffer.
//
// Parameters:
//
//   - events:
//     The events supplied to the operation.
//
//   - stepCursor:
//     The step cursor supplied to the operation.
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

export function stepEventBuffer ( events: readonly string[], stepCursor: number ): readonly string[]
{
    // Initialize the local values needed by this operation.

    const boundedCursor = Math.max ( 0, Math.min ( stepCursor, events.length ) );

    // Return the slice result.

    return events.slice ( boundedCursor, boundedCursor + 1 );
}

//--------------------------------------------------------------------------------------------------
// Function: advanceStepCursor
//
// Description:
//
//   Derives the advance step cursor.
//
// Parameters:
//
//   - stepCursor:
//     The step cursor supplied to the operation.
//
//   - consumedEventCount:
//     The consumed event count supplied to the operation.
//
//   - eventCount:
//     The event count supplied to the operation.
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

export function advanceStepCursor (
    stepCursor: number,
    consumedEventCount: number,
    eventCount: number,
): number
{
    // Return the max result.

    return Math.max ( 0, Math.min ( stepCursor + Math.max ( 0, consumedEventCount ), eventCount ) );
}

// /////////////////////////////////////////////////////////////////////////////////////////////////
// Availability.
//
//   The availability decision combines the validation summary, server connection and readiness, and
//   the presence of a hosted revision. Composing it once here keeps the page from maintaining its
//   own copy of any of those three.
// /////////////////////////////////////////////////////////////////////////////////////////////////

//--------------------------------------------------------------------------------------------------
// Function: simulatorCommandAvailability
//
// Description:
//
//   Derives the simulator command availability.
//
// Parameters:
//
//   - input:
//     The input supplied to the operation.
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

export function simulatorCommandAvailability (
    input: SimulatorCommandAvailabilityInput,
): SimulatorCommandAvailability
{
    // Initialize the local values needed by this operation.

    const unsatisfied: Record<SimulatorCommandBlocker, boolean> =
    {
        document_missing:        !input.documentOpen,
        document_invalid:        input.documentOpen && !input.documentValid,
        server_not_ready:        !input.isServerReady,
        hosted_revision_missing: input.hostedRevision === null,
    };
    const blockers = BLOCKER_ORDER.filter ( blocker => unsatisfied [ blocker ] );

    // A request already in flight disables the commands without joining the reported preconditions,
    // so that one cannot be submitted twice while an ordinary Step leaves the visible page
    // completely still.

    return { blockers, isEnabled: blockers.length === 0 && !input.isOperationPending };
}

// /////////////////////////////////////////////////////////////////////////////////////////////////
// Session projection.
// /////////////////////////////////////////////////////////////////////////////////////////////////

//--------------------------------------------------------------------------------------------------
// Function: createSimulatorSessionState
//
// Description:
//
//   Creates simulator session state.
//
// Parameters:
//
//   None.
//
// Returns:
//
//   The value produced by the operation.
//
// Preconditions:
//
//   - None.
//
// Postconditions:
//
//   - The returned value represents the result described above.
//
//--------------------------------------------------------------------------------------------------

export function createSimulatorSessionState (): SimulatorSessionState
{
    // Return the assembled result.

    return { lastWarnings: [], session: null, stepCursor: 0 };
}

//--------------------------------------------------------------------------------------------------
// Function: isSimulatorSessionStale
//
// Description:
//
//   Determines whether simulator session stale.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
//
//   - hostedRevision:
//     The hosted revision supplied to the operation.
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

export function isSimulatorSessionStale ( state: SimulatorSessionState, hostedRevision: string | null ): boolean
{
    // Staleness is a revision comparison, never an inference from client document edits. The server
    // also reports its own view; either signal is sufficient, because a session pinned to a
    // superseded revision is stale regardless of which side noticed first.

    return state.session !== null &&
        ( state.session.isStale || ( hostedRevision !== null && state.session.modelRevision !== hostedRevision ) );
}
