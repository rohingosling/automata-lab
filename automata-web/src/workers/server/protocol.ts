// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Server Worker Protocol
// Version: 1.0.0
// Date:    2026-08-14
// Author:  Rohin Gosling
//
// Description:
//
//   Defines the bounded, exhaustively discriminated transport contract for the emulated Server
//   Worker.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import
{
    MAXIMUM_EVENT_BUFFER_COUNT,
    MAXIMUM_FILE_BYTE_COUNT,
    MAXIMUM_NAME_CODE_POINT_COUNT,
} from "../../domain/model/limits.js";

export const SERVER_PROTOCOL_VERSION = "automata-lab-server/1";

export const MAXIMUM_SERVER_PAYLOAD_BYTE_COUNT              = MAXIMUM_FILE_BYTE_COUNT;
export const MAXIMUM_SERVER_DOCUMENT_BYTE_COUNT             = MAXIMUM_FILE_BYTE_COUNT;
export const MAXIMUM_SERVER_EVENT_COUNT_PER_REQUEST          = MAXIMUM_EVENT_BUFFER_COUNT;
export const MAXIMUM_SERVER_SESSION_COUNT                    = 64;
export const MAXIMUM_SERVER_TRACE_ENTRY_COUNT                = 50_000;
export const MAXIMUM_SERVER_RETAINED_REQUEST_IDENTIFIER_COUNT = 2_048;
export const MAXIMUM_SERVER_DIAGNOSTIC_COUNT                 = 100;
export const MAXIMUM_SERVER_DIAGNOSTIC_TEXT_LENGTH           = 4_096;

const MAXIMUM_PROTOCOL_VALUE_NODE_COUNT = 1_000_000;
const UUID_PATTERN                      = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODEL_REVISION_PATTERN            = /^sha256:[0-9a-f]{64}$/;
const UTC_TIMESTAMP_PATTERN             = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const FORBIDDEN_PROPERTY_NAMES          = new Set ( [ "__proto__", "constructor", "prototype" ] );

const REQUEST_ENVELOPE_KEYS =
[
    "protocol",
    "kind",
    "requestId",
    "operation",
    "conditionalModelRevision",
    "sessionId",
    "payload",
] as const;

const SUCCESS_RESPONSE_ENVELOPE_KEYS =
[
    "protocol",
    "kind",
    "requestId",
    "operation",
    "serverSequence",
    "timestampUtc",
    "result",
] as const;

const ERROR_RESPONSE_ENVELOPE_KEYS =
[
    "protocol",
    "kind",
    "requestId",
    "operation",
    "serverSequence",
    "timestampUtc",
    "error",
] as const;

const EVENT_ENVELOPE_KEYS =
[
    "protocol",
    "kind",
    "event",
    "serverSequence",
    "timestampUtc",
    "payload",
] as const;

export const SERVER_PROTOCOL_OPERATIONS =
[
    "server.hello",
    "health.live",
    "health.ready",
    "model.get",
    "model.put",
    "simulation.start",
    "simulation.run",
    "simulation.step",
    "simulation.reset",
    "simulation.close",
] as const;

//--------------------------------------------------------------------------------------------------
// Type: ServerOperation
//
// Description:
//
//   Defines the server operation type.
//
//--------------------------------------------------------------------------------------------------

export type ServerOperation = typeof SERVER_PROTOCOL_OPERATIONS [ number ];

//--------------------------------------------------------------------------------------------------
// Type: ServerModelRevision
//
// Description:
//
//   Defines the server model revision type.
//
//--------------------------------------------------------------------------------------------------

export type ServerModelRevision = `sha256:${string}`;

//--------------------------------------------------------------------------------------------------
// Interface: ServerProtocolLimits
//
// Description:
//
//   Defines the structure of server protocol limits.
//
//--------------------------------------------------------------------------------------------------

export interface ServerProtocolLimits
{
    readonly maximumPayloadByteCount:              number;
    readonly maximumDocumentByteCount:             number;
    readonly maximumEventCountPerRequest:          number;
    readonly maximumSessionCount:                  number;
    readonly maximumTraceEntryCount:               number;
    readonly maximumRetainedRequestIdentifierCount: number;
    readonly maximumDiagnosticCount:               number;
}

export const SERVER_PROTOCOL_LIMITS: ServerProtocolLimits =
{
    maximumPayloadByteCount:              MAXIMUM_SERVER_PAYLOAD_BYTE_COUNT,
    maximumDocumentByteCount:             MAXIMUM_SERVER_DOCUMENT_BYTE_COUNT,
    maximumEventCountPerRequest:          MAXIMUM_SERVER_EVENT_COUNT_PER_REQUEST,
    maximumSessionCount:                  MAXIMUM_SERVER_SESSION_COUNT,
    maximumTraceEntryCount:               MAXIMUM_SERVER_TRACE_ENTRY_COUNT,
    maximumRetainedRequestIdentifierCount: MAXIMUM_SERVER_RETAINED_REQUEST_IDENTIFIER_COUNT,
    maximumDiagnosticCount:               MAXIMUM_SERVER_DIAGNOSTIC_COUNT,
};

//--------------------------------------------------------------------------------------------------
// Type: ServerErrorCode
//
// Description:
//
//   Defines the supported server error code alternatives.
//
//--------------------------------------------------------------------------------------------------

export type ServerErrorCode =
    | "CONDITIONAL_MODEL_REVISION_INVALID"
    | "DOCUMENT_TOO_LARGE"
    | "DUPLICATE_REQUEST_ID"
    | "INTERNAL_ERROR"
    | "MODEL_INVALID"
    | "MODEL_REVISION_CONFLICT"
    | "OPERATION_UNSUPPORTED"
    | "PAYLOAD_INVALID"
    | "PAYLOAD_TOO_LARGE"
    | "PROTOCOL_UNSUPPORTED"
    | "PROTOTYPE_KEY_FORBIDDEN"
    | "REQUEST_ID_INVALID"
    | "REQUEST_KIND_INVALID"
    | "REQUEST_SHAPE_INVALID"
    | "SERVER_NOT_READY"
    | "SESSION_CAPACITY_EXCEEDED"
    | "SESSION_ID_INVALID"
    | "SESSION_NOT_FOUND"
    | "TRACE_CAPACITY_EXCEEDED";

//--------------------------------------------------------------------------------------------------
// Interface: ServerProtocolDiagnostic
//
// Description:
//
//   Defines the structure of server protocol diagnostic.
//
//--------------------------------------------------------------------------------------------------

export interface ServerProtocolDiagnostic
{
    readonly code:        string;
    readonly severity:    "error" | "information" | "warning";
    readonly source:      string;
    readonly message:     string;
    readonly remediation: string;
    readonly path:        string | null;
    readonly context:     string | null;
}

//--------------------------------------------------------------------------------------------------
// Interface: ServerProtocolError
//
// Description:
//
//   Defines the structure of server protocol error.
//
//--------------------------------------------------------------------------------------------------

export interface ServerProtocolError
{
    readonly code:        ServerErrorCode;
    readonly message:     string;
    readonly diagnostics: readonly ServerProtocolDiagnostic[];
}

//--------------------------------------------------------------------------------------------------
// Type: ServerEmptyPayload
//
// Description:
//
//   Defines the server empty payload type.
//
//--------------------------------------------------------------------------------------------------

export type ServerEmptyPayload = Readonly<Record<string, never>>;

//--------------------------------------------------------------------------------------------------
// Interface: ServerModelPutRequestPayload
//
// Description:
//
//   Defines the structure of server model put request payload.
//
//--------------------------------------------------------------------------------------------------

export interface ServerModelPutRequestPayload
{
    readonly canonicalDocument: string;
}

//--------------------------------------------------------------------------------------------------
// Interface: ServerSimulationEventsRequestPayload
//
// Description:
//
//   Defines the structure of server simulation events request payload.
//
//--------------------------------------------------------------------------------------------------

export interface ServerSimulationEventsRequestPayload
{
    readonly events: readonly string[];
}

//--------------------------------------------------------------------------------------------------
// Interface: ServerHelloResult
//
// Description:
//
//   Describes the result produced by server hello.
//
//--------------------------------------------------------------------------------------------------

export interface ServerHelloResult
{
    readonly protocol:     typeof SERVER_PROTOCOL_VERSION;
    readonly instanceId:   string;
    readonly ready:        boolean;
    readonly modelRevision: ServerModelRevision | null;
    readonly capabilities: readonly ServerOperation[];
    readonly limits:       ServerProtocolLimits;
}

//--------------------------------------------------------------------------------------------------
// Interface: ServerHealthLiveResult
//
// Description:
//
//   Describes the result produced by server health live.
//
//--------------------------------------------------------------------------------------------------

export interface ServerHealthLiveResult
{
    readonly live:       true;
    readonly instanceId: string;
}

//--------------------------------------------------------------------------------------------------
// Interface: ServerHealthReadyResult
//
// Description:
//
//   Describes the result produced by server health ready.
//
//--------------------------------------------------------------------------------------------------

export interface ServerHealthReadyResult
{
    readonly ready:        boolean;
    readonly modelRevision: ServerModelRevision | null;
    readonly diagnostics:  readonly ServerProtocolDiagnostic[];
}

//--------------------------------------------------------------------------------------------------
// Interface: ServerModelGetResult
//
// Description:
//
//   Describes the result produced by server model get.
//
//--------------------------------------------------------------------------------------------------

export interface ServerModelGetResult
{
    readonly modelRevision:     ServerModelRevision;
    readonly canonicalDocument: string;
}

//--------------------------------------------------------------------------------------------------
// Interface: ServerModelPutResult
//
// Description:
//
//   Describes the result produced by server model put.
//
//--------------------------------------------------------------------------------------------------

export interface ServerModelPutResult
{
    readonly modelRevision: ServerModelRevision;
    readonly disposition:   "replaced" | "unchanged";
}

//--------------------------------------------------------------------------------------------------
// Interface: ServerTransitionTraceEntry
//
// Description:
//
//   Defines the structure of server transition trace entry.
//
//--------------------------------------------------------------------------------------------------

export interface ServerTransitionTraceEntry
{
    readonly event:            string;
    readonly sourceState:      string;
    readonly destinationState: string;
    readonly outcome:          "NO_TRANSITION" | "TRANSITION" | "UNKNOWN_EVENT";
}

//--------------------------------------------------------------------------------------------------
// Interface: ServerActionTraceEntry
//
// Description:
//
//   Defines the structure of server action trace entry.
//
//--------------------------------------------------------------------------------------------------

export interface ServerActionTraceEntry
{
    readonly action: string;
    readonly state:  string;
    readonly phase:  "entry" | "exit";
}

//--------------------------------------------------------------------------------------------------
// Interface: ServerRuntimeWarning
//
// Description:
//
//   Defines the structure of server runtime warning.
//
//--------------------------------------------------------------------------------------------------

export interface ServerRuntimeWarning
{
    readonly code:    "NO_TRANSITION" | "UNKNOWN_EVENT";
    readonly event:   string;
    readonly message: string;
}

//--------------------------------------------------------------------------------------------------
// Interface: ServerSessionSnapshot
//
// Description:
//
//   Defines the structure of server session snapshot.
//
//--------------------------------------------------------------------------------------------------

export interface ServerSessionSnapshot
{
    readonly sessionId:                  string;
    readonly pinnedModelRevision:        ServerModelRevision;
    readonly isStale:                    boolean;
    readonly currentState:               string;
    readonly initialEntryActionsPending: boolean;
    readonly processedEventCount:        number;
    readonly traceTruncated:              boolean;
    readonly transitionTrace:            readonly ServerTransitionTraceEntry[];
    readonly actionTrace:                readonly ServerActionTraceEntry[];
}

//--------------------------------------------------------------------------------------------------
// Interface: ServerSimulationOperationResult
//
// Description:
//
//   Describes the result produced by server simulation operation.
//
//--------------------------------------------------------------------------------------------------

export interface ServerSimulationOperationResult
{
    readonly session:            ServerSessionSnapshot;
    readonly consumedEventCount: number;
    readonly emittedActions:     readonly string[];
    readonly warnings:           readonly ServerRuntimeWarning[];
}

//--------------------------------------------------------------------------------------------------
// Interface: ServerSimulationCloseResult
//
// Description:
//
//   Describes the result produced by server simulation close.
//
//--------------------------------------------------------------------------------------------------

export interface ServerSimulationCloseResult
{
    readonly sessionId: string;
    readonly closed:    true;
}

//--------------------------------------------------------------------------------------------------
// Interface: ServerRequestPayloadByOperation
//
// Description:
//
//   Defines the structure of server request payload by operation.
//
//--------------------------------------------------------------------------------------------------

export interface ServerRequestPayloadByOperation
{
    readonly "server.hello":     ServerEmptyPayload;
    readonly "health.live":      ServerEmptyPayload;
    readonly "health.ready":     ServerEmptyPayload;
    readonly "model.get":        ServerEmptyPayload;
    readonly "model.put":        ServerModelPutRequestPayload;
    readonly "simulation.start": ServerEmptyPayload;
    readonly "simulation.run":   ServerSimulationEventsRequestPayload;
    readonly "simulation.step":  ServerSimulationEventsRequestPayload;
    readonly "simulation.reset": ServerEmptyPayload;
    readonly "simulation.close": ServerEmptyPayload;
}

//--------------------------------------------------------------------------------------------------
// Interface: ServerResultByOperation
//
// Description:
//
//   Defines the structure of server result by operation.
//
//--------------------------------------------------------------------------------------------------

export interface ServerResultByOperation
{
    readonly "server.hello":     ServerHelloResult;
    readonly "health.live":      ServerHealthLiveResult;
    readonly "health.ready":     ServerHealthReadyResult;
    readonly "model.get":        ServerModelGetResult;
    readonly "model.put":        ServerModelPutResult;
    readonly "simulation.start": ServerSessionSnapshot;
    readonly "simulation.run":   ServerSimulationOperationResult;
    readonly "simulation.step":  ServerSimulationOperationResult;
    readonly "simulation.reset": ServerSessionSnapshot;
    readonly "simulation.close": ServerSimulationCloseResult;
}

//--------------------------------------------------------------------------------------------------
// Type: ConditionalModelRevisionFor
//
// Description:
//
//   Defines the conditional model revision for type.
//
//--------------------------------------------------------------------------------------------------

type ConditionalModelRevisionFor<Operation extends ServerOperation> =
    Operation extends "model.put" ? ServerModelRevision : null;

//--------------------------------------------------------------------------------------------------
// Type: SessionIdentifierFor
//
// Description:
//
//   Defines the session identifier for type.
//
//--------------------------------------------------------------------------------------------------

type SessionIdentifierFor<Operation extends ServerOperation> =
    Operation extends "simulation.run" | "simulation.step" | "simulation.reset" | "simulation.close"
        ? string
        : null;

//--------------------------------------------------------------------------------------------------
// Type: ServerRequestEnvelopeFor
//
// Description:
//
//   Defines the server request envelope for type.
//
//--------------------------------------------------------------------------------------------------

export type ServerRequestEnvelopeFor<Operation extends ServerOperation> =
{
    readonly protocol:                 typeof SERVER_PROTOCOL_VERSION;
    readonly kind:                     "request";
    readonly requestId:                string;
    readonly operation:                Operation;
    readonly conditionalModelRevision: ConditionalModelRevisionFor<Operation>;
    readonly sessionId:                SessionIdentifierFor<Operation>;
    readonly payload:                  ServerRequestPayloadByOperation [ Operation ];
};

//--------------------------------------------------------------------------------------------------
// Type: ServerRequestEnvelope
//
// Description:
//
//   Defines the server request envelope type.
//
//--------------------------------------------------------------------------------------------------

export type ServerRequestEnvelope =
{
    readonly [ Operation in ServerOperation ]: ServerRequestEnvelopeFor<Operation>;
} [ ServerOperation ];

//--------------------------------------------------------------------------------------------------
// Type: ServerSuccessResponseEnvelopeFor
//
// Description:
//
//   Defines the server success response envelope for type.
//
//--------------------------------------------------------------------------------------------------

export type ServerSuccessResponseEnvelopeFor<Operation extends ServerOperation> =
{
    readonly protocol:       typeof SERVER_PROTOCOL_VERSION;
    readonly kind:           "success";
    readonly requestId:      string;
    readonly operation:      Operation;
    readonly serverSequence: number;
    readonly timestampUtc:   string;
    readonly result:         ServerResultByOperation [ Operation ];
};

//--------------------------------------------------------------------------------------------------
// Type: ServerSuccessResponseEnvelope
//
// Description:
//
//   Defines the server success response envelope type.
//
//--------------------------------------------------------------------------------------------------

export type ServerSuccessResponseEnvelope =
{
    readonly [ Operation in ServerOperation ]: ServerSuccessResponseEnvelopeFor<Operation>;
} [ ServerOperation ];

//--------------------------------------------------------------------------------------------------
// Interface: ServerErrorResponseEnvelope
//
// Description:
//
//   Defines the structure of server error response envelope.
//
//--------------------------------------------------------------------------------------------------

export interface ServerErrorResponseEnvelope
{
    readonly protocol:       typeof SERVER_PROTOCOL_VERSION;
    readonly kind:           "error";
    readonly requestId:      string;
    readonly operation:      ServerOperation | null;
    readonly serverSequence: number;
    readonly timestampUtc:   string;
    readonly error:          ServerProtocolError;
}

//--------------------------------------------------------------------------------------------------
// Type: ServerLifecyclePhase
//
// Description:
//
//   Defines the supported server lifecycle phase alternatives.
//
//--------------------------------------------------------------------------------------------------

export type ServerLifecyclePhase = "failed" | "ready" | "restarted" | "starting";

//--------------------------------------------------------------------------------------------------
// Interface: ServerLifecycleEventPayload
//
// Description:
//
//   Defines the structure of server lifecycle event payload.
//
//--------------------------------------------------------------------------------------------------

export interface ServerLifecycleEventPayload
{
    readonly phase:         ServerLifecyclePhase;
    readonly instanceId:    string;
    readonly modelRevision: ServerModelRevision | null;
    readonly message:       string;
}

//--------------------------------------------------------------------------------------------------
// Interface: ServerDiagnosticEventPayload
//
// Description:
//
//   Defines the structure of server diagnostic event payload.
//
//--------------------------------------------------------------------------------------------------

export interface ServerDiagnosticEventPayload
{
    readonly diagnostic: ServerProtocolDiagnostic;
}

//--------------------------------------------------------------------------------------------------
// Interface: ServerModelChangedEventPayload
//
// Description:
//
//   Defines the structure of server model changed event payload.
//
//--------------------------------------------------------------------------------------------------

export interface ServerModelChangedEventPayload
{
    readonly previousModelRevision: ServerModelRevision;
    readonly modelRevision:         ServerModelRevision;
    readonly disposition:           "replaced" | "unchanged";
}

//--------------------------------------------------------------------------------------------------
// Interface: ServerEventPayloadByEvent
//
// Description:
//
//   Defines the structure of server event payload by event.
//
//--------------------------------------------------------------------------------------------------

export interface ServerEventPayloadByEvent
{
    readonly "server.lifecycle": ServerLifecycleEventPayload;
    readonly "server.diagnostic": ServerDiagnosticEventPayload;
    readonly "model.changed":     ServerModelChangedEventPayload;
}

//--------------------------------------------------------------------------------------------------
// Type: ServerEventName
//
// Description:
//
//   Defines the server event name type.
//
//--------------------------------------------------------------------------------------------------

export type ServerEventName = keyof ServerEventPayloadByEvent;

//--------------------------------------------------------------------------------------------------
// Type: ServerEventEnvelopeFor
//
// Description:
//
//   Defines the server event envelope for type.
//
//--------------------------------------------------------------------------------------------------

export type ServerEventEnvelopeFor<EventName extends ServerEventName> =
{
    readonly protocol:       typeof SERVER_PROTOCOL_VERSION;
    readonly kind:           "event";
    readonly event:          EventName;
    readonly serverSequence: number;
    readonly timestampUtc:   string;
    readonly payload:        ServerEventPayloadByEvent [ EventName ];
};

//--------------------------------------------------------------------------------------------------
// Type: ServerEventEnvelope
//
// Description:
//
//   Defines the server event envelope type.
//
//--------------------------------------------------------------------------------------------------

export type ServerEventEnvelope =
{
    readonly [ EventName in ServerEventName ]: ServerEventEnvelopeFor<EventName>;
} [ ServerEventName ];

//--------------------------------------------------------------------------------------------------
// Type: ServerOutboundEnvelope
//
// Description:
//
//   Defines the supported server outbound envelope alternatives.
//
//--------------------------------------------------------------------------------------------------

export type ServerOutboundEnvelope =
    | ServerSuccessResponseEnvelope
    | ServerErrorResponseEnvelope
    | ServerEventEnvelope;

//--------------------------------------------------------------------------------------------------
// Type: ServerRequestDecodeResult
//
// Description:
//
//   Describes the result produced by server request decode.
//
//--------------------------------------------------------------------------------------------------

export type ServerRequestDecodeResult =
    | { readonly isSuccessful: true; readonly request: ServerRequestEnvelope }
    | {
        readonly isSuccessful: false;
        readonly isCorrelated: true;
        readonly requestId:    string;
        readonly operation:    ServerOperation | null;
        readonly error:        ServerProtocolError;
    }
    | {
        readonly isSuccessful: false;
        readonly isCorrelated: false;
        readonly requestId:    null;
        readonly operation:    ServerOperation | null;
        readonly error:        ServerProtocolError;
    };

//--------------------------------------------------------------------------------------------------
// Type: ServerOutboundDecodeErrorCode
//
// Description:
//
//   Defines the supported server outbound decode error code alternatives.
//
//--------------------------------------------------------------------------------------------------

export type ServerOutboundDecodeErrorCode =
    | "OUTBOUND_MESSAGE_INVALID"
    | "OUTBOUND_SEQUENCE_INVALID"
    | "OUTBOUND_TIMESTAMP_INVALID";

//--------------------------------------------------------------------------------------------------
// Type: ServerOutboundDecodeResult
//
// Description:
//
//   Describes the result produced by server outbound decode.
//
//--------------------------------------------------------------------------------------------------

export type ServerOutboundDecodeResult =
    | { readonly isSuccessful: true; readonly message: ServerOutboundEnvelope }
    | {
        readonly isSuccessful: false;
        readonly code:         ServerOutboundDecodeErrorCode;
        readonly message:      string;
    };

//--------------------------------------------------------------------------------------------------
// Interface: CreateServerSuccessResponseParameters
//
// Description:
//
//   Defines the structure of create server success response parameters.
//
//--------------------------------------------------------------------------------------------------

export interface CreateServerSuccessResponseParameters<Operation extends ServerOperation>
{
    readonly requestId:      string;
    readonly operation:      Operation;
    readonly serverSequence: number;
    readonly timestampUtc:   string;
    readonly result:         ServerResultByOperation [ Operation ];
}

//--------------------------------------------------------------------------------------------------
// Interface: CreateServerErrorResponseParameters
//
// Description:
//
//   Defines the structure of create server error response parameters.
//
//--------------------------------------------------------------------------------------------------

export interface CreateServerErrorResponseParameters
{
    readonly requestId:      string;
    readonly operation:      ServerOperation | null;
    readonly serverSequence: number;
    readonly timestampUtc:   string;
    readonly error:          ServerProtocolError;
}

//--------------------------------------------------------------------------------------------------
// Interface: CreateServerEventParameters
//
// Description:
//
//   Defines the structure of create server event parameters.
//
//--------------------------------------------------------------------------------------------------

export interface CreateServerEventParameters<EventName extends ServerEventName>
{
    readonly event:          EventName;
    readonly serverSequence: number;
    readonly timestampUtc:   string;
    readonly payload:        ServerEventPayloadByEvent [ EventName ];
}

//--------------------------------------------------------------------------------------------------
// Type: ProtocolValueInspection
//
// Description:
//
//   Defines the supported protocol value inspection alternatives.
//
//--------------------------------------------------------------------------------------------------

type ProtocolValueInspection = "forbidden-property" | "invalid" | "valid";

//--------------------------------------------------------------------------------------------------
// Function: isRecord
//
// Description:
//
//   Determines whether record.
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

function isRecord ( value: unknown ): value is Readonly<Record<string, unknown>>
{
    // Return the computed result.

    return typeof value === "object" && value !== null && !Array.isArray ( value );
}

//--------------------------------------------------------------------------------------------------
// Function: inspectProtocolValue
//
// Description:
//
//   Inspects the protocol value.
//
// Parameters:
//
//   - rootValue:
//     The root value supplied to the operation.
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

function inspectProtocolValue ( rootValue: unknown ): ProtocolValueInspection
{
    // Initialize the local values needed by this operation.

    const pendingValues: unknown[] = [ rootValue ];
    const visitedObjects           = new WeakSet<object> ();
    let visitedNodeCount           = 0;

    // Run the operation that may report a recoverable failure.

    try
    {
        // Continue the operation while its terminating condition has not been reached.

        while ( pendingValues.length > 0 )
        {
            // Initialize the local values needed by this operation.

            const value = pendingValues.pop ();

            visitedNodeCount++;

            // Handle the case where visited node count exceeds maximum protocol value node count.

            if ( visitedNodeCount > MAXIMUM_PROTOCOL_VALUE_NODE_COUNT )
            {
                // Return the computed result.

                return "invalid";
            }

            // Handle the case where at least one branch condition is satisfied.

            if ( value === null || typeof value === "boolean" || typeof value === "string" )
            {
                continue;
            }

            // Handle the case where current value matches the number value.

            if ( typeof value === "number" )
            {
                // Handle the case where the is finite result condition is not satisfied.

                if ( !Number.isFinite ( value ) )
                {
                    // Return the computed result.

                    return "invalid";
                }

                continue;
            }

            // Handle the case where current value differs from the object value.

            if ( typeof value !== "object" )
            {
                // Return the computed result.

                return "invalid";
            }

            // Handle the case where has result is enabled.

            if ( visitedObjects.has ( value ) )
            {
                // Return the computed result.

                return "invalid";
            }

            visitedObjects.add ( value );

            // Handle the case where is array result is enabled.

            if ( Array.isArray ( value ) )
            {
                // Handle the case where value length exceeds maximum protocol value node count.

                if ( value.length > MAXIMUM_PROTOCOL_VALUE_NODE_COUNT )
                {
                    // Return the computed result.

                    return "invalid";
                }

                const propertyKeys = Reflect.ownKeys ( value );

                // Handle the case where some result is enabled.

                if ( propertyKeys.some ( propertyKey => typeof propertyKey !== "string" ) )
                {
                    // Return the computed result.

                    return "invalid";
                }

                // Process each property key from the property keys collection in order.

                for ( const propertyKey of propertyKeys )
                {
                    // Handle the case where current value differs from the string value.

                    if ( typeof propertyKey !== "string" )
                    {
                        // Return the computed result.

                        return "invalid";
                    }

                    // Handle the case where has result is enabled.

                    if ( FORBIDDEN_PROPERTY_NAMES.has ( propertyKey ) )
                    {
                        // Return the computed result.

                        return "forbidden-property";
                    }

                    // Handle the case where all required conditions are satisfied.

                    if ( propertyKey !== "length" && !/^(?:0|[1-9]\d*)$/.test ( propertyKey ) )
                    {
                        // Return the computed result.

                        return "invalid";
                    }
                }

                // Repeat the operation across the bounded iteration range.

                for ( let i = 0; i < value.length; i++ )
                {
                    // Handle the case where the has own result condition is not satisfied.

                    if ( !Object.hasOwn ( value, i ) )
                    {
                        // Return the computed result.

                        return "invalid";
                    }

                    pendingValues.push ( value [ i ] );
                }

                continue;
            }

            const prototype = Object.getPrototypeOf ( value );

            // Handle the case where all required conditions are satisfied.

            if ( prototype !== Object.prototype && prototype !== null )
            {
                // Return the computed result.

                return "invalid";
            }

            // Process each property key from the own keys result collection in order.

            for ( const propertyKey of Reflect.ownKeys ( value ) )
            {
                // Handle the case where current value differs from the string value.

                if ( typeof propertyKey !== "string" )
                {
                    // Return the computed result.

                    return "invalid";
                }

                // Handle the case where has result is enabled.

                if ( FORBIDDEN_PROPERTY_NAMES.has ( propertyKey ) )
                {
                    // Return the computed result.

                    return "forbidden-property";
                }

                const descriptor = Object.getOwnPropertyDescriptor ( value, propertyKey );

                // Handle the case where at least one branch condition is satisfied.

                if ( descriptor === undefined || !( "value" in descriptor ) || !descriptor.enumerable )
                {
                    // Return the computed result.

                    return "invalid";
                }

                pendingValues.push ( descriptor.value );
            }
        }
    }
    catch
    {
        // Recover from the reported failure without hiding its outcome.

        return "invalid";
    }

    // Return the computed result.

    return "valid";
}

//--------------------------------------------------------------------------------------------------
// Function: hasExactKeys
//
// Description:
//
//   Determines whether exact keys.
//
// Parameters:
//
//   - value:
//     The value supplied to the operation.
//
//   - expectedKeys:
//     The expected keys supplied to the operation.
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

function hasExactKeys ( value: Readonly<Record<string, unknown>>, expectedKeys: readonly string[] ): boolean
{
    // Initialize the local values needed by this operation.

    const actualKeys = Reflect.ownKeys ( value );

    // Return the computed result.

    return actualKeys.length === expectedKeys.length &&
        actualKeys.every ( key => typeof key === "string" && expectedKeys.includes ( key ) );
}

//--------------------------------------------------------------------------------------------------
// Function: readOwnDataProperty
//
// Description:
//
//   Returns own data property.
//
// Parameters:
//
//   - value:
//     The value supplied to the operation.
//
//   - propertyName:
//     The property name supplied to the operation.
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

function readOwnDataProperty ( value: unknown, propertyName: string ): unknown
{
    // Handle the case where the is record result condition is not satisfied.

    if ( !isRecord ( value ) )
    {
        // Return the undefined.

        return undefined;
    }

    // Run the operation that may report a recoverable failure.

    try
    {
        // Initialize the local values needed by this operation.

        const descriptor = Object.getOwnPropertyDescriptor ( value, propertyName );

        // Return the result selected by the current condition.

        return descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
    }
    catch
    {
        // Recover from the reported failure without hiding its outcome.

        return undefined;
    }
}

//--------------------------------------------------------------------------------------------------
// Function: jsonByteCount
//
// Description:
//
//   Derives the JSON byte count.
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

function jsonByteCount ( value: unknown ): number | null
{
    // Run the operation that may report a recoverable failure.

    try
    {
        // Initialize the local values needed by this operation.

        const text = JSON.stringify ( value );

        // Return the result selected by the current condition.

        return text === undefined ? null : new TextEncoder ().encode ( text ).byteLength;
    }
    catch
    {
        // Recover from the reported failure without hiding its outcome.

        return null;
    }
}

//--------------------------------------------------------------------------------------------------
// Function: textByteCount
//
// Description:
//
//   Derives the text byte count.
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

function textByteCount ( value: string ): number
{
    // Return the computed result.

    return new TextEncoder ().encode ( value ).byteLength;
}

//--------------------------------------------------------------------------------------------------
// Function: isValidServerUuid
//
// Description:
//
//   Determines whether valid server uuid.
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

export function isValidServerUuid ( value: unknown ): value is string
{
    // Return the computed result.

    return typeof value === "string" && UUID_PATTERN.test ( value );
}

//--------------------------------------------------------------------------------------------------
// Function: isValidServerModelRevision
//
// Description:
//
//   Determines whether valid server model revision.
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

export function isValidServerModelRevision ( value: unknown ): value is ServerModelRevision
{
    // Return the computed result.

    return typeof value === "string" && MODEL_REVISION_PATTERN.test ( value );
}

//--------------------------------------------------------------------------------------------------
// Function: isValidServerUtcTimestamp
//
// Description:
//
//   Determines whether valid server utc timestamp.
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

export function isValidServerUtcTimestamp ( value: unknown ): value is string
{
    // Handle the case where at least one branch condition is satisfied.

    if ( typeof value !== "string" || !UTC_TIMESTAMP_PATTERN.test ( value ) )
    {
        // Return the computed result.

        return false;
    }

    const timestamp = new Date ( value );

    // Return the computed result.

    return Number.isFinite ( timestamp.valueOf () ) && timestamp.toISOString () === value;
}

//--------------------------------------------------------------------------------------------------
// Function: isServerOperation
//
// Description:
//
//   Determines whether server operation.
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

export function isServerOperation ( value: unknown ): value is ServerOperation
{
    // Return the computed result.

    return typeof value === "string" && SERVER_PROTOCOL_OPERATIONS.some ( operation => operation === value );
}

//--------------------------------------------------------------------------------------------------
// Function: isNonNegativeSafeInteger
//
// Description:
//
//   Determines whether non negative safe integer.
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

function isNonNegativeSafeInteger ( value: unknown ): value is number
{
    // Return the computed result.

    return Number.isSafeInteger ( value ) && typeof value === "number" && value >= 0;
}

//--------------------------------------------------------------------------------------------------
// Function: isPositiveServerSequence
//
// Description:
//
//   Determines whether positive server sequence.
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

function isPositiveServerSequence ( value: unknown ): value is number
{
    // Return the computed result.

    return Number.isSafeInteger ( value ) && typeof value === "number" && value > 0;
}

//--------------------------------------------------------------------------------------------------
// Function: isBoundedText
//
// Description:
//
//   Determines whether bounded text.
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

function isBoundedText ( value: unknown ): value is string
{
    // Return the computed result.

    return typeof value === "string" && value.length <= MAXIMUM_SERVER_DIAGNOSTIC_TEXT_LENGTH;
}

//--------------------------------------------------------------------------------------------------
// Function: isEmptyPayload
//
// Description:
//
//   Determines whether empty payload.
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

function isEmptyPayload ( value: unknown ): value is ServerEmptyPayload
{
    // Return the computed result.

    return isRecord ( value ) && hasExactKeys ( value, [] );
}

//--------------------------------------------------------------------------------------------------
// Function: decodeStringArray
//
// Description:
//
//   Decodes string array.
//
// Parameters:
//
//   - value:
//     The value supplied to the operation.
//
//   - maximumLength:
//     The maximum length supplied to the operation.
//
//   - maximumTrimmedItemCodePointCount:
//     The maximum trimmed item code point count supplied to the operation.
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

function decodeStringArray (
    value: unknown,
    maximumLength: number,
    maximumTrimmedItemCodePointCount?: number,
): readonly string[] | null
{
    // Handle the case where at least one branch condition is satisfied.

    if ( !Array.isArray ( value ) || value.length > maximumLength )
    {
        // Return the computed result.

        return null;
    }

    const strings: string[] = [];

    // Repeat the operation across the bounded iteration range.

    for ( let i = 0; i < value.length; i++ )
    {
        // Initialize the local values needed by this operation.

        const item = value [ i ];

        // Handle the case where at least one branch condition is satisfied.

        if ( typeof item !== "string" || maximumTrimmedItemCodePointCount !== undefined &&
            [ ...item.trim () ].length > maximumTrimmedItemCodePointCount )
        {
            // Return the computed result.

            return null;
        }

        strings.push ( item );
    }

    // Return the strings.

    return strings;
}

//--------------------------------------------------------------------------------------------------
// Function: isServerErrorCode
//
// Description:
//
//   Determines whether server error code.
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

function isServerErrorCode ( value: unknown ): value is ServerErrorCode
{
    // Dispatch according to the value value.

    switch ( value )
    {
        // Handle the group of case values that share the following outcome.

        case "CONDITIONAL_MODEL_REVISION_INVALID":
        case "DOCUMENT_TOO_LARGE":
        case "DUPLICATE_REQUEST_ID":
        case "INTERNAL_ERROR":
        case "MODEL_INVALID":
        case "MODEL_REVISION_CONFLICT":
        case "OPERATION_UNSUPPORTED":
        case "PAYLOAD_INVALID":
        case "PAYLOAD_TOO_LARGE":
        case "PROTOCOL_UNSUPPORTED":
        case "PROTOTYPE_KEY_FORBIDDEN":
        case "REQUEST_ID_INVALID":
        case "REQUEST_KIND_INVALID":
        case "REQUEST_SHAPE_INVALID":
        case "SERVER_NOT_READY":
        case "SESSION_CAPACITY_EXCEEDED":
        case "SESSION_ID_INVALID":
        case "SESSION_NOT_FOUND":
        case "TRACE_CAPACITY_EXCEEDED":

            // Return the computed result.

            return true;

        // Handle values not matched by an earlier case.

        default:

            // Return the computed result.

            return false;
    }
}

//--------------------------------------------------------------------------------------------------
// Function: createProtocolError
//
// Description:
//
//   Creates protocol error.
//
// Parameters:
//
//   - code:
//     The code supplied to the operation.
//
//   - message:
//     The message supplied to the operation.
//
//   - diagnostics:
//     The diagnostics supplied to the operation.
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

function createProtocolError (
    code: ServerErrorCode,
    message: string,
    diagnostics: readonly ServerProtocolDiagnostic[] = [],
): ServerProtocolError
{
    // Return the assembled result.

    return { code, message, diagnostics };
}

//--------------------------------------------------------------------------------------------------
// Function: requestDecodeFailure
//
// Description:
//
//   Requests the decode failure.
//
// Parameters:
//
//   - value:
//     The value supplied to the operation.
//
//   - code:
//     The code supplied to the operation.
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

function requestDecodeFailure (
    value: unknown,
    code: ServerErrorCode,
    message: string,
): ServerRequestDecodeResult
{
    // Initialize the local values needed by this operation.

    const possibleRequestId = readOwnDataProperty ( value, "requestId" );
    const possibleOperation = readOwnDataProperty ( value, "operation" );
    const operation         = isServerOperation ( possibleOperation ) ? possibleOperation : null;
    const error             = createProtocolError ( code, message );

    // Handle the case where is valid server uuid result is enabled.

    if ( isValidServerUuid ( possibleRequestId ) )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            isCorrelated: true,
            requestId:    possibleRequestId,
            operation,
            error,
        };
    }

    // Return the assembled result.

    return {
        isSuccessful: false,
        isCorrelated: false,
        requestId:    null,
        operation,
        error,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: decodeServerRequestEnvelope
//
// Description:
//
//   Decodes server request envelope.
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

export function decodeServerRequestEnvelope ( value: unknown ): ServerRequestDecodeResult
{
    // Initialize the local values needed by this operation.

    const inspection = inspectProtocolValue ( value );

    // Handle the case where inspection matches the forbidden-property value.

    if ( inspection === "forbidden-property" )
    {
        // Return the request decode failure result.

        return requestDecodeFailure (
            value,
            "PROTOTYPE_KEY_FORBIDDEN",
            "The request contains a forbidden prototype-related property name.",
        );
    }

    // Handle the case where at least one branch condition is satisfied.

    if ( inspection !== "valid" || !isRecord ( value ) || !hasExactKeys ( value, REQUEST_ENVELOPE_KEYS ) )
    {
        // Return the request decode failure result.

        return requestDecodeFailure (
            value,
            "REQUEST_SHAPE_INVALID",
            "The request must be a structural-clone-safe object with exactly the seven protocol envelope properties.",
        );
    }

    // Handle the case where selected collection value differs from server protocol version.

    if ( value [ "protocol" ] !== SERVER_PROTOCOL_VERSION )
    {
        // Return the request decode failure result.

        return requestDecodeFailure ( value, "PROTOCOL_UNSUPPORTED", "The request protocol version is unsupported." );
    }

    // Handle the case where selected collection value differs from the request value.

    if ( value [ "kind" ] !== "request" )
    {
        // Return the request decode failure result.

        return requestDecodeFailure ( value, "REQUEST_KIND_INVALID", "The request kind must be 'request'." );
    }

    const requestId = value [ "requestId" ];

    // Handle the case where the is valid server uuid result condition is not satisfied.

    if ( !isValidServerUuid ( requestId ) )
    {
        // Return the request decode failure result.

        return requestDecodeFailure ( value, "REQUEST_ID_INVALID", "The requestId must be a canonical UUID." );
    }

    const operation = value [ "operation" ];

    // Handle the case where the is server operation result condition is not satisfied.

    if ( !isServerOperation ( operation ) )
    {
        // Return the request decode failure result.

        return requestDecodeFailure ( value, "OPERATION_UNSUPPORTED", "The requested server operation is unsupported." );
    }

    // Initialize the local values needed by this operation.

    const conditionalModelRevision = value [ "conditionalModelRevision" ];
    const sessionId                = value [ "sessionId" ];
    const payload                  = value [ "payload" ];
    const canonicalDocument        = operation === "model.put" && isRecord ( payload ) &&
        typeof payload [ "canonicalDocument" ] === "string"
        ? payload [ "canonicalDocument" ]
        : null;
    const payloadByteCount = canonicalDocument === null
        ? jsonByteCount ( payload )
        : textByteCount ( canonicalDocument );

    // Handle the case where payload byte count matches an absent value.

    if ( payloadByteCount === null )
    {
        // Return the request decode failure result.

        return requestDecodeFailure ( value, "PAYLOAD_INVALID", "The request payload is not JSON-compatible." );
    }

    // Handle the case where payload byte count exceeds maximum server payload byte count.

    if ( payloadByteCount > MAXIMUM_SERVER_PAYLOAD_BYTE_COUNT )
    {
        // Return the request decode failure result.

        return requestDecodeFailure (
            value,
            canonicalDocument === null ? "PAYLOAD_TOO_LARGE" : "DOCUMENT_TOO_LARGE",
            canonicalDocument === null
                ? "The request payload exceeds the 5 MiB limit."
                : "The canonical document exceeds the 5 MiB document limit.",
        );
    }

    // Handle the case where operation matches the model.put value.

    if ( operation === "model.put" )
    {
        // Handle the case where the is valid server model revision result condition is not
        // satisfied.

        if ( !isValidServerModelRevision ( conditionalModelRevision ) )
        {
            // Return the request decode failure result.

            return requestDecodeFailure (
                value,
                "CONDITIONAL_MODEL_REVISION_INVALID",
                "model.put requires a lowercase sha256 conditionalModelRevision.",
            );
        }
    }
    else if ( conditionalModelRevision !== null )
    {
        // Return the request decode failure result.

        return requestDecodeFailure (
            value,
            "CONDITIONAL_MODEL_REVISION_INVALID",
            "conditionalModelRevision must be null for this operation.",
        );
    }

    const requiresSessionId = operation === "simulation.run" || operation === "simulation.step" ||
        operation === "simulation.reset" || operation === "simulation.close";

    // Handle the case where current value is enabled.

    if ( requiresSessionId ? !isValidServerUuid ( sessionId ) : sessionId !== null )
    {
        // Return the request decode failure result.

        return requestDecodeFailure (
            value,
            "SESSION_ID_INVALID",
            requiresSessionId
                ? "This operation requires a canonical session UUID."
                : "sessionId must be null for this operation.",
        );
    }

    // Dispatch according to the operation value.

    switch ( operation )
    {
        // Handle the group of case values that share the following outcome.

        case "server.hello":
        case "health.live":
        case "health.ready":
        case "model.get":
        case "simulation.start":
        {
            // Handle the case where the is empty payload result condition is not satisfied.

            if ( !isEmptyPayload ( payload ) )
            {
                // Return the request decode failure result.

                return requestDecodeFailure ( value, "PAYLOAD_INVALID", "This operation requires an empty payload." );
            }

            // Return the assembled result.

            return {
                isSuccessful: true,
                request:
                {
                    protocol: SERVER_PROTOCOL_VERSION,
                    kind: "request",
                    requestId,
                    operation,
                    conditionalModelRevision: null,
                    sessionId: null,
                    payload: {},
                },
            };
        }

        // Handle the "model.put" case.

        case "model.put":
        {
            // Handle the case where at least one branch condition is satisfied.

            if ( !isValidServerModelRevision ( conditionalModelRevision ) || !isRecord ( payload ) ||
                !hasExactKeys ( payload, [ "canonicalDocument" ] ) ||
                typeof payload [ "canonicalDocument" ] !== "string" )
            {
                // Return the request decode failure result.

                return requestDecodeFailure (
                    value,
                    "PAYLOAD_INVALID",
                    "model.put requires exactly one canonicalDocument string.",
                );
            }

            const canonicalDocument = payload [ "canonicalDocument" ];

            // Handle the case where text byte count result exceeds maximum server document byte
            // count.

            if ( textByteCount ( canonicalDocument ) > MAXIMUM_SERVER_DOCUMENT_BYTE_COUNT )
            {
                // Return the request decode failure result.

                return requestDecodeFailure (
                    value,
                    "DOCUMENT_TOO_LARGE",
                    "The canonical document exceeds the 5 MiB document limit.",
                );
            }

            // Return the assembled result.

            return {
                isSuccessful: true,
                request:
                {
                    protocol: SERVER_PROTOCOL_VERSION,
                    kind: "request",
                    requestId,
                    operation,
                    conditionalModelRevision,
                    sessionId: null,
                    payload: { canonicalDocument },
                },
            };
        }

        // Handle the group of case values that share the following outcome.

        case "simulation.run":
        case "simulation.step":
        {
            // Handle the case where at least one branch condition is satisfied.

            if ( !isValidServerUuid ( sessionId ) || !isRecord ( payload ) ||
                !hasExactKeys ( payload, [ "events" ] ) )
            {
                // Return the request decode failure result.

                return requestDecodeFailure (
                    value,
                    "PAYLOAD_INVALID",
                    "simulation.run and simulation.step require exactly one events array.",
                );
            }

            const events = decodeStringArray (
                payload [ "events" ],
                MAXIMUM_SERVER_EVENT_COUNT_PER_REQUEST,
                MAXIMUM_NAME_CODE_POINT_COUNT,
            );

            // Handle the case where events matches an absent value.

            if ( events === null )
            {
                // Return the request decode failure result.

                return requestDecodeFailure (
                    value,
                    "PAYLOAD_INVALID",
                    `The events array must contain at most ${MAXIMUM_SERVER_EVENT_COUNT_PER_REQUEST} strings, each ` +
                    `with at most ${MAXIMUM_NAME_CODE_POINT_COUNT} trimmed Unicode code points.`,
                );
            }

            // Return the assembled result.

            return {
                isSuccessful: true,
                request:
                {
                    protocol: SERVER_PROTOCOL_VERSION,
                    kind: "request",
                    requestId,
                    operation,
                    conditionalModelRevision: null,
                    sessionId,
                    payload: { events },
                },
            };
        }

        // Handle the group of case values that share the following outcome.

        case "simulation.reset":
        case "simulation.close":
        {
            // Handle the case where at least one branch condition is satisfied.

            if ( !isValidServerUuid ( sessionId ) || !isEmptyPayload ( payload ) )
            {
                // Return the request decode failure result.

                return requestDecodeFailure ( value, "PAYLOAD_INVALID", "This operation requires an empty payload." );
            }

            // Return the assembled result.

            return {
                isSuccessful: true,
                request:
                {
                    protocol: SERVER_PROTOCOL_VERSION,
                    kind: "request",
                    requestId,
                    operation,
                    conditionalModelRevision: null,
                    sessionId,
                    payload: {},
                },
            };
        }
    }
}

//--------------------------------------------------------------------------------------------------
// Function: decodeProtocolDiagnostic
//
// Description:
//
//   Decodes protocol diagnostic.
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

function decodeProtocolDiagnostic ( value: unknown ): ServerProtocolDiagnostic | null
{
    // Handle the case where at least one branch condition is satisfied.

    if ( !isRecord ( value ) || !hasExactKeys (
        value,
        [ "code", "severity", "source", "message", "remediation", "path", "context" ],
    ) || !isBoundedText ( value [ "code" ] ) || !isBoundedText ( value [ "source" ] ) ||
        !isBoundedText ( value [ "message" ] ) || !isBoundedText ( value [ "remediation" ] ) ||
        value [ "severity" ] !== "error" && value [ "severity" ] !== "information" &&
        value [ "severity" ] !== "warning" || value [ "path" ] !== null && !isBoundedText ( value [ "path" ] ) ||
        value [ "context" ] !== null && !isBoundedText ( value [ "context" ] ) )
    {
        // Return the computed result.

        return null;
    }

    // Return the assembled result.

    return {
        code:        value [ "code" ],
        severity:    value [ "severity" ],
        source:      value [ "source" ],
        message:     value [ "message" ],
        remediation: value [ "remediation" ],
        path:        value [ "path" ],
        context:     value [ "context" ],
    };
}

//--------------------------------------------------------------------------------------------------
// Function: decodeProtocolDiagnostics
//
// Description:
//
//   Decodes protocol diagnostics.
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

function decodeProtocolDiagnostics ( value: unknown ): readonly ServerProtocolDiagnostic[] | null
{
    // Handle the case where at least one branch condition is satisfied.

    if ( !Array.isArray ( value ) || value.length > MAXIMUM_SERVER_DIAGNOSTIC_COUNT )
    {
        // Return the computed result.

        return null;
    }

    const diagnostics: ServerProtocolDiagnostic[] = [];

    // Repeat the operation across the bounded iteration range.

    for ( let i = 0; i < value.length; i++ )
    {
        // Initialize the local values needed by this operation.

        const diagnostic = decodeProtocolDiagnostic ( value [ i ] );

        // Handle the case where diagnostic matches an absent value.

        if ( diagnostic === null )
        {
            // Return the computed result.

            return null;
        }

        diagnostics.push ( diagnostic );
    }

    // Return the diagnostics.

    return diagnostics;
}

//--------------------------------------------------------------------------------------------------
// Function: decodeProtocolError
//
// Description:
//
//   Decodes protocol error.
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

function decodeProtocolError ( value: unknown ): ServerProtocolError | null
{
    // Handle the case where at least one branch condition is satisfied.

    if ( !isRecord ( value ) || !hasExactKeys ( value, [ "code", "message", "diagnostics" ] ) ||
        !isServerErrorCode ( value [ "code" ] ) || !isBoundedText ( value [ "message" ] ) )
    {
        // Return the computed result.

        return null;
    }

    const diagnostics = decodeProtocolDiagnostics ( value [ "diagnostics" ] );

    // Return the result selected by the current condition.

    return diagnostics === null
        ? null
        : { code: value [ "code" ], message: value [ "message" ], diagnostics };
}

//--------------------------------------------------------------------------------------------------
// Function: decodeProtocolLimits
//
// Description:
//
//   Decodes protocol limits.
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

function decodeProtocolLimits ( value: unknown ): ServerProtocolLimits | null
{
    // Handle the case where at least one branch condition is satisfied.

    if ( !isRecord ( value ) || !hasExactKeys (
        value,
        [
            "maximumPayloadByteCount",
            "maximumDocumentByteCount",
            "maximumEventCountPerRequest",
            "maximumSessionCount",
            "maximumTraceEntryCount",
            "maximumRetainedRequestIdentifierCount",
            "maximumDiagnosticCount",
        ],
    ) || value [ "maximumPayloadByteCount" ] !== MAXIMUM_SERVER_PAYLOAD_BYTE_COUNT ||
        value [ "maximumDocumentByteCount" ] !== MAXIMUM_SERVER_DOCUMENT_BYTE_COUNT ||
        value [ "maximumEventCountPerRequest" ] !== MAXIMUM_SERVER_EVENT_COUNT_PER_REQUEST ||
        value [ "maximumSessionCount" ] !== MAXIMUM_SERVER_SESSION_COUNT ||
        value [ "maximumTraceEntryCount" ] !== MAXIMUM_SERVER_TRACE_ENTRY_COUNT ||
        value [ "maximumRetainedRequestIdentifierCount" ] !== MAXIMUM_SERVER_RETAINED_REQUEST_IDENTIFIER_COUNT ||
        value [ "maximumDiagnosticCount" ] !== MAXIMUM_SERVER_DIAGNOSTIC_COUNT )
    {
        // Return the computed result.

        return null;
    }

    // Return the assembled result.

    return { ...SERVER_PROTOCOL_LIMITS };
}

//--------------------------------------------------------------------------------------------------
// Function: decodeCapabilities
//
// Description:
//
//   Decodes capabilities.
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

function decodeCapabilities ( value: unknown ): readonly ServerOperation[] | null
{
    // Handle the case where at least one branch condition is satisfied.

    if ( !Array.isArray ( value ) || value.length > SERVER_PROTOCOL_OPERATIONS.length )
    {
        // Return the computed result.

        return null;
    }

    // Initialize the local values needed by this operation.

    const capabilities: ServerOperation[] = [];
    const seenCapabilities                = new Set<ServerOperation> ();

    // Repeat the operation across the bounded iteration range.

    for ( let i = 0; i < value.length; i++ )
    {
        // Initialize the local values needed by this operation.

        const capability = value [ i ];

        // Handle the case where at least one branch condition is satisfied.

        if ( !isServerOperation ( capability ) || seenCapabilities.has ( capability ) )
        {
            // Return the computed result.

            return null;
        }

        seenCapabilities.add ( capability );
        capabilities.push ( capability );
    }

    // Return the capabilities.

    return capabilities;
}

//--------------------------------------------------------------------------------------------------
// Function: decodeHelloResult
//
// Description:
//
//   Decodes hello result.
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

function decodeHelloResult ( value: unknown ): ServerHelloResult | null
{
    // Handle the case where at least one branch condition is satisfied.

    if ( !isRecord ( value ) || !hasExactKeys (
        value,
        [ "protocol", "instanceId", "ready", "modelRevision", "capabilities", "limits" ],
    ) || value [ "protocol" ] !== SERVER_PROTOCOL_VERSION || !isValidServerUuid ( value [ "instanceId" ] ) ||
        typeof value [ "ready" ] !== "boolean" || value [ "modelRevision" ] !== null &&
        !isValidServerModelRevision ( value [ "modelRevision" ] ) )
    {
        // Return the computed result.

        return null;
    }

    // Initialize the local values needed by this operation.

    const capabilities = decodeCapabilities ( value [ "capabilities" ] );
    const limits       = decodeProtocolLimits ( value [ "limits" ] );

    // Handle the case where at least one branch condition is satisfied.

    if ( capabilities === null || limits === null ||
        value [ "ready" ] !== ( value [ "modelRevision" ] !== null ) )
    {
        // Return the computed result.

        return null;
    }

    // Return the assembled result.

    return {
        protocol: SERVER_PROTOCOL_VERSION,
        instanceId: value [ "instanceId" ],
        ready: value [ "ready" ],
        modelRevision: value [ "modelRevision" ],
        capabilities,
        limits,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: decodeHealthLiveResult
//
// Description:
//
//   Decodes health live result.
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

function decodeHealthLiveResult ( value: unknown ): ServerHealthLiveResult | null
{
    // Return the result selected by the current condition.

    return isRecord ( value ) && hasExactKeys ( value, [ "live", "instanceId" ] ) &&
        value [ "live" ] === true && isValidServerUuid ( value [ "instanceId" ] )
        ? { live: true, instanceId: value [ "instanceId" ] }
        : null;
}

//--------------------------------------------------------------------------------------------------
// Function: decodeHealthReadyResult
//
// Description:
//
//   Decodes health ready result.
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

function decodeHealthReadyResult ( value: unknown ): ServerHealthReadyResult | null
{
    // Handle the case where at least one branch condition is satisfied.

    if ( !isRecord ( value ) || !hasExactKeys ( value, [ "ready", "modelRevision", "diagnostics" ] ) ||
        typeof value [ "ready" ] !== "boolean" || value [ "modelRevision" ] !== null &&
        !isValidServerModelRevision ( value [ "modelRevision" ] ) )
    {
        // Return the computed result.

        return null;
    }

    const diagnostics = decodeProtocolDiagnostics ( value [ "diagnostics" ] );

    // Handle the case where at least one branch condition is satisfied.

    if ( diagnostics === null || value [ "ready" ] !== ( value [ "modelRevision" ] !== null ) )
    {
        // Return the computed result.

        return null;
    }

    // Return the assembled result.

    return {
        ready: value [ "ready" ],
        modelRevision: value [ "modelRevision" ],
        diagnostics,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: decodeModelGetResult
//
// Description:
//
//   Decodes model get result.
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

function decodeModelGetResult ( value: unknown ): ServerModelGetResult | null
{
    // Handle the case where at least one branch condition is satisfied.

    if ( !isRecord ( value ) || !hasExactKeys ( value, [ "modelRevision", "canonicalDocument" ] ) ||
        !isValidServerModelRevision ( value [ "modelRevision" ] ) ||
        typeof value [ "canonicalDocument" ] !== "string" ||
        textByteCount ( value [ "canonicalDocument" ] ) > MAXIMUM_SERVER_DOCUMENT_BYTE_COUNT )
    {
        // Return the computed result.

        return null;
    }

    // Return the assembled result.

    return {
        modelRevision: value [ "modelRevision" ],
        canonicalDocument: value [ "canonicalDocument" ],
    };
}

//--------------------------------------------------------------------------------------------------
// Function: decodeModelPutResult
//
// Description:
//
//   Decodes model put result.
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

function decodeModelPutResult ( value: unknown ): ServerModelPutResult | null
{
    // Handle the case where at least one branch condition is satisfied.

    if ( !isRecord ( value ) || !hasExactKeys ( value, [ "modelRevision", "disposition" ] ) ||
        !isValidServerModelRevision ( value [ "modelRevision" ] ) ||
        value [ "disposition" ] !== "replaced" && value [ "disposition" ] !== "unchanged" )
    {
        // Return the computed result.

        return null;
    }

    // Return the assembled result.

    return { modelRevision: value [ "modelRevision" ], disposition: value [ "disposition" ] };
}

//--------------------------------------------------------------------------------------------------
// Function: decodeTransitionTrace
//
// Description:
//
//   Decodes transition trace.
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

function decodeTransitionTrace ( value: unknown ): readonly ServerTransitionTraceEntry[] | null
{
    // Handle the case where at least one branch condition is satisfied.

    if ( !Array.isArray ( value ) || value.length > MAXIMUM_SERVER_TRACE_ENTRY_COUNT )
    {
        // Return the computed result.

        return null;
    }

    const trace: ServerTransitionTraceEntry[] = [];

    // Repeat the operation across the bounded iteration range.

    for ( let i = 0; i < value.length; i++ )
    {
        // Initialize the local values needed by this operation.

        const entry = value [ i ];

        // Handle the case where at least one branch condition is satisfied.

        if ( !isRecord ( entry ) || !hasExactKeys (
            entry,
            [ "event", "sourceState", "destinationState", "outcome" ],
        ) || !isBoundedText ( entry [ "event" ] ) || !isBoundedText ( entry [ "sourceState" ] ) ||
            !isBoundedText ( entry [ "destinationState" ] ) || entry [ "outcome" ] !== "NO_TRANSITION" &&
            entry [ "outcome" ] !== "TRANSITION" && entry [ "outcome" ] !== "UNKNOWN_EVENT" )
        {
            // Return the computed result.

            return null;
        }

        trace.push (
            {
                event: entry [ "event" ],
                sourceState: entry [ "sourceState" ],
                destinationState: entry [ "destinationState" ],
                outcome: entry [ "outcome" ],
            },
        );
    }

    // Return the trace.

    return trace;
}

//--------------------------------------------------------------------------------------------------
// Function: decodeActionTrace
//
// Description:
//
//   Decodes action trace.
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

function decodeActionTrace ( value: unknown ): readonly ServerActionTraceEntry[] | null
{
    // Handle the case where at least one branch condition is satisfied.

    if ( !Array.isArray ( value ) || value.length > MAXIMUM_SERVER_TRACE_ENTRY_COUNT )
    {
        // Return the computed result.

        return null;
    }

    const trace: ServerActionTraceEntry[] = [];

    // Repeat the operation across the bounded iteration range.

    for ( let i = 0; i < value.length; i++ )
    {
        // Initialize the local values needed by this operation.

        const entry = value [ i ];

        // Handle the case where at least one branch condition is satisfied.

        if ( !isRecord ( entry ) || !hasExactKeys ( entry, [ "action", "state", "phase" ] ) ||
            !isBoundedText ( entry [ "action" ] ) || !isBoundedText ( entry [ "state" ] ) ||
            entry [ "phase" ] !== "entry" && entry [ "phase" ] !== "exit" )
        {
            // Return the computed result.

            return null;
        }

        trace.push ( { action: entry [ "action" ], state: entry [ "state" ], phase: entry [ "phase" ] } );
    }

    // Return the trace.

    return trace;
}

//--------------------------------------------------------------------------------------------------
// Function: decodeRuntimeWarnings
//
// Description:
//
//   Decodes runtime warnings.
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

function decodeRuntimeWarnings ( value: unknown ): readonly ServerRuntimeWarning[] | null
{
    // Handle the case where at least one branch condition is satisfied.

    if ( !Array.isArray ( value ) || value.length > MAXIMUM_SERVER_TRACE_ENTRY_COUNT )
    {
        // Return the computed result.

        return null;
    }

    const warnings: ServerRuntimeWarning[] = [];

    // Repeat the operation across the bounded iteration range.

    for ( let i = 0; i < value.length; i++ )
    {
        // Initialize the local values needed by this operation.

        const warning = value [ i ];

        // Handle the case where at least one branch condition is satisfied.

        if ( !isRecord ( warning ) || !hasExactKeys ( warning, [ "code", "event", "message" ] ) ||
            warning [ "code" ] !== "NO_TRANSITION" && warning [ "code" ] !== "UNKNOWN_EVENT" ||
            !isBoundedText ( warning [ "event" ] ) || !isBoundedText ( warning [ "message" ] ) )
        {
            // Return the computed result.

            return null;
        }

        warnings.push ( { code: warning [ "code" ], event: warning [ "event" ], message: warning [ "message" ] } );
    }

    // Return the warnings.

    return warnings;
}

//--------------------------------------------------------------------------------------------------
// Function: decodeSessionSnapshot
//
// Description:
//
//   Decodes session snapshot.
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

function decodeSessionSnapshot ( value: unknown ): ServerSessionSnapshot | null
{
    // Handle the case where at least one branch condition is satisfied.

    if ( !isRecord ( value ) || !hasExactKeys (
        value,
        [
            "sessionId",
            "pinnedModelRevision",
            "isStale",
            "currentState",
            "initialEntryActionsPending",
            "processedEventCount",
            "traceTruncated",
            "transitionTrace",
            "actionTrace",
        ],
    ) || !isValidServerUuid ( value [ "sessionId" ] ) ||
        !isValidServerModelRevision ( value [ "pinnedModelRevision" ] ) ||
        typeof value [ "isStale" ] !== "boolean" || !isBoundedText ( value [ "currentState" ] ) ||
        typeof value [ "initialEntryActionsPending" ] !== "boolean" ||
        !isNonNegativeSafeInteger ( value [ "processedEventCount" ] ) ||
        typeof value [ "traceTruncated" ] !== "boolean" )
    {
        // Return the computed result.

        return null;
    }

    // Initialize the local values needed by this operation.

    const transitionTrace = decodeTransitionTrace ( value [ "transitionTrace" ] );
    const actionTrace     = decodeActionTrace ( value [ "actionTrace" ] );

    // Handle the case where at least one branch condition is satisfied.

    if ( transitionTrace === null || actionTrace === null )
    {
        // Return the computed result.

        return null;
    }

    // Return the assembled result.

    return {
        sessionId: value [ "sessionId" ],
        pinnedModelRevision: value [ "pinnedModelRevision" ],
        isStale: value [ "isStale" ],
        currentState: value [ "currentState" ],
        initialEntryActionsPending: value [ "initialEntryActionsPending" ],
        processedEventCount: value [ "processedEventCount" ],
        traceTruncated: value [ "traceTruncated" ],
        transitionTrace,
        actionTrace,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: decodeSimulationOperationResult
//
// Description:
//
//   Decodes simulation operation result.
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

function decodeSimulationOperationResult ( value: unknown ): ServerSimulationOperationResult | null
{
    // Handle the case where at least one branch condition is satisfied.

    if ( !isRecord ( value ) || !hasExactKeys (
        value,
        [ "session", "consumedEventCount", "emittedActions", "warnings" ],
    ) || !isNonNegativeSafeInteger ( value [ "consumedEventCount" ] ) )
    {
        // Return the computed result.

        return null;
    }

    // Initialize the local values needed by this operation.

    const session        = decodeSessionSnapshot ( value [ "session" ] );
    const emittedActions = decodeStringArray (
        value [ "emittedActions" ],
        MAXIMUM_SERVER_TRACE_ENTRY_COUNT,
        MAXIMUM_NAME_CODE_POINT_COUNT,
    );
    const warnings       = decodeRuntimeWarnings ( value [ "warnings" ] );

    // Handle the case where at least one branch condition is satisfied.

    if ( session === null || emittedActions === null || warnings === null )
    {
        // Return the computed result.

        return null;
    }

    // Return the assembled result.

    return {
        session,
        consumedEventCount: value [ "consumedEventCount" ],
        emittedActions,
        warnings,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: decodeSimulationCloseResult
//
// Description:
//
//   Decodes simulation close result.
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

function decodeSimulationCloseResult ( value: unknown ): ServerSimulationCloseResult | null
{
    // Return the result selected by the current condition.

    return isRecord ( value ) && hasExactKeys ( value, [ "sessionId", "closed" ] ) &&
        isValidServerUuid ( value [ "sessionId" ] ) && value [ "closed" ] === true
        ? { sessionId: value [ "sessionId" ], closed: true }
        : null;
}

//--------------------------------------------------------------------------------------------------
// Function: decodeLifecycleEventPayload
//
// Description:
//
//   Decodes lifecycle event payload.
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

function decodeLifecycleEventPayload ( value: unknown ): ServerLifecycleEventPayload | null
{
    // Handle the case where at least one branch condition is satisfied.

    if ( !isRecord ( value ) || !hasExactKeys (
        value,
        [ "phase", "instanceId", "modelRevision", "message" ],
    ) || value [ "phase" ] !== "failed" && value [ "phase" ] !== "ready" &&
        value [ "phase" ] !== "restarted" && value [ "phase" ] !== "starting" ||
        !isValidServerUuid ( value [ "instanceId" ] ) || value [ "modelRevision" ] !== null &&
        !isValidServerModelRevision ( value [ "modelRevision" ] ) || !isBoundedText ( value [ "message" ] ) )
    {
        // Return the computed result.

        return null;
    }

    // Return the assembled result.

    return {
        phase: value [ "phase" ],
        instanceId: value [ "instanceId" ],
        modelRevision: value [ "modelRevision" ],
        message: value [ "message" ],
    };
}

//--------------------------------------------------------------------------------------------------
// Function: decodeDiagnosticEventPayload
//
// Description:
//
//   Decodes diagnostic event payload.
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

function decodeDiagnosticEventPayload ( value: unknown ): ServerDiagnosticEventPayload | null
{
    // Handle the case where at least one branch condition is satisfied.

    if ( !isRecord ( value ) || !hasExactKeys ( value, [ "diagnostic" ] ) )
    {
        // Return the computed result.

        return null;
    }

    const diagnostic = decodeProtocolDiagnostic ( value [ "diagnostic" ] );

    // Return the result selected by the current condition.

    return diagnostic === null ? null : { diagnostic };
}

//--------------------------------------------------------------------------------------------------
// Function: decodeModelChangedEventPayload
//
// Description:
//
//   Decodes model changed event payload.
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

function decodeModelChangedEventPayload ( value: unknown ): ServerModelChangedEventPayload | null
{
    // Handle the case where at least one branch condition is satisfied.

    if ( !isRecord ( value ) || !hasExactKeys (
        value,
        [ "previousModelRevision", "modelRevision", "disposition" ],
    ) || !isValidServerModelRevision ( value [ "previousModelRevision" ] ) ||
        !isValidServerModelRevision ( value [ "modelRevision" ] ) ||
        value [ "disposition" ] !== "replaced" && value [ "disposition" ] !== "unchanged" )
    {
        // Return the computed result.

        return null;
    }

    // Return the assembled result.

    return {
        previousModelRevision: value [ "previousModelRevision" ],
        modelRevision: value [ "modelRevision" ],
        disposition: value [ "disposition" ],
    };
}

//--------------------------------------------------------------------------------------------------
// Function: outboundDecodeFailure
//
// Description:
//
//   Derives the outbound decode failure.
//
// Parameters:
//
//   - code:
//     The code supplied to the operation.
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

function outboundDecodeFailure (
    code: ServerOutboundDecodeErrorCode,
    message: string,
): ServerOutboundDecodeResult
{
    // Return the assembled result.

    return { isSuccessful: false, code, message };
}

//--------------------------------------------------------------------------------------------------
// Function: validOutboundSequence
//
// Description:
//
//   Derives the valid outbound sequence.
//
// Parameters:
//
//   - serverSequence:
//     The server sequence supplied to the operation.
//
//   - previousServerSequence:
//     The previous server sequence supplied to the operation.
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

function validOutboundSequence (
    serverSequence: unknown,
    previousServerSequence: number | null,
): serverSequence is number
{
    // Return the computed result.

    return isPositiveServerSequence ( serverSequence ) &&
        ( previousServerSequence === null || serverSequence > previousServerSequence );
}

//--------------------------------------------------------------------------------------------------
// Function: createServerSuccessResponseEnvelope
//
// Description:
//
//   Creates server success response envelope.
//
// Parameters:
//
//   - parameters:
//     The parameters supplied to the operation.
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

export function createServerSuccessResponseEnvelope<Operation extends ServerOperation> (
    parameters: CreateServerSuccessResponseParameters<Operation>,
): ServerSuccessResponseEnvelopeFor<Operation>
{
    // Return the assembled result.

    return { protocol: SERVER_PROTOCOL_VERSION, kind: "success", ...parameters };
}

//--------------------------------------------------------------------------------------------------
// Function: createServerErrorResponseEnvelope
//
// Description:
//
//   Creates server error response envelope.
//
// Parameters:
//
//   - parameters:
//     The parameters supplied to the operation.
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

export function createServerErrorResponseEnvelope (
    parameters: CreateServerErrorResponseParameters,
): ServerErrorResponseEnvelope
{
    // Return the assembled result.

    return { protocol: SERVER_PROTOCOL_VERSION, kind: "error", ...parameters };
}

//--------------------------------------------------------------------------------------------------
// Function: createServerEventEnvelope
//
// Description:
//
//   Creates server event envelope.
//
// Parameters:
//
//   - parameters:
//     The parameters supplied to the operation.
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

export function createServerEventEnvelope<EventName extends ServerEventName> (
    parameters: CreateServerEventParameters<EventName>,
): ServerEventEnvelopeFor<EventName>
{
    // Return the assembled result.

    return { protocol: SERVER_PROTOCOL_VERSION, kind: "event", ...parameters };
}

//--------------------------------------------------------------------------------------------------
// Function: decodeServerOutboundEnvelope
//
// Description:
//
//   Decodes server outbound envelope.
//
// Parameters:
//
//   - value:
//     The value supplied to the operation.
//
//   - previousServerSequence:
//     The previous server sequence supplied to the operation.
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

export function decodeServerOutboundEnvelope (
    value: unknown,
    previousServerSequence: number | null = null,
): ServerOutboundDecodeResult
{
    // Handle the case where all required conditions are satisfied.

    if ( previousServerSequence !== null && !isNonNegativeSafeInteger ( previousServerSequence ) )
    {
        // Return the outbound decode failure result.

        return outboundDecodeFailure (
            "OUTBOUND_SEQUENCE_INVALID",
            "The previous server sequence must be a non-negative safe integer or null.",
        );
    }

    // Handle the case where at least one branch condition is satisfied.

    if ( inspectProtocolValue ( value ) !== "valid" || !isRecord ( value ) ||
        value [ "protocol" ] !== SERVER_PROTOCOL_VERSION )
    {
        // Return the outbound decode failure result.

        return outboundDecodeFailure (
            "OUTBOUND_MESSAGE_INVALID",
            "The outbound value is not a valid structural-clone-safe server envelope.",
        );
    }

    const kind = value [ "kind" ];

    // Handle the case where all required conditions are satisfied.

    if ( kind !== "success" && kind !== "error" && kind !== "event" )
    {
        // Return the outbound decode failure result.

        return outboundDecodeFailure ( "OUTBOUND_MESSAGE_INVALID", "The outbound kind is unsupported." );
    }

    // Handle the case where the valid outbound sequence result condition is not satisfied.

    if ( !validOutboundSequence ( value [ "serverSequence" ], previousServerSequence ) )
    {
        // Return the outbound decode failure result.

        return outboundDecodeFailure (
            "OUTBOUND_SEQUENCE_INVALID",
            "serverSequence must be a positive safe integer greater than the previously accepted sequence.",
        );
    }

    // Handle the case where the is valid server utc timestamp result condition is not satisfied.

    if ( !isValidServerUtcTimestamp ( value [ "timestampUtc" ] ) )
    {
        // Return the outbound decode failure result.

        return outboundDecodeFailure (
            "OUTBOUND_TIMESTAMP_INVALID",
            "timestampUtc must be a canonical millisecond-resolution UTC timestamp.",
        );
    }

    // Initialize the local values needed by this operation.

    const serverSequence = value [ "serverSequence" ];
    const timestampUtc   = value [ "timestampUtc" ];

    // Handle the case where kind matches the success value.

    if ( kind === "success" )
    {
        // Handle the case where at least one branch condition is satisfied.

        if ( !hasExactKeys ( value, SUCCESS_RESPONSE_ENVELOPE_KEYS ) ||
            !isValidServerUuid ( value [ "requestId" ] ) || !isServerOperation ( value [ "operation" ] ) )
        {
            // Return the outbound decode failure result.

            return outboundDecodeFailure ( "OUTBOUND_MESSAGE_INVALID", "The success envelope shape is invalid." );
        }

        // Initialize the local values needed by this operation.

        const requestId         = value [ "requestId" ];
        const operation         = value [ "operation" ];
        const possibleResult    = value [ "result" ];
        const canonicalDocument = operation === "model.get" && isRecord ( possibleResult ) &&
            typeof possibleResult [ "canonicalDocument" ] === "string"
            ? possibleResult [ "canonicalDocument" ]
            : null;
        const resultByteCount = canonicalDocument === null
            ? jsonByteCount ( possibleResult )
            : textByteCount ( canonicalDocument );

        // Handle the case where at least one branch condition is satisfied.

        if ( resultByteCount === null || resultByteCount > MAXIMUM_SERVER_PAYLOAD_BYTE_COUNT )
        {
            // Return the outbound decode failure result.

            return outboundDecodeFailure ( "OUTBOUND_MESSAGE_INVALID", "The success result exceeds its bound." );
        }

        // Dispatch according to the operation value.

        switch ( operation )
        {
            // Handle the "server.hello" case.

            case "server.hello":
            {
                // Initialize the local values needed by this operation.

                const result = decodeHelloResult ( value [ "result" ] );

                // Return the result selected by the current condition.

                return result === null
                    ? outboundDecodeFailure ( "OUTBOUND_MESSAGE_INVALID", "The server.hello result is invalid." )
                    : {
                        isSuccessful: true,
                        message:
                        {
                            protocol: SERVER_PROTOCOL_VERSION,
                            kind: "success",
                            requestId,
                            operation,
                            serverSequence,
                            timestampUtc,
                            result,
                        },
                    };
            }

            // Handle the "health.live" case.

            case "health.live":
            {
                // Initialize the local values needed by this operation.

                const result = decodeHealthLiveResult ( value [ "result" ] );

                // Return the result selected by the current condition.

                return result === null
                    ? outboundDecodeFailure ( "OUTBOUND_MESSAGE_INVALID", "The health.live result is invalid." )
                    : {
                        isSuccessful: true,
                        message:
                        {
                            protocol: SERVER_PROTOCOL_VERSION,
                            kind: "success",
                            requestId,
                            operation,
                            serverSequence,
                            timestampUtc,
                            result,
                        },
                    };
            }

            // Handle the "health.ready" case.

            case "health.ready":
            {
                // Initialize the local values needed by this operation.

                const result = decodeHealthReadyResult ( value [ "result" ] );

                // Return the result selected by the current condition.

                return result === null
                    ? outboundDecodeFailure ( "OUTBOUND_MESSAGE_INVALID", "The health.ready result is invalid." )
                    : {
                        isSuccessful: true,
                        message:
                        {
                            protocol: SERVER_PROTOCOL_VERSION,
                            kind: "success",
                            requestId,
                            operation,
                            serverSequence,
                            timestampUtc,
                            result,
                        },
                    };
            }

            // Handle the "model.get" case.

            case "model.get":
            {
                // Initialize the local values needed by this operation.

                const result = decodeModelGetResult ( value [ "result" ] );

                // Return the result selected by the current condition.

                return result === null
                    ? outboundDecodeFailure ( "OUTBOUND_MESSAGE_INVALID", "The model.get result is invalid." )
                    : {
                        isSuccessful: true,
                        message:
                        {
                            protocol: SERVER_PROTOCOL_VERSION,
                            kind: "success",
                            requestId,
                            operation,
                            serverSequence,
                            timestampUtc,
                            result,
                        },
                    };
            }

            // Handle the "model.put" case.

            case "model.put":
            {
                // Initialize the local values needed by this operation.

                const result = decodeModelPutResult ( value [ "result" ] );

                // Return the result selected by the current condition.

                return result === null
                    ? outboundDecodeFailure ( "OUTBOUND_MESSAGE_INVALID", "The model.put result is invalid." )
                    : {
                        isSuccessful: true,
                        message:
                        {
                            protocol: SERVER_PROTOCOL_VERSION,
                            kind: "success",
                            requestId,
                            operation,
                            serverSequence,
                            timestampUtc,
                            result,
                        },
                    };
            }

            // Handle the group of case values that share the following outcome.

            case "simulation.start":
            case "simulation.reset":
            {
                // Initialize the local values needed by this operation.

                const result = decodeSessionSnapshot ( value [ "result" ] );

                // Return the result selected by the current condition.

                return result === null
                    ? outboundDecodeFailure ( "OUTBOUND_MESSAGE_INVALID", "The session snapshot is invalid." )
                    : {
                        isSuccessful: true,
                        message:
                        {
                            protocol: SERVER_PROTOCOL_VERSION,
                            kind: "success",
                            requestId,
                            operation,
                            serverSequence,
                            timestampUtc,
                            result,
                        },
                    };
            }

            // Handle the group of case values that share the following outcome.

            case "simulation.run":
            case "simulation.step":
            {
                // Initialize the local values needed by this operation.

                const result = decodeSimulationOperationResult ( value [ "result" ] );

                // Return the result selected by the current condition.

                return result === null
                    ? outboundDecodeFailure ( "OUTBOUND_MESSAGE_INVALID", "The simulation result is invalid." )
                    : {
                        isSuccessful: true,
                        message:
                        {
                            protocol: SERVER_PROTOCOL_VERSION,
                            kind: "success",
                            requestId,
                            operation,
                            serverSequence,
                            timestampUtc,
                            result,
                        },
                    };
            }

            // Handle the "simulation.close" case.

            case "simulation.close":
            {
                // Initialize the local values needed by this operation.

                const result = decodeSimulationCloseResult ( value [ "result" ] );

                // Return the result selected by the current condition.

                return result === null
                    ? outboundDecodeFailure ( "OUTBOUND_MESSAGE_INVALID", "The simulation.close result is invalid." )
                    : {
                        isSuccessful: true,
                        message:
                        {
                            protocol: SERVER_PROTOCOL_VERSION,
                            kind: "success",
                            requestId,
                            operation,
                            serverSequence,
                            timestampUtc,
                            result,
                        },
                    };
            }
        }
    }

    // Handle the case where kind matches the error value.

    if ( kind === "error" )
    {
        // Handle the case where at least one branch condition is satisfied.

        if ( !hasExactKeys ( value, ERROR_RESPONSE_ENVELOPE_KEYS ) ||
            !isValidServerUuid ( value [ "requestId" ] ) ||
            value [ "operation" ] !== null && !isServerOperation ( value [ "operation" ] ) )
        {
            // Return the outbound decode failure result.

            return outboundDecodeFailure ( "OUTBOUND_MESSAGE_INVALID", "The error envelope shape is invalid." );
        }

        // Initialize the local values needed by this operation.

        const error          = decodeProtocolError ( value [ "error" ] );
        const errorByteCount = jsonByteCount ( value [ "error" ] );

        // Handle the case where at least one branch condition is satisfied.

        if ( error === null || errorByteCount === null || errorByteCount > MAXIMUM_SERVER_PAYLOAD_BYTE_COUNT )
        {
            // Return the outbound decode failure result.

            return outboundDecodeFailure ( "OUTBOUND_MESSAGE_INVALID", "The protocol error is invalid." );
        }

        // Return the assembled result.

        return {
            isSuccessful: true,
            message:
            {
                protocol: SERVER_PROTOCOL_VERSION,
                kind: "error",
                requestId: value [ "requestId" ],
                operation: value [ "operation" ],
                serverSequence,
                timestampUtc,
                error,
            },
        };
    }

    // Handle the case where the has exact keys result condition is not satisfied.

    if ( !hasExactKeys ( value, EVENT_ENVELOPE_KEYS ) )
    {
        // Return the outbound decode failure result.

        return outboundDecodeFailure ( "OUTBOUND_MESSAGE_INVALID", "The event envelope shape is invalid." );
    }

    const payloadByteCount = jsonByteCount ( value [ "payload" ] );

    // Handle the case where at least one branch condition is satisfied.

    if ( payloadByteCount === null || payloadByteCount > MAXIMUM_SERVER_PAYLOAD_BYTE_COUNT )
    {
        // Return the outbound decode failure result.

        return outboundDecodeFailure ( "OUTBOUND_MESSAGE_INVALID", "The event payload exceeds its bound." );
    }

    // Dispatch according to the selected collection value value.

    switch ( value [ "event" ] )
    {
        // Handle the "server.lifecycle" case.

        case "server.lifecycle":
        {
            // Initialize the local values needed by this operation.

            const payload = decodeLifecycleEventPayload ( value [ "payload" ] );

            // Return the result selected by the current condition.

            return payload === null
                ? outboundDecodeFailure ( "OUTBOUND_MESSAGE_INVALID", "The server.lifecycle payload is invalid." )
                : {
                    isSuccessful: true,
                    message:
                    {
                        protocol: SERVER_PROTOCOL_VERSION,
                        kind: "event",
                        event: "server.lifecycle",
                        serverSequence,
                        timestampUtc,
                        payload,
                    },
                };
        }

        // Handle the "server.diagnostic" case.

        case "server.diagnostic":
        {
            // Initialize the local values needed by this operation.

            const payload = decodeDiagnosticEventPayload ( value [ "payload" ] );

            // Return the result selected by the current condition.

            return payload === null
                ? outboundDecodeFailure ( "OUTBOUND_MESSAGE_INVALID", "The server.diagnostic payload is invalid." )
                : {
                    isSuccessful: true,
                    message:
                    {
                        protocol: SERVER_PROTOCOL_VERSION,
                        kind: "event",
                        event: "server.diagnostic",
                        serverSequence,
                        timestampUtc,
                        payload,
                    },
                };
        }

        // Handle the "model.changed" case.

        case "model.changed":
        {
            // Initialize the local values needed by this operation.

            const payload = decodeModelChangedEventPayload ( value [ "payload" ] );

            // Return the result selected by the current condition.

            return payload === null
                ? outboundDecodeFailure ( "OUTBOUND_MESSAGE_INVALID", "The model.changed payload is invalid." )
                : {
                    isSuccessful: true,
                    message:
                    {
                        protocol: SERVER_PROTOCOL_VERSION,
                        kind: "event",
                        event: "model.changed",
                        serverSequence,
                        timestampUtc,
                        payload,
                    },
                };
        }

        // Handle values not matched by an earlier case.

        default:

            // Return the outbound decode failure result.

            return outboundDecodeFailure ( "OUTBOUND_MESSAGE_INVALID", "The server event is unsupported." );
    }
}

//--------------------------------------------------------------------------------------------------
// Type: ServerWorkerRequest
//
// Description:
//
//   Describes a server worker request.
//
//--------------------------------------------------------------------------------------------------

export type ServerWorkerRequest         = ServerRequestEnvelope;

//--------------------------------------------------------------------------------------------------
// Type: ServerWorkerSuccessMessage
//
// Description:
//
//   Defines the server worker success message type.
//
//--------------------------------------------------------------------------------------------------

export type ServerWorkerSuccessMessage = ServerSuccessResponseEnvelope;

//--------------------------------------------------------------------------------------------------
// Type: ServerWorkerErrorMessage
//
// Description:
//
//   Defines the server worker error message type.
//
//--------------------------------------------------------------------------------------------------

export type ServerWorkerErrorMessage   = ServerErrorResponseEnvelope;

//--------------------------------------------------------------------------------------------------
// Type: ServerWorkerEventMessage
//
// Description:
//
//   Defines the server worker event message type.
//
//--------------------------------------------------------------------------------------------------

export type ServerWorkerEventMessage   = ServerEventEnvelope;

//--------------------------------------------------------------------------------------------------
// Type: ServerWorkerOutboundMessage
//
// Description:
//
//   Defines the server worker outbound message type.
//
//--------------------------------------------------------------------------------------------------

export type ServerWorkerOutboundMessage = ServerOutboundEnvelope;

export const decodeServerWorkerRequest         = decodeServerRequestEnvelope;
export const decodeServerWorkerOutboundMessage = decodeServerOutboundEnvelope;
export const createServerWorkerSuccessMessage  = createServerSuccessResponseEnvelope;
export const createServerWorkerErrorMessage    = createServerErrorResponseEnvelope;
export const createServerWorkerEventMessage    = createServerEventEnvelope;
