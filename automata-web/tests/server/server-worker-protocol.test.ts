// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Server Worker Protocol Tests
// Version: 1.0.0
// Date:    2026-08-14
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies the exact, bounded, correlated, and exhaustively discriminated Server Worker message
//   codecs.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from "vitest";
import
{
    decodeServerOutboundEnvelope,
    decodeServerRequestEnvelope,
    isValidServerModelRevision,
    isValidServerUtcTimestamp,
    isValidServerUuid,
    MAXIMUM_SERVER_DIAGNOSTIC_COUNT,
    MAXIMUM_SERVER_DOCUMENT_BYTE_COUNT,
    MAXIMUM_SERVER_EVENT_COUNT_PER_REQUEST,
    SERVER_PROTOCOL_LIMITS,
    SERVER_PROTOCOL_OPERATIONS,
    SERVER_PROTOCOL_VERSION,
} from "../../src/workers/server/protocol.js";
import type
{
    ServerOperation,
    ServerProtocolDiagnostic,
} from "../../src/workers/server/protocol.js";

const REQUEST_ID              = "10000000-0000-4000-8000-000000000001";
const SESSION_ID              = "20000000-0000-4000-8000-000000000002";
const INSTANCE_ID             = "30000000-0000-4000-8000-000000000003";
const MODEL_REVISION          = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const PREVIOUS_MODEL_REVISION = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const TIMESTAMP_UTC           = "2026-08-14T12:34:56.789Z";

//--------------------------------------------------------------------------------------------------
// Function: createRequest
//
// Description:
//
//   Creates request for the test scenario.
//
// Parameters:
//
//   - operation:
//     The operation supplied to the operation.
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

function createRequest ( operation: ServerOperation ): Record<string, unknown>
{
    // Initialize the local values needed by this operation.

    let conditionalModelRevision: string | null = null;
    let sessionId: string | null                = null;
    let payload: Record<string, unknown>        = {};

    // Handle the case where operation matches "model.put".

    if ( operation === "model.put" )
    {
        conditionalModelRevision = MODEL_REVISION;
        payload                  = { canonicalDocument: "{}\n" };
    }

    // Handle the case where at least one branch condition is satisfied.

    if ( operation === "simulation.run" || operation === "simulation.step" )
    {
        sessionId = SESSION_ID;
        payload   = { events: [ "event_one", "event_two" ] };
    }

    // Handle the case where at least one branch condition is satisfied.

    if ( operation === "simulation.reset" || operation === "simulation.close" )
    {
        sessionId = SESSION_ID;
    }

    // Return the assembled result.

    return {
        protocol: SERVER_PROTOCOL_VERSION,
        kind: "request",
        requestId: REQUEST_ID,
        operation,
        conditionalModelRevision,
        sessionId,
        payload,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: createDiagnostic
//
// Description:
//
//   Creates diagnostic for the test scenario.
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

function createDiagnostic (): ServerProtocolDiagnostic
{
    // Return the assembled result.

    return {
        code:        "SERVER_TEST",
        severity:    "warning",
        source:      "server",
        message:     "Bounded test diagnostic.",
        remediation: "Retry the operation.",
        path:        null,
        context:     null,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: createSessionSnapshot
//
// Description:
//
//   Creates session snapshot for the test scenario.
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

function createSessionSnapshot (): Record<string, unknown>
{
    // Return the assembled result.

    return {
        sessionId: SESSION_ID,
        pinnedModelRevision: MODEL_REVISION,
        isStale: false,
        currentState: "state_ready",
        initialEntryActionsPending: true,
        processedEventCount: 0,
        traceTruncated: false,
        transitionTrace: [],
        actionTrace: [],
    };
}

//--------------------------------------------------------------------------------------------------
// Function: createResult
//
// Description:
//
//   Creates result for the test scenario.
//
// Parameters:
//
//   - operation:
//     The operation supplied to the operation.
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

function createResult ( operation: ServerOperation ): unknown
{
    // Dispatch according to the operation value.

    switch ( operation )
    {
        // Handle the "server.hello" case.

        case "server.hello":

            // Return the assembled result.

            return {
                protocol: SERVER_PROTOCOL_VERSION,
                instanceId: INSTANCE_ID,
                ready: true,
                modelRevision: MODEL_REVISION,
                capabilities: [ ...SERVER_PROTOCOL_OPERATIONS ],
                limits: { ...SERVER_PROTOCOL_LIMITS },
            };

        // Handle the "health.live" case.

        case "health.live":

            // Return the assembled result.

            return { live: true, instanceId: INSTANCE_ID };

        // Handle the "health.ready" case.

        case "health.ready":

            // Return the assembled result.

            return { ready: true, modelRevision: MODEL_REVISION, diagnostics: [] };

        // Handle the "model.get" case.

        case "model.get":

            // Return the assembled result.

            return { modelRevision: MODEL_REVISION, canonicalDocument: "{}\n" };

        // Handle the "model.put" case.

        case "model.put":

            // Return the assembled result.

            return { modelRevision: MODEL_REVISION, disposition: "replaced" };

        // Handle the group of case values that share the following outcome.

        case "simulation.start":
        case "simulation.reset":

            // Return the create session snapshot result.

            return createSessionSnapshot ();

        // Handle the group of case values that share the following outcome.

        case "simulation.run":
        case "simulation.step":

            // Return the assembled result.

            return {
                session: createSessionSnapshot (),
                consumedEventCount: 1,
                emittedActions: [ "action_open" ],
                warnings:
                [
                    {
                        code: "NO_TRANSITION",
                        event: "event_missing",
                        message: "No transition was defined.",
                    },
                ],
            };

        // Handle the "simulation.close" case.

        case "simulation.close":

            // Return the assembled result.

            return { sessionId: SESSION_ID, closed: true };
    }
}

//--------------------------------------------------------------------------------------------------
// Function: createSuccessEnvelope
//
// Description:
//
//   Creates success envelope for the test scenario.
//
// Parameters:
//
//   - operation:
//     The operation supplied to the operation.
//
//   - serverSequence:
//     The server sequence supplied to the operation.
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

function createSuccessEnvelope ( operation: ServerOperation, serverSequence = 1 ): Record<string, unknown>
{
    // Return the assembled result.

    return {
        protocol: SERVER_PROTOCOL_VERSION,
        kind: "success",
        requestId: REQUEST_ID,
        operation,
        serverSequence,
        timestampUtc: TIMESTAMP_UTC,
        result: createResult ( operation ),
    };
}

describe ( "Server Worker request codec", () =>
{
    it ( "decodes the operation-specific shape for every supported operation", () =>
    {
        expect ( SERVER_PROTOCOL_OPERATIONS ).toHaveLength ( 10 );

        // Process each operation from the server protocol operations collection in order.

        for ( const operation of SERVER_PROTOCOL_OPERATIONS )
        {
            // Initialize the local values needed by this operation.

            const result = decodeServerRequestEnvelope ( createRequest ( operation ) );

            expect ( result.isSuccessful, operation ).toBe ( true );

            // Handle the case where result is successful is enabled.

            if ( result.isSuccessful )
            {
                expect ( result.request.operation ).toBe ( operation );
                expect ( Reflect.ownKeys ( result.request ) ).toHaveLength ( 7 );
            }
        }
    } );

    it ( "rejects missing and additional keys while preserving a recoverable request UUID", () =>
    {
        // Initialize the local values needed by this operation.

        const additionalKeyRequest = { ...createRequest ( "health.live" ), unexpected: true };
        const missingKeyRequest    = createRequest ( "health.live" );

        delete missingKeyRequest [ "payload" ];

        // Process each request from the current value collection in order.

        for ( const request of [ additionalKeyRequest, missingKeyRequest ] )
        {
            // Initialize the local values needed by this operation.

            const result = decodeServerRequestEnvelope ( request );

            expect ( result ).toMatchObject (
                {
                    isSuccessful: false,
                    isCorrelated: true,
                    requestId: REQUEST_ID,
                    error: { code: "REQUEST_SHAPE_INVALID" },
                },
            );
        }
    } );

    it ( "returns an uncorrelated failure when no valid request UUID can be recovered", () =>
    {
        // Initialize the local values needed by this operation.

        const request = { ...createRequest ( "health.live" ), requestId: "not-a-uuid" };
        const result  = decodeServerRequestEnvelope ( request );

        expect ( result ).toMatchObject (
            {
                isSuccessful: false,
                isCorrelated: false,
                requestId: null,
                error: { code: "REQUEST_ID_INVALID" },
            },
        );
    } );

    it ( "rejects forbidden prototype keys at any payload depth", () =>
    {
        // Initialize the local values needed by this operation.

        const request                  = createRequest ( "simulation.run" );
        const pollutedPayload: unknown = JSON.parse ( '{"events":[],"nested":{"__proto__":{}}}' );

        request [ "payload" ] = pollutedPayload;

        expect ( decodeServerRequestEnvelope ( request ) ).toMatchObject (
            {
                isSuccessful: false,
                isCorrelated: true,
                error: { code: "PROTOTYPE_KEY_FORBIDDEN" },
            },
        );
    } );

    it ( "rejects cyclic and non-plain structural values", () =>
    {
        // Initialize the local values needed by this operation.

        const cyclicPayload: { self?: unknown } = {};
        const cyclicRequest                     = createRequest ( "health.live" );
        const mapRequest                        = createRequest ( "health.live" );

        cyclicPayload.self          = cyclicPayload;
        cyclicRequest [ "payload" ] = cyclicPayload;
        mapRequest [ "payload" ]    = new Map ();

        expect ( decodeServerRequestEnvelope ( cyclicRequest ) ).toMatchObject (
            { isSuccessful: false, error: { code: "REQUEST_SHAPE_INVALID" } },
        );
        expect ( decodeServerRequestEnvelope ( mapRequest ) ).toMatchObject (
            { isSuccessful: false, error: { code: "REQUEST_SHAPE_INVALID" } },
        );
    } );

    it ( "enforces conditional-revision and session-identifier placement", () =>
    {
        // Initialize the local values needed by this operation.

        const missingConditional    = { ...createRequest ( "model.put" ), conditionalModelRevision: null };
        const unexpectedConditional = { ...createRequest ( "health.live" ), conditionalModelRevision: MODEL_REVISION };
        const missingSession        = { ...createRequest ( "simulation.run" ), sessionId: null };
        const unexpectedSession     = { ...createRequest ( "simulation.start" ), sessionId: SESSION_ID };

        expect ( decodeServerRequestEnvelope ( missingConditional ) ).toMatchObject (
            { isSuccessful: false, error: { code: "CONDITIONAL_MODEL_REVISION_INVALID" } },
        );
        expect ( decodeServerRequestEnvelope ( unexpectedConditional ) ).toMatchObject (
            { isSuccessful: false, error: { code: "CONDITIONAL_MODEL_REVISION_INVALID" } },
        );
        expect ( decodeServerRequestEnvelope ( missingSession ) ).toMatchObject (
            { isSuccessful: false, error: { code: "SESSION_ID_INVALID" } },
        );
        expect ( decodeServerRequestEnvelope ( unexpectedSession ) ).toMatchObject (
            { isSuccessful: false, error: { code: "SESSION_ID_INVALID" } },
        );
    } );

    it ( "accepts 10,000 bounded events and rejects excessive counts or symbols", () =>
    {
        // Initialize the local values needed by this operation.

        const boundedRequest         = createRequest ( "simulation.run" );
        const excessiveRequest       = createRequest ( "simulation.run" );
        const excessiveSymbolRequest = createRequest ( "simulation.run" );

        boundedRequest [ "payload" ] =
        {
            events: Array.from ( { length: MAXIMUM_SERVER_EVENT_COUNT_PER_REQUEST }, () => "event" ),
        };
        excessiveRequest [ "payload" ] =
        {
            events: Array.from ( { length: MAXIMUM_SERVER_EVENT_COUNT_PER_REQUEST + 1 }, () => "event" ),
        };
        excessiveSymbolRequest [ "payload" ] = { events: [ "x".repeat ( 4_097 ) ] };

        expect ( decodeServerRequestEnvelope ( boundedRequest ).isSuccessful ).toBe ( true );
        expect ( decodeServerRequestEnvelope ( excessiveRequest ) ).toMatchObject (
            { isSuccessful: false, error: { code: "PAYLOAD_INVALID" } },
        );
        expect ( decodeServerRequestEnvelope ( excessiveSymbolRequest ) ).toMatchObject (
            { isSuccessful: false, error: { code: "PAYLOAD_INVALID" } },
        );
    } );

    it ( "enforces the 5 MiB document and general payload limits", () =>
    {
        // Initialize the local values needed by this operation.

        const boundedDocumentRequest   = createRequest ( "model.put" );
        const excessiveDocumentRequest = createRequest ( "model.put" );
        const excessivePayloadRequest  = createRequest ( "simulation.run" );

        boundedDocumentRequest [ "payload" ]   = { canonicalDocument: "x".repeat ( MAXIMUM_SERVER_DOCUMENT_BYTE_COUNT ) };
        excessiveDocumentRequest [ "payload" ] = 
        {
            canonicalDocument: "x".repeat ( MAXIMUM_SERVER_DOCUMENT_BYTE_COUNT + 1 ),
        };
        excessivePayloadRequest [ "payload" ] =
        {
            events: [ "x".repeat ( MAXIMUM_SERVER_DOCUMENT_BYTE_COUNT + 1 ) ],
        };

        expect ( decodeServerRequestEnvelope ( boundedDocumentRequest ).isSuccessful ).toBe ( true );
        expect ( decodeServerRequestEnvelope ( excessiveDocumentRequest ) ).toMatchObject (
            { isSuccessful: false, error: { code: "DOCUMENT_TOO_LARGE" } },
        );
        expect ( decodeServerRequestEnvelope ( excessivePayloadRequest ) ).toMatchObject (
            { isSuccessful: false, error: { code: "PAYLOAD_TOO_LARGE" } },
        );
    } );
} );

describe ( "Server Worker outbound codec", () =>
{
    it ( "exhaustively decodes every operation-specific success result", () =>
    {
        // Process each [ index, operation ] from the entries result collection in order.

        for ( const [ index, operation ] of SERVER_PROTOCOL_OPERATIONS.entries () )
        {
            // Calculate the result value from the current inputs.

            const result = decodeServerOutboundEnvelope ( createSuccessEnvelope ( operation, index + 1 ), index );

            expect ( result.isSuccessful, operation ).toBe ( true );

            // Handle the case where result is successful is enabled.

            if ( result.isSuccessful )
            {
                expect ( result.message ).toMatchObject ( { kind: "success", operation } );
            }
        }
    } );

    it ( "rejects unknown and additional nested result properties", () =>
    {
        // Initialize the local values needed by this operation.

        const envelope = createSuccessEnvelope ( "simulation.start" );
        const result   = createSessionSnapshot ();

        result [ "unexpected" ] = true;
        envelope [ "result" ]   = result;

        expect ( decodeServerOutboundEnvelope ( envelope ) ).toMatchObject (
            { isSuccessful: false, code: "OUTBOUND_MESSAGE_INVALID" },
        );
    } );

    it ( "decodes bounded errors and all event discriminants", () =>
    {
        // Initialize the local values needed by this operation.

        const errorEnvelope =
        {
            protocol: SERVER_PROTOCOL_VERSION,
            kind: "error",
            requestId: REQUEST_ID,
            operation: "model.put",
            serverSequence: 11,
            timestampUtc: TIMESTAMP_UTC,
            error:
            {
                code: "MODEL_REVISION_CONFLICT",
                message: "The hosted revision changed.",
                diagnostics: [ createDiagnostic () ],
            },
        };
        const events: readonly Record<string, unknown>[] =
        [
            {
                protocol: SERVER_PROTOCOL_VERSION,
                kind: "event",
                event: "server.lifecycle",
                serverSequence: 12,
                timestampUtc: TIMESTAMP_UTC,
                payload:
                {
                    phase: "ready",
                    instanceId: INSTANCE_ID,
                    modelRevision: MODEL_REVISION,
                    message: "Ready.",
                },
            },
            {
                protocol: SERVER_PROTOCOL_VERSION,
                kind: "event",
                event: "server.diagnostic",
                serverSequence: 13,
                timestampUtc: TIMESTAMP_UTC,
                payload: { diagnostic: createDiagnostic () },
            },
            {
                protocol: SERVER_PROTOCOL_VERSION,
                kind: "event",
                event: "model.changed",
                serverSequence: 14,
                timestampUtc: TIMESTAMP_UTC,
                payload:
                {
                    previousModelRevision: PREVIOUS_MODEL_REVISION,
                    modelRevision: MODEL_REVISION,
                    disposition: "replaced",
                },
            },
        ];

        expect ( decodeServerOutboundEnvelope ( errorEnvelope, 10 ).isSuccessful ).toBe ( true );

        // Process each [ index, event ] from the entries result collection in order.

        for ( const [ index, event ] of events.entries () )
        {
            expect ( decodeServerOutboundEnvelope ( event, index + 11 ).isSuccessful ).toBe ( true );
        }
    } );

    it ( "rejects repeated sequences, malformed UTC timestamps, revisions, and unknown events", () =>
    {
        // Initialize the local values needed by this operation.

        const repeatedSequence   = createSuccessEnvelope ( "health.live", 20 );
        const malformedTimestamp = { ...createSuccessEnvelope ( "health.live", 21 ), timestampUtc: "2026-08-14" };
        const malformedRevision  = createSuccessEnvelope ( "model.put", 22 );
        const unknownEvent       = 
        {
            protocol: SERVER_PROTOCOL_VERSION,
            kind: "event",
            event: "server.unknown",
            serverSequence: 23,
            timestampUtc: TIMESTAMP_UTC,
            payload: {},
        };

        malformedRevision [ "result" ] = { modelRevision: "sha256:ABC", disposition: "replaced" };

        expect ( decodeServerOutboundEnvelope ( repeatedSequence, 20 ) ).toMatchObject (
            { isSuccessful: false, code: "OUTBOUND_SEQUENCE_INVALID" },
        );
        expect ( decodeServerOutboundEnvelope ( malformedTimestamp ) ).toMatchObject (
            { isSuccessful: false, code: "OUTBOUND_TIMESTAMP_INVALID" },
        );
        expect ( decodeServerOutboundEnvelope ( malformedRevision ) ).toMatchObject (
            { isSuccessful: false, code: "OUTBOUND_MESSAGE_INVALID" },
        );
        expect ( decodeServerOutboundEnvelope ( unknownEvent ) ).toMatchObject (
            { isSuccessful: false, code: "OUTBOUND_MESSAGE_INVALID" },
        );
    } );

    it ( "rejects excessive diagnostics and prototype keys", () =>
    {
        // Initialize the local values needed by this operation.

        const excessiveDiagnostics =
        {
            protocol: SERVER_PROTOCOL_VERSION,
            kind: "error",
            requestId: REQUEST_ID,
            operation: null,
            serverSequence: 30,
            timestampUtc: TIMESTAMP_UTC,
            error:
            {
                code: "REQUEST_SHAPE_INVALID",
                message: "Invalid.",
                diagnostics: Array.from (
                    { length: MAXIMUM_SERVER_DIAGNOSTIC_COUNT + 1 },
                    createDiagnostic,
                ),
            },
        };
        const pollutedEvent: unknown = JSON.parse (
            `{"protocol":"${SERVER_PROTOCOL_VERSION}","kind":"event","event":"server.diagnostic",` +
            `"serverSequence":31,"timestampUtc":"${TIMESTAMP_UTC}",` +
            '"payload":{"diagnostic":{"code":"X","severity":"error","source":"server",' +
            '"message":"x","remediation":"x","path":null,"context":null,"constructor":{}}}}',
        );

        expect ( decodeServerOutboundEnvelope ( excessiveDiagnostics ) ).toMatchObject (
            { isSuccessful: false, code: "OUTBOUND_MESSAGE_INVALID" },
        );
        expect ( decodeServerOutboundEnvelope ( pollutedEvent ) ).toMatchObject (
            { isSuccessful: false, code: "OUTBOUND_MESSAGE_INVALID" },
        );
    } );
} );

describe ( "Server Worker protocol primitives", () =>
{
    it ( "validates UUIDs, lowercase SHA-256 revisions, and canonical UTC timestamps", () =>
    {
        expect ( isValidServerUuid ( REQUEST_ID ) ).toBe ( true );
        expect ( isValidServerUuid ( "not-a-uuid" ) ).toBe ( false );
        expect ( isValidServerModelRevision ( MODEL_REVISION ) ).toBe ( true );
        expect ( isValidServerModelRevision ( MODEL_REVISION.toUpperCase () ) ).toBe ( false );
        expect ( isValidServerUtcTimestamp ( TIMESTAMP_UTC ) ).toBe ( true );
        expect ( isValidServerUtcTimestamp ( "2026-08-14T12:34:56Z" ) ).toBe ( false );
        expect ( SERVER_PROTOCOL_LIMITS ).toMatchObject (
            {
                maximumSessionCount: 64,
                maximumTraceEntryCount: 50_000,
                maximumRetainedRequestIdentifierCount: 2_048,
            },
        );
    } );
} );
