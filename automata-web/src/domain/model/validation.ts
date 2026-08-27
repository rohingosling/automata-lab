// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Semantic Document Validation
// Version: 1.0.0
// Date:    2026-08-09
// Author:  Rohin Gosling
//
// Description:
//
//   Validates editable drafts without repairing them and promotes error-free drafts to valid
//   documents.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type
{
    AuthoringDraft,
    AutomataDocument,
    NamedEntity,
} from "./contracts.js";
import type { DomainDiagnostic } from "./diagnostics.js";
import { sortDiagnostics } from "./diagnostics.js";
import
{
    DEFAULT_CHART_STATE_HEIGHT,
    MAXIMUM_CHART_STATE_DIMENSION,
    MAXIMUM_ACTION_COUNT,
    MAXIMUM_CHART_DRAFT_TRANSITION_COUNT,
    MAXIMUM_CHART_TERMINAL_INDICATOR_COUNT,
    MAXIMUM_CHART_TERMINAL_RELATION_COUNT,
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
import { canonicalizeSolverNamedToken, isSolverTokenTextWithinBounds } from "./solver-token.js";

const SEMANTIC_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

const INCOMPLETE_AUTHORING_DIAGNOSTIC_CODES = new Set (
    [
        "INITIAL_STATE_UNDEFINED",
        "STATE_DEFINITIONS_MISSING",
    ],
);

//--------------------------------------------------------------------------------------------------
// Type: DocumentValidationResult
//
// Description:
//
//   Describes the result produced by document validation.
//
//--------------------------------------------------------------------------------------------------

export type DocumentValidationResult =
    | {
        readonly isValid:     true;
        readonly document:    AutomataDocument;
        readonly diagnostics: readonly DomainDiagnostic[];
    }
    | {
        readonly isValid:     false;
        readonly diagnostics: readonly DomainDiagnostic[];
    };

//--------------------------------------------------------------------------------------------------
// Interface: DocumentValidationSummary
//
// Description:
//
//   Defines the structure of document validation summary.
//
//--------------------------------------------------------------------------------------------------

export interface DocumentValidationSummary
{
    readonly isValid:      boolean;
    readonly errorCount:   number;
    readonly warningCount: number;
    readonly diagnostics:  readonly DomainDiagnostic[];
}

//--------------------------------------------------------------------------------------------------
// Type: PersistableAuthoringDraftValidationResult
//
// Description:
//
//   Describes the result produced by persistable authoring draft validation.
//
//--------------------------------------------------------------------------------------------------

export type PersistableAuthoringDraftValidationResult =
    | {
        readonly isValid:     true;
        readonly document:    AuthoringDraft;
        readonly diagnostics: readonly DomainDiagnostic[];
    }
    | {
        readonly isValid:     false;
        readonly diagnostics: readonly DomainDiagnostic[];
    };

//--------------------------------------------------------------------------------------------------
// Function: isSemanticVersion
//
// Description:
//
//   Determines whether semantic version.
//
// Parameters:
//
//   - value:
//     The value supplied to the operation.
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

export function isSemanticVersion ( value: string ): boolean
{
    // Return the test result.

    return SEMANTIC_VERSION_PATTERN.test ( value );
}

//--------------------------------------------------------------------------------------------------
// Function: filterIncompleteAuthoringDiagnostics
//
// Description:
//
//   Derives the filter incomplete authoring diagnostics.
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

export function filterIncompleteAuthoringDiagnostics (
    diagnostics: readonly DomainDiagnostic[],
): readonly DomainDiagnostic[]
{
    // Return the filtered collection.

    return diagnostics.filter ( diagnostic => INCOMPLETE_AUTHORING_DIAGNOSTIC_CODES.has ( diagnostic.code ) );
}

//--------------------------------------------------------------------------------------------------
// Function: codePointCount
//
// Description:
//
//   Derives the code point count.
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

function codePointCount ( value: string ): number
{
    // Return the computed result.

    return [ ...value ].length;
}

//--------------------------------------------------------------------------------------------------
// Function: addDiagnostic
//
// Description:
//
//   Adds the diagnostic.
//
// Parameters:
//
//   - diagnostics:
//     The diagnostics supplied to the operation.
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
//   - message:
//     The message supplied to the operation.
//
//   - remediation:
//     The remediation supplied to the operation.
//
//   - path:
//     The path supplied to the operation.
//
//   - context:
//     The context supplied to the operation.
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
//--------------------------------------------------------------------------------------------------

function addDiagnostic (
    diagnostics: DomainDiagnostic[],
    code: string,
    severity: "error" | "warning",
    source: string,
    message: string,
    remediation: string,
    path?: string,
    context?: string,
): void
{
    // Initialize the local values needed by this operation.

    const baseDiagnostic =
    {
        code,
        severity,
        source,
        message,
        remediation,
    };

    // Handle the case where all required conditions are satisfied.

    if ( path !== undefined && context !== undefined )
    {
        diagnostics.push ( { ...baseDiagnostic, path, context } );
    }
    else if ( path !== undefined )
    {
        diagnostics.push ( { ...baseDiagnostic, path } );
    }
    else if ( context !== undefined )
    {
        diagnostics.push ( { ...baseDiagnostic, context } );
    }
    else
    {
        diagnostics.push ( baseDiagnostic );
    }
}

//--------------------------------------------------------------------------------------------------
// Function: validateBoundedName
//
// Description:
//
//   Validates bounded name.
//
// Parameters:
//
//   - value:
//     The value supplied to the operation.
//
//   - path:
//     The path supplied to the operation.
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
//--------------------------------------------------------------------------------------------------

function validateBoundedName (
    value: string,
    path: string,
    diagnostics: DomainDiagnostic[],
): void
{
    // Handle the case where at least one branch condition is satisfied.

    if ( value.length === 0 || value !== value.trim () || codePointCount ( value ) > MAXIMUM_NAME_CODE_POINT_COUNT )
    {
        addDiagnostic (
            diagnostics,
            "NAME_INVALID",
            "error",
            "model",
            "Names must be non-empty trimmed strings of at most 128 Unicode code points.",
            "Remove surrounding whitespace and shorten the name if necessary.",
            path,
        );
    }
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
//   - value:
//     The value supplied to the operation.
//
//   - path:
//     The path supplied to the operation.
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
//--------------------------------------------------------------------------------------------------

function validateDescription (
    value: string,
    path: string,
    diagnostics: DomainDiagnostic[],
): void
{
    // Handle the case where code point count result exceeds maximum description code points.

    if ( codePointCount ( value ) > MAXIMUM_DESCRIPTION_CODE_POINTS )
    {
        addDiagnostic (
            diagnostics,
            "DESCRIPTION_TOO_LONG",
            "error",
            "model",
            "Descriptions may contain at most 4,096 Unicode code points.",
            "Shorten the description.",
            path,
        );
    }
}

//--------------------------------------------------------------------------------------------------
// Function: validateNamedEntities
//
// Description:
//
//   Validates named entities.
//
// Parameters:
//
//   - entities:
//     The entities supplied to the operation.
//
//   - path:
//     The path supplied to the operation.
//
//   - namespaceName:
//     The namespace name supplied to the operation.
//
//   - maximumCount:
//     The maximum count supplied to the operation.
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

function validateNamedEntities (
    entities: readonly NamedEntity[],
    path: string,
    namespaceName: string,
    maximumCount: number,
    diagnostics: DomainDiagnostic[],
): ReadonlySet<string>
{
    // Initialize the local values needed by this operation.

    const names = new Set<string> ();

    // Handle the case where entities length exceeds maximum count.

    if ( entities.length > maximumCount )
    {
        addDiagnostic (
            diagnostics,
            "CAPACITY_EXCEEDED",
            "error",
            "capacity",
            `${namespaceName} contains ${entities.length} declarations; the maximum is ${maximumCount}.`,
            `Remove ${namespaceName.toLowerCase ()} declarations until the collection is within the limit.`,
            path,
        );
    }

    entities.forEach ( ( entity, entityIndex ) =>
    {
        // Initialize the local values needed by this operation.

        const entityPath = `${path}/${entityIndex}`;

        validateBoundedName ( entity.name, `${entityPath}/name`, diagnostics );
        validateDescription ( entity.description, `${entityPath}/description`, diagnostics );

        // Handle the case where has result is enabled.

        if ( names.has ( entity.name ) )
        {
            addDiagnostic (
                diagnostics,
                "DUPLICATE_NAME",
                "error",
                "model",
                `${namespaceName} contains the duplicate name '${entity.name}'.`,
                `Rename or remove the duplicate ${namespaceName.toLowerCase ()} declaration.`,
                `${entityPath}/name`,
                entity.name,
            );
        }

        names.add ( entity.name );
    } );

    // Return the names.

    return names;
}

//--------------------------------------------------------------------------------------------------
// Function: validateCapacity
//
// Description:
//
//   Validates capacity.
//
// Parameters:
//
//   - actualCount:
//     The actual count supplied to the operation.
//
//   - maximumCount:
//     The maximum count supplied to the operation.
//
//   - path:
//     The path supplied to the operation.
//
//   - collectionName:
//     The collection name supplied to the operation.
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
//--------------------------------------------------------------------------------------------------

function validateCapacity (
    actualCount: number,
    maximumCount: number,
    path: string,
    collectionName: string,
    diagnostics: DomainDiagnostic[],
): void
{
    // Handle the case where actual count does not exceed maximum count.

    if ( actualCount <= maximumCount )
    {
        // Return control to the caller.

        return;
    }

    addDiagnostic (
        diagnostics,
        "CAPACITY_EXCEEDED",
        "error",
        "capacity",
        `${collectionName} contains ${actualCount} items; the maximum is ${maximumCount}.`,
        `Remove items from ${collectionName.toLowerCase ()} until the collection is within the limit.`,
        path,
    );
}

//--------------------------------------------------------------------------------------------------
// Function: validateStateMachine
//
// Description:
//
//   Validates state machine.
//
// Parameters:
//
//   - draft:
//     The draft supplied to the operation.
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
//--------------------------------------------------------------------------------------------------

function validateStateMachine (
    draft: AuthoringDraft,
    diagnostics: DomainDiagnostic[],
): void
{
    // Initialize the local values needed by this operation.

    const stateMachine = draft.stateMachine;
    const stateNames   = validateNamedEntities (
        stateMachine.states,
        "/state_machine/states",
        "States",
        MAXIMUM_STATE_COUNT,
        diagnostics,
    );
    const eventNames = validateNamedEntities (
        stateMachine.events,
        "/state_machine/events",
        "Events",
        MAXIMUM_EVENT_COUNT,
        diagnostics,
    );
    const actionNames = validateNamedEntities (
        stateMachine.actions,
        "/state_machine/actions",
        "Actions",
        MAXIMUM_ACTION_COUNT,
        diagnostics,
    );

    // Handle the case where length equals 0.

    if ( stateMachine.states.length === 0 )
    {
        addDiagnostic (
            diagnostics,
            "STATE_REQUIRED",
            "error",
            "model",
            "A valid state machine requires at least one state.",
            "Add a state.",
            "/state_machine/states",
        );
    }

    // Handle the case where state machine initial state matches an absent value.

    if ( stateMachine.initialState === null )
    {
        addDiagnostic (
            diagnostics,
            "INITIAL_STATE_REQUIRED",
            "error",
            "model",
            "A valid state machine requires an initial state.",
            "Select one declared state as the initial state.",
            "/state_machine/initial_state",
        );
    }
    else if ( !stateNames.has ( stateMachine.initialState ) )
    {
        addDiagnostic (
            diagnostics,
            "INITIAL_STATE_UNKNOWN",
            "error",
            "reference",
            `Initial state '${stateMachine.initialState}' is not declared.`,
            "Select a declared state.",
            "/state_machine/initial_state",
            stateMachine.initialState,
        );
    }

    validateCapacity (
        stateMachine.stateActions.entry.length,
        MAXIMUM_ENTRY_ACTION_COUNT,
        "/state_machine/state_actions/entry",
        "Entry action mappings",
        diagnostics,
    );
    validateCapacity (
        stateMachine.stateActions.exit.length,
        MAXIMUM_EXIT_ACTION_COUNT,
        "/state_machine/state_actions/exit",
        "Exit action mappings",
        diagnostics,
    );

    //----------------------------------------------------------------------------------------------
    // Function: validateActionMappings
    //
    // Description:
    //
    //   Validates action mappings.
    //
    // Parameters:
    //
    //   - mappings:
    //     The mappings supplied to the operation.
    //
    //   - path:
    //     The path supplied to the operation.
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

    const validateActionMappings = ( mappings: typeof stateMachine.stateActions.entry, path: string ): void =>
    {
        mappings.forEach ( ( mapping, mappingIndex ) =>
        {
            // Handle the case where the has result condition is not satisfied.

            if ( !stateNames.has ( mapping.state ) )
            {
                addDiagnostic (
                    diagnostics,
                    "ACTION_MAPPING_STATE_UNKNOWN",
                    "error",
                    "reference",
                    `Action mapping references undeclared state '${mapping.state}'.`,
                    "Select a declared state or remove the mapping.",
                    `${path}/${mappingIndex}/state`,
                    mapping.state,
                );
            }

            // Handle the case where the has result condition is not satisfied.

            if ( !actionNames.has ( mapping.action ) )
            {
                addDiagnostic (
                    diagnostics,
                    "ACTION_MAPPING_ACTION_UNKNOWN",
                    "error",
                    "reference",
                    `Action mapping references undeclared action '${mapping.action}'.`,
                    "Select a declared action or remove the mapping.",
                    `${path}/${mappingIndex}/action`,
                    mapping.action,
                );
            }
        } );
    };

    validateActionMappings ( stateMachine.stateActions.entry, "/state_machine/state_actions/entry" );
    validateActionMappings ( stateMachine.stateActions.exit, "/state_machine/state_actions/exit" );
    validateCapacity (
        stateMachine.transitionTable.length,
        MAXIMUM_TRANSITION_COUNT,
        "/state_machine/transition_table",
        "Transitions",
        diagnostics,
    );

    const transitionKeys = new Set<string> ();

    stateMachine.transitionTable.forEach ( ( transition, transitionIndex ) =>
    {
        // Initialize the local values needed by this operation.

        const transitionPath = `/state_machine/transition_table/${transitionIndex}`;
        const transitionKey  = JSON.stringify ( [ transition.state, transition.event ] );

        // Handle the case where has result is enabled.

        if ( transitionKeys.has ( transitionKey ) )
        {
            addDiagnostic (
                diagnostics,
                "DUPLICATE_TRANSITION_KEY",
                "error",
                "determinism",
                `Transition key ('${transition.state}', '${transition.event}') occurs more than once.`,
                "Keep only one destination for the state and event pair.",
                transitionPath,
                transitionKey,
            );
        }

        transitionKeys.add ( transitionKey );

        // Handle the case where the has result condition is not satisfied.

        if ( !stateNames.has ( transition.state ) )
        {
            addDiagnostic (
                diagnostics,
                "TRANSITION_SOURCE_UNKNOWN",
                "error",
                "reference",
                `Transition source '${transition.state}' is not declared.`,
                "Select a declared source state or remove the transition.",
                `${transitionPath}/state`,
                transition.state,
            );
        }

        // Handle the case where the has result condition is not satisfied.

        if ( !eventNames.has ( transition.event ) )
        {
            addDiagnostic (
                diagnostics,
                "TRANSITION_EVENT_UNKNOWN",
                "error",
                "reference",
                `Transition event '${transition.event}' is not declared.`,
                "Select a declared event or remove the transition.",
                `${transitionPath}/event`,
                transition.event,
            );
        }

        // Handle the case where the has result condition is not satisfied.

        if ( !stateNames.has ( transition.stateNext ) )
        {
            addDiagnostic (
                diagnostics,
                "TRANSITION_DESTINATION_UNKNOWN",
                "error",
                "reference",
                `Transition destination '${transition.stateNext}' is not declared.`,
                "Select a declared destination state or remove the transition.",
                `${transitionPath}/state_next`,
                transition.stateNext,
            );
        }
    } );

    // Initialize the local values needed by this operation.

    const referencedEvents  = new Set ( stateMachine.transitionTable.map ( ( transition ) => transition.event ) );
    const referencedActions = new Set (
        [ ...stateMachine.stateActions.entry, ...stateMachine.stateActions.exit ].map ( ( mapping ) => mapping.action ),
    );

    stateMachine.events.forEach ( ( event, eventIndex ) =>
    {
        // Handle the case where the has result condition is not satisfied.

        if ( !referencedEvents.has ( event.name ) )
        {
            addDiagnostic (
                diagnostics,
                "UNUSED_EVENT",
                "warning",
                "advisory",
                `Event '${event.name}' is not used by a transition.`,
                "Use the event in a transition or remove it if it is unnecessary.",
                `/state_machine/events/${eventIndex}`,
                event.name,
            );
        }
    } );

    stateMachine.actions.forEach ( ( action, actionIndex ) =>
    {
        // Handle the case where the has result condition is not satisfied.

        if ( !referencedActions.has ( action.name ) )
        {
            addDiagnostic (
                diagnostics,
                "UNUSED_ACTION",
                "warning",
                "advisory",
                `Action '${action.name}' is not assigned to a state.`,
                "Assign the action or remove it if it is unnecessary.",
                `/state_machine/actions/${actionIndex}`,
                action.name,
            );
        }
    } );

    // Handle the case where all required conditions are satisfied.

    if ( stateMachine.initialState !== null && stateNames.has ( stateMachine.initialState ) )
    {
        // Initialize the local values needed by this operation.

        const reachableStates = new Set<string> ( [ stateMachine.initialState ] );
        const pendingStates   = [ stateMachine.initialState ];

        // Continue the operation while its terminating condition has not been reached.

        while ( pendingStates.length > 0 )
        {
            // Initialize the local values needed by this operation.

            const sourceState = pendingStates.shift ();

            // Handle the case where source state matches undefined.

            if ( sourceState === undefined )
            {
                break;
            }

            // Process each transition from the state machine transition table collection in order.

            for ( const transition of stateMachine.transitionTable )
            {
                // Handle the case where all required conditions are satisfied.

                if ( transition.state === sourceState && !reachableStates.has ( transition.stateNext ) )
                {
                    reachableStates.add ( transition.stateNext );
                    pendingStates.push ( transition.stateNext );
                }
            }
        }

        stateMachine.states.forEach ( ( state, stateIndex ) =>
        {
            // Handle the case where the has result condition is not satisfied.

            if ( !reachableStates.has ( state.name ) )
            {
                addDiagnostic (
                    diagnostics,
                    "UNREACHABLE_STATE",
                    "warning",
                    "advisory",
                    `State '${state.name}' is unreachable from the initial state.`,
                    "Add a path from a reachable state or confirm that the disconnected state is intentional.",
                    `/state_machine/states/${stateIndex}`,
                    state.name,
                );
            }
        } );
    }
}

//--------------------------------------------------------------------------------------------------
// Function: validateChart
//
// Description:
//
//   Validates chart.
//
// Parameters:
//
//   - draft:
//     The draft supplied to the operation.
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
//--------------------------------------------------------------------------------------------------

function validateChart ( draft: AuthoringDraft, diagnostics: DomainDiagnostic[] ): void
{
    // Initialize the local values needed by this operation.

    const stateNames                 = new Set ( draft.stateMachine.states.map ( ( state ) => state.name ) );
    const indicatorIdentifiers       = new Set<number> ();
    const draftTransitionIdentifiers = new Set<number> ();
    const relatedStates              = new Set<string> ();
    const placedStates               = new Set<string> ();

    validateCapacity (
        draft.chart.states.length,
        MAXIMUM_STATE_COUNT,
        "/chart/states",
        "Chart state placements",
        diagnostics,
    );
    validateCapacity (
        draft.chart.draftTransitions.length,
        MAXIMUM_CHART_DRAFT_TRANSITION_COUNT,
        "/chart/draft_transitions",
        "Chart draft transitions",
        diagnostics,
    );
    validateCapacity (
        draft.chart.indicators.terminalStateIndicators.length,
        MAXIMUM_CHART_TERMINAL_INDICATOR_COUNT,
        "/chart/indicators/terminal_state_indicators",
        "Visual final indicators",
        diagnostics,
    );
    validateCapacity (
        draft.chart.indicators.terminalStateTransitions.length,
        MAXIMUM_CHART_TERMINAL_RELATION_COUNT,
        "/chart/indicators/terminal_state_transitions",
        "Visual final-indicator relations",
        diagnostics,
    );

    //----------------------------------------------------------------------------------------------
    // Function: validateCoordinate
    //
    // Description:
    //
    //   Validates coordinate.
    //
    // Parameters:
    //
    //   - coordinate:
    //     The coordinate supplied to the operation.
    //
    //   - path:
    //     The path supplied to the operation.
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

    const validateCoordinate = ( coordinate: number, path: string ): void =>
    {
        // Handle the case where the is finite result condition is not satisfied.

        if ( !Number.isFinite ( coordinate ) )
        {
            addDiagnostic (
                diagnostics,
                "CHART_COORDINATE_INVALID",
                "error",
                "chart",
                "Chart coordinates must be finite numbers.",
                "Replace the coordinate with a finite number.",
                path,
            );
        }
    };

    const initialIndicator = draft.chart.indicators.initialStateIndicator;

    draft.chart.draftTransitions.forEach ( ( draftTransition, draftTransitionIndex ) =>
    {
        // Initialize the local values needed by this operation.

        const draftTransitionPath = `/chart/draft_transitions/${draftTransitionIndex}`;

        // Handle the case where at least one branch condition is satisfied.

        if ( !Number.isSafeInteger ( draftTransition.id ) || draftTransition.id < 0 )
        {
            addDiagnostic (
                diagnostics,
                "CHART_DRAFT_TRANSITION_ID_INVALID",
                "error",
                "chart",
                "Chart draft-transition identifiers must be non-negative safe integers.",
                "Choose a non-negative integer identifier.",
                `${draftTransitionPath}/id`,
            );
        }

        // Handle the case where has result is enabled.

        if ( draftTransitionIdentifiers.has ( draftTransition.id ) )
        {
            addDiagnostic (
                diagnostics,
                "CHART_DRAFT_TRANSITION_ID_DUPLICATE",
                "error",
                "chart",
                `Chart draft-transition identifier '${draftTransition.id}' occurs more than once.`,
                "Choose a unique identifier.",
                `${draftTransitionPath}/id`,
                String ( draftTransition.id ),
            );
        }

        draftTransitionIdentifiers.add ( draftTransition.id );
        validateCoordinate ( draftTransition.source.x, `${draftTransitionPath}/source/x` );
        validateCoordinate ( draftTransition.source.y, `${draftTransitionPath}/source/y` );
        validateCoordinate ( draftTransition.target.x, `${draftTransitionPath}/target/x` );
        validateCoordinate ( draftTransition.target.y, `${draftTransitionPath}/target/y` );
    } );

    // Handle the case where initial indicator differs from an absent value.

    if ( initialIndicator !== null )
    {
        validateCoordinate ( initialIndicator.x, "/chart/indicators/initial_state_indicator/x" );
        validateCoordinate ( initialIndicator.y, "/chart/indicators/initial_state_indicator/y" );

        // Handle the case where all required conditions are satisfied.

        if ( initialIndicator.state !== undefined && initialIndicator.state !== null )
        {
            // Handle the case where the has result condition is not satisfied.

            if ( !stateNames.has ( initialIndicator.state ) )
            {
                addDiagnostic (
                    diagnostics,
                    "CHART_INITIAL_INDICATOR_STATE_UNKNOWN",
                    "error",
                    "chart",
                    `The initial indicator references undeclared state '${initialIndicator.state}'.`,
                    "Connect the indicator only to a declared state or leave it orphaned.",
                    "/chart/indicators/initial_state_indicator/state",
                    initialIndicator.state,
                );
            }
            else if ( initialIndicator.state !== draft.stateMachine.initialState )
            {
                addDiagnostic (
                    diagnostics,
                    "CHART_INITIAL_INDICATOR_STATE_MISMATCH",
                    "error",
                    "chart",
                    "The connected initial indicator must reference the semantic initial state.",
                    "Connect the indicator to the selected initial state or leave it orphaned.",
                    "/chart/indicators/initial_state_indicator/state",
                    initialIndicator.state,
                );
            }
        }
    }

    draft.chart.indicators.terminalStateIndicators.forEach ( ( indicator, indicatorIndex ) =>
    {
        // Initialize the local values needed by this operation.

        const indicatorPath = `/chart/indicators/terminal_state_indicators/${indicatorIndex}`;

        // Handle the case where at least one branch condition is satisfied.

        if ( !Number.isSafeInteger ( indicator.id ) || indicator.id < 0 )
        {
            addDiagnostic (
                diagnostics,
                "CHART_INDICATOR_ID_INVALID",
                "error",
                "chart",
                "Visual final-indicator identifiers must be non-negative safe integers.",
                "Choose a non-negative integer identifier.",
                `${indicatorPath}/id`,
            );
        }

        // Handle the case where has result is enabled.

        if ( indicatorIdentifiers.has ( indicator.id ) )
        {
            addDiagnostic (
                diagnostics,
                "CHART_INDICATOR_ID_DUPLICATE",
                "error",
                "chart",
                `Visual final-indicator identifier '${indicator.id}' occurs more than once.`,
                "Choose a unique identifier.",
                `${indicatorPath}/id`,
                String ( indicator.id ),
            );
        }

        indicatorIdentifiers.add ( indicator.id );
        validateCoordinate ( indicator.x, `${indicatorPath}/x` );
        validateCoordinate ( indicator.y, `${indicatorPath}/y` );
    } );

    draft.chart.indicators.terminalStateTransitions.forEach ( ( relation, relationIndex ) =>
    {
        // Initialize the local values needed by this operation.

        const relationPath = `/chart/indicators/terminal_state_transitions/${relationIndex}`;

        // Handle the case where has result is enabled.

        if ( relatedStates.has ( relation.state ) )
        {
            addDiagnostic (
                diagnostics,
                "CHART_TERMINAL_RELATION_DUPLICATE",
                "error",
                "chart",
                `State '${relation.state}' has more than one visual final-indicator relation.`,
                "Keep at most one visual final-indicator relation for the state.",
                `${relationPath}/state`,
                relation.state,
            );
        }

        relatedStates.add ( relation.state );

        // Handle the case where the has result condition is not satisfied.

        if ( !stateNames.has ( relation.state ) )
        {
            addDiagnostic (
                diagnostics,
                "CHART_TERMINAL_RELATION_STATE_UNKNOWN",
                "error",
                "chart",
                `Visual final-indicator relation references undeclared state '${relation.state}'.`,
                "Connect only a declared state.",
                `${relationPath}/state`,
                relation.state,
            );
        }

        // Handle the case where the has result condition is not satisfied.

        if ( !indicatorIdentifiers.has ( relation.terminalStateIndicatorId ) )
        {
            addDiagnostic (
                diagnostics,
                "CHART_TERMINAL_INDICATOR_UNKNOWN",
                "error",
                "chart",
                `Visual final-indicator relation references missing indicator '${relation.terminalStateIndicatorId}'.`,
                "Choose an existing visual final indicator.",
                `${relationPath}/terminal_state_indicator_id`,
                String ( relation.terminalStateIndicatorId ),
            );
        }
    } );

    draft.chart.states.forEach ( ( placement, placementIndex ) =>
    {
        // Initialize the local values needed by this operation.

        const placementPath = `/chart/states/${placementIndex}`;

        // Handle the case where has result is enabled.

        if ( placedStates.has ( placement.state ) )
        {
            addDiagnostic (
                diagnostics,
                "CHART_STATE_PLACEMENT_DUPLICATE",
                "error",
                "chart",
                `State '${placement.state}' has more than one chart placement.`,
                "Keep at most one chart placement for the state.",
                `${placementPath}/state`,
                placement.state,
            );
        }

        placedStates.add ( placement.state );

        // Handle the case where the has result condition is not satisfied.

        if ( !stateNames.has ( placement.state ) )
        {
            addDiagnostic (
                diagnostics,
                "CHART_STATE_UNKNOWN",
                "error",
                "chart",
                `Chart placement references undeclared state '${placement.state}'.`,
                "Choose a declared state or remove the placement.",
                `${placementPath}/state`,
                placement.state,
            );
        }

        validateCoordinate ( placement.x, `${placementPath}/x` );
        validateCoordinate ( placement.y, `${placementPath}/y` );

        const height = placement.height ?? DEFAULT_CHART_STATE_HEIGHT;

        // Handle the case where at least one branch condition is satisfied.

        if ( !Number.isFinite ( height ) || height < MINIMUM_CHART_STATE_DIMENSION ||
            height > MAXIMUM_CHART_STATE_DIMENSION )
        {
            addDiagnostic (
                diagnostics,
                "CHART_STATE_HEIGHT_INVALID",
                "error",
                "chart",
                "Saved expanded-state heights must be finite values from 1 through 4096 CSS pixels.",
                "Choose a height within the supported bounds.",
                `${placementPath}/height`,
                placement.state,
            );
        }
    } );
}

//--------------------------------------------------------------------------------------------------
// Function: validateLibraries
//
// Description:
//
//   Validates libraries.
//
// Parameters:
//
//   - draft:
//     The draft supplied to the operation.
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
//--------------------------------------------------------------------------------------------------

function validateLibraries ( draft: AuthoringDraft, diagnostics: DomainDiagnostic[] ): void
{
    // Initialize the local values needed by this operation.

    const solverSequenceNames    = new Set<string> ();
    const simulatorSequenceNames = new Set<string> ();
    let solverTokenCount         = 0;

    validateCapacity (
        draft.solver.sequences.length,
        MAXIMUM_SOLVER_SEQUENCE_COUNT,
        "/solver/sequences",
        "Solver sequences",
        diagnostics,
    );

    draft.solver.sequences.forEach ( ( solverSequence, sequenceIndex ) =>
    {
        // Initialize the local values needed by this operation.

        const sequencePath = `/solver/sequences/${sequenceIndex}`;

        validateBoundedName ( solverSequence.name, `${sequencePath}/name`, diagnostics );
        validateDescription ( solverSequence.description, `${sequencePath}/description`, diagnostics );

        // Handle the case where has result is enabled.

        if ( solverSequenceNames.has ( solverSequence.name ) )
        {
            addDiagnostic (
                diagnostics,
                "SOLVER_SEQUENCE_NAME_DUPLICATE",
                "error",
                "solver",
                `Solver sequence name '${solverSequence.name}' occurs more than once.`,
                "Rename or remove the duplicate sequence.",
                `${sequencePath}/name`,
                solverSequence.name,
            );
        }

        solverSequenceNames.add ( solverSequence.name );
        solverTokenCount += solverSequence.sequence.length;

        solverSequence.sequence.forEach ( ( rawToken, tokenIndex ) =>
        {
            // Initialize the local values needed by this operation.

            const tokenPath = `${sequencePath}/sequence/${tokenIndex}`;

            // Handle the case where the is solver token text within bounds result condition is not
            // satisfied.

            if ( !isSolverTokenTextWithinBounds ( rawToken ) )
            {
                addDiagnostic (
                    diagnostics,
                    "SOLVER_TOKEN_TOO_LONG",
                    "error",
                    "solver",
                    `Saved Solver tokens may contain at most ${MAXIMUM_SOLVER_TOKEN_CODE_POINT_COUNT} Unicode code points.`,
                    "Shorten the token while preserving its Event, State, or Action classifier.",
                    tokenPath,
                );

                // Return control to the caller.

                return;
            }

            // Handle the case where at least one branch condition is satisfied.

            if ( rawToken !== rawToken.trim () || rawToken.length === 0 )
            {
                addDiagnostic (
                    diagnostics,
                    "SOLVER_TOKEN_NOT_TRIMMED",
                    "error",
                    "solver",
                    "Saved Solver tokens must be non-empty trimmed strings.",
                    "Trim the token or remove the blank line.",
                    tokenPath,
                );
            }

            const canonicalToken = canonicalizeSolverNamedToken ( rawToken );

            // Handle the case where canonical token matches an absent value.

            if ( canonicalToken === null )
            {
                addDiagnostic (
                    diagnostics,
                    "SOLVER_TOKEN_INVALID",
                    "error",
                    "solver",
                    `Solver token '${rawToken}' does not use a supported Event, State, or Action classifier.`,
                    "Use an underscore, hyphen, space, or compact title-case classifier.",
                    tokenPath,
                    rawToken,
                );
            }
            else if ( codePointCount ( canonicalToken.name ) > MAXIMUM_NAME_CODE_POINT_COUNT )
            {
                addDiagnostic (
                    diagnostics,
                    "SOLVER_TOKEN_TOO_LONG",
                    "error",
                    "solver",
                    `Saved Solver tokens must canonicalize to names of at most ${MAXIMUM_NAME_CODE_POINT_COUNT} Unicode code points.`,
                    "Shorten the token suffix.",
                    tokenPath,
                );
            }
        } );

    } );

    validateCapacity (
        solverTokenCount,
        MAXIMUM_SOLVER_TOKEN_COUNT,
        "/solver/sequences",
        "Solver tokens",
        diagnostics,
    );

    validateCapacity (
        draft.simulator.sequences.length,
        MAXIMUM_SIMULATOR_SEQUENCE_COUNT,
        "/simulator/sequences",
        "Simulator sequences",
        diagnostics,
    );

    draft.simulator.sequences.forEach ( ( simulatorSequence, sequenceIndex ) =>
    {
        // Initialize the local values needed by this operation.

        const sequencePath = `/simulator/sequences/${sequenceIndex}`;

        validateBoundedName ( simulatorSequence.name, `${sequencePath}/name`, diagnostics );
        validateDescription ( simulatorSequence.description, `${sequencePath}/description`, diagnostics );

        // Handle the case where has result is enabled.

        if ( simulatorSequenceNames.has ( simulatorSequence.name ) )
        {
            addDiagnostic (
                diagnostics,
                "SIMULATOR_SEQUENCE_NAME_DUPLICATE",
                "error",
                "simulator",
                `Simulator sequence name '${simulatorSequence.name}' occurs more than once.`,
                "Rename or remove the duplicate sequence.",
                `${sequencePath}/name`,
                simulatorSequence.name,
            );
        }

        simulatorSequenceNames.add ( simulatorSequence.name );
        validateCapacity (
            simulatorSequence.sequence.length,
            MAXIMUM_EVENT_BUFFER_COUNT,
            `${sequencePath}/sequence`,
            "Simulator sequence events",
            diagnostics,
        );
        simulatorSequence.sequence.forEach ( ( eventName, eventIndex ) =>
        {
            validateBoundedName ( eventName, `${sequencePath}/sequence/${eventIndex}`, diagnostics );
        } );
    } );
}

//--------------------------------------------------------------------------------------------------
// Function: validateAuthoringDraft
//
// Description:
//
//   Validates authoring draft.
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

export function validateAuthoringDraft ( draft: AuthoringDraft ): DocumentValidationResult
{
    // Initialize the local values needed by this operation.

    const diagnostics: DomainDiagnostic[] = [];

    validateBoundedName ( draft.settings.name, "/settings/name", diagnostics );
    validateDescription ( draft.settings.description, "/settings/description", diagnostics );

    // Handle the case where the is semantic version result condition is not satisfied.

    if ( !isSemanticVersion ( draft.settings.version ) )
    {
        addDiagnostic (
            diagnostics,
            "MODEL_VERSION_INVALID",
            "error",
            "model",
            `Model version '${draft.settings.version}' is not a Semantic Versioning value.`,
            "Use a version such as 1.0.0.",
            "/settings/version",
        );
    }

    validateStateMachine ( draft, diagnostics );
    validateChart ( draft, diagnostics );
    validateLibraries ( draft, diagnostics );

    const sortedDiagnostics = sortDiagnostics ( diagnostics );

    // Handle the case where at least one branch condition is satisfied.

    if ( sortedDiagnostics.some ( ( diagnostic ) => diagnostic.severity === "error" ) ||
         draft.stateMachine.initialState === null )
    {
        // Return the assembled result.

        return { isValid: false, diagnostics: sortedDiagnostics };
    }

    const document: AutomataDocument =
    {
        ...draft,
        stateMachine:
        {
            ...draft.stateMachine,
            initialState: draft.stateMachine.initialState,
        },
    };

    // Return the assembled result.

    return { isValid: true, document, diagnostics: sortedDiagnostics };
}

//--------------------------------------------------------------------------------------------------
// Function: validatePersistableAuthoringDraft
//
// Description:
//
//   Validates persistable authoring draft.
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

export function validatePersistableAuthoringDraft (
    draft: AuthoringDraft,
): PersistableAuthoringDraftValidationResult
{
    // Initialize the local values needed by this operation.

    const validation  = validateAuthoringDraft ( draft );
    const diagnostics = sortDiagnostics ( validation.diagnostics.map ( diagnostic =>
    {
        // Dispatch according to the diagnostic code value.

        switch ( diagnostic.code )
        {
            // Handle the "INITIAL_STATE_REQUIRED" case.

            case "INITIAL_STATE_REQUIRED":

                // Return the assembled result.

                return {
                    ...diagnostic,
                    code:        "INITIAL_STATE_UNDEFINED",
                    message:     "The state machine does not define an initial state.",
                    remediation: "Select an initial state before hosting or running the model.",
                    severity:    "warning" as const,
                };

            // Handle the "STATE_REQUIRED" case.

            case "STATE_REQUIRED":

                // Return the assembled result.

                return {
                    ...diagnostic,
                    code:        "STATE_DEFINITIONS_MISSING",
                    message:     "The state machine does not define any states.",
                    remediation: "Add at least one state before hosting or running the model.",
                    severity:    "warning" as const,
                };

            // Handle values not matched by an earlier case.

            default:

                // Return the diagnostic.

                return diagnostic;
        }
    } ) );

    // Handle the case where some result is enabled.

    if ( diagnostics.some ( diagnostic => diagnostic.severity === "error" ) )
    {
        // Return the assembled result.

        return { isValid: false, diagnostics };
    }

    // Return the assembled result.

    return { isValid: true, document: draft, diagnostics };
}

//--------------------------------------------------------------------------------------------------
// Function: summarizeAuthoringDraftValidation
//
// Description:
//
//   Derives the summarize authoring draft validation.
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

export function summarizeAuthoringDraftValidation ( draft: AuthoringDraft ): DocumentValidationSummary
{
    // Initialize the local values needed by this operation.

    const result = validateAuthoringDraft ( draft );

    // Return the assembled result.

    return {
        isValid:      result.isValid,
        errorCount:   result.diagnostics.filter ( ( diagnostic ) => diagnostic.severity === "error" ).length,
        warningCount: result.diagnostics.filter ( ( diagnostic ) => diagnostic.severity === "warning" ).length,
        diagnostics:  result.diagnostics,
    };
}
