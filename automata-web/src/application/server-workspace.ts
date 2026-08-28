// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Server Workspace
// Version: 1.0.0
// Date:    2026-08-14
// Author:  Rohin Gosling
//
// Description:
//
//   Coordinates browser-neutral server connection, hosted-document, revision, and pinned-session
//   client state.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { ContentHashPort, DocumentCodecPort } from "./ports/contracts.js";
import type
{
    HostedDocumentDto,
    HostedDocumentPutResult,
    HostedSessionDto,
    HostedSessionEventRequest,
    HostedSessionOperationResult,
    ServerConnectionDescription,
    ServerGateway,
    ServerGatewayFailure,
    ServerGatewayFailureCode,
    ServerGatewayResult,
    ServerTestResult,
} from "./server-contracts.js";
import
{
    createPulledDocumentWorkspace,
} from "./document-workspace.js";
import type { DocumentWorkspaceState } from "./document-workspace.js";
import
{
    serializeCanonicalDocument,
    serializeCanonicalHostedContent,
} from "../domain/model/canonicalization.js";
import type { AutomataDocument } from "../domain/model/contracts.js";
import type { DomainDiagnostic } from "../domain/model/diagnostics.js";
import { MAXIMUM_FILE_BYTE_COUNT } from "../domain/model/limits.js";
import { validateAuthoringDraft } from "../domain/model/validation.js";

//--------------------------------------------------------------------------------------------------
// Type: ServerConnectionStatus
//
// Description:
//
//   Defines the supported server connection status alternatives.
//
//--------------------------------------------------------------------------------------------------

export type ServerConnectionStatus = "connected" | "connecting" | "disconnected";

//--------------------------------------------------------------------------------------------------
// Type: ServerReadinessStatus
//
// Description:
//
//   Defines the supported server readiness status alternatives.
//
//--------------------------------------------------------------------------------------------------

export type ServerReadinessStatus = "not_ready" | "ready" | "unknown";

//--------------------------------------------------------------------------------------------------
// Type: ServerSynchronizationStatus
//
// Description:
//
//   Defines the supported server synchronization status alternatives.
//
//--------------------------------------------------------------------------------------------------

export type ServerSynchronizationStatus = "conflict" | "diverged" | "synchronized" | "unknown";

//--------------------------------------------------------------------------------------------------
// Interface: ActiveServerSessionReference
//
// Description:
//
//   Defines the structure of active server session reference.
//
//--------------------------------------------------------------------------------------------------

export interface ActiveServerSessionReference
{
    readonly isStale:      boolean;
    readonly modelRevision: string;
    readonly sessionId:     string;
}

//--------------------------------------------------------------------------------------------------
// Interface: ServerWorkspaceState
//
// Description:
//
//   Defines the structure of server workspace state.
//
//--------------------------------------------------------------------------------------------------

export interface ServerWorkspaceState
{
    readonly activeSession:           ActiveServerSessionReference | null;
    readonly connectionStatus:        ServerConnectionStatus;
    readonly instanceId:              string | null;
    readonly lastKnownHostedRevision: string | null;
    readonly readinessStatus:         ServerReadinessStatus;
    readonly synchronizationStatus:   ServerSynchronizationStatus;
}

//--------------------------------------------------------------------------------------------------
// Type: ServerWorkspaceFailureCode
//
// Description:
//
//   Defines the supported server workspace failure code alternatives.
//
//--------------------------------------------------------------------------------------------------

export type ServerWorkspaceFailureCode =
    | "DOCUMENT_INVALID"
    | "DOCUMENT_MISSING"
    | "HOSTED_BASELINE_MISSING"
    | "PULL_DOCUMENT_NON_CANONICAL"
    | "PULL_DOCUMENT_TOO_LARGE"
    | "PULL_REVISION_MISMATCH"
    | "SESSION_MISSING"
    | "SESSION_RESPONSE_MISMATCH";

//--------------------------------------------------------------------------------------------------
// Interface: ServerWorkspaceFailure
//
// Description:
//
//   Defines the structure of server workspace failure.
//
//--------------------------------------------------------------------------------------------------

export interface ServerWorkspaceFailure
{
    readonly code:            ServerGatewayFailureCode | ServerWorkspaceFailureCode;
    readonly diagnostics?:    readonly DomainDiagnostic[];
    readonly gatewayFailure?: ServerGatewayFailure;
    readonly message:         string;
    readonly remediation:     string;
}

//--------------------------------------------------------------------------------------------------
// Type: ServerWorkspaceOperationResult
//
// Description:
//
//   Describes the result produced by server workspace operation.
//
//--------------------------------------------------------------------------------------------------

export type ServerWorkspaceOperationResult<Value> =
    | {
        readonly isSuccessful:  true;
        readonly serverWorkspace: ServerWorkspaceState;
        readonly value:         Value;
    }
    | {
        readonly isSuccessful:  false;
        readonly failure:       ServerWorkspaceFailure;
        readonly serverWorkspace: ServerWorkspaceState;
    };

//--------------------------------------------------------------------------------------------------
// Type: ServerDocumentOperationResult
//
// Description:
//
//   Describes the result produced by server document operation.
//
//--------------------------------------------------------------------------------------------------

export type ServerDocumentOperationResult<Value> =
    | {
        readonly documentWorkspace: DocumentWorkspaceState;
        readonly isSuccessful:      true;
        readonly serverWorkspace:   ServerWorkspaceState;
        readonly value:             Value;
    }
    | {
        readonly documentWorkspace: DocumentWorkspaceState;
        readonly failure:           ServerWorkspaceFailure;
        readonly isSuccessful:      false;
        readonly serverWorkspace:   ServerWorkspaceState;
    };

const MODEL_REVISION_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const UUID_PATTERN           = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

//--------------------------------------------------------------------------------------------------
// Function: createServerWorkspaceState
//
// Description:
//
//   Creates server workspace state.
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

export function createServerWorkspaceState (): ServerWorkspaceState
{
    // Return the assembled result.

    return {
        activeSession:           null,
        connectionStatus:        "disconnected",
        instanceId:              null,
        lastKnownHostedRevision: null,
        readinessStatus:         "unknown",
        synchronizationStatus:   "unknown",
    };
}

//--------------------------------------------------------------------------------------------------
// Function: beginServerConnection
//
// Description:
//
//   Begins the server connection.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
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

export function beginServerConnection ( state: ServerWorkspaceState ): ServerWorkspaceState
{
    // Return the assembled result.

    return { ...state, connectionStatus: "connecting", readinessStatus: "unknown" };
}

//--------------------------------------------------------------------------------------------------
// Function: markServerDocumentChanged
//
// Description:
//
//   Marks the server document changed.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
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

export function markServerDocumentChanged ( state: ServerWorkspaceState ): ServerWorkspaceState
{
    // Return the result selected by the current condition.

    return state.synchronizationStatus === "synchronized"
        ? { ...state, synchronizationStatus: "diverged" }
        : state;
}

//--------------------------------------------------------------------------------------------------
// Function: markServerConnectionLost
//
// Description:
//
//   Marks the server connection lost.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
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

export function markServerConnectionLost ( state: ServerWorkspaceState ): ServerWorkspaceState
{
    // Return the assembled result.

    return {
        ...state,
        activeSession:           null,
        connectionStatus:        "disconnected",
        instanceId:              null,
        lastKnownHostedRevision: null,
        readinessStatus:         "unknown",
        synchronizationStatus:   "unknown",
    };
}

//--------------------------------------------------------------------------------------------------
// Function: gatewayFailureResult
//
// Description:
//
//   Derives the gateway failure result.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
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
//--------------------------------------------------------------------------------------------------

function gatewayFailureResult<Value> (
    state: ServerWorkspaceState,
    failure: ServerGatewayFailure,
): ServerWorkspaceOperationResult<Value>
{
    // Return the assembled result.

    return {
        isSuccessful: false,
        failure:
        {
            code:            failure.code,
            gatewayFailure: failure,
            message:         failure.message,
            remediation:     failure.remediation,
        },
        serverWorkspace: applyGatewayFailureState ( state, failure ),
    };
}

//--------------------------------------------------------------------------------------------------
// Function: documentGatewayFailureResult
//
// Description:
//
//   Derives the document gateway failure result.
//
// Parameters:
//
//   - serverWorkspace:
//     The server workspace supplied to the operation.
//
//   - documentWorkspace:
//     The document workspace supplied to the operation.
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
//--------------------------------------------------------------------------------------------------

function documentGatewayFailureResult<Value> (
    serverWorkspace: ServerWorkspaceState,
    documentWorkspace: DocumentWorkspaceState,
    failure: ServerGatewayFailure,
): ServerDocumentOperationResult<Value>
{
    // Return the assembled result.

    return {
        documentWorkspace,
        failure:
        {
            code:            failure.code,
            gatewayFailure: failure,
            message:         failure.message,
            remediation:     failure.remediation,
        },
        isSuccessful: false,
        serverWorkspace: applyGatewayFailureState ( serverWorkspace, failure ),
    };
}

//--------------------------------------------------------------------------------------------------
// Function: applyGatewayFailureState
//
// Description:
//
//   Applies the gateway failure state.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
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
//--------------------------------------------------------------------------------------------------

function applyGatewayFailureState (
    state: ServerWorkspaceState,
    failure: ServerGatewayFailure,
): ServerWorkspaceState
{
    // Dispatch according to the failure code value.

    switch ( failure.code )
    {
        // Handle the group of case values that share the following outcome.

        case "SERVER_CONNECTION_FAILED":
        case "SERVER_DISCONNECTED":
        case "SERVER_PROTOCOL_FAILURE":
        case "SERVER_RESPONSE_INVALID":
        case "SERVER_WORKER_FAILED":
        case "SERVER_WORKER_UNSUPPORTED":

            // Return the mark server connection lost result.

            return markServerConnectionLost ( state );

        // Handle the group of case values that share the following outcome.

        case "HOSTED_MODEL_CONFLICT":
        case "HOSTED_MODEL_INVALID":
        case "SERVER_NOT_READY":
        case "SERVER_REQUEST_INVALID":
        case "SERVER_REQUEST_TIMEOUT":
        case "SESSION_LIMIT_REACHED":
        case "SESSION_NOT_FOUND":

            // Return the state.

            return state;
    }
}

//--------------------------------------------------------------------------------------------------
// Function: localFailure
//
// Description:
//
//   Derives the local failure.
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

function localFailure (
    code: ServerGatewayFailureCode | ServerWorkspaceFailureCode,
    message: string,
    remediation: string,
    diagnostics?: readonly DomainDiagnostic[],
): ServerWorkspaceFailure
{
    // Return the assembled result.

    return {
        code,
        ...( diagnostics === undefined ? {} : { diagnostics } ),
        message,
        remediation,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: unexpectedGatewayFailure
//
// Description:
//
//   Derives the unexpected gateway failure.
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

function unexpectedGatewayFailure ( error: unknown ): ServerGatewayFailure
{
    // Return the assembled result.

    return {
        code:        "SERVER_WORKER_FAILED",
        isRetryable: true,
        message:     error instanceof Error ? error.message : "The server gateway failed unexpectedly.",
        remediation: "Reconnect to the server and retry the operation.",
    };
}

//--------------------------------------------------------------------------------------------------
// Function: validateConnectionDescription
//
// Description:
//
//   Validates connection description.
//
// Parameters:
//
//   - description:
//     The description supplied to the operation.
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

function validateConnectionDescription ( description: ServerConnectionDescription ): ServerWorkspaceFailure | null
{
    // Handle the case where at least one branch condition is satisfied.

    if ( !UUID_PATTERN.test ( description.instanceId ) || description.modelRevision !== null &&
        !MODEL_REVISION_PATTERN.test ( description.modelRevision ) || description.isReady &&
        description.modelRevision === null )
    {
        // Return the local failure result.

        return localFailure (
            "SERVER_RESPONSE_INVALID",
            "The server returned an invalid connection description.",
            "Reconnect to a conforming server and retry the operation.",
        );
    }

    // Return the computed result.

    return null;
}

//--------------------------------------------------------------------------------------------------
// Function: sessionReference
//
// Description:
//
//   Derives the session reference.
//
// Parameters:
//
//   - session:
//     The session supplied to the operation.
//
//   - hostedRevision:
//     The hosted revision supplied to the operation.
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

function sessionReference (
    session: HostedSessionDto,
    hostedRevision: string | null,
): ActiveServerSessionReference
{
    // Return the assembled result.

    return {
        isStale: hostedRevision !== null && session.modelRevision !== hostedRevision,
        modelRevision: session.modelRevision,
        sessionId: session.sessionId,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: refreshSessionStaleness
//
// Description:
//
//   Refreshes the session staleness.
//
// Parameters:
//
//   - session:
//     The session supplied to the operation.
//
//   - hostedRevision:
//     The hosted revision supplied to the operation.
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

function refreshSessionStaleness (
    session: ActiveServerSessionReference | null,
    hostedRevision: string | null,
): ActiveServerSessionReference | null
{
    // Handle the case where session matches an absent value.

    if ( session === null )
    {
        // Return the computed result.

        return null;
    }

    const isStale = hostedRevision !== null && session.modelRevision !== hostedRevision;

    // Return the result selected by the current condition.

    return session.isStale === isStale ? session : { ...session, isStale };
}

//--------------------------------------------------------------------------------------------------
// Function: applyConnectionDescription
//
// Description:
//
//   Applies the connection description.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
//
//   - description:
//     The description supplied to the operation.
//
//   - forceSessionClose:
//     The force session close supplied to the operation.
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

function applyConnectionDescription (
    state: ServerWorkspaceState,
    description: ServerConnectionDescription,
    forceSessionClose = false,
): ServerWorkspaceState
{
    // Initialize the local values needed by this operation.

    const instanceChanged       = state.instanceId !== null && state.instanceId !== description.instanceId;
    const hostedRevisionChanged = state.lastKnownHostedRevision !== null &&
        state.lastKnownHostedRevision !== description.modelRevision;
    const activeSession = forceSessionClose || instanceChanged
        ? null
        : refreshSessionStaleness ( state.activeSession, description.modelRevision );
    const synchronizationStatus = instanceChanged
        ? "unknown"
        : hostedRevisionChanged ? "diverged" : state.synchronizationStatus;

    // Return the assembled result.

    return {
        activeSession,
        connectionStatus:        "connected",
        instanceId:              description.instanceId,
        lastKnownHostedRevision: description.modelRevision,
        readinessStatus:         description.isReady ? "ready" : "not_ready",
        synchronizationStatus,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: requireReadyServer
//
// Description:
//
//   Validates and returns the ready server.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
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

function requireReadyServer ( state: ServerWorkspaceState ): ServerWorkspaceFailure | null
{
    // Handle the case where state connection status differs from the connected value.

    if ( state.connectionStatus !== "connected" )
    {
        // Return the local failure result.

        return localFailure (
            "SERVER_DISCONNECTED",
            "The client is not connected to a server.",
            "Connect to the server before retrying the operation.",
        );
    }

    // Handle the case where state readiness status differs from the ready value.

    if ( state.readinessStatus !== "ready" )
    {
        // Return the local failure result.

        return localFailure (
            "SERVER_NOT_READY",
            "The connected server is not ready to host a model.",
            "Test the server readiness and retry when it reports ready.",
        );
    }

    // Return the computed result.

    return null;
}

//--------------------------------------------------------------------------------------------------
// Function: connectServerWorkspace
//
// Description:
//
//   Connects the server workspace.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
//
//   - gateway:
//     The gateway supplied to the operation.
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
//--------------------------------------------------------------------------------------------------

export async function connectServerWorkspace (
    state: ServerWorkspaceState,
    gateway: ServerGateway,
    serverUrl: string,
): Promise<ServerWorkspaceOperationResult<ServerConnectionDescription>>
{
    // Initialize the local values needed by this operation.

    let gatewayResult;

    // Run the operation that may report a recoverable failure.

    try
    {
        gatewayResult = await gateway.connect ( serverUrl );
    }
    catch ( error )
    {
        // Recover from the reported failure without hiding its outcome.

        return gatewayFailureResult (
            { ...state, connectionStatus: "disconnected", readinessStatus: "unknown" },
            unexpectedGatewayFailure ( error ),
        );
    }

    // Handle the case where the gateway result is successful condition is not satisfied.

    if ( !gatewayResult.isSuccessful )
    {
        // Return the gateway failure result result.

        return gatewayFailureResult (
            { ...state, connectionStatus: "disconnected", readinessStatus: "unknown" },
            gatewayResult.failure,
        );
    }

    const responseFailure = validateConnectionDescription ( gatewayResult.value );

    // Handle the case where response failure differs from an absent value.

    if ( responseFailure !== null )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            failure: responseFailure,
            serverWorkspace: markServerConnectionLost ( state ),
        };
    }

    // Return the assembled result.

    return {
        isSuccessful: true,
        serverWorkspace: applyConnectionDescription ( state, gatewayResult.value ),
        value: gatewayResult.value,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: disconnectServerWorkspace
//
// Description:
//
//   Disconnects the server workspace.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
//
//   - gateway:
//     The gateway supplied to the operation.
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

export async function disconnectServerWorkspace (
    state: ServerWorkspaceState,
    gateway: ServerGateway,
): Promise<ServerWorkspaceOperationResult<void>>
{
    // Initialize the local values needed by this operation.

    let gatewayResult;

    // Run the operation that may report a recoverable failure.

    try
    {
        gatewayResult = await gateway.disconnect ();
    }
    catch ( error )
    {
        // Recover from the reported failure without hiding its outcome.

        return gatewayFailureResult ( state, unexpectedGatewayFailure ( error ) );
    }

    // Handle the case where the gateway result is successful condition is not satisfied.

    if ( !gatewayResult.isSuccessful )
    {
        // Return the gateway failure result result.

        return gatewayFailureResult ( state, gatewayResult.failure );
    }

    // Return the assembled result.

    return {
        isSuccessful: true,
        serverWorkspace: { ...state, connectionStatus: "disconnected", readinessStatus: "unknown" },
        value: undefined,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: testServerWorkspace
//
// Description:
//
//   Checks the server workspace.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
//
//   - gateway:
//     The gateway supplied to the operation.
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

export async function testServerWorkspace (
    state: ServerWorkspaceState,
    gateway: ServerGateway,
): Promise<ServerWorkspaceOperationResult<ServerTestResult>>
{
    // Initialize the local values needed by this operation.

    let gatewayResult;

    // Run the operation that may report a recoverable failure.

    try
    {
        gatewayResult = await gateway.test ();
    }
    catch ( error )
    {
        // Recover from the reported failure without hiding its outcome.

        return gatewayFailureResult ( state, unexpectedGatewayFailure ( error ) );
    }

    // Handle the case where the gateway result is successful condition is not satisfied.

    if ( !gatewayResult.isSuccessful )
    {
        // Return the gateway failure result result.

        return gatewayFailureResult ( state, gatewayResult.failure );
    }

    const responseFailure = validateConnectionDescription ( gatewayResult.value );

    // Handle the case where at least one branch condition is satisfied.

    if ( responseFailure !== null || !gatewayResult.value.isLive )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            failure: responseFailure ?? localFailure (
                "SERVER_RESPONSE_INVALID",
                "The server test completed without confirming liveness.",
                "Reconnect to the server and run the test again.",
            ),
            serverWorkspace: markServerConnectionLost ( state ),
        };
    }

    // Return the assembled result.

    return {
        isSuccessful: true,
        serverWorkspace: applyConnectionDescription ( state, gatewayResult.value ),
        value: gatewayResult.value,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: restartServerWorkspace
//
// Description:
//
//   Restarts the server workspace.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
//
//   - gateway:
//     The gateway supplied to the operation.
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

export async function restartServerWorkspace (
    state: ServerWorkspaceState,
    gateway: ServerGateway,
): Promise<ServerWorkspaceOperationResult<ServerConnectionDescription>>
{
    // Initialize the local values needed by this operation.

    let gatewayResult;

    // Run the operation that may report a recoverable failure.

    try
    {
        gatewayResult = await gateway.restart ();
    }
    catch ( error )
    {
        // Recover from the reported failure without hiding its outcome.

        return gatewayFailureResult ( state, unexpectedGatewayFailure ( error ) );
    }

    // Handle the case where the gateway result is successful condition is not satisfied.

    if ( !gatewayResult.isSuccessful )
    {
        // Return the gateway failure result result.

        return gatewayFailureResult ( state, gatewayResult.failure );
    }

    const responseFailure = validateConnectionDescription ( gatewayResult.value );

    // Handle the case where response failure differs from an absent value.

    if ( responseFailure !== null )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            failure: responseFailure,
            serverWorkspace: markServerConnectionLost ( state ),
        };
    }

    // Return the assembled result.

    return {
        isSuccessful: true,
        serverWorkspace:
        {
            ...applyConnectionDescription ( state, gatewayResult.value, true ),
            synchronizationStatus: "unknown",
        },
        value: gatewayResult.value,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: disposeServerWorkspace
//
// Description:
//
//   Disposes the server workspace.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
//
//   - gateway:
//     The gateway supplied to the operation.
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

export async function disposeServerWorkspace (
    state: ServerWorkspaceState,
    gateway: ServerGateway,
): Promise<ServerWorkspaceOperationResult<void>>
{
    // Initialize the local values needed by this operation.

    let gatewayResult;

    // Run the operation that may report a recoverable failure.

    try
    {
        gatewayResult = await gateway.dispose ();
    }
    catch ( error )
    {
        // Recover from the reported failure without hiding its outcome.

        return gatewayFailureResult ( state, unexpectedGatewayFailure ( error ) );
    }

    // Handle the case where the gateway result is successful condition is not satisfied.

    if ( !gatewayResult.isSuccessful )
    {
        // Return the gateway failure result result.

        return gatewayFailureResult ( state, gatewayResult.failure );
    }

    // Return the assembled result.

    return { isSuccessful: true, serverWorkspace: createServerWorkspaceState (), value: undefined };
}

//--------------------------------------------------------------------------------------------------
// Function: hashDocumentSemanticContent
//
// Description:
//
//   Hashes the document semantic content.
//
// Parameters:
//
//   - document:
//     The document to process.
//
//   - contentHasher:
//     The content hasher supplied to the operation.
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

async function hashDocumentSemanticContent (
    document: AutomataDocument,
    contentHasher: ContentHashPort,
): Promise<string>
{
    // Return the hash canonical text result.

    return contentHasher.hashCanonicalText ( serializeCanonicalHostedContent ( document ) );
}

//--------------------------------------------------------------------------------------------------
// Function: serverDocumentFailure
//
// Description:
//
//   Derives the server document failure.
//
// Parameters:
//
//   - serverWorkspace:
//     The server workspace supplied to the operation.
//
//   - documentWorkspace:
//     The document workspace supplied to the operation.
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
//--------------------------------------------------------------------------------------------------

function serverDocumentFailure<Value> (
    serverWorkspace: ServerWorkspaceState,
    documentWorkspace: DocumentWorkspaceState,
    failure: ServerWorkspaceFailure,
): ServerDocumentOperationResult<Value>
{
    // Return the assembled result.

    return { documentWorkspace, failure, isSuccessful: false, serverWorkspace };
}

//--------------------------------------------------------------------------------------------------
// Function: pushDocumentToServer
//
// Description:
//
//   Pushes the document to server.
//
// Parameters:
//
//   - serverWorkspace:
//     The server workspace supplied to the operation.
//
//   - documentWorkspace:
//     The document workspace supplied to the operation.
//
//   - gateway:
//     The gateway supplied to the operation.
//
//   - contentHasher:
//     The content hasher supplied to the operation.
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

export async function pushDocumentToServer (
    serverWorkspace: ServerWorkspaceState,
    documentWorkspace: DocumentWorkspaceState,
    gateway: ServerGateway,
    contentHasher: ContentHashPort,
): Promise<ServerDocumentOperationResult<HostedDocumentPutResult>>
{
    // Initialize the local values needed by this operation.

    const readinessFailure = requireReadyServer ( serverWorkspace );

    // Handle the case where readiness failure differs from an absent value.

    if ( readinessFailure !== null )
    {
        // Return the server document failure result.

        return serverDocumentFailure ( serverWorkspace, documentWorkspace, readinessFailure );
    }

    // Handle the case where document workspace editor state matches an absent value.

    if ( documentWorkspace.editorState === null )
    {
        // Return the server document failure result.

        return serverDocumentFailure (
            serverWorkspace,
            documentWorkspace,
            localFailure (
                "DOCUMENT_MISSING",
                "There is no open document to push.",
                "Create or open a valid document first.",
            ),
        );
    }

    const validation = validateAuthoringDraft ( documentWorkspace.editorState.draft );

    // Handle the case where the validation is valid condition is not satisfied.

    if ( !validation.isValid )
    {
        // Return the server document failure result.

        return serverDocumentFailure (
            serverWorkspace,
            documentWorkspace,
            localFailure (
                "DOCUMENT_INVALID",
                "The current document is not valid and cannot be pushed.",
                "Resolve the reported validation errors and retry Push.",
                validation.diagnostics,
            ),
        );
    }

    // Handle the case where server workspace last known hosted revision matches an absent value.

    if ( serverWorkspace.lastKnownHostedRevision === null )
    {
        // Return the server document failure result.

        return serverDocumentFailure (
            serverWorkspace,
            documentWorkspace,
            localFailure (
                "HOSTED_BASELINE_MISSING",
                "Push requires a last-known hosted model revision.",
                "Reconnect or Pull to establish the hosted revision before pushing.",
            ),
        );
    }

    // Initialize the local values needed by this operation.

    const canonicalDocument = serializeCanonicalDocument ( validation.document );
    let expectedResultRevision: string;

    // Run the operation that may report a recoverable failure.

    try
    {
        expectedResultRevision = await hashDocumentSemanticContent ( validation.document, contentHasher );
    }
    catch ( error )
    {
        // Recover from the reported failure without hiding its outcome.

        return documentGatewayFailureResult (
            serverWorkspace,
            documentWorkspace,
            unexpectedGatewayFailure ( error ),
        );
    }

    let gatewayResult;

    // Run the operation that may report a recoverable failure.

    try
    {
        gatewayResult = await gateway.putHostedDocument (
            {
                canonicalDocument,
                expectedModelRevision: serverWorkspace.lastKnownHostedRevision,
            },
        );
    }
    catch ( error )
    {
        // Recover from the reported failure without hiding its outcome.

        return documentGatewayFailureResult (
            serverWorkspace,
            documentWorkspace,
            unexpectedGatewayFailure ( error ),
        );
    }

    // Handle the case where the gateway result is successful condition is not satisfied.

    if ( !gatewayResult.isSuccessful )
    {
        // Initialize the local values needed by this operation.

        const failedServerWorkspace: ServerWorkspaceState = gatewayResult.failure.code === "HOSTED_MODEL_CONFLICT"
            ? { ...serverWorkspace, synchronizationStatus: "conflict" }
            : serverWorkspace;

        // Return the document gateway failure result result.

        return documentGatewayFailureResult ( failedServerWorkspace, documentWorkspace, gatewayResult.failure );
    }

    // Handle the case where at least one branch condition is satisfied.

    if ( !MODEL_REVISION_PATTERN.test ( gatewayResult.value.modelRevision ) ||
        gatewayResult.value.modelRevision !== expectedResultRevision )
    {
        // Return the server document failure result.

        return serverDocumentFailure (
            markServerConnectionLost ( serverWorkspace ),
            documentWorkspace,
            localFailure (
                "SERVER_RESPONSE_INVALID",
                "The hosted revision returned by Push does not match the canonical semantic document.",
                "Reconnect and reconcile the hosted model before retrying Push.",
            ),
        );
    }

    const nextServerWorkspace: ServerWorkspaceState = {
        ...serverWorkspace,
        activeSession: refreshSessionStaleness ( serverWorkspace.activeSession, gatewayResult.value.modelRevision ),
        lastKnownHostedRevision: gatewayResult.value.modelRevision,
        synchronizationStatus: "synchronized",
    };

    // Return the assembled result.

    return {
        documentWorkspace,
        isSuccessful: true,
        serverWorkspace: nextServerWorkspace,
        value: gatewayResult.value,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: validatePulledCanonicalDocument
//
// Description:
//
//   Validates pulled canonical document.
//
// Parameters:
//
//   - hostedDocument:
//     The hosted document supplied to the operation.
//
//   - documentCodec:
//     The document codec supplied to the operation.
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

function validatePulledCanonicalDocument (
    hostedDocument: HostedDocumentDto,
    documentCodec: DocumentCodecPort,
):
    | { readonly isSuccessful: true; readonly document: AutomataDocument }
    | { readonly isSuccessful: false; readonly failure: ServerWorkspaceFailure }
{
    // Initialize the local values needed by this operation.

    const byteCount = new TextEncoder ().encode ( hostedDocument.canonicalDocument.text ).byteLength;

    // Handle the case where byte count exceeds maximum file byte count.

    if ( byteCount > MAXIMUM_FILE_BYTE_COUNT )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            failure: localFailure (
                "PULL_DOCUMENT_TOO_LARGE",
                `The hosted document is ${byteCount} bytes; the limit is ${MAXIMUM_FILE_BYTE_COUNT} bytes.`,
                "Reduce the hosted document beneath the supported limit before pulling it.",
            ),
        };
    }

    let decodeResult;

    // Run the operation that may report a recoverable failure.

    try
    {
        decodeResult = documentCodec.open ( hostedDocument.canonicalDocument.text );
    }
    catch ( error )
    {
        // Recover from the reported failure without hiding its outcome.

        return {
            isSuccessful: false,
            failure: localFailure (
                "DOCUMENT_INVALID",
                error instanceof Error ? error.message : "The hosted document could not be decoded.",
                "Correct the hosted document and retry Pull.",
            ),
        };
    }

    // Handle the case where the decode result is successful condition is not satisfied.

    if ( !decodeResult.isSuccessful )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            failure: localFailure (
                "DOCUMENT_INVALID",
                "The hosted document failed independent client validation.",
                "Correct the hosted document and retry Pull.",
                decodeResult.diagnostics,
            ),
        };
    }

    const validation = validateAuthoringDraft ( decodeResult.document );

    // Handle the case where the validation is valid condition is not satisfied.

    if ( !validation.isValid )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            failure: localFailure (
                "DOCUMENT_INVALID",
                "The hosted document failed independent client validation.",
                "Correct the hosted document and retry Pull.",
                validation.diagnostics,
            ),
        };
    }

    const canonicalDocument = serializeCanonicalDocument ( validation.document );

    // Handle the case where canonical document text differs from text.

    if ( canonicalDocument.text !== hostedDocument.canonicalDocument.text )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            failure: localFailure (
                "PULL_DOCUMENT_NON_CANONICAL",
                "The hosted document is valid but is not in canonical serialized form.",
                "Replace the hosted model through a conforming canonical Push.",
            ),
        };
    }

    // Return the assembled result.

    return { isSuccessful: true, document: validation.document };
}

//--------------------------------------------------------------------------------------------------
// Function: pullDocumentFromServer
//
// Description:
//
//   Pulls the document from server.
//
// Parameters:
//
//   - serverWorkspace:
//     The server workspace supplied to the operation.
//
//   - documentWorkspace:
//     The document workspace supplied to the operation.
//
//   - gateway:
//     The gateway supplied to the operation.
//
//   - documentCodec:
//     The document codec supplied to the operation.
//
//   - contentHasher:
//     The content hasher supplied to the operation.
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

export async function pullDocumentFromServer (
    serverWorkspace: ServerWorkspaceState,
    documentWorkspace: DocumentWorkspaceState,
    gateway: ServerGateway,
    documentCodec: DocumentCodecPort,
    contentHasher: ContentHashPort,
): Promise<ServerDocumentOperationResult<HostedDocumentDto>>
{
    // Initialize the local values needed by this operation.

    const readinessFailure = requireReadyServer ( serverWorkspace );

    // Handle the case where readiness failure differs from an absent value.

    if ( readinessFailure !== null )
    {
        // Return the server document failure result.

        return serverDocumentFailure ( serverWorkspace, documentWorkspace, readinessFailure );
    }

    let gatewayResult;

    // Run the operation that may report a recoverable failure.

    try
    {
        gatewayResult = await gateway.getHostedDocument ();
    }
    catch ( error )
    {
        // Recover from the reported failure without hiding its outcome.

        return documentGatewayFailureResult (
            serverWorkspace,
            documentWorkspace,
            unexpectedGatewayFailure ( error ),
        );
    }

    // Handle the case where the gateway result is successful condition is not satisfied.

    if ( !gatewayResult.isSuccessful )
    {
        // Return the document gateway failure result result.

        return documentGatewayFailureResult ( serverWorkspace, documentWorkspace, gatewayResult.failure );
    }

    const decodedDocument = validatePulledCanonicalDocument ( gatewayResult.value, documentCodec );

    // Handle the case where the decoded document is successful condition is not satisfied.

    if ( !decodedDocument.isSuccessful )
    {
        // Return the server document failure result.

        return serverDocumentFailure ( serverWorkspace, documentWorkspace, decodedDocument.failure );
    }

    let computedRevision: string;

    // Run the operation that may report a recoverable failure.

    try
    {
        computedRevision = await hashDocumentSemanticContent ( decodedDocument.document, contentHasher );
    }
    catch ( error )
    {
        // Recover from the reported failure without hiding its outcome.

        return documentGatewayFailureResult (
            serverWorkspace,
            documentWorkspace,
            unexpectedGatewayFailure ( error ),
        );
    }

    // Handle the case where at least one branch condition is satisfied.

    if ( !MODEL_REVISION_PATTERN.test ( gatewayResult.value.modelRevision ) ||
        computedRevision !== gatewayResult.value.modelRevision )
    {
        // Return the server document failure result.

        return serverDocumentFailure (
            markServerConnectionLost ( serverWorkspace ),
            documentWorkspace,
            localFailure (
                "PULL_REVISION_MISMATCH",
                "The hosted revision does not match the pulled document's canonical semantic content.",
                "Reconnect and retry Pull; restart the server if the integrity failure persists.",
            ),
        );
    }

    const nextServerWorkspace: ServerWorkspaceState = {
        ...serverWorkspace,
        activeSession: refreshSessionStaleness ( serverWorkspace.activeSession, computedRevision ),
        lastKnownHostedRevision: computedRevision,
        synchronizationStatus: "synchronized",
    };

    // Return the assembled result.

    return {
        documentWorkspace: createPulledDocumentWorkspace ( decodedDocument.document ),
        isSuccessful: true,
        serverWorkspace: nextServerWorkspace,
        value: gatewayResult.value,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: validateSession
//
// Description:
//
//   Validates session.
//
// Parameters:
//
//   - session:
//     The session supplied to the operation.
//
//   - expectedSession:
//     The expected session supplied to the operation.
//
//   - hostedRevision:
//     The hosted revision supplied to the operation.
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

function validateSession (
    session: HostedSessionDto,
    expectedSession: ActiveServerSessionReference | null = null,
    hostedRevision: string | null = null,
): ServerWorkspaceFailure | null
{
    // Handle the case where at least one branch condition is satisfied.

    if ( !UUID_PATTERN.test ( session.sessionId ) || !MODEL_REVISION_PATTERN.test ( session.modelRevision ) ||
        session.currentState.length === 0 || !Number.isSafeInteger ( session.processedEventCount ) ||
        session.processedEventCount < 0 || session.isStale !==
        ( hostedRevision !== null && session.modelRevision !== hostedRevision ) )
    {
        // Return the local failure result.

        return localFailure (
            "SERVER_RESPONSE_INVALID",
            "The server returned an invalid session description.",
            "Close the session, reconnect, and create a new session.",
        );
    }

    // Handle the case where all required conditions are satisfied.

    if ( expectedSession !== null && ( session.sessionId !== expectedSession.sessionId ||
        session.modelRevision !== expectedSession.modelRevision ) )
    {
        // Return the local failure result.

        return localFailure (
            "SESSION_RESPONSE_MISMATCH",
            "The session response does not match the active pinned session.",
            "Close the session, reconnect, and create a new session.",
        );
    }

    // Return the computed result.

    return null;
}

//--------------------------------------------------------------------------------------------------
// Function: startServerSession
//
// Description:
//
//   Starts the server session.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
//
//   - gateway:
//     The gateway supplied to the operation.
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

export async function startServerSession (
    state: ServerWorkspaceState,
    gateway: ServerGateway,
): Promise<ServerWorkspaceOperationResult<HostedSessionDto>>
{
    // Initialize the local values needed by this operation.

    const readinessFailure = requireReadyServer ( state );

    // Handle the case where readiness failure differs from an absent value.

    if ( readinessFailure !== null )
    {
        // Return the assembled result.

        return { isSuccessful: false, failure: readinessFailure, serverWorkspace: state };
    }

    let gatewayResult;

    // Run the operation that may report a recoverable failure.

    try
    {
        gatewayResult = await gateway.startSession ();
    }
    catch ( error )
    {
        // Recover from the reported failure without hiding its outcome.

        return gatewayFailureResult ( state, unexpectedGatewayFailure ( error ) );
    }

    // Handle the case where the gateway result is successful condition is not satisfied.

    if ( !gatewayResult.isSuccessful )
    {
        // Return the gateway failure result result.

        return gatewayFailureResult ( state, gatewayResult.failure );
    }

    const responseFailure = validateSession ( gatewayResult.value, null, state.lastKnownHostedRevision );

    // Handle the case where response failure differs from an absent value.

    if ( responseFailure !== null )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            failure: responseFailure,
            serverWorkspace: markServerConnectionLost ( state ),
        };
    }

    // Return the assembled result.

    return {
        isSuccessful: true,
        serverWorkspace:
        {
            ...state,
            activeSession: sessionReference ( gatewayResult.value, state.lastKnownHostedRevision ),
        },
        value: gatewayResult.value,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: operateActiveSession
//
// Description:
//
//   Runs an operation on the active session.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
//
//   - eventBuffer:
//     The event buffer supplied to the operation.
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

async function operateActiveSession (
    state: ServerWorkspaceState,
    eventBuffer: readonly string[],
    operation: (
        request: HostedSessionEventRequest,
    ) => Promise<ServerGatewayResult<HostedSessionOperationResult>>,
): Promise<ServerWorkspaceOperationResult<HostedSessionOperationResult>>
{
    // Initialize the local values needed by this operation.

    const readinessFailure = requireReadyServer ( state );

    // Handle the case where readiness failure differs from an absent value.

    if ( readinessFailure !== null )
    {
        // Return the assembled result.

        return { isSuccessful: false, failure: readinessFailure, serverWorkspace: state };
    }

    // Handle the case where state active session matches an absent value.

    if ( state.activeSession === null )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            failure: localFailure (
                "SESSION_MISSING",
                "There is no active server session.",
                "Create a session before running or stepping events.",
            ),
            serverWorkspace: state,
        };
    }

    let gatewayResult;

    // Run the operation that may report a recoverable failure.

    try
    {
        gatewayResult = await operation ( { eventBuffer: [ ...eventBuffer ], sessionId: state.activeSession.sessionId } );
    }
    catch ( error )
    {
        // Recover from the reported failure without hiding its outcome.

        return gatewayFailureResult ( state, unexpectedGatewayFailure ( error ) );
    }

    // Handle the case where the gateway result is successful condition is not satisfied.

    if ( !gatewayResult.isSuccessful )
    {
        // Return the gateway failure result result.

        return gatewayFailureResult ( state, gatewayResult.failure );
    }

    const responseFailure = validateSession (
        gatewayResult.value.session,
        state.activeSession,
        state.lastKnownHostedRevision,
    );

    // Handle the case where response failure differs from an absent value.

    if ( responseFailure !== null )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            failure: responseFailure,
            serverWorkspace: markServerConnectionLost ( state ),
        };
    }

    // Return the assembled result.

    return {
        isSuccessful: true,
        serverWorkspace:
        {
            ...state,
            activeSession: sessionReference ( gatewayResult.value.session, state.lastKnownHostedRevision ),
        },
        value: gatewayResult.value,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: runActiveServerSession
//
// Description:
//
//   Runs the active server session.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
//
//   - gateway:
//     The gateway supplied to the operation.
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

export function runActiveServerSession (
    state: ServerWorkspaceState,
    gateway: ServerGateway,
    eventBuffer: readonly string[],
): Promise<ServerWorkspaceOperationResult<HostedSessionOperationResult>>
{
    // Return the operate active session result.

    return operateActiveSession ( state, eventBuffer, request => gateway.runSession ( request ) );
}

//--------------------------------------------------------------------------------------------------
// Function: stepActiveServerSession
//
// Description:
//
//   Advances the active server session.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
//
//   - gateway:
//     The gateway supplied to the operation.
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

export function stepActiveServerSession (
    state: ServerWorkspaceState,
    gateway: ServerGateway,
    eventBuffer: readonly string[],
): Promise<ServerWorkspaceOperationResult<HostedSessionOperationResult>>
{
    // Return the operate active session result.

    return operateActiveSession ( state, eventBuffer, request => gateway.stepSession ( request ) );
}

//--------------------------------------------------------------------------------------------------
// Function: resetActiveServerSession
//
// Description:
//
//   Resets the active server session.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
//
//   - gateway:
//     The gateway supplied to the operation.
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

export async function resetActiveServerSession (
    state: ServerWorkspaceState,
    gateway: ServerGateway,
): Promise<ServerWorkspaceOperationResult<HostedSessionDto>>
{
    // Initialize the local values needed by this operation.

    const readinessFailure = requireReadyServer ( state );

    // Handle the case where readiness failure differs from an absent value.

    if ( readinessFailure !== null )
    {
        // Return the assembled result.

        return { isSuccessful: false, failure: readinessFailure, serverWorkspace: state };
    }

    // Handle the case where state active session matches an absent value.

    if ( state.activeSession === null )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            failure: localFailure (
                "SESSION_MISSING",
                "There is no active server session.",
                "Create a session before resetting it.",
            ),
            serverWorkspace: state,
        };
    }

    let gatewayResult;

    // Run the operation that may report a recoverable failure.

    try
    {
        gatewayResult = await gateway.resetSession ( state.activeSession.sessionId );
    }
    catch ( error )
    {
        // Recover from the reported failure without hiding its outcome.

        return gatewayFailureResult ( state, unexpectedGatewayFailure ( error ) );
    }

    // Handle the case where the gateway result is successful condition is not satisfied.

    if ( !gatewayResult.isSuccessful )
    {
        // Return the gateway failure result result.

        return gatewayFailureResult ( state, gatewayResult.failure );
    }

    const responseFailure = validateSession ( gatewayResult.value, state.activeSession, state.lastKnownHostedRevision );

    // Handle the case where response failure differs from an absent value.

    if ( responseFailure !== null )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            failure: responseFailure,
            serverWorkspace: markServerConnectionLost ( state ),
        };
    }

    // Return the assembled result.

    return {
        isSuccessful: true,
        serverWorkspace:
        {
            ...state,
            activeSession: sessionReference ( gatewayResult.value, state.lastKnownHostedRevision ),
        },
        value: gatewayResult.value,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: closeActiveServerSession
//
// Description:
//
//   Closes the active server session.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
//
//   - gateway:
//     The gateway supplied to the operation.
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

export async function closeActiveServerSession (
    state: ServerWorkspaceState,
    gateway: ServerGateway,
): Promise<ServerWorkspaceOperationResult<void>>
{
    // Handle the case where state connection status differs from the connected value.

    if ( state.connectionStatus !== "connected" )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            failure: localFailure (
                "SERVER_DISCONNECTED",
                "The client is not connected to a server.",
                "Reconnect before closing the active session.",
            ),
            serverWorkspace: state,
        };
    }

    // Handle the case where state active session matches an absent value.

    if ( state.activeSession === null )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            failure: localFailure (
                "SESSION_MISSING",
                "There is no active server session to close.",
                "Create a session before attempting to close it.",
            ),
            serverWorkspace: state,
        };
    }

    let gatewayResult;

    // Run the operation that may report a recoverable failure.

    try
    {
        gatewayResult = await gateway.closeSession ( state.activeSession.sessionId );
    }
    catch ( error )
    {
        // Recover from the reported failure without hiding its outcome.

        return gatewayFailureResult ( state, unexpectedGatewayFailure ( error ) );
    }

    // Handle the case where the gateway result is successful condition is not satisfied.

    if ( !gatewayResult.isSuccessful )
    {
        // Return the gateway failure result result.

        return gatewayFailureResult ( state, gatewayResult.failure );
    }

    // Return the assembled result.

    return {
        isSuccessful: true,
        serverWorkspace: { ...state, activeSession: null },
        value: undefined,
    };
}
