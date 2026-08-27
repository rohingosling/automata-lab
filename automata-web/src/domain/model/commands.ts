// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Immutable Document Commands
// Version: 1.0.0
// Date:    2026-08-09
// Author:  Rohin Gosling
//
// Description:
//
//   Plans and executes every revision-checked Editor mutation with atomic undo and redo history.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type
{
    AuthoringDraft,
    ChartDraftTransition,
    ChartInitialStateIndicator,
    ChartPoint,
    ChartStatePlacement,
    DocumentSettings,
    NamedEntity,
    SimulatorSequence,
    SolverCandidate,
    SolverSequence,
    StateActionMapping,
    TerminalStateIndicator,
    TerminalStateIndicatorTransition,
    TransitionDefinition,
} from "./contracts.js";
import
{
    MAXIMUM_CHART_DRAFT_TRANSITION_COUNT,
    MAXIMUM_CHART_TERMINAL_INDICATOR_COUNT,
    DEFAULT_CHART_STATE_HEIGHT,
    MAXIMUM_ACTION_COUNT,
    MAXIMUM_CHART_STATE_DIMENSION,
    MAXIMUM_DESCRIPTION_CODE_POINTS,
    MAXIMUM_ENTRY_ACTION_COUNT,
    MAXIMUM_EVENT_BUFFER_COUNT,
    MAXIMUM_EVENT_COUNT,
    MAXIMUM_EXIT_ACTION_COUNT,
    MAXIMUM_NAME_CODE_POINT_COUNT,
    MAXIMUM_SIMULATOR_SEQUENCE_COUNT,
    MAXIMUM_SOLVER_SEQUENCE_COUNT,
    MAXIMUM_SOLVER_TOKEN_COUNT,
    MAXIMUM_SOLVER_TOKEN_CODE_POINT_COUNT,
    MAXIMUM_STATE_COUNT,
    MAXIMUM_TRANSITION_COUNT,
    MINIMUM_CHART_STATE_DIMENSION,
} from "./limits.js";
import type { DocumentValidationSummary } from "./validation.js";
import { summarizeAuthoringDraftValidation } from "./validation.js";
import type { ModelElementImport } from "./model-element-import.js";
import { inspectModelElementImport } from "./model-element-import.js";
import { isSolverTokenTextWithinBounds } from "./solver-token.js";

//--------------------------------------------------------------------------------------------------
// Type: EntityKind
//
// Description:
//
//   Defines the supported entity kind alternatives.
//
//--------------------------------------------------------------------------------------------------

export type EntityKind = "action" | "event" | "state";

//--------------------------------------------------------------------------------------------------
// Interface: RenameEntityCommand
//
// Description:
//
//   Defines the structure of rename entity command.
//
//--------------------------------------------------------------------------------------------------

export interface RenameEntityCommand
{
    readonly kind:             "rename_entity";
    readonly entityKind:       EntityKind;
    readonly previousName:     string;
    readonly newName:          string;
    readonly expectedRevision: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: UpdateDocumentSettingsCommand
//
// Description:
//
//   Defines the structure of update document settings command.
//
//--------------------------------------------------------------------------------------------------

export interface UpdateDocumentSettingsCommand
{
    readonly kind:             "update_document_settings";
    readonly settings:         DocumentSettings;
    readonly expectedRevision: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: SetInitialStateCommand
//
// Description:
//
//   Defines the structure of set initial state command.
//
//--------------------------------------------------------------------------------------------------

export interface SetInitialStateCommand
{
    readonly kind:             "set_initial_state";
    readonly initialState:     string | null;
    readonly expectedRevision: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: SetChartExpandStatesCommand
//
// Description:
//
//   Defines the structure of set chart expand states command.
//
//--------------------------------------------------------------------------------------------------

export interface SetChartExpandStatesCommand
{
    readonly kind:             "set_chart_expand_states";
    readonly expandStates:     boolean;
    readonly expectedRevision: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: ImportModelElementsCommand
//
// Description:
//
//   Defines the structure of import model elements command.
//
//--------------------------------------------------------------------------------------------------

export interface ImportModelElementsCommand
{
    readonly kind:               "import_model_elements";
    readonly modelImport:        ModelElementImport;
    readonly overwriteConflicts: boolean;
    readonly expectedRevision:   number;
}

//--------------------------------------------------------------------------------------------------
// Interface: AddEntityCommand
//
// Description:
//
//   Defines the structure of add entity command.
//
//--------------------------------------------------------------------------------------------------

export interface AddEntityCommand
{
    readonly kind:             "add_entity";
    readonly entityKind:       EntityKind;
    readonly entity:           NamedEntity;
    readonly chartPlacement?:  ChartStatePlacement;
    readonly expectedRevision: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: UpdateEntityCommand
//
// Description:
//
//   Defines the structure of update entity command.
//
//--------------------------------------------------------------------------------------------------

export interface UpdateEntityCommand
{
    readonly kind:             "update_entity";
    readonly entityKind:       EntityKind;
    readonly previousName:     string;
    readonly entity:           NamedEntity;
    readonly expectedRevision: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: MoveEntityCommand
//
// Description:
//
//   Defines the structure of move entity command.
//
//--------------------------------------------------------------------------------------------------

export interface MoveEntityCommand
{
    readonly kind:             "move_entity";
    readonly entityKind:       EntityKind;
    readonly name:             string;
    readonly direction:        "down" | "up";
    readonly expectedRevision: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: DeleteEntityCommand
//
// Description:
//
//   Defines the structure of delete entity command.
//
//--------------------------------------------------------------------------------------------------

export interface DeleteEntityCommand
{
    readonly kind:             "delete_entity";
    readonly entityKind:       EntityKind;
    readonly name:             string;
    readonly expectedRevision: number;
}

//--------------------------------------------------------------------------------------------------
// Type: StateActionKind
//
// Description:
//
//   Defines the supported state action kind alternatives.
//
//--------------------------------------------------------------------------------------------------

export type StateActionKind = "entry" | "exit";

//--------------------------------------------------------------------------------------------------
// Interface: AddStateActionCommand
//
// Description:
//
//   Defines the structure of add state action command.
//
//--------------------------------------------------------------------------------------------------

export interface AddStateActionCommand
{
    readonly kind:             "add_state_action";
    readonly actionKind:       StateActionKind;
    readonly mapping:          StateActionMapping;
    readonly expectedRevision: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: UpdateStateActionCommand
//
// Description:
//
//   Defines the structure of update state action command.
//
//--------------------------------------------------------------------------------------------------

export interface UpdateStateActionCommand
{
    readonly kind:             "update_state_action";
    readonly actionKind:       StateActionKind;
    readonly index:            number;
    readonly mapping:          StateActionMapping;
    readonly expectedRevision: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: DeleteStateActionCommand
//
// Description:
//
//   Defines the structure of delete state action command.
//
//--------------------------------------------------------------------------------------------------

export interface DeleteStateActionCommand
{
    readonly kind:             "delete_state_action";
    readonly actionKind:       StateActionKind;
    readonly index:            number;
    readonly expectedRevision: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: MoveStateActionCommand
//
// Description:
//
//   Defines the structure of move state action command.
//
//--------------------------------------------------------------------------------------------------

export interface MoveStateActionCommand
{
    readonly kind:             "move_state_action";
    readonly actionKind:       StateActionKind;
    readonly index:            number;
    readonly direction:        "down" | "up";
    readonly expectedRevision: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: AddTransitionCommand
//
// Description:
//
//   Defines the structure of add transition command.
//
//--------------------------------------------------------------------------------------------------

export interface AddTransitionCommand
{
    readonly kind:                  "add_transition";
    readonly transition:            TransitionDefinition;
    readonly chartStatePlacements?: readonly ChartStatePlacement[];
    readonly expectedRevision:      number;
}

//--------------------------------------------------------------------------------------------------
// Interface: UpdateTransitionCommand
//
// Description:
//
//   Defines the structure of update transition command.
//
//--------------------------------------------------------------------------------------------------

export interface UpdateTransitionCommand
{
    readonly kind:                  "update_transition";
    readonly index:                 number;
    readonly transition:            TransitionDefinition;
    readonly chartStatePlacements?: readonly ChartStatePlacement[];
    readonly expectedRevision:      number;
}

//--------------------------------------------------------------------------------------------------
// Interface: DeleteTransitionCommand
//
// Description:
//
//   Defines the structure of delete transition command.
//
//--------------------------------------------------------------------------------------------------

export interface DeleteTransitionCommand
{
    readonly kind:             "delete_transition";
    readonly index:            number;
    readonly expectedRevision: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: MoveTransitionCommand
//
// Description:
//
//   Defines the structure of move transition command.
//
//--------------------------------------------------------------------------------------------------

export interface MoveTransitionCommand
{
    readonly kind:             "move_transition";
    readonly index:            number;
    readonly direction:        "down" | "up";
    readonly expectedRevision: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: ReplaceSolverSequencesCommand
//
// Description:
//
//   Defines the structure of replace solver sequences command.
//
//--------------------------------------------------------------------------------------------------

export interface ReplaceSolverSequencesCommand
{
    readonly kind:             "replace_solver_sequences";
    readonly sequences:        readonly SolverSequence[];
    readonly expectedRevision: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: ReplaceSimulatorSequencesCommand
//
// Description:
//
//   Defines the structure of replace simulator sequences command.
//
//--------------------------------------------------------------------------------------------------

export interface ReplaceSimulatorSequencesCommand
{
    readonly kind:             "replace_simulator_sequences";
    readonly sequences:        readonly SimulatorSequence[];
    readonly expectedRevision: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: ApplySolverCandidateCommand
//
// Description:
//
//   Defines the structure of apply solver candidate command.
//
//--------------------------------------------------------------------------------------------------

export interface ApplySolverCandidateCommand
{
    readonly kind:             "apply_solver_candidate";
    readonly candidate:        SolverCandidate;
    readonly expectedRevision: number;
    readonly expectedSolverRevision: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: ReplaceChartGeometryCommand
//
// Description:
//
//   Defines the structure of replace chart geometry command.
//
//--------------------------------------------------------------------------------------------------

export interface ReplaceChartGeometryCommand
{
    readonly kind:                    "replace_chart_geometry";
    readonly deleteOrphanedItems?:    boolean;
    readonly statePlacements:         readonly ChartStatePlacement[];
    readonly initialStateIndicator:   ChartInitialStateIndicator | null;
    readonly terminalStateIndicators: readonly TerminalStateIndicator[];
    readonly draftTransitions:        readonly ChartDraftTransition[];
    readonly expectedRevision:        number;
}

//--------------------------------------------------------------------------------------------------
// Interface: AddChartDraftTransitionCommand
//
// Description:
//
//   Defines the structure of add chart draft transition command.
//
//--------------------------------------------------------------------------------------------------

export interface AddChartDraftTransitionCommand
{
    readonly kind:             "add_chart_draft_transition";
    readonly draftTransition:  ChartDraftTransition;
    readonly expectedRevision: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: ConfigureChartDraftTransitionCommand
//
// Description:
//
//   Defines the structure of configure chart draft transition command.
//
//--------------------------------------------------------------------------------------------------

export interface ConfigureChartDraftTransitionCommand
{
    readonly kind:                  "configure_chart_draft_transition";
    readonly draftTransitionId:     number;
    readonly transition:            TransitionDefinition;
    readonly chartStatePlacements?: readonly ChartStatePlacement[];
    readonly expectedRevision:      number;
}

//--------------------------------------------------------------------------------------------------
// Interface: SetChartInitialIndicatorCommand
//
// Description:
//
//   Defines the structure of set chart initial indicator command.
//
//--------------------------------------------------------------------------------------------------

export interface SetChartInitialIndicatorCommand
{
    readonly kind:             "set_chart_initial_indicator";
    readonly indicator:        ChartInitialStateIndicator | null;
    readonly expectedRevision: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: AddChartTerminalIndicatorCommand
//
// Description:
//
//   Defines the structure of add chart terminal indicator command.
//
//--------------------------------------------------------------------------------------------------

export interface AddChartTerminalIndicatorCommand
{
    readonly kind:             "add_chart_terminal_indicator";
    readonly indicator:        TerminalStateIndicator;
    readonly expectedRevision: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: PlaceChartIndicatorCommand
//
// Description:
//
//   Defines the structure of place chart indicator command.
//
//--------------------------------------------------------------------------------------------------

export interface PlaceChartIndicatorCommand
{
    readonly kind:                     "place_chart_indicator";
    readonly initialState:             string | null;
    readonly initialStateIndicator:    ChartInitialStateIndicator | null;
    readonly terminalStateIndicators:  readonly TerminalStateIndicator[];
    readonly terminalStateTransitions: readonly TerminalStateIndicatorTransition[];
    readonly statePlacements:          readonly ChartStatePlacement[];
    readonly draftTransitions:         readonly ChartDraftTransition[];
    readonly expectedRevision:         number;
}

//--------------------------------------------------------------------------------------------------
// Interface: DeleteChartTerminalIndicatorCommand
//
// Description:
//
//   Defines the structure of delete chart terminal indicator command.
//
//--------------------------------------------------------------------------------------------------

export interface DeleteChartTerminalIndicatorCommand
{
    readonly kind:             "delete_chart_terminal_indicator";
    readonly indicatorId:      number;
    readonly expectedRevision: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: ConnectChartTerminalIndicatorCommand
//
// Description:
//
//   Defines the structure of connect chart terminal indicator command.
//
//--------------------------------------------------------------------------------------------------

export interface ConnectChartTerminalIndicatorCommand
{
    readonly kind:             "connect_chart_terminal_indicator";
    readonly state:            string;
    readonly indicatorId:      number;
    readonly expectedRevision: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: ChartTransitionKey
//
// Description:
//
//   Defines the structure of chart transition key.
//
//--------------------------------------------------------------------------------------------------

export interface ChartTransitionKey
{
    readonly state: string;
    readonly event: string;
}

//--------------------------------------------------------------------------------------------------
// Interface: DeleteChartSelectionCommand
//
// Description:
//
//   Defines the structure of delete chart selection command.
//
//--------------------------------------------------------------------------------------------------

export interface DeleteChartSelectionCommand
{
    readonly kind:                        "delete_chart_selection";
    readonly stateNames:                  readonly string[];
    readonly transitionKeys:              readonly ChartTransitionKey[];
    readonly terminalStateIndicatorIds:   readonly number[];
    readonly terminalStateRelationStates: readonly string[];
    readonly draftTransitionIds:          readonly number[];
    readonly clearInitialStateRelation:    boolean;
    readonly deleteInitialStateIndicator: boolean;
    readonly expectedRevision:            number;
}

//--------------------------------------------------------------------------------------------------
// Type: DocumentCommand
//
// Description:
//
//   Defines the supported document command alternatives.
//
//--------------------------------------------------------------------------------------------------

export type DocumentCommand =
    | AddEntityCommand
    | AddChartDraftTransitionCommand
    | AddChartTerminalIndicatorCommand
    | AddStateActionCommand
    | AddTransitionCommand
    | ApplySolverCandidateCommand
    | ConfigureChartDraftTransitionCommand
    | DeleteEntityCommand
    | DeleteChartSelectionCommand
    | DeleteChartTerminalIndicatorCommand
    | DeleteStateActionCommand
    | DeleteTransitionCommand
    | ImportModelElementsCommand
    | MoveEntityCommand
    | MoveStateActionCommand
    | MoveTransitionCommand
    | PlaceChartIndicatorCommand
    | RenameEntityCommand
    | ReplaceChartGeometryCommand
    | ReplaceSimulatorSequencesCommand
    | ReplaceSolverSequencesCommand
    | ConnectChartTerminalIndicatorCommand
    | SetChartExpandStatesCommand
    | SetChartInitialIndicatorCommand
    | SetInitialStateCommand
    | UpdateDocumentSettingsCommand
    | UpdateEntityCommand
    | UpdateStateActionCommand
    | UpdateTransitionCommand;

//--------------------------------------------------------------------------------------------------
// Interface: CommandImpactSummary
//
// Description:
//
//   Defines the structure of command impact summary.
//
//--------------------------------------------------------------------------------------------------

export interface CommandImpactSummary
{
    readonly declarationCount:                number;
    readonly initialStateReferenceCount:       number;
    readonly actionMappingCount:               number;
    readonly transitionCount:                  number;
    readonly chartStatePlacementCount:         number;
    readonly chartDraftTransitionCount:        number;
    readonly chartTerminalIndicatorCount:      number;
    readonly chartTerminalRelationCount:       number;
    readonly chartInitialIndicatorCount:       number;
    readonly solverTokenReferenceCount:        number;
    readonly simulatorEventReferenceCount:     number;
}

//--------------------------------------------------------------------------------------------------
// Interface: DocumentCommandPlan
//
// Description:
//
//   Defines the structure of document command plan.
//
//--------------------------------------------------------------------------------------------------

export interface DocumentCommandPlan
{
    readonly command:        DocumentCommand;
    readonly impact:         CommandImpactSummary;
    readonly resultingDraft: AuthoringDraft;
}

//--------------------------------------------------------------------------------------------------
// Interface: DocumentHistoryEntry
//
// Description:
//
//   Defines the structure of document history entry.
//
//--------------------------------------------------------------------------------------------------

export interface DocumentHistoryEntry
{
    readonly commandKind: string;
    readonly before:      AuthoringDraft;
    readonly after:       AuthoringDraft;
}

//--------------------------------------------------------------------------------------------------
// Interface: DocumentEditorState
//
// Description:
//
//   Defines the structure of document editor state.
//
//--------------------------------------------------------------------------------------------------

export interface DocumentEditorState
{
    readonly draft:            AuthoringDraft;
    readonly cleanDraft:       AuthoringDraft;
    readonly documentRevision: number;
    readonly solverRevision:   number;
    readonly dirty:            boolean;
    readonly validationSummary: DocumentValidationSummary;
    readonly undoStack:        readonly DocumentHistoryEntry[];
    readonly redoStack:        readonly DocumentHistoryEntry[];
}

//--------------------------------------------------------------------------------------------------
// Interface: CommandFailure
//
// Description:
//
//   Defines the structure of command failure.
//
//--------------------------------------------------------------------------------------------------

export interface CommandFailure
{
    readonly isSuccessful: false;
    readonly code:
        | "COMMAND_INVALID"
        | "ENTITY_EXISTS"
        | "ENTITY_NOT_FOUND"
        | "IMPORT_CONFLICT"
        | "REFERENCE_INVALID"
        | "REVISION_MISMATCH"
        | "SOLVER_CANDIDATE_STALE"
        | "TRANSITION_EXISTS";
    readonly message:      string;
}

//--------------------------------------------------------------------------------------------------
// Interface: CommandPlanSuccess
//
// Description:
//
//   Defines the structure of command plan success.
//
//--------------------------------------------------------------------------------------------------

export interface CommandPlanSuccess
{
    readonly isSuccessful: true;
    readonly plan:         DocumentCommandPlan;
}

//--------------------------------------------------------------------------------------------------
// Interface: CommandExecutionSuccess
//
// Description:
//
//   Defines the structure of command execution success.
//
//--------------------------------------------------------------------------------------------------

export interface CommandExecutionSuccess
{
    readonly isSuccessful: true;
    readonly state:        DocumentEditorState;
}

//--------------------------------------------------------------------------------------------------
// Type: CommandPlanResult
//
// Description:
//
//   Describes the result produced by command plan.
//
//--------------------------------------------------------------------------------------------------

export type CommandPlanResult      = CommandFailure | CommandPlanSuccess;

//--------------------------------------------------------------------------------------------------
// Type: CommandExecutionResult
//
// Description:
//
//   Describes the result produced by command execution.
//
//--------------------------------------------------------------------------------------------------

export type CommandExecutionResult = CommandExecutionSuccess | CommandFailure;

const EMPTY_IMPACT: CommandImpactSummary =
{
    declarationCount:             0,
    initialStateReferenceCount:   0,
    actionMappingCount:           0,
    transitionCount:              0,
    chartStatePlacementCount:     0,
    chartDraftTransitionCount:    0,
    chartTerminalIndicatorCount:  0,
    chartTerminalRelationCount:   0,
    chartInitialIndicatorCount:   0,
    solverTokenReferenceCount:    0,
    simulatorEventReferenceCount: 0,
};

//--------------------------------------------------------------------------------------------------
// Function: createDocumentEditorState
//
// Description:
//
//   Creates document editor state.
//
// Parameters:
//
//   - draft:
//     The draft supplied to the operation.
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

export function createDocumentEditorState ( draft: AuthoringDraft ): DocumentEditorState
{
    // Return the assembled result.

    return {
        draft,
        cleanDraft:       draft,
        documentRevision: 1,
        solverRevision:   1,
        dirty:            false,
        validationSummary: summarizeAuthoringDraftValidation ( draft ),
        undoStack:        [],
        redoStack:        [],
    };
}

//--------------------------------------------------------------------------------------------------
// Function: markDocumentEditorStateClean
//
// Description:
//
//   Marks the document editor state clean.
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

export function markDocumentEditorStateClean ( state: DocumentEditorState ): DocumentEditorState
{
    // Return the assembled result.

    return {
        ...state,
        cleanDraft: state.draft,
        dirty:      false,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: getDeclarations
//
// Description:
//
//   Returns declarations.
//
// Parameters:
//
//   - draft:
//     The draft supplied to the operation.
//
//   - entityKind:
//     The entity kind supplied to the operation.
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

function getDeclarations ( draft: AuthoringDraft, entityKind: EntityKind ): readonly NamedEntity[]
{
    // Dispatch according to the entity kind value.

    switch ( entityKind )
    {
        // Handle the "action" case.

        case "action":

            // Return the computed result.

            return draft.stateMachine.actions;

        // Handle the "event" case.

        case "event":

            // Return the computed result.

            return draft.stateMachine.events;

        // Handle the "state" case.

        case "state":

            // Return the computed result.

            return draft.stateMachine.states;
    }
}

//--------------------------------------------------------------------------------------------------
// Function: getMaximumDeclarationCount
//
// Description:
//
//   Returns maximum declaration count.
//
// Parameters:
//
//   - entityKind:
//     The entity kind supplied to the operation.
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

function getMaximumDeclarationCount ( entityKind: EntityKind ): number
{
    // Dispatch according to the entity kind value.

    switch ( entityKind )
    {
        // Handle the "action" case.

        case "action":

            // Return the maximum action count.

            return MAXIMUM_ACTION_COUNT;

        // Handle the "event" case.

        case "event":

            // Return the maximum event count.

            return MAXIMUM_EVENT_COUNT;

        // Handle the "state" case.

        case "state":

            // Return the maximum state count.

            return MAXIMUM_STATE_COUNT;
    }
}

//--------------------------------------------------------------------------------------------------
// Function: validateCommandName
//
// Description:
//
//   Validates command name.
//
// Parameters:
//
//   - name:
//     The name supplied to the operation.
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

function validateCommandName ( name: string ): boolean
{
    // Return the computed result.

    return name.length > 0 && name === name.trim () && [ ...name ].length <= MAXIMUM_NAME_CODE_POINT_COUNT;
}

//--------------------------------------------------------------------------------------------------
// Function: validateDescription
//
// Description:
//
//   Validates description.
//
// Parameters:
//
//   - description:
//     The description supplied to the operation.
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

function validateDescription ( description: string ): boolean
{
    // Return the computed result.

    return [ ...description ].length <= MAXIMUM_DESCRIPTION_CODE_POINTS;
}

//--------------------------------------------------------------------------------------------------
// Function: validateNamedEntity
//
// Description:
//
//   Validates named entity.
//
// Parameters:
//
//   - entity:
//     The entity supplied to the operation.
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

function validateNamedEntity ( entity: NamedEntity ): boolean
{
    // Return the computed result.

    return validateCommandName ( entity.name ) && validateDescription ( entity.description );
}

//--------------------------------------------------------------------------------------------------
// Function: isFiniteChartPoint
//
// Description:
//
//   Determines whether finite chart point.
//
// Parameters:
//
//   - point:
//     The point supplied to the operation.
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

function isFiniteChartPoint ( point: ChartPoint ): boolean
{
    // Return the computed result.

    return Number.isFinite ( point.x ) && Number.isFinite ( point.y );
}

//--------------------------------------------------------------------------------------------------
// Function: isValidChartStatePlacement
//
// Description:
//
//   Determines whether valid chart state placement.
//
// Parameters:
//
//   - placement:
//     The placement supplied to the operation.
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

function isValidChartStatePlacement ( placement: ChartStatePlacement ): boolean
{
    // Initialize the local values needed by this operation.

    const height = placement.height ?? DEFAULT_CHART_STATE_HEIGHT;

    // Return the computed result.

    return isFiniteChartPoint ( placement ) && Number.isFinite ( height ) &&
        height >= MINIMUM_CHART_STATE_DIMENSION && height <= MAXIMUM_CHART_STATE_DIMENSION;
}

//--------------------------------------------------------------------------------------------------
// Function: isValidTerminalIndicator
//
// Description:
//
//   Determines whether valid terminal indicator.
//
// Parameters:
//
//   - indicator:
//     The indicator supplied to the operation.
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

function isValidTerminalIndicator ( indicator: TerminalStateIndicator ): boolean
{
    // Return the computed result.

    return Number.isSafeInteger ( indicator.id ) && indicator.id >= 0 && isFiniteChartPoint ( indicator );
}

//--------------------------------------------------------------------------------------------------
// Function: isValidChartDraftTransition
//
// Description:
//
//   Determines whether valid chart draft transition.
//
// Parameters:
//
//   - draftTransition:
//     The draft transition supplied to the operation.
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

function isValidChartDraftTransition ( draftTransition: ChartDraftTransition ): boolean
{
    // Return the computed result.

    return Number.isSafeInteger ( draftTransition.id ) && draftTransition.id >= 0 &&
        isFiniteChartPoint ( draftTransition.source ) && isFiniteChartPoint ( draftTransition.target );
}

//--------------------------------------------------------------------------------------------------
// Function: upsertChartStatePlacements
//
// Description:
//
//   Derives the upsert chart state placements.
//
// Parameters:
//
//   - draft:
//     The draft supplied to the operation.
//
//   - placements:
//     The placements supplied to the operation.
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

function upsertChartStatePlacements (
    draft: AuthoringDraft,
    placements: readonly ChartStatePlacement[],
): AuthoringDraft | null
{
    // Initialize the local values needed by this operation.

    const declaredStates  = new Set ( draft.stateMachine.states.map ( state => state.name ) );
    const placementStates = new Set<string> ();

    // Process each placement from the placements collection in order.

    for ( const placement of placements )
    {
        // Handle the case where at least one branch condition is satisfied.

        if ( placementStates.has ( placement.state ) || !declaredStates.has ( placement.state ) ||
            !isValidChartStatePlacement ( placement ) )
        {
            // Return the computed result.

            return null;
        }

        placementStates.add ( placement.state );
    }

    // Initialize the local values needed by this operation.

    const replacementByState = new Map ( placements.map ( placement => [ placement.state, placement ] ) );
    const retainedPlacements = draft.chart.states.filter ( placement => !replacementByState.has ( placement.state ) );

    // Return the assembled result.

    return {
        ...draft,
        chart: { ...draft.chart, states: [ ...retainedPlacements, ...placements ] },
    };
}

//--------------------------------------------------------------------------------------------------
// Function: calculateDraftReductionImpact
//
// Description:
//
//   Calculates draft reduction impact.
//
// Parameters:
//
//   - before:
//     The before supplied to the operation.
//
//   - after:
//     The after supplied to the operation.
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

function calculateDraftReductionImpact (
    before: AuthoringDraft,
    after: AuthoringDraft,
): CommandImpactSummary
{
    // Initialize the local values needed by this operation.

    const beforeStateMachine = before.stateMachine;
    const afterStateMachine  = after.stateMachine;

    // Return the assembled result.

    return {
        declarationCount: Math.max ( 0,
            beforeStateMachine.states.length + beforeStateMachine.events.length + beforeStateMachine.actions.length -
            afterStateMachine.states.length - afterStateMachine.events.length - afterStateMachine.actions.length ),
        initialStateReferenceCount: beforeStateMachine.initialState !== afterStateMachine.initialState ? 1 : 0,
        actionMappingCount: Math.max ( 0,
            beforeStateMachine.stateActions.entry.length + beforeStateMachine.stateActions.exit.length -
            afterStateMachine.stateActions.entry.length - afterStateMachine.stateActions.exit.length ),
        transitionCount: Math.max (
            0,
            beforeStateMachine.transitionTable.length - afterStateMachine.transitionTable.length,
        ),
        chartStatePlacementCount: Math.max ( 0, before.chart.states.length - after.chart.states.length ),
        chartDraftTransitionCount: Math.max ( 0,
            before.chart.draftTransitions.length - after.chart.draftTransitions.length ),
        chartTerminalIndicatorCount: Math.max ( 0,
            before.chart.indicators.terminalStateIndicators.length -
            after.chart.indicators.terminalStateIndicators.length ),
        chartTerminalRelationCount: Math.max ( 0,
            before.chart.indicators.terminalStateTransitions.length -
            after.chart.indicators.terminalStateTransitions.length ),
        chartInitialIndicatorCount: before.chart.indicators.initialStateIndicator !== null &&
            after.chart.indicators.initialStateIndicator === null ? 1 : 0,
        solverTokenReferenceCount: 0,
        simulatorEventReferenceCount: 0,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: isValidArrayIndex
//
// Description:
//
//   Determines whether valid array index.
//
// Parameters:
//
//   - values:
//     The values supplied to the operation.
//
//   - index:
//     The index supplied to the operation.
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

function isValidArrayIndex ( values: readonly unknown[], index: number ): boolean
{
    // Return the computed result.

    return Number.isInteger ( index ) && index >= 0 && index < values.length;
}

//--------------------------------------------------------------------------------------------------
// Function: moveArrayItem
//
// Description:
//
//   Moves the array item.
//
// Parameters:
//
//   - values:
//     The values supplied to the operation.
//
//   - index:
//     The index supplied to the operation.
//
//   - direction:
//     The direction supplied to the operation.
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

function moveArrayItem<Value> (
    values: readonly Value[],
    index: number,
    direction: "down" | "up",
): readonly Value[] | null
{
    // Calculate the destination index value from the current inputs.

    const destinationIndex = direction === "up" ? index - 1 : index + 1;

    // Handle the case where at least one branch condition is satisfied.

    if ( !isValidArrayIndex ( values, index ) || !isValidArrayIndex ( values, destinationIndex ) )
    {
        // Return the computed result.

        return null;
    }

    // Initialize the local values needed by this operation.

    const movedValues      = [ ...values ];
    const selectedValue    = movedValues [ index ];
    const destinationValue = movedValues [ destinationIndex ];

    // Handle the case where at least one branch condition is satisfied.

    if ( selectedValue === undefined || destinationValue === undefined )
    {
        // Return the computed result.

        return null;
    }

    movedValues [ index ]            = destinationValue;
    movedValues [ destinationIndex ] = selectedValue;

    // Return the moved values.

    return movedValues;
}

//--------------------------------------------------------------------------------------------------
// Function: replaceArrayItem
//
// Description:
//
//   Replaces the array item.
//
// Parameters:
//
//   - values:
//     The values supplied to the operation.
//
//   - index:
//     The index supplied to the operation.
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

function replaceArrayItem<Value> (
    values: readonly Value[],
    index: number,
    value: Value,
): readonly Value[] | null
{
    // Handle the case where the is valid array index result condition is not satisfied.

    if ( !isValidArrayIndex ( values, index ) )
    {
        // Return the computed result.

        return null;
    }

    // Return the mapped collection.

    return values.map ( ( currentValue, currentIndex ) => currentIndex === index ? value : currentValue );
}

//--------------------------------------------------------------------------------------------------
// Function: createPlan
//
// Description:
//
//   Creates plan.
//
// Parameters:
//
//   - command:
//     The command supplied to the operation.
//
//   - resultingDraft:
//     The resulting draft supplied to the operation.
//
//   - impact:
//     The impact supplied to the operation.
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

function createPlan (
    command: DocumentCommand,
    resultingDraft: AuthoringDraft,
    impact: CommandImpactSummary = EMPTY_IMPACT,
): CommandPlanSuccess
{
    // Return the assembled result.

    return {
        isSuccessful: true,
        plan:
        {
            command,
            impact,
            resultingDraft,
        },
    };
}

//--------------------------------------------------------------------------------------------------
// Function: createFailure
//
// Description:
//
//   Creates failure.
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

function createFailure (
    code: CommandFailure["code"],
    message: string,
): CommandFailure
{
    // Return the assembled result.

    return { isSuccessful: false, code, message };
}

//--------------------------------------------------------------------------------------------------
// Function: calculateImpact
//
// Description:
//
//   Calculates impact.
//
// Parameters:
//
//   - draft:
//     The draft supplied to the operation.
//
//   - entityKind:
//     The entity kind supplied to the operation.
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

function calculateImpact (
    draft: AuthoringDraft,
    entityKind: EntityKind,
    name: string,
): CommandImpactSummary
{
    // Initialize the local values needed by this operation.

    const stateMachine = draft.stateMachine;

    // Handle the case where entity kind matches the state value.

    if ( entityKind === "state" )
    {
        // Return the assembled result.

        return {
            declarationCount:           1,
            initialStateReferenceCount: stateMachine.initialState === name ? 1 : 0,
            actionMappingCount: [ ...stateMachine.stateActions.entry, ...stateMachine.stateActions.exit ].filter (
                ( mapping ) => mapping.state === name,
            ).length,
            transitionCount: stateMachine.transitionTable.filter (
                ( transition ) => transition.state === name || transition.stateNext === name,
            ).length,
            chartStatePlacementCount: draft.chart.states.filter ( ( placement ) => placement.state === name ).length,
            chartDraftTransitionCount: 0,
            chartTerminalIndicatorCount: 0,
            chartTerminalRelationCount: draft.chart.indicators.terminalStateTransitions.filter (
                ( relation ) => relation.state === name,
            ).length,
            chartInitialIndicatorCount: 0,
            solverTokenReferenceCount: draft.solver.sequences.reduce (
                ( count, sequence ) => count + sequence.sequence.filter ( ( token ) => token === name ).length,
                0,
            ),
            simulatorEventReferenceCount: 0,
        };
    }

    // Handle the case where entity kind matches the event value.

    if ( entityKind === "event" )
    {
        // Return the assembled result.

        return {
            ...EMPTY_IMPACT,
            declarationCount: 1,
            transitionCount: stateMachine.transitionTable.filter ( ( transition ) => transition.event === name ).length,
            solverTokenReferenceCount: draft.solver.sequences.reduce (
                ( count, sequence ) => count + sequence.sequence.filter ( ( token ) => token === name ).length,
                0,
            ),
            simulatorEventReferenceCount: draft.simulator.sequences.reduce (
                ( count, sequence ) => count + sequence.sequence.filter ( ( eventName ) => eventName === name ).length,
                0,
            ),
        };
    }

    // Return the assembled result.

    return {
        ...EMPTY_IMPACT,
        declarationCount:  1,
        actionMappingCount: [ ...stateMachine.stateActions.entry, ...stateMachine.stateActions.exit ].filter (
            ( mapping ) => mapping.action === name,
        ).length,
        solverTokenReferenceCount: draft.solver.sequences.reduce (
            ( count, sequence ) => count + sequence.sequence.filter ( ( token ) => token === name ).length,
            0,
        ),
    };
}

//--------------------------------------------------------------------------------------------------
// Function: renameDeclaration
//
// Description:
//
//   Derives the rename declaration.
//
// Parameters:
//
//   - declarations:
//     The declarations supplied to the operation.
//
//   - previousName:
//     The previous name supplied to the operation.
//
//   - newName:
//     The new name supplied to the operation.
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

function renameDeclaration (
    declarations: readonly NamedEntity[],
    previousName: string,
    newName: string,
): readonly NamedEntity[]
{
    // Return the mapped collection.

    return declarations.map ( ( declaration ) => declaration.name === previousName
        ? { ...declaration, name: newName }
        : declaration );
}

//--------------------------------------------------------------------------------------------------
// Function: renameEntity
//
// Description:
//
//   Derives the rename entity.
//
// Parameters:
//
//   - draft:
//     The draft supplied to the operation.
//
//   - entityKind:
//     The entity kind supplied to the operation.
//
//   - previousName:
//     The previous name supplied to the operation.
//
//   - newName:
//     The new name supplied to the operation.
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

function renameEntity (
    draft: AuthoringDraft,
    entityKind: EntityKind,
    previousName: string,
    newName: string,
): AuthoringDraft
{
    // Initialize the local values needed by this operation.

    const stateMachine = draft.stateMachine;

    // Handle the case where entity kind matches the state value.

    if ( entityKind === "state" )
    {
        // Return the assembled result.

        return {
            ...draft,
            stateMachine:
            {
                ...stateMachine,
                initialState: stateMachine.initialState === previousName ? newName : stateMachine.initialState,
                states: renameDeclaration ( stateMachine.states, previousName, newName ),
                stateActions:
                {
                    entry: stateMachine.stateActions.entry.map ( ( mapping ) => mapping.state === previousName
                        ? { ...mapping, state: newName }
                        : mapping ),
                    exit: stateMachine.stateActions.exit.map ( ( mapping ) => mapping.state === previousName
                        ? { ...mapping, state: newName }
                        : mapping ),
                },
                transitionTable: stateMachine.transitionTable.map ( ( transition ) =>
                    ( {
                        ...transition,
                        state: transition.state === previousName ? newName : transition.state,
                        stateNext: transition.stateNext === previousName ? newName : transition.stateNext,
                    } ) ),
            },
            chart:
            {
                ...draft.chart,
                indicators:
                {
                    ...draft.chart.indicators,
                    initialStateIndicator: draft.chart.indicators.initialStateIndicator?.state === previousName
                        ? { ...draft.chart.indicators.initialStateIndicator, state: newName }
                        : draft.chart.indicators.initialStateIndicator,
                    terminalStateTransitions: draft.chart.indicators.terminalStateTransitions.map ( ( relation ) =>
                        relation.state === previousName ? { ...relation, state: newName } : relation ),
                },
                states: draft.chart.states.map ( ( placement ) => placement.state === previousName
                    ? { ...placement, state: newName }
                    : placement ),
            },
            solver:
            {
                sequences: draft.solver.sequences.map ( ( sequence ) =>
                    ( {
                        ...sequence,
                        sequence: sequence.sequence.map ( ( token ) => token === previousName ? newName : token ),
                    } ) ),
            },
        };
    }

    // Handle the case where entity kind matches the event value.

    if ( entityKind === "event" )
    {
        // Return the assembled result.

        return {
            ...draft,
            stateMachine:
            {
                ...stateMachine,
                events: renameDeclaration ( stateMachine.events, previousName, newName ),
                transitionTable: stateMachine.transitionTable.map ( ( transition ) => transition.event === previousName
                    ? { ...transition, event: newName }
                    : transition ),
            },
            solver:
            {
                sequences: draft.solver.sequences.map ( ( sequence ) =>
                    ( {
                        ...sequence,
                        sequence: sequence.sequence.map ( ( token ) => token === previousName ? newName : token ),
                    } ) ),
            },
            simulator:
            {
                sequences: draft.simulator.sequences.map ( ( sequence ) =>
                    ( {
                        ...sequence,
                        sequence: sequence.sequence.map ( ( eventName ) =>
                            eventName === previousName ? newName : eventName ),
                    } ) ),
            },
        };
    }

    // Return the assembled result.

    return {
        ...draft,
        stateMachine:
        {
            ...stateMachine,
            actions: renameDeclaration ( stateMachine.actions, previousName, newName ),
            stateActions:
            {
                entry: stateMachine.stateActions.entry.map ( ( mapping ) => mapping.action === previousName
                    ? { ...mapping, action: newName }
                    : mapping ),
                exit: stateMachine.stateActions.exit.map ( ( mapping ) => mapping.action === previousName
                    ? { ...mapping, action: newName }
                    : mapping ),
            },
        },
        solver:
        {
            sequences: draft.solver.sequences.map ( ( sequence ) =>
                ( {
                    ...sequence,
                    sequence: sequence.sequence.map ( ( token ) => token === previousName ? newName : token ),
                } ) ),
        },
    };
}

//--------------------------------------------------------------------------------------------------
// Function: deleteEntity
//
// Description:
//
//   Deletes the entity.
//
// Parameters:
//
//   - draft:
//     The draft supplied to the operation.
//
//   - entityKind:
//     The entity kind supplied to the operation.
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

function deleteEntity (
    draft: AuthoringDraft,
    entityKind: EntityKind,
    name: string,
): AuthoringDraft
{
    // Initialize the local values needed by this operation.

    const stateMachine = draft.stateMachine;

    // Handle the case where entity kind matches the state value.

    if ( entityKind === "state" )
    {
        // Initialize the local values needed by this operation.

        const deletesInitialState  = stateMachine.initialState === name;
        const remainingTransitions = stateMachine.transitionTable.filter ( transition =>
            transition.state !== name && transition.stateNext !== name );

        // Return the assembled result.

        return {
            ...draft,
            stateMachine:
            {
                ...stateMachine,
                initialState:   deletesInitialState ? null : stateMachine.initialState,
                states:         stateMachine.states.filter ( ( state ) => state.name !== name ),
                stateActions:
                {
                    entry: stateMachine.stateActions.entry.filter ( ( mapping ) => mapping.state !== name ),
                    exit:  stateMachine.stateActions.exit.filter ( ( mapping ) => mapping.state !== name ),
                },
                transitionTable: remainingTransitions,
            },
            chart:
            {
                ...draft.chart,
                indicators:
                {
                    ...draft.chart.indicators,
                    initialStateIndicator: deletesInitialState && draft.chart.indicators.initialStateIndicator !== null
                        ? { ...draft.chart.indicators.initialStateIndicator, state: null }
                        : draft.chart.indicators.initialStateIndicator,
                    terminalStateTransitions: draft.chart.indicators.terminalStateTransitions.filter (
                        relation => relation.state !== name,
                    ),
                },
                states: draft.chart.states.filter ( ( placement ) => placement.state !== name ),
            },
        };
    }

    // Handle the case where entity kind matches the event value.

    if ( entityKind === "event" )
    {
        // Initialize the local values needed by this operation.

        const remainingTransitions = stateMachine.transitionTable.filter ( transition => transition.event !== name );

        // Return the assembled result.

        return {
            ...draft,
            stateMachine:
            {
                ...stateMachine,
                events:          stateMachine.events.filter ( ( event ) => event.name !== name ),
                transitionTable: remainingTransitions,
            },
        };
    }

    // Return the assembled result.

    return {
        ...draft,
        stateMachine:
        {
            ...stateMachine,
            actions: stateMachine.actions.filter ( ( action ) => action.name !== name ),
            stateActions:
            {
                entry: stateMachine.stateActions.entry.filter ( ( mapping ) => mapping.action !== name ),
                exit:  stateMachine.stateActions.exit.filter ( ( mapping ) => mapping.action !== name ),
            },
        },
    };
}

//--------------------------------------------------------------------------------------------------
// Function: replaceDeclarations
//
// Description:
//
//   Replaces the declarations.
//
// Parameters:
//
//   - draft:
//     The draft supplied to the operation.
//
//   - entityKind:
//     The entity kind supplied to the operation.
//
//   - declarations:
//     The declarations supplied to the operation.
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

function replaceDeclarations (
    draft: AuthoringDraft,
    entityKind: EntityKind,
    declarations: readonly NamedEntity[],
): AuthoringDraft
{
    // Handle the case where entity kind matches the state value.

    if ( entityKind === "state" )
    {
        // Return the assembled result.

        return { ...draft, stateMachine: { ...draft.stateMachine, states: declarations } };
    }

    // Handle the case where entity kind matches the event value.

    if ( entityKind === "event" )
    {
        // Return the assembled result.

        return { ...draft, stateMachine: { ...draft.stateMachine, events: declarations } };
    }

    // Return the assembled result.

    return { ...draft, stateMachine: { ...draft.stateMachine, actions: declarations } };
}

//--------------------------------------------------------------------------------------------------
// Function: declarationExists
//
// Description:
//
//   Derives the declaration exists.
//
// Parameters:
//
//   - draft:
//     The draft supplied to the operation.
//
//   - entityKind:
//     The entity kind supplied to the operation.
//
//   - name:
//     The name supplied to the operation.
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

function declarationExists ( draft: AuthoringDraft, entityKind: EntityKind, name: string ): boolean
{
    // Return the some result.

    return getDeclarations ( draft, entityKind ).some ( declaration => declaration.name === name );
}

//--------------------------------------------------------------------------------------------------
// Function: validateTransitionReferences
//
// Description:
//
//   Validates transition references.
//
// Parameters:
//
//   - draft:
//     The draft supplied to the operation.
//
//   - transition:
//     The transition supplied to the operation.
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

function validateTransitionReferences ( draft: AuthoringDraft, transition: TransitionDefinition ): boolean
{
    // Return the computed result.

    return declarationExists ( draft, "state", transition.state ) &&
        declarationExists ( draft, "event", transition.event ) &&
        declarationExists ( draft, "state", transition.stateNext );
}

//--------------------------------------------------------------------------------------------------
// Function: transitionKeyExists
//
// Description:
//
//   Derives the transition key exists.
//
// Parameters:
//
//   - transitions:
//     The transitions supplied to the operation.
//
//   - transition:
//     The transition supplied to the operation.
//
//   - ignoredIndex:
//     The ignored index supplied to the operation.
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

function transitionKeyExists (
    transitions: readonly TransitionDefinition[],
    transition: TransitionDefinition,
    ignoredIndex: number | null,
): boolean
{
    // Return the some result.

    return transitions.some ( ( currentTransition, index ) => index !== ignoredIndex &&
        currentTransition.state === transition.state && currentTransition.event === transition.event );
}

//--------------------------------------------------------------------------------------------------
// Function: planEntityCommand
//
// Description:
//
//   Plans the entity command.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
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

function planEntityCommand (
    state: DocumentEditorState,
    command: AddEntityCommand | DeleteEntityCommand | MoveEntityCommand | RenameEntityCommand | UpdateEntityCommand,
): CommandPlanResult
{
    // Initialize the local values needed by this operation.

    const declarations = getDeclarations ( state.draft, command.entityKind );

    // Handle the case where command kind matches the add_entity value.

    if ( command.kind === "add_entity" )
    {
        // Handle the case where the validate named entity result condition is not satisfied.

        if ( !validateNamedEntity ( command.entity ) )
        {
            // Return the create failure result.

            return createFailure ( "COMMAND_INVALID", "The entity name or description is invalid." );
        }

        // Handle the case where some result is enabled.

        if ( declarations.some ( declaration => declaration.name === command.entity.name ) )
        {
            // Return the create failure result.

            return createFailure ( "ENTITY_EXISTS", `${command.entityKind} '${command.entity.name}' already exists.` );
        }

        const maximumDeclarationCount = getMaximumDeclarationCount ( command.entityKind );

        // Handle the case where declarations length is at least maximum declaration count.

        if ( declarations.length >= maximumDeclarationCount )
        {
            // Return the create failure result.

            return createFailure (
                "COMMAND_INVALID",
                `The state machine may contain at most ${maximumDeclarationCount} ${command.entityKind} declarations.`,
            );
        }

        // Handle the case where all required conditions are satisfied.

        if ( command.chartPlacement !== undefined &&
            ( command.entityKind !== "state" || command.chartPlacement.state !== command.entity.name ||
                !isFiniteChartPoint ( command.chartPlacement ) ) )
        {
            // Return the create failure result.

            return createFailure ( "COMMAND_INVALID", "The new state chart placement is invalid." );
        }

        // Initialize the local values needed by this operation.

        const draftWithDeclaration = replaceDeclarations (
            state.draft,
            command.entityKind,
            [ ...declarations, command.entity ],
        );
        const resultingDraft = command.chartPlacement === undefined
            ? draftWithDeclaration
            : upsertChartStatePlacements ( draftWithDeclaration, [ command.chartPlacement ] );

        // Return the result selected by the current condition.

        return resultingDraft === null
            ? createFailure ( "COMMAND_INVALID", "The new state chart placement is invalid." )
            : createPlan ( command, resultingDraft );
    }

    // Initialize the local values needed by this operation.

    const targetName = command.kind === "rename_entity" || command.kind === "update_entity"
        ? command.previousName
        : command.name;
    const targetDeclaration = declarations.find ( declaration => declaration.name === targetName );

    // Handle the case where target declaration matches undefined.

    if ( targetDeclaration === undefined )
    {
        // Return the create failure result.

        return createFailure ( "ENTITY_NOT_FOUND", `${command.entityKind} '${targetName}' does not exist.` );
    }

    // Handle the case where command kind matches the delete_entity value.

    if ( command.kind === "delete_entity" )
    {
        // Return the create plan result.

        return createPlan (
            command,
            deleteEntity ( state.draft, command.entityKind, command.name ),
            calculateImpact ( state.draft, command.entityKind, command.name ),
        );
    }

    // Handle the case where command kind matches the move_entity value.

    if ( command.kind === "move_entity" )
    {
        // Initialize the local values needed by this operation.

        const sourceIndex       = declarations.findIndex ( declaration => declaration.name === command.name );
        const movedDeclarations = moveArrayItem ( declarations, sourceIndex, command.direction );

        // Return the result selected by the current condition.

        return movedDeclarations === null
            ? createFailure ( "COMMAND_INVALID", "The entity cannot move beyond the declaration-list boundary." )
            : createPlan ( command, replaceDeclarations ( state.draft, command.entityKind, movedDeclarations ) );
    }

    const replacementName = command.kind === "rename_entity" ? command.newName : command.entity.name;

    // Handle the case where at least one branch condition is satisfied.

    if ( !validateCommandName ( replacementName ) ||
        ( command.kind === "update_entity" && !validateDescription ( command.entity.description ) ) )
    {
        // Return the create failure result.

        return createFailure ( "COMMAND_INVALID", "The replacement entity name or description is invalid." );
    }

    // Handle the case where all required conditions are satisfied.

    if ( replacementName !== targetName && declarations.some ( declaration => declaration.name === replacementName ) )
    {
        // Return the create failure result.

        return createFailure ( "ENTITY_EXISTS", `${command.entityKind} '${replacementName}' already exists.` );
    }

    // Handle the case where all required conditions are satisfied.

    if ( command.kind === "rename_entity" && replacementName === targetName )
    {
        // Return the create failure result.

        return createFailure ( "COMMAND_INVALID", "The replacement name must differ from the current name." );
    }

    const renamedDraft = replacementName === targetName
        ? state.draft
        : renameEntity ( state.draft, command.entityKind, targetName, replacementName );

    // Handle the case where command kind matches the rename_entity value.

    if ( command.kind === "rename_entity" )
    {
        // Return the create plan result.

        return createPlan (
            command,
            renamedDraft,
            calculateImpact ( state.draft, command.entityKind, targetName ),
        );
    }

    const updatedDeclarations = getDeclarations ( renamedDraft, command.entityKind ).map ( declaration =>
        declaration.name === replacementName ? { ...command.entity } : declaration );

    // Handle the case where all required conditions are satisfied.

    if ( replacementName === targetName && targetDeclaration.description === command.entity.description )
    {
        // Return the create failure result.

        return createFailure ( "COMMAND_INVALID", "The edited entity is unchanged." );
    }

    // Return the create plan result.

    return createPlan (
        command,
        replaceDeclarations ( renamedDraft, command.entityKind, updatedDeclarations ),
        replacementName === targetName
            ? EMPTY_IMPACT
            : calculateImpact ( state.draft, command.entityKind, targetName ),
    );
}

//--------------------------------------------------------------------------------------------------
// Function: planStateActionCommand
//
// Description:
//
//   Plans the state action command.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
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

function planStateActionCommand (
    state: DocumentEditorState,
    command: AddStateActionCommand | DeleteStateActionCommand | MoveStateActionCommand | UpdateStateActionCommand,
): CommandPlanResult
{
    // Initialize the local values needed by this operation.

    const stateActions = state.draft.stateMachine.stateActions;
    const mappings     = stateActions [ command.actionKind ];

    // Handle the case where at least one branch condition is satisfied.

    if ( command.kind === "add_state_action" || command.kind === "update_state_action" )
    {
        // Handle the case where at least one branch condition is satisfied.

        if ( !declarationExists ( state.draft, "state", command.mapping.state ) ||
            !declarationExists ( state.draft, "action", command.mapping.action ) )
        {
            // Return the create failure result.

            return createFailure ( "REFERENCE_INVALID", "The state-action assignment references an undeclared entity." );
        }
    }

    let updatedMappings: readonly StateActionMapping[] | null = null;

    // Handle the case where command kind matches the add_state_action value.

    if ( command.kind === "add_state_action" )
    {
        // Initialize the local values needed by this operation.

        const maximumMappingCount = command.actionKind === "entry"
            ? MAXIMUM_ENTRY_ACTION_COUNT
            : MAXIMUM_EXIT_ACTION_COUNT;

        // Handle the case where mappings length is at least maximum mapping count.

        if ( mappings.length >= maximumMappingCount )
        {
            // Return the create failure result.

            return createFailure (
                "COMMAND_INVALID",
                `The state machine may contain at most ${maximumMappingCount} ${command.actionKind} action mappings.`,
            );
        }

        updatedMappings = [ ...mappings, command.mapping ];
    }
    else if ( command.kind === "update_state_action" )
    {
        updatedMappings = replaceArrayItem ( mappings, command.index, command.mapping );
    }
    else if ( command.kind === "delete_state_action" )
    {
        updatedMappings = isValidArrayIndex ( mappings, command.index )
            ? mappings.filter ( ( _mapping, index ) => index !== command.index )
            : null;
    }
    else
    {
        // Initialize the local values needed by this operation.

        const selectedMapping = mappings [ command.index ];

        // Handle the case where selected mapping differs from undefined.

        if ( selectedMapping !== undefined )
        {
            // Initialize the local values needed by this operation.

            const candidateIndexes = mappings.flatMap ( ( mapping, index ) => mapping.state === selectedMapping.state ? [ index ] : [] );
            const position         = candidateIndexes.indexOf ( command.index );
            const adjacentPosition = command.direction === "up" ? position - 1 : position + 1;
            const adjacentIndex    = candidateIndexes [ adjacentPosition ];

            // Handle the case where adjacent index differs from undefined.

            if ( adjacentIndex !== undefined )
            {
                // Initialize the local values needed by this operation.

                const mutableMappings = [ ...mappings ];
                const adjacentMapping = mutableMappings [ adjacentIndex ];

                // Handle the case where adjacent mapping differs from undefined.

                if ( adjacentMapping !== undefined )
                {
                    mutableMappings [ command.index ] = adjacentMapping;
                    mutableMappings [ adjacentIndex ] = selectedMapping;
                    updatedMappings                   = mutableMappings;
                }
            }
        }
    }

    // Handle the case where updated mappings matches an absent value.

    if ( updatedMappings === null )
    {
        // Return the create failure result.

        return createFailure ( "COMMAND_INVALID", "The selected state-action assignment cannot be changed." );
    }

    // Return the create plan result.

    return createPlan (
        command,
        {
            ...state.draft,
            stateMachine:
            {
                ...state.draft.stateMachine,
                stateActions: { ...stateActions, [ command.actionKind ]: updatedMappings },
            },
        },
    );
}

//--------------------------------------------------------------------------------------------------
// Function: planTransitionCommand
//
// Description:
//
//   Plans the transition command.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
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

function planTransitionCommand (
    state: DocumentEditorState,
    command: AddTransitionCommand | DeleteTransitionCommand | MoveTransitionCommand | UpdateTransitionCommand,
): CommandPlanResult
{
    // Initialize the local values needed by this operation.

    const transitions = state.draft.stateMachine.transitionTable;

    // Handle the case where at least one branch condition is satisfied.

    if ( command.kind === "add_transition" || command.kind === "update_transition" )
    {
        // Handle the case where all required conditions are satisfied.

        if ( command.kind === "add_transition" && transitions.length >= MAXIMUM_TRANSITION_COUNT )
        {
            // Return the create failure result.

            return createFailure ( "COMMAND_INVALID", "The transition capacity has been reached." );
        }

        // Handle the case where the validate transition references result condition is not
        // satisfied.

        if ( !validateTransitionReferences ( state.draft, command.transition ) )
        {
            // Return the create failure result.

            return createFailure ( "REFERENCE_INVALID", "The transition references an undeclared state or event." );
        }

        const ignoredIndex = command.kind === "update_transition" ? command.index : null;

        // Handle the case where transition key exists result is enabled.

        if ( transitionKeyExists ( transitions, command.transition, ignoredIndex ) )
        {
            // Return the create failure result.

            return createFailure (
                "TRANSITION_EXISTS",
                `A transition already exists for '${command.transition.state}' and '${command.transition.event}'.`,
            );
        }
    }

    let updatedTransitions: readonly TransitionDefinition[] | null;

    // Handle the case where command kind matches the add_transition value.

    if ( command.kind === "add_transition" )
    {
        updatedTransitions = [ ...transitions, command.transition ];
    }
    else if ( command.kind === "update_transition" )
    {
        updatedTransitions = replaceArrayItem ( transitions, command.index, command.transition );
    }
    else if ( command.kind === "delete_transition" )
    {
        updatedTransitions = isValidArrayIndex ( transitions, command.index )
            ? transitions.filter ( ( _transition, index ) => index !== command.index )
            : null;
    }
    else
    {
        updatedTransitions = moveArrayItem ( transitions, command.index, command.direction );
    }

    // Handle the case where updated transitions matches an absent value.

    if ( updatedTransitions === null )
    {
        // Return the create failure result.

        return createFailure ( "COMMAND_INVALID", "The selected transition cannot be changed." );
    }

    // Initialize the local values needed by this operation.

    const draftWithTransition = {
        ...state.draft,
        stateMachine: { ...state.draft.stateMachine, transitionTable: updatedTransitions },
    };
    const chartStatePlacements = command.kind === "add_transition" || command.kind === "update_transition"
        ? command.chartStatePlacements
        : undefined;
    const resultingDraft = chartStatePlacements === undefined
        ? draftWithTransition
        : upsertChartStatePlacements ( draftWithTransition, chartStatePlacements );

    // Handle the case where resulting draft matches an absent value.

    if ( resultingDraft === null )
    {
        // Return the create failure result.

        return createFailure ( "COMMAND_INVALID", "The transition chart placements are invalid." );
    }

    // Return the create plan result.

    return createPlan (
        command,
        resultingDraft,
        command.kind === "delete_transition"
            ? calculateDraftReductionImpact ( state.draft, resultingDraft )
            : EMPTY_IMPACT,
    );
}

//--------------------------------------------------------------------------------------------------
// Function: planReplaceChartGeometryCommand
//
// Description:
//
//   Plans the replace chart geometry command.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
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

function planReplaceChartGeometryCommand (
    state: DocumentEditorState,
    command: ReplaceChartGeometryCommand,
): CommandPlanResult
{
    // Initialize the local values needed by this operation.

    const declaredStateNames          = new Set ( state.draft.stateMachine.states.map ( stateDefinition => stateDefinition.name ) );
    const placementStateNames         = new Set ( command.statePlacements.map ( placement => placement.state ) );
    const currentIndicatorIdentifiers = new Set (
        state.draft.chart.indicators.terminalStateIndicators.map ( indicator => indicator.id ),
    );
    const replacementIndicatorIdentifiers   = new Set ( command.terminalStateIndicators.map ( indicator => indicator.id ) );
    const currentDraftTransitionIdentifiers = new Set ( state.draft.chart.draftTransitions.map (
        draftTransition => draftTransition.id,
    ) );
    const replacementDraftTransitionIdentifiers = new Set ( command.draftTransitions.map (
        draftTransition => draftTransition.id,
    ) );
    const initialIndicatorPresenceMatches = ( state.draft.chart.indicators.initialStateIndicator === null ) ===
        ( command.initialStateIndicator === null );
    const deleteOrphanedItems                 = command.deleteOrphanedItems ?? false;
    const initialIndicatorIsOrphaned          = state.draft.chart.indicators.initialStateIndicator?.state === null;
    const relatedTerminalIndicatorIdentifiers = new Set (
        state.draft.chart.indicators.terminalStateTransitions.map ( relation => relation.terminalStateIndicatorId ),
    );
    const expectedTerminalIdentifiers = deleteOrphanedItems
        ? new Set ( [ ...currentIndicatorIdentifiers ].filter ( identifier =>
            relatedTerminalIndicatorIdentifiers.has ( identifier ) ) )
        : currentIndicatorIdentifiers;
    const initialIndicatorChangeIsAllowed = initialIndicatorPresenceMatches || deleteOrphanedItems &&
        initialIndicatorIsOrphaned && command.initialStateIndicator === null;
    const draftTransitionReplacementIsAllowed = deleteOrphanedItems
        ? command.draftTransitions.length === 0
        : command.draftTransitions.length === currentDraftTransitionIdentifiers.size &&
            replacementDraftTransitionIdentifiers.size === currentDraftTransitionIdentifiers.size &&
            command.draftTransitions.every ( draftTransition =>
                currentDraftTransitionIdentifiers.has ( draftTransition.id ) &&
                isValidChartDraftTransition ( draftTransition ) );

    // Handle the case where at least one branch condition is satisfied.

    if ( command.statePlacements.length !== declaredStateNames.size ||
        placementStateNames.size !== declaredStateNames.size ||
        command.statePlacements.some ( placement =>
            !declaredStateNames.has ( placement.state ) || !isValidChartStatePlacement ( placement ) ) ||
        !initialIndicatorChangeIsAllowed ||
        ( command.initialStateIndicator !== null && !isFiniteChartPoint ( command.initialStateIndicator ) ) ||
        command.terminalStateIndicators.length !== expectedTerminalIdentifiers.size ||
        replacementIndicatorIdentifiers.size !== expectedTerminalIdentifiers.size ||
        command.terminalStateIndicators.some ( indicator =>
            !expectedTerminalIdentifiers.has ( indicator.id ) || !isValidTerminalIndicator ( indicator ) ) ||
        !draftTransitionReplacementIsAllowed )
    {
        // Return the create failure result.

        return createFailure ( "COMMAND_INVALID", "The replacement Chart geometry is incomplete or invalid." );
    }

    const resultingDraft: AuthoringDraft = {
        ...state.draft,
        chart:
        {
            ...state.draft.chart,
            indicators:
            {
                ...state.draft.chart.indicators,
                initialStateIndicator:   command.initialStateIndicator,
                terminalStateIndicators: command.terminalStateIndicators,
            },
            states:           command.statePlacements,
            draftTransitions: command.draftTransitions,
        },
    };

    // Return the result selected by the current condition.

    return JSON.stringify ( resultingDraft.chart ) === JSON.stringify ( state.draft.chart )
        ? createFailure ( "COMMAND_INVALID", "The Chart geometry is unchanged." )
        : createPlan ( command, resultingDraft );
}

//--------------------------------------------------------------------------------------------------
// Function: planAddChartDraftTransitionCommand
//
// Description:
//
//   Plans the add chart draft transition command.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
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

function planAddChartDraftTransitionCommand (
    state: DocumentEditorState,
    command: AddChartDraftTransitionCommand,
): CommandPlanResult
{
    // Handle the case where the is valid chart draft transition result condition is not satisfied.

    if ( !isValidChartDraftTransition ( command.draftTransition ) )
    {
        // Return the create failure result.

        return createFailure ( "COMMAND_INVALID", "The Chart draft transition is invalid." );
    }

    // Handle the case where length is at least maximum chart draft transition count.

    if ( state.draft.chart.draftTransitions.length >= MAXIMUM_CHART_DRAFT_TRANSITION_COUNT )
    {
        // Return the create failure result.

        return createFailure ( "COMMAND_INVALID", "The Chart draft-transition capacity has been reached." );
    }

    // Handle the case where some result is enabled.

    if ( state.draft.chart.draftTransitions.some ( draftTransition =>
        draftTransition.id === command.draftTransition.id ) )
    {
        // Return the create failure result.

        return createFailure (
            "ENTITY_EXISTS",
            `Chart draft transition '${command.draftTransition.id}' already exists.`,
        );
    }

    // Return the create plan result.

    return createPlan ( command, {
        ...state.draft,
        chart:
        {
            ...state.draft.chart,
            draftTransitions: [ ...state.draft.chart.draftTransitions, command.draftTransition ],
        },
    } );
}

//--------------------------------------------------------------------------------------------------
// Function: planConfigureChartDraftTransitionCommand
//
// Description:
//
//   Plans the configure chart draft transition command.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
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

function planConfigureChartDraftTransitionCommand (
    state: DocumentEditorState,
    command: ConfigureChartDraftTransitionCommand,
): CommandPlanResult
{
    // Handle the case where at least one branch condition is satisfied.

    if ( !Number.isSafeInteger ( command.draftTransitionId ) || command.draftTransitionId < 0 ||
        !state.draft.chart.draftTransitions.some ( draftTransition =>
            draftTransition.id === command.draftTransitionId ) )
    {
        // Return the create failure result.

        return createFailure (
            "ENTITY_NOT_FOUND",
            `Chart draft transition '${command.draftTransitionId}' does not exist.`,
        );
    }

    // Handle the case where length is at least maximum transition count.

    if ( state.draft.stateMachine.transitionTable.length >= MAXIMUM_TRANSITION_COUNT )
    {
        // Return the create failure result.

        return createFailure ( "COMMAND_INVALID", "The transition capacity has been reached." );
    }

    // Handle the case where the validate transition references result condition is not satisfied.

    if ( !validateTransitionReferences ( state.draft, command.transition ) )
    {
        // Return the create failure result.

        return createFailure ( "REFERENCE_INVALID", "The transition references an undeclared state or event." );
    }

    // Handle the case where transition key exists result is enabled.

    if ( transitionKeyExists ( state.draft.stateMachine.transitionTable, command.transition, null ) )
    {
        // Return the create failure result.

        return createFailure (
            "TRANSITION_EXISTS",
            `A transition already exists for '${command.transition.state}' and '${command.transition.event}'.`,
        );
    }

    // Initialize the local values needed by this operation.

    const configuredDraft: AuthoringDraft = {
        ...state.draft,
        stateMachine:
        {
            ...state.draft.stateMachine,
            transitionTable: [ ...state.draft.stateMachine.transitionTable, command.transition ],
        },
        chart:
        {
            ...state.draft.chart,
            draftTransitions: state.draft.chart.draftTransitions.filter ( draftTransition =>
                draftTransition.id !== command.draftTransitionId ),
        },
    };
    const resultingDraft = command.chartStatePlacements === undefined
        ? configuredDraft
        : upsertChartStatePlacements ( configuredDraft, command.chartStatePlacements );

    // Return the result selected by the current condition.

    return resultingDraft === null
        ? createFailure ( "COMMAND_INVALID", "The transition Chart placements are invalid." )
        : createPlan ( command, resultingDraft );
}

//--------------------------------------------------------------------------------------------------
// Function: planSetChartInitialIndicatorCommand
//
// Description:
//
//   Plans the set chart initial indicator command.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
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

function planSetChartInitialIndicatorCommand (
    state: DocumentEditorState,
    command: SetChartInitialIndicatorCommand,
): CommandPlanResult
{
    // Handle the case where all required conditions are satisfied.

    if ( command.indicator !== null && !isFiniteChartPoint ( command.indicator ) )
    {
        // Return the create failure result.

        return createFailure ( "COMMAND_INVALID", "The initial-state indicator coordinates are invalid." );
    }

    // Handle the case where all required conditions are satisfied.

    if ( command.indicator?.state !== undefined && command.indicator.state !== null &&
        !declarationExists ( state.draft, "state", command.indicator.state ) )
    {
        // Return the create failure result.

        return createFailure ( "REFERENCE_INVALID", `State '${command.indicator.state}' is not declared.` );
    }

    // Handle the case where stringify result matches stringify result.

    if ( JSON.stringify ( command.indicator ) === JSON.stringify ( state.draft.chart.indicators.initialStateIndicator ) )
    {
        // Return the create failure result.

        return createFailure ( "COMMAND_INVALID", "The initial-state indicator is unchanged." );
    }

    // Return the create plan result.

    return createPlan (
        command,
        {
            ...state.draft,
            stateMachine:
            {
                ...state.draft.stateMachine,
                initialState: command.indicator?.state !== undefined && command.indicator.state !== null
                    ? command.indicator.state
                    : command.indicator === null &&
                        state.draft.chart.indicators.initialStateIndicator?.state !== undefined &&
                        state.draft.chart.indicators.initialStateIndicator.state !== null
                        ? null
                        : state.draft.stateMachine.initialState,
            },
            chart:
            {
                ...state.draft.chart,
                indicators: { ...state.draft.chart.indicators, initialStateIndicator: command.indicator },
            },
        },
        command.indicator === null
            ? {
                ...EMPTY_IMPACT,
                initialStateReferenceCount: state.draft.stateMachine.initialState === null ? 0 : 1,
                chartInitialIndicatorCount: state.draft.chart.indicators.initialStateIndicator === null ? 0 : 1,
            }
            : EMPTY_IMPACT,
    );
}

//--------------------------------------------------------------------------------------------------
// Function: planAddChartTerminalIndicatorCommand
//
// Description:
//
//   Plans the add chart terminal indicator command.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
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

function planAddChartTerminalIndicatorCommand (
    state: DocumentEditorState,
    command: AddChartTerminalIndicatorCommand,
): CommandPlanResult
{
    // Handle the case where the is valid terminal indicator result condition is not satisfied.

    if ( !isValidTerminalIndicator ( command.indicator ) )
    {
        // Return the create failure result.

        return createFailure ( "COMMAND_INVALID", "The visual final-state indicator is invalid." );
    }

    // Handle the case where some result is enabled.

    if ( state.draft.chart.indicators.terminalStateIndicators.some (
        indicator => indicator.id === command.indicator.id,
    ) )
    {
        // Return the create failure result.

        return createFailure ( "ENTITY_EXISTS", `Visual final indicator '${command.indicator.id}' already exists.` );
    }

    // Return the create plan result.

    return createPlan (
        command,
        {
            ...state.draft,
            chart:
            {
                ...state.draft.chart,
                indicators:
                {
                    ...state.draft.chart.indicators,
                    terminalStateIndicators:
                    [ ...state.draft.chart.indicators.terminalStateIndicators, command.indicator ],
                },
            },
        },
    );
}

//--------------------------------------------------------------------------------------------------
// Function: planPlaceChartIndicatorCommand
//
// Description:
//
//   Plans the place chart indicator command.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
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

function planPlaceChartIndicatorCommand (
    state: DocumentEditorState,
    command: PlaceChartIndicatorCommand,
): CommandPlanResult
{
    // Initialize the local values needed by this operation.

    const declaredStateNames         = new Set ( state.draft.stateMachine.states.map ( stateDefinition => stateDefinition.name ) );
    const statePlacementNames        = new Set ( command.statePlacements.map ( placement => placement.state ) );
    const currentTerminalIdentifiers = new Set (
        state.draft.chart.indicators.terminalStateIndicators.map ( indicator => indicator.id ),
    );
    const replacementTerminalIdentifiers = new Set ( command.terminalStateIndicators.map ( indicator => indicator.id ) );
    const currentDraftIdentifiers        = new Set ( state.draft.chart.draftTransitions.map ( transition => transition.id ) );
    const replacementDraftIdentifiers    = new Set ( command.draftTransitions.map ( transition => transition.id ) );
    const initialIndicatorAdded          = state.draft.chart.indicators.initialStateIndicator === null &&
        command.initialStateIndicator !== null;
    const terminalIndicatorAdded = command.terminalStateIndicators.length ===
        state.draft.chart.indicators.terminalStateIndicators.length + 1;
    const terminalRelationStates = new Set ( command.terminalStateTransitions.map ( relation => relation.state ) );

    // Handle the case where at least one branch condition is satisfied.

    if ( initialIndicatorAdded === terminalIndicatorAdded ||
        command.statePlacements.length !== declaredStateNames.size ||
        statePlacementNames.size !== declaredStateNames.size ||
        command.statePlacements.some ( placement =>
            !declaredStateNames.has ( placement.state ) || !isValidChartStatePlacement ( placement ) ) ||
        command.initialStateIndicator !== null && !isFiniteChartPoint ( command.initialStateIndicator ) ||
        command.initialStateIndicator?.state !== undefined && command.initialStateIndicator.state !== null &&
            ( !declaredStateNames.has ( command.initialStateIndicator.state ) ||
                command.initialState !== command.initialStateIndicator.state ) ||
        command.initialStateIndicator?.state === null && command.initialState !== state.draft.stateMachine.initialState ||
        command.initialStateIndicator === null && command.initialState !== state.draft.stateMachine.initialState ||
        command.initialState !== null && !declaredStateNames.has ( command.initialState ) ||
        replacementTerminalIdentifiers.size !== command.terminalStateIndicators.length ||
        command.terminalStateIndicators.length > MAXIMUM_CHART_TERMINAL_INDICATOR_COUNT ||
        command.terminalStateIndicators.some ( indicator => !isValidTerminalIndicator ( indicator ) ) ||
        [ ...currentTerminalIdentifiers ].some ( identifier => !replacementTerminalIdentifiers.has ( identifier ) ) ||
        terminalRelationStates.size !== command.terminalStateTransitions.length ||
        command.terminalStateTransitions.some ( relation =>
            !declaredStateNames.has ( relation.state ) ||
            !replacementTerminalIdentifiers.has ( relation.terminalStateIndicatorId ) ) ||
        replacementDraftIdentifiers.size !== currentDraftIdentifiers.size ||
        command.draftTransitions.length !== currentDraftIdentifiers.size ||
        command.draftTransitions.some ( transition =>
            !currentDraftIdentifiers.has ( transition.id ) || !isValidChartDraftTransition ( transition ) ) )
    {
        // Return the create failure result.

        return createFailure ( "COMMAND_INVALID", "The atomic Chart indicator placement is incomplete or invalid." );
    }

    // Handle the case where all required conditions are satisfied.

    if ( initialIndicatorAdded && (
        command.terminalStateIndicators.length !== currentTerminalIdentifiers.size ||
        JSON.stringify ( command.terminalStateTransitions ) !==
            JSON.stringify ( state.draft.chart.indicators.terminalStateTransitions ) ) )
    {
        // Return the create failure result.

        return createFailure ( "COMMAND_INVALID", "Initial-indicator placement cannot alter terminal relations." );
    }

    // Handle the case where all required conditions are satisfied.

    if ( terminalIndicatorAdded && (
        ( state.draft.chart.indicators.initialStateIndicator === null ) !==
            ( command.initialStateIndicator === null ) ) )
    {
        // Return the create failure result.

        return createFailure ( "COMMAND_INVALID", "Terminal-indicator placement cannot add the initial indicator." );
    }

    // Return the create plan result.

    return createPlan ( command, {
        ...state.draft,
        stateMachine: { ...state.draft.stateMachine, initialState: command.initialState },
        chart:
        {
            ...state.draft.chart,
            states: command.statePlacements,
            draftTransitions: command.draftTransitions,
            indicators:
            {
                initialStateIndicator: command.initialStateIndicator,
                terminalStateIndicators: command.terminalStateIndicators,
                terminalStateTransitions: command.terminalStateTransitions,
            },
        },
    } );
}

//--------------------------------------------------------------------------------------------------
// Function: planDeleteChartTerminalIndicatorCommand
//
// Description:
//
//   Plans the delete chart terminal indicator command.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
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

function planDeleteChartTerminalIndicatorCommand (
    state: DocumentEditorState,
    command: DeleteChartTerminalIndicatorCommand,
): CommandPlanResult
{
    // Handle the case where the some result condition is not satisfied.

    if ( !state.draft.chart.indicators.terminalStateIndicators.some (
        indicator => indicator.id === command.indicatorId,
    ) )
    {
        // Return the create failure result.

        return createFailure ( "ENTITY_NOT_FOUND", `Visual final indicator '${command.indicatorId}' does not exist.` );
    }

    const resultingDraft: AuthoringDraft = {
        ...state.draft,
        chart:
        {
            ...state.draft.chart,
            indicators:
            {
                ...state.draft.chart.indicators,
                terminalStateIndicators: state.draft.chart.indicators.terminalStateIndicators.filter (
                    indicator => indicator.id !== command.indicatorId,
                ),
                terminalStateTransitions: state.draft.chart.indicators.terminalStateTransitions.filter (
                    relation => relation.terminalStateIndicatorId !== command.indicatorId,
                ),
            },
        },
    };

    // Return the create plan result.

    return createPlan ( command, resultingDraft, calculateDraftReductionImpact ( state.draft, resultingDraft ) );
}

//--------------------------------------------------------------------------------------------------
// Function: planConnectChartTerminalIndicatorCommand
//
// Description:
//
//   Plans the connect chart terminal indicator command.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
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

function planConnectChartTerminalIndicatorCommand (
    state: DocumentEditorState,
    command: ConnectChartTerminalIndicatorCommand,
): CommandPlanResult
{
    // Handle the case where the declaration exists result condition is not satisfied.

    if ( !declarationExists ( state.draft, "state", command.state ) )
    {
        // Return the create failure result.

        return createFailure ( "REFERENCE_INVALID", `State '${command.state}' is not declared.` );
    }

    // Handle the case where the some result condition is not satisfied.

    if ( !state.draft.chart.indicators.terminalStateIndicators.some (
        indicator => indicator.id === command.indicatorId,
    ) )
    {
        // Return the create failure result.

        return createFailure ( "REFERENCE_INVALID", `Visual final indicator '${command.indicatorId}' does not exist.` );
    }

    const currentRelation = state.draft.chart.indicators.terminalStateTransitions.find (
        relation => relation.state === command.state,
    );

    // Handle the case where current relation terminal state indicator identifier matches command
    // indicator identifier.

    if ( currentRelation?.terminalStateIndicatorId === command.indicatorId )
    {
        // Return the create failure result.

        return createFailure ( "COMMAND_INVALID", `State '${command.state}' already uses that terminal indicator.` );
    }

    // Return the create plan result.

    return createPlan (
        command,
        {
            ...state.draft,
            chart:
            {
                ...state.draft.chart,
                indicators:
                {
                    ...state.draft.chart.indicators,
                    terminalStateTransitions:
                    [
                        ...state.draft.chart.indicators.terminalStateTransitions.filter (
                            relation => relation.state !== command.state,
                        ),
                        { state: command.state, terminalStateIndicatorId: command.indicatorId },
                    ],
                },
            },
        },
    );
}

//--------------------------------------------------------------------------------------------------
// Function: planDeleteChartSelectionCommand
//
// Description:
//
//   Plans the delete chart selection command.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
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

function planDeleteChartSelectionCommand (
    state: DocumentEditorState,
    command: DeleteChartSelectionCommand,
): CommandPlanResult
{
    // Initialize the local values needed by this operation.

    const stateNames             = new Set ( command.stateNames );
    const transitionKeys         = new Set ( command.transitionKeys.map ( key => JSON.stringify ( [ key.state, key.event ] ) ) );
    const terminalIndicatorIds   = new Set ( command.terminalStateIndicatorIds );
    const terminalRelationStates = new Set ( command.terminalStateRelationStates );
    const draftTransitionIds     = new Set ( command.draftTransitionIds );
    const hasSelection           = stateNames.size > 0 || transitionKeys.size > 0 || terminalIndicatorIds.size > 0 ||
        terminalRelationStates.size > 0 || draftTransitionIds.size > 0 || command.clearInitialStateRelation ||
        command.deleteInitialStateIndicator;

    // Handle the case where at least one branch condition is satisfied.

    if ( !hasSelection || stateNames.size !== command.stateNames.length ||
        transitionKeys.size !== command.transitionKeys.length ||
        terminalIndicatorIds.size !== command.terminalStateIndicatorIds.length ||
        terminalRelationStates.size !== command.terminalStateRelationStates.length ||
        draftTransitionIds.size !== command.draftTransitionIds.length )
    {
        // Return the create failure result.

        return createFailure ( "COMMAND_INVALID", "The Chart selection is empty or contains duplicates." );
    }

    // Handle the case where at least one branch condition is satisfied.

    if ( [ ...stateNames ].some ( stateName => !declarationExists ( state.draft, "state", stateName ) ) ||
        [ ...transitionKeys ].some ( transitionKey => !state.draft.stateMachine.transitionTable.some (
            transition => JSON.stringify ( [ transition.state, transition.event ] ) === transitionKey,
        ) ) ||
        [ ...terminalIndicatorIds ].some ( indicatorId =>
            !state.draft.chart.indicators.terminalStateIndicators.some ( indicator => indicator.id === indicatorId ) ) ||
        [ ...terminalRelationStates ].some ( stateName =>
            !state.draft.chart.indicators.terminalStateTransitions.some ( relation => relation.state === stateName ) ) ||
        [ ...draftTransitionIds ].some ( draftTransitionId =>
            !state.draft.chart.draftTransitions.some ( draftTransition =>
                draftTransition.id === draftTransitionId ) ) ||
        ( command.clearInitialStateRelation && state.draft.stateMachine.initialState === null ) ||
        ( command.deleteInitialStateIndicator && state.draft.chart.indicators.initialStateIndicator === null ) )
    {
        // Return the create failure result.

        return createFailure ( "ENTITY_NOT_FOUND", "One or more selected Chart elements no longer exist." );
    }

    let resultingDraft = state.draft;

    // Process each state name from the state names collection in order.

    for ( const stateName of stateNames )
    {
        resultingDraft = deleteEntity ( resultingDraft, "state", stateName );
    }

    resultingDraft = {
        ...resultingDraft,
        stateMachine:
        {
            ...resultingDraft.stateMachine,
            initialState: command.clearInitialStateRelation || command.deleteInitialStateIndicator
                ? null
                : resultingDraft.stateMachine.initialState,
            transitionTable: resultingDraft.stateMachine.transitionTable.filter ( transition =>
                !transitionKeys.has ( JSON.stringify ( [ transition.state, transition.event ] ) ) ),
        },
        chart:
        {
            ...resultingDraft.chart,
            indicators:
            {
                ...resultingDraft.chart.indicators,
                initialStateIndicator: command.deleteInitialStateIndicator
                    ? null
                    : resultingDraft.chart.indicators.initialStateIndicator,
                terminalStateIndicators: resultingDraft.chart.indicators.terminalStateIndicators.filter (
                    indicator => !terminalIndicatorIds.has ( indicator.id ),
                ),
                terminalStateTransitions: resultingDraft.chart.indicators.terminalStateTransitions.filter ( relation =>
                    !terminalRelationStates.has ( relation.state ) &&
                    !terminalIndicatorIds.has ( relation.terminalStateIndicatorId ) ),
            },
            draftTransitions: resultingDraft.chart.draftTransitions.filter ( draftTransition =>
                !draftTransitionIds.has ( draftTransition.id ) ),
        },
    };

    // Return the create plan result.

    return createPlan ( command, resultingDraft, calculateDraftReductionImpact ( state.draft, resultingDraft ) );
}

//--------------------------------------------------------------------------------------------------
// Function: planImportModelElementsCommand
//
// Description:
//
//   Plans the import model elements command.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
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

function planImportModelElementsCommand (
    state: DocumentEditorState,
    command: ImportModelElementsCommand,
): CommandPlanResult
{
    // Initialize the local values needed by this operation.

    const inspection = inspectModelElementImport ( state.draft, command.modelImport );

    // Handle the case where the inspection is successful condition is not satisfied.

    if ( !inspection.isSuccessful )
    {
        // Initialize the local values needed by this operation.

        const diagnostic = inspection.diagnostics [ 0 ];

        // Return the create failure result.

        return createFailure (
            "COMMAND_INVALID",
            diagnostic === undefined
                ? "The model-element import is invalid."
                : `${diagnostic.message} ${diagnostic.remediation}`,
        );
    }

    // Handle the case where all required conditions are satisfied.

    if ( inspection.conflicts.length > 0 && !command.overwriteConflicts )
    {
        // Initialize the local values needed by this operation.

        const conflictKeys   = inspection.conflicts.slice ( 0, 10 ).map ( conflict => `'${conflict.key}'` ).join ( ", " );
        const remainingCount = inspection.conflicts.length - Math.min ( inspection.conflicts.length, 10 );
        const remainingText  = remainingCount === 0 ? "" : ` and ${remainingCount} more`;

        // Return the create failure result.

        return createFailure (
            "IMPORT_CONFLICT",
            `${inspection.conflicts.length} existing item(s) conflict with this import: ${conflictKeys}${remainingText}.`,
        );
    }

    // Return the create plan result.

    return createPlan ( command, inspection.resultingDraft );
}

//--------------------------------------------------------------------------------------------------
// Function: planDocumentCommand
//
// Description:
//
//   Plans the document command.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
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

export function planDocumentCommand (
    state: DocumentEditorState,
    command: DocumentCommand,
): CommandPlanResult
{
    // Handle the case where command expected revision differs from state document revision.

    if ( command.expectedRevision !== state.documentRevision )
    {
        // Return the create failure result.

        return createFailure (
            "REVISION_MISMATCH",
            `Expected document revision ${command.expectedRevision}, but the current revision is ${state.documentRevision}.`,
        );
    }

    // Dispatch according to the command kind value.

    switch ( command.kind )
    {
        // Handle the "add_chart_draft_transition" case.

        case "add_chart_draft_transition":

            // Return the plan add chart draft transition command result.

            return planAddChartDraftTransitionCommand ( state, command );

        // Handle the "add_chart_terminal_indicator" case.

        case "add_chart_terminal_indicator":

            // Return the plan add chart terminal indicator command result.

            return planAddChartTerminalIndicatorCommand ( state, command );

        // Handle the "apply_solver_candidate" case.

        case "apply_solver_candidate":
        {
            // Handle the case where at least one branch condition is satisfied.

            if ( command.candidate.baselineDocumentRevision !== state.documentRevision ||
                command.candidate.baselineSolverRevision !== state.solverRevision ||
                command.expectedSolverRevision !== state.solverRevision )
            {
                // Return the create failure result.

                return createFailure (
                    "SOLVER_CANDIDATE_STALE",
                    "The Solver candidate no longer matches the current document and observation revisions.",
                );
            }

            const resultingDraft: AuthoringDraft =
            {
                ...state.draft,
                stateMachine: command.candidate.stateMachine,
                chart:
                {
                    ...command.candidate.chart,
                    settings: state.draft.chart.settings,
                },
            };

            // Handle the case where the is valid condition is not satisfied.

            if ( !summarizeAuthoringDraftValidation ( resultingDraft ).isValid )
            {
                // Return the create failure result.

                return createFailure ( "COMMAND_INVALID", "The Solver candidate does not produce a valid document." );
            }

            // Return the create plan result.

            return createPlan (
                command,
                resultingDraft,
                {
                    ...EMPTY_IMPACT,
                    declarationCount: state.draft.stateMachine.states.length +
                        state.draft.stateMachine.events.length + state.draft.stateMachine.actions.length,
                    actionMappingCount: state.draft.stateMachine.stateActions.entry.length +
                        state.draft.stateMachine.stateActions.exit.length,
                    transitionCount: state.draft.stateMachine.transitionTable.length,
                    chartStatePlacementCount: state.draft.chart.states.length,
                    chartDraftTransitionCount: state.draft.chart.draftTransitions.length,
                    chartTerminalIndicatorCount: state.draft.chart.indicators.terminalStateIndicators.length,
                    chartTerminalRelationCount: state.draft.chart.indicators.terminalStateTransitions.length,
                    chartInitialIndicatorCount: state.draft.chart.indicators.initialStateIndicator === null ? 0 : 1,
                },
            );
        }

        // Handle the group of case values that share the following outcome.

        case "add_entity":
        case "delete_entity":
        case "move_entity":
        case "rename_entity":
        case "update_entity":

            // Return the plan entity command result.

            return planEntityCommand ( state, command );

        // Handle the "connect_chart_terminal_indicator" case.

        case "connect_chart_terminal_indicator":

            // Return the plan connect chart terminal indicator command result.

            return planConnectChartTerminalIndicatorCommand ( state, command );

        // Handle the "configure_chart_draft_transition" case.

        case "configure_chart_draft_transition":

            // Return the plan configure chart draft transition command result.

            return planConfigureChartDraftTransitionCommand ( state, command );

        // Handle the "delete_chart_selection" case.

        case "delete_chart_selection":

            // Return the plan delete chart selection command result.

            return planDeleteChartSelectionCommand ( state, command );

        // Handle the "delete_chart_terminal_indicator" case.

        case "delete_chart_terminal_indicator":

            // Return the plan delete chart terminal indicator command result.

            return planDeleteChartTerminalIndicatorCommand ( state, command );

        // Handle the group of case values that share the following outcome.

        case "add_state_action":
        case "delete_state_action":
        case "move_state_action":
        case "update_state_action":

            // Return the plan state action command result.

            return planStateActionCommand ( state, command );

        // Handle the group of case values that share the following outcome.

        case "add_transition":
        case "delete_transition":
        case "move_transition":
        case "update_transition":

            // Return the plan transition command result.

            return planTransitionCommand ( state, command );

        // Handle the "import_model_elements" case.

        case "import_model_elements":

            // Return the plan import model elements command result.

            return planImportModelElementsCommand ( state, command );

        // Handle the "place_chart_indicator" case.

        case "place_chart_indicator":

            // Return the plan place chart indicator command result.

            return planPlaceChartIndicatorCommand ( state, command );

        // Handle the "replace_simulator_sequences" case.

        case "replace_simulator_sequences":

            // Handle the case where length exceeds maximum simulator sequence count.

            if ( command.sequences.length > MAXIMUM_SIMULATOR_SEQUENCE_COUNT )
            {
                // Return the create failure result.

                return createFailure (
                    "COMMAND_INVALID",
                    `The Simulator sequence library may contain at most ${MAXIMUM_SIMULATOR_SEQUENCE_COUNT} sequences.`,
                );
            }

            // Handle the case where some result is enabled.

            if ( command.sequences.some ( sequence => sequence.sequence.length > MAXIMUM_EVENT_BUFFER_COUNT ) )
            {
                // Return the create failure result.

                return createFailure (
                    "COMMAND_INVALID",
                    `A Simulator sequence may contain at most ${MAXIMUM_EVENT_BUFFER_COUNT} events.`,
                );
            }

            // Handle the case where stringify result matches stringify result.

            if ( JSON.stringify ( state.draft.simulator.sequences ) === JSON.stringify ( command.sequences ) )
            {
                // Return the create failure result.

                return createFailure ( "COMMAND_INVALID", "The Simulator sequence library is unchanged." );
            }

            // Return the create plan result.

            return createPlan (
                command,
                { ...state.draft, simulator: { sequences: command.sequences } },
            );

        // Handle the "replace_solver_sequences" case.

        case "replace_solver_sequences":

            // Handle the case where length exceeds maximum solver sequence count.

            if ( command.sequences.length > MAXIMUM_SOLVER_SEQUENCE_COUNT )
            {
                // Return the create failure result.

                return createFailure (
                    "COMMAND_INVALID",
                    `The Solver sequence library may contain at most ${MAXIMUM_SOLVER_SEQUENCE_COUNT} sequences.`,
                );
            }

            // Handle the case where reduce result exceeds maximum solver token count.

            if ( command.sequences.reduce ( ( count, sequence ) => count + sequence.sequence.length, 0 ) >
                MAXIMUM_SOLVER_TOKEN_COUNT )
            {
                // Return the create failure result.

                return createFailure (
                    "COMMAND_INVALID",
                    `The Solver sequence library may contain at most ${MAXIMUM_SOLVER_TOKEN_COUNT} tokens.`,
                );
            }

            // Handle the case where some result is enabled.

            if ( command.sequences.some ( sequence => sequence.sequence.some (
                token => !isSolverTokenTextWithinBounds ( token ),
            ) ) )
            {
                // Return the create failure result.

                return createFailure (
                    "COMMAND_INVALID",
                    `A saved Solver token may contain at most ${MAXIMUM_SOLVER_TOKEN_CODE_POINT_COUNT} Unicode code points.`,
                );
            }

            // Handle the case where stringify result matches stringify result.

            if ( JSON.stringify ( state.draft.solver.sequences ) === JSON.stringify ( command.sequences ) )
            {
                // Return the create failure result.

                return createFailure ( "COMMAND_INVALID", "The Solver sequence library is unchanged." );
            }

            // Return the create plan result.

            return createPlan (
                command,
                { ...state.draft, solver: { sequences: command.sequences } },
            );

        // Handle the "replace_chart_geometry" case.

        case "replace_chart_geometry":

            // Return the plan replace chart geometry command result.

            return planReplaceChartGeometryCommand ( state, command );

        // Handle the "set_chart_expand_states" case.

        case "set_chart_expand_states":

            // Return the result selected by the current condition.

            return state.draft.chart.settings.expandStates === command.expandStates
                ? createFailure ( "COMMAND_INVALID", "The Chart expansion setting is unchanged." )
                : createPlan (
                    command,
                    {
                        ...state.draft,
                        chart:
                        {
                            ...state.draft.chart,
                            settings: { ...state.draft.chart.settings, expandStates: command.expandStates },
                        },
                    },
                );

        // Handle the "set_chart_initial_indicator" case.

        case "set_chart_initial_indicator":

            // Return the plan set chart initial indicator command result.

            return planSetChartInitialIndicatorCommand ( state, command );

        // Handle the "set_initial_state" case.

        case "set_initial_state":

            // Handle the case where all required conditions are satisfied.

            if ( command.initialState !== null && !declarationExists ( state.draft, "state", command.initialState ) )
            {
                // Return the create failure result.

                return createFailure ( "REFERENCE_INVALID", `State '${command.initialState}' is not declared.` );
            }

            // Return the result selected by the current condition.

            return state.draft.stateMachine.initialState === command.initialState
                ? createFailure ( "COMMAND_INVALID", "The initial-state selection is unchanged." )
                : createPlan (
                    command,
                    {
                        ...state.draft,
                        stateMachine: { ...state.draft.stateMachine, initialState: command.initialState },
                        chart:
                        {
                            ...state.draft.chart,
                            indicators:
                            {
                                ...state.draft.chart.indicators,
                                initialStateIndicator: state.draft.chart.indicators.initialStateIndicator === null ||
                                    state.draft.chart.indicators.initialStateIndicator.state === undefined ||
                                    state.draft.chart.indicators.initialStateIndicator.state === null
                                    ? state.draft.chart.indicators.initialStateIndicator
                                    : {
                                        ...state.draft.chart.indicators.initialStateIndicator,
                                        state: command.initialState,
                                    },
                            },
                        },
                    },
                );

        // Handle the "update_document_settings" case.

        case "update_document_settings":

            // Handle the case where at least one branch condition is satisfied.

            if ( !validateCommandName ( command.settings.name ) ||
                !validateDescription ( command.settings.description ) || command.settings.version.trim ().length === 0 )
            {
                // Return the create failure result.

                return createFailure ( "COMMAND_INVALID", "The document metadata is invalid." );
            }

            // Return the result selected by the current condition.

            return JSON.stringify ( state.draft.settings ) === JSON.stringify ( command.settings )
                ? createFailure ( "COMMAND_INVALID", "The document metadata is unchanged." )
                : createPlan ( command, { ...state.draft, settings: command.settings } );
    }
}

//--------------------------------------------------------------------------------------------------
// Function: executeDocumentCommand
//
// Description:
//
//   Executes the document command.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
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

export function executeDocumentCommand (
    state: DocumentEditorState,
    plan: DocumentCommandPlan,
): CommandExecutionResult
{
    // Handle the case where expected revision differs from state document revision.

    if ( plan.command.expectedRevision !== state.documentRevision )
    {
        // Return the create failure result.

        return createFailure (
            "REVISION_MISMATCH",
            `The command plan targets revision ${plan.command.expectedRevision}, but the current revision is ${state.documentRevision}.`,
        );
    }

    // Initialize the local values needed by this operation.

    const historyEntry: DocumentHistoryEntry =
    {
        commandKind: plan.command.kind,
        before:      state.draft,
        after:       plan.resultingDraft,
    };
    const solverChanged = plan.resultingDraft.solver !== state.draft.solver;

    // Return the assembled result.

    return {
        isSuccessful: true,
        state:
        {
            draft:            plan.resultingDraft,
            cleanDraft:       state.cleanDraft,
            documentRevision: state.documentRevision + 1,
            solverRevision:   state.solverRevision + ( solverChanged ? 1 : 0 ),
            dirty:            plan.resultingDraft !== state.cleanDraft,
            validationSummary: summarizeAuthoringDraftValidation ( plan.resultingDraft ),
            undoStack:        [ ...state.undoStack, historyEntry ],
            redoStack:        [],
        },
    };
}

//--------------------------------------------------------------------------------------------------
// Function: undoDocumentCommand
//
// Description:
//
//   Undoes the document command.
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

export function undoDocumentCommand ( state: DocumentEditorState ): CommandExecutionResult
{
    // Calculate the history entry value from the current inputs.

    const historyEntry = state.undoStack [ state.undoStack.length - 1 ];

    // Handle the case where history entry matches undefined.

    if ( historyEntry === undefined )
    {
        // Return the create failure result.

        return createFailure ( "COMMAND_INVALID", "There is no document command to undo." );
    }

    // Return the assembled result.

    return {
        isSuccessful: true,
        state:
        {
            draft:            historyEntry.before,
            cleanDraft:       state.cleanDraft,
            documentRevision: state.documentRevision + 1,
            solverRevision:   state.solverRevision + ( historyEntry.before.solver !== state.draft.solver ? 1 : 0 ),
            dirty:            historyEntry.before !== state.cleanDraft,
            validationSummary: summarizeAuthoringDraftValidation ( historyEntry.before ),
            undoStack:        state.undoStack.slice ( 0, -1 ),
            redoStack:        [ ...state.redoStack, historyEntry ],
        },
    };
}

//--------------------------------------------------------------------------------------------------
// Function: redoDocumentCommand
//
// Description:
//
//   Derives the redo document command.
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

export function redoDocumentCommand ( state: DocumentEditorState ): CommandExecutionResult
{
    // Calculate the history entry value from the current inputs.

    const historyEntry = state.redoStack [ state.redoStack.length - 1 ];

    // Handle the case where history entry matches undefined.

    if ( historyEntry === undefined )
    {
        // Return the create failure result.

        return createFailure ( "COMMAND_INVALID", "There is no document command to redo." );
    }

    // Return the assembled result.

    return {
        isSuccessful: true,
        state:
        {
            draft:            historyEntry.after,
            cleanDraft:       state.cleanDraft,
            documentRevision: state.documentRevision + 1,
            solverRevision:   state.solverRevision + ( historyEntry.after.solver !== state.draft.solver ? 1 : 0 ),
            dirty:            historyEntry.after !== state.cleanDraft,
            validationSummary: summarizeAuthoringDraftValidation ( historyEntry.after ),
            undoStack:        [ ...state.undoStack, historyEntry ],
            redoStack:        state.redoStack.slice ( 0, -1 ),
        },
    };
}
