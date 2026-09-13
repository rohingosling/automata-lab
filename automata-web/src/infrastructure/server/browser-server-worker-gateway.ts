// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Browser Server Worker Gateway
// Version: 1.0.0
// Date:    2026-08-14
// Author:  Rohin Gosling
//
// Description:
//
//   Maps the transport-neutral ServerGateway to one persistent, versioned module-worker connection.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type
{
    ConditionalHostedDocumentPut,
    HostedDocumentDto,
    HostedDocumentPutResult,
    HostedSessionDto,
    HostedSessionEventRequest,
    HostedSessionOperationResult,
    ServerConnectionDescription,
    ServerGateway,
    ServerGatewayFailure,
    ServerGatewayResult,
    ServerTestResult,
} from "../../application/server-contracts.js";
import { COMPILE_TIME_CONFIGURATION } from "../../configuration/compile-time-configuration.js";
import type { CanonicalSerializedDocument } from "../../domain/model/contracts.js";
import
{
    decodeServerOutboundEnvelope,
    SERVER_PROTOCOL_VERSION,
} from "../../workers/server/protocol.js";
import type
{
    ServerEventEnvelope,
    ServerModelRevision,
    ServerOperation,
    ServerProtocolError,
    ServerRequestEnvelope,
    ServerRequestEnvelopeFor,
    ServerSessionSnapshot,
    ServerSimulationOperationResult,
    ServerSuccessResponseEnvelope,
} from "../../workers/server/protocol.js";

//--------------------------------------------------------------------------------------------------
// Interface: BrowserServerWorkerEndpoint
//
// Description:
//
//   Defines the structure of browser server worker endpoint.
//
//--------------------------------------------------------------------------------------------------

export interface BrowserServerWorkerEndpoint
{
    onerror:        ( ( event: ErrorEvent ) => void ) | null;
    onmessage:      ( ( event: MessageEvent<unknown> ) => void ) | null;
    onmessageerror: ( ( event: MessageEvent<unknown> ) => void ) | null;
    postMessage ( message: unknown ): void;
    terminate (): void;
}

//--------------------------------------------------------------------------------------------------
// Interface: BrowserServerWorkerGatewayOptions
//
// Description:
//
//   Defines the options that control browser server worker gateway.
//
//--------------------------------------------------------------------------------------------------

export interface BrowserServerWorkerGatewayOptions
{
    readonly createRequestIdentifier?: () => string;
    readonly createWorker?:            () => BrowserServerWorkerEndpoint;
    readonly onConnectionLost?:        ( failure: ServerGatewayFailure ) => void;
    readonly onServerEvent?:           ( event: ServerEventEnvelope ) => void;
    readonly requestTimeoutMilliseconds?: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: PendingServerRequest
//
// Description:
//
//   Describes a pending server request.
//
//--------------------------------------------------------------------------------------------------

interface PendingServerRequest
{
    readonly operation: ServerOperation;
    readonly resolve:   ( result: ServerGatewayResult<ServerSuccessResponseEnvelope> ) => void;
    readonly timeout:   ReturnType<typeof setTimeout>;
}

//--------------------------------------------------------------------------------------------------
// Class: ServerWorkerUnsupportedError
//
// Description:
//
//   Implements the server worker unsupported error behavior.
//
//--------------------------------------------------------------------------------------------------

class ServerWorkerUnsupportedError extends Error
{
}

//--------------------------------------------------------------------------------------------------
// Function: createDefaultWorker
//
// Description:
//
//   Creates default worker.
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

function createDefaultWorker (): BrowserServerWorkerEndpoint
{
    // Handle the case where current value matches the undefined value.

    if ( typeof Worker === "undefined" )
    {
        throw new ServerWorkerUnsupportedError ( "This browser does not provide module Web Workers." );
    }

    // Return the computed result.

    return new Worker (
        new URL ( "../../workers/server.worker.ts", import.meta.url ),
        { name: "automata-lab-server", type: "module" },
    );
}

//--------------------------------------------------------------------------------------------------
// Function: createRequestIdentifier
//
// Description:
//
//   Creates request identifier.
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

function createRequestIdentifier (): string
{
    // Return the random uuid result.

    return globalThis.crypto.randomUUID ();
}

//--------------------------------------------------------------------------------------------------
// Function: success
//
// Description:
//
//   Derives the success.
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

function success<Value> ( value: Value ): ServerGatewayResult<Value>
{
    // Return the assembled result.

    return { isSuccessful: true, value };
}

//--------------------------------------------------------------------------------------------------
// Function: failure
//
// Description:
//
//   Derives the failure.
//
// Parameters:
//
//   - code:
//     The code supplied to the operation.
//
//   - message:
//     The message supplied to the operation.
//
//   - remediation:
//     The remediation supplied to the operation.
//
//   - isRetryable:
//     The is retryable supplied to the operation.
//
//   - currentModelRevision:
//     The current model revision supplied to the operation.
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

function failure<Value = never> (
    code: ServerGatewayFailure["code"],
    message: string,
    remediation: string,
    isRetryable: boolean,
    currentModelRevision?: string,
): ServerGatewayResult<Value>
{
    // Return the assembled result.

    return {
        isSuccessful: false,
        failure:
        {
            code,
            ...( currentModelRevision === undefined ? {} : { currentModelRevision } ),
            isRetryable,
            message,
            remediation,
        },
    };
}

//--------------------------------------------------------------------------------------------------
// Function: mapProtocolError
//
// Description:
//
//   Maps protocol error.
//
// Parameters:
//
//   - error:
//     The error supplied to the operation.
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

function mapProtocolError<Value = never> ( error: ServerProtocolError ): ServerGatewayResult<Value>
{
    // Dispatch according to the error code value.

    switch ( error.code )
    {
        // Handle the "MODEL_REVISION_CONFLICT" case.

        case "MODEL_REVISION_CONFLICT":

            // Return the failure result.

            return failure (
                "HOSTED_MODEL_CONFLICT",
                error.message,
                "Pull the current hosted document, review it, and retry Push from that revision.",
                false,
            );

        // Handle the group of case values that share the following outcome.

        case "MODEL_INVALID":
        case "DOCUMENT_TOO_LARGE":

            // Return the failure result.

            return failure (
                "HOSTED_MODEL_INVALID",
                error.message,
                "Correct the complete document and retry Push.",
                false,
            );

        // Handle the "SERVER_NOT_READY" case.

        case "SERVER_NOT_READY":

            // Return the failure result.

            return failure (
                "SERVER_NOT_READY",
                error.message,
                "Restart the built-in server and retry when readiness succeeds.",
                true,
            );

        // Handle the "SESSION_CAPACITY_EXCEEDED" case.

        case "SESSION_CAPACITY_EXCEEDED":

            // Return the failure result.

            return failure (
                "SESSION_LIMIT_REACHED",
                error.message,
                "Close an existing simulation session before creating another one.",
                false,
            );

        // Handle the "SESSION_NOT_FOUND" case.

        case "SESSION_NOT_FOUND":

            // Return the failure result.

            return failure (
                "SESSION_NOT_FOUND",
                error.message,
                "Create a new simulation session on the current hosted revision.",
                false,
            );

        // Handle the "INTERNAL_ERROR" case.

        case "INTERNAL_ERROR":

            // Return the failure result.

            return failure (
                "SERVER_WORKER_FAILED",
                error.message,
                "Restart the built-in server and retry the operation.",
                true,
            );

        // Handle the group of case values that share the following outcome.

        case "CONDITIONAL_MODEL_REVISION_INVALID":
        case "DUPLICATE_REQUEST_ID":
        case "OPERATION_UNSUPPORTED":
        case "PAYLOAD_INVALID":
        case "PAYLOAD_TOO_LARGE":
        case "PROTOCOL_UNSUPPORTED":
        case "PROTOTYPE_KEY_FORBIDDEN":
        case "REQUEST_ID_INVALID":
        case "REQUEST_KIND_INVALID":
        case "REQUEST_SHAPE_INVALID":
        case "SESSION_ID_INVALID":
        case "TRACE_CAPACITY_EXCEEDED":

            // Return the failure result.

            return failure (
                "SERVER_REQUEST_INVALID",
                error.message,
                "Reconnect to a compatible server and retry the operation.",
                false,
            );
    }
}

//--------------------------------------------------------------------------------------------------
// Function: copySession
//
// Description:
//
//   Copies the session.
//
// Parameters:
//
//   - session:
//     The session supplied to the operation.
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

function copySession ( session: ServerSessionSnapshot ): HostedSessionDto
{
    // Return the assembled result.

    return {
        actionTrace: session.actionTrace.map ( entry => ( { ...entry } ) ),
        currentState: session.currentState,
        initialEntryActionsPending: session.initialEntryActionsPending,
        isStale: session.isStale,
        modelRevision: session.pinnedModelRevision,
        processedEventCount: session.processedEventCount,
        sessionId: session.sessionId,
        traceTruncated: session.traceTruncated,
        transitionTrace: session.transitionTrace.map ( entry => ( { ...entry } ) ),
    };
}

//--------------------------------------------------------------------------------------------------
// Function: copySimulationOperation
//
// Description:
//
//   Copies the simulation operation.
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

function copySimulationOperation ( operation: ServerSimulationOperationResult ): HostedSessionOperationResult
{
    // Return the assembled result.

    return {
        consumedEventCount: operation.consumedEventCount,
        emittedActions:     [ ...operation.emittedActions ],
        session:            copySession ( operation.session ),
        warnings:           operation.warnings.map ( warning => ( { ...warning } ) ),
    };
}

//--------------------------------------------------------------------------------------------------
// Function: disconnectedFailure
//
// Description:
//
//   Derives the disconnected failure.
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

function disconnectedFailure<Value = never> (): ServerGatewayResult<Value>
{
    // Return the failure result.

    return failure (
        "SERVER_DISCONNECTED",
        "The client is not connected to the configured server.",
        "Connect to the server before retrying the operation.",
        true,
    );
}

//--------------------------------------------------------------------------------------------------
// Function: unexpectedOperationFailure
//
// Description:
//
//   Derives the unexpected operation failure.
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

function unexpectedOperationFailure<Value = never> (): ServerGatewayResult<Value>
{
    // Return the failure result.

    return failure (
        "SERVER_RESPONSE_INVALID",
        "The server response operation did not match the request.",
        "Reconnect to the server and retry the operation.",
        true,
    );
}

//--------------------------------------------------------------------------------------------------
// Function: isServerModelRevision
//
// Description:
//
//   Determines whether server model revision.
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

function isServerModelRevision ( value: string ): value is ServerModelRevision
{
    // Return the test result.

    return /^sha256:[0-9a-f]{64}$/u.test ( value );
}

//--------------------------------------------------------------------------------------------------
// Class: BrowserServerWorkerGateway
//
// Description:
//
//   Implements the browser server worker gateway behavior.
//
//--------------------------------------------------------------------------------------------------

export class BrowserServerWorkerGateway implements ServerGateway
{
    private readonly createRequestIdentifier: () => string;
    private readonly createWorker:            () => BrowserServerWorkerEndpoint;
    private readonly requestTimeoutMilliseconds: number;
    private readonly pendingRequests = new Map<string, PendingServerRequest> ();
    private connected                  = false;
    private connection: ServerConnectionDescription | null = null;
    private lastServerSequence         = 0;
    private serverUrl: string | null   = null;
    private serverWorker: BrowserServerWorkerEndpoint | null = null;
    private workerGeneration           = 0;
    private onConnectionLost: ( ( failure: ServerGatewayFailure ) => void ) | undefined;
    private onServerEvent: ( ( event: ServerEventEnvelope ) => void ) | undefined;

    //----------------------------------------------------------------------------------------------
    // Constructor: BrowserServerWorkerGateway
    //
    // Description:
    //
    //   Initializes a BrowserServerWorkerGateway instance.
    //
    // Parameters:
    //
    //   - options:
    //     Options that control the operation.
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

    public constructor ( options: BrowserServerWorkerGatewayOptions = {} )
    {
        this.createRequestIdentifier    = options.createRequestIdentifier ?? createRequestIdentifier;
        this.createWorker               = options.createWorker ?? createDefaultWorker;
        this.onConnectionLost           = options.onConnectionLost;
        this.onServerEvent              = options.onServerEvent;
        this.requestTimeoutMilliseconds = options.requestTimeoutMilliseconds ??
            COMPILE_TIME_CONFIGURATION.server.gateway.requestTimeoutMilliseconds;
    }

    //----------------------------------------------------------------------------------------------
    // Method: setServerEventHandler
    //
    // Description:
    //
    //   Updates server event handler.
    //
    // Parameters:
    //
    //   - handler:
    //     The handler supplied to the operation.
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

    public setServerEventHandler ( handler: ( ( event: ServerEventEnvelope ) => void ) | undefined ): void
    {
        this.onServerEvent = handler;
    }

    //----------------------------------------------------------------------------------------------
    // Method: setConnectionLostHandler
    //
    // Description:
    //
    //   Updates connection lost handler.
    //
    // Parameters:
    //
    //   - handler:
    //     The handler supplied to the operation.
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

    public setConnectionLostHandler ( handler: ( ( failure: ServerGatewayFailure ) => void ) | undefined ): void
    {
        this.onConnectionLost = handler;
    }

    //----------------------------------------------------------------------------------------------
    // Method: connect
    //
    // Description:
    //
    //   Connects the requested value.
    //
    // Parameters:
    //
    //   - serverUrl:
    //     The server URL supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    public async connect ( serverUrl: string ): Promise<ServerGatewayResult<ServerConnectionDescription>>
    {
        // Initialize the local values needed by this operation.

        const normalizedServerUrl = serverUrl.trim ();

        // Handle the case where the starts with result condition is not satisfied.

        if ( !normalizedServerUrl.startsWith ( "builtin://" ) )
        {
            // Return the failure result.

            return failure (
                "SERVER_CONNECTION_FAILED",
                `No installed server adapter supports '${normalizedServerUrl}'.`,
                "Choose a builtin:// Server URL or install a compatible external gateway.",
                false,
            );
        }

        // Handle the case where at least one branch condition is satisfied.

        if ( this.serverWorker === null || this.serverUrl !== normalizedServerUrl )
        {
            // Initialize the local values needed by this operation.

            const workerResult = this.replaceWorker ( normalizedServerUrl );

            // Handle the case where the worker result is successful condition is not satisfied.

            if ( !workerResult.isSuccessful )
            {
                // Return the worker result.

                return workerResult;
            }
        }

        const helloResult = await this.requestHello ();

        // Handle the case where the hello result is successful condition is not satisfied.

        if ( !helloResult.isSuccessful )
        {
            this.connected  = false;
            this.connection = null;

            // Return the hello result.

            return helloResult;
        }

        const description: ServerConnectionDescription =
        {
            instanceId:    helloResult.value.instanceId,
            isReady:       helloResult.value.ready,
            modelRevision: helloResult.value.modelRevision,
        };

        this.connected  = true;
        this.connection = description;

        // Return the success result.

        return success ( description );
    }

    //----------------------------------------------------------------------------------------------
    // Method: disconnect
    //
    // Description:
    //
    //   Disconnects the requested value.
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

    public async disconnect (): Promise<ServerGatewayResult<void>>
    {
        this.connected  = false;
        this.connection = null;
        this.rejectPendingRequests ( disconnectedFailure () );

        // Return the success result.

        return success ( undefined );
    }

    //----------------------------------------------------------------------------------------------
    // Method: test
    //
    // Description:
    //
    //   Checks the requested condition.
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

    public async test (): Promise<ServerGatewayResult<ServerTestResult>>
    {
        // Handle the case where the connected condition is not satisfied.

        if ( !this.connected )
        {
            // Return the disconnected failure result.

            return disconnectedFailure ();
        }

        const liveResult = await this.requestHealthLive ();

        // Handle the case where the live result is successful condition is not satisfied.

        if ( !liveResult.isSuccessful )
        {
            // Return the live result.

            return liveResult;
        }

        const readyResult = await this.requestHealthReady ();

        // Handle the case where the ready result is successful condition is not satisfied.

        if ( !readyResult.isSuccessful )
        {
            // Return the ready result.

            return readyResult;
        }

        // Handle the case where at least one branch condition is satisfied.

        if ( this.connection === null || liveResult.value.instanceId !== this.connection.instanceId )
        {
            // Return the failure result.

            return failure (
                "SERVER_RESPONSE_INVALID",
                "The server instance changed during the liveness test.",
                "Reconnect to the server and run the test again.",
                true,
            );
        }

        const result: ServerTestResult =
        {
            instanceId:    liveResult.value.instanceId,
            isLive:        true,
            isReady:       readyResult.value.ready,
            modelRevision: readyResult.value.modelRevision,
        };

        this.connection = result;

        // Return the success result.

        return success ( result );
    }

    //----------------------------------------------------------------------------------------------
    // Method: getHostedDocument
    //
    // Description:
    //
    //   Returns hosted document.
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

    public async getHostedDocument (): Promise<ServerGatewayResult<HostedDocumentDto>>
    {
        // Handle the case where the connected condition is not satisfied.

        if ( !this.connected )
        {
            // Return the disconnected failure result.

            return disconnectedFailure ();
        }

        const responseResult = await this.exchangeIdempotent ( () =>
        {
            // Initialize the local values needed by this operation.

            const request: ServerRequestEnvelopeFor<"model.get"> =
            {
                conditionalModelRevision: null,
                kind:      "request",
                operation: "model.get",
                payload:   {},
                protocol:  SERVER_PROTOCOL_VERSION,
                requestId: this.createRequestIdentifier (),
                sessionId: null,
            };

            // Return the request.

            return request;
        } );

        // Handle the case where the response result is successful condition is not satisfied.

        if ( !responseResult.isSuccessful )
        {
            // Return the response result.

            return responseResult;
        }

        // Handle the case where operation differs from the model.get value.

        if ( responseResult.value.operation !== "model.get" )
        {
            // Return the unexpected operation failure result.

            return unexpectedOperationFailure ();
        }

        const canonicalDocument: CanonicalSerializedDocument =
        {
            text: responseResult.value.result.canonicalDocument,
        };

        // Return the success result.

        return success (
            {
                canonicalDocument,
                modelRevision: responseResult.value.result.modelRevision,
            },
        );
    }

    //----------------------------------------------------------------------------------------------
    // Method: putHostedDocument
    //
    // Description:
    //
    //   Stores the hosted document.
    //
    // Parameters:
    //
    //   - request:
    //     The request supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    public async putHostedDocument (
        request: ConditionalHostedDocumentPut,
    ): Promise<ServerGatewayResult<HostedDocumentPutResult>>
    {
        // Handle the case where the connected condition is not satisfied.

        if ( !this.connected )
        {
            // Return the disconnected failure result.

            return disconnectedFailure ();
        }

        // Handle the case where the is server model revision result condition is not satisfied.

        if ( !isServerModelRevision ( request.expectedModelRevision ) )
        {
            // Return the failure result.

            return failure (
                "SERVER_REQUEST_INVALID",
                "Push requires a valid SHA-256 hosted revision baseline.",
                "Reconnect or Pull before retrying Push.",
                false,
            );
        }

        // Initialize the local values needed by this operation.

        const outboundRequest: ServerRequestEnvelopeFor<"model.put"> =
        {
            conditionalModelRevision: request.expectedModelRevision,
            kind:      "request",
            operation: "model.put",
            payload:   { canonicalDocument: request.canonicalDocument.text },
            protocol:  SERVER_PROTOCOL_VERSION,
            requestId: this.createRequestIdentifier (),
            sessionId: null,
        };
        const responseResult = await this.exchange ( outboundRequest, false );

        // Handle the case where the response result is successful condition is not satisfied.

        if ( !responseResult.isSuccessful )
        {
            // Handle the case where code matches the SERVER_REQUEST_TIMEOUT value.

            if ( responseResult.failure.code === "SERVER_REQUEST_TIMEOUT" )
            {
                // Return the reconcile timed out put result.

                return this.reconcileTimedOutPut ( request.canonicalDocument.text );
            }

            // Handle the case where code matches the HOSTED_MODEL_CONFLICT value.

            if ( responseResult.failure.code === "HOSTED_MODEL_CONFLICT" )
            {
                // Return the reconcile conflict result.

                return this.reconcileConflict ( responseResult.failure );
            }

            // Return the response result.

            return responseResult;
        }

        // Handle the case where operation differs from the model.put value.

        if ( responseResult.value.operation !== "model.put" )
        {
            // Return the unexpected operation failure result.

            return unexpectedOperationFailure ();
        }

        // Return the success result.

        return success (
            {
                isIdempotent:  responseResult.value.result.disposition === "unchanged",
                modelRevision: responseResult.value.result.modelRevision,
            },
        );
    }

    //----------------------------------------------------------------------------------------------
    // Method: startSession
    //
    // Description:
    //
    //   Starts the session.
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

    public async startSession (): Promise<ServerGatewayResult<HostedSessionDto>>
    {
        // Initialize the local values needed by this operation.

        const request: ServerRequestEnvelopeFor<"simulation.start"> =
        {
            conditionalModelRevision: null,
            kind:      "request",
            operation: "simulation.start",
            payload:   {},
            protocol:  SERVER_PROTOCOL_VERSION,
            requestId: this.createRequestIdentifier (),
            sessionId: null,
        };

        // Return the request session snapshot result.

        return this.requestSessionSnapshot ( request, "simulation.start" );
    }

    //----------------------------------------------------------------------------------------------
    // Method: runSession
    //
    // Description:
    //
    //   Runs the session.
    //
    // Parameters:
    //
    //   - request:
    //     The request supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    public runSession (
        request: HostedSessionEventRequest,
    ): Promise<ServerGatewayResult<HostedSessionOperationResult>>
    {
        // Initialize the local values needed by this operation.

        const outboundRequest: ServerRequestEnvelopeFor<"simulation.run"> =
        {
            conditionalModelRevision: null,
            kind:      "request",
            operation: "simulation.run",
            payload:   { events: [ ...request.eventBuffer ] },
            protocol:  SERVER_PROTOCOL_VERSION,
            requestId: this.createRequestIdentifier (),
            sessionId: request.sessionId,
        };

        // Return the request simulation operation result.

        return this.requestSimulationOperation ( outboundRequest, "simulation.run" );
    }

    //----------------------------------------------------------------------------------------------
    // Method: stepSession
    //
    // Description:
    //
    //   Advances the session.
    //
    // Parameters:
    //
    //   - request:
    //     The request supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    public stepSession (
        request: HostedSessionEventRequest,
    ): Promise<ServerGatewayResult<HostedSessionOperationResult>>
    {
        // Initialize the local values needed by this operation.

        const outboundRequest: ServerRequestEnvelopeFor<"simulation.step"> =
        {
            conditionalModelRevision: null,
            kind:      "request",
            operation: "simulation.step",
            payload:   { events: [ ...request.eventBuffer ] },
            protocol:  SERVER_PROTOCOL_VERSION,
            requestId: this.createRequestIdentifier (),
            sessionId: request.sessionId,
        };

        // Return the request simulation operation result.

        return this.requestSimulationOperation ( outboundRequest, "simulation.step" );
    }

    //----------------------------------------------------------------------------------------------
    // Method: resetSession
    //
    // Description:
    //
    //   Resets the session.
    //
    // Parameters:
    //
    //   - sessionId:
    //     The session identifier supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    public async resetSession ( sessionId: string ): Promise<ServerGatewayResult<HostedSessionDto>>
    {
        // Initialize the local values needed by this operation.

        const request: ServerRequestEnvelopeFor<"simulation.reset"> =
        {
            conditionalModelRevision: null,
            kind:      "request",
            operation: "simulation.reset",
            payload:   {},
            protocol:  SERVER_PROTOCOL_VERSION,
            requestId: this.createRequestIdentifier (),
            sessionId,
        };

        // Return the request session snapshot result.

        return this.requestSessionSnapshot ( request, "simulation.reset" );
    }

    //----------------------------------------------------------------------------------------------
    // Method: closeSession
    //
    // Description:
    //
    //   Closes the session.
    //
    // Parameters:
    //
    //   - sessionId:
    //     The session identifier supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    public async closeSession ( sessionId: string ): Promise<ServerGatewayResult<void>>
    {
        // Handle the case where the connected condition is not satisfied.

        if ( !this.connected )
        {
            // Return the disconnected failure result.

            return disconnectedFailure ();
        }

        // Initialize the local values needed by this operation.

        const request: ServerRequestEnvelopeFor<"simulation.close"> =
        {
            conditionalModelRevision: null,
            kind:      "request",
            operation: "simulation.close",
            payload:   {},
            protocol:  SERVER_PROTOCOL_VERSION,
            requestId: this.createRequestIdentifier (),
            sessionId,
        };
        const responseResult = await this.exchange ( request, false );

        // Handle the case where the response result is successful condition is not satisfied.

        if ( !responseResult.isSuccessful )
        {
            // Return the response result.

            return responseResult;
        }

        // Return the result selected by the current condition.

        return responseResult.value.operation === "simulation.close"
            ? success ( undefined )
            : unexpectedOperationFailure ();
    }

    //----------------------------------------------------------------------------------------------
    // Method: restart
    //
    // Description:
    //
    //   Restarts the requested value.
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

    public async restart (): Promise<ServerGatewayResult<ServerConnectionDescription>>
    {
        // Handle the case where server URL matches an absent value.

        if ( this.serverUrl === null )
        {
            // Return the disconnected failure result.

            return disconnectedFailure ();
        }

        const serverUrl = this.serverUrl;

        this.destroyWorker ( disconnectedFailure () );

        // Return the connect result.

        return this.connect ( serverUrl );
    }

    //----------------------------------------------------------------------------------------------
    // Method: dispose
    //
    // Description:
    //
    //   Disposes the requested value.
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

    public async dispose (): Promise<ServerGatewayResult<void>>
    {
        this.destroyWorker ( disconnectedFailure () );
        this.serverUrl = null;

        // Return the success result.

        return success ( undefined );
    }

    //----------------------------------------------------------------------------------------------
    // Method: replaceWorker
    //
    // Description:
    //
    //   Replaces the worker.
    //
    // Parameters:
    //
    //   - serverUrl:
    //     The server URL supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    private replaceWorker ( serverUrl: string ): ServerGatewayResult<void>
    {
        this.destroyWorker ( disconnectedFailure () );

        let serverWorker: BrowserServerWorkerEndpoint;

        // Run the operation that may report a recoverable failure.

        try
        {
            serverWorker = this.createWorker ();
        }
        catch ( error )
        {
            // Recover from the reported failure without hiding its outcome.

            if ( error instanceof ServerWorkerUnsupportedError )
            {
                // Return the failure result.

                return failure (
                    "SERVER_WORKER_UNSUPPORTED",
                    error.message,
                    "Use a supported browser with module Web Worker support.",
                    false,
                );
            }

            // Return the failure result.

            return failure (
                "SERVER_CONNECTION_FAILED",
                error instanceof Error ? error.message : "The built-in server worker could not be created.",
                "Check the browser's worker policy and retry the connection.",
                true,
            );
        }

        this.workerGeneration++;
        const generation = this.workerGeneration;

        serverWorker.onmessage = event => this.receiveMessage ( event, generation );
        serverWorker.onerror   = event => this.workerFailed (
            generation,
            typeof event.message === "string" && event.message.trim ().length > 0
                ? event.message
                : "The built-in server worker crashed.",
        );
        serverWorker.onmessageerror = () => this.workerFailed (
            generation,
            "The browser could not deserialize a built-in server message.",
        );

        this.connected          = false;
        this.connection         = null;
        this.lastServerSequence = 0;
        this.serverUrl          = serverUrl;
        this.serverWorker       = serverWorker;

        // Return the success result.

        return success ( undefined );
    }

    //----------------------------------------------------------------------------------------------
    // Method: destroyWorker
    //
    // Description:
    //
    //   Handles the destroy worker behavior.
    //
    // Parameters:
    //
    //   - pendingFailure:
    //     The pending failure supplied to the operation.
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

    private destroyWorker ( pendingFailure: ServerGatewayResult<ServerSuccessResponseEnvelope> ): void
    {
        this.rejectPendingRequests ( pendingFailure );

        // Handle the case where server worker differs from an absent value.

        if ( this.serverWorker !== null )
        {
            this.serverWorker.onmessage      = null;
            this.serverWorker.onerror        = null;
            this.serverWorker.onmessageerror = null;
            this.serverWorker.terminate ();
        }

        this.workerGeneration++;
        this.connected          = false;
        this.connection         = null;
        this.lastServerSequence = 0;
        this.serverWorker       = null;
    }

    //----------------------------------------------------------------------------------------------
    // Method: workerFailed
    //
    // Description:
    //
    //   Handles the worker failed behavior.
    //
    // Parameters:
    //
    //   - generation:
    //     The generation supplied to the operation.
    //
    //   - message:
    //     The message supplied to the operation.
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

    private workerFailed ( generation: number, message: string ): void
    {
        // Handle the case where generation differs from worker generation.

        if ( generation !== this.workerGeneration )
        {
            // Return control to the caller.

            return;
        }

        this.loseConnection ( failure (
            "SERVER_WORKER_FAILED",
            message,
            "Restart the built-in server and retry the operation.",
            true,
        ) );
    }

    //----------------------------------------------------------------------------------------------
    // Method: receiveMessage
    //
    // Description:
    //
    //   Handles the receive message behavior.
    //
    // Parameters:
    //
    //   - event:
    //     The event to process.
    //
    //   - generation:
    //     The generation supplied to the operation.
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

    private receiveMessage ( event: MessageEvent<unknown>, generation: number ): void
    {
        // Handle the case where generation differs from worker generation.

        if ( generation !== this.workerGeneration )
        {
            // Return control to the caller.

            return;
        }

        const decodeResult = decodeServerOutboundEnvelope ( event.data, this.lastServerSequence );

        // Handle the case where the decode result is successful condition is not satisfied.

        if ( !decodeResult.isSuccessful )
        {
            this.loseConnection ( failure (
                "SERVER_RESPONSE_INVALID",
                decodeResult.message,
                "Restart the built-in server and retry the operation.",
                true,
            ) );

            // Return control to the caller.

            return;
        }

        const message = decodeResult.message;

        // Handle the case where all required conditions are satisfied.

        if ( this.lastServerSequence > 0 && message.serverSequence !== this.lastServerSequence + 1 )
        {
            this.loseConnection ( failure (
                "SERVER_RESPONSE_INVALID",
                `The server message sequence skipped from ${this.lastServerSequence} to ${message.serverSequence}.`,
                "Restart the built-in server to restore a complete event stream.",
                true,
            ) );

            // Return control to the caller.

            return;
        }

        this.lastServerSequence = message.serverSequence;

        // Handle the case where message kind matches the event value.

        if ( message.kind === "event" )
        {
            this.onServerEvent?.( message );

            // Return control to the caller.

            return;
        }

        const pendingRequest = this.pendingRequests.get ( message.requestId );

        // Handle the case where pending request matches undefined.

        if ( pendingRequest === undefined )
        {
            // Return control to the caller.

            return;
        }

        clearTimeout ( pendingRequest.timeout );
        this.pendingRequests.delete ( message.requestId );

        // Handle the case where message kind matches the error value.

        if ( message.kind === "error" )
        {
            // Handle the case where all required conditions are satisfied.

            if ( message.operation !== null && message.operation !== pendingRequest.operation )
            {
                pendingRequest.resolve ( unexpectedOperationFailure () );

                // Return control to the caller.

                return;
            }

            pendingRequest.resolve ( mapProtocolError ( message.error ) );

            // Return control to the caller.

            return;
        }

        pendingRequest.resolve ( message.operation === pendingRequest.operation
            ? success ( message )
            : unexpectedOperationFailure () );
    }

    //----------------------------------------------------------------------------------------------
    // Method: loseConnection
    //
    // Description:
    //
    //   Handles the lose connection behavior.
    //
    // Parameters:
    //
    //   - connectionFailure:
    //     The connection failure supplied to the operation.
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

    private loseConnection ( connectionFailure: ServerGatewayResult<ServerSuccessResponseEnvelope> ): void
    {
        this.destroyWorker ( connectionFailure );

        // Handle the case where the connection failure is successful condition is not satisfied.

        if ( !connectionFailure.isSuccessful )
        {
            this.onConnectionLost?.( connectionFailure.failure );
        }
    }

    //----------------------------------------------------------------------------------------------
    // Method: exchange
    //
    // Description:
    //
    //   Derives the exchange.
    //
    // Parameters:
    //
    //   - request:
    //     The request supplied to the operation.
    //
    //   - requireConnection:
    //     The require connection supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    private exchange (
        request: ServerRequestEnvelope,
        requireConnection: boolean,
    ): Promise<ServerGatewayResult<ServerSuccessResponseEnvelope>>
    {
        // Handle the case where all required conditions are satisfied.

        if ( requireConnection && !this.connected )
        {
            // Return the resolve result.

            return Promise.resolve ( disconnectedFailure () );
        }

        // Handle the case where server worker matches an absent value.

        if ( this.serverWorker === null )
        {
            // Return the resolve result.

            return Promise.resolve ( disconnectedFailure () );
        }

        // Return the computed result.

        return new Promise ( resolve =>
        {
            // Initialize the local values needed by this operation.

            const timeout = setTimeout ( () =>
            {
                this.pendingRequests.delete ( request.requestId );
                resolve ( failure (
                    "SERVER_REQUEST_TIMEOUT",
                    `The '${request.operation}' server request timed out.`,
                    "Test the server connection and retry only after reconciling its current state.",
                    true,
                ) );
            }, this.requestTimeoutMilliseconds );

            this.pendingRequests.set (
                request.requestId,
                { operation: request.operation, resolve, timeout },
            );

            // Run the operation that may report a recoverable failure.

            try
            {
                this.serverWorker?.postMessage ( request );
            }
            catch ( error )
            {
                // Recover from the reported failure without hiding its outcome.

                clearTimeout ( timeout );
                this.pendingRequests.delete ( request.requestId );
                resolve ( failure (
                    "SERVER_CONNECTION_FAILED",
                    error instanceof Error ? error.message : "The server request could not be posted.",
                    "Reconnect to the server and retry the operation.",
                    true,
                ) );
            }
        } );
    }

    //----------------------------------------------------------------------------------------------
    // Method: exchangeIdempotent
    //
    // Description:
    //
    //   Derives the exchange idempotent.
    //
    // Parameters:
    //
    //   - createRequest:
    //     The create request supplied to the operation.
    //
    //   - requireConnection:
    //     The require connection supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    private async exchangeIdempotent (
        createRequest: () => ServerRequestEnvelope,
        requireConnection = true,
    ): Promise<ServerGatewayResult<ServerSuccessResponseEnvelope>>
    {
        // Initialize the local values needed by this operation.

        const firstResult = await this.exchange ( createRequest (), requireConnection );

        // Return the result selected by the current condition.

        return !firstResult.isSuccessful && firstResult.failure.code === "SERVER_REQUEST_TIMEOUT"
            ? this.exchange ( createRequest (), requireConnection )
            : firstResult;
    }

    //----------------------------------------------------------------------------------------------
    // Method: requestHello
    //
    // Description:
    //
    //   Requests the hello.
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

    private async requestHello ()
    {
        // Initialize the local values needed by this operation.

        const responseResult = await this.exchangeIdempotent ( () =>
        {
            // Initialize the local values needed by this operation.

            const request: ServerRequestEnvelopeFor<"server.hello"> =
            {
                conditionalModelRevision: null,
                kind:      "request",
                operation: "server.hello",
                payload:   {},
                protocol:  SERVER_PROTOCOL_VERSION,
                requestId: this.createRequestIdentifier (),
                sessionId: null,
            };

            // Return the request.

            return request;
        }, false );

        // Handle the case where the response result is successful condition is not satisfied.

        if ( !responseResult.isSuccessful )
        {
            // Return the response result.

            return responseResult;
        }

        // Return the result selected by the current condition.

        return responseResult.value.operation === "server.hello"
            ? success ( responseResult.value.result )
            : unexpectedOperationFailure ();
    }

    //----------------------------------------------------------------------------------------------
    // Method: requestHealthLive
    //
    // Description:
    //
    //   Requests the health live.
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

    private async requestHealthLive ()
    {
        // Initialize the local values needed by this operation.

        const responseResult = await this.exchangeIdempotent ( () =>
        {
            // Initialize the local values needed by this operation.

            const request: ServerRequestEnvelopeFor<"health.live"> =
            {
                conditionalModelRevision: null,
                kind:      "request",
                operation: "health.live",
                payload:   {},
                protocol:  SERVER_PROTOCOL_VERSION,
                requestId: this.createRequestIdentifier (),
                sessionId: null,
            };

            // Return the request.

            return request;
        } );

        // Handle the case where the response result is successful condition is not satisfied.

        if ( !responseResult.isSuccessful )
        {
            // Return the response result.

            return responseResult;
        }

        // Return the result selected by the current condition.

        return responseResult.value.operation === "health.live"
            ? success ( responseResult.value.result )
            : unexpectedOperationFailure ();
    }

    //----------------------------------------------------------------------------------------------
    // Method: requestHealthReady
    //
    // Description:
    //
    //   Requests the health ready.
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

    private async requestHealthReady ()
    {
        // Initialize the local values needed by this operation.

        const responseResult = await this.exchangeIdempotent ( () =>
        {
            // Initialize the local values needed by this operation.

            const request: ServerRequestEnvelopeFor<"health.ready"> =
            {
                conditionalModelRevision: null,
                kind:      "request",
                operation: "health.ready",
                payload:   {},
                protocol:  SERVER_PROTOCOL_VERSION,
                requestId: this.createRequestIdentifier (),
                sessionId: null,
            };

            // Return the request.

            return request;
        } );

        // Handle the case where the response result is successful condition is not satisfied.

        if ( !responseResult.isSuccessful )
        {
            // Return the response result.

            return responseResult;
        }

        // Return the result selected by the current condition.

        return responseResult.value.operation === "health.ready"
            ? success ( responseResult.value.result )
            : unexpectedOperationFailure ();
    }

    //----------------------------------------------------------------------------------------------
    // Method: requestSessionSnapshot
    //
    // Description:
    //
    //   Requests the session snapshot.
    //
    // Parameters:
    //
    //   - request:
    //     The request supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    private async requestSessionSnapshot (
        request: ServerRequestEnvelopeFor<"simulation.reset"> | ServerRequestEnvelopeFor<"simulation.start">,
        operation: "simulation.reset" | "simulation.start",
    ): Promise<ServerGatewayResult<HostedSessionDto>>
    {
        // Handle the case where the connected condition is not satisfied.

        if ( !this.connected )
        {
            // Return the disconnected failure result.

            return disconnectedFailure ();
        }

        const responseResult = await this.exchange ( request, true );

        // Handle the case where the response result is successful condition is not satisfied.

        if ( !responseResult.isSuccessful )
        {
            // Return the response result.

            return responseResult;
        }

        // Handle the case where at least one branch condition is satisfied.

        if ( responseResult.value.operation !== operation || (
            responseResult.value.operation !== "simulation.reset" &&
            responseResult.value.operation !== "simulation.start"
        ) )
        {
            // Return the unexpected operation failure result.

            return unexpectedOperationFailure ();
        }

        // Return the success result.

        return success ( copySession ( responseResult.value.result ) );
    }

    //----------------------------------------------------------------------------------------------
    // Method: requestSimulationOperation
    //
    // Description:
    //
    //   Requests the simulation operation.
    //
    // Parameters:
    //
    //   - request:
    //     The request supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    private async requestSimulationOperation (
        request: ServerRequestEnvelopeFor<"simulation.run"> | ServerRequestEnvelopeFor<"simulation.step">,
        operation: "simulation.run" | "simulation.step",
    ): Promise<ServerGatewayResult<HostedSessionOperationResult>>
    {
        // Handle the case where the connected condition is not satisfied.

        if ( !this.connected )
        {
            // Return the disconnected failure result.

            return disconnectedFailure ();
        }

        const responseResult = await this.exchange ( request, true );

        // Handle the case where the response result is successful condition is not satisfied.

        if ( !responseResult.isSuccessful )
        {
            // Return the response result.

            return responseResult;
        }

        // Handle the case where at least one branch condition is satisfied.

        if ( responseResult.value.operation !== operation || (
            responseResult.value.operation !== "simulation.run" &&
            responseResult.value.operation !== "simulation.step"
        ) )
        {
            // Return the unexpected operation failure result.

            return unexpectedOperationFailure ();
        }

        // Return the success result.

        return success ( copySimulationOperation ( responseResult.value.result ) );
    }

    //----------------------------------------------------------------------------------------------
    // Method: reconcileTimedOutPut
    //
    // Description:
    //
    //   Derives the reconcile timed out put.
    //
    // Parameters:
    //
    //   - submittedCanonicalDocument:
    //     The submitted canonical document supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    private async reconcileTimedOutPut (
        submittedCanonicalDocument: string,
    ): Promise<ServerGatewayResult<HostedDocumentPutResult>>
    {
        // Initialize the local values needed by this operation.

        const hostedDocumentResult = await this.getHostedDocument ();

        // Handle the case where all required conditions are satisfied.

        if ( hostedDocumentResult.isSuccessful &&
            hostedDocumentResult.value.canonicalDocument.text === submittedCanonicalDocument )
        {
            // Return the success result.

            return success (
                {
                    isIdempotent:  false,
                    modelRevision: hostedDocumentResult.value.modelRevision,
                },
            );
        }

        // Return the failure result.

        return failure (
            "SERVER_REQUEST_TIMEOUT",
            "The model replacement timed out and its outcome could not be confirmed.",
            "Pull the hosted document and review it before deciding whether to retry Push.",
            true,
            hostedDocumentResult.isSuccessful ? hostedDocumentResult.value.modelRevision : undefined,
        );
    }

    //----------------------------------------------------------------------------------------------
    // Method: reconcileConflict
    //
    // Description:
    //
    //   Derives the reconcile conflict.
    //
    // Parameters:
    //
    //   - conflict:
    //     The conflict supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    private async reconcileConflict (
        conflict: ServerGatewayFailure,
    ): Promise<ServerGatewayResult<HostedDocumentPutResult>>
    {
        // Initialize the local values needed by this operation.

        const hostedDocumentResult = await this.getHostedDocument ();

        // Return the assembled result.

        return {
            isSuccessful: false,
            failure:
            {
                ...conflict,
                ...( hostedDocumentResult.isSuccessful
                    ? { currentModelRevision: hostedDocumentResult.value.modelRevision }
                    : {} ),
            },
        };
    }

    //----------------------------------------------------------------------------------------------
    // Method: rejectPendingRequests
    //
    // Description:
    //
    //   Handles the reject pending requests behavior.
    //
    // Parameters:
    //
    //   - pendingFailure:
    //     The pending failure supplied to the operation.
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

    private rejectPendingRequests ( pendingFailure: ServerGatewayResult<ServerSuccessResponseEnvelope> ): void
    {
        this.pendingRequests.forEach ( pendingRequest =>
        {
            clearTimeout ( pendingRequest.timeout );
            pendingRequest.resolve ( pendingFailure );
        } );
        this.pendingRequests.clear ();
    }
}
