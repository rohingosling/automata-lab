// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Server Worker Engine
// Version: 1.0.0
// Date:    2026-08-14
// Author:  Rohin Gosling
//
// Description:
//
//   Serializes decoded requests, coordinates hosted state and sessions, and emits correlated
//   responses and events.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type
{
    ClockPort,
    ContentHashPort,
    DocumentCodecPort,
    UuidPort,
} from "../../application/ports/contracts.js";
import type { DomainDiagnostic } from "../../domain/model/diagnostics.js";
import { SerializedServerExecutor } from "./coordination.js";
import
{
    createServerErrorResponseEnvelope,
    createServerEventEnvelope,
    createServerSuccessResponseEnvelope,
    decodeServerRequestEnvelope,
    MAXIMUM_SERVER_DIAGNOSTIC_COUNT,
    MAXIMUM_SERVER_DIAGNOSTIC_TEXT_LENGTH,
    MAXIMUM_SERVER_PAYLOAD_BYTE_COUNT,
    SERVER_PROTOCOL_LIMITS,
    SERVER_PROTOCOL_OPERATIONS,
    SERVER_PROTOCOL_VERSION,
} from "./protocol.js";
import type
{
    ServerErrorCode,
    ServerErrorResponseEnvelope,
    ServerEventEnvelopeFor,
    ServerEventName,
    ServerEventPayloadByEvent,
    ServerModelPutResult,
    ServerOperation,
    ServerOutboundEnvelope,
    ServerProtocolDiagnostic,
    ServerProtocolError,
    ServerRequestDecodeResult,
    ServerRequestEnvelope,
    ServerRequestEnvelopeFor,
    ServerResultByOperation,
    ServerSuccessResponseEnvelopeFor,
} from "./protocol.js";
import { RecentRequestIdentifierRepository } from "./repositories.js";
import { ServerState } from "./server-state.js";
import type
{
    ServerHostedReplacement,
    ServerSessionOperation,
    ServerStateFailure,
    ServerStateResult,
} from "./server-state.js";

//--------------------------------------------------------------------------------------------------
// Interface: ServerEngineDependencies
//
// Description:
//
//   Defines the structure of server engine dependencies.
//
//--------------------------------------------------------------------------------------------------

export interface ServerEngineDependencies
{
    readonly bundledDocumentText: string;
    readonly clock:               ClockPort;
    readonly contentHasher:       ContentHashPort;
    readonly documentCodec:       DocumentCodecPort;
    readonly uuid:                UuidPort;
}

//--------------------------------------------------------------------------------------------------
// Function: boundText
//
// Description:
//
//   Constrains the text to its permitted range.
//
// Parameters:
//
//   - text:
//     The text supplied to the operation.
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

function boundText ( text: string ): string
{
    // Return the result selected by the current condition.

    return text.length <= MAXIMUM_SERVER_DIAGNOSTIC_TEXT_LENGTH
        ? text
        : `${text.slice ( 0, MAXIMUM_SERVER_DIAGNOSTIC_TEXT_LENGTH - 1 )}…`;
}

//--------------------------------------------------------------------------------------------------
// Function: projectDomainDiagnostics
//
// Description:
//
//   Projects the domain diagnostics.
//
// Parameters:
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

function projectDomainDiagnostics ( diagnostics: readonly DomainDiagnostic[] ): readonly ServerProtocolDiagnostic[]
{
    // Return the mapped collection.

    return diagnostics.slice ( 0, MAXIMUM_SERVER_DIAGNOSTIC_COUNT ).map ( diagnostic => ( {
        code:        boundText ( diagnostic.code ),
        severity:    diagnostic.severity,
        source:      boundText ( diagnostic.source ),
        message:     boundText ( diagnostic.message ),
        remediation: boundText ( diagnostic.remediation ),
        path:        diagnostic.path === undefined ? null : boundText ( diagnostic.path ),
        context:     diagnostic.context === undefined ? null : boundText ( diagnostic.context ),
    } ) );
}

//--------------------------------------------------------------------------------------------------
// Function: boundProtocolDiagnostics
//
// Description:
//
//   Constrains the protocol diagnostics to its permitted range.
//
// Parameters:
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

function boundProtocolDiagnostics (
    diagnostics: readonly ServerProtocolDiagnostic[],
): readonly ServerProtocolDiagnostic[]
{
    // Return the mapped collection.

    return diagnostics.slice ( 0, MAXIMUM_SERVER_DIAGNOSTIC_COUNT ).map ( diagnostic => ( {
        code:        boundText ( diagnostic.code ),
        severity:    diagnostic.severity,
        source:      boundText ( diagnostic.source ),
        message:     boundText ( diagnostic.message ),
        remediation: boundText ( diagnostic.remediation ),
        path:        diagnostic.path === null ? null : boundText ( diagnostic.path ),
        context:     diagnostic.context === null ? null : boundText ( diagnostic.context ),
    } ) );
}

//--------------------------------------------------------------------------------------------------
// Function: createDiagnostic
//
// Description:
//
//   Creates diagnostic.
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

function createDiagnostic (
    code: string,
    message: string,
    remediation: string,
): ServerProtocolDiagnostic
{
    // Return the assembled result.

    return {
        code,
        severity: "error",
        source: "server",
        message,
        remediation,
        path:    null,
        context: null,
    };
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

function jsonByteCount ( value: unknown ): number
{
    // Run the operation that may report a recoverable failure.

    try
    {
        // Return the computed result.

        return new TextEncoder ().encode ( JSON.stringify ( value ) ).byteLength;
    }
    catch
    {
        // Recover from the reported failure without hiding its outcome.

        return Number.POSITIVE_INFINITY;
    }
}

//--------------------------------------------------------------------------------------------------
// Function: retainNewest
//
// Description:
//
//   Derives the retain newest.
//
// Parameters:
//
//   - values:
//     The values supplied to the operation.
//
//   - maximumEntryCount:
//     The maximum entry count supplied to the operation.
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

function retainNewest<Value> ( values: readonly Value[], maximumEntryCount: number ): readonly Value[]
{
    // Return the result selected by the current condition.

    return values.length <= maximumEntryCount
        ? [ ...values ]
        : values.slice ( values.length - maximumEntryCount );
}

//--------------------------------------------------------------------------------------------------
// Function: projectBoundedSessionOperation
//
// Description:
//
//   Projects the bounded session operation.
//
// Parameters:
//
//   - operation:
//     The operation supplied to the operation.
//
//   - maximumEntryCount:
//     The maximum entry count supplied to the operation.
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

function projectBoundedSessionOperation (
    operation: ServerSessionOperation,
    maximumEntryCount: number,
): ServerSessionOperation
{
    // Initialize the local values needed by this operation.

    const transitionTrace        = retainNewest ( operation.session.transitionTrace, maximumEntryCount );
    const actionTrace            = retainNewest ( operation.session.actionTrace, maximumEntryCount );
    const emittedActions         = retainNewest ( operation.emittedActions, maximumEntryCount );
    const warnings               = retainNewest ( operation.warnings, maximumEntryCount );
    const projectionWasTruncated = transitionTrace.length < operation.session.transitionTrace.length ||
        actionTrace.length < operation.session.actionTrace.length ||
        emittedActions.length < operation.emittedActions.length || warnings.length < operation.warnings.length;

    // Return the assembled result.

    return {
        consumedEventCount: operation.consumedEventCount,
        emittedActions,
        session:
        {
            ...operation.session,
            actionTrace,
            traceTruncated: operation.session.traceTruncated || projectionWasTruncated,
            transitionTrace,
        },
        warnings,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: boundSessionOperationResult
//
// Description:
//
//   Constrains the session operation result to its permitted range.
//
// Parameters:
//
//   - result:
//     The result supplied to the operation.
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

function boundSessionOperationResult (
    result: ServerStateResult<ServerSessionOperation>,
): ServerStateResult<ServerSessionOperation>
{
    // Handle the case where the result is successful condition is not satisfied.

    if ( !result.isSuccessful )
    {
        // Return the result.

        return result;
    }

    // Initialize the local values needed by this operation.

    const operation         = result.value;
    const maximumEntryCount = Math.max (
        operation.session.transitionTrace.length,
        operation.session.actionTrace.length,
        operation.emittedActions.length,
        operation.warnings.length,
    );
    const completeProjection = projectBoundedSessionOperation ( operation, maximumEntryCount );

    // Handle the case where JSON byte count result does not exceed maximum server payload byte
    // count.

    if ( jsonByteCount ( completeProjection ) <= MAXIMUM_SERVER_PAYLOAD_BYTE_COUNT )
    {
        // Return the assembled result.

        return { isSuccessful: true, value: completeProjection };
    }

    // Initialize the local values needed by this operation.

    let minimumEntryCount          = 0;
    let maximumCandidateEntryCount = maximumEntryCount - 1;
    let boundedProjection          = projectBoundedSessionOperation ( operation, 0 );

    // Continue the operation while its terminating condition has not been reached.

    while ( minimumEntryCount <= maximumCandidateEntryCount )
    {
        // Initialize the local values needed by this operation.

        const candidateEntryCount = Math.floor ( ( minimumEntryCount + maximumCandidateEntryCount ) / 2 );
        const candidateProjection = projectBoundedSessionOperation ( operation, candidateEntryCount );

        // Handle the case where JSON byte count result does not exceed maximum server payload byte
        // count.

        if ( jsonByteCount ( candidateProjection ) <= MAXIMUM_SERVER_PAYLOAD_BYTE_COUNT )
        {
            boundedProjection = candidateProjection;
            minimumEntryCount = candidateEntryCount + 1;
        }
        else
        {
            // Handle the remaining case after the preceding condition is false.

            maximumCandidateEntryCount = candidateEntryCount - 1;
        }
    }

    // Return the assembled result.

    return { isSuccessful: true, value: boundedProjection };
}

//--------------------------------------------------------------------------------------------------
// Class: ServerEngine
//
// Description:
//
//   Implements the server engine behavior.
//
//--------------------------------------------------------------------------------------------------

export class ServerEngine
{
    private readonly executor         = new SerializedServerExecutor ();
    private readonly instanceId:      string;
    private readonly recentRequestIds = new RecentRequestIdentifierRepository ();
    private readonly serverState:     ServerState;
    private readonly startupPromise:  Promise<readonly ServerOutboundEnvelope[]>;
    private serverSequence = 0;

    //----------------------------------------------------------------------------------------------
    // Constructor: ServerEngine
    //
    // Description:
    //
    //   Initializes a ServerEngine instance.
    //
    // Parameters:
    //
    //   - dependencies:
    //     The services required by the operation.
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

    public constructor ( private readonly dependencies: ServerEngineDependencies )
    {
        this.instanceId     = dependencies.uuid.create ();
        this.serverState    = new ServerState ( dependencies );
        this.startupPromise = this.executor.execute ( () => this.initialize () );
    }

    //----------------------------------------------------------------------------------------------
    // Method: start
    //
    // Description:
    //
    //   Starts the requested value.
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

    public async start (): Promise<readonly ServerOutboundEnvelope[]>
    {
        // Return the assembled result collection.

        return [ ...await this.startupPromise ];
    }

    //----------------------------------------------------------------------------------------------
    // Method: handle
    //
    // Description:
    //
    //   Derives the handle.
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
    //----------------------------------------------------------------------------------------------

    public handle ( value: unknown ): Promise<readonly ServerOutboundEnvelope[]>
    {
        // Return the execute result.

        return this.executor.execute ( () => this.process ( value ) );
    }

    //----------------------------------------------------------------------------------------------
    // Method: initialize
    //
    // Description:
    //
    //   Derives the initialize.
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

    private async initialize (): Promise<readonly ServerOutboundEnvelope[]>
    {
        // Initialize the local values needed by this operation.

        const starting = this.createEvent (
            "server.lifecycle",
            {
                phase:         "starting",
                instanceId:    this.instanceId,
                modelRevision: null,
                message:       "The built-in Server Worker is starting.",
            },
        );
        const readiness = await this.serverState.initialize ( this.dependencies.bundledDocumentText );
        const lifecycle = this.createEvent (
            "server.lifecycle",
            {
                phase:         readiness.ready ? "ready" : "failed",
                instanceId:    this.instanceId,
                modelRevision: readiness.modelRevision,
                message: readiness.ready
                    ? "The built-in Server Worker is ready."
                    : "The built-in Server Worker is live but its bundled model could not be hosted.",
            },
        );

        // Handle the case where readiness ready is enabled.

        if ( readiness.ready )
        {
            // Return the assembled result collection.

            return [ starting, lifecycle ];
        }

        // Return the assembled result collection.

        return [
            starting,
            lifecycle,
            this.createEvent (
                "server.diagnostic",
                {
                    diagnostic: createDiagnostic (
                        "SERVER_STARTUP_FAILED",
                        "Bundled-model validation or compilation failed; model content was redacted.",
                        "Restart the built-in server after correcting the bundled model.",
                    ),
                },
            ),
        ];
    }

    //----------------------------------------------------------------------------------------------
    // Method: process
    //
    // Description:
    //
    //   Derives the process.
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
    //----------------------------------------------------------------------------------------------

    private async process ( value: unknown ): Promise<readonly ServerOutboundEnvelope[]>
    {
        // Initialize the local values needed by this operation.

        let decodeResult: ServerRequestDecodeResult;

        // Run the operation that may report a recoverable failure.

        try
        {
            decodeResult = decodeServerRequestEnvelope ( value );
        }
        catch
        {
            // Recover from the reported failure without hiding its outcome.

            return [ this.createUncorrelatedDiagnosticEvent () ];
        }

        // Initialize the local values needed by this operation.

        const requestId = decodeResult.isSuccessful ? decodeResult.request.requestId : decodeResult.requestId;
        const operation = decodeResult.isSuccessful ? decodeResult.request.operation : decodeResult.operation;

        // Handle the case where all required conditions are satisfied.

        if ( requestId !== null && !this.recentRequestIds.remember ( requestId ) )
        {
            // Return the assembled result collection.

            return [
                this.createError (
                    requestId,
                    operation,
                    {
                        code:        "DUPLICATE_REQUEST_ID",
                        message:     "The request identifier was already processed recently.",
                        diagnostics: [],
                    },
                ),
            ];
        }

        // Handle the case where the decode result is successful condition is not satisfied.

        if ( !decodeResult.isSuccessful )
        {
            // Handle the case where the decode result is correlated condition is not satisfied.

            if ( !decodeResult.isCorrelated )
            {
                // Return the assembled result collection.

                return [ this.createUncorrelatedDiagnosticEvent () ];
            }

            // Return the assembled result collection.

            return [
                this.createError (
                    decodeResult.requestId,
                    decodeResult.operation,
                    {
                        ...decodeResult.error,
                        message:     boundText ( decodeResult.error.message ),
                        diagnostics: boundProtocolDiagnostics ( decodeResult.error.diagnostics ),
                    },
                ),
            ];
        }

        // Run the operation that may report a recoverable failure.

        try
        {
            // Return the result of the completed asynchronous operation.

            return await this.dispatch ( decodeResult.request );
        }
        catch
        {
            // Recover from the reported failure without hiding its outcome.

            return [
                this.createError (
                    decodeResult.request.requestId,
                    decodeResult.request.operation,
                    {
                        code:        "INTERNAL_ERROR",
                        message:     "The Server Worker could not complete the request.",
                        diagnostics: [],
                    },
                ),
            ];
        }
    }

    //----------------------------------------------------------------------------------------------
    // Method: dispatch
    //
    // Description:
    //
    //   Derives the dispatch.
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

    private async dispatch ( request: ServerRequestEnvelope ): Promise<readonly ServerOutboundEnvelope[]>
    {
        // Dispatch according to the request operation value.

        switch ( request.operation )
        {
            // Handle the "server.hello" case.

            case "server.hello":
            {
                // Initialize the local values needed by this operation.

                const readiness = this.serverState.readiness ();

                // Return the assembled result collection.

                return [
                    this.createSuccess (
                        request,
                        {
                            protocol:      SERVER_PROTOCOL_VERSION,
                            instanceId:    this.instanceId,
                            ready:         readiness.ready,
                            modelRevision: readiness.modelRevision,
                            capabilities:  [ ...SERVER_PROTOCOL_OPERATIONS ],
                            limits:        { ...SERVER_PROTOCOL_LIMITS },
                        },
                    ),
                ];
            }

            // Handle the "health.live" case.

            case "health.live":

                // Return the assembled result collection.

                return [ this.createSuccess ( request, { live: true, instanceId: this.instanceId } ) ];

            // Handle the "health.ready" case.

            case "health.ready":
            {
                // Initialize the local values needed by this operation.

                const readiness = this.serverState.readiness ();

                // Return the assembled result collection.

                return [
                    this.createSuccess (
                        request,
                        {
                            ready:         readiness.ready,
                            modelRevision: readiness.modelRevision,
                            diagnostics:   projectDomainDiagnostics ( readiness.diagnostics ),
                        },
                    ),
                ];
            }

            // Handle the "model.get" case.

            case "model.get":

                // Return the from state result result.

                return this.fromStateResult ( request, this.serverState.getHostedDocument () );

            // Handle the "model.put" case.

            case "model.put":

                // Return the replace hosted document result.

                return this.replaceHostedDocument ( request );

            // Handle the "simulation.start" case.

            case "simulation.start":

                // Return the from state result result.

                return this.fromStateResult ( request, this.serverState.startSession () );

            // Handle the "simulation.run" case.

            case "simulation.run":

                // Return the from state result result.

                return this.fromStateResult (
                    request,
                    boundSessionOperationResult (
                        this.serverState.runSession ( request.sessionId, request.payload.events ),
                    ),
                );

            // Handle the "simulation.step" case.

            case "simulation.step":

                // Return the from state result result.

                return this.fromStateResult (
                    request,
                    boundSessionOperationResult (
                        this.serverState.stepSession ( request.sessionId, request.payload.events ),
                    ),
                );

            // Handle the "simulation.reset" case.

            case "simulation.reset":

                // Return the from state result result.

                return this.fromStateResult ( request, this.serverState.resetSession ( request.sessionId ) );

            // Handle the "simulation.close" case.

            case "simulation.close":

                // Return the from state result result.

                return this.fromStateResult ( request, this.serverState.closeSession ( request.sessionId ) );
        }
    }

    //----------------------------------------------------------------------------------------------
    // Method: replaceHostedDocument
    //
    // Description:
    //
    //   Replaces the hosted document.
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

    private async replaceHostedDocument (
        request: ServerRequestEnvelopeFor<"model.put">,
    ): Promise<readonly ServerOutboundEnvelope[]>
    {
        // Initialize the local values needed by this operation.

        const result = await this.serverState.replaceHostedDocument (
            request.payload.canonicalDocument,
            request.conditionalModelRevision,
        );

        // Handle the case where the result is successful condition is not satisfied.

        if ( !result.isSuccessful )
        {
            // Return the assembled result collection.

            return [ this.createStateError ( request.requestId, request.operation, result.failure ) ];
        }

        const responseResult: ServerModelPutResult =
        {
            modelRevision: result.value.modelRevision,
            disposition:   result.value.disposition,
        };

        // Return the assembled result collection.

        return [
            this.createSuccess ( request, responseResult ),
            this.createModelChangedEvent ( result.value ),
        ];
    }

    //----------------------------------------------------------------------------------------------
    // Method: fromStateResult
    //
    // Description:
    //
    //   Derives the from state result.
    //
    // Parameters:
    //
    //   - request:
    //     The request supplied to the operation.
    //
    //   - result:
    //     The result supplied to the operation.
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

    private fromStateResult<Operation extends ServerOperation> (
        request: ServerRequestEnvelopeFor<Operation>,
        result: ServerStateResult<ServerResultByOperation [ Operation ]>,
    ): readonly ( ServerErrorResponseEnvelope | ServerSuccessResponseEnvelopeFor<Operation> )[]
    {
        // Return the result selected by the current condition.

        return result.isSuccessful
            ? [ this.createSuccess ( request, result.value ) ]
            : [ this.createStateError ( request.requestId, request.operation, result.failure ) ];
    }

    //----------------------------------------------------------------------------------------------
    // Method: createModelChangedEvent
    //
    // Description:
    //
    //   Creates model changed event.
    //
    // Parameters:
    //
    //   - replacement:
    //     The replacement supplied to the operation.
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

    private createModelChangedEvent ( replacement: ServerHostedReplacement ): ServerOutboundEnvelope
    {
        // Return the create event result.

        return this.createEvent (
            "model.changed",
            {
                previousModelRevision: replacement.previousModelRevision,
                modelRevision:         replacement.modelRevision,
                disposition:          replacement.disposition,
            },
        );
    }

    //----------------------------------------------------------------------------------------------
    // Method: createStateError
    //
    // Description:
    //
    //   Creates state error.
    //
    // Parameters:
    //
    //   - requestId:
    //     The request identifier supplied to the operation.
    //
    //   - operation:
    //     The operation supplied to the operation.
    //
    //   - failure:
    //     The failure supplied to the operation.
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

    private createStateError (
        requestId: string,
        operation: ServerOperation,
        failure: ServerStateFailure,
    ): ServerErrorResponseEnvelope
    {
        // Return the create error result.

        return this.createError (
            requestId,
            operation,
            {
                code:        failure.code satisfies ServerErrorCode,
                message:     boundText ( failure.message ),
                diagnostics: projectDomainDiagnostics ( failure.diagnostics ),
            },
        );
    }

    //----------------------------------------------------------------------------------------------
    // Method: createSuccess
    //
    // Description:
    //
    //   Creates success.
    //
    // Parameters:
    //
    //   - request:
    //     The request supplied to the operation.
    //
    //   - result:
    //     The result supplied to the operation.
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

    private createSuccess<Operation extends ServerOperation> (
        request: ServerRequestEnvelopeFor<Operation>,
        result: ServerResultByOperation [ Operation ],
    ): ServerSuccessResponseEnvelopeFor<Operation>
    {
        // Initialize the local values needed by this operation.

        const metadata = this.nextMetadata ();

        // Return the create server success response envelope result.

        return createServerSuccessResponseEnvelope (
            {
                requestId: request.requestId,
                operation: request.operation,
                serverSequence: metadata.serverSequence,
                timestampUtc: metadata.timestampUtc,
                result,
            },
        );
    }

    //----------------------------------------------------------------------------------------------
    // Method: createError
    //
    // Description:
    //
    //   Creates error.
    //
    // Parameters:
    //
    //   - requestId:
    //     The request identifier supplied to the operation.
    //
    //   - operation:
    //     The operation supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    private createError (
        requestId: string,
        operation: ServerOperation | null,
        error: ServerProtocolError,
    ): ServerErrorResponseEnvelope
    {
        // Initialize the local values needed by this operation.

        const metadata = this.nextMetadata ();

        // Return the create server error response envelope result.

        return createServerErrorResponseEnvelope (
            {
                requestId,
                operation,
                serverSequence: metadata.serverSequence,
                timestampUtc: metadata.timestampUtc,
                error,
            },
        );
    }

    //----------------------------------------------------------------------------------------------
    // Method: createEvent
    //
    // Description:
    //
    //   Creates event.
    //
    // Parameters:
    //
    //   - event:
    //     The event to process.
    //
    //   - payload:
    //     The payload supplied to the operation.
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

    private createEvent<EventName extends ServerEventName> (
        event: EventName,
        payload: ServerEventPayloadByEvent [ EventName ],
    ): ServerEventEnvelopeFor<EventName>
    {
        // Initialize the local values needed by this operation.

        const metadata = this.nextMetadata ();

        // Return the create server event envelope result.

        return createServerEventEnvelope (
            {
                event,
                serverSequence: metadata.serverSequence,
                timestampUtc: metadata.timestampUtc,
                payload,
            },
        );
    }

    //----------------------------------------------------------------------------------------------
    // Method: createUncorrelatedDiagnosticEvent
    //
    // Description:
    //
    //   Creates uncorrelated diagnostic event.
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

    private createUncorrelatedDiagnosticEvent (): ServerOutboundEnvelope
    {
        // Return the create event result.

        return this.createEvent (
            "server.diagnostic",
            {
                diagnostic: createDiagnostic (
                    "SERVER_REQUEST_DROPPED",
                    "An uncorrelatable invalid message was dropped; its content was redacted.",
                    "Retry with a valid protocol envelope and request identifier.",
                ),
            },
        );
    }

    //----------------------------------------------------------------------------------------------
    // Method: nextMetadata
    //
    // Description:
    //
    //   Advances the metadata.
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

    private nextMetadata (): { readonly serverSequence: number; readonly timestampUtc: string }
    {
        this.serverSequence++;

        // Return the assembled result.

        return {
            serverSequence: this.serverSequence,
            timestampUtc:   this.dependencies.clock.nowUtc (),
        };
    }
}
