// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Server Workspace Tests
// Version: 1.0.0
// Date:    2026-08-14
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies browser-neutral connection, Push/Pull, revision, and pinned-session application
//   workflows.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import type { ContentHashPort, FileAssociation } from "../../src/application/ports/contracts.js";
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
} from "../../src/application/server-contracts.js";
import
{
    beginServerConnection,
    closeActiveServerSession,
    connectServerWorkspace,
    createServerWorkspaceState,
    disconnectServerWorkspace,
    disposeServerWorkspace,
    markServerConnectionLost,
    markServerDocumentChanged,
    pullDocumentFromServer,
    pushDocumentToServer,
    resetActiveServerSession,
    restartServerWorkspace,
    runActiveServerSession,
    startServerSession,
    stepActiveServerSession,
    testServerWorkspace,
} from "../../src/application/server-workspace.js";
import type { ServerWorkspaceState } from "../../src/application/server-workspace.js";
import
{
    commitWorkspaceDocumentCommand,
    createNewDocumentWorkspace,
    createPulledDocumentWorkspace,
    planWorkspaceDocumentCommand,
} from "../../src/application/document-workspace.js";
import type { DocumentWorkspaceState } from "../../src/application/document-workspace.js";
import
{
    serializeCanonicalDocument,
    serializeCanonicalHostedContent,
} from "../../src/domain/model/canonicalization.js";
import type { AutomataDocument } from "../../src/domain/model/contracts.js";
import { validateAuthoringDraft } from "../../src/domain/model/validation.js";
import { AutomataDocumentCodec } from "../../src/infrastructure/files/file-codec.js";
import { loadExampleDocument } from "../model/example-helpers.js";

const FIRST_INSTANCE_ID  = "00000000-0000-4000-8000-000000000001";
const SECOND_INSTANCE_ID = "00000000-0000-4000-8000-000000000002";
const FIRST_SESSION_ID   = "00000000-0000-4000-8000-000000000101";
const SECOND_SESSION_ID  = "00000000-0000-4000-8000-000000000102";
const FIRST_REVISION     = `sha256:${"a".repeat ( 64 )}`;
const SECOND_REVISION    = `sha256:${"b".repeat ( 64 )}`;

const FILE_ASSOCIATION: FileAssociation =
{
    capability:  "capable",
    displayName: "client-document.json",
    identifier:  "client-file-handle",
};

//--------------------------------------------------------------------------------------------------
// Function: successful
//
// Description:
//
//   Creates the successful result.
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

function successful<Value> ( value: Value ): ServerGatewayResult<Value>
{
    // Return the assembled result.

    return { isSuccessful: true, value };
}

//--------------------------------------------------------------------------------------------------
// Function: failed
//
// Description:
//
//   Derives the failed.
//
// Parameters:
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

function failed<Value> ( failure: ServerGatewayFailure ): ServerGatewayResult<Value>
{
    // Return the assembled result.

    return { isSuccessful: false, failure };
}

//--------------------------------------------------------------------------------------------------
// Function: createSession
//
// Description:
//
//   Creates session for the test scenario.
//
// Parameters:
//
//   - modelRevision:
//     The model revision supplied to the operation.
//
//   - sessionId:
//     The session identifier supplied to the operation.
//
//   - isStale:
//     The is stale supplied to the operation.
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

function createSession (
    modelRevision = FIRST_REVISION,
    sessionId     = FIRST_SESSION_ID,
    isStale       = false,
): HostedSessionDto
{
    // Return the assembled result.

    return {
        actionTrace:                [],
        currentState:               "state_idle",
        initialEntryActionsPending: true,
        isStale,
        modelRevision,
        processedEventCount:        0,
        sessionId,
        traceTruncated:             false,
        transitionTrace:            [],
    };
}

//--------------------------------------------------------------------------------------------------
// Class: TestContentHasher
//
// Description:
//
//   Implements the test content hasher behavior.
//
//--------------------------------------------------------------------------------------------------

class TestContentHasher implements ContentHashPort
{
    //----------------------------------------------------------------------------------------------
    // Method: hashCanonicalText
    //
    // Description:
    //
    //   Hashes the canonical text.
    //
    // Parameters:
    //
    //   - canonicalText:
    //     The canonical text supplied to the operation.
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

    public async hashCanonicalText ( canonicalText: string ): Promise<string>
    {
        // Return the computed result.

        return `sha256:${createHash ( "sha256" ).update ( canonicalText ).digest ( "hex" )}`;
    }
}

//--------------------------------------------------------------------------------------------------
// Class: RecordingServerGateway
//
// Description:
//
//   Implements the recording server gateway behavior.
//
//--------------------------------------------------------------------------------------------------

class RecordingServerGateway implements ServerGateway
{
    public readonly connectUrls: string[] = [];
    public readonly putRequests: ConditionalHostedDocumentPut[] = [];
    public readonly runRequests: HostedSessionEventRequest[] = [];
    public readonly stepRequests: HostedSessionEventRequest[] = [];
    public readonly resetSessionIdentifiers: string[] = [];
    public readonly closedSessionIdentifiers: string[] = [];

    public connectResult: ServerGatewayResult<ServerConnectionDescription> = successful (
        { instanceId: FIRST_INSTANCE_ID, isReady: true, modelRevision: FIRST_REVISION },
    );
    public disconnectResult: ServerGatewayResult<void> = successful ( undefined );
    public testResult: ServerGatewayResult<ServerTestResult> = successful (
        { instanceId: FIRST_INSTANCE_ID, isLive: true, isReady: true, modelRevision: FIRST_REVISION },
    );
    public getResult: ServerGatewayResult<HostedDocumentDto> = successful (
        { canonicalDocument: { text: "" }, modelRevision: FIRST_REVISION },
    );
    public putResult: ServerGatewayResult<HostedDocumentPutResult> = successful (
        { isIdempotent: false, modelRevision: FIRST_REVISION },
    );
    public startResult: ServerGatewayResult<HostedSessionDto> = successful ( createSession () );
    public runResult: ServerGatewayResult<HostedSessionOperationResult> = successful (
        { consumedEventCount: 0, emittedActions: [], session: createSession (), warnings: [] },
    );
    public stepResult: ServerGatewayResult<HostedSessionOperationResult> = this.runResult;
    public resetResult: ServerGatewayResult<HostedSessionDto> = successful ( createSession () );
    public closeResult: ServerGatewayResult<void> = successful ( undefined );
    public restartResult: ServerGatewayResult<ServerConnectionDescription> = successful (
        { instanceId: SECOND_INSTANCE_ID, isReady: true, modelRevision: SECOND_REVISION },
    );
    public disposeResult: ServerGatewayResult<void> = successful ( undefined );

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
        this.connectUrls.push ( serverUrl );

        // Return the computed result.

        return this.connectResult;
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
        // Return the computed result.

        return this.disconnectResult;
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
        // Return the computed result.

        return this.testResult;
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
        // Return the computed result.

        return this.getResult;
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
        this.putRequests.push ( request );

        // Return the computed result.

        return this.putResult;
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
        // Return the computed result.

        return this.startResult;
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

    public async runSession (
        request: HostedSessionEventRequest,
    ): Promise<ServerGatewayResult<HostedSessionOperationResult>>
    {
        this.runRequests.push ( request );

        // Return the computed result.

        return this.runResult;
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

    public async stepSession (
        request: HostedSessionEventRequest,
    ): Promise<ServerGatewayResult<HostedSessionOperationResult>>
    {
        this.stepRequests.push ( request );

        // Return the computed result.

        return this.stepResult;
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
        this.resetSessionIdentifiers.push ( sessionId );

        // Return the computed result.

        return this.resetResult;
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
        this.closedSessionIdentifiers.push ( sessionId );

        // Return the computed result.

        return this.closeResult;
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
        // Return the computed result.

        return this.restartResult;
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
        // Return the computed result.

        return this.disposeResult;
    }
}

//--------------------------------------------------------------------------------------------------
// Function: connectedServerWorkspace
//
// Description:
//
//   Derives the connected server workspace.
//
// Parameters:
//
//   - modelRevision:
//     The model revision supplied to the operation.
//
//   - activeSession:
//     The active session supplied to the operation.
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

function connectedServerWorkspace (
    modelRevision: string | null = FIRST_REVISION,
    activeSession: ServerWorkspaceState["activeSession"] = null,
): ServerWorkspaceState
{
    // Return the assembled result.

    return {
        activeSession,
        connectionStatus:        "connected",
        instanceId:              FIRST_INSTANCE_ID,
        lastKnownHostedRevision: modelRevision,
        readinessStatus:         "ready",
        synchronizationStatus:   "unknown",
    };
}

//--------------------------------------------------------------------------------------------------
// Function: semanticRevision
//
// Description:
//
//   Derives the semantic revision.
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

async function semanticRevision (
    document: AutomataDocument,
    contentHasher: ContentHashPort,
): Promise<string>
{
    // Return the hash canonical text result.

    return contentHasher.hashCanonicalText ( serializeCanonicalHostedContent ( document ) );
}

//--------------------------------------------------------------------------------------------------
// Function: createDirtyWorkspace
//
// Description:
//
//   Creates dirty workspace for the test scenario.
//
// Parameters:
//
//   - document:
//     The document to process.
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

function createDirtyWorkspace ( document: AutomataDocument ): DocumentWorkspaceState
{
    // Initialize the local values needed by this operation.

    const cleanWorkspace = createPulledDocumentWorkspace ( document );
    const editorState    = cleanWorkspace.editorState;

    // Handle the case where editor state matches an absent value.

    if ( editorState === null )
    {
        throw new Error ( "The test document workspace must be open." );
    }

    const planResult = planWorkspaceDocumentCommand (
        cleanWorkspace,
        {
            expectedRevision: editorState.documentRevision,
            kind:             "update_document_settings",
            settings:         { ...editorState.draft.settings, description: "Locally edited" },
        },
    );

    // Handle the case where the plan result is successful condition is not satisfied.

    if ( !planResult.isSuccessful )
    {
        throw new Error ( planResult.message );
    }

    const commandResult = commitWorkspaceDocumentCommand ( cleanWorkspace, planResult.plan );

    // Handle the case where the command result is successful condition is not satisfied.

    if ( !commandResult.isSuccessful )
    {
        throw new Error ( commandResult.message );
    }

    // Return the assembled result.

    return {
        ...commandResult.workspace,
        association:      FILE_ASSOCIATION,
        displayName:      FILE_ASSOCIATION.displayName,
        previousDocument: serializeCanonicalDocument ( document ),
    };
}

//--------------------------------------------------------------------------------------------------
// Function: validatedWorkspaceDocument
//
// Description:
//
//   Derives the validated workspace document.
//
// Parameters:
//
//   - workspace:
//     The workspace supplied to the operation.
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

function validatedWorkspaceDocument ( workspace: DocumentWorkspaceState ): AutomataDocument
{
    // Handle the case where workspace editor state matches an absent value.

    if ( workspace.editorState === null )
    {
        throw new Error ( "The test document workspace must be open." );
    }

    const validation = validateAuthoringDraft ( workspace.editorState.draft );

    // Handle the case where the validation is valid condition is not satisfied.

    if ( !validation.isValid )
    {
        throw new Error ( "The test document workspace must contain a valid document." );
    }

    // Return the computed result.

    return validation.document;
}

describe ( "Phase 7 server workspace", () =>
{
    it ( "connects, preserves a same-instance session, and clears it when the instance changes", async () =>
    {
        // Initialize the local values needed by this operation.

        const gateway = new RecordingServerGateway ();
        const initial = createServerWorkspaceState ();

        expect ( beginServerConnection ( initial ).connectionStatus ).toBe ( "connecting" );

        const connected = await connectServerWorkspace ( initial, gateway, "builtin://server" );

        expect ( connected.isSuccessful ).toBe ( true );

        // Handle the case where the connected is successful condition is not satisfied.

        if ( !connected.isSuccessful )
        {
            // Return control to the caller.

            return;
        }

        const synchronized = { ...connected.serverWorkspace, synchronizationStatus: "synchronized" as const };

        expect ( markServerDocumentChanged ( synchronized ).synchronizationStatus ).toBe ( "diverged" );

        const tested = await testServerWorkspace ( connected.serverWorkspace, gateway );

        expect ( tested.isSuccessful ).toBe ( true );

        const started = await startServerSession ( connected.serverWorkspace, gateway );

        expect ( started.isSuccessful ).toBe ( true );

        // Handle the case where the started is successful condition is not satisfied.

        if ( !started.isSuccessful )
        {
            // Return control to the caller.

            return;
        }

        const disconnected = await disconnectServerWorkspace ( started.serverWorkspace, gateway );

        expect ( disconnected.isSuccessful ).toBe ( true );

        // Handle the case where the disconnected is successful condition is not satisfied.

        if ( !disconnected.isSuccessful )
        {
            // Return control to the caller.

            return;
        }

        expect ( disconnected.serverWorkspace.activeSession?.sessionId ).toBe ( FIRST_SESSION_ID );
        gateway.connectResult = successful (
            { instanceId: FIRST_INSTANCE_ID, isReady: true, modelRevision: SECOND_REVISION },
        );

        const sameInstance = await connectServerWorkspace (
            disconnected.serverWorkspace,
            gateway,
            "builtin://server",
        );

        expect ( sameInstance.isSuccessful ).toBe ( true );

        // Handle the case where the same instance is successful condition is not satisfied.

        if ( !sameInstance.isSuccessful )
        {
            // Return control to the caller.

            return;
        }

        expect ( sameInstance.serverWorkspace.activeSession ).toMatchObject ( { isStale: true } );
        gateway.connectResult = successful (
            { instanceId: SECOND_INSTANCE_ID, isReady: true, modelRevision: SECOND_REVISION },
        );

        const newInstance = await connectServerWorkspace ( sameInstance.serverWorkspace, gateway, "builtin://server" );

        expect ( newInstance.isSuccessful ).toBe ( true );

        // Handle the case where new instance is successful is enabled.

        if ( newInstance.isSuccessful )
        {
            expect ( newInstance.serverWorkspace.activeSession ).toBeNull ();
            expect ( newInstance.serverWorkspace.instanceId ).toBe ( SECOND_INSTANCE_ID );
        }

        expect ( gateway.connectUrls ).toEqual ( [ "builtin://server", "builtin://server", "builtin://server" ] );
    } );

    it ( "clears server identity after destructive loss while intentional Disconnect preserves it", async () =>
    {
        // Initialize the local values needed by this operation.

        const gateway   = new RecordingServerGateway ();
        const connected = connectedServerWorkspace (
            FIRST_REVISION,
            { isStale: false, modelRevision: FIRST_REVISION, sessionId: FIRST_SESSION_ID },
        );
        const synchronized = { ...connected, synchronizationStatus: "synchronized" as const };
        const lost         = markServerConnectionLost ( synchronized );

        expect ( lost ).toEqual ( createServerWorkspaceState () );

        const disconnected = await disconnectServerWorkspace ( synchronized, gateway );

        expect ( disconnected ).toMatchObject (
            {
                isSuccessful: true,
                serverWorkspace:
                {
                    activeSession:           synchronized.activeSession,
                    connectionStatus:        "disconnected",
                    instanceId:              FIRST_INSTANCE_ID,
                    lastKnownHostedRevision: FIRST_REVISION,
                    readinessStatus:         "unknown",
                    synchronizationStatus:   "synchronized",
                },
            },
        );
    } );

    it ( "fails closed when Connect returns a malformed connection description", async () =>
    {
        // Initialize the local values needed by this operation.

        const gateway           = new RecordingServerGateway ();
        const previousWorkspace = connectedServerWorkspace (
            FIRST_REVISION,
            { isStale: false, modelRevision: FIRST_REVISION, sessionId: FIRST_SESSION_ID },
        );

        gateway.connectResult = successful (
            { instanceId: "not-an-instance-id", isReady: true, modelRevision: FIRST_REVISION },
        );

        const result = await connectServerWorkspace (
            beginServerConnection ( previousWorkspace ),
            gateway,
            "builtin://server",
        );

        expect ( result ).toMatchObject ( { isSuccessful: false, failure: { code: "SERVER_RESPONSE_INVALID" } } );
        expect ( result.serverWorkspace ).toEqual ( createServerWorkspaceState () );
    } );

    it ( "validates and canonically pushes the complete document without changing client state", async () =>
    {
        // Initialize the local values needed by this operation.

        const contentHasher     = new TestContentHasher ();
        const document          = loadExampleDocument ( "state-machine-comprehensive.json" );
        const documentWorkspace = createDirtyWorkspace ( document );
        const expectedRevision  = await semanticRevision ( validatedWorkspaceDocument ( documentWorkspace ), contentHasher );
        const gateway           = new RecordingServerGateway ();
        const serverWorkspace   = connectedServerWorkspace (
            FIRST_REVISION,
            { isStale: false, modelRevision: FIRST_REVISION, sessionId: FIRST_SESSION_ID },
        );

        gateway.putResult = successful ( { isIdempotent: false, modelRevision: expectedRevision } );

        const result = await pushDocumentToServer (
            serverWorkspace,
            documentWorkspace,
            gateway,
            contentHasher,
        );

        expect ( result.isSuccessful ).toBe ( true );
        expect ( result.documentWorkspace ).toBe ( documentWorkspace );
        expect ( result.documentWorkspace.editorState ).toBe ( documentWorkspace.editorState );
        expect ( gateway.putRequests ).toHaveLength ( 1 );
        expect ( gateway.putRequests [ 0 ]?.expectedModelRevision ).toBe ( FIRST_REVISION );
        expect ( gateway.putRequests [ 0 ]?.canonicalDocument ).toEqual (
            serializeCanonicalDocument ( validatedWorkspaceDocument ( documentWorkspace ) ),
        );

        const pushedJson = JSON.parse ( gateway.putRequests [ 0 ]?.canonicalDocument.text ?? "{}" ) as Record<string, unknown>;

        expect ( Object.keys ( pushedJson ) ).toEqual (
            [ "file_id", "file_version", "settings", "state_machine", "chart", "solver", "simulator" ],
        );

        // Handle the case where result is successful is enabled.

        if ( result.isSuccessful )
        {
            expect ( result.serverWorkspace.lastKnownHostedRevision ).toBe ( expectedRevision );
            expect ( result.serverWorkspace.synchronizationStatus ).toBe ( "synchronized" );
            expect ( result.serverWorkspace.activeSession?.isStale ).toBe ( expectedRevision !== FIRST_REVISION );
        }
    } );

    it ( "blocks invalid or unbased Push before contacting the gateway", async () =>
    {
        // Initialize the local values needed by this operation.

        const gateway       = new RecordingServerGateway ();
        const contentHasher = new TestContentHasher ();
        const invalidResult = await pushDocumentToServer (
            connectedServerWorkspace (),
            createNewDocumentWorkspace ( true ),
            gateway,
            contentHasher,
        );
        const validDocument = loadExampleDocument ( "state-machine-light-switch.json" );
        const unbasedResult = await pushDocumentToServer (
            connectedServerWorkspace ( null ),
            createPulledDocumentWorkspace ( validDocument ),
            gateway,
            contentHasher,
        );

        expect ( invalidResult ).toMatchObject ( { isSuccessful: false, failure: { code: "DOCUMENT_INVALID" } } );
        expect ( unbasedResult ).toMatchObject (
            { isSuccessful: false, failure: { code: "HOSTED_BASELINE_MISSING" } },
        );
        expect ( gateway.putRequests ).toHaveLength ( 0 );
    } );

    it ( "keeps the baseline and document intact when conditional Push conflicts", async () =>
    {
        // Initialize the local values needed by this operation.

        const gateway           = new RecordingServerGateway ();
        const contentHasher     = new TestContentHasher ();
        const documentWorkspace = createPulledDocumentWorkspace (
            loadExampleDocument ( "state-machine-light-switch.json" ),
        );
        const serverWorkspace  = connectedServerWorkspace ( FIRST_REVISION );

        gateway.putResult = failed (
            {
                code:                 "HOSTED_MODEL_CONFLICT",
                currentModelRevision: SECOND_REVISION,
                isRetryable:          false,
                message:              "Revision conflict.",
                remediation:          "Pull and reconcile.",
            },
        );

        const result = await pushDocumentToServer (
            serverWorkspace,
            documentWorkspace,
            gateway,
            contentHasher,
        );

        expect ( result.isSuccessful ).toBe ( false );
        expect ( result.documentWorkspace ).toBe ( documentWorkspace );
        expect ( result.serverWorkspace.lastKnownHostedRevision ).toBe ( FIRST_REVISION );
        expect ( result.serverWorkspace.synchronizationStatus ).toBe ( "conflict" );
    } );

    it ( "retains a semantic revision and fresh session across auxiliary-only and idempotent Pushes", async () =>
    {
        // Initialize the local values needed by this operation.

        const gateway                          = new RecordingServerGateway ();
        const contentHasher                    = new TestContentHasher ();
        const document                         = loadExampleDocument ( "state-machine-comprehensive.json" );
        const modelRevision                    = await semanticRevision ( document, contentHasher );
        const variedDocument: AutomataDocument = 
        {
            ...document,
            chart:
            {
                ...document.chart,
                settings: { expandStates: !document.chart.settings.expandStates },
            },
        };
        const initialServerWorkspace = connectedServerWorkspace (
            modelRevision,
            { isStale: false, modelRevision, sessionId: FIRST_SESSION_ID },
        );

        expect ( await semanticRevision ( variedDocument, contentHasher ) ).toBe ( modelRevision );
        gateway.putResult = successful ( { isIdempotent: false, modelRevision } );

        const auxiliaryResult = await pushDocumentToServer (
            initialServerWorkspace,
            createPulledDocumentWorkspace ( variedDocument ),
            gateway,
            contentHasher,
        );

        expect ( auxiliaryResult.isSuccessful ).toBe ( true );
        expect ( auxiliaryResult.serverWorkspace.activeSession?.isStale ).toBe ( false );

        gateway.putResult = successful ( { isIdempotent: true, modelRevision } );

        const repeatedResult = await pushDocumentToServer (
            auxiliaryResult.serverWorkspace,
            auxiliaryResult.documentWorkspace,
            gateway,
            contentHasher,
        );

        expect ( repeatedResult.isSuccessful ).toBe ( true );

        // Handle the case where repeated result is successful is enabled.

        if ( repeatedResult.isSuccessful )
        {
            expect ( repeatedResult.value.isIdempotent ).toBe ( true );
            expect ( repeatedResult.serverWorkspace.activeSession?.isStale ).toBe ( false );
        }
    } );

    it ( "independently validates Pull and replaces the client with a clean revision-one workspace", async () =>
    {
        // Initialize the local values needed by this operation.

        const gateway           = new RecordingServerGateway ();
        const contentHasher     = new TestContentHasher ();
        const documentCodec     = new AutomataDocumentCodec ();
        const hostedDocument    = loadExampleDocument ( "state-machine-comprehensive.json" );
        const canonicalDocument = serializeCanonicalDocument ( hostedDocument );
        const hostedRevision    = await semanticRevision ( hostedDocument, contentHasher );
        const currentWorkspace  = createDirtyWorkspace (
            loadExampleDocument ( "state-machine-light-switch.json" ),
        );
        const serverWorkspace   = connectedServerWorkspace (
            FIRST_REVISION,
            { isStale: false, modelRevision: FIRST_REVISION, sessionId: FIRST_SESSION_ID },
        );

        gateway.getResult = successful ( { canonicalDocument, modelRevision: hostedRevision } );

        const result = await pullDocumentFromServer (
            serverWorkspace,
            currentWorkspace,
            gateway,
            documentCodec,
            contentHasher,
        );

        expect ( result.isSuccessful ).toBe ( true );
        expect ( result.documentWorkspace ).not.toBe ( currentWorkspace );
        expect ( result.documentWorkspace ).toMatchObject (
            {
                association:      null,
                displayName:      null,
                previousDocument: null,
                validationStatus: "passed",
            },
        );
        expect ( result.documentWorkspace.editorState ).toMatchObject (
            { dirty: false, documentRevision: 1, redoStack: [], undoStack: [] },
        );
        expect ( result.documentWorkspace.editorState?.draft ).toEqual ( hostedDocument );

        // Handle the case where result is successful is enabled.

        if ( result.isSuccessful )
        {
            expect ( result.serverWorkspace.lastKnownHostedRevision ).toBe ( hostedRevision );
            expect ( result.serverWorkspace.synchronizationStatus ).toBe ( "synchronized" );
            expect ( result.serverWorkspace.activeSession?.isStale ).toBe ( hostedRevision !== FIRST_REVISION );
        }
    } );

    it ( "leaves both workspaces untouched when Pull content is invalid, noncanonical, or mis-hashed", async () =>
    {
        // Initialize the local values needed by this operation.

        const contentHasher     = new TestContentHasher ();
        const documentCodec     = new AutomataDocumentCodec ();
        const canonicalDocument = serializeCanonicalDocument (
            loadExampleDocument ( "state-machine-light-switch.json" ),
        );
        const matchingRevision = await semanticRevision (
            loadExampleDocument ( "state-machine-light-switch.json" ),
            contentHasher,
        );
        const currentWorkspace = createDirtyWorkspace (
            loadExampleDocument ( "state-machine-comprehensive.json" ),
        );
        const serverWorkspace = connectedServerWorkspace ( FIRST_REVISION );
        const cases: readonly { readonly hostedDocument: HostedDocumentDto; readonly expectedCode: string }[] =
        [
            {
                expectedCode: "DOCUMENT_INVALID",
                hostedDocument: { canonicalDocument: { text: "{}" }, modelRevision: FIRST_REVISION },
            },
            {
                expectedCode: "PULL_DOCUMENT_NON_CANONICAL",
                hostedDocument:
                {
                    canonicalDocument: { text: JSON.stringify ( JSON.parse ( canonicalDocument.text ) ) },
                    modelRevision: matchingRevision,
                },
            },
            {
                expectedCode: "PULL_REVISION_MISMATCH",
                hostedDocument: { canonicalDocument, modelRevision: SECOND_REVISION },
            },
        ];

        // Process each test case from the cases collection in order.

        for ( const testCase of cases )
        {
            // Initialize the local values needed by this operation.

            const gateway = new RecordingServerGateway ();

            gateway.getResult = successful ( testCase.hostedDocument );

            const result = await pullDocumentFromServer (
                serverWorkspace,
                currentWorkspace,
                gateway,
                documentCodec,
                contentHasher,
            );

            expect ( result ).toMatchObject ( { isSuccessful: false, failure: { code: testCase.expectedCode } } );
            expect ( result.documentWorkspace ).toBe ( currentWorkspace );

            // Handle the case where test case expected code matches "PULL_REVISION_MISMATCH".

            if ( testCase.expectedCode === "PULL_REVISION_MISMATCH" )
            {
                expect ( result.serverWorkspace ).toEqual ( createServerWorkspaceState () );
            }
            else
            {
                // Handle the remaining case after the preceding condition is false.

                expect ( result.serverWorkspace ).toBe ( serverWorkspace );
            }
        }
    } );

    it ( "fails closed after transport loss while preserving connection state for request timeouts", async () =>
    {
        // Initialize the local values needed by this operation.

        const gateway           = new RecordingServerGateway ();
        const contentHasher     = new TestContentHasher ();
        const documentCodec     = new AutomataDocumentCodec ();
        const documentWorkspace = createPulledDocumentWorkspace (
            loadExampleDocument ( "state-machine-light-switch.json" ),
        );
        const serverWorkspace  = connectedServerWorkspace ( FIRST_REVISION );

        gateway.getResult = failed (
            {
                code:        "SERVER_WORKER_FAILED",
                isRetryable: true,
                message:     "The Server Worker stopped unexpectedly.",
                remediation: "Reconnect and retry.",
            },
        );

        const transportFailure = await pullDocumentFromServer (
            serverWorkspace,
            documentWorkspace,
            gateway,
            documentCodec,
            contentHasher,
        );

        expect ( transportFailure ).toMatchObject (
            {
                isSuccessful: false,
                serverWorkspace:
                {
                    activeSession:           null,
                    connectionStatus:        "disconnected",
                    instanceId:              null,
                    lastKnownHostedRevision: null,
                    readinessStatus:         "unknown",
                    synchronizationStatus:   "unknown",
                },
            },
        );
        expect ( transportFailure.documentWorkspace ).toBe ( documentWorkspace );

        gateway.getResult = failed (
            {
                code:        "SERVER_REQUEST_TIMEOUT",
                isRetryable: true,
                message:     "The request timed out.",
                remediation: "Test the connection and retry.",
            },
        );

        const timeoutFailure = await pullDocumentFromServer (
            serverWorkspace,
            documentWorkspace,
            gateway,
            documentCodec,
            contentHasher,
        );

        expect ( timeoutFailure.serverWorkspace ).toBe ( serverWorkspace );
    } );

    it ( "carries bounded session metadata through Run and Reset before closing the active reference", async () =>
    {
        // Initialize the local values needed by this operation.

        const gateway                = new RecordingServerGateway ();
        const initialServerWorkspace = connectedServerWorkspace ( FIRST_REVISION );
        const started                = await startServerSession ( initialServerWorkspace, gateway );

        expect ( started.isSuccessful ).toBe ( true );

        // Handle the case where the started is successful condition is not satisfied.

        if ( !started.isSuccessful )
        {
            // Return control to the caller.

            return;
        }

        gateway.runResult = successful (
            {
                consumedEventCount: 2,
                emittedActions: [ "action_begin" ],
                session:
                {
                    ...createSession (),
                    initialEntryActionsPending: false,
                    processedEventCount:        2,
                    traceTruncated:             true,
                },
                warnings: [],
            },
        );

        // Initialize the local values needed by this operation.

        const eventBuffer = [ "event_start", "event_finish" ];
        const runPromise  = runActiveServerSession ( started.serverWorkspace, gateway, eventBuffer );

        eventBuffer.push ( "event_late_edit" );

        const runResult = await runPromise;

        expect ( runResult.isSuccessful ).toBe ( true );
        expect ( gateway.runRequests [ 0 ] ).toEqual (
            { eventBuffer: [ "event_start", "event_finish" ], sessionId: FIRST_SESSION_ID },
        );

        // Handle the case where the run result is successful condition is not satisfied.

        if ( !runResult.isSuccessful )
        {
            // Return control to the caller.

            return;
        }

        expect ( runResult.value.session.processedEventCount ).toBe ( 2 );
        expect ( runResult.value.session.traceTruncated ).toBe ( true );

        gateway.stepResult = successful (
            {
                consumedEventCount: 1,
                emittedActions:     [],
                session:
                {
                    ...runResult.value.session,
                    processedEventCount: 3,
                },
                warnings: [],
            },
        );

        const stepResult = await stepActiveServerSession (
            runResult.serverWorkspace,
            gateway,
            [ "event_reset", "event_not_consumed" ],
        );

        expect ( stepResult.isSuccessful ).toBe ( true );
        expect ( gateway.stepRequests [ 0 ] ).toEqual (
            { eventBuffer: [ "event_reset", "event_not_consumed" ], sessionId: FIRST_SESSION_ID },
        );

        // Handle the case where the step result is successful condition is not satisfied.

        if ( !stepResult.isSuccessful )
        {
            // Return control to the caller.

            return;
        }

        // Handle the case where active session matches an absent value.

        if ( stepResult.serverWorkspace.activeSession === null )
        {
            throw new Error ( "A successful Step must retain the active session." );
        }

        const staleServerWorkspace: ServerWorkspaceState =
        {
            ...stepResult.serverWorkspace,
            activeSession: { ...stepResult.serverWorkspace.activeSession, isStale: true },
            lastKnownHostedRevision: SECOND_REVISION,
        };

        gateway.resetResult = successful ( createSession ( FIRST_REVISION, FIRST_SESSION_ID, true ) );

        const resetResult = await resetActiveServerSession ( staleServerWorkspace, gateway );

        expect ( resetResult.isSuccessful ).toBe ( true );
        expect ( resetResult.serverWorkspace.activeSession ).toMatchObject (
            { isStale: true, modelRevision: FIRST_REVISION },
        );

        const closeResult = await closeActiveServerSession ( resetResult.serverWorkspace, gateway );

        expect ( closeResult.isSuccessful ).toBe ( true );
        expect ( closeResult.serverWorkspace.activeSession ).toBeNull ();
        expect ( gateway.resetSessionIdentifiers ).toEqual ( [ FIRST_SESSION_ID ] );
        expect ( gateway.closedSessionIdentifiers ).toEqual ( [ FIRST_SESSION_ID ] );
    } );

    it ( "clears sessions and cached hosted state when restart and disposal complete", async () =>
    {
        // Initialize the local values needed by this operation.

        const gateway         = new RecordingServerGateway ();
        const serverWorkspace = connectedServerWorkspace (
            FIRST_REVISION,
            { isStale: false, modelRevision: FIRST_REVISION, sessionId: SECOND_SESSION_ID },
        );
        const restarted = await restartServerWorkspace ( serverWorkspace, gateway );

        expect ( restarted.isSuccessful ).toBe ( true );

        // Handle the case where the restarted is successful condition is not satisfied.

        if ( !restarted.isSuccessful )
        {
            // Return control to the caller.

            return;
        }

        expect ( restarted.serverWorkspace.activeSession ).toBeNull ();
        expect ( restarted.serverWorkspace.instanceId ).toBe ( SECOND_INSTANCE_ID );

        const disposed = await disposeServerWorkspace ( restarted.serverWorkspace, gateway );

        expect ( disposed ).toEqual (
            { isSuccessful: true, serverWorkspace: createServerWorkspaceState (), value: undefined },
        );
    } );
} );
