// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Application
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Composes the accessible tree-driven application shell and document-editor workflows from typed
//   contracts.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { CSSProperties } from "react";

import type { ApplicationPreferences, PrintPort, SolverJobPort } from "./application/ports/contracts";
import
{
    createPrintableReport,
    extractPrintPageSetup,
} from "./application/printing";
import type { PrintableReport, PrintPageSetup } from "./application/printing";
import { createHostedSnapshot } from "./application/revisions";
import type { HostedSessionDto, ServerGateway, ServerGatewayFailure } from "./application/server-contracts";
import
{
    CSV_TRANSFER_KINDS,
    createCsvExportDocument,
    createCsvSimulatorSequenceExportDocument,
    createCsvSolverSequenceExportDocument,
    prepareCsvModelElementImport,
    prepareCsvSimulatorSequenceImport,
    prepareCsvSolverSequenceImport,
} from "./application/csv-transfer";
import type { CsvTransferKind } from "./application/csv-transfer";
import type
{
    ConsoleEntry,
    ConsoleFilterState,
    DocumentCommandFactory,
    ShellRegion,
    ShellRoute,
} from "./application/contracts";
import
{
    DiagnosticChannel,
    MAXIMUM_CONSOLE_DIAGNOSTIC_BATCH_COUNT,
} from "./application/diagnostic-channel";
import
{
    advanceStepCursor,
    createSimulatorSessionState,
    runEventBuffer,
    simulatorCommandAvailability,
    stepEventBuffer,
} from "./application/simulator-workspace";
import { isSimulatorSessionStale } from "./application/simulator-workspace";
import type { SimulatorSessionState } from "./application/simulator-workspace";
import type { RuntimeWarning } from "./domain/runtime/contracts";
import
{
    commitWorkspaceDocumentCommand,
    createClosedDocumentWorkspace,
    createNewDocumentWorkspace,
    deriveDocumentStatusBar,
    openDocumentWorkspace,
    planWorkspaceDocumentCommand,
    redoWorkspaceDocumentCommand,
    saveDocumentWorkspace,
    suggestedDocumentName,
    undoWorkspaceDocumentCommand,
    validateDocumentWorkspace,
} from "./application/document-workspace";
import type { DocumentWorkspaceState } from "./application/document-workspace";
import
{
    beginServerConnection,
    connectServerWorkspace,
    closeActiveServerSession,
    createServerWorkspaceState,
    resetActiveServerSession,
    runActiveServerSession,
    startServerSession,
    stepActiveServerSession,
    disconnectServerWorkspace,
    disposeServerWorkspace,
    markServerConnectionLost,
    markServerDocumentChanged,
    pullDocumentFromServer,
    pushDocumentToServer,
    testServerWorkspace,
} from "./application/server-workspace";
import type
{
    ServerWorkspaceFailure,
    ServerWorkspaceState,
} from "./application/server-workspace";
import
{
    beginSolverJob,
    completeSolverJob,
    createSolverWorkspaceState,
    discardSolverCandidate,
    rebaseSolverCandidateAfterChartSettingChange,
    refreshSolverCandidateFreshness,
    updateSolverProgress,
} from "./application/solver-workspace";
import type { SolverWorkspaceState } from "./application/solver-workspace";
import type { DocumentCommandPlan } from "./domain/model/commands";
import type { AuthoringDraft, SimulatorSequence, SolverCandidate, SolverSequence } from "./domain/model/contracts";
import type { DomainDiagnostic } from "./domain/model/diagnostics";
import { MAXIMUM_FILE_BYTE_COUNT } from "./domain/model/limits";
import { inspectModelElementImport } from "./domain/model/model-element-import";
import
{
    filterIncompleteAuthoringDiagnostics,
    validateAuthoringDraft,
    validatePersistableAuthoringDraft,
} from "./domain/model/validation";
import type
{
    SolverInferenceResult,
    SolverObservationDiagnostic,
    SolverObservationInput,
} from "./domain/solver/contracts";
import { normalizeSolverObservations } from "./domain/solver/normalization";
import
{
    COMPILE_TIME_CONFIGURATION,
    DEFAULT_CONSOLE_FILTERS,
} from "./configuration/compile-time-configuration.js";
import
{
    AuthoringDocumentCodec,
    AutomataDocumentCodec,
    BrowserCsvFilePort,
    BrowserFilePort,
} from "./infrastructure/files";
import { Sha256ContentHasher } from "./infrastructure/hashing";
import
{
    BrowserChartLayoutPort,
    BrowserChartRoutingPort,
    captureChartImageDataUrl,
    exportChartImage,
} from "./infrastructure/chart";
import { BrowserServerWorkerGateway } from "./infrastructure/server";
import { BrowserSolverWorkerPort } from "./infrastructure/solver";
import { BrowserPrintPort } from "./infrastructure/printing";
import type { ServerEventEnvelope } from "./workers/server/protocol";
import {
    MINIMUM_CONSOLE_PANEL_HEIGHT,
    MINIMUM_MASTER_PANEL_WIDTH,
    loadBrowserApplicationPreferences,
    saveBrowserApplicationPreferences,
} from "./infrastructure/preferences";
import { text } from "./localization/messages";
import { ConsolePanel } from "./presentation/console/ConsolePanel";
import { adaptChartGridColor } from "./presentation/chart/chart-grid-color";
import { ChartPage } from "./presentation/chart/ChartPage";
import
{
    AboutDialog,
    CsvImportConflictDialog,
    DirtyReplacementDialog,
    ImpactConfirmationDialog,
    IncompleteDocumentWarningDialog,
    MessageDialog,
    SimulatorModelDifferenceDialog,
    SimulatorSequenceCsvDialog,
    SolverReplacementDialog,
    SolverSequenceCsvDialog,
    TransitionCsvReferenceDialog,
} from "./presentation/dialogs/DialogPatterns";
import { SettingsDialog } from "./presentation/dialogs/SettingsDialog";
import { PageSetupDialog } from "./presentation/dialogs/PageSetupDialog";
import { EditorWorkspace } from "./presentation/editor/EditorPages";
import { NavigationTree } from "./presentation/navigation/NavigationTree";
import { SimulatorPage } from "./presentation/simulator/SimulatorPage";
import { SolverPage } from "./presentation/solver/SolverPage";
import { DetailPage } from "./presentation/shell/DetailPage";
import { StatusBar } from "./presentation/shell/StatusBar";
import { ErrorBoundary } from "./presentation/shared/ErrorBoundary";
import { Icon } from "./presentation/shared/Icon";
import { MenuBar } from "./presentation/shared/MenuBar";
import type { MenuDefinition, MenuEntry, MenuIcon } from "./presentation/shared/MenuBar";
import { Splitter } from "./presentation/shared/Splitter";
import { Toolbar } from "./presentation/shared/Toolbar";
import type { ToolbarEntry } from "./presentation/shared/Toolbar";
import { PrintableReportSurface } from "./presentation/printing/PrintableReport";

const MINIMUM_DETAIL_PANE_BUTTON_WIDTH = COMPILE_TIME_CONFIGURATION.shell.minimumDetailPaneButtonWidth;

const EDITOR_ROUTES: readonly ShellRoute[] =
[
    "editor",
    "stateMachine",
    "states",
    "events",
    "actions",
    "transitionTable",
];

// Editor's children, which is to say the routes whose tree node is hidden while Editor is
// collapsed. Selecting one of these has to open Editor, because a tree cannot show a selection it
// is hiding. Editor itself is deliberately absent: its node is visible either way, so expanding it
// there would discard a state the user set and gain nothing.

const EDITOR_CHILD_ROUTES: readonly ShellRoute[] = EDITOR_ROUTES.filter ( route => route !== "editor" );


//--------------------------------------------------------------------------------------------------
// Interface: PendingCsvImport
//
// Description:
//
//   Defines the structure of pending CSV import.
//
//--------------------------------------------------------------------------------------------------

interface PendingCsvImport
{
    readonly conflictKeys: readonly string[];
    readonly plan:         DocumentCommandPlan;
    readonly route:        ShellRoute;
    readonly rowCount:     number;
    readonly transferName: string;
    readonly warnings:     readonly DomainDiagnostic[];
}


//--------------------------------------------------------------------------------------------------
// Interface: PendingPrintChartCapture
//
// Description:
//
//   Defines the structure of pending print chart capture.
//
//--------------------------------------------------------------------------------------------------

interface PendingPrintChartCapture
{
    readonly documentRevision: number;
    readonly draft:            AuthoringDraft;
    readonly fileName:         string;
    readonly preferences:      ApplicationPreferences;
}


//--------------------------------------------------------------------------------------------------
// Interface: PendingIncompleteDocumentSave
//
// Description:
//
//   Defines the structure of pending incomplete document save.
//
//--------------------------------------------------------------------------------------------------

interface PendingIncompleteDocumentSave
{
    readonly forceSaveAs: boolean;
    readonly resolve:     ( saved: boolean ) => void;
}


//--------------------------------------------------------------------------------------------------
// Interface: IncompleteDocumentWarningState
//
// Description:
//
//   Defines the structure of incomplete document warning state.
//
//--------------------------------------------------------------------------------------------------

interface IncompleteDocumentWarningState
{
    readonly diagnostics: readonly DomainDiagnostic[];
    readonly mode:        "open" | "save";
}


//--------------------------------------------------------------------------------------------------
// Interface: TransitionCsvMissingReferences
//
// Description:
//
//   Defines the structure of transition CSV missing references.
//
//--------------------------------------------------------------------------------------------------

interface TransitionCsvMissingReferences
{
    readonly events: readonly string[];
    readonly states: readonly string[];
}


//--------------------------------------------------------------------------------------------------
// Interface: SolverCsvDialogState
//
// Description:
//
//   Defines the structure of solver CSV dialog state.
//
//--------------------------------------------------------------------------------------------------

interface SolverCsvDialogState
{
    readonly mode: "export" | "import";
    readonly text: string | null;
}


//--------------------------------------------------------------------------------------------------
// Interface: ApplicationProperties
//
// Description:
//
//   Defines the properties accepted by the application interface.
//
//--------------------------------------------------------------------------------------------------

export interface ApplicationProperties
{
    readonly diagnosticChannel?:     DiagnosticChannel;
    readonly printPort?:            PrintPort;
    readonly serverGateway?:        ServerGateway;
    readonly serverGatewayFactory?: () => ServerGateway;
    readonly solverJobPort?:        SolverJobPort;
}


//--------------------------------------------------------------------------------------------------
// Interface: DocumentOperationSnapshot
//
// Description:
//
//   Defines the structure of document operation snapshot.
//
//--------------------------------------------------------------------------------------------------

interface DocumentOperationSnapshot
{
    readonly documentRevision:  number | null;
    readonly draftReference:    NonNullable<DocumentWorkspaceState["editorState"]>["draft"] | null;
    readonly workspaceReference: DocumentWorkspaceState;
}


//--------------------------------------------------------------------------------------------------
// Function: captureDocumentOperationSnapshot
//
// Description:
//
//   Captures the document operation snapshot.
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

function captureDocumentOperationSnapshot ( workspace: DocumentWorkspaceState ): DocumentOperationSnapshot
{
    // Return the assembled result.

    return {
        documentRevision:  workspace.editorState?.documentRevision ?? null,
        draftReference:    workspace.editorState?.draft ?? null,
        workspaceReference: workspace,
    };
}


//--------------------------------------------------------------------------------------------------
// Function: documentChangedeinceSnapshot
//
// Description:
//
//   Derives the document changed since snapshot.
//
// Parameters:
//
//   - snapshot:
//     The snapshot supplied to the operation.
//
//   - currentWorkspace:
//     The current workspace supplied to the operation.
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

function documentChangedSinceSnapshot (
    snapshot: DocumentOperationSnapshot,
    currentWorkspace: DocumentWorkspaceState,
): boolean
{
    // Handle the case where current workspace matches snapshot workspace reference.

    if ( currentWorkspace === snapshot.workspaceReference )
    {
        // Return the computed result.

        return false;
    }


    // Return the computed result.

    return ( currentWorkspace.editorState?.documentRevision ?? null ) !== snapshot.documentRevision ||
        ( currentWorkspace.editorState?.draft ?? null ) !== snapshot.draftReference;
}


//--------------------------------------------------------------------------------------------------
// Function: createBrowserServerGateway
//
// Description:
//
//   Creates browser server gateway.
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

function createBrowserServerGateway (): ServerGateway
{
    // Return the computed result.

    return new BrowserServerWorkerGateway ();
}


//--------------------------------------------------------------------------------------------------
// Function: csvTransferName
//
// Description:
//
//   Derives the CSV transfer name.
//
// Parameters:
//
//   - transferKind:
//     The transfer kind supplied to the operation.
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

function csvTransferName ( transferKind: CsvTransferKind ): string
{
    // Dispatch according to the transfer kind value.

    switch ( transferKind )
    {
        // Handle the "model_metadata" case.

        case "model_metadata":

            // Return the text result.

            return text ( "menu.file.csv.modelMetadata" );

        // Handle the "actions" case.

        case "actions":

            // Return the text result.

            return text ( "menu.file.csv.actions" );

        // Handle the "events" case.

        case "events":

            // Return the text result.

            return text ( "menu.file.csv.events" );

        // Handle the "state_actions" case.

        case "state_actions":

            // Return the text result.

            return text ( "menu.file.csv.stateActions" );

        // Handle the "states" case.

        case "states":

            // Return the text result.

            return text ( "menu.file.csv.states" );

        // Handle the "transition_table" case.

        case "transition_table":

            // Return the text result.

            return text ( "menu.file.csv.transitionTable" );
    }
}


//--------------------------------------------------------------------------------------------------
// Function: csvTransferRoute
//
// Description:
//
//   Derives the CSV transfer route.
//
// Parameters:
//
//   - transferKind:
//     The transfer kind supplied to the operation.
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

function csvTransferRoute ( transferKind: CsvTransferKind ): ShellRoute
{
    // Dispatch according to the transfer kind value.

    switch ( transferKind )
    {
        // Handle the "model_metadata" case.

        case "model_metadata":

            // Return the computed result.

            return "stateMachine";

        // Handle the "actions" case.

        case "actions":

            // Return the computed result.

            return "actions";

        // Handle the "events" case.

        case "events":

            // Return the computed result.

            return "events";

        // Handle the group of case values that share the following outcome.

        case "state_actions":
        case "states":

            // Return the computed result.

            return "states";

        // Handle the "transition_table" case.

        case "transition_table":

            // Return the computed result.

            return "transitionTable";
    }
}


//--------------------------------------------------------------------------------------------------
// Function: diagnosticRoute
//
// Description:
//
//   Derives the diagnostic route.
//
// Parameters:
//
//   - diagnostic:
//     The diagnostic supplied to the operation.
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

function diagnosticRoute ( diagnostic: DomainDiagnostic ): ShellRoute
{
    // Initialize the local values needed by this operation.

    const path = diagnostic.path ?? "";


    // Handle the case where includes result is enabled.

    if ( path.includes ( "/transition_table" ) )
    {
        // Return the computed result.

        return "transitionTable";
    }


    // Handle the case where includes result is enabled.

    if ( path.includes ( "/events" ) )
    {
        // Return the computed result.

        return "events";
    }


    // Handle the case where includes result is enabled.

    if ( path.includes ( "/actions" ) )
    {
        // Return the computed result.

        return "actions";
    }


    // Handle the case where at least one branch condition is satisfied.

    if ( path.includes ( "/states" ) || diagnostic.context !== undefined )
    {
        // Return the computed result.

        return "states";
    }


    // Return the computed result.

    return "editor";
}


//--------------------------------------------------------------------------------------------------
// Function: fluentIcon
//
// Description:
//
//   Derives the fluent icon.
//
// Parameters:
//
//   - name:
//     The name supplied to the operation.
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

function fluentIcon ( name: string ): MenuIcon
{
    // Return the assembled result.

    return { name, source: "fluent" };
}


//--------------------------------------------------------------------------------------------------
// Function: customIcon
//
// Description:
//
//   Derives the custom icon.
//
// Parameters:
//
//   - size:
//     The size supplied to the operation.
//
//   - name:
//     The name supplied to the operation.
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

function customIcon ( size: 16 | 20, name: string ): MenuIcon
{
    // Return the assembled result.

    return { name: `${size}/${name}`, source: "custom" };
}


//--------------------------------------------------------------------------------------------------
// Function: initialConsoleEntries
//
// Description:
//
//   Derives the initial console entries.
//
// Parameters:
//
//   - warningCode:
//     The warning code supplied to the operation.
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

function initialConsoleEntries ( warningCode: "PREFERENCE_CORRUPT" | "PREFERENCE_VERSION_UNSUPPORTED" | null ):
    readonly ConsoleEntry[]
{
    // Initialize the local values needed by this operation.

    const entries: ConsoleEntry[] = [
        {
            code: "SHELL_READY",
            identifier: "shell-ready",
            severity: "message",
            source: "Application",
            text: text ( "console.initialMessage" ),
            timestamp: new Date ().toISOString (),
        },
    ];


    // Handle the case where warning code differs from an absent value.

    if ( warningCode !== null )
    {
        entries.push (
            {
                code: warningCode,
                identifier: `preference-warning-${warningCode.toLocaleLowerCase ()}`,
                severity: "warning",
                source: "Preferences",
                text: text ( warningCode === "PREFERENCE_CORRUPT"
                    ? "console.preferenceCorrupt"
                    : "console.preferenceVersion" ),
                timestamp: new Date ().toISOString (),
            }
        );
    }


    // Return the entries.

    return entries;
}


//--------------------------------------------------------------------------------------------------
// Function: Application
//
// Description:
//
//   Renders the application interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered application interface.
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

export function Application ( properties: ApplicationProperties = {} )
{
    // Initialize the local values needed by this operation.

    const serverGatewayFactory = properties.serverGatewayFactory ?? createBrowserServerGateway;
    const [ initialPreferenceLoad ]                       = useState ( loadBrowserApplicationPreferences );
    const [ preferences, setPreferences ]                 = useState <ApplicationPreferences> ( initialPreferenceLoad.preferences );
    const [ activeRoute, setActiveRoute ]                 = useState <ShellRoute> ( "solver" );
    const [ activeRegion, setActiveRegion ]               = useState <ShellRegion> ( "detail" );
    const [ chartSelectionCount, setChartSelectionCount ] = useState ( 0 );
    const [ chartExportStatus, setChartExportStatus ]     = useState<string | null> ( null );
    const [ editorExpanded, setEditorExpanded ]           = useState ( false );
    const [ documentWorkspace, setDocumentWorkspace ]     = useState <DocumentWorkspaceState> (
        createClosedDocumentWorkspace,
    );
    const [ filePort ]               = useState ( () => new BrowserFilePort () );
    const [ csvFilePort ]            = useState ( () => new BrowserCsvFilePort () );
    const [ printPort ]              = useState ( () => properties.printPort ?? new BrowserPrintPort () );
    const [ authoringDocumentCodec ] = useState ( () => new AuthoringDocumentCodec () );
    const [ documentCodec ]          = useState ( () => new AutomataDocumentCodec () );
    const [ chartLayoutPort ]        = useState ( () => new BrowserChartLayoutPort () );
    const [ chartRoutingPort ]       = useState ( () => new BrowserChartRoutingPort () );
    const [ printChartLayoutPort ]   = useState ( () => new BrowserChartLayoutPort () );
    const [ printChartRoutingPort ]  = useState ( () => new BrowserChartRoutingPort () );
    const [ contentHasher ]          = useState ( () => new Sha256ContentHasher () );
    const [ diagnosticChannel ]      = useState (
        () => properties.diagnosticChannel ??
            new DiagnosticChannel ( initialConsoleEntries ( initialPreferenceLoad.warningCode ) )
    );
    const [ serverGateway ] = useState<ServerGateway> (
        () => properties.serverGateway ?? serverGatewayFactory (),
    );
    const [ solverWorkerPort ]                                                          = useState ( () => properties.solverJobPort ?? new BrowserSolverWorkerPort () );
    const [ solverWorkspace, setSolverWorkspace ]                                       = useState<SolverWorkspaceState> ( createSolverWorkspaceState );
    const [ serverWorkspace, setServerWorkspace ]                                       = useState<ServerWorkspaceState> ( createServerWorkspaceState );
    const [ serverOperationPending, setServerOperationPending ]                         = useState ( false );
    const [ aboutDialogOpen, setAboutDialogOpen ]                                       = useState ( false );
    const [ pageSetupDialogOpen, setPageSetupDialogOpen ]                               = useState ( false );
    const [ settingsDialogOpen, setSettingsDialogOpen ]                                 = useState ( false );
    const [ dirtyDialogOpen, setDirtyDialogOpen ]                                       = useState ( false );
    const [ impactPlan, setImpactPlan ]                                                 = useState <DocumentCommandPlan | null> ( null );
    const [ pendingSolverCandidate, setPendingSolverCandidate ]                         = useState<SolverCandidate | null> ( null );
    const [ solverCsvDialog, setSolverCsvDialog ]                                       = useState<SolverCsvDialogState | null> ( null );
    const [ simulatorCsvDialog, setSimulatorCsvDialog ]                                 = useState<SolverCsvDialogState | null> ( null );
    const [ simulatorSession, setSimulatorSession ]                                     = useState<SimulatorSessionState> ( createSimulatorSessionState );
    const [ simulatorModelDifferenceDialogOpen, setSimulatorModelDifferenceDialogOpen ] = useState ( false );
    const [ pendingCsvImport, setPendingCsvImport ]                                     = useState <PendingCsvImport | null> ( null );
    const [ incompleteDocumentWarning, setIncompleteDocumentWarning ]                   = 
        useState<IncompleteDocumentWarningState | null> ( null );
    const [ transitionCsvMissingReferences, setTransitionCsvMissingReferences ] =
        useState<TransitionCsvMissingReferences | null> ( null );
    const [ messageDialog, setMessageDialog ] = useState <{
        readonly body: string;
        readonly severity: "error" | "message" | "warning";
    } | null> ( null );
    const [ settingsDraft, setSettingsDraft ]   = useState <ApplicationPreferences> ( initialPreferenceLoad.preferences );
    const [ pageSetupDraft, setPageSetupDraft ] = useState <PrintPageSetup> (
        () => extractPrintPageSetup ( initialPreferenceLoad.preferences ),
    );
    const [ printableReport, setPrintableReport ]                   = useState <PrintableReport | null> ( null );
    const [ pendingPrintChartCapture, setPendingPrintChartCapture ] = 
        useState<PendingPrintChartCapture | null> ( null );
    const [ consoleFilters, setConsoleFilters ] = useState <ConsoleFilterState> ( DEFAULT_CONSOLE_FILTERS );
    const [ consoleEntries, setConsoleEntries ] = useState <readonly ConsoleEntry[]> (
        () => diagnosticChannel.getEntries ()
    );
    const detailHeadingReference                  = useRef <HTMLHeadingElement> ( null );
    const pendingReplacementReference             = useRef <( () => Promise<void> | void ) | null> ( null );
    const pendingIncompleteDocumentSaveReference  = useRef<PendingIncompleteDocumentSave | null> ( null );
    const consoleEntrySequenceReference           = useRef ( 0 );
    const printOperationPendingReference          = useRef ( false );
    const printChartCaptureStartedReference       = useRef ( false );
    const preferenceSaveWarningPublishedReference = useRef ( false );

    // The identifier of the session whose staleness and trace truncation have already been reported
    // to the Console, so that a persisting condition is reported once rather than on every render.

    const simulatorStaleReportedReference      = useRef<string | null> ( null );
    const simulatorTruncationReportedReference = useRef<string | null> ( null );
    const documentWorkspaceReference           = useRef ( documentWorkspace );
    const serverWorkspaceReference             = useRef ( serverWorkspace );
    const serverOperationPendingReference      = useRef ( false );
    const serverAutoConnectStartedReference    = useRef ( false );
    const serverDisposalTimeoutReference       = useRef<number | null> ( null );
    const applicationMountedReference          = useRef ( true );


    //----------------------------------------------------------------------------------------------
    // Function: replaceServerWorkspace
    //
    // Description:
    //
    //   Replaces the server workspace.
    //
    // Parameters:
    //
    //   - nextWorkspace:
    //     The next workspace supplied to the operation.
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

    function replaceServerWorkspace ( nextWorkspace: ServerWorkspaceState ): void
    {
        serverWorkspaceReference.current = nextWorkspace;
        setServerWorkspace ( nextWorkspace );
    }


    //----------------------------------------------------------------------------------------------
    // Function: replaceDocumentWorkspace
    //
    // Description:
    //
    //   Replaces the document workspace.
    //
    // Parameters:
    //
    //   - nextWorkspace:
    //     The next workspace supplied to the operation.
    //
    //   - updateHostedSynchronization:
    //     The update hosted synchronization supplied to the operation.
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

    function replaceDocumentWorkspace (
        nextWorkspace: DocumentWorkspaceState,
        updateHostedSynchronization = true,
    ): void
    {
        // Initialize the local values needed by this operation.

        const previousDraft = documentWorkspaceReference.current.editorState?.draft ?? null;
        const nextDraft     = nextWorkspace.editorState?.draft ?? null;

        documentWorkspaceReference.current = nextWorkspace;
        setDocumentWorkspace ( nextWorkspace );


        // Handle the case where all required conditions are satisfied.

        if ( updateHostedSynchronization && previousDraft !== nextDraft )
        {
            replaceServerWorkspace ( markServerDocumentChanged ( serverWorkspaceReference.current ) );
        }

        const editorState = nextWorkspace.editorState;


        // Handle the case where editor state differs from an absent value.

        if ( editorState !== null )
        {
            setSolverWorkspace ( current => refreshSolverCandidateFreshness (
                current,
                editorState.documentRevision,
                editorState.solverRevision,
            ) );
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: updatePreferences
    //
    // Description:
    //
    //   Updates preferences.
    //
    // Parameters:
    //
    //   - partialPreferences:
    //     The partial preferences supplied to the operation.
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

    function updatePreferences ( partialPreferences: Partial <ApplicationPreferences> ): void
    {
        setPreferences ( currentPreferences => ( { ...currentPreferences, ...partialPreferences } ) );
    }


    //----------------------------------------------------------------------------------------------
    // Function: navigate
    //
    // Description:
    //
    //   Handles the navigate behavior.
    //
    // Parameters:
    //
    //   - route:
    //     The route supplied to the operation.
    //
    //   - focusPage:
    //     The focus page supplied to the operation.
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

    function navigate ( route: ShellRoute, focusPage = true ): void
    {
        setActiveRoute ( route );
        setActiveRegion ( "detail" );


        // Handle the case where includes result is enabled.

        if ( EDITOR_CHILD_ROUTES.includes ( route ) )
        {
            setEditorExpanded ( true );
        }


        // Handle the case where focus page is enabled.

        if ( focusPage )
        {
            window.setTimeout ( () => detailHeadingReference.current?.focus (), 0 );
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: selectTheme
    //
    // Description:
    //
    //   Selects theme.
    //
    // Parameters:
    //
    //   - theme:
    //     The theme supplied to the operation.
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

    function selectTheme ( theme: ApplicationPreferences["theme"] ): void
    {
        updatePreferences ( { theme } );
    }


    //----------------------------------------------------------------------------------------------
    // Function: openSettings
    //
    // Description:
    //
    //   Opens the settings.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   No value is returned.
    //
    // Preconditions:
    //
    //   - None.
    //
    // Postconditions:
    //
    //   - The described side effects are complete when the callable returns.
    //
    //----------------------------------------------------------------------------------------------

    function openSettings (): void
    {
        setSettingsDraft ( preferences );
        setSettingsDialogOpen ( true );
    }


    //----------------------------------------------------------------------------------------------
    // Function: openPageSetup
    //
    // Description:
    //
    //   Opens the page setup.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   No value is returned.
    //
    // Preconditions:
    //
    //   - None.
    //
    // Postconditions:
    //
    //   - The described side effects are complete when the callable returns.
    //
    //----------------------------------------------------------------------------------------------

    function openPageSetup (): void
    {
        setPageSetupDraft ( extractPrintPageSetup ( preferences ) );
        setPageSetupDialogOpen ( true );
    }


    //----------------------------------------------------------------------------------------------
    // Function: applyPageSetup
    //
    // Description:
    //
    //   Applies the page setup.
    //
    // Parameters:
    //
    //   - pageSetup:
    //     The page setup supplied to the operation.
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

    function applyPageSetup ( pageSetup: PrintPageSetup ): void
    {
        updatePreferences ( pageSetup );
        setPageSetupDraft ( pageSetup );
        setPageSetupDialogOpen ( false );
    }


    //----------------------------------------------------------------------------------------------
    // Function: performPrint
    //
    // Description:
    //
    //   Runs the print workflow.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   No value is returned.
    //
    // Preconditions:
    //
    //   - None.
    //
    // Postconditions:
    //
    //   - The described side effects are complete when the callable returns.
    //
    //----------------------------------------------------------------------------------------------

    function performPrint (): void
    {
        // Initialize the local values needed by this operation.

        const editorState = documentWorkspaceReference.current.editorState;


        // Handle the case where at least one branch condition is satisfied.

        if ( editorState === null || printOperationPendingReference.current )
        {
            // Return control to the caller.

            return;
        }


        // Initialize the local values needed by this operation.

        const fileName               = suggestedDocumentName ( documentWorkspaceReference.current );
        const hasVisibleChartElement = editorState.draft.stateMachine.states.length > 0 ||
            editorState.draft.chart.indicators.initialStateIndicator !== null ||
            editorState.draft.chart.indicators.terminalStateIndicators.length > 0 ||
            editorState.draft.chart.draftTransitions.length > 0;

        printOperationPendingReference.current    = true;
        printChartCaptureStartedReference.current = false;


        // Handle the case where all required conditions are satisfied.

        if ( extractPrintPageSetup ( preferences ).printIncludeStateChart && hasVisibleChartElement )
        {
            setPendingPrintChartCapture ( {
                documentRevision: editorState.documentRevision,
                draft:            editorState.draft,
                fileName,
                preferences,
            } );

            // Return control to the caller.

            return;
        }

        setPrintableReport ( createPrintableReport (
            editorState.draft,
            editorState.documentRevision,
            preferences,
            fileName,
        ) );
    }


    //----------------------------------------------------------------------------------------------
    // Function: applySettings
    //
    // Description:
    //
    //   Applies the settings.
    //
    // Parameters:
    //
    //   - nextPreferences:
    //     The next preferences supplied to the operation.
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

    function applySettings ( nextPreferences: ApplicationPreferences ): void
    {
        // Initialize the local values needed by this operation.

        const serverUrlChanged = nextPreferences.serverUrl !== preferences.serverUrl;


        // Handle the case where all required conditions are satisfied.

        if ( serverUrlChanged && serverOperationPendingReference.current )
        {
            // Return control to the caller.

            return;
        }

        setPreferences ( nextPreferences );
        setSettingsDraft ( nextPreferences );
        setSettingsDialogOpen ( false );


        // Handle the case where server URL changed is enabled.

        if ( serverUrlChanged )
        {
            void performServerConnect ( nextPreferences.serverUrl );
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: publishConsoleEntry
    //
    // Description:
    //
    //   Publishes console entry.
    //
    // Parameters:
    //
    //   - code:
    //     The code supplied to the operation.
    //
    //   - severity:
    //     The severity supplied to the operation.
    //
    //   - source:
    //     The source supplied to the operation.
    //
    //   - entryText:
    //     The entry text supplied to the operation.
    //
    //   - route:
    //     The route supplied to the operation.
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

    function publishConsoleEntry (
        code: string,
        severity: ConsoleEntry["severity"],
        source: string,
        entryText: string,
        route?: ShellRoute,
    ): void
    {
        consoleEntrySequenceReference.current++;
        diagnosticChannel.publish (
            {
                code,
                ...( route === undefined ? {} : { context: { label: entryText, route } } ),
                identifier: `${code.toLocaleLowerCase ()}-${consoleEntrySequenceReference.current}`,
                severity,
                source,
                text: entryText,
                timestamp: new Date ().toISOString (),
            },
        );
    }


    //----------------------------------------------------------------------------------------------
    // Function: reportServerEvent
    //
    // Description:
    //
    //   Reports the server event.
    //
    // Parameters:
    //
    //   - event:
    //     The event to process.
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

    function reportServerEvent ( event: ServerEventEnvelope ): void
    {
        // Dispatch according to the event event value.

        switch ( event.event )
        {
            // Handle the "server.lifecycle" case.

            case "server.lifecycle":
                publishConsoleEntry (
                    `SERVER_WORKER_${event.payload.phase.toLocaleUpperCase ()}`,
                    event.payload.phase === "failed" ? "error" : "message",
                    "Server Worker",
                    event.payload.message,
                );

                // Return control to the caller.

                return;

            // Handle the "server.diagnostic" case.

            case "server.diagnostic":
                publishConsoleEntry (
                    event.payload.diagnostic.code,
                    event.payload.diagnostic.severity === "information"
                        ? "message"
                        : event.payload.diagnostic.severity,
                    "Server Worker",
                    `${event.payload.diagnostic.message} ${event.payload.diagnostic.remediation}`,
                );

                // Return control to the caller.

                return;

            // Handle the "model.changed" case.

            case "model.changed":
                publishConsoleEntry (
                    "HOSTED_MODEL_CHANGED",
                    "message",
                    "Server Worker",
                    event.payload.disposition === "unchanged"
                        ? `The hosted document remained at revision ${event.payload.modelRevision}.`
                        : `The hosted document changed from ${event.payload.previousModelRevision} ` +
                            `to ${event.payload.modelRevision}.`,
                    "editor",
                );

                // Return control to the caller.

                return;
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: reportDiagnostics
    //
    // Description:
    //
    //   Reports the diagnostics.
    //
    // Parameters:
    //
    //   - diagnostics:
    //     The diagnostics supplied to the operation.
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

    function reportDiagnostics ( diagnostics: readonly DomainDiagnostic[] ): void
    {
        reportBoundedDiagnostics (
            diagnostics,
            diagnostic => publishConsoleEntry (
                diagnostic.code,
                diagnostic.severity,
                diagnostic.source,
                `${diagnostic.message} ${diagnostic.remediation}`,
                diagnosticRoute ( diagnostic ),
            ),
            "Validation",
            "editor",
        );
    }


    //----------------------------------------------------------------------------------------------
    // Function: reportBoundedDiagnostics
    //
    // Description:
    //
    //   Reports the bounded diagnostics.
    //
    // Parameters:
    //
    //   - diagnostics:
    //     The diagnostics supplied to the operation.
    //
    //   - reportDiagnostic:
    //     The report diagnostic supplied to the operation.
    //
    //   - source:
    //     The source supplied to the operation.
    //
    //   - route:
    //     The route supplied to the operation.
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

    function reportBoundedDiagnostics<Diagnostic> (
        diagnostics: readonly Diagnostic[],
        reportDiagnostic: ( diagnostic: Diagnostic ) => void,
        source: string,
        route: ShellRoute,
    ): void
    {
        diagnostics.slice ( 0, MAXIMUM_CONSOLE_DIAGNOSTIC_BATCH_COUNT ).forEach ( reportDiagnostic );


        // Handle the case where diagnostics length exceeds maximum console diagnostic batch count.

        if ( diagnostics.length > MAXIMUM_CONSOLE_DIAGNOSTIC_BATCH_COUNT )
        {
            publishConsoleEntry (
                "DIAGNOSTICS_TRUNCATED",
                "warning",
                source,
                `${diagnostics.length - MAXIMUM_CONSOLE_DIAGNOSTIC_BATCH_COUNT} additional diagnostic(s) ` +
                    "were omitted from this Console batch.",
                route,
            );
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: showDiagnosticFailure
    //
    // Description:
    //
    //   Handles the show diagnostic failure behavior.
    //
    // Parameters:
    //
    //   - diagnostics:
    //     The diagnostics supplied to the operation.
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

    function showDiagnosticFailure ( diagnostics: readonly DomainDiagnostic[] ): void
    {
        reportDiagnostics ( diagnostics );

        const primaryDiagnostic = diagnostics [ 0 ];


        // Handle the case where primary diagnostic differs from undefined.

        if ( primaryDiagnostic !== undefined )
        {
            setMessageDialog (
                {
                    body:     `${primaryDiagnostic.message} ${primaryDiagnostic.remediation}`,
                    severity: "error",
                },
            );
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: reportServerFailure
    //
    // Description:
    //
    //   Reports the server failure.
    //
    // Parameters:
    //
    //   - failure:
    //     The failure supplied to the operation.
    //
    //   - showDialog:
    //     The show dialog supplied to the operation.
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

    function reportServerFailure ( failure: ServerWorkspaceFailure, showDialog = true ): void
    {
        // Handle the case where failure diagnostics differs from undefined.

        if ( failure.diagnostics !== undefined )
        {
            reportDiagnostics ( failure.diagnostics );
        }


        // Initialize the local values needed by this operation.

        const failureText = `${failure.message} ${failure.remediation}`;
        const severity    = failure.code === "HOSTED_MODEL_CONFLICT" ? "warning" : "error";

        publishConsoleEntry ( failure.code, severity, "Server", failureText );


        // Handle the case where show dialog is enabled.

        if ( showDialog )
        {
            setMessageDialog ( { body: failureText, severity } );
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: beginServerOperation
    //
    // Description:
    //
    //   Begins the server operation.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   True when the named condition is satisfied; otherwise, false.
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

    function beginServerOperation (): boolean
    {
        // Handle the case where server operation pending reference current is enabled.

        if ( serverOperationPendingReference.current )
        {
            // Return the computed result.

            return false;
        }

        serverOperationPendingReference.current = true;
        setServerOperationPending ( true );


        // Return the computed result.

        return true;
    }


    //----------------------------------------------------------------------------------------------
    // Function: finishServerOperation
    //
    // Description:
    //
    //   Finalizes the server operation.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   No value is returned.
    //
    // Preconditions:
    //
    //   - None.
    //
    // Postconditions:
    //
    //   - The described side effects are complete when the callable returns.
    //
    //----------------------------------------------------------------------------------------------

    function finishServerOperation (): void
    {
        serverOperationPendingReference.current = false;


        // Handle the case where application mounted reference current is enabled.

        if ( applicationMountedReference.current )
        {
            setServerOperationPending ( false );
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: performServerConnect
    //
    // Description:
    //
    //   Runs the server connect workflow.
    //
    // Parameters:
    //
    //   - serverUrl:
    //     The server URL supplied to the operation.
    //
    //   - showFailureDialog:
    //     The show failure dialog supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    async function performServerConnect (
        serverUrl         = preferences.serverUrl,
        showFailureDialog = true,
    ): Promise<void>
    {
        // Handle the case where the begin server operation result condition is not satisfied.

        if ( !beginServerOperation () )
        {
            // Return control to the caller.

            return;
        }

        const connectingWorkspace = beginServerConnection ( serverWorkspaceReference.current );

        replaceServerWorkspace ( connectingWorkspace );


        // Run the operation that may report a recoverable failure.

        try
        {
            // Initialize the local values needed by this operation.

            const result = await connectServerWorkspace ( connectingWorkspace, serverGateway, serverUrl.trim () );


            // Handle the case where the application mounted reference current condition is not
            // satisfied.

            if ( !applicationMountedReference.current )
            {
                // Return control to the caller.

                return;
            }

            replaceServerWorkspace ( result.serverWorkspace );


            // Handle the case where the result is successful condition is not satisfied.

            if ( !result.isSuccessful )
            {
                reportServerFailure ( result.failure, showFailureDialog );

                // Return control to the caller.

                return;
            }

            publishConsoleEntry (
                "SERVER_CONNECTED",
                "message",
                "Server",
                result.value.modelRevision === null
                    ? "Connected to the server; no hosted model is ready."
                    : `Connected to the server at hosted revision ${result.value.modelRevision}.`,
            );
        }
        finally
        {
            // Complete the cleanup required after the attempted operation.

            finishServerOperation ();
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: performServerDisconnect
    //
    // Description:
    //
    //   Runs the server disconnect workflow.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   A promise that resolves when the operation is complete.
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

    async function performServerDisconnect (): Promise<void>
    {
        // Handle the case where the begin server operation result condition is not satisfied.

        if ( !beginServerOperation () )
        {
            // Return control to the caller.

            return;
        }


        // Run the operation that may report a recoverable failure.

        try
        {
            // Initialize the local values needed by this operation.

            const result = await disconnectServerWorkspace ( serverWorkspaceReference.current, serverGateway );


            // Handle the case where the application mounted reference current condition is not
            // satisfied.

            if ( !applicationMountedReference.current )
            {
                // Return control to the caller.

                return;
            }

            replaceServerWorkspace ( result.serverWorkspace );


            // Handle the case where the result is successful condition is not satisfied.

            if ( !result.isSuccessful )
            {
                reportServerFailure ( result.failure );

                // Return control to the caller.

                return;
            }

            publishConsoleEntry ( "SERVER_DISCONNECTED", "message", "Server", "Disconnected from the server." );
        }
        finally
        {
            // Complete the cleanup required after the attempted operation.

            finishServerOperation ();
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: performServerhest
    //
    // Description:
    //
    //   Runs the server test workflow.
    //
    // Parameters:
    //
    //   - serverUrl:
    //     The server URL supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    async function performServerTest ( serverUrl?: string ): Promise<void>
    {
        // Handle the case where the begin server operation result condition is not satisfied.

        if ( !beginServerOperation () )
        {
            // Return control to the caller.

            return;
        }


        // Initialize the local values needed by this operation.

        let probeGateway:    ServerGateway | null = null;
        let testedGateway:   ServerGateway        = serverGateway;
        let testedWorkspace: ServerWorkspaceState = serverWorkspaceReference.current;


        // Run the operation that may report a recoverable failure.

        try
        {
            // Handle the case where server URL differs from undefined.

            if ( serverUrl !== undefined )
            {
                probeGateway    = serverGatewayFactory ();
                testedGateway   = probeGateway;
                testedWorkspace = beginServerConnection ( createServerWorkspaceState () );

                const connectionResult = await connectServerWorkspace (
                    testedWorkspace,
                    testedGateway,
                    serverUrl.trim (),
                );


                // Handle the case where the application mounted reference current condition is not
                // satisfied.

                if ( !applicationMountedReference.current )
                {
                    // Return control to the caller.

                    return;
                }


                // Handle the case where the connection result is successful condition is not
                // satisfied.

                if ( !connectionResult.isSuccessful )
                {
                    reportServerFailure ( connectionResult.failure );

                    // Return control to the caller.

                    return;
                }

                testedWorkspace = connectionResult.serverWorkspace;
            }

            const result = await testServerWorkspace ( testedWorkspace, testedGateway );


            // Handle the case where the application mounted reference current condition is not
            // satisfied.

            if ( !applicationMountedReference.current )
            {
                // Return control to the caller.

                return;
            }


            // Handle the case where probe gateway matches an absent value.

            if ( probeGateway === null )
            {
                replaceServerWorkspace ( result.serverWorkspace );
            }


            // Handle the case where the result is successful condition is not satisfied.

            if ( !result.isSuccessful )
            {
                reportServerFailure ( result.failure );

                // Return control to the caller.

                return;
            }

            publishConsoleEntry (
                "SERVER_TEST_PASSED",
                "message",
                "Server",
                result.value.isReady
                    ? `Server liveness and readiness passed at revision ${result.value.modelRevision ?? "none"}.`
                    : "Server liveness passed, but no hosted model is ready.",
            );
        }
        finally
        {
            // Complete the cleanup required after the attempted operation.

            if ( probeGateway !== null )
            {
                // Initialize the local values needed by this operation.

                const disposalResult = await disposeServerWorkspace ( testedWorkspace, probeGateway );


                // Handle the case where all required conditions are satisfied.

                if ( applicationMountedReference.current && !disposalResult.isSuccessful )
                {
                    reportServerFailure ( disposalResult.failure );
                }
            }

            finishServerOperation ();
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: pushCurrentDocumentToServer
    //
    // Description:
    //
    //   Pushes the current document to server.
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

    async function pushCurrentDocumentToServer (): Promise<ServerWorkspaceState | null>
    {
        // Initialize the local values needed by this operation.

        const documentSnapshot          = captureDocumentOperationSnapshot ( documentWorkspaceReference.current );
        const dispatchedServerWorkspace = serverWorkspaceReference.current;
        const result                    = await pushDocumentToServer (
            dispatchedServerWorkspace,
            documentSnapshot.workspaceReference,
            serverGateway,
            contentHasher,
        );


        // Handle the case where the application mounted reference current condition is not
        // satisfied.

        if ( !applicationMountedReference.current )
        {
            // Return the computed result.

            return null;
        }


        // Handle the case where the result is successful condition is not satisfied.

        if ( !result.isSuccessful )
        {
            replaceServerWorkspace ( result.serverWorkspace );
            reportServerFailure ( result.failure );

            // Return the computed result.

            return null;
        }


        // Handle the case where document changed since snapshot result is enabled.

        if ( documentChangedSinceSnapshot ( documentSnapshot, documentWorkspaceReference.current ) )
        {
            replaceServerWorkspace ( markServerDocumentChanged ( result.serverWorkspace ) );
            publishConsoleEntry (
                "HOSTED_MODEL_PUSH_DIVERGED",
                "warning",
                "Server",
                "Push completed, but the client document changed while the request was pending. " +
                    "The newer client document was preserved as local changes.",
                "editor",
            );
            setMessageDialog (
                {
                    body: "Push completed with an older client snapshot because the document changed while the " +
                        "request was pending. The newer client document was preserved; review it before pushing " +
                        "again.",
                    severity: "warning",
                },
            );

            // Return the computed result.

            return null;
        }

        replaceServerWorkspace ( result.serverWorkspace );
        publishConsoleEntry (
            result.value.isIdempotent ? "HOSTED_MODEL_UNCHANGED" : "HOSTED_MODEL_PUSHED",
            "message",
            "Server",
            result.value.isIdempotent
                ? `The hosted model already matched revision ${result.value.modelRevision}.`
                : `Pushed the complete document at hosted revision ${result.value.modelRevision}.`,
            "editor",
        );


        // Return the computed result.

        return result.serverWorkspace;
    }


    //----------------------------------------------------------------------------------------------
    // Function: performServerPush
    //
    // Description:
    //
    //   Runs the server push workflow.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   A promise that resolves when the operation is complete.
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

    async function performServerPush (): Promise<void>
    {
        // Handle the case where the begin server operation result condition is not satisfied.

        if ( !beginServerOperation () )
        {
            // Return control to the caller.

            return;
        }


        // Run the operation that may report a recoverable failure.

        try
        {
            await pushCurrentDocumentToServer ();
        }
        finally
        {
            // Complete the cleanup required after the attempted operation.

            finishServerOperation ();
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: performServerPull
    //
    // Description:
    //
    //   Runs the server pull workflow.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   A promise that resolves when the operation is complete.
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

    async function performServerPull (): Promise<void>
    {
        // Handle the case where the begin server operation result condition is not satisfied.

        if ( !beginServerOperation () )
        {
            // Return control to the caller.

            return;
        }


        // Initialize the local values needed by this operation.

        const documentSnapshot          = captureDocumentOperationSnapshot ( documentWorkspaceReference.current );
        const dispatchedServerWorkspace = serverWorkspaceReference.current;


        // Run the operation that may report a recoverable failure.

        try
        {
            // Initialize the local values needed by this operation.

            const result = await pullDocumentFromServer (
                dispatchedServerWorkspace,
                documentSnapshot.workspaceReference,
                serverGateway,
                documentCodec,
                contentHasher,
            );


            // Handle the case where the application mounted reference current condition is not
            // satisfied.

            if ( !applicationMountedReference.current )
            {
                // Return control to the caller.

                return;
            }


            // Handle the case where the result is successful condition is not satisfied.

            if ( !result.isSuccessful )
            {
                replaceServerWorkspace ( result.serverWorkspace );
                reportServerFailure ( result.failure );

                // Return control to the caller.

                return;
            }


            // Handle the case where document changed since snapshot result is enabled.

            if ( documentChangedSinceSnapshot ( documentSnapshot, documentWorkspaceReference.current ) )
            {
                replaceServerWorkspace ( markServerDocumentChanged ( result.serverWorkspace ) );
                publishConsoleEntry (
                    "HOSTED_MODEL_PULL_SUPERSEDED",
                    "warning",
                    "Server",
                    "Pull completed, but the client document changed while the request was pending. " +
                        "The newer client document was preserved.",
                    "editor",
                );
                setMessageDialog (
                    {
                        body: "The hosted document was received, but the client document changed while Pull was " +
                            "pending. The newer client document was preserved; run Pull again when it is safe to " +
                            "replace it.",
                        severity: "warning",
                    },
                );

                // Return control to the caller.

                return;
            }

            replaceServerWorkspace ( result.serverWorkspace );
            replaceDocumentWorkspace ( result.documentWorkspace, false );
            setSolverWorkspace ( createSolverWorkspaceState () );
            publishConsoleEntry (
                "HOSTED_MODEL_PULLED",
                "message",
                "Server",
                `Pulled hosted revision ${result.value.modelRevision} into a clean client document.`,
                "editor",
            );
            navigate ( "editor" );
        }
        finally
        {
            // Complete the cleanup required after the attempted operation.

            finishServerOperation ();
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: executeSave
    //
    // Description:
    //
    //   Executes the save.
    //
    // Parameters:
    //
    //   - forceSaveAs:
    //     The force save as supplied to the operation.
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

    async function executeSave ( forceSaveAs: boolean ): Promise<boolean>
    {
        // Initialize the local values needed by this operation.

        const draft                 = documentWorkspace.editorState?.draft;
        const persistenceValidation = draft === undefined ? null : validatePersistableAuthoringDraft ( draft );
        const incompleteDiagnostics = persistenceValidation === null
            ? []
            : filterIncompleteAuthoringDiagnostics ( persistenceValidation.diagnostics );
        const saveResult = await saveDocumentWorkspace (
            documentWorkspace,
            filePort,
            preferences.saveBackup,
            forceSaveAs,
            preferences.expandedStateMinimumHeight,
        );


        // Handle the case where save result status matches the cancelled value.

        if ( saveResult.status === "cancelled" )
        {
            // Return the computed result.

            return false;
        }


        // Handle the case where save result status matches the failed value.

        if ( saveResult.status === "failed" )
        {
            // Initialize the local values needed by this operation.

            const validationResult = validateDocumentWorkspace ( documentWorkspace );

            replaceDocumentWorkspace ( validationResult.workspace );
            showDiagnosticFailure ( saveResult.diagnostics );


            // Return the computed result.

            return false;
        }

        replaceDocumentWorkspace ( saveResult.workspace );
        publishConsoleEntry (
            "FILE_SAVED",
            "message",
            "File",
            `Saved '${saveResult.workspace.displayName ?? "document"}'.`,
            "editor",
        );

        incompleteDiagnostics.forEach ( diagnostic =>
        {
            // Handle the case where diagnostic code matches the STATE_DEFINITIONS_MISSING value.

            if ( diagnostic.code === "STATE_DEFINITIONS_MISSING" )
            {
                publishConsoleEntry (
                    "FILE_SAVED_WITHOUT_STATES",
                    "warning",
                    "File",
                    "Saved the project without any states. Add at least one state before hosting or running it.",
                    "states",
                );
            }
            else if ( diagnostic.code === "INITIAL_STATE_UNDEFINED" )
            {
                publishConsoleEntry (
                    "FILE_SAVED_WITHOUT_INITIAL_STATE",
                    "warning",
                    "File",
                    "Saved the project without an initial state. Select an initial state before hosting or running it.",
                    "stateMachine",
                );
            }
        } );


        // Handle the case where limitation differs from an absent value.

        if ( saveResult.writeResult.limitation !== null )
        {
            publishConsoleEntry (
                "FILE_BACKUP_SKIPPED",
                "warning",
                "File",
                saveResult.writeResult.limitation,
                "editor",
            );
        }


        // Return the computed result.

        return true;
    }


    //----------------------------------------------------------------------------------------------
    // Function: performSave
    //
    // Description:
    //
    //   Runs the save workflow.
    //
    // Parameters:
    //
    //   - forceSaveAs:
    //     The force save as supplied to the operation.
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

    async function performSave ( forceSaveAs: boolean ): Promise<boolean>
    {
        // Initialize the local values needed by this operation.

        const draft                 = documentWorkspace.editorState?.draft;
        const persistenceValidation = draft === undefined ? null : validatePersistableAuthoringDraft ( draft );


        // Handle the case where at least one branch condition is satisfied.

        if ( persistenceValidation === null || !persistenceValidation.isValid )
        {
            // Return the execute save result.

            return executeSave ( forceSaveAs );
        }

        const incompleteDiagnostics = filterIncompleteAuthoringDiagnostics ( persistenceValidation.diagnostics );


        // Handle the case where incomplete diagnostics length equals 0.

        if ( incompleteDiagnostics.length === 0 )
        {
            // Return the execute save result.

            return executeSave ( forceSaveAs );
        }


        // Return the computed result.

        return new Promise<boolean> ( resolve =>
        {
            pendingIncompleteDocumentSaveReference.current = { forceSaveAs, resolve };
            setIncompleteDocumentWarning ( { diagnostics: incompleteDiagnostics, mode: "save" } );
        } );
    }


    //----------------------------------------------------------------------------------------------
    // Function: cancelIncompleteDocumentSave
    //
    // Description:
    //
    //   Cancels the incomplete document save.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   No value is returned.
    //
    // Preconditions:
    //
    //   - None.
    //
    // Postconditions:
    //
    //   - The described side effects are complete when the callable returns.
    //
    //----------------------------------------------------------------------------------------------

    function cancelIncompleteDocumentSave (): void
    {
        // Initialize the local values needed by this operation.

        const pendingSave = pendingIncompleteDocumentSaveReference.current;

        pendingIncompleteDocumentSaveReference.current = null;
        setIncompleteDocumentWarning ( null );
        pendingSave?.resolve ( false );
    }


    //----------------------------------------------------------------------------------------------
    // Function: confirmIncompleteDocumentSave
    //
    // Description:
    //
    //   Confirms the incomplete document save.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   A promise that resolves when the operation is complete.
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

    async function confirmIncompleteDocumentSave (): Promise<void>
    {
        // Initialize the local values needed by this operation.

        const pendingSave = pendingIncompleteDocumentSaveReference.current;

        pendingIncompleteDocumentSaveReference.current = null;
        setIncompleteDocumentWarning ( null );


        // Handle the case where pending save differs from an absent value.

        if ( pendingSave !== null )
        {
            pendingSave.resolve ( await executeSave ( pendingSave.forceSaveAs ) );
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: performOpen
    //
    // Description:
    //
    //   Runs the open workflow.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   A promise that resolves when the operation is complete.
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

    async function performOpen (): Promise<void>
    {
        // Initialize the local values needed by this operation.

        const openResult = await openDocumentWorkspace ( filePort, authoringDocumentCodec );


        // Handle the case where open result status matches the failed value.

        if ( openResult.status === "failed" )
        {
            showDiagnosticFailure ( openResult.diagnostics );

            // Return control to the caller.

            return;
        }


        // Handle the case where open result status matches the opened value.

        if ( openResult.status === "opened" )
        {
            replaceDocumentWorkspace ( openResult.workspace );
            setSolverWorkspace ( createSolverWorkspaceState () );
            reportDiagnostics ( openResult.diagnostics );
            publishConsoleEntry (
                "FILE_OPENED",
                "message",
                "File",
                `Opened '${openResult.workspace.displayName ?? "document"}'.`,
                "editor",
            );
            navigate ( "editor" );

            const incompleteDiagnostics = filterIncompleteAuthoringDiagnostics ( openResult.diagnostics );


            // Handle the case where incomplete diagnostics length exceeds the 0 value.

            if ( incompleteDiagnostics.length > 0 )
            {
                setIncompleteDocumentWarning ( { diagnostics: incompleteDiagnostics, mode: "open" } );
            }
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: performNew
    //
    // Description:
    //
    //   Runs the new workflow.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   No value is returned.
    //
    // Preconditions:
    //
    //   - None.
    //
    // Postconditions:
    //
    //   - The described side effects are complete when the callable returns.
    //
    //----------------------------------------------------------------------------------------------

    function performNew (): void
    {
        replaceDocumentWorkspace ( createNewDocumentWorkspace () );
        setSolverWorkspace ( createSolverWorkspaceState () );
        publishConsoleEntry ( "DOCUMENT_NEW", "message", "Document", "Created a new in-memory draft.", "stateMachine" );
        navigate ( "stateMachine" );
    }


    //----------------------------------------------------------------------------------------------
    // Function: performClose
    //
    // Description:
    //
    //   Runs the close workflow.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   No value is returned.
    //
    // Preconditions:
    //
    //   - None.
    //
    // Postconditions:
    //
    //   - The described side effects are complete when the callable returns.
    //
    //----------------------------------------------------------------------------------------------

    function performClose (): void
    {
        replaceDocumentWorkspace ( createClosedDocumentWorkspace () );
        setSolverWorkspace ( createSolverWorkspaceState () );
        publishConsoleEntry ( "DOCUMENT_CLOSED", "message", "Document", "Closed the client document.", "editor" );
    }


    //----------------------------------------------------------------------------------------------
    // Function: requestDocumentReplacement
    //
    // Description:
    //
    //   Requests the document replacement.
    //
    // Parameters:
    //
    //   - operation:
    //     The operation supplied to the operation.
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

    function requestDocumentReplacement ( operation: () => Promise<void> | void ): void
    {
        // Confirm replacement before discarding a dirty authoring draft.

        if ( documentWorkspace.editorState?.dirty === true )
        {
            pendingReplacementReference.current = operation;
            setDirtyDialogOpen ( true );
        }
        else
        {
            // Handle the remaining case after the preceding condition is false.

            void operation ();
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: continuePendingReplacement
    //
    // Description:
    //
    //   Derives the continue pending replacement.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   A promise that resolves when the operation is complete.
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

    async function continuePendingReplacement (): Promise<void>
    {
        // Initialize the local values needed by this operation.

        const operation = pendingReplacementReference.current;

        pendingReplacementReference.current = null;
        setDirtyDialogOpen ( false );


        // Handle the case where operation differs from an absent value.

        if ( operation !== null )
        {
            await operation ();
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: saveAndContinuePendingReplacement
    //
    // Description:
    //
    //   Saves the and continue pending replacement.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   A promise that resolves when the operation is complete.
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

    async function saveAndContinuePendingReplacement (): Promise<void>
    {
        // Handle the case where current value is enabled.

        if ( await performSave ( false ) )
        {
            await continuePendingReplacement ();
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: reportCommandFailure
    //
    // Description:
    //
    //   Reports the command failure.
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

    function reportCommandFailure ( code: string, message: string ): void
    {
        publishConsoleEntry ( code, "error", activeRoute === "chart" ? "Chart" : "Editor", message, activeRoute );
        setMessageDialog ( { body: message, severity: "error" } );
    }


    //----------------------------------------------------------------------------------------------
    // Function: performChartImageExport
    //
    // Description:
    //
    //   Runs the chart image export workflow.
    //
    // Parameters:
    //
    //   - canvas:
    //     The canvas supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    async function performChartImageExport ( canvas: HTMLElement ): Promise<void>
    {
        // Initialize the local values needed by this operation.

        const draft = documentWorkspace.editorState?.draft;


        // Handle the case where draft matches undefined.

        if ( draft === undefined )
        {
            // Return control to the caller.

            return;
        }


        // Run the operation that may report a recoverable failure.

        try
        {
            // Initialize the local values needed by this operation.

            const displayName = await exportChartImage ( {
                canvas,
                modelName: draft.settings.name,

                // The grid color is resolved for the active theme here, the same way the live Chart
                // resolves it, so the exporter never has to know how a theme change re-expresses
                // one.

                preferences:
                {
                    ...preferences,
                    gridColor: adaptChartGridColor (
                        preferences.gridColor,
                        preferences.gridColorTheme,
                        preferences.theme,
                    ),
                },
            } );


            // Handle the case where display name differs from an absent value.

            if ( displayName !== null )
            {
                // Initialize the local values needed by this operation.

                const status = `Saved Chart image: ${displayName}`;

                setChartExportStatus ( status );
                publishConsoleEntry ( "CHART_IMAGE_EXPORTED", "message", "Chart", status, "chart" );
                window.setTimeout ( () => setChartExportStatus ( current => current === status ? null : current ), 4_000 );
            }
        }
        catch ( error )
        {
            // Recover from the reported failure without hiding its outcome.

            reportCommandFailure (
                "CHART_IMAGE_EXPORT_FAILURE",
                error instanceof Error ? error.message : "The Chart image could not be saved.",
            );
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: commitCommandPlan
    //
    // Description:
    //
    //   Commits the command plan.
    //
    // Parameters:
    //
    //   - plan:
    //     The plan supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    function commitCommandPlan ( plan: DocumentCommandPlan ): boolean
    {
        // Initialize the local values needed by this operation.

        const result = commitWorkspaceDocumentCommand ( documentWorkspace, plan );


        // Handle the case where result is successful is enabled.

        if ( result.isSuccessful )
        {
            replaceDocumentWorkspace ( result.workspace );

            // Return the computed result.

            return true;
        }

        reportCommandFailure ( result.code, result.message );

        // Return the computed result.

        return false;
    }


    //----------------------------------------------------------------------------------------------
    // Function: dispatchDocumentCommand
    //
    // Description:
    //
    //   Derives the dispatch document command.
    //
    // Parameters:
    //
    //   - commandFactory:
    //     The command factory supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    function dispatchDocumentCommand ( commandFactory: DocumentCommandFactory ): boolean
    {
        // Initialize the local values needed by this operation.

        const editorState = documentWorkspace.editorState;


        // Handle the case where editor state matches an absent value.

        if ( editorState === null )
        {
            reportCommandFailure ( "DOCUMENT_MISSING", "Create or open a document before editing." );

            // Return the computed result.

            return false;
        }


        // Initialize the local values needed by this operation.

        const command    = commandFactory ( editorState.documentRevision );
        const planResult = planWorkspaceDocumentCommand ( documentWorkspace, command );


        // Handle the case where the plan result is successful condition is not satisfied.

        if ( !planResult.isSuccessful )
        {
            reportCommandFailure ( planResult.code, planResult.message );

            // Return the computed result.

            return false;
        }


        // Handle the case where at least one branch condition is satisfied.

        if ( command.kind === "delete_entity" || command.kind === "delete_transition" )
        {
            setImpactPlan ( planResult.plan );

            // Return the computed result.

            return true;
        }


        // Return the commit command plan result.

        return commitCommandPlan ( planResult.plan );
    }


    //----------------------------------------------------------------------------------------------
    // Function: updateChartStatesExpanded
    //
    // Description:
    //
    //   Updates chart states expanded.
    //
    // Parameters:
    //
    //   - expandStates:
    //     The expand states supplied to the operation.
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

    function updateChartStatesExpanded ( expandStates: boolean ): void
    {
        // Initialize the local values needed by this operation.

        const editorState = documentWorkspace.editorState;


        // Handle the case where editor state matches an absent value.

        if ( editorState === null )
        {
            reportCommandFailure ( "DOCUMENT_MISSING", "Create or open a document before editing." );

            // Return control to the caller.

            return;
        }

        const planResult = planWorkspaceDocumentCommand (
            documentWorkspace,
            {
                kind: "set_chart_expand_states",
                expandStates,
                expectedRevision: editorState.documentRevision,
            },
        );


        // Handle the case where the plan result is successful condition is not satisfied.

        if ( !planResult.isSuccessful )
        {
            reportCommandFailure ( planResult.code, planResult.message );

            // Return control to the caller.

            return;
        }

        const previousDocumentRevision = editorState.documentRevision;


        // Handle the case where commit command plan result is enabled.

        if ( commitCommandPlan ( planResult.plan ) )
        {
            setSolverWorkspace ( current => rebaseSolverCandidateAfterChartSettingChange (
                current,
                previousDocumentRevision,
                previousDocumentRevision + 1,
                editorState.solverRevision,
            ) );
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: performUndo
    //
    // Description:
    //
    //   Runs the undo workflow.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   No value is returned.
    //
    // Preconditions:
    //
    //   - None.
    //
    // Postconditions:
    //
    //   - The described side effects are complete when the callable returns.
    //
    //----------------------------------------------------------------------------------------------

    function performUndo (): void
    {
        // Initialize the local values needed by this operation.

        const previousEditorState = documentWorkspace.editorState;
        const historyCommandKind  = previousEditorState?.undoStack.at ( -1 )?.commandKind;
        const result              = undoWorkspaceDocumentCommand ( documentWorkspace );


        // Handle the case where result is successful is enabled.

        if ( result.isSuccessful )
        {
            replaceDocumentWorkspace ( result.workspace );


            // Handle the case where all required conditions are satisfied.

            if ( historyCommandKind === "set_chart_expand_states" && previousEditorState !== null &&
                result.workspace.editorState !== null )
            {
                setSolverWorkspace ( current => rebaseSolverCandidateAfterChartSettingChange (
                    current,
                    previousEditorState.documentRevision,
                    result.workspace.editorState?.documentRevision ?? previousEditorState.documentRevision,
                    result.workspace.editorState?.solverRevision ?? previousEditorState.solverRevision,
                ) );
            }
        }
        else
        {
            // Handle the remaining case after the preceding condition is false.

            reportCommandFailure ( result.code, result.message );
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: performRedo
    //
    // Description:
    //
    //   Runs the redo workflow.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   No value is returned.
    //
    // Preconditions:
    //
    //   - None.
    //
    // Postconditions:
    //
    //   - The described side effects are complete when the callable returns.
    //
    //----------------------------------------------------------------------------------------------

    function performRedo (): void
    {
        // Initialize the local values needed by this operation.

        const previousEditorState = documentWorkspace.editorState;
        const historyCommandKind  = previousEditorState?.redoStack.at ( -1 )?.commandKind;
        const result              = redoWorkspaceDocumentCommand ( documentWorkspace );


        // Handle the case where result is successful is enabled.

        if ( result.isSuccessful )
        {
            replaceDocumentWorkspace ( result.workspace );


            // Handle the case where all required conditions are satisfied.

            if ( historyCommandKind === "set_chart_expand_states" && previousEditorState !== null &&
                result.workspace.editorState !== null )
            {
                setSolverWorkspace ( current => rebaseSolverCandidateAfterChartSettingChange (
                    current,
                    previousEditorState.documentRevision,
                    result.workspace.editorState?.documentRevision ?? previousEditorState.documentRevision,
                    result.workspace.editorState?.solverRevision ?? previousEditorState.solverRevision,
                ) );
            }
        }
        else
        {
            // Handle the remaining case after the preceding condition is false.

            reportCommandFailure ( result.code, result.message );
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: performValidation
    //
    // Description:
    //
    //   Runs the validation workflow.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   No value is returned.
    //
    // Preconditions:
    //
    //   - None.
    //
    // Postconditions:
    //
    //   - The described side effects are complete when the callable returns.
    //
    //----------------------------------------------------------------------------------------------

    function performValidation (): void
    {
        // Initialize the local values needed by this operation.

        const result = validateDocumentWorkspace ( documentWorkspace );

        replaceDocumentWorkspace ( result.workspace );
        reportDiagnostics ( result.diagnostics );


        // Handle the case where length equals 0.

        if ( result.diagnostics.length === 0 )
        {
            publishConsoleEntry ( "VALIDATION_PASSED", "message", "Validation", "State-machine validation passed.", "editor" );
        }
        else if ( result.diagnostics.every ( diagnostic => diagnostic.severity === "warning" ) )
        {
            publishConsoleEntry ( "VALIDATION_PASSED_WITH_WARNINGS", "warning", "Validation", "Validation passed with warnings.", "editor" );
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: reportSolverDiagnostics
    //
    // Description:
    //
    //   Reports the solver diagnostics.
    //
    // Parameters:
    //
    //   - diagnostics:
    //     The diagnostics supplied to the operation.
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

    function reportSolverDiagnostics ( diagnostics: readonly SolverObservationDiagnostic[] ): void
    {
        reportBoundedDiagnostics (
            diagnostics,
            diagnostic => publishConsoleEntry (
                diagnostic.code,
                diagnostic.severity,
                "Solver",
                `${diagnostic.message} ${diagnostic.remediation}`,
                "solver",
            ),
            "Solver",
            "solver",
        );
    }


    //----------------------------------------------------------------------------------------------
    // Function: replaceSolverSequences
    //
    // Description:
    //
    //   Replaces the solver sequences.
    //
    // Parameters:
    //
    //   - sequences:
    //     The sequences supplied to the operation.
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

    function replaceSolverSequences ( sequences: readonly SolverSequence[] ): void
    {
        dispatchDocumentCommand ( expectedRevision => ( {
            kind: "replace_solver_sequences",
            sequences,
            expectedRevision,
        } ) );
    }

    // /////////////////////////////////////////////////////////////////////////////////////////////
    // Simulator sessions.
    //
    //   Every runtime value the Simulator shows arrives in a session snapshot from the server
    //   worker. Nothing here advances a state machine; these handlers only submit requests and
    //   project the immutable results.
    // /////////////////////////////////////////////////////////////////////////////////////////////


    //----------------------------------------------------------------------------------------------
    // Function: replaceSimulatoreequences
    //
    // Description:
    //
    //   Replaces the simulator sequences.
    //
    // Parameters:
    //
    //   - sequences:
    //     The sequences supplied to the operation.
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

    function replaceSimulatorSequences ( sequences: readonly SimulatorSequence[] ): void
    {
        dispatchDocumentCommand ( expectedRevision => ( {
            kind: "replace_simulator_sequences",
            sequences,
            expectedRevision,
        } ) );
    }


    //----------------------------------------------------------------------------------------------
    // Function: reportSimulatorWarnings
    //
    // Description:
    //
    //   Reports the simulator warnings.
    //
    // Parameters:
    //
    //   - warnings:
    //     The warnings supplied to the operation.
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

    function reportSimulatorWarnings ( warnings: readonly RuntimeWarning[] ): void
    {
        // Process each warning from the warnings collection in order.

        for ( const warning of warnings )
        {
            publishConsoleEntry ( warning.code, "warning", "Simulator", warning.message, "simulator" );
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: currentValidatedModelRevision
    //
    // Description:
    //
    //   Derives the current validated model revision.
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

    async function currentValidatedModelRevision (): Promise<string | null>
    {
        // Initialize the local values needed by this operation.

        const editorState = documentWorkspaceReference.current.editorState;


        // Handle the case where editor state matches an absent value.

        if ( editorState === null )
        {
            // Return the computed result.

            return null;
        }

        const validation = validateAuthoringDraft ( editorState.draft );


        // Handle the case where the validation is valid condition is not satisfied.

        if ( !validation.isValid )
        {
            // Return the computed result.

            return null;
        }


        // Run the operation that may report a recoverable failure.

        try
        {
            // Return the computed result.

            return ( await createHostedSnapshot ( validation.document, contentHasher ) ).modelRevision;
        }
        catch
        {
            // Recover from the reported failure without hiding its outcome.

            const message = "The loaded model could not be compared with the hosted model. " +
                "Retry Start Session; reconnect if the comparison continues to fail.";

            publishConsoleEntry ( "SIMULATION_MODEL_COMPARISON_FAILED", "error", "Simulator", message, "simulator" );
            setMessageDialog ( { body: message, severity: "error" } );

            // Return the computed result.

            return null;
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: completeSimulatorSessionStart
    //
    // Description:
    //
    //   Completes the simulator session start.
    //
    // Parameters:
    //
    //   - startingServerWorkspace:
    //     The starting server workspace supplied to the operation.
    //
    //   - loadedModelRevisionForWarning:
    //     The loaded model revision for warning supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    async function completeSimulatorSessionStart (
        startingServerWorkspace: ServerWorkspaceState,
        loadedModelRevisionForWarning: string | null = null,
    ): Promise<void>
    {
        // Initialize the local values needed by this operation.

        const result = await startServerSession ( startingServerWorkspace, serverGateway );


        // Handle the case where the application mounted reference current condition is not
        // satisfied.

        if ( !applicationMountedReference.current )
        {
            // Return control to the caller.

            return;
        }

        replaceServerWorkspace ( result.serverWorkspace );


        // Handle the case where the result is successful condition is not satisfied.

        if ( !result.isSuccessful )
        {
            reportServerFailure ( result.failure );

            // Return control to the caller.

            return;
        }

        setSimulatorSession ( { lastWarnings: [], session: result.value, stepCursor: 0 } );


        // Handle the case where all required conditions are satisfied.

        if ( loadedModelRevisionForWarning !== null &&
            loadedModelRevisionForWarning !== result.value.modelRevision )
        {
            publishConsoleEntry (
                "SIMULATION_SESSION_STARTED_WITH_DIFFERENT_MODEL",
                "warning",
                "Simulator",
                `Started session ${result.value.sessionId} without pushing the loaded model. The session uses ` +
                    `hosted revision ${result.value.modelRevision}, which differs from the loaded model, so its ` +
                    "behavior may not match the current document.",
                "simulator",
            );
        }

        publishConsoleEntry (
            "SIMULATION_SESSION_STARTED",
            "message",
            "Simulator",
            `Started session ${result.value.sessionId} pinned to revision ${result.value.modelRevision}.`,
            "simulator",
        );
    }


    //----------------------------------------------------------------------------------------------
    // Function: performSimulatorSessionStart
    //
    // Description:
    //
    //   Runs the simulator session start workflow.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   A promise that resolves when the operation is complete.
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

    async function performSimulatorSessionStart (): Promise<void>
    {
        // Handle the case where the begin server operation result condition is not satisfied.

        if ( !beginServerOperation () )
        {
            // Return control to the caller.

            return;
        }


        // Run the operation that may report a recoverable failure.

        try
        {
            // Initialize the local values needed by this operation.

            const loadedModelRevision = await currentValidatedModelRevision ();


            // Handle the case where loaded model revision matches an absent value.

            if ( loadedModelRevision === null )
            {
                // Return control to the caller.

                return;
            }


            // Handle the case where loaded model revision differs from last known hosted revision.

            if ( loadedModelRevision !== serverWorkspaceReference.current.lastKnownHostedRevision )
            {
                setSimulatorModelDifferenceDialogOpen ( true );

                // Return control to the caller.

                return;
            }

            await completeSimulatorSessionStart ( serverWorkspaceReference.current );
        }
        finally
        {
            // Complete the cleanup required after the attempted operation.

            finishServerOperation ();
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: pushModelAndStartSimulatorSession
    //
    // Description:
    //
    //   Pushes the model and start simulator session.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   A promise that resolves when the operation is complete.
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

    async function pushModelAndStartSimulatorSession (): Promise<void>
    {
        setSimulatorModelDifferenceDialogOpen ( false );


        // Handle the case where the begin server operation result condition is not satisfied.

        if ( !beginServerOperation () )
        {
            // Return control to the caller.

            return;
        }


        // Run the operation that may report a recoverable failure.

        try
        {
            // Initialize the local values needed by this operation.

            const pushedServerWorkspace = await pushCurrentDocumentToServer ();


            // Handle the case where pushed server workspace differs from an absent value.

            if ( pushedServerWorkspace !== null )
            {
                await completeSimulatorSessionStart ( pushedServerWorkspace );
            }
        }
        finally
        {
            // Complete the cleanup required after the attempted operation.

            finishServerOperation ();
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: startSimulatorSessionWithoutPush
    //
    // Description:
    //
    //   Starts the simulator session without push.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   A promise that resolves when the operation is complete.
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

    async function startSimulatorSessionWithoutPush (): Promise<void>
    {
        setSimulatorModelDifferenceDialogOpen ( false );


        // Handle the case where the begin server operation result condition is not satisfied.

        if ( !beginServerOperation () )
        {
            // Return control to the caller.

            return;
        }


        // Run the operation that may report a recoverable failure.

        try
        {
            // Initialize the local values needed by this operation.

            const loadedModelRevision = await currentValidatedModelRevision ();


            // Handle the case where loaded model revision differs from an absent value.

            if ( loadedModelRevision !== null )
            {
                await completeSimulatorSessionStart ( serverWorkspaceReference.current, loadedModelRevision );
            }
        }
        finally
        {
            // Complete the cleanup required after the attempted operation.

            finishServerOperation ();
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: performSimulatorSessionClose
    //
    // Description:
    //
    //   Runs the simulator session close workflow.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   A promise that resolves when the operation is complete.
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

    async function performSimulatorSessionClose (): Promise<void>
    {
        // Handle the case where the begin server operation result condition is not satisfied.

        if ( !beginServerOperation () )
        {
            // Return control to the caller.

            return;
        }


        // Run the operation that may report a recoverable failure.

        try
        {
            // Initialize the local values needed by this operation.

            const result = await closeActiveServerSession ( serverWorkspaceReference.current, serverGateway );


            // Handle the case where the application mounted reference current condition is not
            // satisfied.

            if ( !applicationMountedReference.current )
            {
                // Return control to the caller.

                return;
            }

            replaceServerWorkspace ( result.serverWorkspace );

            // The client-side session projection is cleared either way. A close that failed on the
            // server leaves no client affordance to operate the session, and retaining a reference
            // the user cannot act on would be misleading; the failure itself is still reported.

            setSimulatorSession ( createSimulatorSessionState () );


            // Handle the case where the result is successful condition is not satisfied.

            if ( !result.isSuccessful )
            {
                reportServerFailure ( result.failure );

                // Return control to the caller.

                return;
            }

            publishConsoleEntry (
                "SIMULATION_SESSION_CLOSED",
                "message",
                "Simulator",
                "Closed the active simulation session.",
                "simulator",
            );
        }
        finally
        {
            // Complete the cleanup required after the attempted operation.

            finishServerOperation ();
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: performSimulatorRun
    //
    // Description:
    //
    //   Runs the simulator run workflow.
    //
    // Parameters:
    //
    //   - events:
    //     The events supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    async function performSimulatorRun ( events: readonly string[] ): Promise<void>
    {
        // Handle the case where the begin server operation result condition is not satisfied.

        if ( !beginServerOperation () )
        {
            // Return control to the caller.

            return;
        }

        const currentCursor = simulatorSession.stepCursor;


        // Run the operation that may report a recoverable failure.

        try
        {
            // Initialize the local values needed by this operation.

            const result = await runActiveServerSession (
                serverWorkspaceReference.current,
                serverGateway,
                runEventBuffer ( events, currentCursor ),
            );


            // Handle the case where the application mounted reference current condition is not
            // satisfied.

            if ( !applicationMountedReference.current )
            {
                // Return control to the caller.

                return;
            }

            replaceServerWorkspace ( result.serverWorkspace );


            // Handle the case where the result is successful condition is not satisfied.

            if ( !result.isSuccessful )
            {
                reportServerFailure ( result.failure );

                // Return control to the caller.

                return;
            }

            reportSimulatorWarnings ( result.value.warnings );
            setSimulatorSession ( {
                lastWarnings: result.value.warnings,
                session:      result.value.session,
                stepCursor:   advanceStepCursor (
                    currentCursor,
                    result.value.consumedEventCount,
                    events.length,
                ),
            } );
        }
        finally
        {
            // Complete the cleanup required after the attempted operation.

            finishServerOperation ();
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: performSimulatoretep
    //
    // Description:
    //
    //   Runs the simulator step workflow.
    //
    // Parameters:
    //
    //   - events:
    //     The events supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    async function performSimulatorStep ( events: readonly string[] ): Promise<void>
    {
        // Handle the case where the begin server operation result condition is not satisfied.

        if ( !beginServerOperation () )
        {
            // Return control to the caller.

            return;
        }

        const currentCursor = simulatorSession.stepCursor;


        // Run the operation that may report a recoverable failure.

        try
        {
            // Initialize the local values needed by this operation.

            const result = await stepActiveServerSession (
                serverWorkspaceReference.current,
                serverGateway,
                stepEventBuffer ( events, currentCursor ),
            );


            // Handle the case where the application mounted reference current condition is not
            // satisfied.

            if ( !applicationMountedReference.current )
            {
                // Return control to the caller.

                return;
            }

            replaceServerWorkspace ( result.serverWorkspace );


            // Handle the case where the result is successful condition is not satisfied.

            if ( !result.isSuccessful )
            {
                reportServerFailure ( result.failure );

                // Return control to the caller.

                return;
            }

            reportSimulatorWarnings ( result.value.warnings );
            setSimulatorSession ( {
                lastWarnings: result.value.warnings,
                session:      result.value.session,
                stepCursor:   advanceStepCursor ( currentCursor, result.value.consumedEventCount, events.length ),
            } );
        }
        finally
        {
            // Complete the cleanup required after the attempted operation.

            finishServerOperation ();
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: performSimulatorReset
    //
    // Description:
    //
    //   Runs the simulator reset workflow.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   A promise that resolves when the operation is complete.
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

    async function performSimulatorReset (): Promise<void>
    {
        // Handle the case where the begin server operation result condition is not satisfied.

        if ( !beginServerOperation () )
        {
            // Return control to the caller.

            return;
        }


        // Run the operation that may report a recoverable failure.

        try
        {
            // Initialize the local values needed by this operation.

            const result = await resetActiveServerSession ( serverWorkspaceReference.current, serverGateway );


            // Handle the case where the application mounted reference current condition is not
            // satisfied.

            if ( !applicationMountedReference.current )
            {
                // Return control to the caller.

                return;
            }

            replaceServerWorkspace ( result.serverWorkspace );


            // Handle the case where the result is successful condition is not satisfied.

            if ( !result.isSuccessful )
            {
                reportServerFailure ( result.failure );

                // Return control to the caller.

                return;
            }

            setSimulatorSession ( { lastWarnings: [], session: result.value, stepCursor: 0 } );
            publishConsoleEntry (
                "SIMULATION_SESSION_RESET",
                "message",
                "Simulator",
                `Reset the session to '${result.value.currentState}'; no actions were emitted.`,
                "simulator",
            );
        }
        finally
        {
            // Complete the cleanup required after the attempted operation.

            finishServerOperation ();
        }
    }

    // /////////////////////////////////////////////////////////////////////////////////////////////
    // Simulator event-sequence CSV transfer.
    // /////////////////////////////////////////////////////////////////////////////////////////////


    //----------------------------------------------------------------------------------------------
    // Function: beginSimulatorCsvImport
    //
    // Description:
    //
    //   Begins the simulator CSV import.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   A promise that resolves when the operation is complete.
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

    async function beginSimulatorCsvImport (): Promise<void>
    {
        // Handle the case where document workspace editor state matches an absent value.

        if ( documentWorkspace.editorState === null )
        {
            // Return control to the caller.

            return;
        }

        let readResult;


        // Run the operation that may report a recoverable failure.

        try
        {
            readResult = await csvFilePort.openCsvFile ();
        }
        catch ( error )
        {
            // Recover from the reported failure without hiding its outcome.

            showDiagnosticFailure (
                [
                    csvFileDiagnostic (
                        "CSV_READ_FAILED",
                        error instanceof Error
                            ? error.message
                            : "The selected Simulator CSV file could not be read.",
                        "Check the file and try again.",
                    ),
                ],
            );

            // Return control to the caller.

            return;
        }


        // Handle the case where read result matches an absent value.

        if ( readResult === null )
        {
            // Return control to the caller.

            return;
        }


        // Handle the case where read result byte count exceeds maximum file byte count.

        if ( readResult.byteCount > MAXIMUM_FILE_BYTE_COUNT )
        {
            showDiagnosticFailure (
                [
                    csvFileDiagnostic (
                        "CSV_FILE_TOO_LARGE",
                        `The selected CSV file is ${readResult.byteCount} bytes; the limit is ` +
                            `${MAXIMUM_FILE_BYTE_COUNT} bytes.`,
                        "Choose a CSV file no larger than 5 MiB.",
                    ),
                ],
            );

            // Return control to the caller.

            return;
        }

        setSimulatorCsvDialog ( { mode: "import", text: readResult.text } );
    }


    //----------------------------------------------------------------------------------------------
    // Function: beginSimulatorCsvExport
    //
    // Description:
    //
    //   Begins the simulator CSV export.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   No value is returned.
    //
    // Preconditions:
    //
    //   - None.
    //
    // Postconditions:
    //
    //   - The described side effects are complete when the callable returns.
    //
    //----------------------------------------------------------------------------------------------

    function beginSimulatorCsvExport (): void
    {
        // Handle the case where current value equals 0.

        if ( ( documentWorkspace.editorState?.draft.simulator.sequences.length ?? 0 ) === 0 )
        {
            reportCommandFailure (
                "SIMULATOR_SEQUENCE_MISSING",
                "Add a Simulator event sequence before exporting.",
            );

            // Return control to the caller.

            return;
        }

        setSimulatorCsvDialog ( { mode: "export", text: null } );
    }


    //----------------------------------------------------------------------------------------------
    // Function: confirmSimulatorCsvhransfer
    //
    // Description:
    //
    //   Confirms the simulator CSV transfer.
    //
    // Parameters:
    //
    //   - sequenceName:
    //     The sequence name supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    async function confirmSimulatorCsvTransfer ( sequenceName: string ): Promise<void>
    {
        // Initialize the local values needed by this operation.

        const dialog      = simulatorCsvDialog;
        const editorState = documentWorkspace.editorState;

        setSimulatorCsvDialog ( null );


        // Handle the case where at least one branch condition is satisfied.

        if ( dialog === null || editorState === null )
        {
            // Return control to the caller.

            return;
        }


        // Handle the case where dialog mode matches the export value.

        if ( dialog.mode === "export" )
        {
            // Initialize the local values needed by this operation.

            const sequence = editorState.draft.simulator.sequences.find ( item => item.name === sequenceName );


            // Handle the case where sequence matches undefined.

            if ( sequence === undefined )
            {
                reportCommandFailure (
                    "SIMULATOR_SEQUENCE_MISSING",
                    "The selected Simulator sequence no longer exists.",
                );

                // Return control to the caller.

                return;
            }

            const exportResult = createCsvSimulatorSequenceExportDocument (
                editorState.draft.settings.name,
                sequence,
            );


            // Handle the case where the export result is successful condition is not satisfied.

            if ( !exportResult.isSuccessful )
            {
                showDiagnosticFailure ( exportResult.diagnostics );

                // Return control to the caller.

                return;
            }

            let displayName;


            // Run the operation that may report a recoverable failure.

            try
            {
                displayName = await csvFilePort.saveCsvFile (
                    { suggestedName: exportResult.document.suggestedName, text: exportResult.document.text },
                );
            }
            catch ( error )
            {
                // Recover from the reported failure without hiding its outcome.

                showDiagnosticFailure (
                    [
                        csvFileDiagnostic (
                            "CSV_WRITE_FAILED",
                            error instanceof Error
                                ? error.message
                                : "The Simulator sequence CSV file could not be written.",
                            "Check destination permissions and available space, then try again.",
                        ),
                    ],
                );

                // Return control to the caller.

                return;
            }


            // Handle the case where display name differs from an absent value.

            if ( displayName !== null )
            {
                publishConsoleEntry (
                    "CSV_EXPORT_COMPLETED",
                    "message",
                    "CSV export",
                    `Exported ${exportResult.document.rowCount} Simulator event row(s) to '${displayName}'.`,
                    "simulator",
                );
            }


            // Return control to the caller.

            return;
        }

        const preparation = prepareCsvSimulatorSequenceImport ( dialog.text ?? "" );


        // Handle the case where the preparation is successful condition is not satisfied.

        if ( !preparation.isSuccessful )
        {
            showDiagnosticFailure ( preparation.diagnostics );

            // Return control to the caller.

            return;
        }


        // Initialize the local values needed by this operation.

        const existingIndex = editorState.draft.simulator.sequences.findIndex (
            sequence => sequence.name === sequenceName,
        );
        const existingSequence                    = editorState.draft.simulator.sequences [ existingIndex ];
        const importedSequence: SimulatorSequence = 
        {
            name:        sequenceName,
            description: existingSequence?.description ?? "",
            sequence:    preparation.events,
        };
        const sequences = existingIndex < 0
            ? [ ...editorState.draft.simulator.sequences, importedSequence ]
            : editorState.draft.simulator.sequences.map ( ( sequence, index ) =>
                index === existingIndex ? importedSequence : sequence );
        const planResult = planWorkspaceDocumentCommand (
            documentWorkspace,
            { kind: "replace_simulator_sequences", sequences, expectedRevision: editorState.documentRevision },
        );


        // Handle the case where the plan result is successful condition is not satisfied.

        if ( !planResult.isSuccessful )
        {
            reportCommandFailure ( planResult.code, planResult.message );

            // Return control to the caller.

            return;
        }


        // Handle the case where existing index is at least the 0 value.

        if ( existingIndex >= 0 )
        {
            setPendingCsvImport (
                {
                    conflictKeys: [ sequenceName ],
                    plan:         planResult.plan,
                    route:        "simulator",
                    rowCount:     preparation.rowCount,
                    transferName: text ( "menu.file.csv.simulatorEventSequence" ),
                    warnings:     [],
                },
            );
        }
        else if ( commitCommandPlan ( planResult.plan ) )
        {
            publishCsvImportCompletion (
                text ( "menu.file.csv.simulatorEventSequence" ),
                preparation.rowCount,
                "simulator",
            );
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: validateSolverSequences
    //
    // Description:
    //
    //   Validates solver sequences.
    //
    // Parameters:
    //
    //   - diagnostics:
    //     The diagnostics supplied to the operation.
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

    function validateSolverSequences ( diagnostics: readonly SolverObservationDiagnostic[] ): void
    {
        reportSolverDiagnostics ( diagnostics );


        // Handle the case where some result is enabled.

        if ( diagnostics.some ( diagnostic => diagnostic.severity === "error" ) )
        {
            setMessageDialog ( { body: "Solver sequence validation failed. Review the Console diagnostics.", severity: "error" } );
        }
        else
        {
            // Handle the remaining case after the preceding condition is false.

            publishConsoleEntry (
                diagnostics.length === 0 ? "SOLVER_VALIDATION_PASSED" : "SOLVER_VALIDATION_WARNINGS",
                diagnostics.length === 0 ? "message" : "warning",
                "Solver",
                diagnostics.length === 0
                    ? "Solver sequence syntax and direct constraints are valid."
                    : "Solver sequence syntax and direct constraints are valid with warnings.",
                "solver",
            );
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: solveObservations
    //
    // Description:
    //
    //   Derives the solve observations.
    //
    // Parameters:
    //
    //   - observations:
    //     The observations supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    async function solveObservations ( observations: readonly SolverObservationInput[] ): Promise<void>
    {
        // Initialize the local values needed by this operation.

        const editorState = documentWorkspaceReference.current.editorState;


        // Handle the case where editor state matches an absent value.

        if ( editorState === null )
        {
            reportCommandFailure ( "DOCUMENT_MISSING", "Create or open a document before solving." );

            // Return control to the caller.

            return;
        }

        const validation = normalizeSolverObservations ( observations );


        // Handle the case where the validation is successful condition is not satisfied.

        if ( !validation.isSuccessful )
        {
            reportSolverDiagnostics ( validation.diagnostics );
            setMessageDialog ( { body: "Solver sequence validation failed. Review the Console diagnostics.", severity: "error" } );

            // Return control to the caller.

            return;
        }


        // Initialize the local values needed by this operation.

        const jobId           = crypto.randomUUID ();
        const inputTokenCount = observations.reduce ( ( total, observation ) => total + observation.rawTokens.length, 0 );

        setSolverWorkspace ( current => beginSolverJob ( current, jobId ) );
        publishConsoleEntry (
            "SOLVER_STARTED",
            "message",
            "Solver",
            `Solver inference started for ${observations.length} sequence(s) and ${inputTokenCount} token(s).`,
            "solver",
        );

        let result: SolverInferenceResult;


        // Run the operation that may report a recoverable failure.

        try
        {
            result = await solverWorkerPort.solve (
                {
                    jobId,
                    documentRevision: editorState.documentRevision,
                    solverRevision: editorState.solverRevision,
                    observations,
                },
                progress =>
                {
                    setSolverWorkspace ( current => updateSolverProgress ( current, jobId, progress ) );
                    publishConsoleEntry (
                        "SOLVER_PROGRESS",
                        "message",
                        "Solver",
                        `${progress.completedWork}/${progress.totalWork}: ${progress.message}`,
                        "solver",
                    );
                },
            );
        }
        catch
        {
            // Recover from the reported failure without hiding its outcome.

            result = {
                status: "failure",
                diagnostics:
                [
                    {
                        code: "SOLVER_FAILURE",
                        severity: "error",
                        message: "The Solver Worker is unavailable.",
                        remediation: "Retry with a fresh Solver Worker and review the Console if the failure repeats.",
                        relatedLocations: [],
                    },
                ],
            };
        }

        const currentEditorState = documentWorkspaceReference.current.editorState;

        setSolverWorkspace ( current => completeSolverJob (
            current,
            jobId,
            result,
            currentEditorState?.documentRevision ?? -1,
            currentEditorState?.solverRevision ?? -1,
        ) );
        reportSolverDiagnostics ( result.diagnostics );


        // Handle the case where all required conditions are satisfied.

        if ( result.status === "success" && result.candidate.baselineDocumentRevision === currentEditorState?.documentRevision &&
            result.candidate.baselineSolverRevision === currentEditorState.solverRevision )
        {
            publishConsoleEntry (
                "SOLVER_CANDIDATE_READY",
                "message",
                "Solver",
                `Candidate ready: ${result.candidate.statistics.candidateStateCount} state(s), ${result.candidate.statistics.transitionCount} transition(s).`,
                "solver",
            );
        }
        else if ( result.status === "failure" && !result.diagnostics.some ( diagnostic => diagnostic.code === "SOLVER_CANCELLED" ) )
        {
            setMessageDialog ( { body: "Solver inference failed. Review the Console diagnostics.", severity: "error" } );
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: requestSolverCandidateApply
    //
    // Description:
    //
    //   Requests the solver candidate apply.
    //
    // Parameters:
    //
    //   - candidate:
    //     The candidate supplied to the operation.
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

    function requestSolverCandidateApply ( candidate: SolverCandidate ): void
    {
        setPendingSolverCandidate ( candidate );
    }


    //----------------------------------------------------------------------------------------------
    // Function: applyPendingSolverCandidate
    //
    // Description:
    //
    //   Applies the pending solver candidate.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   No value is returned.
    //
    // Preconditions:
    //
    //   - None.
    //
    // Postconditions:
    //
    //   - The described side effects are complete when the callable returns.
    //
    //----------------------------------------------------------------------------------------------

    function applyPendingSolverCandidate (): void
    {
        // Initialize the local values needed by this operation.

        const candidate   = pendingSolverCandidate;
        const editorState = documentWorkspace.editorState;

        setPendingSolverCandidate ( null );


        // Handle the case where at least one branch condition is satisfied.

        if ( candidate === null || editorState === null )
        {
            // Return control to the caller.

            return;
        }

        const planResult = planWorkspaceDocumentCommand (
            documentWorkspace,
            {
                kind: "apply_solver_candidate",
                candidate,
                expectedRevision: editorState.documentRevision,
                expectedSolverRevision: editorState.solverRevision,
            },
        );


        // Handle the case where the plan result is successful condition is not satisfied.

        if ( !planResult.isSuccessful )
        {
            reportCommandFailure ( planResult.code, planResult.message );

            // Return control to the caller.

            return;
        }


        // Handle the case where commit command plan result is enabled.

        if ( commitCommandPlan ( planResult.plan ) )
        {
            setSolverWorkspace ( current => discardSolverCandidate ( current ) );
            publishConsoleEntry (
                "SOLVER_CANDIDATE_APPLIED",
                "message",
                "Solver",
                "Replaced the state machine and chart with the reviewed candidate as one undoable command.",
                "solver",
            );
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: csvFileDiagnostic
    //
    // Description:
    //
    //   Derives the CSV file diagnostic.
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
    //----------------------------------------------------------------------------------------------

    function csvFileDiagnostic (
        code: string,
        message: string,
        remediation: string,
    ): DomainDiagnostic
    {
        // Return the assembled result.

        return {
            code,
            message,
            remediation,
            severity: "error",
            source:   "CSV import",
        };
    }


    //----------------------------------------------------------------------------------------------
    // Function: publishCsvImportCompletion
    //
    // Description:
    //
    //   Publishes CSV import completion.
    //
    // Parameters:
    //
    //   - transferName:
    //     The transfer name supplied to the operation.
    //
    //   - rowCount:
    //     The row count supplied to the operation.
    //
    //   - route:
    //     The route supplied to the operation.
    //
    //   - warnings:
    //     The warnings supplied to the operation.
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

    function publishCsvImportCompletion (
        transferName: string,
        rowCount: number,
        route: ShellRoute,
        warnings: readonly DomainDiagnostic[] = [],
    ): void
    {
        publishConsoleEntry (
            "CSV_IMPORT_COMPLETED",
            "message",
            "CSV import",
            `Imported ${rowCount} ${transferName} row(s) as one undoable document change.`,
            route,
        );


        // Handle the case where warnings length exceeds the 0 value.

        if ( warnings.length > 0 )
        {
            reportDiagnostics ( warnings );

            const firstWarning = warnings [ 0 ];


            // Handle the case where first warning differs from undefined.

            if ( firstWarning !== undefined )
            {
                setMessageDialog (
                    {
                        body:     `${firstWarning.message} ${firstWarning.remediation}`,
                        severity: "warning",
                    },
                );
            }
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: beginSolverCsvImport
    //
    // Description:
    //
    //   Begins the solver CSV import.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   A promise that resolves when the operation is complete.
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

    async function beginSolverCsvImport (): Promise<void>
    {
        // Handle the case where document workspace editor state matches an absent value.

        if ( documentWorkspace.editorState === null )
        {
            reportCommandFailure ( "DOCUMENT_MISSING", "Create or open a document before importing a Solver sequence." );

            // Return control to the caller.

            return;
        }

        let readResult;


        // Run the operation that may report a recoverable failure.

        try
        {
            readResult = await csvFilePort.openCsvFile ();
        }
        catch ( error )
        {
            // Recover from the reported failure without hiding its outcome.

            showDiagnosticFailure (
                [
                    csvFileDiagnostic (
                        "CSV_READ_FAILED",
                        error instanceof Error ? error.message : "The selected Solver CSV file could not be read.",
                        "Check the file and try again.",
                    ),
                ],
            );

            // Return control to the caller.

            return;
        }


        // Handle the case where read result matches an absent value.

        if ( readResult === null )
        {
            // Return control to the caller.

            return;
        }


        // Handle the case where read result byte count exceeds maximum file byte count.

        if ( readResult.byteCount > MAXIMUM_FILE_BYTE_COUNT )
        {
            showDiagnosticFailure (
                [
                    csvFileDiagnostic (
                        "CSV_FILE_TOO_LARGE",
                        `The selected CSV file is ${readResult.byteCount} bytes; the limit is ${MAXIMUM_FILE_BYTE_COUNT} bytes.`,
                        "Choose a CSV file no larger than 5 MiB.",
                    ),
                ],
            );

            // Return control to the caller.

            return;
        }

        setSolverCsvDialog ( { mode: "import", text: readResult.text } );
    }


    //----------------------------------------------------------------------------------------------
    // Function: beginSolverCsvExport
    //
    // Description:
    //
    //   Begins the solver CSV export.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   No value is returned.
    //
    // Preconditions:
    //
    //   - None.
    //
    // Postconditions:
    //
    //   - The described side effects are complete when the callable returns.
    //
    //----------------------------------------------------------------------------------------------

    function beginSolverCsvExport (): void
    {
        // Initialize the local values needed by this operation.

        const sequences = documentWorkspace.editorState?.draft.solver.sequences ?? [];


        // Handle the case where sequences length equals 0.

        if ( sequences.length === 0 )
        {
            reportCommandFailure ( "SOLVER_SEQUENCE_MISSING", "Add a Solver observation sequence before exporting." );

            // Return control to the caller.

            return;
        }

        setSolverCsvDialog ( { mode: "export", text: null } );
    }


    //----------------------------------------------------------------------------------------------
    // Function: confirmSolverCsvTransfer
    //
    // Description:
    //
    //   Confirms the solver CSV transfer.
    //
    // Parameters:
    //
    //   - sequenceName:
    //     The sequence name supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    async function confirmSolverCsvTransfer ( sequenceName: string ): Promise<void>
    {
        // Initialize the local values needed by this operation.

        const dialog      = solverCsvDialog;
        const editorState = documentWorkspace.editorState;

        setSolverCsvDialog ( null );


        // Handle the case where at least one branch condition is satisfied.

        if ( dialog === null || editorState === null )
        {
            // Return control to the caller.

            return;
        }


        // Handle the case where dialog mode matches the export value.

        if ( dialog.mode === "export" )
        {
            // Initialize the local values needed by this operation.

            const sequence = editorState.draft.solver.sequences.find ( item => item.name === sequenceName );


            // Handle the case where sequence matches undefined.

            if ( sequence === undefined )
            {
                reportCommandFailure ( "SOLVER_SEQUENCE_MISSING", "The selected Solver sequence no longer exists." );

                // Return control to the caller.

                return;
            }

            const exportResult = createCsvSolverSequenceExportDocument ( editorState.draft.settings.name, sequence );


            // Handle the case where the export result is successful condition is not satisfied.

            if ( !exportResult.isSuccessful )
            {
                showDiagnosticFailure ( exportResult.diagnostics );

                // Return control to the caller.

                return;
            }

            let displayName;


            // Run the operation that may report a recoverable failure.

            try
            {
                displayName = await csvFilePort.saveCsvFile (
                    { suggestedName: exportResult.document.suggestedName, text: exportResult.document.text },
                );
            }
            catch ( error )
            {
                // Recover from the reported failure without hiding its outcome.

                showDiagnosticFailure (
                    [
                        csvFileDiagnostic (
                            "CSV_WRITE_FAILED",
                            error instanceof Error ? error.message : "The Solver sequence CSV file could not be written.",
                            "Check destination permissions and available space, then try again.",
                        ),
                    ],
                );

                // Return control to the caller.

                return;
            }


            // Handle the case where display name differs from an absent value.

            if ( displayName !== null )
            {
                publishConsoleEntry (
                    "CSV_EXPORT_COMPLETED",
                    "message",
                    "CSV export",
                    `Exported ${exportResult.document.rowCount} Solver observation row(s) to '${displayName}'.`,
                    "solver",
                );
            }


            // Return control to the caller.

            return;
        }

        const preparation = prepareCsvSolverSequenceImport ( dialog.text ?? "", sequenceName );


        // Handle the case where the preparation is successful condition is not satisfied.

        if ( !preparation.isSuccessful )
        {
            showDiagnosticFailure ( preparation.diagnostics );

            // Return control to the caller.

            return;
        }


        // Initialize the local values needed by this operation.

        const existingIndex                    = editorState.draft.solver.sequences.findIndex ( sequence => sequence.name === sequenceName );
        const existingSequence                 = editorState.draft.solver.sequences [ existingIndex ];
        const importedSequence: SolverSequence = 
        {
            name: sequenceName,
            description: existingSequence?.description ?? "",
            startContext: existingSequence?.startContext ?? "infer",
            sequence: preparation.tokens,
        };
        const sequences = existingIndex < 0
            ? [ ...editorState.draft.solver.sequences, importedSequence ]
            : editorState.draft.solver.sequences.map ( ( sequence, index ) =>
                index === existingIndex ? importedSequence : sequence );
        const planResult = planWorkspaceDocumentCommand (
            documentWorkspace,
            { kind: "replace_solver_sequences", sequences, expectedRevision: editorState.documentRevision },
        );


        // Handle the case where the plan result is successful condition is not satisfied.

        if ( !planResult.isSuccessful )
        {
            reportCommandFailure ( planResult.code, planResult.message );

            // Return control to the caller.

            return;
        }


        // Handle the case where existing index is at least the 0 value.

        if ( existingIndex >= 0 )
        {
            setPendingCsvImport (
                {
                    conflictKeys: [ sequenceName ],
                    plan:         planResult.plan,
                    route:        "solver",
                    rowCount:     preparation.rowCount,
                    transferName: text ( "menu.file.csv.solverObservationSequence" ),
                    warnings:     [],
                },
            );
        }
        else if ( commitCommandPlan ( planResult.plan ) )
        {
            publishCsvImportCompletion (
                text ( "menu.file.csv.solverObservationSequence" ),
                preparation.rowCount,
                "solver",
            );
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: commitPendingCsvImport
    //
    // Description:
    //
    //   Commits the pending CSV import.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   No value is returned.
    //
    // Preconditions:
    //
    //   - None.
    //
    // Postconditions:
    //
    //   - The described side effects are complete when the callable returns.
    //
    //----------------------------------------------------------------------------------------------

    function commitPendingCsvImport (): void
    {
        // Initialize the local values needed by this operation.

        const pendingImport = pendingCsvImport;

        setPendingCsvImport ( null );


        // Handle the case where all required conditions are satisfied.

        if ( pendingImport !== null && commitCommandPlan ( pendingImport.plan ) )
        {
            publishCsvImportCompletion (
                pendingImport.transferName,
                pendingImport.rowCount,
                pendingImport.route,
                pendingImport.warnings,
            );
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: performCsvImport
    //
    // Description:
    //
    //   Runs the CSV import workflow.
    //
    // Parameters:
    //
    //   - transferKind:
    //     The transfer kind supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    async function performCsvImport ( transferKind: CsvTransferKind ): Promise<void>
    {
        // Initialize the local values needed by this operation.

        const editorState = documentWorkspace.editorState;


        // Handle the case where editor state matches an absent value.

        if ( editorState === null )
        {
            reportCommandFailure ( "DOCUMENT_MISSING", "Create or open a document before importing CSV data." );

            // Return control to the caller.

            return;
        }

        let readResult;


        // Run the operation that may report a recoverable failure.

        try
        {
            readResult = await csvFilePort.openCsvFile ();
        }
        catch ( error )
        {
            // Recover from the reported failure without hiding its outcome.

            showDiagnosticFailure (
                [
                    csvFileDiagnostic (
                        "CSV_READ_FAILED",
                        error instanceof Error ? error.message : "The selected CSV file could not be read.",
                        "Check file permissions and UTF-8 encoding, then try again.",
                    ),
                ],
            );

            // Return control to the caller.

            return;
        }


        // Handle the case where read result matches an absent value.

        if ( readResult === null )
        {
            // Return control to the caller.

            return;
        }


        // Handle the case where read result byte count exceeds maximum file byte count.

        if ( readResult.byteCount > MAXIMUM_FILE_BYTE_COUNT )
        {
            showDiagnosticFailure (
                [
                    csvFileDiagnostic (
                        "CSV_FILE_TOO_LARGE",
                        `The selected CSV file is ${readResult.byteCount} bytes; the limit is ${MAXIMUM_FILE_BYTE_COUNT} bytes.`,
                        "Choose a CSV file no larger than 5 MiB.",
                    ),
                ],
            );

            // Return control to the caller.

            return;
        }

        const preparation = prepareCsvModelElementImport ( readResult.text, transferKind );


        // Handle the case where the preparation is successful condition is not satisfied.

        if ( !preparation.isSuccessful )
        {
            showDiagnosticFailure ( preparation.diagnostics );

            // Return control to the caller.

            return;
        }

        const transferName = csvTransferName ( transferKind );


        // Handle the case where preparation row count equals 0.

        if ( preparation.rowCount === 0 )
        {
            publishConsoleEntry (
                "CSV_IMPORT_EMPTY",
                "message",
                "CSV import",
                `The '${readResult.displayName}' file contains no ${transferName} data rows.`,
                csvTransferRoute ( transferKind ),
            );

            // Return control to the caller.

            return;
        }

        const inspection = inspectModelElementImport ( editorState.draft, preparation.modelImport );


        // Handle the case where the inspection is successful condition is not satisfied.

        if ( !inspection.isSuccessful )
        {
            // Handle the case where inspection missing references differs from undefined.

            if ( inspection.missingReferences !== undefined )
            {
                reportDiagnostics ( inspection.diagnostics );
                setTransitionCsvMissingReferences (
                    {
                        states: inspection.missingReferences.states,
                        events: inspection.missingReferences.events,
                    },
                );
            }
            else
            {
                // Handle the remaining case after the preceding condition is false.

                showDiagnosticFailure ( inspection.diagnostics );
            }


            // Return control to the caller.

            return;
        }

        const planResult = planWorkspaceDocumentCommand (
            documentWorkspace,
            {
                kind:               "import_model_elements",
                modelImport:        preparation.modelImport,
                overwriteConflicts: true,
                expectedRevision:   editorState.documentRevision,
            },
        );


        // Handle the case where the plan result is successful condition is not satisfied.

        if ( !planResult.isSuccessful )
        {
            reportCommandFailure ( planResult.code, planResult.message );

            // Return control to the caller.

            return;
        }


        // Handle the case where length exceeds the 0 value.

        if ( inspection.conflicts.length > 0 )
        {
            setPendingCsvImport (
                {
                    conflictKeys: inspection.conflicts.map ( conflict => conflict.key ),
                    plan:         planResult.plan,
                    route:        csvTransferRoute ( transferKind ),
                    rowCount:     preparation.rowCount,
                    transferName,
                    warnings:     preparation.warnings ?? [],
                },
            );
        }
        else if ( commitCommandPlan ( planResult.plan ) )
        {
            publishCsvImportCompletion (
                transferName,
                preparation.rowCount,
                csvTransferRoute ( transferKind ),
                preparation.warnings ?? [],
            );
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: performCsvExport
    //
    // Description:
    //
    //   Runs the CSV export workflow.
    //
    // Parameters:
    //
    //   - transferKind:
    //     The transfer kind supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    async function performCsvExport ( transferKind: CsvTransferKind ): Promise<void>
    {
        // Initialize the local values needed by this operation.

        const draft = documentWorkspace.editorState?.draft;


        // Handle the case where draft matches undefined.

        if ( draft === undefined )
        {
            reportCommandFailure ( "DOCUMENT_MISSING", "Create or open a document before exporting CSV data." );

            // Return control to the caller.

            return;
        }


        // Initialize the local values needed by this operation.

        const csvDocument = createCsvExportDocument ( draft, transferKind );
        let displayName;


        // Run the operation that may report a recoverable failure.

        try
        {
            displayName = await csvFilePort.saveCsvFile (
                {
                    suggestedName: csvDocument.suggestedName,
                    text:          csvDocument.text,
                },
            );
        }
        catch ( error )
        {
            // Recover from the reported failure without hiding its outcome.

            showDiagnosticFailure (
                [
                    csvFileDiagnostic (
                        "CSV_WRITE_FAILED",
                        error instanceof Error ? error.message : "The CSV file could not be written.",
                        "Check destination permissions and available space, then try again.",
                    ),
                ],
            );

            // Return control to the caller.

            return;
        }


        // Handle the case where display name differs from an absent value.

        if ( displayName !== null )
        {
            publishConsoleEntry (
                "CSV_EXPORT_COMPLETED",
                "message",
                "CSV export",
                `Exported ${csvDocument.rowCount} ${csvTransferName ( transferKind )} row(s) to '${displayName}'.`,
                csvTransferRoute ( transferKind ),
            );
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: runNativeEditCommand
    //
    // Description:
    //
    //   Runs the native edit command.
    //
    // Parameters:
    //
    //   - command:
    //     The command supplied to the operation.
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

    function runNativeEditCommand ( command: "copy" | "cut" | "paste" ): void
    {
        document.execCommand ( command );
    }


    //----------------------------------------------------------------------------------------------
    // Function: handleApplicationKeyDown
    //
    // Description:
    //
    //   Handles application key down.
    //
    // Parameters:
    //
    //   - event:
    //     The event to process.
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

    function handleApplicationKeyDown ( event: globalThis.KeyboardEvent ): void
    {
        // Handle the case where at least one branch condition is satisfied.

        if ( !( event.ctrlKey || event.metaKey ) || event.altKey )
        {
            // Return control to the caller.

            return;
        }


        // Initialize the local values needed by this operation.

        const target             = event.target;
        const textControlFocused = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ||
            ( target instanceof HTMLElement && target.isContentEditable );
        const key = event.key.toLocaleLowerCase ();


        // Handle the case where key matches the n value.

        if ( key === "n" )
        {
            event.preventDefault ();
            requestDocumentReplacement ( performNew );
        }
        else if ( key === "o" )
        {
            event.preventDefault ();
            requestDocumentReplacement ( performOpen );
        }
        else if ( key === "s" )
        {
            event.preventDefault ();
            void performSave ( event.shiftKey );
        }
        else if ( key === "p" )
        {
            event.preventDefault ();
            performPrint ();
        }
        else if ( key === "z" && !textControlFocused )
        {
            event.preventDefault ();
            performUndo ();
        }
        else if ( key === "y" && !textControlFocused )
        {
            event.preventDefault ();
            performRedo ();
        }
    }


    //----------------------------------------------------------------------------------------------
    // Function: completePrintChartCapture
    //
    // Description:
    //
    //   Completes the print chart capture.
    //
    // Parameters:
    //
    //   - canvas:
    //     The canvas supplied to the operation.
    //
    //   - request:
    //     The request supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    async function completePrintChartCapture (
        canvas: HTMLElement,
        request: PendingPrintChartCapture,
    ): Promise<void>
    {
        // Handle the case where print chart capture started reference current is enabled.

        if ( printChartCaptureStartedReference.current )
        {
            // Return control to the caller.

            return;
        }

        printChartCaptureStartedReference.current = true;


        // Run the operation that may report a recoverable failure.

        try
        {
            // Initialize the local values needed by this operation.

            const placedStateNames = new Set (
                request.draft.chart.states.map ( placement => placement.state ),
            );
            const expectedTransitionLabelCount = request.draft.stateMachine.transitionTable.filter (
                transition => placedStateNames.has ( transition.state ) &&
                    placedStateNames.has ( transition.stateNext ),
            ).length;

            // Repeat the operation across the bounded iteration range.

            for ( let attemptIndex = 0; attemptIndex < 120; attemptIndex += 1 )
            {
                // Handle the case where every expected transition label has been projected.

                if ( canvas.querySelectorAll ( ".chart-transition-edge .react-flow__edge-textwrapper" ).length ===
                    expectedTransitionLabelCount )
                {
                    break;
                }

                await new Promise<void> ( resolve =>
                    window.requestAnimationFrame ( () => resolve () ) );
            }

            // Handle the case where the complete transition-label projection is still unavailable.

            if ( canvas.querySelectorAll ( ".chart-transition-edge .react-flow__edge-textwrapper" ).length !==
                expectedTransitionLabelCount )
            {
                throw new Error ( "The print Chart did not finish projecting its transition labels." );
            }

            const imageSource = await captureChartImageDataUrl ( {
                canvas,
                fitRasterToLimits: true,
                modelName: request.draft.settings.name,
                preferences: {
                    ...request.preferences,
                    gridColor: adaptChartGridColor (
                        request.preferences.gridColor,
                        request.preferences.gridColorTheme,
                        "Light",
                    ),
                    imageDpi: COMPILE_TIME_CONFIGURATION.applicationSettings.printing.stateChartImage.dotsPerInch,
                    imageFileFormat:       "PNG",
                    imageUnit:             "Pixels",
                    maximumImageExportMegapixels:
                        COMPILE_TIME_CONFIGURATION.applicationSettings.printing.stateChartImage.maximumMegapixels,
                    showGrid:             false,
                    transparentBackground: true,
                },
            } );


            // Handle the case where application mounted reference current is enabled.

            if ( applicationMountedReference.current )
            {
                setPendingPrintChartCapture ( currentRequest => currentRequest === request ? null : currentRequest );
                setPrintableReport ( createPrintableReport (
                    request.draft,
                    request.documentRevision,
                    request.preferences,
                    request.fileName,
                    imageSource,
                ) );
            }
        }
        catch ( error )
        {
            // Recover from the reported failure without hiding its outcome.

            const errorMessage = error instanceof Error ? error.message : text ( "report.error.unknown" );
            const message      = `${text ( "report.error.print" )} ${errorMessage}`;

            printOperationPendingReference.current = false;
            publishConsoleEntry ( "PRINT_FAILED", "error", "Print", message );
            setMessageDialog ( { body: message, severity: "error" } );


            // Handle the case where application mounted reference current is enabled.

            if ( applicationMountedReference.current )
            {
                setPendingPrintChartCapture ( currentRequest => currentRequest === request ? null : currentRequest );
            }
        }
    }

    const handOffPrintableReport = useEffectEvent ( async ( report: PrintableReport ) =>
    {
        // Run the operation that may report a recoverable failure.

        try
        {
            await printPort.print ();
        }
        catch ( error )
        {
            // Recover from the reported failure without hiding its outcome.

            const errorMessage = error instanceof Error ? error.message : text ( "report.error.unknown" );
            const message      = `${text ( "report.error.print" )} ${errorMessage}`;

            publishConsoleEntry ( "PRINT_FAILED", "error", "Print", message );
            setMessageDialog ( { body: message, severity: "error" } );
        }
        finally
        {
            // Complete the cleanup required after the attempted operation.

            printOperationPendingReference.current = false;


            // Handle the case where application mounted reference current is enabled.

            if ( applicationMountedReference.current )
            {
                setPrintableReport ( currentReport => currentReport === report ? null : currentReport );
            }
        }
    } );

    useEffect ( () =>
    {
        // Handle the case where printable report matches an absent value.

        if ( printableReport === null )
        {
            // Return control to the caller.

            return;
        }

        const animationFrame = window.requestAnimationFrame ( () => void handOffPrintableReport ( printableReport ) );


        // Return the computed result.

        return () => window.cancelAnimationFrame ( animationFrame );
    }, [ printableReport ] );


    // Initialize the local values needed by this operation.

    const autoConnectServer = useEffectEvent ( ( serverUrl: string ) =>
    {
        void performServerConnect ( serverUrl, false );
    } );
    const handleServerEvent = useEffectEvent ( ( event: ServerEventEnvelope ) =>
    {
        reportServerEvent ( event );
    } );
    const handleServerConnectionLost = useEffectEvent ( ( failure: ServerGatewayFailure ) =>
    {
        // Initialize the local values needed by this operation.

        const operationWasPending = serverOperationPendingReference.current;

        replaceServerWorkspace ( markServerConnectionLost ( serverWorkspaceReference.current ) );


        // Handle the case where the operation was pending condition is not satisfied.

        if ( !operationWasPending )
        {
            reportServerFailure ( failure, false );
        }
    } );

    useEffect ( () => diagnosticChannel.subscribe ( setConsoleEntries ), [ diagnosticChannel ] );

    useEffect ( () =>
    {
        // Handle the case where the current value condition is not satisfied.

        if ( !( serverGateway instanceof BrowserServerWorkerGateway ) )
        {
            // Return control to the caller.

            return;
        }

        serverGateway.setServerEventHandler ( handleServerEvent );
        serverGateway.setConnectionLostHandler ( handleServerConnectionLost );


        // Return the computed result.

        return () =>
        {
            serverGateway.setServerEventHandler ( undefined );
            serverGateway.setConnectionLostHandler ( undefined );
        };
    }, [ serverGateway ] );

    useEffect ( () =>
    {
        applicationMountedReference.current = true;


        // Handle the case where server disposal timeout reference current differs from an absent
        // value.

        if ( serverDisposalTimeoutReference.current !== null )
        {
            window.clearTimeout ( serverDisposalTimeoutReference.current );
            serverDisposalTimeoutReference.current = null;
        }


        // Handle the case where the server auto connect started reference current condition is not
        // satisfied.

        if ( !serverAutoConnectStartedReference.current )
        {
            serverAutoConnectStartedReference.current = true;
            autoConnectServer ( initialPreferenceLoad.preferences.serverUrl );
        }


        // Return the computed result.

        return () =>
        {
            applicationMountedReference.current = false;
            const workspaceToDispose = serverWorkspaceReference.current;

            serverDisposalTimeoutReference.current = window.setTimeout ( () =>
            {
                serverDisposalTimeoutReference.current = null;
                void disposeServerWorkspace ( workspaceToDispose, serverGateway );
            }, 0 );
        };
    }, [ initialPreferenceLoad.preferences.serverUrl, serverGateway ] );

    const persistApplicationPreferences = useEffectEvent ( ( nextPreferences: ApplicationPreferences ) =>
    {
        // Initialize the local values needed by this operation.

        const saved = saveBrowserApplicationPreferences ( nextPreferences );


        // Handle the case where saved is enabled.

        if ( saved )
        {
            preferenceSaveWarningPublishedReference.current = false;
        }
        else if ( !preferenceSaveWarningPublishedReference.current )
        {
            preferenceSaveWarningPublishedReference.current = true;
            publishConsoleEntry (
                "PREFERENCE_SAVE_FAILED",
                "warning",
                "Preferences",
                text ( "console.preferenceSaveFailed" ),
            );
        }
    } );

    useEffect ( () =>
    {
        persistApplicationPreferences ( preferences );
    }, [ preferences ] );

    useEffect ( () =>
    {
        // Initialize the local values needed by this operation.

        const fileSuffix  = documentWorkspace.displayName === null ? "" : ` - ${documentWorkspace.displayName}`;
        const dirtySuffix = documentWorkspace.editorState?.dirty === true ? ` - ${text ( "document.dirty" )}` : "";

        document.title = `${text ( "application.name" )}${fileSuffix}${dirtySuffix}`;
    }, [ documentWorkspace.displayName, documentWorkspace.editorState?.dirty ] );

    useEffect ( () =>
    {
        //------------------------------------------------------------------------------------------
        // Function: listener
        //
        // Description:
        //
        //   Handles the listener behavior.
        //
        // Parameters:
        //
        //   - event:
        //     The event to process.
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
        //------------------------------------------------------------------------------------------

        const listener = ( event: globalThis.KeyboardEvent ): void => handleApplicationKeyDown ( event );

        document.addEventListener ( "keydown", listener );


        // Return the computed result.

        return () => document.removeEventListener ( "keydown", listener );
    } );

    // The Simulator page renders no diagnostic surface, so staleness and trace truncation are
    // reported here instead. Both are conditions rather than events: they stay true for as long as
    // the session holds them, and publishing on every render would turn one condition into an
    // unbounded stream of identical entries. Each is therefore reported on the transition into it,
    // keyed by the session that entered it, so a later session reports its own occurrence. The
    // session identifier makes each independently stale session eligible for one report.

    const reportSimulatorSessionStale = useEffectEvent ( ( session: HostedSessionDto ) =>
    {
        publishConsoleEntry (
            "SIMULATION_SESSION_STALE",
            "warning",
            "Simulator",
            `Session ${session.sessionId} is pinned to superseded revision ${session.modelRevision} and continues ` +
                "to run on that snapshot. Close it and start a new session to use the current hosted model.",
            "simulator",
        );
    } );
    const reportSimulatorTraceTruncated = useEffectEvent ( ( session: HostedSessionDto ) =>
    {
        publishConsoleEntry (
            "SIMULATION_TRACE_TRUNCATED",
            "warning",
            "Simulator",
            `Session ${session.sessionId} reached its trace retention bound; older transition and action entries ` +
                "were discarded. The traces no longer show the complete history.",
            "simulator",
        );
    } );

    useEffect ( () =>
    {
        // Initialize the local values needed by this operation.

        const session        = simulatorSession.session;
        const hostedRevision = serverWorkspace.lastKnownHostedRevision;

        // Keyed by the session identifier and never cleared. A session's staleness is one condition
        // rather than a series of them: once its pinned revision is superseded it stays superseded
        // until the session is closed, and the session that replaces it carries a new identifier.
        // Clearing the guard would therefore only create the opportunity to report the same
        // condition about the same session twice, which is exactly what a Pull would cause -- it
        // moves the hosted head across several renders, and the server's own stale flag is set
        // before the new head is recorded.

        if ( session === null || !isSimulatorSessionStale ( simulatorSession, hostedRevision ) )
        {
            // Return control to the caller.

            return;
        }


        // Handle the case where simulator stale reported reference current differs from session
        // session identifier.

        if ( simulatorStaleReportedReference.current !== session.sessionId )
        {
            simulatorStaleReportedReference.current = session.sessionId;

            reportSimulatorSessionStale ( session );
        }
    }, [ simulatorSession, serverWorkspace.lastKnownHostedRevision ] );

    useEffect ( () =>
    {
        // Initialize the local values needed by this operation.

        const session = simulatorSession.session;

        // Keyed by the session identifier, and cleared only by a Reset. Reset is the one event that
        // can retract truncation within a session, and it is recognised by the traces being empty
        // rather than by the flag alone, so that a second overflow after a Reset is reported again
        // while an ordinary snapshot cannot clear it.

        if ( session === null )
        {
            // Return control to the caller.

            return;
        }


        // Handle the case where the session trace truncated condition is not satisfied.

        if ( !session.traceTruncated )
        {
            // Handle the case where all required conditions are satisfied.

            if ( session.transitionTrace.length === 0 && session.actionTrace.length === 0 )
            {
                simulatorTruncationReportedReference.current = null;
            }


            // Return control to the caller.

            return;
        }


        // Handle the case where simulator truncation reported reference current differs from
        // session session identifier.

        if ( simulatorTruncationReportedReference.current !== session.sessionId )
        {
            simulatorTruncationReportedReference.current = session.sessionId;

            reportSimulatorTraceTruncated ( session );
        }
    }, [ simulatorSession ] );


    // Initialize the local values needed by this operation.

    const editorState         = documentWorkspace.editorState;
    const documentOpen        = editorState !== null;
    const documentValid       = editorState?.validationSummary.isValid === true;
    const documentPersistable = editorState !== null && validatePersistableAuthoringDraft ( editorState.draft ).isValid;
    const serverConnected     = serverWorkspace.connectionStatus === "connected";
    const serverReady         = serverConnected && serverWorkspace.readinessStatus === "ready";
    const serverConnection    = serverWorkspace.connectionStatus === "connected"
        ? "Connected" as const
        : serverWorkspace.connectionStatus === "connecting" ? "Connecting" as const : "Disconnected" as const;
    const hostedModelStatus = {
        connection:      serverConnection,
        isReady:         serverWorkspace.readinessStatus === "ready",
        modelRevision:   serverWorkspace.lastKnownHostedRevision,
        synchronization: serverWorkspace.synchronizationStatus === "synchronized"
            ? "Current" as const
            : serverWorkspace.synchronizationStatus === "diverged" ||
                serverWorkspace.synchronizationStatus === "conflict"
                ? "Local changes" as const
                : "Unknown" as const,
    };
    const pullAvailable           = serverReady && !serverOperationPending;
    const pushAvailable           = pullAvailable && documentValid && serverWorkspace.lastKnownHostedRevision !== null;
    const chartStatesExpanded     = editorState?.draft.chart.settings.expandStates ?? false;
    const chartExpansionAvailable = documentOpen && (
        activeRoute === "chart" || (
            activeRoute === "solver" && solverWorkspace.candidate !== null && solverWorkspace.status !== "running"
        )
    );
    const simulatorAvailability = simulatorCommandAvailability (
        {
            documentOpen,
            documentValid,
            hostedRevision:     serverWorkspace.lastKnownHostedRevision,
            isOperationPending: serverOperationPending,
            isServerReady:      serverReady,
        },
    );
    const simulatorSessionStale = isSimulatorSessionStale (
        simulatorSession,
        serverWorkspace.lastKnownHostedRevision,
    );
    const documentStatusBarViewModel = deriveDocumentStatusBar ( documentWorkspace );
    const chartContextualSegments    = activeRoute === "chart"
        ? [
            ...( chartSelectionCount > 0
                ? [ `${text ( "status.chartElementsSelected" )}: ${chartSelectionCount}` ]
                : [] ),
            ...( chartExportStatus === null ? [] : [ chartExportStatus ] ),
        ]
        : [];
    const simulatorContextualSegments = activeRoute === "simulator" && simulatorSession.session !== null
        ? [
            `${text ( "status.simulatorState" )}: ${simulatorSession.session.currentState}`,
            ...( simulatorSessionStale ? [ text ( "status.simulatorStale" ) ] : [] ),
        ]
        : [];
    const statusBarViewModel = {
        ...documentStatusBarViewModel,
        contextualSegments: [ ...chartContextualSegments, ...simulatorContextualSegments ],
        serverConnection,
    };
    const csvImportEntries: readonly MenuEntry[] =
    [
        ...CSV_TRANSFER_KINDS.map ( transferKind => ( {
            disabled:   !documentOpen,
            identifier: `file-import-csv-${transferKind}`,
            kind:       "item" as const,
            label:      csvTransferName ( transferKind ),
            onSelect:   () => void performCsvImport ( transferKind ),
        } ) ),
        {
            disabled:   documentWorkspace.editorState === null,
            identifier: "file-import-csv-solver-observation-sequence",
            kind:       "item",
            label:      text ( "menu.file.csv.solverObservationSequence" ),
            onSelect:   () => void beginSolverCsvImport (),
        },
        {
            disabled:   documentWorkspace.editorState === null,
            identifier: "file-import-csv-simulator-event-sequence",
            kind:       "item",
            label:      text ( "menu.file.csv.simulatorEventSequence" ),
            onSelect:   () => void beginSimulatorCsvImport (),
        },
    ];
    const csvExportEntries: readonly MenuEntry[] =
    [
        ...CSV_TRANSFER_KINDS.map ( transferKind => ( {
            disabled:   !documentOpen,
            identifier: `file-export-csv-${transferKind}`,
            kind:       "item" as const,
            label:      csvTransferName ( transferKind ),
            onSelect:   () => void performCsvExport ( transferKind ),
        } ) ),
        {
            disabled:   ( documentWorkspace.editorState?.draft.solver.sequences.length ?? 0 ) === 0,
            identifier: "file-export-csv-solver-observation-sequence",
            kind:       "item",
            label:      text ( "menu.file.csv.solverObservationSequence" ),
            onSelect:   beginSolverCsvExport,
        },
        {
            disabled:   ( documentWorkspace.editorState?.draft.simulator.sequences.length ?? 0 ) === 0,
            identifier: "file-export-csv-simulator-event-sequence",
            kind:       "item",
            label:      text ( "menu.file.csv.simulatorEventSequence" ),
            onSelect:   beginSimulatorCsvExport,
        },
    ];

    const menus: readonly MenuDefinition[] = [
        {
            entries: [
                {
                    icon: fluentIcon ( "ic_fluent_document_add_16_regular.svg" ),
                    identifier: "file-new",
                    kind: "item",
                    label: text ( "menu.file.new" ),
                    onSelect: () => requestDocumentReplacement ( performNew ),
                    shortcut: "Ctrl+N",
                },
                {
                    icon: fluentIcon ( "ic_fluent_folder_open_16_regular.svg" ),
                    identifier: "file-open",
                    kind: "item",
                    label: text ( "menu.file.open" ),
                    onSelect: () => requestDocumentReplacement ( performOpen ),
                    shortcut: "Ctrl+O",
                },
                {
                    disabled: !documentPersistable,
                    icon: fluentIcon ( "ic_fluent_save_16_regular.svg" ),
                    identifier: "file-save",
                    kind: "item",
                    label: text ( "menu.file.save" ),
                    onSelect: () => void performSave ( false ),
                    shortcut: "Ctrl+S",
                },
                {
                    disabled: !documentPersistable,
                    icon: customIcon ( 16, "document-save-as.svg" ),
                    identifier: "file-save-as",
                    kind: "item",
                    label: text ( "menu.file.saveAs" ),
                    onSelect: () => void performSave ( true ),
                },
                {
                    disabled: !documentOpen,
                    icon: fluentIcon ( "ic_fluent_document_dismiss_16_regular.svg" ),
                    identifier: "file-close",
                    kind: "item",
                    label: text ( "menu.file.close" ),
                    onSelect: () => requestDocumentReplacement ( performClose ),
                },
                { kind: "separator" },
                { disabled: !documentOpen, icon: fluentIcon ( "ic_fluent_clipboard_task_list_16_regular.svg" ), identifier: "file-validate", kind: "item", label: text ( "menu.file.validate" ), onSelect: performValidation },
                { kind: "separator" },
                {
                    disabled: !pullAvailable,
                    icon: fluentIcon ( "ic_fluent_arrow_download_16_regular.svg" ),
                    identifier: "file-pull",
                    kind: "item",
                    label: text ( "menu.file.pull" ),
                    onSelect: () => requestDocumentReplacement ( performServerPull ),
                },
                {
                    disabled: !pushAvailable,
                    icon: fluentIcon ( "ic_fluent_arrow_upload_16_regular.svg" ),
                    identifier: "file-push",
                    kind: "item",
                    label: text ( "menu.file.push" ),
                    onSelect: () => void performServerPush (),
                },
                { kind: "separator" },
                {
                    children:   csvImportEntries,
                    disabled:   !documentOpen,
                    icon:       fluentIcon ( "ic_fluent_arrow_import_16_regular.svg" ),
                    identifier: "file-import-csv",
                    kind:       "item",
                    label:      text ( "menu.file.importCsv" ),
                },
                {
                    children:   csvExportEntries,
                    disabled:   !documentOpen,
                    icon:       fluentIcon ( "ic_fluent_arrow_export_16_regular.svg" ),
                    identifier: "file-export-csv",
                    kind:       "item",
                    label:      text ( "menu.file.exportCsv" ),
                },
                { kind: "separator" },
                { disabled: serverOperationPending || serverWorkspace.connectionStatus !== "disconnected", icon: customIcon ( 16, "server-connect.svg" ), identifier: "file-connect", kind: "item", label: text ( "menu.file.connect" ), onSelect: () => void performServerConnect () },
                { disabled: serverOperationPending || !serverConnected, icon: customIcon ( 16, "server-disconnect.svg" ), identifier: "file-disconnect", kind: "item", label: text ( "menu.file.disconnect" ), onSelect: () => void performServerDisconnect () },
                { disabled: serverOperationPending || !serverConnected, icon: customIcon ( 16, "server-test.svg" ), identifier: "file-test-server", kind: "item", label: text ( "menu.file.testServer" ), onSelect: () => void performServerTest () },
                { kind: "separator" },
                {
                    icon:       fluentIcon ( "ic_fluent_document_settings_16_regular.svg" ),
                    identifier: "file-page-setup",
                    kind:       "item",
                    label:      text ( "menu.file.pageSetup" ),
                    onSelect:   openPageSetup,
                },
                {
                    disabled:   !documentOpen || printableReport !== null || pendingPrintChartCapture !== null,
                    icon:       fluentIcon ( "ic_fluent_print_16_regular.svg" ),
                    identifier: "file-print",
                    kind:       "item",
                    label:      text ( "menu.file.print" ),
                    onSelect:   performPrint,
                    shortcut:   "Ctrl+P",
                },
                { kind: "separator" },
                {
                    icon: fluentIcon ( "ic_fluent_settings_16_regular.svg" ),
                    identifier: "file-settings",
                    kind: "item",
                    label: text ( "menu.file.settings" ),
                    onSelect: openSettings,
                },
            ],
            identifier: "file",
            label: text ( "menu.file" ),
        },
        {
            entries: [
                {
                    icon: fluentIcon ( "ic_fluent_cut_16_regular.svg" ),
                    identifier: "edit-cut",
                    kind: "item",
                    label: text ( "menu.edit.cut" ),
                    onSelect: () => runNativeEditCommand ( "cut" ),
                    shortcut: "Ctrl+X",
                },
                {
                    icon: fluentIcon ( "ic_fluent_copy_16_regular.svg" ),
                    identifier: "edit-copy",
                    kind: "item",
                    label: text ( "menu.edit.copy" ),
                    onSelect: () => runNativeEditCommand ( "copy" ),
                    shortcut: "Ctrl+C",
                },
                {
                    icon: fluentIcon ( "ic_fluent_clipboard_paste_16_regular.svg" ),
                    identifier: "edit-paste",
                    kind: "item",
                    label: text ( "menu.edit.paste" ),
                    onSelect: () => runNativeEditCommand ( "paste" ),
                    shortcut: "Ctrl+V",
                },
                { kind: "separator" },
                {
                    disabled: ( editorState?.undoStack.length ?? 0 ) === 0,
                    icon: fluentIcon ( "ic_fluent_arrow_undo_16_regular.svg" ),
                    identifier: "edit-undo",
                    kind: "item",
                    label: text ( "menu.edit.undo" ),
                    onSelect: performUndo,
                    shortcut: "Ctrl+Z",
                },
                {
                    disabled: ( editorState?.redoStack.length ?? 0 ) === 0,
                    icon: fluentIcon ( "ic_fluent_arrow_redo_16_regular.svg" ),
                    identifier: "edit-redo",
                    kind: "item",
                    label: text ( "menu.edit.redo" ),
                    onSelect: performRedo,
                    shortcut: "Ctrl+Y",
                },
            ],
            identifier: "edit",
            label: text ( "menu.edit" ),
        },
        {
            entries: [
                {
                    checked: activeRoute === "editor",
                    icon: customIcon ( 16, "state-machine-editor.svg" ),
                    identifier: "view-editor",
                    kind: "item",
                    label: text ( "menu.view.editor" ),
                    onSelect: () => navigate ( "editor" ),
                },
                {
                    checked: activeRoute === "chart",
                    icon: customIcon ( 16, "state-machine-state-chart.svg" ),
                    identifier: "view-chart",
                    kind: "item",
                    label: text ( "menu.view.chart" ),
                    onSelect: () => navigate ( "chart" ),
                },
                {
                    checked: activeRoute === "solver",
                    icon: customIcon ( 16, "state-machine-solver.svg" ),
                    identifier: "view-solver",
                    kind: "item",
                    label: text ( "menu.view.solver" ),
                    onSelect: () => navigate ( "solver" ),
                },
                {
                    checked: activeRoute === "simulator",
                    icon: customIcon ( 16, "state-machine-simulator.svg" ),
                    identifier: "view-simulator",
                    kind: "item",
                    label: text ( "menu.view.simulator" ),
                    onSelect: () => navigate ( "simulator" ),
                },
                { kind: "separator" },
                {
                    identifier: "view-expand-all",
                    kind: "item",
                    label: text ( "menu.view.expandAll" ),
                    onSelect: () => setEditorExpanded ( true ),
                },
                {
                    identifier: "view-collapse-all",
                    kind: "item",
                    label: text ( "menu.view.collapseAll" ),
                    onSelect: () => setEditorExpanded ( false ),
                },
                { kind: "separator" },
                {
                    identifier: "view-clear-console",
                    kind: "item",
                    label: text ( "console.clear" ),
                    onSelect: () => diagnosticChannel.clear (),
                },
                {
                    checked: preferences.consoleVisible,
                    identifier: "view-console",
                    kind: "item",
                    label: text ( "menu.view.console" ),
                    onSelect: () => updatePreferences ( { consoleVisible: !preferences.consoleVisible } ),
                },
                { kind: "separator" },
                {
                    checked: chartStatesExpanded,
                    disabled: !chartExpansionAvailable,
                    identifier: "view-expand-chart-states",
                    kind: "item",
                    label: text ( "menu.view.expandChartStates" ),
                    onSelect: () => updateChartStatesExpanded ( !chartStatesExpanded ),
                },
                { kind: "separator" },
                {
                    children: [
                        {
                            checked: preferences.theme === "Light",
                            icon: fluentIcon ( "ic_fluent_weather_sunny_16_regular.svg" ),
                            identifier: "theme-light",
                            kind: "item",
                            label: text ( "menu.view.theme.light" ),
                            onSelect: () => selectTheme ( "Light" ),
                        },
                        {
                            checked: preferences.theme === "Dark",
                            icon: fluentIcon ( "ic_fluent_weather_moon_16_regular.svg" ),
                            identifier: "theme-dark",
                            kind: "item",
                            label: text ( "menu.view.theme.dark" ),
                            onSelect: () => selectTheme ( "Dark" ),
                        },
                    ],
                    icon: customIcon ( 16, "theme-light-dark.svg" ),
                    identifier: "view-theme",
                    kind: "item",
                    label: text ( "menu.view.theme" ),
                },
            ],
            identifier: "view",
            label: text ( "menu.view" ),
        },
        {
            entries: [
                {
                    identifier: "help-documentation",
                    kind: "item",
                    label: text ( "menu.help.documentation" ),
                    onSelect: () => window.open (
                        new URL ( `${ import.meta.env.BASE_URL }docs/user-guide/`, window.location.origin ).href,
                        "_blank",
                        "noopener",
                    ),
                },
                { kind: "separator" },
                {
                    identifier: "help-about",
                    kind: "item",
                    label: text ( "menu.help.about" ),
                    onSelect: () => setAboutDialogOpen ( true ),
                },
            ],
            identifier: "help",
            label: text ( "menu.help" ),
        },
    ];

    const toolbarEntries: readonly ToolbarEntry[] = [
        { icon: fluentIcon ( "ic_fluent_document_add_20_regular.svg" ), identifier: "toolbar-new", kind: "button", label: text ( "menu.file.new" ), onSelect: () => requestDocumentReplacement ( performNew ) },
        { icon: fluentIcon ( "ic_fluent_folder_open_20_regular.svg" ), identifier: "toolbar-open", kind: "button", label: text ( "menu.file.open" ), onSelect: () => requestDocumentReplacement ( performOpen ) },
        { disabled: !documentPersistable, icon: fluentIcon ( "ic_fluent_save_20_regular.svg" ), identifier: "toolbar-save", kind: "button", label: text ( "menu.file.save" ), onSelect: () => void performSave ( false ) },
        { disabled: !documentPersistable, icon: fluentIcon ( "ic_fluent_save_copy_20_regular.svg" ), identifier: "toolbar-save-as", kind: "button", label: text ( "menu.file.saveAs" ), onSelect: () => void performSave ( true ) },
        { kind: "separator" },
        { disabled: !pullAvailable, icon: fluentIcon ( "ic_fluent_arrow_download_20_regular.svg" ), identifier: "toolbar-pull", kind: "button", label: text ( "menu.file.pull" ), onSelect: () => requestDocumentReplacement ( performServerPull ) },
        { disabled: !pushAvailable, icon: fluentIcon ( "ic_fluent_arrow_upload_20_regular.svg" ), identifier: "toolbar-push", kind: "button", label: text ( "menu.file.push" ), onSelect: () => void performServerPush () },
        { kind: "separator" },
        { disabled: ( editorState?.undoStack.length ?? 0 ) === 0, icon: fluentIcon ( "ic_fluent_arrow_undo_20_regular.svg" ), identifier: "toolbar-undo", kind: "button", label: text ( "menu.edit.undo" ), onSelect: performUndo },
        { disabled: ( editorState?.redoStack.length ?? 0 ) === 0, icon: fluentIcon ( "ic_fluent_arrow_redo_20_regular.svg" ), identifier: "toolbar-redo", kind: "button", label: text ( "menu.edit.redo" ), onSelect: performRedo },
        { kind: "separator" },
        { icon: customIcon ( 20, "state-machine-editor.svg" ), identifier: "toolbar-editor", kind: "button", label: text ( "menu.view.editor" ), onSelect: () => navigate ( "editor" ), pressed: activeRoute === "editor" },
        { icon: customIcon ( 20, "state-machine-state-chart.svg" ), identifier: "toolbar-chart", kind: "button", label: text ( "menu.view.chart" ), onSelect: () => navigate ( "chart" ), pressed: activeRoute === "chart" },
        { icon: customIcon ( 20, "state-machine-solver.svg" ), identifier: "toolbar-solver", kind: "button", label: text ( "menu.view.solver" ), onSelect: () => navigate ( "solver" ), pressed: activeRoute === "solver" },
        { icon: customIcon ( 20, "state-machine-simulator.svg" ), identifier: "toolbar-simulator", kind: "button", label: text ( "menu.view.simulator" ), onSelect: () => navigate ( "simulator" ), pressed: activeRoute === "simulator" },
        { kind: "separator" },
        { disabled: !chartExpansionAvailable, icon: customIcon ( 20, "state-machine-state-chart-palette-state.svg" ), identifier: "toolbar-expand-chart-states", kind: "button", label: text ( "menu.view.expandChartStates" ), onSelect: () => updateChartStatesExpanded ( !chartStatesExpanded ), pressed: chartStatesExpanded },
        { kind: "separator" },
        {
            choices: [
                {
                    checked: preferences.theme === "Light",
                    identifier: "toolbar-theme-light",
                    label: text ( "menu.view.theme.light" ),
                    onSelect: () => selectTheme ( "Light" ),
                },
                {
                    checked: preferences.theme === "Dark",
                    identifier: "toolbar-theme-dark",
                    label: text ( "menu.view.theme.dark" ),
                    onSelect: () => selectTheme ( "Dark" ),
                },
            ],
            icon: fluentIcon ( "ic_fluent_dark_theme_20_regular.svg" ),
            identifier: "toolbar-theme",
            kind: "button",
            label: text ( "menu.view.theme" ),
        },
    ];

    const shellStyle =
    {
        "--console-panel-height": `${preferences.consolePanelHeight}px`,
        "--master-panel-width": `${preferences.masterPanelWidth}px`,
    } as CSSProperties;
    const detailContent = activeRoute === "solver"
        ? (
            <SolverPage
                chartNameWrapping={
                    {
                        actionNames: preferences.wrapActionNames,
                        eventNames:  preferences.wrapEventNames,
                        stateNames:  preferences.wrapStateNames,
                    }
                }
                draft              = { editorState?.draft ?? null }
                onApplyCandidate   = { requestSolverCandidateApply }
                onCancelSolve      = { () => void solverWorkerPort.cancel () }
                onDiscardCandidate = { () => setSolverWorkspace ( current => discardSolverCandidate ( current ) ) }
                onSequencesChange  = { replaceSolverSequences }
                onSolve            = { observations => void solveObservations ( observations ) }
                onValidate         = { validateSolverSequences }
                solverWorkspace    = { solverWorkspace }
            />
        )
        : EDITOR_ROUTES.includes ( activeRoute ) ? (
            <EditorWorkspace
                draft             = { editorState?.draft ?? null }
                hostedModelStatus = { hostedModelStatus }
                onCommand         = { dispatchDocumentCommand }
                onNew             = { () => requestDocumentReplacement ( performNew ) }
                onValidate        = { performValidation }
                route             = { activeRoute }
                validationStatus  = { documentWorkspace.validationStatus }
            />
        ) : activeRoute === "chart" ? (
            <ChartPage
                diagnostics                                   = { editorState?.validationSummary.diagnostics ?? [] }
                documentRevision                              = { editorState?.documentRevision ?? 0 }
                draft                                         = { editorState?.draft ?? null }
                collapsedStateHeight                          = { preferences.collapsedStateHeight }
                collapsedStateWidth                           = { preferences.collapsedStateWidth }
                deleteOrphanedChartItemsDuringAutomaticLayout = {
                    preferences.deleteOrphanedChartItemsDuringAutomaticLayout
                }
                expandedStateMinimumHeight = { preferences.expandedStateMinimumHeight }
                expandedStateWidth         = { preferences.expandedStateWidth }
                gridSize                   = { preferences.gridSize }
                layoutPort                 = { chartLayoutPort }
                nameWrapping               = {
                    {
                        actionNames: preferences.wrapActionNames,
                        eventNames:  preferences.wrapEventNames,
                        stateNames:  preferences.wrapStateNames,
                    }
                }
                onCommand          = { dispatchDocumentCommand }
                onInteractionError = { message => reportCommandFailure ( "CHART_INTERACTION_FAILURE", message ) }
                onNew              = { () => requestDocumentReplacement ( performNew ) }
                onLayoutDiagnostic = { message => publishConsoleEntry (
                    "CHART_LAYOUT_MINIMUM_DISTANCE_RAISED",
                    "message",
                    "Chart",
                    message,
                    "chart",
                ) }
                onRoutingDiagnostic={ message => publishConsoleEntry (
                    "CHART_ROUTING_FALLBACK",
                    "warning",
                    "Chart",
                    message,
                    "chart",
                ) }
                onSaveAsImage               = { performChartImageExport }
                onSelectionCountChange      = { setChartSelectionCount }
                routingPort                 = { chartRoutingPort }
                selfTransitionLoopAspect    = { preferences.selfTransitionLoopAspect }
                selfTransitionLoopExtension = { preferences.selfTransitionLoopExtension }
                selfTransitionLoopSpacing   = { preferences.selfTransitionLoopSpacing }
                gridColor                   = { adaptChartGridColor (
                    preferences.gridColor,
                    preferences.gridColorTheme,
                    preferences.theme,
                ) }
                gridStyle                      = { preferences.gridStyle }
                showGrid                       = { preferences.showGrid }
                snapToGrid                     = { preferences.snapToGrid }
                minimumStateDistance           = { preferences.minimumStateDistance }
                transitionArrowHeadSize        = { preferences.transitionArrowHeadSize }
                transitionGravityPointDistance = { preferences.transitionGravityPointDistance }
                transitionLabelAlignment       = { preferences.transitionLabelAlignment }
            />
        ) : activeRoute === "simulator" ? (
            <SimulatorPage
                availability       = { simulatorAvailability }
                draft              = { editorState?.draft ?? null }
                onCloseSession     = { () => void performSimulatorSessionClose () }
                onReset            = { () => void performSimulatorReset () }
                onRun              = { events => void performSimulatorRun ( events ) }
                onSequencesChange  = { replaceSimulatorSequences }
                onStartSession     = { () => void performSimulatorSessionStart () }
                onStep             = { events => void performSimulatorStep ( events ) }
                onStepCursorChange = { stepCursor => setSimulatorSession (
                    current => ( { ...current, stepCursor } ),
                ) }
                session    = { simulatorSession.session }
                stepCursor = { simulatorSession.stepCursor }
            />
        ) : null;


    // Return the rendered interface.

    return (
        <ErrorBoundary
            heading = { text ( "application.error.heading" ) }
            message = { text ( "application.error.message" ) }
            onError = { error => diagnosticChannel.publish (
                {
                    code: "PRESENTATION_ERROR",
                    identifier: `presentation-error-${Date.now ()}`,
                    severity: "error",
                    source: "React",
                    text: error.message,
                    timestamp: new Date ().toISOString (),
                }
            ) }
        >
            <>
            <div
                className="application-shell"
                data-active-region={ activeRegion }
                data-console-visible={ preferences.consoleVisible }
                data-master-visible={ preferences.masterPanelVisible }
                data-theme={ preferences.theme.toLocaleLowerCase () }
                style={ shellStyle }
            >
                <header className="application-title-bar">
                    <Icon className="application-icon" name="20/state-machine-application.png" source="custom" />
                    <strong>{ text ( "application.name" ) }</strong>
                    { documentWorkspace.displayName !== null && <span> - { documentWorkspace.displayName }</span> }
                    { editorState?.dirty === true && <span aria-hidden="true" className="dirty-marker"> *</span> }
                    <span aria-live="polite" className="visually-hidden">
                        { editorState?.dirty === true ? text ( "document.dirty" ) : "" }
                    </span>
                    <span className="title-version">{ text ( "application.version" ) }</span>
                </header>
                <MenuBar accessibleLabel={ text ( "application.menuLabel" ) } menus={ menus } />
                <Toolbar entries={ toolbarEntries } />
                <nav aria-label={ text ( "application.workspaceRegions" ) } className="responsive-region-navigation">
                    <button
                        aria-pressed={ activeRegion === "master" }
                        onClick={ () =>
                        {
                            updatePreferences ( { masterPanelVisible: true } );
                            setActiveRegion ( "master" );
                        } }
                        type="button"
                    >
                        { text ( "button.showMaster" ) }
                    </button>
                    <button aria-pressed={ activeRegion === "detail" } onClick={ () => setActiveRegion ( "detail" ) } type="button">
                        { text ( "button.showDetail" ) }
                    </button>
                    <button
                        aria-pressed={ activeRegion === "console" }
                        onClick={ () =>
                        {
                            updatePreferences ( { consoleVisible: true } );
                            setActiveRegion ( "console" );
                        } }
                        type="button"
                    >
                        { text ( "button.showConsole" ) }
                    </button>
                </nav>
                <main className="workspace">
                    <div className="upper-workspace">
                        <aside aria-label={ text ( "panel.master.title" ) } className="master-panel">
                            <header className="panel-title-bar">
                                <h2>{ text ( "panel.master.title" ) }</h2>
                                <button
                                    aria-label={ text ( "button.toggleMaster" ) }
                                    className = "panel-close-button"
                                    onClick   = { () => updatePreferences ( { masterPanelVisible: false } ) }
                                    type      = "button"
                                >
                                    ×
                                </button>
                            </header>
                            <NavigationTree
                                activeRoute      = { activeRoute }
                                editorExpanded   = { editorExpanded }
                                onExpandedChange = { setEditorExpanded }
                                onSelect         = { navigate }
                            />
                        </aside>
                        <Splitter
                            label           = { text ( "splitter.master.label" ) }
                            minimum         = { MINIMUM_MASTER_PANEL_WIDTH }
                            onChange        = { masterPanelWidth => updatePreferences ( { masterPanelWidth } ) }
                            opposingMinimum = { MINIMUM_DETAIL_PANE_BUTTON_WIDTH }
                            orientation     = "vertical"
                            value           = { preferences.masterPanelWidth }
                        />
                        <section aria-label={ text ( "panel.detail.title" ) } className="detail-region">
                            <DetailPage ref={ detailHeadingReference } route={ activeRoute }>{ detailContent }</DetailPage>
                        </section>
                    </div>
                    <Splitter
                        controls    = "trailing"
                        label       = { text ( "splitter.console.label" ) }
                        minimum     = { MINIMUM_CONSOLE_PANEL_HEIGHT }
                        onChange    = { consolePanelHeight => updatePreferences ( { consolePanelHeight } ) }
                        orientation = "horizontal"
                        value       = { preferences.consolePanelHeight }
                    />
                    <ConsolePanel
                        entries             = { consoleEntries }
                        filters             = { consoleFilters }
                        followTail          = { preferences.followConsoleTail }
                        onClear             = { () => diagnosticChannel.clear () }
                        onFiltersChange     = { setConsoleFilters }
                        onFollowTailChange  = { followConsoleTail => updatePreferences ( { followConsoleTail } ) }
                        onNavigateToContext = { route => navigate ( route ) }
                    />
                </main>
                <StatusBar viewModel={ statusBarViewModel } />
                <AboutDialog onClose={ () => setAboutDialogOpen ( false ) } open={ aboutDialogOpen } />
                <PageSetupDialog
                    onApply           = { applyPageSetup }
                    onClose           = { () => setPageSetupDialogOpen ( false ) }
                    onPageSetupChange = { setPageSetupDraft }
                    open              = { pageSetupDialogOpen }
                    pageSetup         = { pageSetupDraft }
                />
                <SettingsDialog
                    { ...( serverOperationPending
                        ? {}
                        : { onTestServer: ( serverUrl: string ) => void performServerTest ( serverUrl ) } ) }
                    onApply                = { applySettings }
                    onClose                = { () => setSettingsDialogOpen ( false ) }
                    onPreferencesChange    = { setSettingsDraft }
                    open                   = { settingsDialogOpen }
                    preferences            = { settingsDraft }
                    serverOperationPending = { serverOperationPending }
                />
                <DirtyReplacementDialog
                    canSave = { documentPersistable }
                    onClose = { () =>
                    {
                        pendingReplacementReference.current = null;
                        setDirtyDialogOpen ( false );
                    } }
                    onDiscardContinue = { () => void continuePendingReplacement () }
                    onSaveContinue    = { () => void saveAndContinuePendingReplacement () }
                    open              = { dirtyDialogOpen }
                />
                { incompleteDocumentWarning?.mode === "save" && (
                    <IncompleteDocumentWarningDialog
                        diagnostics  = { incompleteDocumentWarning.diagnostics }
                        mode         = "save"
                        onClose      = { cancelIncompleteDocumentSave }
                        onSaveAnyway = { () => void confirmIncompleteDocumentSave () }
                        open
                    />
                ) }
                { incompleteDocumentWarning?.mode === "open" && (
                    <IncompleteDocumentWarningDialog
                        diagnostics = { incompleteDocumentWarning.diagnostics }
                        mode        = "open"
                        onClose     = { () => setIncompleteDocumentWarning ( null ) }
                        open
                    />
                ) }
                { impactPlan !== null && (
                    <ImpactConfirmationDialog
                        impact    = { impactPlan.impact }
                        onClose   = { () => setImpactPlan ( null ) }
                        onConfirm = { () =>
                        {
                            commitCommandPlan ( impactPlan );
                            setImpactPlan ( null );
                        } }
                        open
                    />
                ) }
                { pendingCsvImport !== null && (
                    <CsvImportConflictDialog
                        conflictKeys = { pendingCsvImport.conflictKeys }
                        onClose      = { () => setPendingCsvImport ( null ) }
                        onOverwrite  = { commitPendingCsvImport }
                        open
                        rowCount     = { pendingCsvImport.rowCount }
                        transferName = { pendingCsvImport.transferName }
                    />
                ) }
                { transitionCsvMissingReferences !== null && (
                    <TransitionCsvReferenceDialog
                        missingEvents = { transitionCsvMissingReferences.events }
                        missingStates = { transitionCsvMissingReferences.states }
                        onClose       = { () => setTransitionCsvMissingReferences ( null ) }
                        open
                    />
                ) }
                { pendingSolverCandidate !== null && (
                    <SolverReplacementDialog
                        candidateSummary={
                            `${documentWorkspace.displayName ?? documentWorkspace.editorState?.draft.settings.name ?? "Document"}; ` +
                            `baseline document ${pendingSolverCandidate.baselineDocumentRevision}, Solver ${pendingSolverCandidate.baselineSolverRevision}; ` +
                            `${documentWorkspace.editorState?.draft.stateMachine.states.length ?? 0} current / ` +
                            `${pendingSolverCandidate.stateMachine.states.length} candidate states; ` +
                            `${pendingSolverCandidate.statistics.generatedStateCount} inferred states; ` +
                            `${documentWorkspace.editorState?.draft.stateMachine.stateActions.exit.length ?? 0} exit-action assignments will be removed.`
                        }
                        onClose   = { () => setPendingSolverCandidate ( null ) }
                        onReplace = { applyPendingSolverCandidate }
                        open
                    />
                ) }
                { simulatorCsvDialog !== null && (
                    <SimulatorSequenceCsvDialog
                        mode      = { simulatorCsvDialog.mode }
                        onClose   = { () => setSimulatorCsvDialog ( null ) }
                        onConfirm = { sequenceName => void confirmSimulatorCsvTransfer ( sequenceName ) }
                        open
                        sequences={ documentWorkspace.editorState?.draft.simulator.sequences ?? [] }
                    />
                ) }
                { solverCsvDialog !== null && (
                    <SolverSequenceCsvDialog
                        mode      = { solverCsvDialog.mode }
                        onClose   = { () => setSolverCsvDialog ( null ) }
                        onConfirm = { sequenceName => void confirmSolverCsvTransfer ( sequenceName ) }
                        open
                        sequences={ documentWorkspace.editorState?.draft.solver.sequences ?? [] }
                    />
                ) }
                <SimulatorModelDifferenceDialog
                    onClose            = { () => setSimulatorModelDifferenceDialogOpen ( false ) }
                    onPushAndStart     = { () => void pushModelAndStartSimulatorSession () }
                    onStartWithoutPush = { () => void startSimulatorSessionWithoutPush () }
                    open               = { simulatorModelDifferenceDialogOpen }
                />
                <MessageDialog
                    body          = { messageDialog?.body ?? "" }
                    onAcknowledge = { () => undefined }
                    onClose       = { () => setMessageDialog ( null ) }
                    open          = { messageDialog !== null }
                    severity      = { messageDialog?.severity ?? "message" }
                />
            </div>
            { pendingPrintChartCapture !== null && (
                <div
                    aria-hidden="true"
                    className="application-shell print-chart-capture-shell"
                    data-theme="light"
                    inert
                >
                    <ChartPage
                        collapsedStateHeight                          = { pendingPrintChartCapture.preferences.collapsedStateHeight }
                        collapsedStateWidth                           = { pendingPrintChartCapture.preferences.collapsedStateWidth }
                        deleteOrphanedChartItemsDuringAutomaticLayout = {
                            pendingPrintChartCapture.preferences.deleteOrphanedChartItemsDuringAutomaticLayout
                        }
                        diagnostics                = { [] }
                        documentRevision           = { pendingPrintChartCapture.documentRevision }
                        draft                      = { pendingPrintChartCapture.draft }
                        expandedStateMinimumHeight = {
                            pendingPrintChartCapture.preferences.expandedStateMinimumHeight
                        }
                        expandedStateWidth = { pendingPrintChartCapture.preferences.expandedStateWidth }
                        gridColor          = { adaptChartGridColor (
                            pendingPrintChartCapture.preferences.gridColor,
                            pendingPrintChartCapture.preferences.gridColorTheme,
                            "Light",
                        ) }
                        gridSize             = { pendingPrintChartCapture.preferences.gridSize }
                        gridStyle            = { pendingPrintChartCapture.preferences.gridStyle }
                        layoutPort           = { printChartLayoutPort }
                        minimumStateDistance = { pendingPrintChartCapture.preferences.minimumStateDistance }
                        nameWrapping         = { {
                            actionNames: pendingPrintChartCapture.preferences.wrapActionNames,
                            eventNames:  pendingPrintChartCapture.preferences.wrapEventNames,
                            stateNames:  pendingPrintChartCapture.preferences.wrapStateNames,
                        } }
                        onCommand          = { () => false }
                        onInteractionError = { () => undefined }
                        onNew              = { () => undefined }
                        onSceneReady       = { canvas =>
                            void completePrintChartCapture ( canvas, pendingPrintChartCapture ) }
                        routingPort              = { printChartRoutingPort }
                        selfTransitionLoopAspect = {
                            pendingPrintChartCapture.preferences.selfTransitionLoopAspect
                        }
                        selfTransitionLoopExtension={
                            pendingPrintChartCapture.preferences.selfTransitionLoopExtension
                        }
                        selfTransitionLoopSpacing={
                            pendingPrintChartCapture.preferences.selfTransitionLoopSpacing
                        }
                        showGrid                = { false }
                        snapToGrid              = { pendingPrintChartCapture.preferences.snapToGrid }
                        transitionArrowHeadSize = {
                            pendingPrintChartCapture.preferences.transitionArrowHeadSize
                        }
                        transitionGravityPointDistance={
                            pendingPrintChartCapture.preferences.transitionGravityPointDistance
                        }
                        transitionLabelAlignment={
                            pendingPrintChartCapture.preferences.transitionLabelAlignment
                        }
                    />
                </div>
            ) }
            { printableReport !== null && <PrintableReportSurface report={ printableReport } /> }
            </>
        </ErrorBoundary>
    );
}
