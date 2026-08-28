// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Chart Routing Worker Protocol
// Version: 1.0.0
// Date:    2026-08-12
// Author:  Rohin Gosling
//
// Description:
//
//   Defines and validates bounded versioned messages exchanged with the persistent Chart routing
//   worker.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type
{
    ChartRoutingBoundary,
    ChartRoutingCubicCurve,
    ChartRoutingPoint,
    ChartRoutingRectangle,
    ChartRoutingRelation,
    ChartRoutingRequest,
    ChartRoutingResult,
    ChartRoutingResultRelation,
} from "../application/ports/contracts.js";
import { CHART_ROUTING_OBSTACLE_OFFSET_CONSTRAINTS } from "../configuration/compile-time-configuration.js";

export const CHART_ROUTING_PROTOCOL_VERSION = "automata-lab-chart-routing/4";

export const MAXIMUM_CHART_ROUTING_RELATION_COUNT        = 500;
export const MAXIMUM_CHART_ROUTING_OBSTACLE_COUNT        = 250;
export const MAXIMUM_CHART_ROUTING_PREFERRED_POINT_COUNT = 16;
export const MAXIMUM_CHART_ROUTING_RESULT_POINT_COUNT    = 4_096;
export const MAXIMUM_CHART_ROUTING_RESULT_CURVE_COUNT    = 4_096;
export const MAXIMUM_CHART_ROUTING_TEXT_CODE_POINT_COUNT = 4_096;

const TRANSITION_GRAVITY_POINT_DISTANCE_CONSTRAINTS = CHART_ROUTING_OBSTACLE_OFFSET_CONSTRAINTS;
const FORBIDDEN_PROPERTY_NAMES                      = new Set ( [ "__proto__", "constructor", "prototype" ] );

//--------------------------------------------------------------------------------------------------
// Interface: ChartRoutingWorkerRouteRequest
//
// Description:
//
//   Describes a chart routing worker route request.
//
//--------------------------------------------------------------------------------------------------

export interface ChartRoutingWorkerRouteRequest
{
    readonly generation:      number;
    readonly kind:            "route";
    readonly protocolVersion: typeof CHART_ROUTING_PROTOCOL_VERSION;
    readonly request:         ChartRoutingRequest;
}

//--------------------------------------------------------------------------------------------------
// Interface: ChartRoutingWorkerCancelRequest
//
// Description:
//
//   Describes a chart routing worker cancel request.
//
//--------------------------------------------------------------------------------------------------

export interface ChartRoutingWorkerCancelRequest
{
    readonly generation:      number;
    readonly kind:            "cancel";
    readonly protocolVersion: typeof CHART_ROUTING_PROTOCOL_VERSION;
}

//--------------------------------------------------------------------------------------------------
// Type: ChartRoutingWorkerRequest
//
// Description:
//
//   Describes a chart routing worker request.
//
//--------------------------------------------------------------------------------------------------

export type ChartRoutingWorkerRequest = ChartRoutingWorkerCancelRequest | ChartRoutingWorkerRouteRequest;

//--------------------------------------------------------------------------------------------------
// Interface: ChartRoutingWorkerResult
//
// Description:
//
//   Describes the result produced by chart routing worker.
//
//--------------------------------------------------------------------------------------------------

export interface ChartRoutingWorkerResult
{
    readonly generation:      number;
    readonly kind:            "result";
    readonly protocolVersion: typeof CHART_ROUTING_PROTOCOL_VERSION;
    readonly result:          ChartRoutingResult;
}

//--------------------------------------------------------------------------------------------------
// Interface: ChartRoutingWorkerCancelled
//
// Description:
//
//   Defines the structure of chart routing worker cancelled.
//
//--------------------------------------------------------------------------------------------------

export interface ChartRoutingWorkerCancelled
{
    readonly generation:      number;
    readonly kind:            "cancelled";
    readonly protocolVersion: typeof CHART_ROUTING_PROTOCOL_VERSION;
}

//--------------------------------------------------------------------------------------------------
// Type: ChartRoutingWorkerResponse
//
// Description:
//
//   Describes a chart routing worker response.
//
//--------------------------------------------------------------------------------------------------

export type ChartRoutingWorkerResponse = ChartRoutingWorkerCancelled | ChartRoutingWorkerResult;

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

    // Handle the case where at least one branch condition is satisfied.

    if ( actualKeys.length < requiredKeys.length || actualKeys.length > allowedKeys.length ||
        !requiredKeys.every ( key => Object.hasOwn ( value, key ) ) )
    {
        // Return the computed result.

        return null;
    }

    // Process each actual key from the actual keys collection in order.

    for ( const actualKey of actualKeys )
    {
        // Handle the case where at least one branch condition is satisfied.

        if ( typeof actualKey !== "string" || FORBIDDEN_PROPERTY_NAMES.has ( actualKey ) ||
            !allowedKeys.includes ( actualKey ) )
        {
            // Return the computed result.

            return null;
        }

        const descriptor = Object.getOwnPropertyDescriptor ( value, actualKey );

        // Handle the case where at least one branch condition is satisfied.

        if ( descriptor === undefined || !( "value" in descriptor ) || !descriptor.enumerable )
        {
            // Return the computed result.

            return null;
        }
    }

    // Return the value.

    return value;
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

    if ( !Array.isArray ( value ) || Object.getPrototypeOf ( value ) !== Array.prototype ||
        value.length > maximumLength )
    {
        // Return the computed result.

        return null;
    }

    const propertyKeys = Reflect.ownKeys ( value );

    // Handle the case where at least one branch condition is satisfied.

    if ( propertyKeys.length !== value.length + 1 || !propertyKeys.includes ( "length" ) )
    {
        // Return the computed result.

        return null;
    }

    const decodedItems: Item[] = [];

    // Repeat the operation across the bounded iteration range.

    for ( let itemIndex = 0; itemIndex < value.length; itemIndex++ )
    {
        // Initialize the local values needed by this operation.

        const descriptor = Object.getOwnPropertyDescriptor ( value, String ( itemIndex ) );

        // Handle the case where at least one branch condition is satisfied.

        if ( descriptor === undefined || !( "value" in descriptor ) || !descriptor.enumerable )
        {
            // Return the computed result.

            return null;
        }

        const decodedItem = decodeItem ( descriptor.value );

        // Handle the case where decoded item matches an absent value.

        if ( decodedItem === null )
        {
            // Return the computed result.

            return null;
        }

        decodedItems.push ( decodedItem );
    }

    // Return the freeze result.

    return Object.freeze ( decodedItems );
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

    let codePointCount = 0;

    // Process each character from the value collection in order.

    for ( const _character of value )
    {
        codePointCount++;

        // Handle the case where code point count exceeds maximum code point count.

        if ( codePointCount > maximumCodePointCount )
        {
            // Return the computed result.

            return false;
        }
    }

    // Return the computed result.

    return true;
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

    return typeof value === "string" && value.trim ().length > 0 &&
        codePointCountWithin ( value, MAXIMUM_CHART_ROUTING_TEXT_CODE_POINT_COUNT );
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

function decodePoint ( value: unknown ): ChartRoutingPoint | null
{
    // Initialize the local values needed by this operation.

    const point = exactRecord ( value, [ "x", "y" ] );

    // Return the result selected by the current condition.

    return point !== null && isFiniteNumber ( point [ "x" ] ) && isFiniteNumber ( point [ "y" ] )
        ? Object.freeze ( { x: point [ "x" ], y: point [ "y" ] } )
        : null;
}

//--------------------------------------------------------------------------------------------------
// Function: decodeCubicCurve
//
// Description:
//
//   Decodes cubic curve.
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

function decodeCubicCurve ( value: unknown ): ChartRoutingCubicCurve | null
{
    // Initialize the local values needed by this operation.

    const curve = exactRecord ( value, [ "source", "sourceControl", "target", "targetControl" ] );

    // Handle the case where curve matches an absent value.

    if ( curve === null )
    {
        // Return the computed result.

        return null;
    }

    // Initialize the local values needed by this operation.

    const source        = decodePoint ( curve [ "source" ] );
    const sourceControl = decodePoint ( curve [ "sourceControl" ] );
    const target        = decodePoint ( curve [ "target" ] );
    const targetControl = decodePoint ( curve [ "targetControl" ] );

    // Return the result selected by the current condition.

    return source === null || sourceControl === null || target === null || targetControl === null
        ? null
        : Object.freeze ( { source, sourceControl, target, targetControl } );
}

//--------------------------------------------------------------------------------------------------
// Function: decodeRectangle
//
// Description:
//
//   Decodes rectangle.
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

function decodeRectangle ( value: unknown ): ChartRoutingRectangle | null
{
    // Initialize the local values needed by this operation.

    const rectangle = exactRecord ( value, [ "x", "y", "width", "height" ] );

    // Return the result selected by the current condition.

    return rectangle !== null && isFiniteNumber ( rectangle [ "x" ] ) &&
        isFiniteNumber ( rectangle [ "y" ] ) && isFiniteNumber ( rectangle [ "width" ] ) &&
        rectangle [ "width" ] >= 0 && isFiniteNumber ( rectangle [ "height" ] ) && rectangle [ "height" ] >= 0
        ? Object.freeze ( {
            x: rectangle [ "x" ],
            y: rectangle [ "y" ],
            width: rectangle [ "width" ],
            height: rectangle [ "height" ],
        } )
        : null;
}

//--------------------------------------------------------------------------------------------------
// Function: decodeBoundary
//
// Description:
//
//   Decodes boundary.
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

function decodeBoundary ( value: unknown ): ChartRoutingBoundary | null
{
    // Initialize the local values needed by this operation.

    const boundary = exactRecord ( value, [ "height", "kind", "radius", "width" ], [ "cornerRadius" ] );

    // Handle the case where at least one branch condition is satisfied.

    if ( boundary === null || boundary [ "kind" ] !== "circle" && boundary [ "kind" ] !== "rectangle" ||
        !isFiniteNumber ( boundary [ "width" ] ) || boundary [ "width" ] < 0 ||
        !isFiniteNumber ( boundary [ "height" ] ) || boundary [ "height" ] < 0 ||
        !isFiniteNumber ( boundary [ "radius" ] ) || boundary [ "radius" ] < 0 )
    {
        // Return the computed result.

        return null;
    }

    const hasCornerRadius = Object.hasOwn ( boundary, "cornerRadius" );

    // Handle the case where all required conditions are satisfied.

    if ( hasCornerRadius && ( !isFiniteNumber ( boundary [ "cornerRadius" ] ) || boundary [ "cornerRadius" ] < 0 ) )
    {
        // Return the computed result.

        return null;
    }

    // Return the freeze result.

    return Object.freeze ( {
        ...( hasCornerRadius ? { cornerRadius: boundary [ "cornerRadius" ] as number } : {} ),
        height: boundary [ "height" ],
        kind: boundary [ "kind" ],
        radius: boundary [ "radius" ],
        width: boundary [ "width" ],
    } );
}

//--------------------------------------------------------------------------------------------------
// Function: decodePointArray
//
// Description:
//
//   Decodes point array.
//
// Parameters:
//
//   - value:
//     The value supplied to the operation.
//
//   - maximumLength:
//     The maximum length supplied to the operation.
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

function decodePointArray ( value: unknown, maximumLength: number ): readonly ChartRoutingPoint[] | null
{
    // Return the decode array result.

    return decodeArray ( value, maximumLength, decodePoint );
}

//--------------------------------------------------------------------------------------------------
// Function: decodeRectangleArray
//
// Description:
//
//   Decodes rectangle array.
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

function decodeRectangleArray ( value: unknown ): readonly ChartRoutingRectangle[] | null
{
    // Return the decode array result.

    return decodeArray ( value, MAXIMUM_CHART_ROUTING_OBSTACLE_COUNT, decodeRectangle );
}

//--------------------------------------------------------------------------------------------------
// Function: decodeRelation
//
// Description:
//
//   Decodes relation.
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

function decodeRelation ( value: unknown ): ChartRoutingRelation | null
{
    // Initialize the local values needed by this operation.

    const relation = exactRecord (
        value,
        [
            "identifier",
            "labelHeight",
            "labelObstacles",
            "labelPosition",
            "labelWidth",
            "obstacles",
            "preferredPoints",
            "preservePreferred",
        ],
        [ "sourceBoundary", "targetBoundary" ],
    );

    // Handle the case where at least one branch condition is satisfied.

    if ( relation === null || !isBoundedIdentifier ( relation [ "identifier" ] ) ||
        !isFiniteNumber ( relation [ "labelWidth" ] ) || relation [ "labelWidth" ] < 0 ||
        !isFiniteNumber ( relation [ "labelHeight" ] ) || relation [ "labelHeight" ] < 0 ||
        !isFiniteNumber ( relation [ "labelPosition" ] ) || relation [ "labelPosition" ] < 0 ||
        relation [ "labelPosition" ] > 1 || typeof relation [ "preservePreferred" ] !== "boolean" )
    {
        // Return the computed result.

        return null;
    }

    // Initialize the local values needed by this operation.

    const obstacles       = decodeRectangleArray ( relation [ "obstacles" ] );
    const labelObstacles  = decodeRectangleArray ( relation [ "labelObstacles" ] );
    const preferredPoints = decodePointArray (
        relation [ "preferredPoints" ],
        MAXIMUM_CHART_ROUTING_PREFERRED_POINT_COUNT,
    );
    const hasSourceBoundary = Object.hasOwn ( relation, "sourceBoundary" );
    const hasTargetBoundary = Object.hasOwn ( relation, "targetBoundary" );

    // Handle the case where at least one branch condition is satisfied.

    if ( obstacles === null || labelObstacles === null || preferredPoints === null || preferredPoints.length < 2 ||
        hasSourceBoundary !== hasTargetBoundary )
    {
        // Return the computed result.

        return null;
    }

    // Initialize the local values needed by this operation.

    const sourceBoundary = hasSourceBoundary ? decodeBoundary ( relation [ "sourceBoundary" ] ) : null;
    const targetBoundary = hasTargetBoundary ? decodeBoundary ( relation [ "targetBoundary" ] ) : null;

    // Handle the case where all required conditions are satisfied.

    if ( hasSourceBoundary && ( sourceBoundary === null || targetBoundary === null ) )
    {
        // Return the computed result.

        return null;
    }

    // Return the freeze result.

    return Object.freeze ( {
        identifier: relation [ "identifier" ],
        labelHeight: relation [ "labelHeight" ],
        labelObstacles,
        labelPosition: relation [ "labelPosition" ],
        labelWidth: relation [ "labelWidth" ],
        obstacles,
        preferredPoints,
        preservePreferred: relation [ "preservePreferred" ],
        ...( sourceBoundary === null || targetBoundary === null ? {} : { sourceBoundary, targetBoundary } ),
    } );
}

//--------------------------------------------------------------------------------------------------
// Function: decodeRequest
//
// Description:
//
//   Decodes request.
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

function decodeRequest ( value: unknown ): ChartRoutingRequest | null
{
    // Initialize the local values needed by this operation.

    const request = exactRecord (
        value,
        [
            "documentRevision",
            "geometryRevision",
            "preferenceRevision",
            "relations",
            "requestId",
            "transitionGravityPointDistance",
        ],
    );

    // Handle the case where at least one branch condition is satisfied.

    if ( request === null || !isBoundedIdentifier ( request [ "requestId" ] ) ||
        !isNonNegativeSafeInteger ( request [ "documentRevision" ] ) ||
        !isNonNegativeSafeInteger ( request [ "geometryRevision" ] ) ||
        !isNonNegativeSafeInteger ( request [ "preferenceRevision" ] ) ||
        !isNonNegativeSafeInteger ( request [ "transitionGravityPointDistance" ] ) ||
        request [ "transitionGravityPointDistance" ] < TRANSITION_GRAVITY_POINT_DISTANCE_CONSTRAINTS.minimum ||
        request [ "transitionGravityPointDistance" ] > TRANSITION_GRAVITY_POINT_DISTANCE_CONSTRAINTS.maximum )
    {
        // Return the computed result.

        return null;
    }

    const relations = decodeArray (
        request [ "relations" ],
        MAXIMUM_CHART_ROUTING_RELATION_COUNT,
        decodeRelation,
    );

    // Return the result selected by the current condition.

    return relations === null
        ? null
        : Object.freeze ( {
            documentRevision: request [ "documentRevision" ],
            geometryRevision: request [ "geometryRevision" ],
            preferenceRevision: request [ "preferenceRevision" ],
            relations,
            requestId: request [ "requestId" ],
            transitionGravityPointDistance: request [ "transitionGravityPointDistance" ],
        } );
}

//--------------------------------------------------------------------------------------------------
// Function: decodeResultRelation
//
// Description:
//
//   Decodes result relation.
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

function decodeResultRelation ( value: unknown ): ChartRoutingResultRelation | null
{
    // Initialize the local values needed by this operation.

    const relation = exactRecord ( value, [ "curves", "exteriorFallback", "identifier", "label", "points" ] );

    // Handle the case where at least one branch condition is satisfied.

    if ( relation === null || typeof relation [ "exteriorFallback" ] !== "boolean" ||
        !isBoundedIdentifier ( relation [ "identifier" ] ) )
    {
        // Return the computed result.

        return null;
    }

    // Initialize the local values needed by this operation.

    const label  = decodeRectangle ( relation [ "label" ] );
    const curves = decodeArray (
        relation [ "curves" ],
        MAXIMUM_CHART_ROUTING_RESULT_CURVE_COUNT,
        decodeCubicCurve,
    );
    const points = decodePointArray ( relation [ "points" ], MAXIMUM_CHART_ROUTING_RESULT_POINT_COUNT );

    // Return the result selected by the current condition.

    return label === null || curves === null || curves.length < 1 || points === null || points.length < 2
        ? null
        : Object.freeze ( {
            curves,
            exteriorFallback: relation [ "exteriorFallback" ],
            identifier: relation [ "identifier" ],
            label,
            points,
        } );
}

//--------------------------------------------------------------------------------------------------
// Function: decodeResult
//
// Description:
//
//   Decodes result.
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

function decodeResult ( value: unknown ): ChartRoutingResult | null
{
    // Initialize the local values needed by this operation.

    const result = exactRecord (
        value,
        [ "documentRevision", "geometryRevision", "preferenceRevision", "relations", "requestId" ],
    );

    // Handle the case where at least one branch condition is satisfied.

    if ( result === null || !isBoundedIdentifier ( result [ "requestId" ] ) ||
        !isNonNegativeSafeInteger ( result [ "documentRevision" ] ) ||
        !isNonNegativeSafeInteger ( result [ "geometryRevision" ] ) ||
        !isNonNegativeSafeInteger ( result [ "preferenceRevision" ] ) )
    {
        // Return the computed result.

        return null;
    }

    const relations = decodeArray (
        result [ "relations" ],
        MAXIMUM_CHART_ROUTING_RELATION_COUNT,
        decodeResultRelation,
    );

    // Return the result selected by the current condition.

    return relations === null
        ? null
        : Object.freeze ( {
            documentRevision: result [ "documentRevision" ],
            geometryRevision: result [ "geometryRevision" ],
            preferenceRevision: result [ "preferenceRevision" ],
            relations,
            requestId: result [ "requestId" ],
        } );
}

//--------------------------------------------------------------------------------------------------
// Function: decodeChartRoutingWorkerRequest
//
// Description:
//
//   Decodes chart routing worker request.
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

export function decodeChartRoutingWorkerRequest ( value: unknown ): ChartRoutingWorkerRequest | null
{
    // Run the operation that may report a recoverable failure.

    try
    {
        // Initialize the local values needed by this operation.

        const envelope = exactRecord ( value, [ "generation", "kind", "protocolVersion" ], [ "request" ] );

        // Handle the case where at least one branch condition is satisfied.

        if ( envelope === null || envelope [ "protocolVersion" ] !== CHART_ROUTING_PROTOCOL_VERSION ||
            !isNonNegativeSafeInteger ( envelope [ "generation" ] ) || envelope [ "generation" ] < 1 )
        {
            // Return the computed result.

            return null;
        }

        // Handle the case where selected collection value matches the cancel value.

        if ( envelope [ "kind" ] === "cancel" )
        {
            // Return the result selected by the current condition.

            return Object.hasOwn ( envelope, "request" )
                ? null
                : Object.freeze ( {
                    generation: envelope [ "generation" ],
                    kind: "cancel" as const,
                    protocolVersion: CHART_ROUTING_PROTOCOL_VERSION,
                } );
        }

        // Handle the case where at least one branch condition is satisfied.

        if ( envelope [ "kind" ] !== "route" || !Object.hasOwn ( envelope, "request" ) )
        {
            // Return the computed result.

            return null;
        }

        const request = decodeRequest ( envelope [ "request" ] );

        // Return the result selected by the current condition.

        return request === null
            ? null
            : Object.freeze ( {
                generation: envelope [ "generation" ],
                kind: "route" as const,
                protocolVersion: CHART_ROUTING_PROTOCOL_VERSION,
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
// Function: decodeChartRoutingWorkerResult
//
// Description:
//
//   Decodes chart routing worker result.
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

export function decodeChartRoutingWorkerResult ( value: unknown ): ChartRoutingWorkerResult | null
{
    // Run the operation that may report a recoverable failure.

    try
    {
        // Initialize the local values needed by this operation.

        const envelope = exactRecord ( value, [ "generation", "kind", "protocolVersion", "result" ] );

        // Handle the case where at least one branch condition is satisfied.

        if ( envelope === null || envelope [ "protocolVersion" ] !== CHART_ROUTING_PROTOCOL_VERSION ||
            envelope [ "kind" ] !== "result" || !isNonNegativeSafeInteger ( envelope [ "generation" ] ) ||
            envelope [ "generation" ] < 1 )
        {
            // Return the computed result.

            return null;
        }

        const result = decodeResult ( envelope [ "result" ] );

        // Return the result selected by the current condition.

        return result === null
            ? null
            : Object.freeze ( {
                generation: envelope [ "generation" ],
                kind: "result" as const,
                protocolVersion: CHART_ROUTING_PROTOCOL_VERSION,
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
// Function: decodeChartRoutingWorkerResponse
//
// Description:
//
//   Decodes chart routing worker response.
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

export function decodeChartRoutingWorkerResponse ( value: unknown ): ChartRoutingWorkerResponse | null
{
    // Initialize the local values needed by this operation.

    const result = decodeChartRoutingWorkerResult ( value );

    // Handle the case where result differs from an absent value.

    if ( result !== null )
    {
        // Return the result.

        return result;
    }

    // Run the operation that may report a recoverable failure.

    try
    {
        // Initialize the local values needed by this operation.

        const envelope = exactRecord ( value, [ "generation", "kind", "protocolVersion" ] );

        // Return the result selected by the current condition.

        return envelope !== null && envelope [ "protocolVersion" ] === CHART_ROUTING_PROTOCOL_VERSION &&
            envelope [ "kind" ] === "cancelled" && isNonNegativeSafeInteger ( envelope [ "generation" ] ) &&
            envelope [ "generation" ] >= 1
            ? Object.freeze ( {
                generation: envelope [ "generation" ],
                kind: "cancelled" as const,
                protocolVersion: CHART_ROUTING_PROTOCOL_VERSION,
            } )
            : null;
    }
    catch
    {
        // Recover from the reported failure without hiding its outcome.

        return null;
    }
}

//--------------------------------------------------------------------------------------------------
// Function: isChartRoutingWorkerResult
//
// Description:
//
//   Determines whether chart routing worker result.
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

export function isChartRoutingWorkerResult ( value: unknown ): value is ChartRoutingWorkerResult
{
    // Return the computed result.

    return decodeChartRoutingWorkerResult ( value ) !== null;
}
