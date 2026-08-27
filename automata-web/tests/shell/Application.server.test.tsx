// @vitest-environment jsdom
// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Application Server Shell Tests
// Version: 1.0.0
// Date:    2026-08-14
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies connection, hosted-document, dirty-replacement, status, diagnostic, and lifecycle
//   shell wiring.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { createHash, webcrypto } from "node:crypto";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Application } from "../../src/Application.js";
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
    serializeCanonicalDocument,
    serializeCanonicalHostedContent,
} from "../../src/domain/model/canonicalization.js";
import type { AutomataDocument, CanonicalSerializedDocument } from "../../src/domain/model/contracts.js";
import { createEmptyAuthoringDraft } from "../../src/domain/model/drafts.js";
import { AutomataDocumentCodec } from "../../src/infrastructure/files/file-codec.js";
import { PREFERENCE_STORAGE_KEY } from "../../src/infrastructure/preferences/index.js";
import { BrowserServerWorkerGateway } from "../../src/infrastructure/server/index.js";

const SERVER_INSTANCE_ID = "00000000-0000-4000-8000-000000000001";
const SESSION_ID         = "00000000-0000-4000-8000-000000000101";

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
// Interface: Deferred
//
// Description:
//
//   Defines the structure of deferred.
//
//--------------------------------------------------------------------------------------------------

interface Deferred<Value>
{
    readonly promise: Promise<Value>;
    readonly resolve: ( value: Value ) => void;
}

//--------------------------------------------------------------------------------------------------
// Function: createDeferred
//
// Description:
//
//   Creates deferred for the test scenario.
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

function createDeferred<Value> (): Deferred<Value>
{
    //----------------------------------------------------------------------------------------------
    // Function: resolvePromise
    //
    // Description:
    //
    //   Resolves promise.
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

    let resolvePromise: ( value: Value ) => void = () => undefined;
    const promise                               = new Promise<Value> ( resolve =>
    {
        resolvePromise = resolve;
    } );

    // Return the assembled result.

    return { promise, resolve: resolvePromise };
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

function semanticRevision ( document: AutomataDocument ): string
{
    // Initialize the local values needed by this operation.

    const canonicalContent = serializeCanonicalHostedContent ( document );

    // Return the computed result.

    return `sha256:${createHash ( "sha256" ).update ( canonicalContent ).digest ( "hex" )}`;
}

//--------------------------------------------------------------------------------------------------
// Function: createHostedDocument
//
// Description:
//
//   Creates hosted document for the test scenario.
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

function createHostedDocument (): AutomataDocument
{
    // Initialize the local values needed by this operation.

    const emptyDraft = createEmptyAuthoringDraft ();

    // Return the assembled result.

    return {
        ...emptyDraft,
        settings:
        {
            ...emptyDraft.settings,
            name: "Hosted State Machine",
        },
        stateMachine:
        {
            ...emptyDraft.stateMachine,
            initialState: "state_idle",
            states:       [ { description: "Idle state", name: "state_idle" } ],
        },
    };
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

function createSession ( modelRevision: string ): HostedSessionDto
{
    // Return the assembled result.

    return {
        actionTrace:                [],
        currentState:               "state_idle",
        initialEntryActionsPending: true,
        isStale:                    false,
        modelRevision,
        processedEventCount:        0,
        sessionId:                  SESSION_ID,
        traceTruncated:             false,
        transitionTrace:            [],
    };
}

//--------------------------------------------------------------------------------------------------
// Class: ShellServerGateway
//
// Description:
//
//   Implements the shell server gateway behavior.
//
//--------------------------------------------------------------------------------------------------

class ShellServerGateway extends BrowserServerWorkerGateway implements ServerGateway
{
    public readonly connectUrls: string[] = [];
    public readonly putRequests: ConditionalHostedDocumentPut[] = [];

    public connectFailure: ServerGatewayFailure | null = null;
    public disconnectCount = 0;
    public disposeCount    = 0;
    public getCompletion: Promise<void> | null = null;
    public getCount        = 0;
    public getFailure: ServerGatewayFailure | null = null;
    public putCompletion: Promise<void> | null = null;
    public testCount       = 0;

    private canonicalDocument: CanonicalSerializedDocument;
    private connectionLostHandler: ( ( failure: ServerGatewayFailure ) => void ) | undefined;
    private modelRevision:     string;

    //----------------------------------------------------------------------------------------------
    // Constructor: ShellServerGateway
    //
    // Description:
    //
    //   Initializes a ShellServerGateway instance.
    //
    // Parameters:
    //
    //   - document:
    //     The document to process.
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

    public constructor ( document = createHostedDocument () )
    {
        super ();

        this.canonicalDocument = serializeCanonicalDocument ( document );
        this.modelRevision     = semanticRevision ( document );
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

    public override async connect ( serverUrl: string ): Promise<ServerGatewayResult<ServerConnectionDescription>>
    {
        this.connectUrls.push ( serverUrl );

        // Return the result selected by the current condition.

        return this.connectFailure === null
            ? successful ( this.connectionDescription () )
            : { failure: this.connectFailure, isSuccessful: false };
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

    public override async disconnect (): Promise<ServerGatewayResult<void>>
    {
        this.disconnectCount++;

        // Return the successful result.

        return successful ( undefined );
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

    public override async test (): Promise<ServerGatewayResult<ServerTestResult>>
    {
        this.testCount++;

        // Return the successful result.

        return successful ( { ...this.connectionDescription (), isLive: true } );
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

    public override async getHostedDocument (): Promise<ServerGatewayResult<HostedDocumentDto>>
    {
        this.getCount++;

        const getCompletion = this.getCompletion;

        this.getCompletion = null;

        // Handle the case where get completion differs from an absent value.

        if ( getCompletion !== null )
        {
            await getCompletion;
        }

        // Handle the case where get failure differs from an absent value.

        if ( this.getFailure !== null )
        {
            // Initialize the local values needed by this operation.

            const getFailure = this.getFailure;

            this.getFailure = null;

            // Return the assembled result.

            return { failure: getFailure, isSuccessful: false };
        }

        // Return the successful result.

        return successful (
            { canonicalDocument: this.canonicalDocument, modelRevision: this.modelRevision },
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

    public override async putHostedDocument (
        request: ConditionalHostedDocumentPut,
    ): Promise<ServerGatewayResult<HostedDocumentPutResult>>
    {
        this.putRequests.push ( request );

        const putCompletion = this.putCompletion;

        this.putCompletion = null;

        // Handle the case where put completion differs from an absent value.

        if ( putCompletion !== null )
        {
            await putCompletion;
        }

        // Initialize the local values needed by this operation.

        const isIdempotent = request.canonicalDocument.text === this.canonicalDocument.text;
        const codec        = new AutomataDocumentCodec ();
        const decoded      = codec.open ( request.canonicalDocument.text );

        // Handle the case where the decoded is successful condition is not satisfied.

        if ( !decoded.isSuccessful )
        {
            throw new Error ( "The shell test received a non-decodable Push document." );
        }

        this.canonicalDocument = request.canonicalDocument;
        this.modelRevision     = semanticRevision ( decoded.document );

        // Return the successful result.

        return successful ( { isIdempotent, modelRevision: this.modelRevision } );
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

    public override async startSession (): Promise<ServerGatewayResult<HostedSessionDto>>
    {
        // Return the successful result.

        return successful ( createSession ( this.modelRevision ) );
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
    //   - _request:
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

    public override async runSession (
        _request: HostedSessionEventRequest,
    ): Promise<ServerGatewayResult<HostedSessionOperationResult>>
    {
        // Return the successful result.

        return successful ( this.sessionOperation () );
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
    //   - _request:
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

    public override async stepSession (
        _request: HostedSessionEventRequest,
    ): Promise<ServerGatewayResult<HostedSessionOperationResult>>
    {
        // Return the successful result.

        return successful ( this.sessionOperation () );
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
    //   - _sessionId:
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

    public override async resetSession ( _sessionId: string ): Promise<ServerGatewayResult<HostedSessionDto>>
    {
        // Return the successful result.

        return successful ( createSession ( this.modelRevision ) );
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
    //   - _sessionId:
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

    public override async closeSession ( _sessionId: string ): Promise<ServerGatewayResult<void>>
    {
        // Return the successful result.

        return successful ( undefined );
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

    public override async restart (): Promise<ServerGatewayResult<ServerConnectionDescription>>
    {
        // Return the successful result.

        return successful ( this.connectionDescription () );
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

    public override async dispose (): Promise<ServerGatewayResult<void>>
    {
        this.disposeCount++;

        // Return the successful result.

        return successful ( undefined );
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

    public override setConnectionLostHandler (
        handler: ( ( failure: ServerGatewayFailure ) => void ) | undefined,
    ): void
    {
        this.connectionLostHandler = handler;
    }

    //----------------------------------------------------------------------------------------------
    // Method: simulateConnectionLoss
    //
    // Description:
    //
    //   Handles the simulate connection loss behavior.
    //
    // Parameters:
    //
    //   - failure:
    //     The failure supplied to the operation.
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

    public simulateConnectionLoss ( failure: ServerGatewayFailure ): void
    {
        this.connectionLostHandler?.( failure );
    }

    //----------------------------------------------------------------------------------------------
    // Method: connectionDescription
    //
    // Description:
    //
    //   Derives the connection description.
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

    private connectionDescription (): ServerConnectionDescription
    {
        // Return the assembled result.

        return {
            instanceId:    SERVER_INSTANCE_ID,
            isReady:       true,
            modelRevision: this.modelRevision,
        };
    }

    //----------------------------------------------------------------------------------------------
    // Method: sessionOperation
    //
    // Description:
    //
    //   Derives the session operation.
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

    private sessionOperation (): HostedSessionOperationResult
    {
        // Return the assembled result.

        return {
            consumedEventCount: 0,
            emittedActions:     [],
            session:            createSession ( this.modelRevision ),
            warnings:           [],
        };
    }
}

//--------------------------------------------------------------------------------------------------
// Function: toolbarButton
//
// Description:
//
//   Derives the toolbar button.
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

function toolbarButton ( identifier: string ): HTMLButtonElement
{
    // Initialize the local values needed by this operation.

    const button = document.querySelector<HTMLButtonElement> ( `[data-toolbar-entry='${identifier}']` );

    // Handle the case where button matches an absent value.

    if ( button === null )
    {
        throw new Error ( `The '${identifier}' toolbar button was not rendered.` );
    }

    // Return the button.

    return button;
}

// Editor's children are hidden while Editor is closed, and Editor stays closed unless something
// selects one of them. A test that reaches a child page through the tree therefore opens Editor
// first, exactly as a user would.

//--------------------------------------------------------------------------------------------------
// Function: openEditorNode
//
// Description:
//
//   Opens the editor node.
//
// Parameters:
//
//   - user:
//     The user supplied to the operation.
//
// Returns:
//
//   A promise that resolves when the operation is complete.
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

async function openEditorNode ( user: ReturnType<typeof userEvent.setup> ): Promise<void>
{
    // Initialize the local values needed by this operation.

    const editorNode = screen.getByRole ( "treeitem", { name: "Editor" } );

    // Handle the case where get attribute result matches "true".

    if ( editorNode.getAttribute ( "aria-expanded" ) === "true" )
    {
        // Return control to the caller.

        return;
    }

    await user.click ( editorNode );
    await user.keyboard ( "{ArrowRight}" );
}

describe ( "Phase 7 application server shell", () =>
{
    beforeEach ( () =>
    {
        window.localStorage.clear ();
        Object.defineProperty ( globalThis, "crypto", { configurable: true, value: webcrypto } );
    } );

    afterEach ( cleanup );

    it ( "auto-connects, reflects status, and keeps File and toolbar availability in parity", async () =>
    {
        // Initialize the local values needed by this operation.

        const user    = userEvent.setup ();
        const gateway = new ShellServerGateway ();

        render ( <Application serverGateway={ gateway } /> );

        await waitFor ( () => expect ( gateway.connectUrls ).toEqual ( [ "builtin://server" ] ) );
        expect ( within ( screen.getByRole ( "contentinfo", { name: "Application status" } ) )
            .getByText ( "Connected" ) ).toBeVisible ();
        expect ( toolbarButton ( "toolbar-pull" ) ).toBeEnabled ();
        expect ( toolbarButton ( "toolbar-push" ) ).toBeDisabled ();

        await user.click ( screen.getByRole ( "menuitem", { name: "File" } ) );
        expect ( screen.getByRole ( "menuitem", { name: "Pull Model from Server" } ) ).toBeEnabled ();
        expect ( screen.getByRole ( "menuitem", { name: "Push Model to Server" } ) ).toBeDisabled ();
        expect ( screen.getByRole ( "menuitem", { name: "Connect to Server" } ) ).toBeDisabled ();
        expect ( screen.getByRole ( "menuitem", { name: "Disconnect from Server" } ) ).toBeEnabled ();
        expect ( screen.getByRole ( "menuitem", { name: "Test Server" } ) ).toBeEnabled ();

        await user.click ( screen.getByRole ( "menuitem", { name: "Test Server" } ) );
        await waitFor ( () => expect ( gateway.testCount ).toBe ( 1 ) );

        await user.click ( screen.getByRole ( "menuitem", { name: "File" } ) );
        await user.click ( screen.getByRole ( "menuitem", { name: "Disconnect from Server" } ) );
        await waitFor ( () => expect ( gateway.disconnectCount ).toBe ( 1 ) );
        expect ( within ( screen.getByRole ( "contentinfo", { name: "Application status" } ) )
            .getByText ( "Disconnected" ) ).toBeVisible ();
        expect ( toolbarButton ( "toolbar-pull" ) ).toBeDisabled ();

        await user.click ( screen.getByRole ( "menuitem", { name: "File" } ) );
        await user.click ( screen.getByRole ( "menuitem", { name: "Connect to Server" } ) );
        await waitFor ( () => expect ( gateway.connectUrls ).toHaveLength ( 2 ) );
        expect ( within ( screen.getByRole ( "contentinfo", { name: "Application status" } ) )
            .getByText ( "Connected" ) ).toBeVisible ();
    } );

    it ( "pulls a clean document, pushes canonically, and protects a dirty Pull replacement", async () =>
    {
        // Initialize the local values needed by this operation.

        const user    = userEvent.setup ();
        const gateway = new ShellServerGateway ();

        render ( <Application serverGateway={ gateway } /> );
        await waitFor ( () => expect ( toolbarButton ( "toolbar-pull" ) ).toBeEnabled () );

        await user.click ( toolbarButton ( "toolbar-pull" ) );
        await waitFor ( () => expect ( gateway.getCount ).toBe ( 1 ) );

        const hostedModelGroup = screen.getByRole ( "group", { name: "Hosted Model" } );

        expect ( within ( hostedModelGroup ).getByText ( "Current" ) ).toBeVisible ();
        expect ( within ( hostedModelGroup ).getByText ( /^sha256:/u ) ).toBeVisible ();
        expect ( toolbarButton ( "toolbar-push" ) ).toBeEnabled ();

        await user.click ( screen.getByRole ( "menuitem", { name: "File" } ) );
        expect ( screen.getByRole ( "menuitem", { name: "Pull Model from Server" } ) ).toBeEnabled ();
        expect ( screen.getByRole ( "menuitem", { name: "Push Model to Server" } ) ).toBeEnabled ();
        await user.click ( screen.getByRole ( "menuitem", { name: "Push Model to Server" } ) );
        await waitFor ( () => expect ( gateway.putRequests ).toHaveLength ( 1 ) );
        expect ( gateway.putRequests [ 0 ]?.canonicalDocument.text ).toContain ( '"state_machine"' );
        expect ( screen.getByText ( "HOSTED_MODEL_UNCHANGED" ) ).toBeVisible ();

        await user.click ( toolbarButton ( "toolbar-chart" ) );
        await user.click ( toolbarButton ( "toolbar-expand-chart-states" ) );
        await user.click ( toolbarButton ( "toolbar-pull" ) );

        expect ( screen.getByRole ( "dialog", { name: "Unsaved changes" } ) ).toBeVisible ();
        expect ( gateway.getCount ).toBe ( 1 );

        await user.click ( screen.getByRole ( "button", { name: "Discard and Continue" } ) );
        await waitFor ( () => expect ( gateway.getCount ).toBe ( 2 ) );
        expect ( screen.queryByRole ( "dialog", { name: "Unsaved changes" } ) ).not.toBeInTheDocument ();
        expect ( screen.getAllByText ( "HOSTED_MODEL_PULLED" ) ).toHaveLength ( 2 );
    } );

    it ( "preserves a newer client edit when Pull completes from an older document snapshot", async () =>
    {
        // Initialize the local values needed by this operation.

        const user           = userEvent.setup ();
        const gateway        = new ShellServerGateway ();
        const pullCompletion = createDeferred<void> ();

        render ( <Application serverGateway={ gateway } /> );
        await waitFor ( () => expect ( toolbarButton ( "toolbar-pull" ) ).toBeEnabled () );
        await user.click ( toolbarButton ( "toolbar-pull" ) );
        await waitFor ( () => expect ( gateway.getCount ).toBe ( 1 ) );
        await openEditorNode ( user );
        await user.click ( screen.getByRole ( "treeitem", { name: "State Machine" } ) );

        gateway.getCompletion = pullCompletion.promise;
        await user.click ( toolbarButton ( "toolbar-pull" ) );
        await waitFor ( () => expect ( gateway.getCount ).toBe ( 2 ) );

        const nameEditor = screen.getByRole ( "textbox", { name: "Name" } );

        await user.clear ( nameEditor );
        await user.type ( nameEditor, "Newer Local Pull Edit" );
        await user.tab ();
        pullCompletion.resolve ( undefined );

        await waitFor ( () => expect ( screen.getByText ( "HOSTED_MODEL_PULL_SUPERSEDED" ) ).toBeVisible () );
        expect ( screen.getByRole ( "textbox", { name: "Name" } ) ).toHaveValue ( "Newer Local Pull Edit" );
        expect ( screen.getByRole ( "dialog", { name: "Warning" } ) ).toHaveTextContent (
            "The newer client document was preserved",
        );

        await user.click ( screen.getByRole ( "button", { name: "OK" } ) );
        await user.click ( screen.getByRole ( "treeitem", { name: "Editor" } ) );
        expect ( within ( screen.getByRole ( "group", { name: "Hosted Model" } ) )
            .getByText ( "Local changes" ) ).toBeVisible ();
    } );

    it ( "keeps a newer client edit diverged when Push completes from an older document snapshot", async () =>
    {
        // Initialize the local values needed by this operation.

        const user           = userEvent.setup ();
        const gateway        = new ShellServerGateway ();
        const pushCompletion = createDeferred<void> ();

        render ( <Application serverGateway={ gateway } /> );
        await waitFor ( () => expect ( toolbarButton ( "toolbar-pull" ) ).toBeEnabled () );
        await user.click ( toolbarButton ( "toolbar-pull" ) );
        await waitFor ( () => expect ( gateway.getCount ).toBe ( 1 ) );
        await openEditorNode ( user );
        await user.click ( screen.getByRole ( "treeitem", { name: "State Machine" } ) );

        const nameEditor = screen.getByRole ( "textbox", { name: "Name" } );

        await user.clear ( nameEditor );
        await user.type ( nameEditor, "Captured Push Edit" );
        await user.tab ();

        gateway.putCompletion = pushCompletion.promise;
        await user.click ( toolbarButton ( "toolbar-push" ) );
        await waitFor ( () => expect ( gateway.putRequests ).toHaveLength ( 1 ) );

        const pendingNameEditor = screen.getByRole ( "textbox", { name: "Name" } );

        await user.clear ( pendingNameEditor );
        await user.type ( pendingNameEditor, "Newer Local Push Edit" );
        await user.tab ();
        pushCompletion.resolve ( undefined );

        await waitFor ( () => expect ( screen.getByText ( "HOSTED_MODEL_PUSH_DIVERGED" ) ).toBeVisible () );
        expect ( gateway.putRequests [ 0 ]?.canonicalDocument.text ).toContain ( "Captured Push Edit" );
        expect ( gateway.putRequests [ 0 ]?.canonicalDocument.text ).not.toContain ( "Newer Local Push Edit" );
        expect ( screen.getByRole ( "textbox", { name: "Name" } ) ).toHaveValue ( "Newer Local Push Edit" );
        expect ( screen.getByRole ( "dialog", { name: "Warning" } ) ).toHaveTextContent (
            "The newer client document was preserved",
        );

        await user.click ( screen.getByRole ( "button", { name: "OK" } ) );
        await user.click ( screen.getByRole ( "treeitem", { name: "Editor" } ) );
        expect ( within ( screen.getByRole ( "group", { name: "Hosted Model" } ) )
            .getByText ( "Local changes" ) ).toBeVisible ();
    } );

    it ( "clears hosted identity on worker loss and logs an in-flight failure only once", async () =>
    {
        // Initialize the local values needed by this operation.

        const user                          = userEvent.setup ();
        const gateway                       = new ShellServerGateway ();
        const pullCompletion                = createDeferred<void> ();
        const failure: ServerGatewayFailure = {
            code:        "SERVER_WORKER_FAILED",
            isRetryable: true,
            message:     "The built-in Server Worker stopped unexpectedly.",
            remediation: "Reconnect and retry.",
        };

        render ( <Application serverGateway={ gateway } /> );
        await waitFor ( () => expect ( toolbarButton ( "toolbar-pull" ) ).toBeEnabled () );
        await user.click ( toolbarButton ( "toolbar-pull" ) );
        await waitFor ( () => expect ( gateway.getCount ).toBe ( 1 ) );

        const hostedModelGroup = screen.getByRole ( "group", { name: "Hosted Model" } );

        expect ( within ( hostedModelGroup ).getByText ( "Current" ) ).toBeVisible ();
        expect ( within ( hostedModelGroup ).getByText ( /^sha256:/u ) ).toBeVisible ();

        gateway.getCompletion = pullCompletion.promise;
        gateway.getFailure    = failure;
        await user.click ( toolbarButton ( "toolbar-pull" ) );
        await waitFor ( () => expect ( gateway.getCount ).toBe ( 2 ) );
        gateway.simulateConnectionLoss ( failure );
        pullCompletion.resolve ( undefined );

        await waitFor ( () => expect ( screen.getAllByText ( "SERVER_WORKER_FAILED" ) ).toHaveLength ( 1 ) );
        expect ( within ( screen.getByRole ( "contentinfo", { name: "Application status" } ) )
            .getByText ( "Disconnected" ) ).toBeVisible ();
        expect ( within ( hostedModelGroup ).getByText ( "Unknown" ) ).toBeVisible ();
        expect ( within ( hostedModelGroup ).queryByText ( /^sha256:/u ) ).not.toBeInTheDocument ();
    } );

    it ( "tests a pending Settings URL in an isolated probe and Cancel preserves the active server", async () =>
    {
        // Initialize the local values needed by this operation.

        const user                                = userEvent.setup ();
        const activeGateway                       = new ShellServerGateway ();
        const probeGateways: ShellServerGateway[] = [];

        render (
            <Application
                serverGateway        = { activeGateway }
                serverGatewayFactory = { () =>
                {
                    // Initialize the local values needed by this operation.

                    const probeGateway = new ShellServerGateway ();

                    probeGateways.push ( probeGateway );

                    // Return the probe gateway.

                    return probeGateway;
                } }
            />,
        );
        await waitFor ( () => expect ( activeGateway.connectUrls ).toEqual ( [ "builtin://server" ] ) );

        await user.click ( screen.getByRole ( "menuitem", { name: "File" } ) );
        await user.click ( screen.getByRole ( "menuitem", { name: "Settings" } ) );
        await user.click ( screen.getByRole ( "option", { name: "Server" } ) );

        const serverUrl = screen.getByRole ( "textbox", { name: "URL" } );

        await user.clear ( serverUrl );
        await user.type ( serverUrl, "builtin://alternate" );
        await user.click ( screen.getByRole ( "button", { name: "Test Server" } ) );

        await waitFor ( () => expect ( probeGateways ).toHaveLength ( 1 ) );

        const probeGateway = probeGateways [ 0 ];

        // Handle the case where probe gateway matches undefined.

        if ( probeGateway === undefined )
        {
            throw new Error ( "The Settings test did not create its isolated probe gateway." );
        }

        await waitFor ( () => expect ( probeGateway.disposeCount ).toBe ( 1 ) );
        expect ( probeGateway.connectUrls ).toEqual ( [ "builtin://alternate" ] );
        expect ( probeGateway.testCount ).toBe ( 1 );
        expect ( activeGateway.connectUrls ).toEqual ( [ "builtin://server" ] );
        expect ( activeGateway.disconnectCount ).toBe ( 0 );
        expect ( activeGateway.testCount ).toBe ( 0 );
        expect ( screen.getByText ( "SERVER_TEST_PASSED" ) ).toBeVisible ();
        expect ( within ( screen.getByRole ( "contentinfo", { name: "Application status" } ) )
            .getByText ( "Connected" ) ).toBeVisible ();

        await user.click ( screen.getByRole ( "button", { name: "Cancel" } ) );

        expect ( screen.queryByRole ( "dialog", { name: "Application Settings" } ) ).not.toBeInTheDocument ();

        const persistedPreferences = JSON.parse (
            window.localStorage.getItem ( PREFERENCE_STORAGE_KEY ) ?? "{}",
        ) as { readonly preferences?: { readonly serverUrl?: string } };

        expect ( persistedPreferences.preferences?.serverUrl ).toBe ( "builtin://server" );
        expect ( activeGateway.connectUrls ).toEqual ( [ "builtin://server" ] );
        expect ( activeGateway.disposeCount ).toBe ( 0 );
    } );

    it ( "applies a changed Settings URL by reconnecting the active gateway without a prior Test", async () =>
    {
        // Initialize the local values needed by this operation.

        const user                    = userEvent.setup ();
        const activeGateway           = new ShellServerGateway ();
        let probeGatewayCreationCount = 0;

        render (
            <Application
                serverGateway        = { activeGateway }
                serverGatewayFactory = { () =>
                {
                    probeGatewayCreationCount++;

                    // Return the computed result.

                    return new ShellServerGateway ();
                } }
            />,
        );
        await waitFor ( () => expect ( activeGateway.connectUrls ).toEqual ( [ "builtin://server" ] ) );

        await user.click ( screen.getByRole ( "menuitem", { name: "File" } ) );
        await user.click ( screen.getByRole ( "menuitem", { name: "Settings" } ) );
        await user.click ( screen.getByRole ( "option", { name: "Server" } ) );

        const serverUrl = screen.getByRole ( "textbox", { name: "URL" } );

        await user.clear ( serverUrl );
        await user.type ( serverUrl, "builtin://alternate" );
        await user.click ( screen.getByRole ( "button", { name: "Apply" } ) );

        await waitFor ( () => expect ( activeGateway.connectUrls ).toEqual (
            [ "builtin://server", "builtin://alternate" ],
        ) );
        expect ( probeGatewayCreationCount ).toBe ( 0 );
        expect ( activeGateway.testCount ).toBe ( 0 );
        expect ( within ( screen.getByRole ( "contentinfo", { name: "Application status" } ) )
            .getByText ( "Connected" ) ).toBeVisible ();
        await waitFor ( () =>
        {
            // Initialize the local values needed by this operation.

            const persistedPreferences = JSON.parse (
                window.localStorage.getItem ( PREFERENCE_STORAGE_KEY ) ?? "{}",
            ) as { readonly preferences?: { readonly serverUrl?: string } };

            expect ( persistedPreferences.preferences?.serverUrl ).toBe ( "builtin://alternate" );
        } );
    } );

    it ( "reports auto-connect failure non-modally and disposes the gateway on unmount", async () =>
    {
        // Initialize the local values needed by this operation.

        const gateway = new ShellServerGateway ();

        gateway.connectFailure = {
            code:        "SERVER_CONNECTION_FAILED",
            isRetryable: true,
            message:     "The server connection failed.",
            remediation: "Check the configured URL and retry Connect.",
        };

        const application = render ( <Application serverGateway={ gateway } /> );

        await waitFor ( () => expect ( screen.getByText ( "SERVER_CONNECTION_FAILED" ) ).toBeVisible () );
        expect ( screen.queryByRole ( "dialog", { name: "Error" } ) ).not.toBeInTheDocument ();
        expect ( within ( screen.getByRole ( "contentinfo", { name: "Application status" } ) )
            .getByText ( "Disconnected" ) ).toBeVisible ();

        application.unmount ();
        await waitFor ( () => expect ( gateway.disposeCount ).toBe ( 1 ) );
    } );
} );
