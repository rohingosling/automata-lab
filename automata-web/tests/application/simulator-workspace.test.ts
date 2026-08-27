// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Simulator Workspace Tests
// Version: 1.0.0
// Date:    2026-08-17
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies the shared event-buffer cleanup contract, the Step cursor arithmetic, the composed
//   Run/Step/Reset availability decision, and revision-based session staleness.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from "vitest";

import
{
    advanceStepCursor,
    cleanEventLines,
    createSimulatorSessionState,
    eventLinesText,
    isSimulatorSessionStale,
    runEventBuffer,
    simulatorCommandAvailability,
    stepEventBuffer,
} from "../../src/application/simulator-workspace.js";
import type { SimulatorCommandAvailabilityInput } from "../../src/application/simulator-workspace.js";
import type { HostedSessionDto } from "../../src/application/server-contracts.js";

const REVISION_A = `sha256:${"a".repeat ( 64 )}`;
const REVISION_B = `sha256:${"b".repeat ( 64 )}`;

//--------------------------------------------------------------------------------------------------
// Function: createSession
//
// Description:
//
//   Creates session for the test scenario.
//
// Parameters:
//
//   - overrides:
//     The overrides supplied to the operation.
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

function createSession ( overrides: Partial<HostedSessionDto> = {} ): HostedSessionDto
{
    // Return the assembled result.

    return {
        actionTrace:                [],
        currentState:               "idle",
        initialEntryActionsPending: true,
        isStale:                    false,
        modelRevision:              REVISION_A,
        processedEventCount:        0,
        sessionId:                  "11111111-1111-4111-8111-111111111111",
        traceTruncated:             false,
        transitionTrace:            [],
        ...overrides,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: availabilityInput
//
// Description:
//
//   Derives the availability input.
//
// Parameters:
//
//   - overrides:
//     The overrides supplied to the operation.
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

function availabilityInput (
    overrides: Partial<SimulatorCommandAvailabilityInput> = {},
): SimulatorCommandAvailabilityInput
{
    // Return the assembled result.

    return {
        documentOpen:       true,
        documentValid:      true,
        hostedRevision:     REVISION_A,
        isOperationPending: false,
        isServerReady:      true,
        ...overrides,
    };
}

describe ( "simulator event buffer cleanup", () =>
{
    it ( "removes blank lines and trims each remaining line", () =>
    {
        // Initialize the local values needed by this operation.

        const events = cleanEventLines ( "  event_go \n\n\t\n event_stop\t\n   \n" );

        expect ( events ).toEqual ( [ "event_go", "event_stop" ] );
    } );

    it ( "accepts carriage-return line endings", () =>
    {
        expect ( cleanEventLines ( "event_go\r\nevent_stop" ) ).toEqual ( [ "event_go", "event_stop" ] );
    } );

    it ( "preserves order, duplicates, and letter case because runtime matching is exact", () =>
    {
        // Initialize the local values needed by this operation.

        const events = cleanEventLines ( "event_Go\nevent_go\nevent_Go\nevent_stop" );

        expect ( events ).toEqual ( [ "event_Go", "event_go", "event_Go", "event_stop" ] );
    } );

    it ( "retains undeclared event names so unknown-event behavior stays expressible", () =>
    {
        expect ( cleanEventLines ( "not_a_declared_event" ) ).toEqual ( [ "not_a_declared_event" ] );
    } );

    it ( "returns an empty buffer for blank input", () =>
    {
        expect ( cleanEventLines ( "" ) ).toEqual ( [] );
        expect ( cleanEventLines ( "   \n\n\t" ) ).toEqual ( [] );
    } );

    it ( "round-trips a committed sequence through its editor text", () =>
    {
        // Initialize the local values needed by this operation.

        const sequence = { description: "", name: "s", sequence: [ "event_go", "event_stop" ] };

        expect ( cleanEventLines ( eventLinesText ( sequence ) ) ).toEqual ( sequence.sequence );
        expect ( eventLinesText ( undefined ) ).toBe ( "" );
    } );
} );

describe ( "simulator step cursor", () =>
{
    it ( "submits only the unconsumed suffix to Run after stepping part of a sequence", () =>
    {
        const events = [ "a", "b", "c" ];

        expect ( runEventBuffer ( events, 0 ) ).toEqual ( events );
        expect ( runEventBuffer ( events, 1 ) ).toEqual ( [ "b", "c" ] );
        expect ( runEventBuffer ( events, 2 ) ).toEqual ( [ "c" ] );
    } );

    it ( "keeps an exhausted sequence available for another complete Run", () =>
    {
        const events = [ "a", "b" ];

        expect ( runEventBuffer ( events, events.length ) ).toEqual ( events );
        expect ( runEventBuffer ( events, 99 ) ).toEqual ( events );
    } );

    it ( "submits at most one event per step", () =>
    {
        // Initialize the local values needed by this operation.

        const events = [ "a", "b", "c" ];

        expect ( stepEventBuffer ( events, 0 ) ).toEqual ( [ "a" ] );
        expect ( stepEventBuffer ( events, 2 ) ).toEqual ( [ "c" ] );
    } );

    it ( "submits an empty buffer once the sequence is exhausted", () =>
    {
        expect ( stepEventBuffer ( [ "a" ], 1 ) ).toEqual ( [] );
        expect ( stepEventBuffer ( [], 0 ) ).toEqual ( [] );
    } );

    it ( "bounds an out-of-range cursor rather than reading past the buffer", () =>
    {
        expect ( stepEventBuffer ( [ "a", "b" ], -5 ) ).toEqual ( [ "a" ] );
        expect ( stepEventBuffer ( [ "a", "b" ], 99 ) ).toEqual ( [] );
    } );

    it ( "advances by the consumed count and never past the end", () =>
    {
        expect ( advanceStepCursor ( 0, 1, 3 ) ).toBe ( 1 );
        expect ( advanceStepCursor ( 2, 1, 3 ) ).toBe ( 3 );
        expect ( advanceStepCursor ( 3, 1, 3 ) ).toBe ( 3 );
    } );

    it ( "does not advance when nothing was consumed", () =>
    {
        // The first Step after Reset with an empty buffer emits initial actions and consumes no
        // event.

        expect ( advanceStepCursor ( 0, 0, 3 ) ).toBe ( 0 );
    } );
} );

describe ( "simulator command availability", () =>
{
    it ( "enables the commands when every precondition holds", () =>
    {
        // Initialize the local values needed by this operation.

        const availability = simulatorCommandAvailability ( availabilityInput () );

        expect ( availability.isEnabled ).toBe ( true );
        expect ( availability.blockers ).toEqual ( [] );
    } );

    it ( "blocks while no document is open", () =>
    {
        // Initialize the local values needed by this operation.

        const availability = simulatorCommandAvailability ( availabilityInput ( { documentOpen: false } ) );

        expect ( availability.isEnabled ).toBe ( false );
        expect ( availability.blockers ).toContain ( "document_missing" );
    } );

    it ( "blocks while the document carries validation errors", () =>
    {
        // Initialize the local values needed by this operation.

        const availability = simulatorCommandAvailability ( availabilityInput ( { documentValid: false } ) );

        expect ( availability.blockers ).toEqual ( [ "document_invalid" ] );
    } );

    it ( "does not report invalidity when there is no document to validate", () =>
    {
        // Initialize the local values needed by this operation.

        const availability = simulatorCommandAvailability (
            availabilityInput ( { documentOpen: false, documentValid: false } ),
        );

        expect ( availability.blockers ).toEqual ( [ "document_missing" ] );
    } );

    it ( "blocks while the server is not ready", () =>
    {
        expect ( simulatorCommandAvailability ( availabilityInput ( { isServerReady: false } ) ).blockers )
            .toEqual ( [ "server_not_ready" ] );
    } );

    it ( "blocks while no revision is hosted", () =>
    {
        expect ( simulatorCommandAvailability ( availabilityInput ( { hostedRevision: null } ) ).blockers )
            .toEqual ( [ "hosted_revision_missing" ] );
    } );

    // A request in flight disables the commands so none can be submitted twice, but it is not a
    // precondition and must not join the reported ones. Reporting it inserted and removed a reason
    // above the panes on every Step.

    it ( "disables the commands while a server operation is in flight without reporting a precondition", () =>
    {
        // Initialize the local values needed by this operation.

        const availability = simulatorCommandAvailability ( availabilityInput ( { isOperationPending: true } ) );

        expect ( availability.isEnabled ).toBe ( false );
        expect ( availability.blockers ).toEqual ( [] );
    } );

    it ( "leaves the reported preconditions unchanged for the whole life of a request", () =>
    {
        // Initialize the local values needed by this operation.

        const settled  = simulatorCommandAvailability ( availabilityInput ( { isOperationPending: false } ) );
        const inFlight = simulatorCommandAvailability ( availabilityInput ( { isOperationPending: true } ) );

        expect ( inFlight.blockers ).toEqual ( settled.blockers );
    } );

    it ( "reports every unmet precondition in a stable order", () =>
    {
        // Initialize the local values needed by this operation.

        const availability = simulatorCommandAvailability (
            {
                documentOpen:       true,
                documentValid:      false,
                hostedRevision:     null,
                isOperationPending: true,
                isServerReady:      false,
            },
        );

        expect ( availability.blockers ).toEqual (
            [ "document_invalid", "server_not_ready", "hosted_revision_missing" ],
        );
        expect ( availability.isEnabled ).toBe ( false );
    } );
} );

describe ( "simulator session staleness", () =>
{
    it ( "reports no staleness without a session", () =>
    {
        expect ( isSimulatorSessionStale ( createSimulatorSessionState (), REVISION_A ) ).toBe ( false );
    } );

    it ( "reports no staleness while the pinned revision matches the hosted head", () =>
    {
        // Initialize the local values needed by this operation.

        const state = { lastWarnings: [], session: createSession (), stepCursor: 0 };

        expect ( isSimulatorSessionStale ( state, REVISION_A ) ).toBe ( false );
    } );

    it ( "reports staleness when the pinned revision differs from the hosted head", () =>
    {
        // Initialize the local values needed by this operation.

        const state = { lastWarnings: [], session: createSession (), stepCursor: 0 };

        expect ( isSimulatorSessionStale ( state, REVISION_B ) ).toBe ( true );
    } );

    it ( "honors the server's own staleness report", () =>
    {
        // Initialize the local values needed by this operation.

        const state = { lastWarnings: [], session: createSession ( { isStale: true } ), stepCursor: 0 };

        expect ( isSimulatorSessionStale ( state, REVISION_A ) ).toBe ( true );
    } );

    it ( "does not infer staleness from an unknown hosted revision", () =>
    {
        // Initialize the local values needed by this operation.

        const state = { lastWarnings: [], session: createSession (), stepCursor: 0 };

        expect ( isSimulatorSessionStale ( state, null ) ).toBe ( false );
    } );
} );
