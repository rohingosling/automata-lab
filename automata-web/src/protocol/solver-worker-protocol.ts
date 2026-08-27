// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Solver Worker Protocol
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Defines and validates the bounded versioned messages exchanged with the dedicated Solver
//   Worker.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { SolverProgress } from "../application/ports/contracts.js";
import type
{
    ChartDraftTransition,
    ChartInitialStateIndicator,
    ChartPoint,
    ChartProjection,
    ChartStatePlacement,
    NamedEntity,
    SolverCandidate,
    SolverCandidateCoverageInterval,
    SolverCandidateProvenance,
    SolverCandidateSourceRange,
    SolverCandidateStateProvenance,
    SolverCandidateStatistics,
    SolverCandidateTraceCoverage,
    SolverCandidateTransitionProvenance,
    SolverInferenceReportEntry,
    StateActionDefinitions,
    StateActionMapping,
    StateMachineDefinition,
    TerminalStateIndicator,
    TerminalStateIndicatorTransition,
    TransitionDefinition,
} from "../domain/model/contracts.js";
import
{
    MAXIMUM_ACTION_COUNT,
    MAXIMUM_CHART_DRAFT_TRANSITION_COUNT,
    MAXIMUM_CHART_TERMINAL_INDICATOR_COUNT,
    MAXIMUM_CHART_TERMINAL_RELATION_COUNT,
    MAXIMUM_DESCRIPTION_CODE_POINTS,
    MAXIMUM_ENTRY_ACTION_COUNT,
    MAXIMUM_EVENT_COUNT,
    MAXIMUM_EXIT_ACTION_COUNT,
    MAXIMUM_NAME_CODE_POINT_COUNT,
    MAXIMUM_SOLVER_SEQUENCE_COUNT,
    MAXIMUM_SOLVER_TOKEN_COUNT,
    MAXIMUM_SOLVER_TOKEN_CODE_POINT_COUNT,
    MAXIMUM_STATE_COUNT,
    MAXIMUM_TRANSITION_COUNT,
} from "../domain/model/limits.js";
import type
{
    SolverDiagnosticLocation,
    SolverInferenceRequest,
    SolverInferenceResult,
    SolverObservationDiagnostic,
    SolverObservationInput,
} from "../domain/solver/contracts.js";

export const SOLVER_PROTOCOL_VERSION = "automata-lab-solver/1";

export const MAXIMUM_SOLVER_WORKER_DIAGNOSTIC_COUNT = 100;
export const MAXIMUM_SOLVER_WORKER_TEXT_CODE_POINT_COUNT = MAXIMUM_DESCRIPTION_CODE_POINTS;

const MAXIMUM_SOLVER_WORKER_PROTOCOL_NODE_COUNT = 1_000_000;
const MAXIMUM_SOLVER_WORKER_REPORT_ENTRY_COUNT  = MAXIMUM_SOLVER_TOKEN_COUNT;
const FORBIDDEN_PROPERTY_NAMES                  = new Set ( [ "__proto__", "constructor", "prototype" ] );

//--------------------------------------------------------------------------------------------------
// Interface: SolverWorkerSolveRequest
//
// Description:
//
//   Describes a solver worker solve request.
//
//--------------------------------------------------------------------------------------------------

export interface SolverWorkerSolveRequest
{
    readonly protocolVersion: typeof SOLVER_PROTOCOL_VERSION;
    readonly kind:            "solve";
    readonly jobId:           string;
    readonly request:         SolverInferenceRequest;
}

//--------------------------------------------------------------------------------------------------
// Interface: SolverWorkerProgressMessage
//
// Description:
//
//   Defines the structure of solver worker progress message.
//
//--------------------------------------------------------------------------------------------------

export interface SolverWorkerProgressMessage
{
    readonly protocolVersion: typeof SOLVER_PROTOCOL_VERSION;
    readonly kind:            "progress";
    readonly jobId:           string;
    readonly progress:        SolverProgress;
}

//--------------------------------------------------------------------------------------------------
// Interface: SolverWorkerResultMessage
//
// Description:
//
//   Defines the structure of solver worker result message.
//
//--------------------------------------------------------------------------------------------------

export interface SolverWorkerResultMessage
{
    readonly protocolVersion: typeof SOLVER_PROTOCOL_VERSION;
    readonly kind:            "result";
    readonly jobId:           string;
    readonly result:          SolverInferenceResult;
}

//--------------------------------------------------------------------------------------------------
// Type: SolverWorkerMessage
//
// Description:
//
//   Defines the supported solver worker message alternatives.
//
//--------------------------------------------------------------------------------------------------

export type SolverWorkerMessage = SolverWorkerProgressMessage | SolverWorkerResultMessage;

//--------------------------------------------------------------------------------------------------
// Interface: ProtocolTraversalEntry
//
// Description:
//
//   Defines the structure of protocol traversal entry.
//
//--------------------------------------------------------------------------------------------------

interface ProtocolTraversalEntry
{
    readonly exiting: boolean;
    readonly value:   unknown;
}

//--------------------------------------------------------------------------------------------------
// Function: isPlainRecord
//
// Description:
//
//   Determines whether plain record.
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

function isPlainRecord ( value: unknown ): value is Readonly<Record<string, unknown>>
{
    // Handle the case where at least one branch condition is satisfied.

    if ( typeof value !== "object" || value === null || Array.isArray ( value ) )
    {
        // Return the computed result.

        return false;
    }

    const prototype = Object.getPrototypeOf ( value );

    // Return the computed result.

    return prototype === Object.prototype || prototype === null;
}

//--------------------------------------------------------------------------------------------------
// Function: inspectProtocolValue
//
// Description:
//
//   Inspects the protocol value.
//
// Parameters:
//
//   - rootValue:
//     The root value supplied to the operation.
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

function inspectProtocolValue ( rootValue: unknown ): boolean
{
    // Initialize the local values needed by this operation.

    const activeObjects                            = new WeakSet<object> ();
    const completedObjects                         = new WeakSet<object> ();
    const pendingEntries: ProtocolTraversalEntry[] = [ { exiting: false, value: rootValue } ];
    let visitedNodeCount                           = 0;

    // Run the operation that may report a recoverable failure.

    try
    {
        // Continue the operation while its terminating condition has not been reached.

        while ( pendingEntries.length > 0 )
        {
            // Initialize the local values needed by this operation.

            const entry = pendingEntries.pop ();

            // Handle the case where entry matches undefined.

            if ( entry === undefined )
            {
                continue;
            }

            const value = entry.value;

            // Handle the case where entry exiting is enabled.

            if ( entry.exiting )
            {
                // Handle the case where all required conditions are satisfied.

                if ( typeof value === "object" && value !== null )
                {
                    activeObjects.delete ( value );
                    completedObjects.add ( value );
                }

                continue;
            }

            // Handle the case where at least one branch condition is satisfied.

            if ( value === null || typeof value === "boolean" || typeof value === "string" )
            {
                visitedNodeCount++;
                continue;
            }

            // Handle the case where current value matches the number value.

            if ( typeof value === "number" )
            {
                // Handle the case where the is finite result condition is not satisfied.

                if ( !Number.isFinite ( value ) )
                {
                    // Return the computed result.

                    return false;
                }

                visitedNodeCount++;
                continue;
            }

            // Handle the case where current value differs from the object value.

            if ( typeof value !== "object" )
            {
                // Return the computed result.

                return false;
            }

            // Handle the case where has result is enabled.

            if ( activeObjects.has ( value ) )
            {
                // Return the computed result.

                return false;
            }

            // Handle the case where has result is enabled.

            if ( completedObjects.has ( value ) )
            {
                continue;
            }

            visitedNodeCount++;

            // Handle the case where visited node count exceeds maximum solver worker protocol node
            // count.

            if ( visitedNodeCount > MAXIMUM_SOLVER_WORKER_PROTOCOL_NODE_COUNT )
            {
                // Return the computed result.

                return false;
            }

            activeObjects.add ( value );
            pendingEntries.push ( { exiting: true, value } );

            // Handle the case where is array result is enabled.

            if ( Array.isArray ( value ) )
            {
                // Handle the case where at least one branch condition is satisfied.

                if ( Object.getPrototypeOf ( value ) !== Array.prototype ||
                    value.length > MAXIMUM_SOLVER_WORKER_PROTOCOL_NODE_COUNT )
                {
                    // Return the computed result.

                    return false;
                }

                const propertyKeys = Reflect.ownKeys ( value );

                // Handle the case where at least one branch condition is satisfied.

                if ( propertyKeys.length !== value.length + 1 || !propertyKeys.includes ( "length" ) )
                {
                    // Return the computed result.

                    return false;
                }

                // Repeat the operation across the bounded iteration range.

                for ( let i = value.length - 1; i >= 0; i-- )
                {
                    // Initialize the local values needed by this operation.

                    const descriptor = Object.getOwnPropertyDescriptor ( value, String ( i ) );

                    // Handle the case where at least one branch condition is satisfied.

                    if ( descriptor === undefined || !( "value" in descriptor ) || !descriptor.enumerable )
                    {
                        // Return the computed result.

                        return false;
                    }

                    pendingEntries.push ( { exiting: false, value: descriptor.value } );
                }

                continue;
            }

            // Handle the case where the is plain record result condition is not satisfied.

            if ( !isPlainRecord ( value ) )
            {
                // Return the computed result.

                return false;
            }

            // Process each property key from the own keys result collection in order.

            for ( const propertyKey of Reflect.ownKeys ( value ) )
            {
                // Handle the case where at least one branch condition is satisfied.

                if ( typeof propertyKey !== "string" || FORBIDDEN_PROPERTY_NAMES.has ( propertyKey ) )
                {
                    // Return the computed result.

                    return false;
                }

                const descriptor = Object.getOwnPropertyDescriptor ( value, propertyKey );

                // Handle the case where at least one branch condition is satisfied.

                if ( descriptor === undefined || !( "value" in descriptor ) || !descriptor.enumerable )
                {
                    // Return the computed result.

                    return false;
                }

                pendingEntries.push ( { exiting: false, value: descriptor.value } );
            }
        }
    }
    catch
    {
        // Recover from the reported failure without hiding its outcome.

        return false;
    }

    // Return the computed result.

    return visitedNodeCount <= MAXIMUM_SOLVER_WORKER_PROTOCOL_NODE_COUNT;
}

//--------------------------------------------------------------------------------------------------
// Function: exactRecord
//
// Description:
//
//   Derives the exact record.
//
// Parameters:
//
//   - value:
//     The value supplied to the operation.
//
//   - requiredKeys:
//     The required keys supplied to the operation.
//
//   - optionalKeys:
//     The optional keys supplied to the operation.
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

function exactRecord (
    value: unknown,
    requiredKeys: readonly string[],
    optionalKeys: readonly string[] = [],
): Readonly<Record<string, unknown>> | null
{
    // Handle the case where the is plain record result condition is not satisfied.

    if ( !isPlainRecord ( value ) )
    {
        // Return the computed result.

        return null;
    }

    // Initialize the local values needed by this operation.

    const actualKeys  = Reflect.ownKeys ( value );
    const allowedKeys = [ ...requiredKeys, ...optionalKeys ];

    // Return the result selected by the current condition.

    return requiredKeys.every ( key => Object.hasOwn ( value, key ) ) &&
        actualKeys.every ( key => typeof key === "string" && allowedKeys.includes ( key ) ) &&
        actualKeys.length >= requiredKeys.length && actualKeys.length <= allowedKeys.length
        ? value
        : null;
}

//--------------------------------------------------------------------------------------------------
// Function: codePointCountWithin
//
// Description:
//
//   Derives the code point count within.
//
// Parameters:
//
//   - value:
//     The value supplied to the operation.
//
//   - maximumCodePointCount:
//     The maximum code point count supplied to the operation.
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

function codePointCountWithin ( value: string, maximumCodePointCount: number ): boolean
{
    // Handle the case where value length exceeds current value.

    if ( value.length > maximumCodePointCount * 2 )
    {
        // Return the computed result.

        return false;
    }

    // Return the computed result.

    return [ ...value ].length <= maximumCodePointCount;
}

//--------------------------------------------------------------------------------------------------
// Function: isBoundedText
//
// Description:
//
//   Determines whether bounded text.
//
// Parameters:
//
//   - value:
//     The value supplied to the operation.
//
//   - maximumCodePointCount:
//     The maximum code point count supplied to the operation.
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

function isBoundedText (
    value: unknown,
    maximumCodePointCount = MAXIMUM_SOLVER_WORKER_TEXT_CODE_POINT_COUNT,
): value is string
{
    // Return the computed result.

    return typeof value === "string" && codePointCountWithin ( value, maximumCodePointCount );
}

//--------------------------------------------------------------------------------------------------
// Function: isBoundedName
//
// Description:
//
//   Determines whether bounded name.
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

function isBoundedName ( value: unknown ): value is string
{
    // Return the computed result.

    return isBoundedText ( value, MAXIMUM_NAME_CODE_POINT_COUNT ) && value.length > 0 && value === value.trim ();
}

//--------------------------------------------------------------------------------------------------
// Function: isBoundedIdentifier
//
// Description:
//
//   Determines whether bounded identifier.
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

function isBoundedIdentifier ( value: unknown ): value is string
{
    // Return the computed result.

    return isBoundedText ( value, MAXIMUM_NAME_CODE_POINT_COUNT ) && value.trim ().length > 0;
}

//--------------------------------------------------------------------------------------------------
// Function: isFiniteNumber
//
// Description:
//
//   Determines whether finite number.
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

function isFiniteNumber ( value: unknown ): value is number
{
    // Return the computed result.

    return typeof value === "number" && Number.isFinite ( value );
}

//--------------------------------------------------------------------------------------------------
// Function: isNonNegativeSafeInteger
//
// Description:
//
//   Determines whether non negative safe integer.
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

function isNonNegativeSafeInteger ( value: unknown ): value is number
{
    // Return the computed result.

    return typeof value === "number" && Number.isSafeInteger ( value ) && value >= 0;
}

//--------------------------------------------------------------------------------------------------
// Function: isSolverStartContext
//
// Description:
//
//   Determines whether solver start context.
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

function isSolverStartContext ( value: unknown ): value is SolverObservationInput["startContext"]
{
    // Return the computed result.

    return value === "continuation" || value === "infer" || value === "initial";
}

//--------------------------------------------------------------------------------------------------
// Function: decodeArray
//
// Description:
//
//   Decodes array.
//
// Parameters:
//
//   - value:
//     The value supplied to the operation.
//
//   - maximumLength:
//     The maximum length supplied to the operation.
//
//   - decodeItem:
//     The decode item supplied to the operation.
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

function decodeArray<Item> (
    value: unknown,
    maximumLength: number,
    decodeItem: ( item: unknown ) => Item | null,
): readonly Item[] | null
{
    // Handle the case where at least one branch condition is satisfied.

    if ( !Array.isArray ( value ) || value.length > maximumLength )
    {
        // Return the computed result.

        return null;
    }

    const decodedItems: Item[] = [];

    // Process each item from the value collection in order.

    for ( const item of value )
    {
        // Initialize the local values needed by this operation.

        const decodedItem = decodeItem ( item );

        // Handle the case where decoded item matches an absent value.

        if ( decodedItem === null )
        {
            // Return the computed result.

            return null;
        }

        decodedItems.push ( decodedItem );
    }

    // Return the decoded items.

    return decodedItems;
}

//--------------------------------------------------------------------------------------------------
// Function: decodeBoundedStringArray
//
// Description:
//
//   Decodes bounded string array.
//
// Parameters:
//
//   - value:
//     The value supplied to the operation.
//
//   - maximumLength:
//     The maximum length supplied to the operation.
//
//   - decodeString:
//     The decode string supplied to the operation.
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

function decodeBoundedStringArray (
    value: unknown,
    maximumLength: number,
    decodeString: ( item: unknown ) => item is string,
): readonly string[] | null
{
    // Return the decode array result.

    return decodeArray ( value, maximumLength, item => decodeString ( item ) ? item : null );
}

//--------------------------------------------------------------------------------------------------
// Function: freezeDecodedValue
//
// Description:
//
//   Derives the freeze decoded value.
//
// Parameters:
//
//   - rootValue:
//     The root value supplied to the operation.
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

function freezeDecodedValue<Value extends object> ( rootValue: Value ): Value
{
    // Initialize the local values needed by this operation.

    const pendingObjects: object[] = [ rootValue ];
    const visitedObjects           = new WeakSet<object> ();
    const orderedObjects: object[] = [];

    // Continue the operation while its terminating condition has not been reached.

    while ( pendingObjects.length > 0 )
    {
        // Initialize the local values needed by this operation.

        const value = pendingObjects.pop ();

        // Handle the case where at least one branch condition is satisfied.

        if ( value === undefined || visitedObjects.has ( value ) )
        {
            continue;
        }

        visitedObjects.add ( value );
        orderedObjects.push ( value );

        // Process each property value from the values result collection in order.

        for ( const propertyValue of Object.values ( value ) )
        {
            // Handle the case where all required conditions are satisfied.

            if ( typeof propertyValue === "object" && propertyValue !== null )
            {
                pendingObjects.push ( propertyValue );
            }
        }
    }

    // Repeat the operation across the bounded iteration range.

    for ( let objectIndex = orderedObjects.length - 1; objectIndex >= 0; objectIndex-- )
    {
        // Initialize the local values needed by this operation.

        const value = orderedObjects [ objectIndex ];

        // Handle the case where value differs from undefined.

        if ( value !== undefined )
        {
            Object.freeze ( value );
        }
    }

    // Return the root value.

    return rootValue;
}

//--------------------------------------------------------------------------------------------------
// Function: decodeObservation
//
// Description:
//
//   Decodes observation.
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

function decodeObservation ( value: unknown ): SolverObservationInput | null
{
    // Initialize the local values needed by this operation.

    const observation = exactRecord ( value, [ "name", "startContext", "rawTokens" ] );

    // Handle the case where at least one branch condition is satisfied.

    if ( observation === null || !isBoundedName ( observation [ "name" ] ) ||
        !isSolverStartContext ( observation [ "startContext" ] ) )
    {
        // Return the computed result.

        return null;
    }

    const rawTokens = decodeBoundedStringArray (
        observation [ "rawTokens" ],
        MAXIMUM_SOLVER_TOKEN_COUNT,
        item => isBoundedText ( item, MAXIMUM_SOLVER_TOKEN_CODE_POINT_COUNT ),
    );

    // Return the result selected by the current condition.

    return rawTokens === null
        ? null
        : { name: observation [ "name" ], startContext: observation [ "startContext" ], rawTokens };
}

//--------------------------------------------------------------------------------------------------
// Function: decodeInferenceRequest
//
// Description:
//
//   Decodes inference request.
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

function decodeInferenceRequest ( value: unknown ): SolverInferenceRequest | null
{
    // Initialize the local values needed by this operation.

    const request = exactRecord ( value, [ "documentRevision", "solverRevision", "observations" ] );

    // Handle the case where at least one branch condition is satisfied.

    if ( request === null || !isNonNegativeSafeInteger ( request [ "documentRevision" ] ) ||
        !isNonNegativeSafeInteger ( request [ "solverRevision" ] ) )
    {
        // Return the computed result.

        return null;
    }

    const observations = decodeArray (
        request [ "observations" ],
        MAXIMUM_SOLVER_SEQUENCE_COUNT,
        decodeObservation,
    );

    // Handle the case where observations matches an absent value.

    if ( observations === null )
    {
        // Return the computed result.

        return null;
    }

    let tokenCount = 0;

    // Process each observation from the observations collection in order.

    for ( const observation of observations )
    {
        tokenCount += observation.rawTokens.length;

        // Handle the case where token count exceeds maximum solver token count.

        if ( tokenCount > MAXIMUM_SOLVER_TOKEN_COUNT )
        {
            // Return the computed result.

            return null;
        }
    }

    // Return the assembled result.

    return {
        documentRevision: request [ "documentRevision" ],
        solverRevision:   request [ "solverRevision" ],
        observations,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: decodeDiagnosticLocation
//
// Description:
//
//   Decodes diagnostic location.
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

function decodeDiagnosticLocation ( value: unknown ): SolverDiagnosticLocation | null
{
    // Initialize the local values needed by this operation.

    const location = exactRecord ( value, [ "sequenceName", "tokenStart", "tokenEndExclusive" ] );

    // Handle the case where at least one branch condition is satisfied.

    if ( location === null || !isBoundedName ( location [ "sequenceName" ] ) ||
        !isNonNegativeSafeInteger ( location [ "tokenStart" ] ) ||
        !isNonNegativeSafeInteger ( location [ "tokenEndExclusive" ] ) ||
        location [ "tokenStart" ] > location [ "tokenEndExclusive" ] ||
        location [ "tokenEndExclusive" ] > MAXIMUM_SOLVER_TOKEN_COUNT )
    {
        // Return the computed result.

        return null;
    }

    // Return the assembled result.

    return {
        sequenceName:      location [ "sequenceName" ],
        tokenStart:        location [ "tokenStart" ],
        tokenEndExclusive: location [ "tokenEndExclusive" ],
    };
}

//--------------------------------------------------------------------------------------------------
// Function: isSolverDiagnosticCode
//
// Description:
//
//   Determines whether solver diagnostic code.
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

function isSolverDiagnosticCode ( value: unknown ): value is SolverObservationDiagnostic["code"]
{
    // Dispatch according to the value value.

    switch ( value )
    {
        // Handle the group of case values that share the following outcome.

        case "ACTION_WORD_CONFLICT":
        case "CAPACITY_EXCEEDED":
        case "DETERMINISM_CONFLICT":
        case "INITIAL_STATE_CONFLICT":
        case "MULTIPLE_STATES_IN_INTERVAL":
        case "NO_OBSERVATIONS":
        case "SOLVER_CANCELLED":
        case "SOLVER_FAILURE":
        case "SOLVER_TOKEN_INVALID":

            // Return the computed result.

            return true;

        // Handle values not matched by an earlier case.

        default:

            // Return the computed result.

            return false;
    }
}

//--------------------------------------------------------------------------------------------------
// Function: decodeDiagnostic
//
// Description:
//
//   Decodes diagnostic.
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

function decodeDiagnostic ( value: unknown ): SolverObservationDiagnostic | null
{
    // Initialize the local values needed by this operation.

    const diagnostic = exactRecord (
        value,
        [ "code", "severity", "message", "remediation", "relatedLocations" ],
    );

    // Handle the case where at least one branch condition is satisfied.

    if ( diagnostic === null || !isSolverDiagnosticCode ( diagnostic [ "code" ] ) ||
        diagnostic [ "severity" ] !== "error" && diagnostic [ "severity" ] !== "warning" ||
        !isBoundedText ( diagnostic [ "message" ] ) || !isBoundedText ( diagnostic [ "remediation" ] ) )
    {
        // Return the computed result.

        return null;
    }

    const relatedLocations = decodeArray (
        diagnostic [ "relatedLocations" ],
        MAXIMUM_SOLVER_TOKEN_COUNT,
        decodeDiagnosticLocation,
    );

    // Return the result selected by the current condition.

    return relatedLocations === null
        ? null
        : {
            code: diagnostic [ "code" ],
            severity: diagnostic [ "severity" ],
            message: diagnostic [ "message" ],
            remediation: diagnostic [ "remediation" ],
            relatedLocations,
        };
}

//--------------------------------------------------------------------------------------------------
// Function: decodeDiagnostics
//
// Description:
//
//   Decodes diagnostics.
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

function decodeDiagnostics ( value: unknown ): readonly SolverObservationDiagnostic[] | null
{
    // Return the decode array result.

    return decodeArray ( value, MAXIMUM_SOLVER_WORKER_DIAGNOSTIC_COUNT, decodeDiagnostic );
}

//--------------------------------------------------------------------------------------------------
// Function: decodeNamedEntity
//
// Description:
//
//   Decodes named entity.
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

function decodeNamedEntity ( value: unknown ): NamedEntity | null
{
    // Initialize the local values needed by this operation.

    const entity = exactRecord ( value, [ "name", "description" ] );

    // Return the result selected by the current condition.

    return entity !== null && isBoundedName ( entity [ "name" ] ) && isBoundedText ( entity [ "description" ] )
        ? { name: entity [ "name" ], description: entity [ "description" ] }
        : null;
}

//--------------------------------------------------------------------------------------------------
// Function: decodeActionMapping
//
// Description:
//
//   Decodes action mapping.
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

function decodeActionMapping ( value: unknown ): StateActionMapping | null
{
    // Initialize the local values needed by this operation.

    const mapping = exactRecord ( value, [ "state", "action" ] );

    // Return the result selected by the current condition.

    return mapping !== null && isBoundedName ( mapping [ "state" ] ) && isBoundedName ( mapping [ "action" ] )
        ? { state: mapping [ "state" ], action: mapping [ "action" ] }
        : null;
}

//--------------------------------------------------------------------------------------------------
// Function: decodeTransition
//
// Description:
//
//   Decodes transition.
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

function decodeTransition ( value: unknown ): TransitionDefinition | null
{
    // Initialize the local values needed by this operation.

    const transition = exactRecord ( value, [ "state", "event", "stateNext" ] );

    // Return the result selected by the current condition.

    return transition !== null && isBoundedName ( transition [ "state" ] ) &&
        isBoundedName ( transition [ "event" ] ) && isBoundedName ( transition [ "stateNext" ] )
        ? {
            state:     transition [ "state" ],
            event:     transition [ "event" ],
            stateNext: transition [ "stateNext" ],
        }
        : null;
}

//--------------------------------------------------------------------------------------------------
// Function: decodeStateActionDefinitions
//
// Description:
//
//   Decodes state action definitions.
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

function decodeStateActionDefinitions ( value: unknown ): StateActionDefinitions | null
{
    // Initialize the local values needed by this operation.

    const definitions = exactRecord ( value, [ "entry", "exit" ] );

    // Handle the case where definitions matches an absent value.

    if ( definitions === null )
    {
        // Return the computed result.

        return null;
    }

    // Initialize the local values needed by this operation.

    const entry = decodeArray ( definitions [ "entry" ], MAXIMUM_ENTRY_ACTION_COUNT, decodeActionMapping );
    const exit  = decodeArray ( definitions [ "exit" ], MAXIMUM_EXIT_ACTION_COUNT, decodeActionMapping );

    // Return the result selected by the current condition.

    return entry === null || exit === null ? null : { entry, exit };
}

//--------------------------------------------------------------------------------------------------
// Function: decodeStateMachine
//
// Description:
//
//   Decodes state machine.
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

function decodeStateMachine ( value: unknown ): StateMachineDefinition<string> | null
{
    // Initialize the local values needed by this operation.

    const stateMachine = exactRecord (
        value,
        [ "initialState", "events", "states", "actions", "stateActions", "transitionTable" ],
    );

    // Handle the case where at least one branch condition is satisfied.

    if ( stateMachine === null || !isBoundedName ( stateMachine [ "initialState" ] ) )
    {
        // Return the computed result.

        return null;
    }

    // Initialize the local values needed by this operation.

    const events          = decodeArray ( stateMachine [ "events" ], MAXIMUM_EVENT_COUNT, decodeNamedEntity );
    const states          = decodeArray ( stateMachine [ "states" ], MAXIMUM_STATE_COUNT, decodeNamedEntity );
    const actions         = decodeArray ( stateMachine [ "actions" ], MAXIMUM_ACTION_COUNT, decodeNamedEntity );
    const stateActions    = decodeStateActionDefinitions ( stateMachine [ "stateActions" ] );
    const transitionTable = decodeArray (
        stateMachine [ "transitionTable" ],
        MAXIMUM_TRANSITION_COUNT,
        decodeTransition,
    );

    // Return the result selected by the current condition.

    return events === null || states === null || actions === null || stateActions === null || transitionTable === null
        ? null
        : {
            initialState: stateMachine [ "initialState" ],
            events,
            states,
            actions,
            stateActions,
            transitionTable,
        };
}

//--------------------------------------------------------------------------------------------------
// Function: decodePoint
//
// Description:
//
//   Decodes point.
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

function decodePoint ( value: unknown ): ChartPoint | null
{
    // Initialize the local values needed by this operation.

    const point = exactRecord ( value, [ "x", "y" ] );

    // Return the result selected by the current condition.

    return point !== null && isFiniteNumber ( point [ "x" ] ) && isFiniteNumber ( point [ "y" ] )
        ? { x: point [ "x" ], y: point [ "y" ] }
        : null;
}

//--------------------------------------------------------------------------------------------------
// Function: decodeInitialStateIndicator
//
// Description:
//
//   Decodes initial state indicator.
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

function decodeInitialStateIndicator ( value: unknown ): ChartInitialStateIndicator | null
{
    // Initialize the local values needed by this operation.

    const indicator = exactRecord ( value, [ "x", "y" ], [ "state" ] );

    // Handle the case where at least one branch condition is satisfied.

    if ( indicator === null || !isFiniteNumber ( indicator [ "x" ] ) || !isFiniteNumber ( indicator [ "y" ] ) ||
        Object.hasOwn ( indicator, "state" ) && indicator [ "state" ] !== null &&
        !isBoundedName ( indicator [ "state" ] ) )
    {
        // Return the computed result.

        return null;
    }

    // Return the result selected by the current condition.

    return Object.hasOwn ( indicator, "state" )
        ? { state: indicator [ "state" ] as string | null, x: indicator [ "x" ], y: indicator [ "y" ] }
        : { x: indicator [ "x" ], y: indicator [ "y" ] };
}

//--------------------------------------------------------------------------------------------------
// Function: decodeTerminalStateIndicator
//
// Description:
//
//   Decodes terminal state indicator.
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

function decodeTerminalStateIndicator ( value: unknown ): TerminalStateIndicator | null
{
    // Initialize the local values needed by this operation.

    const indicator = exactRecord ( value, [ "id", "x", "y" ] );

    // Return the result selected by the current condition.

    return indicator !== null && isNonNegativeSafeInteger ( indicator [ "id" ] ) &&
        isFiniteNumber ( indicator [ "x" ] ) && isFiniteNumber ( indicator [ "y" ] )
        ? { id: indicator [ "id" ], x: indicator [ "x" ], y: indicator [ "y" ] }
        : null;
}

//--------------------------------------------------------------------------------------------------
// Function: decodeTerminalStateTransition
//
// Description:
//
//   Decodes terminal state transition.
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

function decodeTerminalStateTransition ( value: unknown ): TerminalStateIndicatorTransition | null
{
    // Initialize the local values needed by this operation.

    const transition = exactRecord ( value, [ "state", "terminalStateIndicatorId" ] );

    // Return the result selected by the current condition.

    return transition !== null && isBoundedName ( transition [ "state" ] ) &&
        isNonNegativeSafeInteger ( transition [ "terminalStateIndicatorId" ] )
        ? {
            state: transition [ "state" ],
            terminalStateIndicatorId: transition [ "terminalStateIndicatorId" ],
        }
        : null;
}

//--------------------------------------------------------------------------------------------------
// Function: decodeChartStatePlacement
//
// Description:
//
//   Decodes chart state placement.
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

function decodeChartStatePlacement ( value: unknown ): ChartStatePlacement | null
{
    // Initialize the local values needed by this operation.

    const placement = exactRecord ( value, [ "state", "x", "y" ], [ "height" ] );

    // Handle the case where at least one branch condition is satisfied.

    if ( placement === null || !isBoundedName ( placement [ "state" ] ) ||
        !isFiniteNumber ( placement [ "x" ] ) || !isFiniteNumber ( placement [ "y" ] ) ||
        Object.hasOwn ( placement, "height" ) &&
        ( !isFiniteNumber ( placement [ "height" ] ) || placement [ "height" ] <= 0 ) )
    {
        // Return the computed result.

        return null;
    }

    // Return the result selected by the current condition.

    return Object.hasOwn ( placement, "height" )
        ? {
            state: placement [ "state" ],
            x: placement [ "x" ],
            y: placement [ "y" ],
            height: placement [ "height" ] as number,
        }
        : { state: placement [ "state" ], x: placement [ "x" ], y: placement [ "y" ] };
}

//--------------------------------------------------------------------------------------------------
// Function: decodeDraftTransition
//
// Description:
//
//   Decodes draft transition.
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

function decodeDraftTransition ( value: unknown ): ChartDraftTransition | null
{
    // Initialize the local values needed by this operation.

    const transition = exactRecord ( value, [ "id", "source", "target" ] );

    // Handle the case where at least one branch condition is satisfied.

    if ( transition === null || !isNonNegativeSafeInteger ( transition [ "id" ] ) )
    {
        // Return the computed result.

        return null;
    }

    // Initialize the local values needed by this operation.

    const source = decodePoint ( transition [ "source" ] );
    const target = decodePoint ( transition [ "target" ] );

    // Return the result selected by the current condition.

    return source === null || target === null ? null : { id: transition [ "id" ], source, target };
}

//--------------------------------------------------------------------------------------------------
// Function: decodeChart
//
// Description:
//
//   Decodes chart.
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

function decodeChart ( value: unknown ): ChartProjection | null
{
    // Initialize the local values needed by this operation.

    const chart = exactRecord ( value, [ "settings", "indicators", "states", "draftTransitions" ] );

    // Handle the case where chart matches an absent value.

    if ( chart === null )
    {
        // Return the computed result.

        return null;
    }

    // Initialize the local values needed by this operation.

    const settings   = exactRecord ( chart [ "settings" ], [ "expandStates" ] );
    const indicators = exactRecord (
        chart [ "indicators" ],
        [ "initialStateIndicator", "terminalStateIndicators", "terminalStateTransitions" ],
    );

    // Handle the case where at least one branch condition is satisfied.

    if ( settings === null || typeof settings [ "expandStates" ] !== "boolean" || indicators === null )
    {
        // Return the computed result.

        return null;
    }

    // Initialize the local values needed by this operation.

    const initialIndicatorValue = indicators [ "initialStateIndicator" ];
    const initialStateIndicator = initialIndicatorValue === null
        ? null
        : decodeInitialStateIndicator ( initialIndicatorValue );
    const terminalStateIndicators = decodeArray (
        indicators [ "terminalStateIndicators" ],
        MAXIMUM_CHART_TERMINAL_INDICATOR_COUNT,
        decodeTerminalStateIndicator,
    );
    const terminalStateTransitions = decodeArray (
        indicators [ "terminalStateTransitions" ],
        MAXIMUM_CHART_TERMINAL_RELATION_COUNT,
        decodeTerminalStateTransition,
    );
    const states           = decodeArray ( chart [ "states" ], MAXIMUM_STATE_COUNT, decodeChartStatePlacement );
    const draftTransitions = decodeArray (
        chart [ "draftTransitions" ],
        MAXIMUM_CHART_DRAFT_TRANSITION_COUNT,
        decodeDraftTransition,
    );

    // Handle the case where at least one branch condition is satisfied.

    if ( initialIndicatorValue !== null && initialStateIndicator === null || terminalStateIndicators === null ||
        terminalStateTransitions === null || states === null || draftTransitions === null )
    {
        // Return the computed result.

        return null;
    }

    // Return the assembled result.

    return {
        settings: { expandStates: settings [ "expandStates" ] },
        indicators: { initialStateIndicator, terminalStateIndicators, terminalStateTransitions },
        states,
        draftTransitions,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: decodeSourceRange
//
// Description:
//
//   Decodes source range.
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

function decodeSourceRange ( value: unknown ): SolverCandidateSourceRange | null
{
    // Initialize the local values needed by this operation.

    const sourceRange = exactRecord ( value, [ "sequenceName", "tokenStart", "tokenEndExclusive" ] );

    // Handle the case where at least one branch condition is satisfied.

    if ( sourceRange === null || !isBoundedName ( sourceRange [ "sequenceName" ] ) ||
        !isNonNegativeSafeInteger ( sourceRange [ "tokenStart" ] ) ||
        !isNonNegativeSafeInteger ( sourceRange [ "tokenEndExclusive" ] ) ||
        sourceRange [ "tokenStart" ] > sourceRange [ "tokenEndExclusive" ] ||
        sourceRange [ "tokenEndExclusive" ] > MAXIMUM_SOLVER_TOKEN_COUNT )
    {
        // Return the computed result.

        return null;
    }

    // Return the assembled result.

    return {
        sequenceName:      sourceRange [ "sequenceName" ],
        tokenStart:        sourceRange [ "tokenStart" ],
        tokenEndExclusive: sourceRange [ "tokenEndExclusive" ],
    };
}

//--------------------------------------------------------------------------------------------------
// Function: decodeEvidenceKind
//
// Description:
//
//   Decodes evidence kind.
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

function decodeEvidenceKind ( value: unknown ): "inferred" | "observed" | null
{
    // Return the result selected by the current condition.

    return value === "inferred" || value === "observed" ? value : null;
}

//--------------------------------------------------------------------------------------------------
// Function: decodeStateProvenance
//
// Description:
//
//   Decodes state provenance.
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

function decodeStateProvenance ( value: unknown ): SolverCandidateStateProvenance | null
{
    // Initialize the local values needed by this operation.

    const provenance = exactRecord ( value, [ "state", "evidence", "sources" ] );

    // Handle the case where at least one branch condition is satisfied.

    if ( provenance === null || !isBoundedName ( provenance [ "state" ] ) )
    {
        // Return the computed result.

        return null;
    }

    // Initialize the local values needed by this operation.

    const evidence = decodeEvidenceKind ( provenance [ "evidence" ] );
    const sources  = decodeArray ( provenance [ "sources" ], MAXIMUM_SOLVER_TOKEN_COUNT, decodeSourceRange );

    // Return the result selected by the current condition.

    return evidence === null || sources === null
        ? null
        : { state: provenance [ "state" ], evidence, sources };
}

//--------------------------------------------------------------------------------------------------
// Function: decodeTransitionProvenance
//
// Description:
//
//   Decodes transition provenance.
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

function decodeTransitionProvenance ( value: unknown ): SolverCandidateTransitionProvenance | null
{
    // Initialize the local values needed by this operation.

    const provenance = exactRecord ( value, [ "state", "event", "stateNext", "evidence", "sources" ] );

    // Handle the case where at least one branch condition is satisfied.

    if ( provenance === null || !isBoundedName ( provenance [ "state" ] ) ||
        !isBoundedName ( provenance [ "event" ] ) || !isBoundedName ( provenance [ "stateNext" ] ) )
    {
        // Return the computed result.

        return null;
    }

    // Initialize the local values needed by this operation.

    const evidence = decodeEvidenceKind ( provenance [ "evidence" ] );
    const sources  = decodeArray ( provenance [ "sources" ], MAXIMUM_SOLVER_TOKEN_COUNT, decodeSourceRange );

    // Return the result selected by the current condition.

    return evidence === null || sources === null
        ? null
        : {
            state: provenance [ "state" ],
            event: provenance [ "event" ],
            stateNext: provenance [ "stateNext" ],
            evidence,
            sources,
        };
}

//--------------------------------------------------------------------------------------------------
// Function: decodeCandidateProvenance
//
// Description:
//
//   Decodes candidate provenance.
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

function decodeCandidateProvenance ( value: unknown ): SolverCandidateProvenance | null
{
    // Initialize the local values needed by this operation.

    const provenance = exactRecord (
        value,
        [ "observedStateNames", "generatedStateNames", "reportEntries", "states", "transitions" ],
    );

    // Handle the case where provenance matches an absent value.

    if ( provenance === null )
    {
        // Return the computed result.

        return null;
    }

    // Initialize the local values needed by this operation.

    const observedStateNames = decodeBoundedStringArray (
        provenance [ "observedStateNames" ],
        MAXIMUM_STATE_COUNT,
        isBoundedName,
    );
    const generatedStateNames = decodeBoundedStringArray (
        provenance [ "generatedStateNames" ],
        MAXIMUM_STATE_COUNT,
        isBoundedName,
    );
    const reportEntries = decodeBoundedStringArray (
        provenance [ "reportEntries" ],
        MAXIMUM_SOLVER_WORKER_REPORT_ENTRY_COUNT,
        item => isBoundedText ( item ),
    );
    const states      = decodeArray ( provenance [ "states" ], MAXIMUM_STATE_COUNT, decodeStateProvenance );
    const transitions = decodeArray (
        provenance [ "transitions" ],
        MAXIMUM_TRANSITION_COUNT,
        decodeTransitionProvenance,
    );

    // Return the result selected by the current condition.

    return observedStateNames === null || generatedStateNames === null || reportEntries === null || states === null ||
        transitions === null
        ? null
        : { observedStateNames, generatedStateNames, reportEntries, states, transitions };
}

//--------------------------------------------------------------------------------------------------
// Function: decodeCoverageInterval
//
// Description:
//
//   Decodes coverage interval.
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

function decodeCoverageInterval ( value: unknown ): SolverCandidateCoverageInterval | null
{
    // Initialize the local values needed by this operation.

    const interval = exactRecord (
        value,
        [ "intervalIndex", "state", "incomingEvent", "entryActions", "tokenStart", "tokenEndExclusive" ],
    );

    // Handle the case where at least one branch condition is satisfied.

    if ( interval === null || !isNonNegativeSafeInteger ( interval [ "intervalIndex" ] ) ||
        !isBoundedName ( interval [ "state" ] ) || interval [ "incomingEvent" ] !== null &&
        !isBoundedName ( interval [ "incomingEvent" ] ) ||
        !isNonNegativeSafeInteger ( interval [ "tokenStart" ] ) ||
        !isNonNegativeSafeInteger ( interval [ "tokenEndExclusive" ] ) ||
        interval [ "tokenStart" ] > interval [ "tokenEndExclusive" ] ||
        interval [ "tokenEndExclusive" ] > MAXIMUM_SOLVER_TOKEN_COUNT )
    {
        // Return the computed result.

        return null;
    }

    const entryActions = decodeBoundedStringArray (
        interval [ "entryActions" ],
        MAXIMUM_SOLVER_TOKEN_COUNT,
        isBoundedName,
    );

    // Return the result selected by the current condition.

    return entryActions === null
        ? null
        : {
            intervalIndex: interval [ "intervalIndex" ],
            state: interval [ "state" ],
            incomingEvent: interval [ "incomingEvent" ] as string | null,
            entryActions,
            tokenStart: interval [ "tokenStart" ],
            tokenEndExclusive: interval [ "tokenEndExclusive" ],
        };
}

//--------------------------------------------------------------------------------------------------
// Function: decodeTraceCoverage
//
// Description:
//
//   Decodes trace coverage.
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

function decodeTraceCoverage ( value: unknown ): SolverCandidateTraceCoverage | null
{
    // Initialize the local values needed by this operation.

    const trace = exactRecord ( value, [ "sequenceName", "startContext", "intervals", "isSuccessful" ] );

    // Handle the case where at least one branch condition is satisfied.

    if ( trace === null || !isBoundedName ( trace [ "sequenceName" ] ) ||
        !isSolverStartContext ( trace [ "startContext" ] ) || trace [ "isSuccessful" ] !== true )
    {
        // Return the computed result.

        return null;
    }

    const intervals = decodeArray ( trace [ "intervals" ], MAXIMUM_SOLVER_TOKEN_COUNT, decodeCoverageInterval );

    // Return the result selected by the current condition.

    return intervals === null
        ? null
        : {
            sequenceName: trace [ "sequenceName" ],
            startContext: trace [ "startContext" ],
            intervals,
            isSuccessful: true,
        };
}

//--------------------------------------------------------------------------------------------------
// Function: decodeInferenceReportEntry
//
// Description:
//
//   Decodes inference report entry.
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

function decodeInferenceReportEntry ( value: unknown ): SolverInferenceReportEntry | null
{
    // Initialize the local values needed by this operation.

    const entry    = exactRecord ( value, [ "code", "category", "summary", "detail" ] );
    const category = entry?.[ "category" ];

    // Handle the case where at least one branch condition is satisfied.

    if ( entry === null || !isBoundedIdentifier ( entry [ "code" ] ) ||
        category !== "assumption" && category !== "conflict" && category !== "merge" &&
        category !== "provenance" && category !== "summary" ||
        !isBoundedText ( entry [ "summary" ] ) || !isBoundedText ( entry [ "detail" ] ) )
    {
        // Return the computed result.

        return null;
    }

    // Return the assembled result.

    return {
        code: entry [ "code" ],
        category,
        summary: entry [ "summary" ],
        detail: entry [ "detail" ],
    };
}

const STATISTIC_KEYS =
[
    "observationCount",
    "inputTokenCount",
    "evidenceStateCount",
    "candidateStateCount",
    "transitionCount",
    "generatedStateCount",
    "consideredMergeCount",
    "acceptedMergeCount",
    "rejectedMergeCount",
] as const;

//--------------------------------------------------------------------------------------------------
// Function: decodeStatistics
//
// Description:
//
//   Decodes statistics.
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

function decodeStatistics ( value: unknown ): SolverCandidateStatistics | null
{
    // Initialize the local values needed by this operation.

    const statistics = exactRecord ( value, STATISTIC_KEYS );

    // Handle the case where at least one branch condition is satisfied.

    if ( statistics === null || STATISTIC_KEYS.some ( key => !isNonNegativeSafeInteger ( statistics [ key ] ) ) )
    {
        // Return the computed result.

        return null;
    }

    const decodedStatistics: SolverCandidateStatistics = {
        observationCount: statistics [ "observationCount" ] as number,
        inputTokenCount: statistics [ "inputTokenCount" ] as number,
        evidenceStateCount: statistics [ "evidenceStateCount" ] as number,
        candidateStateCount: statistics [ "candidateStateCount" ] as number,
        transitionCount: statistics [ "transitionCount" ] as number,
        generatedStateCount: statistics [ "generatedStateCount" ] as number,
        consideredMergeCount: statistics [ "consideredMergeCount" ] as number,
        acceptedMergeCount: statistics [ "acceptedMergeCount" ] as number,
        rejectedMergeCount: statistics [ "rejectedMergeCount" ] as number,
    };

    // Return the result selected by the current condition.

    return decodedStatistics.observationCount <= MAXIMUM_SOLVER_SEQUENCE_COUNT &&
        decodedStatistics.inputTokenCount <= MAXIMUM_SOLVER_TOKEN_COUNT &&
        decodedStatistics.evidenceStateCount <= MAXIMUM_STATE_COUNT &&
        decodedStatistics.candidateStateCount <= MAXIMUM_STATE_COUNT &&
        decodedStatistics.transitionCount <= MAXIMUM_TRANSITION_COUNT &&
        decodedStatistics.generatedStateCount <= MAXIMUM_STATE_COUNT &&
        decodedStatistics.acceptedMergeCount <= decodedStatistics.consideredMergeCount &&
        decodedStatistics.rejectedMergeCount <= decodedStatistics.consideredMergeCount
        ? decodedStatistics
        : null;
}

//--------------------------------------------------------------------------------------------------
// Function: decodeCandidate
//
// Description:
//
//   Decodes candidate.
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

function decodeCandidate ( value: unknown ): SolverCandidate | null
{
    // Initialize the local values needed by this operation.

    const candidate = exactRecord (
        value,
        [
            "stateMachine",
            "chart",
            "baselineDocumentRevision",
            "baselineSolverRevision",
            "provenance",
            "traceCoverage",
            "inferenceReport",
            "statistics",
            "consistencyStatement",
        ],
    );

    // Handle the case where at least one branch condition is satisfied.

    if ( candidate === null || !isNonNegativeSafeInteger ( candidate [ "baselineDocumentRevision" ] ) ||
        !isNonNegativeSafeInteger ( candidate [ "baselineSolverRevision" ] ) ||
        !isBoundedText ( candidate [ "consistencyStatement" ] ) )
    {
        // Return the computed result.

        return null;
    }

    // Initialize the local values needed by this operation.

    const stateMachine  = decodeStateMachine ( candidate [ "stateMachine" ] );
    const chart         = decodeChart ( candidate [ "chart" ] );
    const provenance    = decodeCandidateProvenance ( candidate [ "provenance" ] );
    const traceCoverage = decodeArray (
        candidate [ "traceCoverage" ],
        MAXIMUM_SOLVER_SEQUENCE_COUNT,
        decodeTraceCoverage,
    );
    const inferenceReport = decodeArray (
        candidate [ "inferenceReport" ],
        MAXIMUM_SOLVER_WORKER_REPORT_ENTRY_COUNT,
        decodeInferenceReportEntry,
    );
    const statistics = decodeStatistics ( candidate [ "statistics" ] );

    // Handle the case where at least one branch condition is satisfied.

    if ( stateMachine === null || chart === null || provenance === null || traceCoverage === null ||
        inferenceReport === null || statistics === null ||
        statistics.observationCount !== traceCoverage.length ||
        statistics.candidateStateCount !== stateMachine.states.length ||
        statistics.transitionCount !== stateMachine.transitionTable.length ||
        statistics.generatedStateCount !== provenance.generatedStateNames.length )
    {
        // Return the computed result.

        return null;
    }

    // Return the assembled result.

    return {
        stateMachine,
        chart,
        baselineDocumentRevision: candidate [ "baselineDocumentRevision" ],
        baselineSolverRevision: candidate [ "baselineSolverRevision" ],
        provenance,
        traceCoverage,
        inferenceReport,
        statistics,
        consistencyStatement: candidate [ "consistencyStatement" ],
    };
}

//--------------------------------------------------------------------------------------------------
// Function: decodeInferenceResult
//
// Description:
//
//   Decodes inference result.
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

function decodeInferenceResult ( value: unknown ): SolverInferenceResult | null
{
    // Handle the case where the is plain record result condition is not satisfied.

    if ( !isPlainRecord ( value ) )
    {
        // Return the computed result.

        return null;
    }

    // Handle the case where selected collection value matches the failure value.

    if ( value [ "status" ] === "failure" )
    {
        // Initialize the local values needed by this operation.

        const result      = exactRecord ( value, [ "status", "diagnostics" ] );
        const diagnostics = result === null ? null : decodeDiagnostics ( result [ "diagnostics" ] );

        // Return the result selected by the current condition.

        return result === null || diagnostics === null ? null : { status: "failure", diagnostics };
    }

    // Handle the case where selected collection value differs from the success value.

    if ( value [ "status" ] !== "success" )
    {
        // Return the computed result.

        return null;
    }

    const result = exactRecord ( value, [ "status", "candidate", "diagnostics" ] );

    // Handle the case where result matches an absent value.

    if ( result === null )
    {
        // Return the computed result.

        return null;
    }

    // Initialize the local values needed by this operation.

    const candidate   = decodeCandidate ( result [ "candidate" ] );
    const diagnostics = decodeDiagnostics ( result [ "diagnostics" ] );

    // Return the result selected by the current condition.

    return candidate === null || diagnostics === null ? null : { status: "success", candidate, diagnostics };
}

//--------------------------------------------------------------------------------------------------
// Function: decodeProgress
//
// Description:
//
//   Decodes progress.
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

function decodeProgress ( value: unknown ): SolverProgress | null
{
    // Initialize the local values needed by this operation.

    const progress = exactRecord ( value, [ "completedWork", "totalWork", "message" ] );

    // Return the result selected by the current condition.

    return progress !== null && isNonNegativeSafeInteger ( progress [ "completedWork" ] ) &&
        isNonNegativeSafeInteger ( progress [ "totalWork" ] ) && progress [ "totalWork" ] > 0 &&
        progress [ "completedWork" ] <= progress [ "totalWork" ] &&
        isBoundedText ( progress [ "message" ] ) && progress [ "message" ].trim ().length > 0
        ? {
            completedWork: progress [ "completedWork" ],
            totalWork: progress [ "totalWork" ],
            message: progress [ "message" ],
        }
        : null;
}

//--------------------------------------------------------------------------------------------------
// Function: decodeSolverWorkerRequest
//
// Description:
//
//   Decodes solver worker request.
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

export function decodeSolverWorkerRequest ( value: unknown ): SolverWorkerSolveRequest | null
{
    // Run the operation that may report a recoverable failure.

    try
    {
        // Handle the case where the inspect protocol value result condition is not satisfied.

        if ( !inspectProtocolValue ( value ) )
        {
            // Return the computed result.

            return null;
        }

        const envelope = exactRecord ( value, [ "protocolVersion", "kind", "jobId", "request" ] );

        // Handle the case where at least one branch condition is satisfied.

        if ( envelope === null || envelope [ "protocolVersion" ] !== SOLVER_PROTOCOL_VERSION ||
            envelope [ "kind" ] !== "solve" || !isBoundedIdentifier ( envelope [ "jobId" ] ) )
        {
            // Return the computed result.

            return null;
        }

        const request = decodeInferenceRequest ( envelope [ "request" ] );

        // Return the result selected by the current condition.

        return request === null
            ? null
            : freezeDecodedValue ( {
                protocolVersion: SOLVER_PROTOCOL_VERSION as typeof SOLVER_PROTOCOL_VERSION,
                kind: "solve" as const,
                jobId: envelope [ "jobId" ],
                request,
            } );
    }
    catch
    {
        // Recover from the reported failure without hiding its outcome.

        return null;
    }
}

//--------------------------------------------------------------------------------------------------
// Function: decodeSolverWorkerMessage
//
// Description:
//
//   Decodes solver worker message.
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

export function decodeSolverWorkerMessage ( value: unknown ): SolverWorkerMessage | null
{
    // Run the operation that may report a recoverable failure.

    try
    {
        // Handle the case where the inspect protocol value result condition is not satisfied.

        if ( !inspectProtocolValue ( value ) )
        {
            // Return the computed result.

            return null;
        }

        const commonEnvelope = exactRecord (
            value,
            [ "protocolVersion", "kind", "jobId" ],
            [ "progress", "result" ],
        );

        // Handle the case where at least one branch condition is satisfied.

        if ( commonEnvelope === null || commonEnvelope [ "protocolVersion" ] !== SOLVER_PROTOCOL_VERSION ||
            !isBoundedIdentifier ( commonEnvelope [ "jobId" ] ) )
        {
            // Return the computed result.

            return null;
        }

        // Handle the case where selected collection value matches the progress value.

        if ( commonEnvelope [ "kind" ] === "progress" )
        {
            // Initialize the local values needed by this operation.

            const envelope = exactRecord ( value, [ "protocolVersion", "kind", "jobId", "progress" ] );
            const progress = envelope === null ? null : decodeProgress ( envelope [ "progress" ] );

            // Return the result selected by the current condition.

            return envelope === null || progress === null
                ? null
                : freezeDecodedValue ( {
                    protocolVersion: SOLVER_PROTOCOL_VERSION as typeof SOLVER_PROTOCOL_VERSION,
                    kind: "progress" as const,
                    jobId: commonEnvelope [ "jobId" ],
                    progress,
                } );
        }

        // Handle the case where selected collection value differs from the result value.

        if ( commonEnvelope [ "kind" ] !== "result" )
        {
            // Return the computed result.

            return null;
        }

        // Initialize the local values needed by this operation.

        const envelope = exactRecord ( value, [ "protocolVersion", "kind", "jobId", "result" ] );
        const result   = envelope === null ? null : decodeInferenceResult ( envelope [ "result" ] );

        // Return the result selected by the current condition.

        return envelope === null || result === null
            ? null
            : freezeDecodedValue ( {
                protocolVersion: SOLVER_PROTOCOL_VERSION as typeof SOLVER_PROTOCOL_VERSION,
                kind: "result" as const,
                jobId: commonEnvelope [ "jobId" ],
                result,
            } );
    }
    catch
    {
        // Recover from the reported failure without hiding its outcome.

        return null;
    }
}

//--------------------------------------------------------------------------------------------------
// Function: isSolverWorkerMessage
//
// Description:
//
//   Determines whether solver worker message.
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

export function isSolverWorkerMessage ( value: unknown ): value is SolverWorkerMessage
{
    // Return the computed result.

    return decodeSolverWorkerMessage ( value ) !== null;
}
