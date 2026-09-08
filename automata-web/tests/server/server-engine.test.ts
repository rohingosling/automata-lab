// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Server Worker Engine Tests
// Version: 1.0.0
// Date:    2026-08-14
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies staged hosting, bounded session storage, request coordination, revisions, and pinned
//   runtime isolation.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from "vitest";
import type { ClockPort, UuidPort } from "../../src/application/ports/contracts.js";
import { serializeCanonicalDocument } from "../../src/domain/model/canonicalization.js";
import type { AutomataDocument, FileDocumentV1 } from "../../src/domain/model/contracts.js";
import { createEmptyAuthoringDraft } from "../../src/domain/model/drafts.js";
import { MAXIMUM_FILE_BYTE_COUNT, MAXIMUM_STATE_COUNT } from "../../src/domain/model/limits.js";
import { Sha256ContentHasher } from "../../src/infrastructure/hashing/sha256-content-hasher.js";
import { AutomataDocumentCodec } from "../../src/infrastructure/files/file-codec.js";
import { SerializedServerExecutor } from "../../src/workers/server/coordination.js";
import { stageHostedModel } from "../../src/workers/server/hosting.js";
import
{
    decodeServerOutboundEnvelope,
    SERVER_PROTOCOL_VERSION,
} from "../../src/workers/server/protocol.js";
import type
{
    ServerRequestEnvelope,
    ServerRequestEnvelopeFor,
} from "../../src/workers/server/protocol.js";
import
{
    MAXIMUM_SERVER_SESSION_COUNT,
    MAXIMUM_RETAINED_REQUEST_IDENTIFIER_COUNT,
    MAXIMUM_SESSION_TRACE_LENGTH,
    RecentRequestIdentifierRepository,
    SimulationSessionRepository,
} from "../../src/workers/server/repositories.js";
import { ServerState } from "../../src/workers/server/server-state.js";
import { ServerEngine } from "../../src/workers/server/server-engine.js";
import { readExampleText } from "../model/example-helpers.js";

//--------------------------------------------------------------------------------------------------
// Class: SequentialUuidPort
//
// Description:
//
//   Defines the boundary used by sequential uuid.
//
//--------------------------------------------------------------------------------------------------

class SequentialUuidPort implements UuidPort
{
    private nextIdentifier = 1;

    //----------------------------------------------------------------------------------------------
    // Method: create
    //
    // Description:
    //
    //   Derives the create.
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
    //----------------------------------------------------------------------------------------------

    public create (): string
    {
        // Initialize the local values needed by this operation.

        const suffix = this.nextIdentifier.toString ( 16 ).padStart ( 12, "0" );

        this.nextIdentifier++;

        // Return the computed result.

        return `00000000-0000-4000-8000-${suffix}`;
    }
}

//--------------------------------------------------------------------------------------------------
// Class: SequentialClockPort
//
// Description:
//
//   Defines the boundary used by sequential clock.
//
//--------------------------------------------------------------------------------------------------

class SequentialClockPort implements ClockPort
{
    private elapsedSeconds = 0;

    //----------------------------------------------------------------------------------------------
    // Method: nowUtc
    //
    // Description:
    //
    //   Derives the now utc.
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
    //----------------------------------------------------------------------------------------------

    public nowUtc (): string
    {
        // Initialize the local values needed by this operation.

        const timestamp = new Date ( Date.UTC ( 2026, 7, 14, 12, 0, this.elapsedSeconds ) ).toISOString ();

        this.elapsedSeconds++;

        // Return the timestamp.

        return timestamp;
    }
}

//--------------------------------------------------------------------------------------------------
// Function: createRequestId
//
// Description:
//
//   Creates request identifier for the test scenario.
//
// Parameters:
//
//   - identifier:
//     The identifier supplied to the operation.
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

function createRequestId ( identifier: number ): string
{
    // Return the computed result.

    return `10000000-0000-4000-8000-${identifier.toString ( 16 ).padStart ( 12, "0" )}`;
}

//--------------------------------------------------------------------------------------------------
// Function: createEngine
//
// Description:
//
//   Creates engine for the test scenario.
//
// Parameters:
//
//   - bundledDocumentText:
//     The bundled document text supplied to the operation.
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

function createEngine (
    bundledDocumentText = readExampleText ( "state-machine-light-switch.json" ),
): ServerEngine
{
    // Return the computed result.

    return new ServerEngine (
        {
            bundledDocumentText,
            clock:         new SequentialClockPort (),
            contentHasher: new Sha256ContentHasher (),
            documentCodec: new AutomataDocumentCodec (),
            uuid:          new SequentialUuidPort (),
        },
    );
}

//--------------------------------------------------------------------------------------------------
// Function: createLoopDocumentText
//
// Description:
//
//   Creates loop document text for the test scenario.
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

function createLoopDocumentText (): string
{
    // Initialize the local values needed by this operation.

    const draft                      = createEmptyAuthoringDraft ();
    const document: AutomataDocument = 
    {
        ...draft,
        stateMachine:
        {
            ...draft.stateMachine,
            initialState: "s",
            events:       [ { name: "e", description: "" } ],
            states:       [ { name: "s", description: "" } ],
            transitionTable:
            [
                { state: "s", event: "e", stateNext: "s" },
            ],
        },
    };

    // Return the computed result.

    return serializeCanonicalDocument ( document ).text;
}

//--------------------------------------------------------------------------------------------------
// Function: createCompactDocumentThatCanonicalizesPastCapacity
//
// Description:
//
//   Creates compact document that canonicalizes past capacity for the test scenario.
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

function createCompactDocumentThatCanonicalizesPastCapacity ():
{
    readonly canonicalDocument: string;
    readonly compactDocument:   string;
}
{
    // Initialize the local values needed by this operation.

    const draft  = createEmptyAuthoringDraft ();
    const states = Array.from ( { length: MAXIMUM_STATE_COUNT }, ( _value, index ) => ( {
        name:        `state_${index}`,
        description: "",
    } ) );
    const baseDocument: AutomataDocument =
    {
        ...draft,
        stateMachine:
        {
            ...draft.stateMachine,
            initialState: states [ 0 ]?.name ?? "state_0",
            states,
        },
    };
    const baseCanonicalDocument = serializeCanonicalDocument ( baseDocument ).text;
    const baseCompactDocument   = JSON.stringify ( JSON.parse ( baseCanonicalDocument ) );
    const baseCompactByteCount  = new TextEncoder ().encode ( baseCompactDocument ).byteLength;
    const descriptionLength     = Math.floor (
        ( MAXIMUM_FILE_BYTE_COUNT - baseCompactByteCount - 1 ) / MAXIMUM_STATE_COUNT,
    );
    const description                        = "x".repeat ( descriptionLength );
    const expandedDocument: AutomataDocument = 
    {
        ...baseDocument,
        stateMachine:
        {
            ...baseDocument.stateMachine,
            states: states.map ( state => ( { ...state, description } ) ),
        },
    };
    const canonicalDocument = serializeCanonicalDocument ( expandedDocument ).text;
    const compactDocument   = JSON.stringify ( JSON.parse ( canonicalDocument ) );

    // Return the assembled result.

    return { canonicalDocument, compactDocument };
}

//--------------------------------------------------------------------------------------------------
// Function: createEmptyRequest
//
// Description:
//
//   Creates empty request for the test scenario.
//
// Parameters:
//
//   - operation:
//     The operation supplied to the operation.
//
//   - identifier:
//     The identifier supplied to the operation.
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

function createEmptyRequest (
    operation: "health.live" | "health.ready" | "model.get" | "server.hello" | "simulation.start",
    identifier: number,
): ServerRequestEnvelope
{
    // Return the computed result.

    return {
        protocol: SERVER_PROTOCOL_VERSION,
        kind: "request",
        requestId: createRequestId ( identifier ),
        operation,
        conditionalModelRevision: null,
        sessionId: null,
        payload: {},
    } as ServerRequestEnvelope;
}

//--------------------------------------------------------------------------------------------------
// Function: createServerState
//
// Description:
//
//   Creates server state for the test scenario.
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

function createServerState (): ServerState
{
    // Return the computed result.

    return new ServerState (
        {
            contentHasher: new Sha256ContentHasher (),
            documentCodec: new AutomataDocumentCodec (),
            uuid:          new SequentialUuidPort (),
        },
    );
}

//--------------------------------------------------------------------------------------------------
// Function: replaceChartPosition
//
// Description:
//
//   Replaces the chart position.
//
// Parameters:
//
//   - canonicalDocument:
//     The canonical document supplied to the operation.
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

function replaceChartPosition ( canonicalDocument: string ): string
{
    // Initialize the local values needed by this operation.

    const document = JSON.parse ( canonicalDocument ) as FileDocumentV1;

    // Return the computed result.

    return `${JSON.stringify (
        {
            ...document,
            chart:
            {
                ...document.chart,
                states: document.chart.states.map ( ( state, index ) => index === 0
                    ? { ...state, x: state.x + 40 }
                    : state ),
            },
        },
        null,
        2,
    )}\n`;
}

//--------------------------------------------------------------------------------------------------
// Function: replaceInitialTransitionDestination
//
// Description:
//
//   Replaces the initial transition destination.
//
// Parameters:
//
//   - canonicalDocument:
//     The canonical document supplied to the operation.
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

function replaceInitialTransitionDestination ( canonicalDocument: string ): string
{
    // Initialize the local values needed by this operation.

    const document = JSON.parse ( canonicalDocument ) as FileDocumentV1;

    // Return the computed result.

    return `${JSON.stringify (
        {
            ...document,
            state_machine:
            {
                ...document.state_machine,
                transition_table: document.state_machine.transition_table.map ( transition =>
                    transition.state === "state_start" && transition.event === "event_toggle_main_supply_on"
                        ? { ...transition, state_next: "state_on" }
                        : transition ),
            },
        },
        null,
        2,
    )}\n`;
}

//--------------------------------------------------------------------------------------------------
// Function: stageLightSwitchModel
//
// Description:
//
//   Derives the stage light switch model.
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

async function stageLightSwitchModel ()
{
    // Initialize the local values needed by this operation.

    const result = await stageHostedModel (
        readExampleText ( "state-machine-light-switch.json" ),
        {
            contentHasher: new Sha256ContentHasher (),
            documentCodec: new AutomataDocumentCodec (),
        },
    );

    // Handle the case where the result is successful condition is not satisfied.

    if ( !result.isSuccessful )
    {
        throw new Error ( `The light-switch fixture did not stage: ${JSON.stringify ( result.diagnostics )}` );
    }

    // Return the computed result.

    return result.hostedModel;
}

describe ( "server repositories", () =>
{
    it ( "rejects recent duplicate request identifiers and evicts only the oldest after 2,048 entries", () =>
    {
        // Initialize the local values needed by this operation.

        const identifiers = new RecentRequestIdentifierRepository ();

        expect ( identifiers.remember ( "request-0" ) ).toBe ( true );
        expect ( identifiers.remember ( "request-0" ) ).toBe ( false );

        // Repeat the operation across the bounded iteration range.

        for ( let index = 1; index <= MAXIMUM_RETAINED_REQUEST_IDENTIFIER_COUNT; index++ )
        {
            expect ( identifiers.remember ( `request-${index}` ) ).toBe ( true );
        }

        expect ( identifiers.remember ( "request-0" ) ).toBe ( true );
        expect ( identifiers.remember ( `request-${MAXIMUM_RETAINED_REQUEST_IDENTIFIER_COUNT}` ) ).toBe ( false );
    } );

    it ( "rejects invalid staging without manufacturing a hosted model", async () =>
    {
        // Initialize the local values needed by this operation.

        const result = await stageHostedModel (
            "{\"not\":\"an Automata Lab document\"}",
            {
                contentHasher: new Sha256ContentHasher (),
                documentCodec: new AutomataDocumentCodec (),
            },
        );

        expect ( result.isSuccessful ).toBe ( false );
    } );

    it ( "rejects a compact document whose canonical form expands past the hosted capacity", async () =>
    {
        // Initialize the local values needed by this operation.

        const documents          = createCompactDocumentThatCanonicalizesPastCapacity ();
        const compactByteCount   = new TextEncoder ().encode ( documents.compactDocument ).byteLength;
        const canonicalByteCount = new TextEncoder ().encode ( documents.canonicalDocument ).byteLength;

        expect ( compactByteCount ).toBeLessThanOrEqual ( MAXIMUM_FILE_BYTE_COUNT );
        expect ( canonicalByteCount ).toBeGreaterThan ( MAXIMUM_FILE_BYTE_COUNT );

        const result = await stageHostedModel (
            documents.compactDocument,
            {
                contentHasher: new Sha256ContentHasher (),
                documentCodec: new AutomataDocumentCodec (),
            },
        );

        expect ( result ).toMatchObject (
            { isSuccessful: false, reason: "DOCUMENT_TOO_LARGE" },
        );

        const serverState = createServerState ();

        await serverState.initialize ( readExampleText ( "state-machine-light-switch.json" ) );

        const previousHostedDocument = serverState.getHostedDocument ();

        // Handle the case where the previous hosted document is successful condition is not
        // satisfied.

        if ( !previousHostedDocument.isSuccessful )
        {
            throw new Error ( "Expected the bundled hosted document before the oversized replacement." );
        }

        const replacement = await serverState.replaceHostedDocument (
            documents.compactDocument,
            previousHostedDocument.value.modelRevision,
        );

        expect ( replacement ).toMatchObject (
            { isSuccessful: false, failure: { code: "DOCUMENT_TOO_LARGE" } },
        );
        expect ( serverState.getHostedDocument () ).toEqual ( previousHostedDocument );
    } );

    it ( "caps session count without replacing an existing record", async () =>
    {
        // Initialize the local values needed by this operation.

        const hostedModel       = await stageLightSwitchModel ();
        const sessionRepository = new SimulationSessionRepository ();

        // Repeat the operation across the bounded iteration range.

        for ( let index = 0; index < MAXIMUM_SERVER_SESSION_COUNT; index++ )
        {
            expect ( sessionRepository.create ( `session-${index}`, hostedModel ).isSuccessful ).toBe ( true );
        }

        expect ( sessionRepository.create ( "session-over-capacity", hostedModel ) ).toEqual (
            { isSuccessful: false, reason: "SESSION_LIMIT_REACHED" },
        );
        expect ( sessionRepository.get ( "session-0" )?.hostedModel.modelRevision )
            .toBe ( hostedModel.modelRevision );
    } );

    it ( "retains the newest bounded traces and reports cumulative truncation explicitly", async () =>
    {
        // Initialize the local values needed by this operation.

        const hostedModel       = await stageLightSwitchModel ();
        const sessionRepository = new SimulationSessionRepository ();
        const created           = sessionRepository.create ( "session-trace", hostedModel );

        expect ( created.isSuccessful ).toBe ( true );

        // Initialize the local values needed by this operation.

        const events = Array.from ( { length: MAXIMUM_SESSION_TRACE_LENGTH + 1 }, () => "event_unknown" );
        const result = sessionRepository.run ( "session-trace", events );
        const stored = sessionRepository.get ( "session-trace" );

        expect ( result?.session.transitionTrace ).toHaveLength ( MAXIMUM_SESSION_TRACE_LENGTH );
        expect ( stored?.processedEventCount ).toBe ( MAXIMUM_SESSION_TRACE_LENGTH + 1 );
        expect ( stored?.traceTruncated ).toBe ( true );

        const reset = sessionRepository.reset ( "session-trace" );

        expect ( reset?.processedEventCount ).toBe ( 0 );
        expect ( reset?.traceTruncated ).toBe ( false );
        expect ( reset?.runtimeSession.transitionTrace ).toEqual ( [] );
        expect ( reset?.runtimeSession.actionTrace ).toEqual ( [] );
    } );
} );

describe ( "server request coordination", () =>
{
    it ( "serializes asynchronous operations and continues after a rejected operation", async () =>
    {
        // Initialize the local values needed by this operation.

        const executor                    = new SerializedServerExecutor ();
        const firstOperationRelease       = Promise.withResolvers<void> ();
        const startedOperations: string[] = [];

        const firstOperation = executor.execute ( async () =>
        {
            startedOperations.push ( "first" );
            await firstOperationRelease.promise;

            // Return the computed result.

            return "first-result";
        } );
        const secondOperation = executor.execute ( () =>
        {
            startedOperations.push ( "second" );
            throw new Error ( "expected test rejection" );
        } );
        const thirdOperation = executor.execute ( () =>
        {
            startedOperations.push ( "third" );

            // Return the computed result.

            return "third-result";
        } );

        await Promise.resolve ();
        expect ( startedOperations ).toEqual ( [ "first" ] );

        firstOperationRelease.resolve ();

        await expect ( firstOperation ).resolves.toBe ( "first-result" );
        await expect ( secondOperation ).rejects.toThrow ( "expected test rejection" );
        await expect ( thirdOperation ).resolves.toBe ( "third-result" );
        expect ( startedOperations ).toEqual ( [ "first", "second", "third" ] );
    } );
} );

describe ( "server state", () =>
{
    it ( "remains live-state compatible but not ready when bundled startup validation fails", async () =>
    {
        // Initialize the local values needed by this operation.

        const serverState = createServerState ();
        const readiness   = await serverState.initialize ( "{\"invalid\":true}" );

        expect ( readiness.ready ).toBe ( false );
        expect ( readiness.modelRevision ).toBeNull ();
        expect ( readiness.diagnostics.length ).toBeGreaterThan ( 0 );
        expect ( serverState.getHostedDocument () ).toMatchObject (
            { isSuccessful: false, failure: { code: "SERVER_NOT_READY" } },
        );
    } );

    it ( "rejects conflicts and invalid documents without changing the hosted head", async () =>
    {
        // Initialize the local values needed by this operation.

        const serverState = createServerState ();

        await serverState.initialize ( readExampleText ( "state-machine-light-switch.json" ) );

        const before = serverState.getHostedDocument ();

        // Handle the case where the before is successful condition is not satisfied.

        if ( !before.isSuccessful )
        {
            throw new Error ( "Expected a ready hosted model." );
        }

        // Initialize the local values needed by this operation.

        const conflict = await serverState.replaceHostedDocument (
            before.value.canonicalDocument,
            "sha256:obsolete",
        );
        const invalid = await serverState.replaceHostedDocument ( "{}", before.value.modelRevision );

        expect ( conflict ).toMatchObject (
            { isSuccessful: false, failure: { code: "MODEL_REVISION_CONFLICT" } },
        );
        expect ( invalid ).toMatchObject ( { isSuccessful: false, failure: { code: "MODEL_INVALID" } } );
        expect ( serverState.getHostedDocument () ).toEqual ( before );
    } );

    it ( "treats canonical repeats as no-ops and replaces nonsemantic content at the same revision", async () =>
    {
        // Initialize the local values needed by this operation.

        const serverState = createServerState ();

        await serverState.initialize ( readExampleText ( "state-machine-light-switch.json" ) );

        const hosted = serverState.getHostedDocument ();

        // Handle the case where the hosted is successful condition is not satisfied.

        if ( !hosted.isSuccessful )
        {
            throw new Error ( "Expected a ready hosted model." );
        }

        // Initialize the local values needed by this operation.

        const session  = serverState.startSession ();
        const repeated = await serverState.replaceHostedDocument (
            hosted.value.canonicalDocument,
            hosted.value.modelRevision,
        );
        const chartDocument = replaceChartPosition ( hosted.value.canonicalDocument );
        const chartOnly     = await serverState.replaceHostedDocument (
            chartDocument,
            hosted.value.modelRevision,
        );

        expect ( repeated ).toMatchObject (
            { isSuccessful: true, value: { disposition: "unchanged", modelRevision: hosted.value.modelRevision } },
        );
        expect ( chartOnly ).toMatchObject (
            { isSuccessful: true, value: { disposition: "replaced", modelRevision: hosted.value.modelRevision } },
        );

        // Handle the case where the session is successful condition is not satisfied.

        if ( !session.isSuccessful )
        {
            throw new Error ( "Expected session creation to succeed." );
        }

        const stepped = serverState.stepSession ( session.value.sessionId, [] );

        expect ( stepped ).toMatchObject (
            {
                isSuccessful: true,
                value:
                {
                    session:
                    {
                        pinnedModelRevision: hosted.value.modelRevision,
                        isStale:             false,
                    },
                },
            },
        );
        expect ( serverState.getHostedDocument () ).toMatchObject (
            { isSuccessful: true, value: { canonicalDocument: chartDocument } },
        );
    } );

    it ( "pins sessions across semantic replacement and gives new sessions the new compiled model", async () =>
    {
        // Initialize the local values needed by this operation.

        const serverState = createServerState ();

        await serverState.initialize ( readExampleText ( "state-machine-light-switch.json" ) );

        // Initialize the local values needed by this operation.

        const hosted     = serverState.getHostedDocument ();
        const oldSession = serverState.startSession ();

        // Handle the case where at least one branch condition is satisfied.

        if ( !hosted.isSuccessful || !oldSession.isSuccessful )
        {
            throw new Error ( "Expected startup and session creation to succeed." );
        }

        // Initialize the local values needed by this operation.

        const semanticDocument = replaceInitialTransitionDestination ( hosted.value.canonicalDocument );
        const replacement      = await serverState.replaceHostedDocument (
            semanticDocument,
            hosted.value.modelRevision,
        );

        // Handle the case where the replacement is successful condition is not satisfied.

        if ( !replacement.isSuccessful )
        {
            throw new Error ( "Expected semantic replacement to succeed." );
        }

        const newSession = serverState.startSession ();

        // Handle the case where the new session is successful condition is not satisfied.

        if ( !newSession.isSuccessful )
        {
            throw new Error ( "Expected current-head session creation to succeed." );
        }

        // Initialize the local values needed by this operation.

        const oldRun = serverState.runSession (
            oldSession.value.sessionId,
            [ "  ", " event_toggle_main_supply_on " ],
        );
        const newRun = serverState.runSession (
            newSession.value.sessionId,
            [ "event_toggle_main_supply_on" ],
        );

        expect ( replacement.value.modelRevision ).not.toBe ( hosted.value.modelRevision );
        expect ( oldRun ).toMatchObject (
            {
                isSuccessful: true,
                value:
                {
                    consumedEventCount: 1,
                    session:
                    {
                        currentState:        "state_off",
                        processedEventCount: 1,
                        isStale:             true,
                    },
                },
            },
        );
        expect ( newRun ).toMatchObject (
            {
                isSuccessful: true,
                value:
                {
                    session:
                    {
                        currentState:        "state_on",
                        pinnedModelRevision: replacement.value.modelRevision,
                        isStale:             false,
                    },
                },
            },
        );
    } );

    it ( "steps, resets, and closes a session without exposing repository internals", async () =>
    {
        // Initialize the local values needed by this operation.

        const serverState = createServerState ();

        await serverState.initialize ( readExampleText ( "state-machine-light-switch.json" ) );

        const started = serverState.startSession ();

        // Handle the case where the started is successful condition is not satisfied.

        if ( !started.isSuccessful )
        {
            throw new Error ( "Expected session creation to succeed." );
        }

        // Initialize the local values needed by this operation.

        const stepped = serverState.stepSession (
            started.value.sessionId,
            [ "event_toggle_main_supply_on", "event_toggle_on" ],
        );
        const reset  = serverState.resetSession ( started.value.sessionId );
        const closed = serverState.closeSession ( started.value.sessionId );
        const absent = serverState.resetSession ( started.value.sessionId );

        expect ( stepped ).toMatchObject (
            { isSuccessful: true, value: { consumedEventCount: 1, session: { currentState: "state_off" } } },
        );
        expect ( reset ).toMatchObject (
            {
                isSuccessful: true,
                value:
                {
                    currentState:               "state_start",
                    initialEntryActionsPending: true,
                    processedEventCount:        0,
                    traceTruncated:             false,
                    transitionTrace:            [],
                    actionTrace:                [],
                },
            },
        );
        expect ( closed ).toEqual (
            { isSuccessful: true, value: { sessionId: started.value.sessionId, closed: true } },
        );
        expect ( absent ).toMatchObject ( { isSuccessful: false, failure: { code: "SESSION_NOT_FOUND" } } );
        expect ( Object.hasOwn ( started.value, "hostedModel" ) ).toBe ( false );
        expect ( Object.hasOwn ( started.value, "compiledModel" ) ).toBe ( false );
    } );
} );

describe ( "server engine", () =>
{
    it ( "posts ordered startup lifecycle and serves hello from the initialized hosted head", async () =>
    {
        // Initialize the local values needed by this operation.

        const engine  = createEngine ();
        const startup = await engine.start ();
        const hello   = await engine.handle ( createEmptyRequest ( "server.hello", 1 ) );

        expect ( startup ).toMatchObject (
            [
                { kind: "event", event: "server.lifecycle", serverSequence: 1, payload: { phase: "starting" } },
                { kind: "event", event: "server.lifecycle", serverSequence: 2, payload: { phase: "ready" } },
            ],
        );
        expect ( hello ).toMatchObject (
            [
                {
                    kind: "success",
                    operation: "server.hello",
                    serverSequence: 3,
                    result:
                    {
                        protocol: SERVER_PROTOCOL_VERSION,
                        ready: true,
                        modelRevision: expect.stringMatching ( /^sha256:[0-9a-f]{64}$/u ),
                    },
                },
            ],
        );
    } );

    it ( "stays live but not ready and redacts an invalid bundled startup document", async () =>
    {
        // Initialize the local values needed by this operation.

        const engine    = createEngine ( "{\"invalid\":true}" );
        const startup   = await engine.start ();
        const live      = await engine.handle ( createEmptyRequest ( "health.live", 2 ) );
        const readiness = await engine.handle ( createEmptyRequest ( "health.ready", 3 ) );
        const model     = await engine.handle ( createEmptyRequest ( "model.get", 4 ) );

        expect ( startup ).toMatchObject (
            [
                { kind: "event", event: "server.lifecycle", payload: { phase: "starting" } },
                { kind: "event", event: "server.lifecycle", payload: { phase: "failed" } },
                { kind: "event", event: "server.diagnostic" },
            ],
        );
        expect ( JSON.stringify ( startup ) ).not.toContain ( "{\\\"invalid\\\":true}" );
        expect ( live ).toMatchObject ( [ { kind: "success", result: { live: true } } ] );
        expect ( readiness ).toMatchObject ( [ { kind: "success", result: { ready: false } } ] );
        expect ( model ).toMatchObject (
            [ { kind: "error", error: { code: "SERVER_NOT_READY" } } ],
        );
    } );

    it ( "correlates invalid requests, rejects duplicates, and emits only redacted events when correlation fails", async () =>
    {
        // Initialize the local values needed by this operation.

        const correlatedRequestId      = createRequestId ( 5 );
        const correlatedInvalidRequest = 
        {
            protocol: SERVER_PROTOCOL_VERSION,
            kind: "request",
            requestId: correlatedRequestId,
            operation: "model.put",
            conditionalModelRevision: `sha256:${"0".repeat ( 64 )}`,
            sessionId: null,
            payload:
            {
                canonicalDocument: 42,
            },
        };
        const engine = createEngine ();

        await engine.start ();

        // Initialize the local values needed by this operation.

        const correlated   = await engine.handle ( correlatedInvalidRequest );
        const duplicate    = await engine.handle ( correlatedInvalidRequest );
        const uncorrelated = await engine.handle ( "uncorrelated-secret-model" );

        expect ( correlated ).toMatchObject (
            [ { kind: "error", requestId: correlatedRequestId, error: { code: "PAYLOAD_INVALID" } } ],
        );
        expect ( duplicate ).toMatchObject (
            [ { kind: "error", requestId: correlatedRequestId, error: { code: "DUPLICATE_REQUEST_ID" } } ],
        );
        expect ( uncorrelated ).toMatchObject (
            [ { kind: "event", event: "server.diagnostic", payload: { diagnostic: { code: "SERVER_REQUEST_DROPPED" } } } ],
        );
        expect ( JSON.stringify ( uncorrelated ) ).not.toContain ( "secret-model" );
    } );

    it ( "serializes concurrent conditional puts so only the first matching semantic replacement commits", async () =>
    {
        // Initialize the local values needed by this operation.

        const engine = createEngine ();

        await engine.start ();

        // Initialize the local values needed by this operation.

        const modelResponse = await engine.handle ( createEmptyRequest ( "model.get", 6 ) );
        const firstMessage  = modelResponse [ 0 ];

        // Handle the case where at least one branch condition is satisfied.

        if ( firstMessage?.kind !== "success" || firstMessage.operation !== "model.get" )
        {
            throw new Error ( "Expected model.get to return the hosted document." );
        }

        // Initialize the local values needed by this operation.

        const baselineRevision = firstMessage.result.modelRevision;
        const firstDocument    = replaceInitialTransitionDestination ( firstMessage.result.canonicalDocument );
        const parsedDocument   = JSON.parse ( firstMessage.result.canonicalDocument ) as FileDocumentV1;
        const secondDocument   = `${JSON.stringify (
            {
                ...parsedDocument,
                settings: { ...parsedDocument.settings, description: "A competing semantic replacement." },
            },
            null,
            2,
        )}\n`;
        const firstRequest: ServerRequestEnvelope =
        {
            protocol: SERVER_PROTOCOL_VERSION,
            kind: "request",
            requestId: createRequestId ( 7 ),
            operation: "model.put",
            conditionalModelRevision: baselineRevision,
            sessionId: null,
            payload: { canonicalDocument: firstDocument },
        };
        const secondRequest: ServerRequestEnvelope =
        {
            protocol: SERVER_PROTOCOL_VERSION,
            kind: "request",
            requestId: createRequestId ( 8 ),
            operation: "model.put",
            conditionalModelRevision: baselineRevision,
            sessionId: null,
            payload: { canonicalDocument: secondDocument },
        };

        const [ firstResult, secondResult ] = await Promise.all (
            [ engine.handle ( firstRequest ), engine.handle ( secondRequest ) ],
        );

        expect ( firstResult ).toMatchObject (
            [
                { kind: "success", operation: "model.put", result: { disposition: "replaced" } },
                { kind: "event", event: "model.changed", payload: { disposition: "replaced" } },
            ],
        );
        expect ( secondResult ).toMatchObject (
            [ { kind: "error", operation: "model.put", error: { code: "MODEL_REVISION_CONFLICT" } } ],
        );

        const currentResponse = await engine.handle ( createEmptyRequest ( "model.get", 9 ) );

        expect ( currentResponse ).toMatchObject (
            [ { kind: "success", result: { canonicalDocument: firstDocument } } ],
        );
    } );

    it ( "rejects an oversized event symbol before mutation and emits a decodable correlated error", async () =>
    {
        // Initialize the local values needed by this operation.

        const engine               = createEngine ( createLoopDocumentText () );
        const startup              = await engine.start ();
        let previousServerSequence = 0;

        // Process each message from the startup collection in order.

        for ( const message of startup )
        {
            // Initialize the local values needed by this operation.

            const decoded = decodeServerOutboundEnvelope ( message, previousServerSequence );

            expect ( decoded.isSuccessful ).toBe ( true );

            // Handle the case where decoded is successful is enabled.

            if ( decoded.isSuccessful )
            {
                previousServerSequence = decoded.message.serverSequence;
            }
        }

        // Initialize the local values needed by this operation.

        const started        = await engine.handle ( createEmptyRequest ( "simulation.start", 20 ) );
        const startedMessage = started [ 0 ];

        // Handle the case where at least one branch condition is satisfied.

        if ( startedMessage?.kind !== "success" || startedMessage.operation !== "simulation.start" )
        {
            throw new Error ( "Expected simulation.start to create a session." );
        }

        previousServerSequence = startedMessage.serverSequence;

        // Initialize the local values needed by this operation.

        const oversizedRequest: ServerRequestEnvelopeFor<"simulation.run"> =
        {
            conditionalModelRevision: null,
            kind:      "request",
            operation: "simulation.run",
            payload:   { events: [ "x".repeat ( 4_097 ) ] },
            protocol:  SERVER_PROTOCOL_VERSION,
            requestId: createRequestId ( 21 ),
            sessionId: startedMessage.result.sessionId,
        };
        const rejected         = await engine.handle ( oversizedRequest );
        const rejectedMessage  = rejected [ 0 ];
        const decodedRejection = decodeServerOutboundEnvelope ( rejectedMessage, previousServerSequence );

        expect ( decodedRejection ).toMatchObject (
            { isSuccessful: true, message: { kind: "error", error: { code: "PAYLOAD_INVALID" } } },
        );

        // Handle the case where rejected message matches undefined.

        if ( rejectedMessage === undefined )
        {
            throw new Error ( "Expected a correlated rejection." );
        }

        // Initialize the local values needed by this operation.

        const unchangedRequest: ServerRequestEnvelopeFor<"simulation.run"> =
        {
            ...oversizedRequest,
            payload:   { events: [] },
            requestId: createRequestId ( 22 ),
        };
        const unchanged = await engine.handle ( unchangedRequest );

        expect ( unchanged ).toMatchObject (
            [ { kind: "success", result: { session: { processedEventCount: 0 } } } ],
        );
    } );

    it ( "projects the newest byte-safe operation suffix without rolling back committed events", async () =>
    {
        // Initialize the local values needed by this operation.

        const engine = createEngine ( createLoopDocumentText () );

        await engine.start ();

        // Initialize the local values needed by this operation.

        const started        = await engine.handle ( createEmptyRequest ( "simulation.start", 25 ) );
        const startedMessage = started [ 0 ];

        // Handle the case where at least one branch condition is satisfied.

        if ( startedMessage?.kind !== "success" || startedMessage.operation !== "simulation.start" )
        {
            throw new Error ( "Expected simulation.start to create a session." );
        }

        // Initialize the local values needed by this operation.

        const boundedUnknownEvent                                 = "x".repeat ( 128 );
        const request: ServerRequestEnvelopeFor<"simulation.run"> = 
        {
            conditionalModelRevision: null,
            kind:      "request",
            operation: "simulation.run",
            payload:
            {
                events: Array.from ( { length: 10_000 }, () => boundedUnknownEvent ),
            },
            protocol:  SERVER_PROTOCOL_VERSION,
            requestId: createRequestId ( 26 ),
            sessionId: startedMessage.result.sessionId,
        };
        const messages = await engine.handle ( request );
        const decoded  = decodeServerOutboundEnvelope ( messages [ 0 ], startedMessage.serverSequence );

        expect ( decoded.isSuccessful ).toBe ( true );

        // Handle the case where at least one branch condition is satisfied.

        if ( !decoded.isSuccessful || decoded.message.kind !== "success" ||
            decoded.message.operation !== "simulation.run" )
        {
            throw new Error ( "Expected a decodable simulation.run success response." );
        }

        expect ( decoded.message.result.session.processedEventCount ).toBe ( 10_000 );
        expect ( decoded.message.result.session.traceTruncated ).toBe ( true );
        expect ( decoded.message.result.session.transitionTrace.length ).toBeLessThan ( 10_000 );
        expect ( decoded.message.result.warnings.length ).toBeLessThan ( 10_000 );
        expect ( decoded.message.result.session.transitionTrace.at ( -1 )?.event ).toBe ( boundedUnknownEvent );
    } );

    it ( "round-trips a retained 50,000-entry trace through the strict outbound decoder", async () =>
    {
        // Initialize the local values needed by this operation.

        const engine               = createEngine ( createLoopDocumentText () );
        const startup              = await engine.start ();
        let previousServerSequence = 0;

        // Process each message from the startup collection in order.

        for ( const message of startup )
        {
            // Initialize the local values needed by this operation.

            const decoded = decodeServerOutboundEnvelope ( message, previousServerSequence );

            // Handle the case where the decoded is successful condition is not satisfied.

            if ( !decoded.isSuccessful )
            {
                throw new Error ( `Startup output did not decode: ${decoded.message}` );
            }

            previousServerSequence = decoded.message.serverSequence;
        }

        // Initialize the local values needed by this operation.

        const started        = await engine.handle ( createEmptyRequest ( "simulation.start", 30 ) );
        const startedMessage = started [ 0 ];

        // Handle the case where at least one branch condition is satisfied.

        if ( startedMessage?.kind !== "success" || startedMessage.operation !== "simulation.start" )
        {
            throw new Error ( "Expected simulation.start to create a session." );
        }

        const decodedStart = decodeServerOutboundEnvelope ( startedMessage, previousServerSequence );

        expect ( decodedStart.isSuccessful ).toBe ( true );
        previousServerSequence = startedMessage.serverSequence;

        const eventBuffer = Array.from ( { length: 10_000 }, () => "e" );

        // Repeat the operation across the bounded iteration range.

        for ( let batchIndex = 0; batchIndex < 5; batchIndex++ )
        {
            // Initialize the local values needed by this operation.

            const request: ServerRequestEnvelopeFor<"simulation.run"> =
            {
                conditionalModelRevision: null,
                kind:      "request",
                operation: "simulation.run",
                payload:   { events: eventBuffer },
                protocol:  SERVER_PROTOCOL_VERSION,
                requestId: createRequestId ( 31 + batchIndex ),
                sessionId: startedMessage.result.sessionId,
            };
            const messages = await engine.handle ( request );
            const message  = messages [ 0 ];
            const decoded  = decodeServerOutboundEnvelope ( message, previousServerSequence );

            expect ( decoded.isSuccessful ).toBe ( true );

            // Handle the case where at least one branch condition is satisfied.

            if ( !decoded.isSuccessful || decoded.message.kind !== "success" ||
                decoded.message.operation !== "simulation.run" )
            {
                throw new Error ( "Expected a decodable simulation.run success response." );
            }

            previousServerSequence = decoded.message.serverSequence;

            // Handle the case where batch index matches 4.

            if ( batchIndex === 4 )
            {
                expect ( decoded.message.result.session.transitionTrace ).toHaveLength ( 50_000 );
                expect ( decoded.message.result.session.traceTruncated ).toBe ( false );
                expect ( decoded.message.result.session.processedEventCount ).toBe ( 50_000 );
            }
        }
    } );

    it ( "returns session DTOs without exposing compiled snapshots by reference", async () =>
    {
        // Initialize the local values needed by this operation.

        const engine = createEngine ();

        await engine.start ();

        const started = await engine.handle ( createEmptyRequest ( "simulation.start", 10 ) );

        expect ( started ).toMatchObject (
            [
                {
                    kind: "success",
                    operation: "simulation.start",
                    result:
                    {
                        isStale: false,
                        processedEventCount: 0,
                        traceTruncated: false,
                    },
                },
            ],
        );
        expect ( JSON.stringify ( started ) ).not.toContain ( "compiledModel" );
        expect ( JSON.stringify ( started ) ).not.toContain ( "hostedModel" );
    } );
} );
