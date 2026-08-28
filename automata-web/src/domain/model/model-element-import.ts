// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Model Element Import
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Validates and atomically merges normalized external model-element rows into an authoring draft.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type
{
    AuthoringDraft,
    NamedEntity,
    StateActionMapping,
    TransitionDefinition,
} from "./contracts.js";
import type { DomainDiagnostic } from "./diagnostics.js";
import
{
    MAXIMUM_ACTION_COUNT,
    MAXIMUM_DESCRIPTION_CODE_POINTS,
    MAXIMUM_ENTRY_ACTION_COUNT,
    MAXIMUM_EVENT_COUNT,
    MAXIMUM_EXIT_ACTION_COUNT,
    MAXIMUM_NAME_CODE_POINT_COUNT,
    MAXIMUM_STATE_COUNT,
    MAXIMUM_TRANSITION_COUNT,
} from "./limits.js";
import { isSemanticVersion } from "./validation.js";

//--------------------------------------------------------------------------------------------------
// Type: ModelEntityImportKind
//
// Description:
//
//   Defines the supported model entity import kind alternatives.
//
//--------------------------------------------------------------------------------------------------

export type ModelEntityImportKind = "action" | "event" | "state";

//--------------------------------------------------------------------------------------------------
// Type: StateActionSchedule
//
// Description:
//
//   Defines the supported state action schedule alternatives.
//
//--------------------------------------------------------------------------------------------------

export type StateActionSchedule = "entry" | "exit";

//--------------------------------------------------------------------------------------------------
// Interface: ModelImportRow
//
// Description:
//
//   Defines the structure of model import row.
//
//--------------------------------------------------------------------------------------------------

export interface ModelImportRow<Value>
{
    readonly rowNumber: number;
    readonly value:     Value;
}

//--------------------------------------------------------------------------------------------------
// Interface: ModelMetadataImportValue
//
// Description:
//
//   Defines the structure of model metadata import value.
//
//--------------------------------------------------------------------------------------------------

export interface ModelMetadataImportValue
{
    readonly name:         string;
    readonly description:  string;
    readonly version:      string;
    readonly initialState: string | null;
}

//--------------------------------------------------------------------------------------------------
// Type: ModelElementImport
//
// Description:
//
//   Defines the supported model element import alternatives.
//
//--------------------------------------------------------------------------------------------------

export type ModelElementImport =
    | {
        readonly kind: "model_metadata";
        readonly rows: readonly ModelImportRow<ModelMetadataImportValue>[];
    }
    | {
        readonly kind:       "named_entities";
        readonly entityKind: ModelEntityImportKind;
        readonly rows:       readonly ModelImportRow<NamedEntity>[];
    }
    | {
        readonly kind: "state_actions";
        readonly rows: readonly ModelImportRow<StateActionMapping & { readonly schedule: StateActionSchedule }>[];
    }
    | {
        readonly kind: "transitions";
        readonly rows: readonly ModelImportRow<TransitionDefinition>[];
    };

//--------------------------------------------------------------------------------------------------
// Interface: ModelElementImportConflict
//
// Description:
//
//   Defines the structure of model element import conflict.
//
//--------------------------------------------------------------------------------------------------

export interface ModelElementImportConflict
{
    readonly key: string;
}

//--------------------------------------------------------------------------------------------------
// Type: ModelElementImportInspection
//
// Description:
//
//   Defines the supported model element import inspection alternatives.
//
//--------------------------------------------------------------------------------------------------

export type ModelElementImportInspection =
    | {
        readonly isSuccessful: false;
        readonly diagnostics:  readonly DomainDiagnostic[];
        readonly missingReferences?: {
            readonly states: readonly string[];
            readonly events: readonly string[];
        };
    }
    | {
        readonly isSuccessful:  true;
        readonly conflicts:     readonly ModelElementImportConflict[];
        readonly resultingDraft: AuthoringDraft;
    };

//--------------------------------------------------------------------------------------------------
// Function: createImportDiagnostic
//
// Description:
//
//   Creates import diagnostic.
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
//   - rowNumber:
//     The row number supplied to the operation.
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

function createImportDiagnostic (
    code: string,
    message: string,
    remediation: string,
    rowNumber?: number,
): DomainDiagnostic
{
    // Return the assembled result.

    return {
        code,
        message,
        remediation,
        severity: "error",
        source:   "CSV import",
        ...( rowNumber === undefined ? {} : { path: `/csv/rows/${rowNumber}` } ),
    };
}

//--------------------------------------------------------------------------------------------------
// Function: validName
//
// Description:
//
//   Derives the valid name.
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

function validName ( name: string ): boolean
{
    // Return the computed result.

    return name.length > 0 && name === name.trim () && [ ...name ].length <= MAXIMUM_NAME_CODE_POINT_COUNT;
}

//--------------------------------------------------------------------------------------------------
// Function: declarationsFor
//
// Description:
//
//   Derives the declarations for.
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

function declarationsFor (
    draft: AuthoringDraft,
    entityKind: ModelEntityImportKind,
): readonly NamedEntity[]
{
    // Handle the case where entity kind matches the state value.

    if ( entityKind === "state" )
    {
        // Return the computed result.

        return draft.stateMachine.states;
    }

    // Handle the case where entity kind matches the event value.

    if ( entityKind === "event" )
    {
        // Return the computed result.

        return draft.stateMachine.events;
    }

    // Return the computed result.

    return draft.stateMachine.actions;
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
    entityKind: ModelEntityImportKind,
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
// Function: entityCapacity
//
// Description:
//
//   Derives the entity capacity.
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

function entityCapacity ( entityKind: ModelEntityImportKind ): number
{
    // Handle the case where entity kind matches the state value.

    if ( entityKind === "state" )
    {
        // Return the maximum state count.

        return MAXIMUM_STATE_COUNT;
    }

    // Handle the case where entity kind matches the event value.

    if ( entityKind === "event" )
    {
        // Return the maximum event count.

        return MAXIMUM_EVENT_COUNT;
    }

    // Return the maximum action count.

    return MAXIMUM_ACTION_COUNT;
}

//--------------------------------------------------------------------------------------------------
// Function: inspectNamedEntityImport
//
// Description:
//
//   Inspects the named entity import.
//
// Parameters:
//
//   - draft:
//     The draft supplied to the operation.
//
//   - modelImport:
//     The model import supplied to the operation.
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

function inspectNamedEntityImport (
    draft: AuthoringDraft,
    modelImport: Extract<ModelElementImport, { readonly kind: "named_entities" }>,
): ModelElementImportInspection
{
    // Initialize the local values needed by this operation.

    const diagnostics: DomainDiagnostic[] = [];
    const importedNames                   = new Set<string> ();

    modelImport.rows.forEach ( row =>
    {
        // Handle the case where the valid name result condition is not satisfied.

        if ( !validName ( row.value.name ) )
        {
            diagnostics.push ( createImportDiagnostic (
                "CSV_NAME_INVALID",
                `Row ${row.rowNumber} has an invalid ${modelImport.entityKind} name '${row.value.name}'.`,
                `Use a trimmed name containing 1 to ${MAXIMUM_NAME_CODE_POINT_COUNT} Unicode characters.`,
                row.rowNumber,
            ) );
        }

        // Handle the case where length exceeds maximum description code points.

        if ( [ ...row.value.description ].length > MAXIMUM_DESCRIPTION_CODE_POINTS )
        {
            diagnostics.push ( createImportDiagnostic (
                "CSV_DESCRIPTION_INVALID",
                `Row ${row.rowNumber} has a description longer than ${MAXIMUM_DESCRIPTION_CODE_POINTS} characters.`,
                "Shorten the description and import the file again.",
                row.rowNumber,
            ) );
        }

        // Handle the case where has result is enabled.

        if ( importedNames.has ( row.value.name ) )
        {
            diagnostics.push ( createImportDiagnostic (
                "CSV_DUPLICATE_KEY",
                `The ${modelImport.entityKind} name '${row.value.name}' occurs more than once in the CSV file.`,
                "Keep one row for each imported name.",
                row.rowNumber,
            ) );
        }

        importedNames.add ( row.value.name );
    } );

    // Handle the case where diagnostics length exceeds the 0 value.

    if ( diagnostics.length > 0 )
    {
        // Return the assembled result.

        return { isSuccessful: false, diagnostics };
    }

    // Initialize the local values needed by this operation.

    const declarations  = declarationsFor ( draft, modelImport.entityKind );
    const existingNames = new Set ( declarations.map ( declaration => declaration.name ) );
    const conflicts     = modelImport.rows
        .filter ( row => existingNames.has ( row.value.name ) )
        .map ( row => ( { key: row.value.name } ) );
    const importedByName     = new Map ( modelImport.rows.map ( row => [ row.value.name, row.value ] ) );
    const mergedDeclarations = [
        ...declarations.map ( declaration => importedByName.get ( declaration.name ) ?? declaration ),
        ...modelImport.rows.filter ( row => !existingNames.has ( row.value.name ) ).map ( row => row.value ),
    ];
    const maximumCount = entityCapacity ( modelImport.entityKind );

    // Handle the case where merged declarations length exceeds maximum count.

    if ( mergedDeclarations.length > maximumCount )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            diagnostics:
            [
                createImportDiagnostic (
                    "CSV_CAPACITY_EXCEEDED",
                    `The import would create ${mergedDeclarations.length} ${modelImport.entityKind} declarations; the maximum is ${maximumCount}.`,
                    "Reduce the number of imported rows.",
                ),
            ],
        };
    }

    // Return the assembled result.

    return {
        isSuccessful: true,
        conflicts,
        resultingDraft: replaceDeclarations ( draft, modelImport.entityKind, mergedDeclarations ),
    };
}

//--------------------------------------------------------------------------------------------------
// Function: inspectModelMetadataImport
//
// Description:
//
//   Inspects the model metadata import.
//
// Parameters:
//
//   - draft:
//     The draft supplied to the operation.
//
//   - modelImport:
//     The model import supplied to the operation.
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

function inspectModelMetadataImport (
    draft: AuthoringDraft,
    modelImport: Extract<ModelElementImport, { readonly kind: "model_metadata" }>,
): ModelElementImportInspection
{
    // Initialize the local values needed by this operation.

    const row = modelImport.rows [ 0 ];

    // Handle the case where row matches undefined.

    if ( row === undefined )
    {
        // Return the assembled result.

        return { isSuccessful: true, conflicts: [], resultingDraft: draft };
    }

    const diagnostics: DomainDiagnostic[] = [];

    // Handle the case where the valid name result condition is not satisfied.

    if ( !validName ( row.value.name ) )
    {
        diagnostics.push ( createImportDiagnostic (
            "CSV_NAME_INVALID",
            `Row ${row.rowNumber} has an invalid model name '${row.value.name}'.`,
            `Use a trimmed name containing 1 to ${MAXIMUM_NAME_CODE_POINT_COUNT} Unicode characters.`,
            row.rowNumber,
        ) );
    }

    // Handle the case where length exceeds maximum description code points.

    if ( [ ...row.value.description ].length > MAXIMUM_DESCRIPTION_CODE_POINTS )
    {
        diagnostics.push ( createImportDiagnostic (
            "CSV_DESCRIPTION_INVALID",
            `Row ${row.rowNumber} has a description longer than ${MAXIMUM_DESCRIPTION_CODE_POINTS} characters.`,
            "Shorten the description and import the file again.",
            row.rowNumber,
        ) );
    }

    // Handle the case where the is semantic version result condition is not satisfied.

    if ( !isSemanticVersion ( row.value.version ) )
    {
        diagnostics.push ( createImportDiagnostic (
            "CSV_MODEL_VERSION_INVALID",
            `Row ${row.rowNumber} has invalid model version '${row.value.version}'.`,
            "Use a Semantic Versioning value such as 1.0.0.",
            row.rowNumber,
        ) );
    }

    const declaredStates = new Set ( draft.stateMachine.states.map ( state => state.name ) );

    // Handle the case where all required conditions are satisfied.

    if ( row.value.initialState !== null && !declaredStates.has ( row.value.initialState ) )
    {
        diagnostics.push ( createImportDiagnostic (
            "CSV_REFERENCE_INVALID",
            `Row ${row.rowNumber} references undeclared initial state '${row.value.initialState}'.`,
            "Declare the state before importing it as the initial state, or leave initial_state blank.",
            row.rowNumber,
        ) );
    }

    // Handle the case where diagnostics length exceeds the 0 value.

    if ( diagnostics.length > 0 )
    {
        // Return the assembled result.

        return { isSuccessful: false, diagnostics };
    }

    const initialStateIndicator = draft.chart.indicators.initialStateIndicator;

    // Return the assembled result.

    return {
        isSuccessful: true,
        conflicts:    [],
        resultingDraft:
        {
            ...draft,
            settings:
            {
                name:        row.value.name,
                description: row.value.description,
                version:     row.value.version,
            },
            stateMachine: { ...draft.stateMachine, initialState: row.value.initialState },
            chart:
            {
                ...draft.chart,
                indicators:
                {
                    ...draft.chart.indicators,
                    initialStateIndicator: initialStateIndicator === null ||
                        initialStateIndicator.state === undefined || initialStateIndicator.state === null
                        ? initialStateIndicator
                        : { ...initialStateIndicator, state: row.value.initialState },
                },
            },
        },
    };
}

//--------------------------------------------------------------------------------------------------
// Function: inspectStateActionImport
//
// Description:
//
//   Inspects the state action import.
//
// Parameters:
//
//   - draft:
//     The draft supplied to the operation.
//
//   - modelImport:
//     The model import supplied to the operation.
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

function inspectStateActionImport (
    draft: AuthoringDraft,
    modelImport: Extract<ModelElementImport, { readonly kind: "state_actions" }>,
): ModelElementImportInspection
{
    // Initialize the local values needed by this operation.

    const diagnostics: DomainDiagnostic[] = [];
    const declaredStates                  = new Set ( draft.stateMachine.states.map ( state => state.name ) );
    const declaredActions                 = new Set ( draft.stateMachine.actions.map ( action => action.name ) );

    modelImport.rows.forEach ( row =>
    {
        // Handle the case where all required conditions are satisfied.

        if ( row.value.schedule !== "entry" && row.value.schedule !== "exit" )
        {
            diagnostics.push ( createImportDiagnostic (
                "CSV_SCHEDULE_INVALID",
                `Row ${row.rowNumber} has unsupported schedule '${String ( row.value.schedule )}'.`,
                "Use 'entry' or 'exit'.",
                row.rowNumber,
            ) );
        }

        // Handle the case where the has result condition is not satisfied.

        if ( !declaredStates.has ( row.value.state ) )
        {
            diagnostics.push ( createImportDiagnostic (
                "CSV_REFERENCE_INVALID",
                `Row ${row.rowNumber} references undeclared state '${row.value.state}'.`,
                "Declare the state before importing the state-action relationship.",
                row.rowNumber,
            ) );
        }

        // Handle the case where the has result condition is not satisfied.

        if ( !declaredActions.has ( row.value.action ) )
        {
            diagnostics.push ( createImportDiagnostic (
                "CSV_REFERENCE_INVALID",
                `Row ${row.rowNumber} references undeclared action '${row.value.action}'.`,
                "Declare the action before importing the state-action relationship.",
                row.rowNumber,
            ) );
        }
    } );

    // Handle the case where diagnostics length exceeds the 0 value.

    if ( diagnostics.length > 0 )
    {
        // Return the assembled result.

        return { isSuccessful: false, diagnostics };
    }

    // Initialize the local values needed by this operation.

    const entryRows = modelImport.rows.filter ( row => row.value.schedule === "entry" );
    const exitRows  = modelImport.rows.filter ( row => row.value.schedule === "exit" );
    const entry     = [
        ...draft.stateMachine.stateActions.entry,
        ...entryRows.map ( row => ( { state: row.value.state, action: row.value.action } ) ),
    ];
    const exit = [
        ...draft.stateMachine.stateActions.exit,
        ...exitRows.map ( row => ( { state: row.value.state, action: row.value.action } ) ),
    ];

    // Handle the case where at least one branch condition is satisfied.

    if ( entry.length > MAXIMUM_ENTRY_ACTION_COUNT || exit.length > MAXIMUM_EXIT_ACTION_COUNT )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            diagnostics:
            [
                createImportDiagnostic (
                    "CSV_CAPACITY_EXCEEDED",
                    "The import would exceed the entry- or exit-action assignment capacity.",
                    "Reduce the number of imported state-action rows.",
                ),
            ],
        };
    }

    // Return the assembled result.

    return {
        isSuccessful: true,
        conflicts:    [],
        resultingDraft:
        {
            ...draft,
            stateMachine:
            {
                ...draft.stateMachine,
                stateActions: { entry, exit },
            },
        },
    };
}

//--------------------------------------------------------------------------------------------------
// Function: transitionKey
//
// Description:
//
//   Derives the transition key.
//
// Parameters:
//
//   - transition:
//     The transition supplied to the operation.
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

function transitionKey ( transition: TransitionDefinition ): string
{
    // Return the stringify result.

    return JSON.stringify ( [ transition.state, transition.event ] );
}

//--------------------------------------------------------------------------------------------------
// Function: inspectTransitionImport
//
// Description:
//
//   Inspects the transition import.
//
// Parameters:
//
//   - draft:
//     The draft supplied to the operation.
//
//   - modelImport:
//     The model import supplied to the operation.
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

function inspectTransitionImport (
    draft: AuthoringDraft,
    modelImport: Extract<ModelElementImport, { readonly kind: "transitions" }>,
): ModelElementImportInspection
{
    // Initialize the local values needed by this operation.

    const diagnostics: DomainDiagnostic[] = [];
    const importedKeys                    = new Set<string> ();
    const declaredStates                  = new Set ( draft.stateMachine.states.map ( state => state.name ) );
    const declaredEvents                  = new Set ( draft.stateMachine.events.map ( event => event.name ) );
    const missingStates: string[]         = [];
    const missingEvents: string[]         = [];
    const missingStateSet                 = new Set<string> ();
    const missingEventSet                 = new Set<string> ();

    //----------------------------------------------------------------------------------------------
    // Function: addMissingReference
    //
    // Description:
    //
    //   Adds the missing reference.
    //
    // Parameters:
    //
    //   - value:
    //     The value supplied to the operation.
    //
    //   - declarations:
    //     The declarations supplied to the operation.
    //
    //   - seenValues:
    //     The seen values supplied to the operation.
    //
    //   - values:
    //     The values supplied to the operation.
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

    function addMissingReference (
        value: string,
        declarations: ReadonlySet<string>,
        seenValues: Set<string>,
        values: string[],
    ): void
    {
        // Handle the case where all required conditions are satisfied.

        if ( !declarations.has ( value ) && !seenValues.has ( value ) )
        {
            seenValues.add ( value );
            values.push ( value );
        }
    }

    modelImport.rows.forEach ( row =>
    {
        // Initialize the local values needed by this operation.

        const key = transitionKey ( row.value );

        addMissingReference ( row.value.state, declaredStates, missingStateSet, missingStates );
        addMissingReference ( row.value.stateNext, declaredStates, missingStateSet, missingStates );
        addMissingReference ( row.value.event, declaredEvents, missingEventSet, missingEvents );

        // Initialize the local values needed by this operation.

        const rowMissingStates = [ row.value.state, row.value.stateNext ].filter (
            ( value, index, values ) => !declaredStates.has ( value ) && values.indexOf ( value ) === index,
        );
        const rowMissingEvents = declaredEvents.has ( row.value.event ) ? [] : [ row.value.event ];

        // Handle the case where at least one branch condition is satisfied.

        if ( rowMissingStates.length > 0 || rowMissingEvents.length > 0 )
        {
            // Initialize the local values needed by this operation.

            const missingReferenceDescriptions = [
                ...( rowMissingStates.length === 0
                    ? []
                    : [ `state${rowMissingStates.length === 1 ? "" : "s"} ${rowMissingStates.map (
                        value => `'${value}'`,
                    ).join ( ", " )}` ] ),
                ...( rowMissingEvents.length === 0 ? [] : [ `event '${row.value.event}'` ] ),
            ];

            diagnostics.push ( createImportDiagnostic (
                "CSV_REFERENCE_INVALID",
                `Row ${row.rowNumber} references undeclared ${missingReferenceDescriptions.join ( " and " )}.`,
                "Declare every referenced state and event before importing transitions.",
                row.rowNumber,
            ) );
        }

        // Handle the case where has result is enabled.

        if ( importedKeys.has ( key ) )
        {
            diagnostics.push ( createImportDiagnostic (
                "CSV_DUPLICATE_KEY",
                `Transition key ('${row.value.state}', '${row.value.event}') occurs more than once in the CSV file.`,
                "Keep one row for each state and event pair.",
                row.rowNumber,
            ) );
        }

        importedKeys.add ( key );
    } );

    // Handle the case where diagnostics length exceeds the 0 value.

    if ( diagnostics.length > 0 )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            diagnostics,
            ...( missingStates.length === 0 && missingEvents.length === 0
                ? {}
                : { missingReferences: { states: missingStates, events: missingEvents } } ),
        };
    }

    // Initialize the local values needed by this operation.

    const existingKeys = new Set ( draft.stateMachine.transitionTable.map ( transitionKey ) );
    const conflicts    = modelImport.rows
        .filter ( row => existingKeys.has ( transitionKey ( row.value ) ) )
        .map ( row => ( { key: `${row.value.state} + ${row.value.event}` } ) );
    const importedByKey   = new Map ( modelImport.rows.map ( row => [ transitionKey ( row.value ), row.value ] ) );
    const transitionTable = [
        ...draft.stateMachine.transitionTable.map ( transition => importedByKey.get ( transitionKey ( transition ) ) ?? transition ),
        ...modelImport.rows.filter ( row => !existingKeys.has ( transitionKey ( row.value ) ) ).map ( row => row.value ),
    ];

    // Handle the case where transition table length exceeds maximum transition count.

    if ( transitionTable.length > MAXIMUM_TRANSITION_COUNT )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            diagnostics:
            [
                createImportDiagnostic (
                    "CSV_CAPACITY_EXCEEDED",
                    `The import would create ${transitionTable.length} transitions; the maximum is ${MAXIMUM_TRANSITION_COUNT}.`,
                    "Reduce the number of imported transition rows.",
                ),
            ],
        };
    }

    // Return the assembled result.

    return {
        isSuccessful: true,
        conflicts,
        resultingDraft:
        {
            ...draft,
            stateMachine: { ...draft.stateMachine, transitionTable },
        },
    };
}

//--------------------------------------------------------------------------------------------------
// Function: inspectModelElementImport
//
// Description:
//
//   Inspects the model element import.
//
// Parameters:
//
//   - draft:
//     The draft supplied to the operation.
//
//   - modelImport:
//     The model import supplied to the operation.
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

export function inspectModelElementImport (
    draft: AuthoringDraft,
    modelImport: ModelElementImport,
): ModelElementImportInspection
{
    // Dispatch according to the model import kind value.

    switch ( modelImport.kind )
    {
        // Handle the "model_metadata" case.

        case "model_metadata":

            // Return the inspect model metadata import result.

            return inspectModelMetadataImport ( draft, modelImport );

        // Handle the "named_entities" case.

        case "named_entities":

            // Return the inspect named entity import result.

            return inspectNamedEntityImport ( draft, modelImport );

        // Handle the "state_actions" case.

        case "state_actions":

            // Return the inspect state action import result.

            return inspectStateActionImport ( draft, modelImport );

        // Handle the "transitions" case.

        case "transitions":

            // Return the inspect transition import result.

            return inspectTransitionImport ( draft, modelImport );
    }
}
