// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Document Workspace Tests
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies non-destructive Open, validation-gated Save, same-destination backup, and Save As
//   behavior.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from "vitest";
import type
{
    FileAssociation,
    FilePort,
    FileReadResult,
    FileWriteRequest,
    FileWriteResult,
} from "../../src/application/ports/contracts.js";
import
{
    createNewDocumentWorkspace,
    createPulledDocumentWorkspace,
    openDocumentWorkspace,
    saveDocumentWorkspace,
} from "../../src/application/document-workspace.js";
import { AuthoringDocumentCodec, AutomataDocumentCodec } from "../../src/infrastructure/files/file-codec.js";
import { loadExampleDocument, readExampleText } from "../model/example-helpers.js";

const ASSOCIATION: FileAssociation =
{
    identifier:  "fixture-handle",
    displayName: "fixture.json",
    capability:  "capable",
};

//--------------------------------------------------------------------------------------------------
// Class: RecordingFilePort
//
// Description:
//
//   Defines the boundary used by recording file.
//
//--------------------------------------------------------------------------------------------------

class RecordingFilePort implements FilePort
{
    public readonly requests: FileWriteRequest[] = [];

    //----------------------------------------------------------------------------------------------
    // Constructor: RecordingFilePort
    //
    // Description:
    //
    //   Initializes a RecordingFilePort instance.
    //
    // Parameters:
    //
    //   - readResult:
    //     The read result supplied to the operation.
    //
    //   - writeResult:
    //     The write result supplied to the operation.
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

    public constructor (
        private readonly readResult: FileReadResult | null,
        private readonly writeResult: FileWriteResult | null,
    )
    {
    }

    //----------------------------------------------------------------------------------------------
    // Method: openTextDocument
    //
    // Description:
    //
    //   Opens the text document.
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

    public async openTextDocument (): Promise<FileReadResult | null>
    {
        // Return the computed result.

        return this.readResult;
    }

    //----------------------------------------------------------------------------------------------
    // Method: saveTextDocument
    //
    // Description:
    //
    //   Saves the text document.
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

    public async saveTextDocument ( request: FileWriteRequest ): Promise<FileWriteResult | null>
    {
        this.requests.push ( request );

        // Return the computed result.

        return this.writeResult;
    }
}

//--------------------------------------------------------------------------------------------------
// Function: createReadResult
//
// Description:
//
//   Creates read result for the test scenario.
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

function createReadResult ( text: string ): FileReadResult
{
    // Return the assembled result.

    return {
        association: ASSOCIATION,
        byteCount:   new TextEncoder ().encode ( text ).byteLength,
        text,
    };
}

describe ( "Phase 3 document workspace", () =>
{
    it ( "creates an explicit incomplete New draft at revision one", () =>
    {
        // Initialize the local values needed by this operation.

        const workspace = createNewDocumentWorkspace ( true );

        expect ( workspace.editorState?.documentRevision ).toBe ( 1 );
        expect ( workspace.editorState?.draft.stateMachine.initialState ).toBeNull ();
        expect ( workspace.validationStatus ).toBe ( "failed" );
    } );

    it ( "creates a clean association-free revision-one workspace for Pull", () =>
    {
        // Initialize the local values needed by this operation.

        const document  = loadExampleDocument ( "state-machine-light-switch.json" );
        const workspace = createPulledDocumentWorkspace ( document );

        expect ( workspace ).toMatchObject (
            {
                association:      null,
                displayName:      null,
                previousDocument: null,
                validationStatus: "passed",
            },
        );
        expect ( workspace.editorState ).toMatchObject (
            { dirty: false, documentRevision: 1, redoStack: [], undoStack: [] },
        );
        expect ( workspace.editorState?.draft ).toBe ( document );
    } );

    it ( "rejects invalid Open content without producing a replacement workspace", async () =>
    {
        // Initialize the local values needed by this operation.

        const filePort = new RecordingFilePort ( createReadResult ( "{\"file_id\":\"wrong\"}" ), null );
        const result   = await openDocumentWorkspace ( filePort, new AutomataDocumentCodec () );

        expect ( result.status ).toBe ( "failed" );

        // Handle the case where result status matches "failed".

        if ( result.status === "failed" )
        {
            expect ( result.diagnostics [ 0 ]?.code ).toBe ( "FILE_ID_INVALID" );
        }
    } );

    it ( "saves a metadata-only incomplete draft for later authoring", async () =>
    {
        // Initialize the local values needed by this operation.

        const filePort = new RecordingFilePort (
            null,
            { association: ASSOCIATION, backupStrategy: "sibling", limitation: null },
        );
        const result = await saveDocumentWorkspace (
            createNewDocumentWorkspace ( true ),
            filePort,
            true,
            false,
        );

        expect ( result ).toMatchObject ( { status: "saved", workspace: { validationStatus: "failed" } } );
        expect ( filePort.requests ).toHaveLength ( 1 );

        const saved = JSON.parse ( filePort.requests [ 0 ]?.document.text ?? "{}" ) as {
            state_machine?: { initial_state?: string | null; states?: readonly unknown[] };
        };

        expect ( saved.state_machine?.initial_state ).toBeNull ();
        expect ( saved.state_machine?.states ).toEqual ( [] );
    } );

    it ( "opens and saves a structurally sound draft with no initial state as canonical null", async () =>
    {
        // Initialize the local values needed by this operation.

        const source = JSON.parse ( readExampleText ( "state-machine-light-switch.json" ) ) as {
            chart: { indicators: { initial_state_indicator: null | { state?: string | null } } };
            state_machine: { initial_state: string | null };
        };

        source.state_machine.initial_state = null;

        // Handle the case where initial state indicator differs from an absent value.

        if ( source.chart.indicators.initial_state_indicator !== null )
        {
            source.chart.indicators.initial_state_indicator.state = null;
        }

        // Initialize the local values needed by this operation.

        const sourceText = JSON.stringify ( source );
        const filePort   = new RecordingFilePort (
            createReadResult ( sourceText ),
            { association: ASSOCIATION, backupStrategy: "sibling", limitation: null },
        );
        const opened = await openDocumentWorkspace ( filePort, new AuthoringDocumentCodec () );

        expect ( opened ).toMatchObject (
            {
                status: "opened",
                diagnostics: [ { code: "INITIAL_STATE_UNDEFINED", severity: "warning" } ],
                workspace: { validationStatus: "failed" },
            },
        );

        // Handle the case where opened status differs from "opened".

        if ( opened.status !== "opened" )
        {
            // Return control to the caller.

            return;
        }

        const saved = await saveDocumentWorkspace ( opened.workspace, filePort, true, false );

        expect ( saved ).toMatchObject ( { status: "saved", workspace: { validationStatus: "failed" } } );
        expect ( JSON.parse ( filePort.requests [ 0 ]?.document.text ?? "{}" ).state_machine.initial_state )
            .toBeNull ();
    } );

    it ( "passes previous content to the file adapter and marks Save clean", async () =>
    {
        // Initialize the local values needed by this operation.

        const originalText = readExampleText ( "state-machine-light-switch.json" );
        const filePort     = new RecordingFilePort (
            createReadResult ( originalText ),
            { association: ASSOCIATION, backupStrategy: "sibling", limitation: null },
        );
        const opened = await openDocumentWorkspace ( filePort, new AutomataDocumentCodec () );

        // Handle the case where opened status differs from "opened".

        if ( opened.status !== "opened" )
        {
            throw new Error ( "The conforming fixture must open." );
        }

        const saved = await saveDocumentWorkspace ( opened.workspace, filePort, true, false );

        expect ( saved.status ).toBe ( "saved" );
        expect ( filePort.requests [ 0 ] ).toMatchObject (
            { association: ASSOCIATION, previousDocument: { text: originalText }, saveBackup: true },
        );

        // Handle the case where saved status matches "saved".

        if ( saved.status === "saved" )
        {
            expect ( saved.workspace.editorState?.dirty ).toBe ( false );
            expect ( saved.writeResult.backupStrategy ).toBe ( "sibling" );
        }
    } );

    it ( "Save As requests a new destination without backing up the prior association", async () =>
    {
        // Initialize the local values needed by this operation.

        const originalText                    = readExampleText ( "state-machine-light-switch.json" );
        const newAssociation: FileAssociation = 
        {
            identifier:  "new-handle",
            displayName: "copy.json",
            capability:  "capable",
        };
        const filePort = new RecordingFilePort (
            createReadResult ( originalText ),
            { association: newAssociation, backupStrategy: "none", limitation: null },
        );
        const opened = await openDocumentWorkspace ( filePort, new AutomataDocumentCodec () );

        // Handle the case where opened status differs from "opened".

        if ( opened.status !== "opened" )
        {
            throw new Error ( "The conforming fixture must open." );
        }

        const saved = await saveDocumentWorkspace ( opened.workspace, filePort, true, true );

        expect ( saved.status ).toBe ( "saved" );
        expect ( filePort.requests [ 0 ] ).toMatchObject ( { association: null, previousDocument: null } );
    } );
} );
