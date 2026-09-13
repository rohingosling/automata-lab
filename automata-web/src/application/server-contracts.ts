// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Server Application Contracts
// Version: 1.0.0
// Date:    2026-08-14
// Author:  Rohin Gosling
//
// Description:
//
//   Defines the transport-neutral gateway and immutable hosted-model and session exchange values
//   used by the client.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { CanonicalSerializedDocument } from "../domain/model/contracts.js";
import type
{
    RuntimeActionTraceEntry,
    RuntimeTransitionTraceEntry,
    RuntimeWarning,
} from "../domain/runtime/contracts.js";

//--------------------------------------------------------------------------------------------------
// Type: ServerGatewayFailureCode
//
// Description:
//
//   Defines the supported server gateway failure code alternatives.
//
//--------------------------------------------------------------------------------------------------

export type ServerGatewayFailureCode =
    | "HOSTED_MODEL_CONFLICT"
    | "HOSTED_MODEL_INVALID"
    | "SERVER_CONNECTION_FAILED"
    | "SERVER_DISCONNECTED"
    | "SERVER_NOT_READY"
    | "SERVER_PROTOCOL_FAILURE"
    | "SERVER_REQUEST_INVALID"
    | "SERVER_REQUEST_TIMEOUT"
    | "SERVER_RESPONSE_INVALID"
    | "SERVER_WORKER_FAILED"
    | "SERVER_WORKER_UNSUPPORTED"
    | "SESSION_LIMIT_REACHED"
    | "SESSION_NOT_FOUND";

//--------------------------------------------------------------------------------------------------
// Interface: ServerGatewayFailure
//
// Description:
//
//   Defines the structure of server gateway failure.
//
//--------------------------------------------------------------------------------------------------

export interface ServerGatewayFailure
{
    readonly code:                 ServerGatewayFailureCode;
    readonly currentModelRevision?: string;
    readonly isRetryable:          boolean;
    readonly message:              string;
    readonly remediation:          string;
}

//--------------------------------------------------------------------------------------------------
// Type: ServerGatewayResult
//
// Description:
//
//   Describes the result produced by server gateway.
//
//--------------------------------------------------------------------------------------------------

export type ServerGatewayResult<Value> =
    | { readonly isSuccessful: true; readonly value: Value }
    | { readonly isSuccessful: false; readonly failure: ServerGatewayFailure };

//--------------------------------------------------------------------------------------------------
// Interface: ServerConnectionDescription
//
// Description:
//
//   Defines the structure of server connection description.
//
//--------------------------------------------------------------------------------------------------

export interface ServerConnectionDescription
{
    readonly instanceId:    string;
    readonly isReady:       boolean;
    readonly modelRevision: string | null;
}

//--------------------------------------------------------------------------------------------------
// Interface: ServerTestResult
//
// Description:
//
//   Describes the result produced by server test.
//
//--------------------------------------------------------------------------------------------------

export interface ServerTestResult extends ServerConnectionDescription
{
    readonly isLive: boolean;
}

//--------------------------------------------------------------------------------------------------
// Interface: HostedDocumentDto
//
// Description:
//
//   Defines the structure of hosted document dto.
//
//--------------------------------------------------------------------------------------------------

export interface HostedDocumentDto
{
    readonly canonicalDocument: CanonicalSerializedDocument;
    readonly modelRevision:     string;
}

//--------------------------------------------------------------------------------------------------
// Interface: ConditionalHostedDocumentPut
//
// Description:
//
//   Defines the structure of conditional hosted document put.
//
//--------------------------------------------------------------------------------------------------

export interface ConditionalHostedDocumentPut
{
    readonly canonicalDocument:     CanonicalSerializedDocument;
    readonly expectedModelRevision: string;
}

//--------------------------------------------------------------------------------------------------
// Interface: HostedDocumentPutResult
//
// Description:
//
//   Describes the result produced by hosted document put.
//
//--------------------------------------------------------------------------------------------------

export interface HostedDocumentPutResult
{
    readonly isIdempotent:  boolean;
    readonly modelRevision: string;
}

//--------------------------------------------------------------------------------------------------
// Interface: HostedSessionDto
//
// Description:
//
//   Defines the structure of hosted session dto.
//
//--------------------------------------------------------------------------------------------------

export interface HostedSessionDto
{
    readonly actionTrace:                readonly RuntimeActionTraceEntry[];
    readonly currentState:               string;
    readonly initialEntryActionsPending: boolean;
    readonly isStale:                    boolean;
    readonly modelRevision:              string;
    readonly processedEventCount:        number;
    readonly sessionId:                  string;
    readonly traceTruncated:             boolean;
    readonly transitionTrace:            readonly RuntimeTransitionTraceEntry[];
}

//--------------------------------------------------------------------------------------------------
// Interface: HostedSessionOperationResult
//
// Description:
//
//   Describes the result produced by hosted session operation.
//
//--------------------------------------------------------------------------------------------------

export interface HostedSessionOperationResult
{
    readonly consumedEventCount: number;
    readonly emittedActions:     readonly string[];
    readonly session:            HostedSessionDto;
    readonly warnings:           readonly RuntimeWarning[];
}

//--------------------------------------------------------------------------------------------------
// Interface: HostedSessionEventRequest
//
// Description:
//
//   Describes a hosted session event request.
//
//--------------------------------------------------------------------------------------------------

export interface HostedSessionEventRequest
{
    readonly eventBuffer: readonly string[];
    readonly sessionId:   string;
}

//--------------------------------------------------------------------------------------------------
// Interface: ServerGateway
//
// Description:
//
//   Defines the structure of server gateway.
//
//--------------------------------------------------------------------------------------------------

export interface ServerGateway
{
    connect ( serverUrl: string ): Promise<ServerGatewayResult<ServerConnectionDescription>>;
    disconnect (): Promise<ServerGatewayResult<void>>;
    test (): Promise<ServerGatewayResult<ServerTestResult>>;
    getHostedDocument (): Promise<ServerGatewayResult<HostedDocumentDto>>;
    putHostedDocument (
        request: ConditionalHostedDocumentPut,
    ): Promise<ServerGatewayResult<HostedDocumentPutResult>>;
    startSession (): Promise<ServerGatewayResult<HostedSessionDto>>;
    runSession (
        request: HostedSessionEventRequest,
    ): Promise<ServerGatewayResult<HostedSessionOperationResult>>;
    stepSession (
        request: HostedSessionEventRequest,
    ): Promise<ServerGatewayResult<HostedSessionOperationResult>>;
    resetSession ( sessionId: string ): Promise<ServerGatewayResult<HostedSessionDto>>;
    closeSession ( sessionId: string ): Promise<ServerGatewayResult<void>>;
    restart (): Promise<ServerGatewayResult<ServerConnectionDescription>>;
    dispose (): Promise<ServerGatewayResult<void>>;
}
