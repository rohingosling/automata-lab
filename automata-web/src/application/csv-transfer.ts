// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    CSV Model-Element Transfer
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Parses and serializes the bounded CSV projections used by model-element import and export
//   commands.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { AuthoringDraft, SimulatorSequence, SolverSequence } from "../domain/model/contracts.js";
import type { DomainDiagnostic } from "../domain/model/diagnostics.js";
import { MAXIMUM_EVENT_BUFFER_COUNT, MAXIMUM_NAME_CODE_POINT_COUNT } from "../domain/model/limits.js";
import { canonicalizeSolverNamedToken } from "../domain/model/solver-token.js";
import { parseSolverObservation } from "../domain/solver/parser.js";
import type
{
    ModelElementImport,
    ModelImportRow,
    ModelMetadataImportValue,
    StateActionSchedule,
} from "../domain/model/model-element-import.js";

export const CSV_TRANSFER_KINDS =
[
    "model_metadata",
    "states",
    "events",
    "actions",
    "state_actions",
    "transition_table",
] as const;

//--------------------------------------------------------------------------------------------------
// Type: CsvTransferKind
//
// Description:
//
//   Defines the CSV transfer kind type.
//
//--------------------------------------------------------------------------------------------------

export type CsvTransferKind = typeof CSV_TRANSFER_KINDS[number];

//--------------------------------------------------------------------------------------------------
// Type: CsvImportPreparationResult
//
// Description:
//
//   Describes the result produced by CSV import preparation.
//
//--------------------------------------------------------------------------------------------------

export type CsvImportPreparationResult =
    | {
        readonly isSuccessful: false;
        readonly diagnostics:  readonly DomainDiagnostic[];
    }
    | {
        readonly isSuccessful: true;
        readonly modelImport:  ModelElementImport;
        readonly rowCount:     number;
        readonly warnings?:    readonly DomainDiagnostic[];
    };

//--------------------------------------------------------------------------------------------------
// Interface: CsvExportDocument
//
// Description:
//
//   Defines the structure of CSV export document.
//
//--------------------------------------------------------------------------------------------------

export interface CsvExportDocument
{
    readonly rowCount:      number;
    readonly suggestedName: string;
    readonly text:          string;
}

//--------------------------------------------------------------------------------------------------
// Type: SolverSequenceCsvImportResult
//
// Description:
//
//   Describes the result produced by solver sequence CSV import.
//
//--------------------------------------------------------------------------------------------------

export type SolverSequenceCsvImportResult =
    | { readonly isSuccessful: false; readonly diagnostics: readonly DomainDiagnostic[] }
    | { readonly isSuccessful: true; readonly rowCount: number; readonly tokens: readonly string[] };

//--------------------------------------------------------------------------------------------------
// Type: SolverSequenceCsvExportResult
//
// Description:
//
//   Describes the result produced by solver sequence CSV export.
//
//--------------------------------------------------------------------------------------------------

export type SolverSequenceCsvExportResult =
    | { readonly isSuccessful: false; readonly diagnostics: readonly DomainDiagnostic[] }
    | { readonly isSuccessful: true; readonly document: CsvExportDocument };

//--------------------------------------------------------------------------------------------------
// Type: SimulatorSequenceCsvImportResult
//
// Description:
//
//   Describes the result produced by simulator sequence CSV import.
//
//--------------------------------------------------------------------------------------------------

export type SimulatorSequenceCsvImportResult =
    | { readonly isSuccessful: false; readonly diagnostics: readonly DomainDiagnostic[] }
    | { readonly isSuccessful: true; readonly events: readonly string[]; readonly rowCount: number };

//--------------------------------------------------------------------------------------------------
// Type: SimulatorSequenceCsvExportResult
//
// Description:
//
//   Describes the result produced by simulator sequence CSV export.
//
//--------------------------------------------------------------------------------------------------

export type SimulatorSequenceCsvExportResult =
    | { readonly isSuccessful: false; readonly diagnostics: readonly DomainDiagnostic[] }
    | { readonly isSuccessful: true; readonly document: CsvExportDocument };

//--------------------------------------------------------------------------------------------------
// Type: CsvParseResult
//
// Description:
//
//   Describes the result produced by CSV parse.
//
//--------------------------------------------------------------------------------------------------

type CsvParseResult =
    | { readonly isSuccessful: false; readonly diagnostic: DomainDiagnostic }
    | { readonly isSuccessful: true; readonly rows: readonly ( readonly string[] )[] };

//--------------------------------------------------------------------------------------------------
// Function: createCsvDiagnostic
//
// Description:
//
//   Creates CSV diagnostic.
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

function createCsvDiagnostic (
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
// Function: parseCsv
//
// Description:
//
//   Parses CSV.
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

function parseCsv ( text: string ): CsvParseResult
{
    // Initialize the local values needed by this operation.

    const rows: string[][]   = [];
    let currentField         = "";
    let currentRow: string[] = [];
    let insideQuotedField    = false;
    let quotedFieldClosed    = false;

    //----------------------------------------------------------------------------------------------
    // Function: finishField
    //
    // Description:
    //
    //   Finalizes the field.
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

    function finishField (): void
    {
        currentRow.push ( currentField );
        currentField      = "";
        quotedFieldClosed = false;
    }

    //----------------------------------------------------------------------------------------------
    // Function: finishRow
    //
    // Description:
    //
    //   Finalizes the row.
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

    function finishRow (): void
    {
        finishField ();
        rows.push ( currentRow );
        currentRow = [];
    }

    // Repeat the operation across the bounded iteration range.

    for ( let index = 0; index < text.length; index++ )
    {
        // Initialize the local values needed by this operation.

        const character = text [ index ];

        // Handle the case where inside quoted field is enabled.

        if ( insideQuotedField )
        {
            // Handle the case where all required conditions are satisfied.

            if ( character === "\"" && text [ index + 1 ] === "\"" )
            {
                currentField += "\"";
                index++;
            }
            else if ( character === "\"" )
            {
                insideQuotedField = false;
                quotedFieldClosed = true;
            }
            else if ( character === "\r" && text [ index + 1 ] === "\n" )
            {
                currentField += "\n";
                index++;
            }
            else
            {
                currentField += character;
            }

            continue;
        }

        // Handle the case where all required conditions are satisfied.

        if ( quotedFieldClosed && character !== "," && character !== "\r" && character !== "\n" )
        {
            // Return the assembled result.

            return {
                isSuccessful: false,
                diagnostic: createCsvDiagnostic (
                    "CSV_SYNTAX_INVALID",
                    "A quoted CSV field contains characters after its closing quote.",
                    "Place the closing quote immediately before a comma or line ending.",
                    rows.length + 1,
                ),
            };
        }

        // Handle the case where character matches the " value.

        if ( character === "\"" )
        {
            // Handle the case where current field length differs from the 0 value.

            if ( currentField.length !== 0 )
            {
                // Return the assembled result.

                return {
                    isSuccessful: false,
                    diagnostic: createCsvDiagnostic (
                        "CSV_SYNTAX_INVALID",
                        "A CSV field contains an unexpected quote.",
                        "Quote the complete field and escape embedded quotes by doubling them.",
                        rows.length + 1,
                    ),
                };
            }

            insideQuotedField = true;
        }
        else if ( character === "," )
        {
            finishField ();
        }
        else if ( character === "\r" || character === "\n" )
        {
            // Handle the case where all required conditions are satisfied.

            if ( character === "\r" && text [ index + 1 ] === "\n" )
            {
                index++;
            }

            finishRow ();
        }
        else
        {
            currentField += character;
        }
    }

    // Handle the case where inside quoted field is enabled.

    if ( insideQuotedField )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            diagnostic: createCsvDiagnostic (
                "CSV_SYNTAX_INVALID",
                "The CSV file ends inside a quoted field.",
                "Close the quoted field and import the file again.",
                rows.length + 1,
            ),
        };
    }

    // Handle the case where at least one branch condition is satisfied.

    if ( currentField.length > 0 || currentRow.length > 0 || quotedFieldClosed )
    {
        finishRow ();
    }

    // Return the assembled result.

    return { isSuccessful: true, rows };
}

//--------------------------------------------------------------------------------------------------
// Function: normalizedHeader
//
// Description:
//
//   Derives the normalized header.
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

function normalizedHeader ( value: string ): string
{
    // Return the to locale lower case result.

    return value.replace ( /^\uFEFF/u, "" ).trim ().toLocaleLowerCase ();
}

//--------------------------------------------------------------------------------------------------
// Function: prepareRows
//
// Description:
//
//   Prepares the rows.
//
// Parameters:
//
//   - text:
//     The text supplied to the operation.
//
//   - requiredHeaders:
//     The required headers supplied to the operation.
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

function prepareRows (
    text: string,
    requiredHeaders: readonly string[],
):
    | { readonly isSuccessful: false; readonly diagnostics: readonly DomainDiagnostic[] }
    | {
        readonly isSuccessful: true;
        readonly headerIndexes: ReadonlyMap<string, number>;
        readonly rows: readonly ModelImportRow<readonly string[]>[];
    }
{
    // Initialize the local values needed by this operation.

    const parseResult = parseCsv ( text );

    // Handle the case where the parse result is successful condition is not satisfied.

    if ( !parseResult.isSuccessful )
    {
        // Return the assembled result.

        return { isSuccessful: false, diagnostics: [ parseResult.diagnostic ] };
    }

    const header = parseResult.rows [ 0 ];

    // Handle the case where header matches undefined.

    if ( header === undefined )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            diagnostics:
            [
                createCsvDiagnostic (
                    "CSV_HEADER_MISSING",
                    "The CSV file does not contain a header row.",
                    `Add the required header columns: ${requiredHeaders.join ( ", " )}.`,
                ),
            ],
        };
    }

    // Initialize the local values needed by this operation.

    const headerIndexes                   = new Map<string, number> ();
    const diagnostics: DomainDiagnostic[] = [];

    header.forEach ( ( headerValue, columnIndex ) =>
    {
        // Initialize the local values needed by this operation.

        const normalizedValue = normalizedHeader ( headerValue );

        // Handle the case where all required conditions are satisfied.

        if ( normalizedValue.length > 0 && headerIndexes.has ( normalizedValue ) )
        {
            diagnostics.push ( createCsvDiagnostic (
                "CSV_HEADER_DUPLICATE",
                `The CSV header '${normalizedValue}' occurs more than once.`,
                "Keep only one column with that header.",
                1,
            ) );
        }
        else if ( normalizedValue.length > 0 )
        {
            headerIndexes.set ( normalizedValue, columnIndex );
        }
    } );

    requiredHeaders.forEach ( requiredHeader =>
    {
        // Handle the case where the has result condition is not satisfied.

        if ( !headerIndexes.has ( requiredHeader ) )
        {
            diagnostics.push ( createCsvDiagnostic (
                "CSV_HEADER_MISSING",
                `The CSV file is missing required '${requiredHeader}' column.`,
                `Add a '${requiredHeader}' column and import the file again.`,
                1,
            ) );
        }
    } );

    // Handle the case where diagnostics length exceeds the 0 value.

    if ( diagnostics.length > 0 )
    {
        // Return the assembled result.

        return { isSuccessful: false, diagnostics };
    }

    // Calculate the rows value from the current inputs.

    const rows = parseResult.rows.slice ( 1 )
        .map ( ( values, index ) => ( { rowNumber: index + 2, value: values } ) )
        .filter ( row => row.value.some ( value => value.length > 0 ) );

    // Return the assembled result.

    return { isSuccessful: true, headerIndexes, rows };
}

//--------------------------------------------------------------------------------------------------
// Function: cellValue
//
// Description:
//
//   Derives the cell value.
//
// Parameters:
//
//   - row:
//     The row supplied to the operation.
//
//   - headerIndexes:
//     The header indexes supplied to the operation.
//
//   - header:
//     The header supplied to the operation.
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

function cellValue (
    row: ModelImportRow<readonly string[]>,
    headerIndexes: ReadonlyMap<string, number>,
    header: string,
): string
{
    // Initialize the local values needed by this operation.

    const columnIndex = headerIndexes.get ( header );

    // Return the result selected by the current condition.

    return columnIndex === undefined ? "" : row.value [ columnIndex ] ?? "";
}

//--------------------------------------------------------------------------------------------------
// Function: prepareNamedEntities
//
// Description:
//
//   Prepares the named entities.
//
// Parameters:
//
//   - text:
//     The text supplied to the operation.
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

function prepareNamedEntities (
    text: string,
    entityKind: "action" | "event" | "state",
): CsvImportPreparationResult
{
    // Initialize the local values needed by this operation.

    const preparedRows = prepareRows ( text, [ "name", "description" ] );

    // Handle the case where the prepared rows is successful condition is not satisfied.

    if ( !preparedRows.isSuccessful )
    {
        // Return the prepared rows.

        return preparedRows;
    }

    const rows = preparedRows.rows.map ( row => ( {
        rowNumber: row.rowNumber,
        value:
        {
            name:        cellValue ( row, preparedRows.headerIndexes, "name" ),
            description: cellValue ( row, preparedRows.headerIndexes, "description" ),
        },
    } ) );

    // Return the assembled result.

    return {
        isSuccessful: true,
        modelImport:  { kind: "named_entities", entityKind, rows },
        rowCount:     rows.length,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: prepareModelMetadata
//
// Description:
//
//   Prepares the model metadata.
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

function prepareModelMetadata ( text: string ): CsvImportPreparationResult
{
    // Initialize the local values needed by this operation.

    const preparedRows = prepareRows ( text, [ "name", "description", "version", "initial_state" ] );

    // Handle the case where the prepared rows is successful condition is not satisfied.

    if ( !preparedRows.isSuccessful )
    {
        // Return the prepared rows.

        return preparedRows;
    }

    // Initialize the local values needed by this operation.

    const firstRow                                         = preparedRows.rows [ 0 ];
    const rows: ModelImportRow<ModelMetadataImportValue>[] = firstRow === undefined
        ? []
        : [
            {
                rowNumber: firstRow.rowNumber,
                value:
                {
                    name:         cellValue ( firstRow, preparedRows.headerIndexes, "name" ),
                    description:  cellValue ( firstRow, preparedRows.headerIndexes, "description" ),
                    version:      cellValue ( firstRow, preparedRows.headerIndexes, "version" ),
                    initialState: cellValue ( firstRow, preparedRows.headerIndexes, "initial_state" ).trim () || null,
                },
            },
        ];
    const extraRowCount                = Math.max ( 0, preparedRows.rows.length - 1 );
    const warnings: DomainDiagnostic[] = extraRowCount === 0
        ? []
        : [
            {
                code:        "CSV_MODEL_METADATA_EXTRA_ROWS",
                message:     `The Model Metadata CSV contains ${preparedRows.rows.length} data rows. Only the first data row was imported.`,
                remediation: "Remove the additional rows if they were not intentional.",
                severity:    "warning",
                source:      "CSV import",
            },
        ];

    // Return the assembled result.

    return {
        isSuccessful: true,
        modelImport:  { kind: "model_metadata", rows },
        rowCount:     rows.length,
        ...( warnings.length === 0 ? {} : { warnings } ),
    };
}

//--------------------------------------------------------------------------------------------------
// Function: prepareStateActions
//
// Description:
//
//   Prepares the state actions.
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

function prepareStateActions ( text: string ): CsvImportPreparationResult
{
    // Initialize the local values needed by this operation.

    const preparedRows = prepareRows ( text, [ "state", "action" ] );

    // Handle the case where the prepared rows is successful condition is not satisfied.

    if ( !preparedRows.isSuccessful )
    {
        // Return the prepared rows.

        return preparedRows;
    }

    // Initialize the local values needed by this operation.

    const scheduleColumnPresent           = preparedRows.headerIndexes.has ( "schedule" );
    const diagnostics: DomainDiagnostic[] = [];
    const rows                            = preparedRows.rows.flatMap ( row =>
    {
        // Initialize the local values needed by this operation.

        const scheduleValue = scheduleColumnPresent
            ? cellValue ( row, preparedRows.headerIndexes, "schedule" ).trim ().toLocaleLowerCase ()
            : "entry";

        // Handle the case where all required conditions are satisfied.

        if ( scheduleValue !== "entry" && scheduleValue !== "exit" )
        {
            diagnostics.push ( createCsvDiagnostic (
                "CSV_SCHEDULE_INVALID",
                `Row ${row.rowNumber} has unsupported schedule '${scheduleValue}'.`,
                "Use 'entry' or 'exit', or omit the schedule column to default every row to 'entry'.",
                row.rowNumber,
            ) );

            // Return the assembled result collection.

            return [];
        }

        const schedule: StateActionSchedule = scheduleValue;

        // Return the assembled result collection.

        return [
            {
                rowNumber: row.rowNumber,
                value:
                {
                    state:  cellValue ( row, preparedRows.headerIndexes, "state" ),
                    action: cellValue ( row, preparedRows.headerIndexes, "action" ),
                    schedule,
                },
            },
        ];
    } );

    // Return the result selected by the current condition.

    return diagnostics.length > 0
        ? { isSuccessful: false, diagnostics }
        : {
            isSuccessful: true,
            modelImport:  { kind: "state_actions", rows },
            rowCount:     rows.length,
        };
}

//--------------------------------------------------------------------------------------------------
// Function: prepareTransitions
//
// Description:
//
//   Prepares the transitions.
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

function prepareTransitions ( text: string ): CsvImportPreparationResult
{
    // Initialize the local values needed by this operation.

    const preparedRows = prepareRows ( text, [ "state", "event", "next_state" ] );

    // Handle the case where the prepared rows is successful condition is not satisfied.

    if ( !preparedRows.isSuccessful )
    {
        // Return the prepared rows.

        return preparedRows;
    }

    const rows = preparedRows.rows.map ( row => ( {
        rowNumber: row.rowNumber,
        value:
        {
            state:     cellValue ( row, preparedRows.headerIndexes, "state" ),
            event:     cellValue ( row, preparedRows.headerIndexes, "event" ),
            stateNext: cellValue ( row, preparedRows.headerIndexes, "next_state" ),
        },
    } ) );

    // Return the assembled result.

    return {
        isSuccessful: true,
        modelImport:  { kind: "transitions", rows },
        rowCount:     rows.length,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: prepareCsvModelElementImport
//
// Description:
//
//   Prepares the CSV model element import.
//
// Parameters:
//
//   - text:
//     The text supplied to the operation.
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

export function prepareCsvModelElementImport (
    text: string,
    transferKind: CsvTransferKind,
): CsvImportPreparationResult
{
    // Dispatch according to the transfer kind value.

    switch ( transferKind )
    {
        // Handle the "model_metadata" case.

        case "model_metadata":

            // Return the prepare model metadata result.

            return prepareModelMetadata ( text );

        // Handle the "actions" case.

        case "actions":

            // Return the prepare named entities result.

            return prepareNamedEntities ( text, "action" );

        // Handle the "events" case.

        case "events":

            // Return the prepare named entities result.

            return prepareNamedEntities ( text, "event" );

        // Handle the "states" case.

        case "states":

            // Return the prepare named entities result.

            return prepareNamedEntities ( text, "state" );

        // Handle the "state_actions" case.

        case "state_actions":

            // Return the prepare state actions result.

            return prepareStateActions ( text );

        // Handle the "transition_table" case.

        case "transition_table":

            // Return the prepare transitions result.

            return prepareTransitions ( text );
    }
}

//--------------------------------------------------------------------------------------------------
// Function: encodeCsvField
//
// Description:
//
//   Encodes CSV field.
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

function encodeCsvField ( value: string ): string
{
    // Return the result selected by the current condition.

    return /[",\r\n]/u.test ( value ) ? `"${value.replaceAll ( "\"", "\"\"" )}"` : value;
}

//--------------------------------------------------------------------------------------------------
// Function: serializeRows
//
// Description:
//
//   Serializes rows.
//
// Parameters:
//
//   - rows:
//     The rows supplied to the operation.
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

function serializeRows ( rows: readonly ( readonly string[] )[] ): string
{
    // Return the computed result.

    return `${rows.map ( row => row.map ( encodeCsvField ).join ( "," ) ).join ( "\r\n" )}\r\n`;
}

//--------------------------------------------------------------------------------------------------
// Function: fileStem
//
// Description:
//
//   Derives the file stem.
//
// Parameters:
//
//   - modelName:
//     The model name supplied to the operation.
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

function fileStem ( modelName: string ): string
{
    // Initialize the local values needed by this operation.

    const normalizedName = modelName.toLocaleLowerCase ()
        .replace ( /[^a-z0-9]+/gu, "-" )
        .replace ( /^-|-$/gu, "" );

    // Return the result selected by the current condition.

    return normalizedName.length === 0 ? "untitled-state-machine" : normalizedName;
}

//--------------------------------------------------------------------------------------------------
// Function: createCsvExportDocument
//
// Description:
//
//   Creates CSV export document.
//
// Parameters:
//
//   - draft:
//     The draft supplied to the operation.
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

export function createCsvExportDocument (
    draft: AuthoringDraft,
    transferKind: CsvTransferKind,
): CsvExportDocument
{
    // Initialize the local values needed by this operation.

    let rows: readonly ( readonly string[] )[];

    // Dispatch according to the transfer kind value.

    switch ( transferKind )
    {
        // Handle the "model_metadata" case.

        case "model_metadata":
            rows = [
                [ "name", "description", "version", "initial_state" ],
                [
                    draft.settings.name,
                    draft.settings.description,
                    draft.settings.version,
                    draft.stateMachine.initialState ?? "",
                ],
            ];
            break;

        // Handle the "actions" case.

        case "actions":
            rows = [ [ "name", "description" ], ...draft.stateMachine.actions.map ( action => [ action.name, action.description ] ) ];
            break;

        // Handle the "events" case.

        case "events":
            rows = [ [ "name", "description" ], ...draft.stateMachine.events.map ( event => [ event.name, event.description ] ) ];
            break;

        // Handle the "states" case.

        case "states":
            rows = [ [ "name", "description" ], ...draft.stateMachine.states.map ( state => [ state.name, state.description ] ) ];
            break;

        // Handle the "state_actions" case.

        case "state_actions":
            rows = [
                [ "state", "action", "schedule" ],
                ...draft.stateMachine.stateActions.entry.map ( mapping => [ mapping.state, mapping.action, "entry" ] ),
                ...draft.stateMachine.stateActions.exit.map ( mapping => [ mapping.state, mapping.action, "exit" ] ),
            ];
            break;

        // Handle the "transition_table" case.

        case "transition_table":
            rows = [
                [ "state", "event", "next_state" ],
                ...draft.stateMachine.transitionTable.map ( transition => [
                    transition.state,
                    transition.event,
                    transition.stateNext,
                ] ),
            ];
            break;
    }

    // Return the assembled result.

    return {
        rowCount:      Math.max ( 0, rows.length - 1 ),
        suggestedName: `${fileStem ( draft.settings.name )}-${transferKind.replaceAll ( "_", "-" )}.csv`,
        text:          serializeRows ( rows ),
    };
}

//--------------------------------------------------------------------------------------------------
// Function: solverCsvDiagnostic
//
// Description:
//
//   Derives the solver CSV diagnostic.
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

function solverCsvDiagnostic (
    code: string,
    message: string,
    remediation: string,
    rowNumber: number,
): DomainDiagnostic
{
    // Return the create CSV diagnostic result.

    return createCsvDiagnostic ( code, message, remediation, rowNumber );
}

//--------------------------------------------------------------------------------------------------
// Function: normalizeSolverCsvToken
//
// Description:
//
//   Normalizes solver CSV token.
//
// Parameters:
//
//   - name:
//     The name supplied to the operation.
//
//   - type:
//     The type supplied to the operation.
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

function normalizeSolverCsvToken (
    name: string,
    type: string,
    rowNumber: number,
): { readonly token: string | null; readonly diagnostic: DomainDiagnostic | null }
{
    // Initialize the local values needed by this operation.

    const normalizedName = name.trim ();
    const normalizedType = type.trim ().toLocaleLowerCase ();

    // Handle the case where all required conditions are satisfied.

    if ( normalizedType !== "event" && normalizedType !== "state" && normalizedType !== "action" )
    {
        // Return the assembled result.

        return {
            token: null,
            diagnostic: solverCsvDiagnostic (
                "CSV_SOLVER_TYPE_INVALID",
                `Row ${rowNumber} has unsupported Solver type '${normalizedType}'.`,
                "Use 'event', 'state', or 'action'.",
                rowNumber,
            ),
        };
    }

    // Handle the case where normalized name length equals 0.

    if ( normalizedName.length === 0 )
    {
        // Return the assembled result.

        return {
            token: null,
            diagnostic: solverCsvDiagnostic (
                "CSV_NAME_INVALID",
                `Row ${rowNumber} has an empty Solver token name.`,
                "Provide a non-empty name.",
                rowNumber,
            ),
        };
    }

    // Initialize the local values needed by this operation.

    const canonicalPrefixes = [ "event_", "state_", "action_" ];
    const matchingPrefix    = canonicalPrefixes.find ( prefix => normalizedName.startsWith ( prefix ) );
    const requiredPrefix    = `${normalizedType}_`;

    // Handle the case where all required conditions are satisfied.

    if ( matchingPrefix !== undefined && matchingPrefix !== requiredPrefix )
    {
        // Return the assembled result.

        return {
            token: null,
            diagnostic: solverCsvDiagnostic (
                "CSV_SOLVER_PREFIX_CONFLICT",
                `Row ${rowNumber} declares type '${normalizedType}' but name '${normalizedName}' has a conflicting prefix.`,
                `Change the type or use the '${requiredPrefix}' prefix.`,
                rowNumber,
            ),
        };
    }

    // Return the assembled result.

    return { token: matchingPrefix === undefined ? `${requiredPrefix}${normalizedName}` : normalizedName, diagnostic: null };
}

//--------------------------------------------------------------------------------------------------
// Function: prepareCsvSolverSequenceImport
//
// Description:
//
//   Prepares the CSV solver sequence import.
//
// Parameters:
//
//   - text:
//     The text supplied to the operation.
//
//   - destinationName:
//     The destination name supplied to the operation.
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

export function prepareCsvSolverSequenceImport ( text: string, destinationName: string ): SolverSequenceCsvImportResult
{
    // Initialize the local values needed by this operation.

    const preparedRows = prepareRows ( text, [ "name", "type" ] );

    // Handle the case where the prepared rows is successful condition is not satisfied.

    if ( !preparedRows.isSuccessful )
    {
        // Return the prepared rows.

        return preparedRows;
    }

    // Initialize the local values needed by this operation.

    const diagnostics: DomainDiagnostic[] = [];
    const tokens: string[]                = [];

    // Process each row from the prepared rows rows collection in order.

    for ( const row of preparedRows.rows )
    {
        // Initialize the local values needed by this operation.

        const result = normalizeSolverCsvToken (
            cellValue ( row, preparedRows.headerIndexes, "name" ),
            cellValue ( row, preparedRows.headerIndexes, "type" ),
            row.rowNumber,
        );

        // Handle the case where result diagnostic differs from an absent value.

        if ( result.diagnostic !== null )
        {
            diagnostics.push ( result.diagnostic );
        }
        else if ( result.token !== null )
        {
            tokens.push ( result.token );
        }
    }

    // Handle the case where diagnostics length exceeds the 0 value.

    if ( diagnostics.length > 0 )
    {
        // Return the assembled result.

        return { isSuccessful: false, diagnostics };
    }

    const parseResult = parseSolverObservation (
        { name: destinationName, startContext: "infer", rawTokens: tokens },
    );

    // Handle the case where the parse result is successful condition is not satisfied.

    if ( !parseResult.isSuccessful )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            diagnostics: parseResult.diagnostics.map ( diagnostic => ( {
                code: diagnostic.code,
                severity: diagnostic.severity,
                source: "CSV import",
                message: diagnostic.message,
                remediation: diagnostic.remediation,
                context: diagnostic.relatedLocations.map ( location =>
                    `${location.sequenceName}:${location.tokenStart + 1}` ).join ( ", " ),
            } ) ),
        };
    }

    // Return the assembled result.

    return { isSuccessful: true, rowCount: preparedRows.rows.length, tokens };
}

//--------------------------------------------------------------------------------------------------
// Function: solverTokenCsvRow
//
// Description:
//
//   Derives the solver token CSV row.
//
// Parameters:
//
//   - token:
//     The token supplied to the operation.
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

function solverTokenCsvRow ( token: string ): readonly string[] | null
{
    // Initialize the local values needed by this operation.

    const canonicalToken = canonicalizeSolverNamedToken ( token );

    // Return the result selected by the current condition.

    return canonicalToken === null ? null : [ canonicalToken.name, canonicalToken.kind ];
}

//--------------------------------------------------------------------------------------------------
// Function: createCsvSolverSequenceExportDocument
//
// Description:
//
//   Creates CSV solver sequence export document.
//
// Parameters:
//
//   - modelName:
//     The model name supplied to the operation.
//
//   - sequence:
//     The sequence supplied to the operation.
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

export function createCsvSolverSequenceExportDocument (
    modelName: string,
    sequence: SolverSequence,
): SolverSequenceCsvExportResult
{
    // Initialize the local values needed by this operation.

    const rows: ( readonly string[] )[]   = [ [ "name", "type" ] ];
    const diagnostics: DomainDiagnostic[] = [];

    sequence.sequence.forEach ( ( token, index ) =>
    {
        // Initialize the local values needed by this operation.

        const row = solverTokenCsvRow ( token );

        // Handle the case where row matches an absent value.

        if ( row === null )
        {
            diagnostics.push ( solverCsvDiagnostic (
                "CSV_SOLVER_TOKEN_INVALID",
                `Solver token '${token}' cannot be exported.`,
                "Correct the token prefix before export.",
                index + 2,
            ) );
        }
        else
        {
            // Handle the remaining case after the preceding condition is false.

            rows.push ( row );
        }
    } );

    // Return the result selected by the current condition.

    return diagnostics.length > 0
        ? { isSuccessful: false, diagnostics }
        : {
            isSuccessful: true,
            document:
            {
                rowCount: sequence.sequence.length,
                suggestedName: `${fileStem ( modelName )}-${fileStem ( sequence.name )}-solver-observation.csv`,
                text: serializeRows ( rows ),
            },
        };
}

// /////////////////////////////////////////////////////////////////////////////////////////////////
// Simulator event sequences.
//
//   The Simulator collection uses one `name` column carrying one event per row in dispatch order.
//   Unlike the Solver collection, there is no type column or canonical prefix, and undeclared event
//   names are accepted deliberately so unknown-event behavior can be exercised. The only rejections
//   here are structural — a blank name, an over-long name, or a buffer the server could never
//   accept.
// /////////////////////////////////////////////////////////////////////////////////////////////////

//--------------------------------------------------------------------------------------------------
// Function: prepareCsvSimulatorSequenceImport
//
// Description:
//
//   Prepares the CSV simulator sequence import.
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

export function prepareCsvSimulatorSequenceImport ( text: string ): SimulatorSequenceCsvImportResult
{
    // Initialize the local values needed by this operation.

    const preparedRows = prepareRows ( text, [ "name" ] );

    // Handle the case where the prepared rows is successful condition is not satisfied.

    if ( !preparedRows.isSuccessful )
    {
        // Return the prepared rows.

        return preparedRows;
    }

    // Initialize the local values needed by this operation.

    const diagnostics: DomainDiagnostic[] = [];
    const events: string[]                = [];

    // Handle the case where length exceeds maximum event buffer count.

    if ( preparedRows.rows.length > MAXIMUM_EVENT_BUFFER_COUNT )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            diagnostics:
            [
                createCsvDiagnostic (
                    "CSV_SIMULATOR_SEQUENCE_TOO_LARGE",
                    `The file contains ${preparedRows.rows.length} event row(s); the limit is ` +
                        `${MAXIMUM_EVENT_BUFFER_COUNT}.`,
                    `Split the sequence so that no single sequence exceeds ${MAXIMUM_EVENT_BUFFER_COUNT} events.`,
                ),
            ],
        };
    }

    // Process each row from the prepared rows rows collection in order.

    for ( const row of preparedRows.rows )
    {
        // Initialize the local values needed by this operation.

        const eventName = cellValue ( row, preparedRows.headerIndexes, "name" ).trim ();

        // Handle the case where event name length equals 0.

        if ( eventName.length === 0 )
        {
            diagnostics.push ( createCsvDiagnostic (
                "CSV_SIMULATOR_EVENT_BLANK",
                "The event name is blank.",
                "Supply an event name or remove the row.",
                row.rowNumber,
            ) );
        }
        else if ( [ ...eventName ].length > MAXIMUM_NAME_CODE_POINT_COUNT )
        {
            diagnostics.push ( createCsvDiagnostic (
                "CSV_SIMULATOR_EVENT_TOO_LONG",
                `The event name exceeds ${MAXIMUM_NAME_CODE_POINT_COUNT} code points.`,
                `Shorten the event name to at most ${MAXIMUM_NAME_CODE_POINT_COUNT} code points.`,
                row.rowNumber,
            ) );
        }
        else
        {
            events.push ( eventName );
        }
    }

    // Return the result selected by the current condition.

    return diagnostics.length > 0
        ? { isSuccessful: false, diagnostics }
        : { isSuccessful: true, events, rowCount: preparedRows.rows.length };
}

//--------------------------------------------------------------------------------------------------
// Function: createCsvSimulatorSequenceExportDocument
//
// Description:
//
//   Creates CSV simulator sequence export document.
//
// Parameters:
//
//   - modelName:
//     The model name supplied to the operation.
//
//   - sequence:
//     The sequence supplied to the operation.
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

export function createCsvSimulatorSequenceExportDocument (
    modelName: string,
    sequence: SimulatorSequence,
): SimulatorSequenceCsvExportResult
{
    // Initialize the local values needed by this operation.

    const rows: ( readonly string[] )[] = [ [ "name" ], ...sequence.sequence.map ( eventName => [ eventName ] ) ];

    // Return the assembled result.

    return {
        isSuccessful: true,
        document:
        {
            rowCount: sequence.sequence.length,
            suggestedName: `${fileStem ( modelName )}-${fileStem ( sequence.name )}-simulator-events.csv`,
            text: serializeRows ( rows ),
        },
    };
}
