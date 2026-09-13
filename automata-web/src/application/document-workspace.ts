// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Document Workspace
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Coordinates the single-document lifecycle, command boundary, validation gates, and canonical
//   file persistence.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { DocumentCodecPort, FileAssociation, FilePort, FileWriteResult } from "./ports/contracts.js";
import type { StatusBarViewModel } from "./contracts.js";
import
{
    createDocumentEditorState,
    executeDocumentCommand,
    markDocumentEditorStateClean,
    planDocumentCommand,
    redoDocumentCommand,
    undoDocumentCommand,
} from "../domain/model/commands.js";
import type
{
    CommandFailure,
    CommandPlanResult,
    DocumentCommand,
    DocumentCommandPlan,
    DocumentEditorState,
} from "../domain/model/commands.js";
import type { AuthoringDraft, AutomataDocument, CanonicalSerializedDocument } from "../domain/model/contracts.js";
import { serializeCanonicalDocument } from "../domain/model/canonicalization.js";
import { createEmptyAuthoringDraft } from "../domain/model/drafts.js";
import type { DomainDiagnostic } from "../domain/model/diagnostics.js";
import { DEFAULT_CHART_STATE_HEIGHT, MAXIMUM_FILE_BYTE_COUNT } from "../domain/model/limits.js";
import { validateAuthoringDraft, validatePersistableAuthoringDraft } from "../domain/model/validation.js";

//--------------------------------------------------------------------------------------------------
// Type: DocumentValidationStatus
//
// Description:
//
//   Defines the supported document validation status alternatives.
//
//--------------------------------------------------------------------------------------------------

export type DocumentValidationStatus = "failed" | "not_validated" | "passed";

//--------------------------------------------------------------------------------------------------
// Interface: DocumentWorkspaceState
//
// Description:
//
//   Defines the structure of document workspace state.
//
//--------------------------------------------------------------------------------------------------

export interface DocumentWorkspaceState
{
    readonly association:       FileAssociation | null;
    readonly displayName:       string | null;
    readonly editorState:       DocumentEditorState | null;
    readonly previousDocument:  CanonicalSerializedDocument | null;
    readonly validationStatus:  DocumentValidationStatus;
}

//--------------------------------------------------------------------------------------------------
// Type: DocumentOpenResult
//
// Description:
//
//   Describes the result produced by document open.
//
//--------------------------------------------------------------------------------------------------

export type DocumentOpenResult =
    | { readonly status: "cancelled" }
    | { readonly status: "failed"; readonly diagnostics: readonly DomainDiagnostic[] }
    | {
        readonly status:      "opened";
        readonly diagnostics: readonly DomainDiagnostic[];
        readonly workspace:   DocumentWorkspaceState;
    };

//--------------------------------------------------------------------------------------------------
// Type: DocumentSaveResult
//
// Description:
//
//   Describes the result produced by document save.
//
//--------------------------------------------------------------------------------------------------

export type DocumentSaveResult =
    | { readonly status: "cancelled" }
    | { readonly status: "failed"; readonly diagnostics: readonly DomainDiagnostic[] }
    | {
        readonly status:      "saved";
        readonly workspace:   DocumentWorkspaceState;
        readonly writeResult: FileWriteResult;
    };

//--------------------------------------------------------------------------------------------------
// Interface: WorkspaceValidationResult
//
// Description:
//
//   Describes the result produced by workspace validation.
//
//--------------------------------------------------------------------------------------------------

export interface WorkspaceValidationResult
{
    readonly diagnostics: readonly DomainDiagnostic[];
    readonly workspace:   DocumentWorkspaceState;
}

//--------------------------------------------------------------------------------------------------
// Type: WorkspaceCommandResult
//
// Description:
//
//   Describes the result produced by workspace command.
//
//--------------------------------------------------------------------------------------------------

export type WorkspaceCommandResult =
    | { readonly isSuccessful: true; readonly workspace: DocumentWorkspaceState }
    | CommandFailure;

//--------------------------------------------------------------------------------------------------
// Function: createClosedDocumentWorkspace
//
// Description:
//
//   Creates closed document workspace.
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

export function createClosedDocumentWorkspace (): DocumentWorkspaceState
{
    // Return the assembled result.

    return {
        association:      null,
        displayName:      null,
        editorState:      null,
        previousDocument: null,
        validationStatus: "not_validated",
    };
}

//--------------------------------------------------------------------------------------------------
// Function: createNewDocumentWorkspace
//
// Description:
//
//   Creates new document workspace.
//
// Parameters:
//
//   - legacyStateOriginCentered:
//     The legacy state origin centered supplied to the operation.
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

export function createNewDocumentWorkspace ( legacyStateOriginCentered?: boolean ): DocumentWorkspaceState
{
    // Initialize the local values needed by this operation.

    const editorState = createDocumentEditorState ( createEmptyAuthoringDraft ( legacyStateOriginCentered ) );

    // Return the assembled result.

    return {
        association:      null,
        displayName:      null,
        editorState,
        previousDocument: null,
        validationStatus: editorState.validationSummary.isValid ? "passed" : "failed",
    };
}

//--------------------------------------------------------------------------------------------------
// Function: createPulledDocumentWorkspace
//
// Description:
//
//   Creates pulled document workspace.
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

export function createPulledDocumentWorkspace ( document: AutomataDocument ): DocumentWorkspaceState
{
    // Return the assembled result.

    return {
        association:      null,
        displayName:      null,
        editorState:      createDocumentEditorState ( document ),
        previousDocument: null,
        validationStatus: "passed",
    };
}

//--------------------------------------------------------------------------------------------------
// Function: createLifecycleDiagnostic
//
// Description:
//
//   Creates lifecycle diagnostic.
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

function createLifecycleDiagnostic ( code: string, message: string, remediation: string ): DomainDiagnostic
{
    // Return the assembled result.

    return {
        code,
        message,
        remediation,
        severity: "error",
        source:   "file",
    };
}

//--------------------------------------------------------------------------------------------------
// Function: openDocumentWorkspace
//
// Description:
//
//   Opens the document workspace.
//
// Parameters:
//
//   - filePort:
//     The file port supplied to the operation.
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

export async function openDocumentWorkspace (
    filePort: FilePort,
    documentCodec: DocumentCodecPort<AuthoringDraft>,
): Promise<DocumentOpenResult>
{
    // Initialize the local values needed by this operation.

    let readResult;

    // Run the operation that may report a recoverable failure.

    try
    {
        readResult = await filePort.openTextDocument ();
    }
    catch ( error )
    {
        // Recover from the reported failure without hiding its outcome.

        return {
            status: "failed",
            diagnostics:
            [
                createLifecycleDiagnostic (
                    "FILE_READ_FAILED",
                    error instanceof Error ? error.message : "The selected file could not be read.",
                    "Check file permissions and encoding, then try again.",
                ),
            ],
        };
    }

    // Handle the case where read result matches an absent value.

    if ( readResult === null )
    {
        // Return the assembled result.

        return { status: "cancelled" };
    }

    // Handle the case where read result byte count exceeds maximum file byte count.

    if ( readResult.byteCount > MAXIMUM_FILE_BYTE_COUNT )
    {
        // Return the assembled result.

        return {
            status: "failed",
            diagnostics:
            [
                createLifecycleDiagnostic (
                    "FILE_TOO_LARGE",
                    `The selected file is ${readResult.byteCount} bytes; the limit is ${MAXIMUM_FILE_BYTE_COUNT} bytes.`,
                    "Choose an Automata Lab file no larger than 5 MiB.",
                ),
            ],
        };
    }

    const openResult = documentCodec.open ( readResult.text );

    // Handle the case where the open result is successful condition is not satisfied.

    if ( !openResult.isSuccessful )
    {
        // Return the assembled result.

        return { status: "failed", diagnostics: openResult.diagnostics };
    }

    const editorState = createDocumentEditorState ( openResult.document );

    // Return the assembled result.

    return {
        status:      "opened",
        diagnostics: openResult.diagnostics,
        workspace:
        {
            association:      readResult.association,
            displayName:      readResult.association.displayName,
            editorState,
            previousDocument: { text: readResult.text },
            validationStatus: editorState.validationSummary.isValid ? "passed" : "failed",
        },
    };
}

//--------------------------------------------------------------------------------------------------
// Function: suggestedDocumentName
//
// Description:
//
//   Derives the suggested document name.
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

export function suggestedDocumentName ( workspace: DocumentWorkspaceState ): string
{
    // Handle the case where workspace display name differs from an absent value.

    if ( workspace.displayName !== null )
    {
        // Return the computed result.

        return workspace.displayName;
    }

    // Initialize the local values needed by this operation.

    const modelName = workspace.editorState?.draft.settings.name ?? "untitled-state-machine";
    const fileStem  = modelName.toLocaleLowerCase ().replace ( /[^a-z0-9]+/g, "-" ).replace ( /^-|-$/g, "" );

    // Return the computed result.

    return `${fileStem.length === 0 ? "untitled-state-machine" : fileStem}.json`;
}

//--------------------------------------------------------------------------------------------------
// Function: saveDocumentWorkspace
//
// Description:
//
//   Saves the document workspace.
//
// Parameters:
//
//   - workspace:
//     The workspace supplied to the operation.
//
//   - filePort:
//     The file port supplied to the operation.
//
//   - saveBackup:
//     The save backup supplied to the operation.
//
//   - forceSaveAs:
//     The force save as supplied to the operation.
//
//   - expandedStateMinimumHeight:
//     The expanded state minimum height supplied to the operation.
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

export async function saveDocumentWorkspace (
    workspace: DocumentWorkspaceState,
    filePort: FilePort,
    saveBackup: boolean,
    forceSaveAs: boolean,
    expandedStateMinimumHeight = DEFAULT_CHART_STATE_HEIGHT,
): Promise<DocumentSaveResult>
{
    // Handle the case where workspace editor state matches an absent value.

    if ( workspace.editorState === null )
    {
        // Return the assembled result.

        return {
            status: "failed",
            diagnostics:
            [
                createLifecycleDiagnostic (
                    "DOCUMENT_MISSING",
                    "There is no open document to save.",
                    "Create or open a document first.",
                ),
            ],
        };
    }

    const validation = validatePersistableAuthoringDraft ( workspace.editorState.draft );

    // Handle the case where the validation is valid condition is not satisfied.

    if ( !validation.isValid )
    {
        // Return the assembled result.

        return { status: "failed", diagnostics: validation.diagnostics };
    }

    // Initialize the local values needed by this operation.

    const serializedDocument = serializeCanonicalDocument ( validation.document, expandedStateMinimumHeight );
    let writeResult;

    // Run the operation that may report a recoverable failure.

    try
    {
        writeResult = await filePort.saveTextDocument (
            {
                association:      forceSaveAs ? null : workspace.association,
                suggestedName:    suggestedDocumentName ( workspace ),
                document:         serializedDocument,
                previousDocument: forceSaveAs ? null : workspace.previousDocument,
                saveBackup,
            },
        );
    }
    catch ( error )
    {
        // Recover from the reported failure without hiding its outcome.

        return {
            status: "failed",
            diagnostics:
            [
                createLifecycleDiagnostic (
                    "FILE_WRITE_FAILED",
                    error instanceof Error ? error.message : "The document could not be written.",
                    "Check destination permissions and available space, then try again.",
                ),
            ],
        };
    }

    // Handle the case where write result matches an absent value.

    if ( writeResult === null )
    {
        // Return the assembled result.

        return { status: "cancelled" };
    }

    // Return the assembled result.

    return {
        status: "saved",
        workspace:
        {
            association:      writeResult.association,
            displayName:      writeResult.association.displayName,
            editorState:      markDocumentEditorStateClean ( workspace.editorState ),
            previousDocument: serializedDocument,
            validationStatus: workspace.editorState.validationSummary.isValid ? "passed" : "failed",
        },
        writeResult,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: validateDocumentWorkspace
//
// Description:
//
//   Validates document workspace.
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

export function validateDocumentWorkspace ( workspace: DocumentWorkspaceState ): WorkspaceValidationResult
{
    // Handle the case where workspace editor state matches an absent value.

    if ( workspace.editorState === null )
    {
        // Return the assembled result.

        return {
            workspace,
            diagnostics:
            [
                createLifecycleDiagnostic (
                    "DOCUMENT_MISSING",
                    "There is no open document to validate.",
                    "Create or open a document first.",
                ),
            ],
        };
    }

    const validation = validateAuthoringDraft ( workspace.editorState.draft );

    // Return the assembled result.

    return {
        diagnostics: validation.diagnostics,
        workspace:
        {
            ...workspace,
            validationStatus: validation.isValid ? "passed" : "failed",
        },
    };
}

//--------------------------------------------------------------------------------------------------
// Function: planWorkspaceDocumentCommand
//
// Description:
//
//   Plans the workspace document command.
//
// Parameters:
//
//   - workspace:
//     The workspace supplied to the operation.
//
//   - command:
//     The command supplied to the operation.
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

export function planWorkspaceDocumentCommand (
    workspace: DocumentWorkspaceState,
    command: DocumentCommand,
): CommandPlanResult
{
    // Return the result selected by the current condition.

    return workspace.editorState === null
        ? {
            isSuccessful: false,
            code:         "COMMAND_INVALID",
            message:      "There is no open document to edit.",
        }
        : planDocumentCommand ( workspace.editorState, command );
}

//--------------------------------------------------------------------------------------------------
// Function: commitWorkspaceDocumentCommand
//
// Description:
//
//   Commits the workspace document command.
//
// Parameters:
//
//   - workspace:
//     The workspace supplied to the operation.
//
//   - plan:
//     The plan supplied to the operation.
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

export function commitWorkspaceDocumentCommand (
    workspace: DocumentWorkspaceState,
    plan: DocumentCommandPlan,
): WorkspaceCommandResult
{
    // Handle the case where workspace editor state matches an absent value.

    if ( workspace.editorState === null )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            code:         "COMMAND_INVALID",
            message:      "There is no open document to edit.",
        };
    }

    const result = executeDocumentCommand ( workspace.editorState, plan );

    // Return the result selected by the current condition.

    return result.isSuccessful
        ? {
            isSuccessful: true,
            workspace:
            {
                ...workspace,
                editorState:      result.state,
                validationStatus: result.state.validationSummary.isValid ? "passed" : "failed",
            },
        }
        : result;
}

//--------------------------------------------------------------------------------------------------
// Function: undoWorkspaceDocumentCommand
//
// Description:
//
//   Undoes the workspace document command.
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

export function undoWorkspaceDocumentCommand ( workspace: DocumentWorkspaceState ): WorkspaceCommandResult
{
    // Handle the case where workspace editor state matches an absent value.

    if ( workspace.editorState === null )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            code:         "COMMAND_INVALID",
            message:      "There is no open document to edit.",
        };
    }

    const result = undoDocumentCommand ( workspace.editorState );

    // Return the result selected by the current condition.

    return result.isSuccessful
        ? {
            isSuccessful: true,
            workspace:
            {
                ...workspace,
                editorState:      result.state,
                validationStatus: result.state.validationSummary.isValid ? "passed" : "failed",
            },
        }
        : result;
}

//--------------------------------------------------------------------------------------------------
// Function: redoWorkspaceDocumentCommand
//
// Description:
//
//   Derives the redo workspace document command.
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

export function redoWorkspaceDocumentCommand ( workspace: DocumentWorkspaceState ): WorkspaceCommandResult
{
    // Handle the case where workspace editor state matches an absent value.

    if ( workspace.editorState === null )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            code:         "COMMAND_INVALID",
            message:      "There is no open document to edit.",
        };
    }

    const result = redoDocumentCommand ( workspace.editorState );

    // Return the result selected by the current condition.

    return result.isSuccessful
        ? {
            isSuccessful: true,
            workspace:
            {
                ...workspace,
                editorState:      result.state,
                validationStatus: result.state.validationSummary.isValid ? "passed" : "failed",
            },
        }
        : result;
}

//--------------------------------------------------------------------------------------------------
// Function: deriveDocumentStatusBar
//
// Description:
//
//   Derives document status bar.
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

export function deriveDocumentStatusBar ( workspace: DocumentWorkspaceState ): StatusBarViewModel
{
    // Initialize the local values needed by this operation.

    const draft = workspace.editorState?.draft;

    // Handle the case where draft matches undefined.

    if ( draft === undefined )
    {
        // Return the assembled result.

        return {
            actionCount:          null,
            entryAssignmentCount: null,
            eventCount:           null,
            exitAssignmentCount:  null,
            initialState:         null,
            serverConnection:     "Disconnected",
            stateCount:           null,
            transitionCount:      null,
            contextualSegments:   [],
        };
    }

    // Return the assembled result.

    return {
        actionCount:          draft.stateMachine.actions.length,
        entryAssignmentCount: draft.stateMachine.stateActions.entry.length,
        eventCount:           draft.stateMachine.events.length,
        exitAssignmentCount:  draft.stateMachine.stateActions.exit.length,
        initialState:         draft.stateMachine.initialState,
        serverConnection:     "Disconnected",
        stateCount:           draft.stateMachine.states.length,
        transitionCount:      draft.stateMachine.transitionTable.length,
        contextualSegments:   [],
    };
}
