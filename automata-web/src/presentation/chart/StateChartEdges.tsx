// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    State Chart Edges
// Version: 1.0.0
// Date:    2026-08-11
// Author:  Rohin Gosling
//
// Description:
//
//   Renders center-derived Chart relationships clipped to their visible node boundaries.
//   Presentation-only lanes keep coincident transitions and self-transitions distinct without
//   persisting routing data in the document.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { useLayoutEffect, useRef, useState } from "react";

import { BaseEdge } from "@xyflow/react";
import type { Edge, EdgeProps } from "@xyflow/react";

import type
{
    ChartRoutingRelation,
    ChartRoutingResultRelation,
} from "../../application/ports/contracts.js";
import
{
    cubicBezierCurveSamplePoints,
    cubicBezierCurvesFromBackbone as fitCubicBezierCurvesFromBackbone,
    cubicBSplineCurvesFromControlPoints,
    fitCubicDetourClearance,
    pointAlongSampledCurve,
} from "../../application/chart-routing-backbone.js";
import type { ChartSelfTransitionLoopGeometry } from "../../application/chart-self-transition-loops.js";
import
{
    COMPILE_TIME_CONFIGURATION,
    DEFAULT_APPLICATION_PREFERENCES,
} from "../../configuration/compile-time-configuration.js";
import type { TransitionArrowHeadStyle } from "../../configuration/compile-time-configuration.js";

//--------------------------------------------------------------------------------------------------
// Type: ChartNodeSide
//
// Description:
//
//   Defines the supported chart node side alternatives.
//
//--------------------------------------------------------------------------------------------------

export type ChartNodeSide = "top" | "right" | "bottom" | "left";

//--------------------------------------------------------------------------------------------------
// Interface: ChartNodeBoundary
//
// Description:
//
//   Defines the structure of chart node boundary.
//
//--------------------------------------------------------------------------------------------------

export interface ChartNodeBoundary
{
    readonly cornerRadius?: number;
    readonly height:        number;
    readonly kind:          "circle" | "rectangle";
    readonly radius:        number;
    readonly width:         number;
}

//--------------------------------------------------------------------------------------------------
// Interface: StateChartCenterGeometry
//
// Description:
//
//   Defines the structure of state chart center geometry.
//
//--------------------------------------------------------------------------------------------------

interface StateChartCenterGeometry
{
    readonly canonicalDirectionSign:           number;
    readonly parallelLaneCount:                number;
    readonly parallelLanePosition:             number;
    readonly selfLoopIndex:                    number | null;
    readonly selfLoopGeometry?:                ChartSelfTransitionLoopGeometry;
    readonly transitionGravityPointDistance:  number;
    readonly orthogonalObstacles?:             readonly ChartOrthogonalObstacle[];
    readonly orthogonalLabelObstacles?: readonly ChartOrthogonalObstacle[];
    readonly routedGeometry?:                  ChartRoutingResultRelation;
    readonly transitionLabelPosition?:        number;
    readonly sourceBoundary:                   ChartNodeBoundary;
    readonly sourceTechnicalSide:              ChartNodeSide;
    readonly targetBoundary:                   ChartNodeBoundary;
    readonly targetTechnicalSide:              ChartNodeSide;
}

//--------------------------------------------------------------------------------------------------
// Interface: ChartOrthogonalObstacle
//
// Description:
//
//   Defines the structure of chart orthogonal obstacle.
//
//--------------------------------------------------------------------------------------------------

export interface ChartOrthogonalObstacle
{
    readonly height: number;
    readonly width:  number;
    readonly x:      number;
    readonly y:      number;
}

//--------------------------------------------------------------------------------------------------
// Type: StateChartEdgeData
//
// Description:
//
//   Defines the state chart edge data type.
//
//--------------------------------------------------------------------------------------------------

export type StateChartEdgeData = Record<string, unknown> & StateChartCenterGeometry & (
    | { readonly kind: "initial" }
    | { readonly kind: "terminal"; readonly state: string }
    | {
        readonly event:           string;
        readonly kind:            "transition";
        readonly state:           string;
        readonly stateNext:       string;
        readonly transitionIndex: number;
    }
);

//--------------------------------------------------------------------------------------------------
// Type: StateChartEdge
//
// Description:
//
//   Defines the state chart edge type.
//
//--------------------------------------------------------------------------------------------------

export type StateChartEdge = Edge<StateChartEdgeData, "center">;

//--------------------------------------------------------------------------------------------------
// Interface: StateChartEdgeGeometry
//
// Description:
//
//   Defines the structure of state chart edge geometry.
//
//--------------------------------------------------------------------------------------------------

export interface StateChartEdgeGeometry
{
    readonly gravityPoints?: readonly ChartVector[];
    readonly labelX: number;
    readonly labelY: number;
    readonly path:   string;
    readonly source: { readonly x: number; readonly y: number };
    readonly target: { readonly x: number; readonly y: number };
}

//--------------------------------------------------------------------------------------------------
// Interface: RoutedBackboneGeometry
//
// Description:
//
//   Defines the structure of routed backbone geometry.
//
//--------------------------------------------------------------------------------------------------

interface RoutedBackboneGeometry extends StateChartEdgeGeometry
{
    readonly routingPoints: readonly ChartVector[];
}

//--------------------------------------------------------------------------------------------------
// Interface: CubicBezierCurve
//
// Description:
//
//   Defines the structure of cubic bezier curve.
//
//--------------------------------------------------------------------------------------------------

interface CubicBezierCurve
{
    readonly source:        ChartVector;
    readonly sourceControl: ChartVector;
    readonly target:        ChartVector;
    readonly targetControl: ChartVector;
}

//--------------------------------------------------------------------------------------------------
// Interface: CubicCurveLocation
//
// Description:
//
//   Defines the structure of cubic curve location.
//
//--------------------------------------------------------------------------------------------------

interface CubicCurveLocation
{
    readonly curveIndex: number;
    readonly position:   number;
}

//--------------------------------------------------------------------------------------------------
// Interface: CurveBoundaryClipping
//
// Description:
//
//   Defines the structure of curve boundary clipping.
//
//--------------------------------------------------------------------------------------------------

interface CurveBoundaryClipping
{
    readonly sourceBoundary: ChartNodeBoundary;
    readonly sourceCenter:   ChartVector;
    readonly targetBoundary: ChartNodeBoundary;
    readonly targetCenter:   ChartVector;
}

//--------------------------------------------------------------------------------------------------
// Interface: ChartVector
//
// Description:
//
//   Defines the structure of chart vector.
//
//--------------------------------------------------------------------------------------------------

interface ChartVector
{
    readonly x: number;
    readonly y: number;
}

const PARALLEL_LANE_SPACING           = 18;
const COINCIDENT_CENTER_BASE_DISTANCE = 72;
const COINCIDENT_CENTER_DISTANCE_STEP = 28;
const STATE_CORNER_RADIUS             = 10;
const TECHNICAL_HANDLE_HALF_SIZE      = 7;
const ORTHOGONAL_CLEARANCE            = COMPILE_TIME_CONFIGURATION.chart.routing.routeClearance;
const ROUTE_CORNER_RADIUS             = 10;
const ROUTE_POINT_EPSILON             = 0.000001;

export const TRANSITION_ARROW_MARKER_IDENTIFIER = "chart-transition-arrow";

//--------------------------------------------------------------------------------------------------
// Function: transitionArrowHeadHalfWidth
//
// Description:
//
//   Derives the transition arrow head half width.
//
// Parameters:
//
//   - size:
//     The size supplied to the operation.
//
//   - style:
//     The style supplied to the operation.
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

function transitionArrowHeadHalfWidth ( size: number, style: TransitionArrowHeadStyle ): number
{
    // Return the result selected by the current condition.

    return style === "NarrowClosed" || style === "NarrowOpen" ? size / 6 : size / 2;
}

//--------------------------------------------------------------------------------------------------
// Interface: TransitionArrowMarkerDefinitionProperties
//
// Description:
//
//   Defines the properties accepted by the transition arrow marker definition interface.
//
//--------------------------------------------------------------------------------------------------

interface TransitionArrowMarkerDefinitionProperties
{
    readonly identifier: string;
    readonly size?:       number;
}

// Marker geometry is shared by configured and draft relations so preference-driven arrow geometry
// cannot drift.

//--------------------------------------------------------------------------------------------------
// Function: TransitionArrowMarkerDefinition
//
// Description:
//
//   Renders the transition arrow marker definition interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered transition arrow marker definition interface.
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

export function TransitionArrowMarkerDefinition ( properties: TransitionArrowMarkerDefinitionProperties )
{
    // Initialize the local values needed by this operation.

    const configuration = COMPILE_TIME_CONFIGURATION.chart.transitionLines;
    const size          = properties.size ?? DEFAULT_APPLICATION_PREFERENCES.transitionArrowHeadSize;
    const halfWidth     = transitionArrowHeadHalfWidth ( size, configuration.arrowHeadStyle );
    const points        = `0,${-halfWidth} ${size},0 0,${halfWidth}`;
    const closed        = configuration.arrowHeadStyle === "Closed" || configuration.arrowHeadStyle === "NarrowClosed";

    // Return the rendered interface.

    return (
        <marker
            id           = { properties.identifier }
            markerHeight = { size }
            markerUnits  = "userSpaceOnUse"
            markerWidth  = { size }
            orient       = "auto"
            overflow     = "visible"
            refX         = { size }
            refY         = "0"
            viewBox      = { `0 ${-size / 2} ${size} ${size}` }
        >
            { closed
                ? (
                    <polygon
                        fill           = "currentColor"
                        points         = { points }
                        stroke         = "currentColor"
                        strokeLinejoin = "round"
                    />
                )
                : (
                    <polyline
                        fill           = "none"
                        points         = { points }
                        stroke         = "currentColor"
                        strokeLinecap  = "round"
                        strokeLinejoin = "round"
                        strokeWidth    = { Math.max ( 1, size / 12 ) }
                    />
                ) }
        </marker>
    );
}

//--------------------------------------------------------------------------------------------------
// Function: centerFromTechnicalHandle
//
// Description:
//
//   Derives the center from technical handle.
//
// Parameters:
//
//   - point:
//     The point supplied to the operation.
//
//   - side:
//     The side supplied to the operation.
//
//   - boundary:
//     The boundary supplied to the operation.
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

function centerFromTechnicalHandle (
    point: ChartVector,
    side: ChartNodeSide,
    boundary: ChartNodeBoundary,
): ChartVector
{
    // Handle the case where side matches the top value.

    if ( side === "top" )
    {
        // Return the assembled result.

        return { x: point.x, y: point.y + TECHNICAL_HANDLE_HALF_SIZE + boundary.height / 2 };
    }

    // Handle the case where side matches the right value.

    if ( side === "right" )
    {
        // Return the assembled result.

        return { x: point.x - TECHNICAL_HANDLE_HALF_SIZE - boundary.width / 2, y: point.y };
    }

    // Handle the case where side matches the bottom value.

    if ( side === "bottom" )
    {
        // Return the assembled result.

        return { x: point.x, y: point.y - TECHNICAL_HANDLE_HALF_SIZE - boundary.height / 2 };
    }

    // Return the assembled result.

    return { x: point.x + TECHNICAL_HANDLE_HALF_SIZE + boundary.width / 2, y: point.y };
}

//--------------------------------------------------------------------------------------------------
// Function: rayRectangleBoundary
//
// Description:
//
//   Derives the ray rectangle boundary.
//
// Parameters:
//
//   - point:
//     The point supplied to the operation.
//
//   - center:
//     The center supplied to the operation.
//
//   - direction:
//     The direction supplied to the operation.
//
//   - boundary:
//     The boundary supplied to the operation.
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

function rayRectangleBoundary (
    point: ChartVector,
    center: ChartVector,
    direction: ChartVector,
    boundary: ChartNodeBoundary,
): ChartVector
{
    // Initialize the local values needed by this operation.

    const halfWidth          = boundary.width / 2;
    const halfHeight         = boundary.height / 2;
    const horizontalDistance = direction.x > 0
        ? ( center.x + halfWidth - point.x ) / direction.x
        : direction.x < 0 ? ( center.x - halfWidth - point.x ) / direction.x : Number.POSITIVE_INFINITY;
    const verticalDistance = direction.y > 0
        ? ( center.y + halfHeight - point.y ) / direction.y
        : direction.y < 0 ? ( center.y - halfHeight - point.y ) / direction.y : Number.POSITIVE_INFINITY;
    const distance                 = Math.min ( horizontalDistance, verticalDistance );
    const rectangularBoundaryPoint = {
        x: point.x + direction.x * distance,
        y: point.y + direction.y * distance,
    };
    const cornerRadius          = Math.min ( STATE_CORNER_RADIUS, halfWidth, halfHeight );
    const horizontalCornerStart = halfWidth - cornerRadius;
    const verticalCornerStart   = halfHeight - cornerRadius;
    const horizontalOffset      = Math.abs ( rectangularBoundaryPoint.x - center.x );
    const verticalOffset        = Math.abs ( rectangularBoundaryPoint.y - center.y );

    // Handle the case where at least one branch condition is satisfied.

    if ( horizontalOffset <= horizontalCornerStart || verticalOffset <= verticalCornerStart )
    {
        // Return the rectangular boundary point.

        return rectangularBoundaryPoint;
    }

    // Calculate the corner center value from the current inputs.

    const cornerCenter = {
        x: center.x + Math.sign ( rectangularBoundaryPoint.x - center.x ) * horizontalCornerStart,
        y: center.y + Math.sign ( rectangularBoundaryPoint.y - center.y ) * verticalCornerStart,
    };

    // Return the ray circle boundary result.

    return rayCircleBoundary (
        point,
        cornerCenter,
        direction,
        { height: cornerRadius * 2, kind: "circle", radius: cornerRadius, width: cornerRadius * 2 },
    );
}

//--------------------------------------------------------------------------------------------------
// Function: rayCircleBoundary
//
// Description:
//
//   Derives the ray circle boundary.
//
// Parameters:
//
//   - point:
//     The point supplied to the operation.
//
//   - center:
//     The center supplied to the operation.
//
//   - direction:
//     The direction supplied to the operation.
//
//   - boundary:
//     The boundary supplied to the operation.
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

function rayCircleBoundary (
    point: ChartVector,
    center: ChartVector,
    direction: ChartVector,
    boundary: ChartNodeBoundary,
): ChartVector
{
    // Initialize the local values needed by this operation.

    const offsetX      = point.x - center.x;
    const offsetY      = point.y - center.y;
    const projection   = offsetX * direction.x + offsetY * direction.y;
    const discriminant = Math.max (
        0,
        boundary.radius * boundary.radius -
            ( offsetX * offsetX + offsetY * offsetY - projection * projection ),
    );
    const distance = -projection + Math.sqrt ( discriminant );

    // Return the assembled result.

    return {
        x: point.x + direction.x * distance,
        y: point.y + direction.y * distance,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: rayBoundary
//
// Description:
//
//   Derives the ray boundary.
//
// Parameters:
//
//   - point:
//     The point supplied to the operation.
//
//   - center:
//     The center supplied to the operation.
//
//   - direction:
//     The direction supplied to the operation.
//
//   - boundary:
//     The boundary supplied to the operation.
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

function rayBoundary (
    point: ChartVector,
    center: ChartVector,
    direction: ChartVector,
    boundary: ChartNodeBoundary,
): ChartVector
{
    // Return the result selected by the current condition.

    return boundary.kind === "circle"
        ? rayCircleBoundary ( point, center, direction, boundary )
        : rayRectangleBoundary ( point, center, direction, boundary );
}

//--------------------------------------------------------------------------------------------------
// Function: scalarValuesEqual
//
// Description:
//
//   Derives the scalar values equal.
//
// Parameters:
//
//   - left:
//     The left supplied to the operation.
//
//   - right:
//     The right supplied to the operation.
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

function scalarValuesEqual ( left: number, right: number ): boolean
{
    // Return the computed result.

    return Math.abs ( left - right ) <= ROUTE_POINT_EPSILON;
}

//--------------------------------------------------------------------------------------------------
// Function: pointsEqual
//
// Description:
//
//   Derives the points equal.
//
// Parameters:
//
//   - left:
//     The left supplied to the operation.
//
//   - right:
//     The right supplied to the operation.
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

function pointsEqual ( left: ChartVector, right: ChartVector ): boolean
{
    // Return the computed result.

    return scalarValuesEqual ( left.x, right.x ) && scalarValuesEqual ( left.y, right.y );
}

//--------------------------------------------------------------------------------------------------
// Function: compactOrthogonalPoints
//
// Description:
//
//   Compacts the orthogonal points.
//
// Parameters:
//
//   - points:
//     The points supplied to the operation.
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

function compactOrthogonalPoints ( points: readonly ChartVector[] ): ChartVector[]
{
    // Initialize the local values needed by this operation.

    const compacted: ChartVector[] = [];

    points.forEach ( point =>
    {
        // Initialize the local values needed by this operation.

        const previous = compacted.at ( -1 );

        // Handle the case where previous matches undefined.

        if ( previous === undefined )
        {
            compacted.push ( point );

            // Return control to the caller.

            return;
        }

        // Handle the case where points equal result is enabled.

        if ( pointsEqual ( previous, point ) )
        {
            compacted [ compacted.length - 1 ] = point;

            // Return control to the caller.

            return;
        }

        compacted.push ( point );
    } );

    // Return the filtered collection.

    return compacted.filter ( ( point, index ) =>
    {
        // Initialize the local values needed by this operation.

        const previous = compacted [ index - 1 ];
        const next     = compacted [ index + 1 ];

        // Return the computed result.

        return previous === undefined || next === undefined ||
            !( scalarValuesEqual ( previous.x, point.x ) && scalarValuesEqual ( point.x, next.x ) ) &&
            !( scalarValuesEqual ( previous.y, point.y ) && scalarValuesEqual ( point.y, next.y ) );
    } );
}

// The renderer uses only effective interior backbone points: endpoints and redundant collinear
// points are not gravity influences and therefore are not useful debug markers.

//--------------------------------------------------------------------------------------------------
// Function: gravityPointsFromBackbone
//
// Description:
//
//   Derives the gravity points from backbone.
//
// Parameters:
//
//   - points:
//     The points supplied to the operation.
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

// eslint-disable-next-line react-refresh/only-export-components
export function gravityPointsFromBackbone ( points: readonly ChartVector[] ): readonly ChartVector[]
{
    // Return the slice result.

    return compactOrthogonalPoints ( points ).slice ( 1, -1 );
}

//--------------------------------------------------------------------------------------------------
// Function: directSegmentIntersectsObstacle
//
// Description:
//
//   Derives the direct segment intersects obstacle.
//
// Parameters:
//
//   - source:
//     The source supplied to the operation.
//
//   - target:
//     The target supplied to the operation.
//
//   - obstacle:
//     The obstacle supplied to the operation.
//
//   - transitionGravityPointDistance:
//     The transition gravity point distance supplied to the operation.
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

function directSegmentIntersectsObstacle (
    source: ChartVector,
    target: ChartVector,
    obstacle: ChartOrthogonalObstacle,
    transitionGravityPointDistance: number,
): boolean
{
    // Initialize the local values needed by this operation.

    const ranges = [
        {
            direction: target.x - source.x,
            maximum: obstacle.x + obstacle.width + transitionGravityPointDistance,
            minimum: obstacle.x - transitionGravityPointDistance,
            origin: source.x,
        },
        {
            direction: target.y - source.y,
            maximum: obstacle.y + obstacle.height + transitionGravityPointDistance,
            minimum: obstacle.y - transitionGravityPointDistance,
            origin: source.y,
        },
    ];
    let entryPosition = 0;
    let exitPosition  = 1;

    // Process each range from the ranges collection in order.

    for ( const range of ranges )
    {
        // Handle the case where scalar values equal result is enabled.

        if ( scalarValuesEqual ( range.direction, 0 ) )
        {
            // Handle the case where at least one branch condition is satisfied.

            if ( range.origin <= range.minimum || range.origin >= range.maximum )
            {
                // Return the computed result.

                return false;
            }

            continue;
        }

        // Initialize the local values needed by this operation.

        const firstPosition  = ( range.minimum - range.origin ) / range.direction;
        const secondPosition = ( range.maximum - range.origin ) / range.direction;

        entryPosition = Math.max ( entryPosition, Math.min ( firstPosition, secondPosition ) );
        exitPosition  = Math.min ( exitPosition, Math.max ( firstPosition, secondPosition ) );

        // Handle the case where entry position is at least exit position.

        if ( entryPosition >= exitPosition )
        {
            // Return the computed result.

            return false;
        }
    }

    // Return the computed result.

    return entryPosition < exitPosition;
}

//--------------------------------------------------------------------------------------------------
// Function: routeIntersectionCount
//
// Description:
//
//   Routes the intersection count.
//
// Parameters:
//
//   - points:
//     The points supplied to the operation.
//
//   - obstacles:
//     The obstacles supplied to the operation.
//
//   - transitionGravityPointDistance:
//     The transition gravity point distance supplied to the operation.
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

function routeIntersectionCount (
    points: readonly ChartVector[],
    obstacles: readonly ChartOrthogonalObstacle[],
    transitionGravityPointDistance: number,
): number
{
    // Initialize the local values needed by this operation.

    let count = 0;

    // Repeat the operation across the bounded iteration range.

    for ( let index = 1; index < points.length; index += 1 )
    {
        // Initialize the local values needed by this operation.

        const source = points [ index - 1 ];
        const target = points [ index ];

        // Handle the case where all required conditions are satisfied.

        if ( source !== undefined && target !== undefined )
        {
            count += obstacles.filter ( obstacle => directSegmentIntersectsObstacle (
                source,
                target,
                obstacle,
                transitionGravityPointDistance,
            ) ).length;
        }
    }

    // Return the count.

    return count;
}

//--------------------------------------------------------------------------------------------------
// Function: routeLength
//
// Description:
//
//   Routes the length.
//
// Parameters:
//
//   - points:
//     The points supplied to the operation.
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

function routeLength ( points: readonly ChartVector[] ): number
{
    // Initialize the local values needed by this operation.

    let length = 0;

    // Repeat the operation across the bounded iteration range.

    for ( let index = 1; index < points.length; index += 1 )
    {
        // Initialize the local values needed by this operation.

        const source = points [ index - 1 ];
        const target = points [ index ];

        // Handle the case where all required conditions are satisfied.

        if ( source !== undefined && target !== undefined )
        {
            length += Math.abs ( target.x - source.x ) + Math.abs ( target.y - source.y );
        }
    }

    // Return the length.

    return length;
}

//--------------------------------------------------------------------------------------------------
// Function: normalizedVector
//
// Description:
//
//   Derives the normalized vector.
//
// Parameters:
//
//   - vector:
//     The vector supplied to the operation.
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

function normalizedVector ( vector: ChartVector ): ChartVector
{
    // Initialize the local values needed by this operation.

    const length = Math.hypot ( vector.x, vector.y );

    // Return the result selected by the current condition.

    return length === 0 ? { x: 1, y: 0 } : { x: vector.x / length, y: vector.y / length };
}

//--------------------------------------------------------------------------------------------------
// Function: canonicalLaneNormal
//
// Description:
//
//   Derives the canonical lane normal.
//
// Parameters:
//
//   - direction:
//     The direction supplied to the operation.
//
//   - canonicalDirectionSign:
//     The canonical direction sign supplied to the operation.
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

function canonicalLaneNormal ( direction: ChartVector, canonicalDirectionSign: number ): ChartVector
{
    // Initialize the local values needed by this operation.

    const canonicalDirection = canonicalDirectionSign < 0
        ? { x: -direction.x, y: -direction.y }
        : direction;

    // Return the assembled result.

    return {
        x: canonicalDirection.y,
        y: -canonicalDirection.x,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: distanceBetweenPoints
//
// Description:
//
//   Derives the distance between points.
//
// Parameters:
//
//   - source:
//     The source supplied to the operation.
//
//   - target:
//     The target supplied to the operation.
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

function distanceBetweenPoints ( source: ChartVector, target: ChartVector ): number
{
    // Return the hypot result.

    return Math.hypot ( target.x - source.x, target.y - source.y );
}

//--------------------------------------------------------------------------------------------------
// Function: midpoint
//
// Description:
//
//   Derives the midpoint.
//
// Parameters:
//
//   - source:
//     The source supplied to the operation.
//
//   - target:
//     The target supplied to the operation.
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

function midpoint ( source: ChartVector, target: ChartVector ): ChartVector
{
    // Return the assembled result.

    return { x: ( source.x + target.x ) / 2, y: ( source.y + target.y ) / 2 };
}

//--------------------------------------------------------------------------------------------------
// Function: cubicBezierCurvesFromBackbone
//
// Description:
//
//   Derives the cubic bezier curves from backbone.
//
// Parameters:
//
//   - requestedPoints:
//     The requested points supplied to the operation.
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

function cubicBezierCurvesFromBackbone ( requestedPoints: readonly ChartVector[] ): CubicBezierCurve[]
{
    // Initialize the local values needed by this operation.

    const points = compactOrthogonalPoints ( requestedPoints );
    const source = points [ 0 ] ?? { x: 0, y: 0 };
    const target = points.at ( -1 ) ?? source;

    // Handle the case where points length is at most 2.

    if ( points.length <= 2 )
    {
        // Initialize the local values needed by this operation.

        const distance = distanceBetweenPoints ( source, target );

        // Handle the case where distance equals 0.

        if ( distance === 0 )
        {
            // Return the assembled result collection.

            return [ {
                source,
                sourceControl:
                {
                    x: source.x + ROUTE_CORNER_RADIUS,
                    y: source.y - ROUTE_CORNER_RADIUS,
                },
                target: source,
                targetControl:
                {
                    x: source.x + ROUTE_CORNER_RADIUS,
                    y: source.y + ROUTE_CORNER_RADIUS,
                },
            } ];
        }

        // Return the assembled result collection.

        return [ {
            source,
            sourceControl:
            {
                x: source.x + ( target.x - source.x ) / 3,
                y: source.y + ( target.y - source.y ) / 3,
            },
            target,
            targetControl:
            {
                x: source.x + ( target.x - source.x ) * 2 / 3,
                y: source.y + ( target.y - source.y ) * 2 / 3,
            },
        } ];
    }

    // Handle the case where points length equals 3.

    if ( points.length === 3 )
    {
        // Initialize the local values needed by this operation.

        const gravityPoint = points [ 1 ] ?? midpoint ( source, target );

        // Return the assembled result collection.

        return [ {
            source,
            sourceControl:
            {
                x: source.x + ( gravityPoint.x - source.x ) * 2 / 3,
                y: source.y + ( gravityPoint.y - source.y ) * 2 / 3,
            },
            target,
            targetControl:
            {
                x: target.x + ( gravityPoint.x - target.x ) * 2 / 3,
                y: target.y + ( gravityPoint.y - target.y ) * 2 / 3,
            },
        } ];
    }

    // Return the cubic b spline curves from control points result.

    return cubicBSplineCurvesFromControlPoints ( points );
}

//--------------------------------------------------------------------------------------------------
// Function: cubicBezierPathFromCurves
//
// Description:
//
//   Derives the cubic bezier path from curves.
//
// Parameters:
//
//   - curves:
//     The curves supplied to the operation.
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

function cubicBezierPathFromCurves ( curves: readonly CubicBezierCurve[] ): string
{
    // Initialize the local values needed by this operation.

    const source = curves [ 0 ]?.source ?? { x: 0, y: 0 };

    // Return the join result.

    return [
        `M ${source.x} ${source.y}`,
        ...curves.map ( curve => `C ${curve.sourceControl.x} ${curve.sourceControl.y}, ` +
            `${curve.targetControl.x} ${curve.targetControl.y}, ${curve.target.x} ${curve.target.y}` ),
    ].join ( " " );
}

// Pure explicit-curve conversion is exported for routed draft relations.

//--------------------------------------------------------------------------------------------------
// Function: curvedBezierPathFromCurves
//
// Description:
//
//   Derives the curved bezier path from curves.
//
// Parameters:
//
//   - curves:
//     The curves supplied to the operation.
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

// eslint-disable-next-line react-refresh/only-export-components
export function curvedBezierPathFromCurves ( curves: readonly CubicBezierCurve[] ): string
{
    // Return the cubic bezier path from curves result.

    return cubicBezierPathFromCurves ( curves );
}

// Pure path conversion is exported for draft relations, which share the same derived routing
// contract.

//--------------------------------------------------------------------------------------------------
// Function: curvedBezierPathFromBackbone
//
// Description:
//
//   Derives the curved bezier path from backbone.
//
// Parameters:
//
//   - requestedPoints:
//     The requested points supplied to the operation.
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

// eslint-disable-next-line react-refresh/only-export-components
export function curvedBezierPathFromBackbone (
    requestedPoints: readonly ChartVector[],
): string
{
    // Return the cubic bezier path from curves result.

    return cubicBezierPathFromCurves ( cubicBezierCurvesFromBackbone ( requestedPoints ) );
}

//--------------------------------------------------------------------------------------------------
// Function: geometryFromOrthogonalPoints
//
// Description:
//
//   Derives the geometry from orthogonal points.
//
// Parameters:
//
//   - requestedPoints:
//     The requested points supplied to the operation.
//
//   - labelPosition:
//     The label position supplied to the operation.
//
//   - boundaryClipping:
//     The boundary clipping supplied to the operation.
//
//   - proofObstacles:
//     The proof obstacles supplied to the operation.
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

function geometryFromOrthogonalPoints (
    requestedPoints: readonly ChartVector[],
    labelPosition: number,
    boundaryClipping?: CurveBoundaryClipping,
    proofObstacles: readonly ChartOrthogonalObstacle[] = [],
): RoutedBackboneGeometry
{
    // Initialize the local values needed by this operation.

    const points       = compactOrthogonalPoints ( requestedPoints );
    const fittedCurves = fitCubicBezierCurvesFromBackbone ( points, proofObstacles );
    const fullCurves   = fittedCurves.length > 0 ? fittedCurves : cubicBezierCurvesFromBackbone ( points );

    // Return the geometry from cubic bezier curves result.

    return geometryFromCubicBezierCurves ( fullCurves, points, labelPosition, boundaryClipping );
}

//--------------------------------------------------------------------------------------------------
// Function: geometryFromCubicBezierCurves
//
// Description:
//
//   Derives the geometry from cubic bezier curves.
//
// Parameters:
//
//   - fullCurves:
//     The full curves supplied to the operation.
//
//   - points:
//     The points supplied to the operation.
//
//   - labelPosition:
//     The label position supplied to the operation.
//
//   - boundaryClipping:
//     The boundary clipping supplied to the operation.
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

function geometryFromCubicBezierCurves (
    fullCurves: readonly CubicBezierCurve[],
    points: readonly ChartVector[],
    labelPosition: number,
    boundaryClipping?: CurveBoundaryClipping,
): RoutedBackboneGeometry
{
    // Initialize the local values needed by this operation.

    const visibleCurves = boundaryClipping === undefined
        ? fullCurves
        : clipCubicBezierCurvesToBoundaries ( fullCurves, boundaryClipping ) ?? fullCurves;
    const label = pointAlongSampledCurve (
        cubicBezierCurveSamplePoints ( visibleCurves ),
        labelPosition,
    );
    const source = visibleCurves [ 0 ]?.source ?? points [ 0 ] ?? { x: 0, y: 0 };
    const target = visibleCurves.at ( -1 )?.target ?? points.at ( -1 ) ?? source;

    // Return the assembled result.

    return {
        gravityPoints: gravityPointsFromBackbone ( points ),
        labelX: label.x,
        labelY: label.y,
        path: cubicBezierPathFromCurves ( visibleCurves ),
        routingPoints: points,
        source,
        target,
    };
}

// A self-transition renders as the elliptical arc resolved in chart-self-transition-loops.ts. The
// arc arrives already clipped to the selected edge, so no boundary trimming is applied and the
// marker inherits the ellipse gradient at the re-entry point from the final span's tangent.

//--------------------------------------------------------------------------------------------------
// Function: calculateEllipticalSelfLoopGeometry
//
// Description:
//
//   Calculates elliptical self loop geometry.
//
// Parameters:
//
//   - loop:
//     The loop supplied to the operation.
//
//   - labelPosition:
//     The label position supplied to the operation.
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

function calculateEllipticalSelfLoopGeometry (
    loop: ChartSelfTransitionLoopGeometry,
    labelPosition: number,
): RoutedBackboneGeometry
{
    // Initialize the local values needed by this operation.

    const curves: CubicBezierCurve[] = loop.curves.map ( curve => ( {
        source:        curve.source,
        sourceControl: curve.sourceControl,
        target:        curve.target,
        targetControl: curve.targetControl,
    } ) );
    const routingPoints = [ loop.exit, ...curves.map ( curve => curve.target ) ];
    const label         = pointAlongSampledCurve ( cubicBezierCurveSamplePoints ( curves ), labelPosition );

    // Return the assembled result.

    return {
        labelX: label.x,
        labelY: label.y,
        path:   cubicBezierPathFromCurves ( curves ),
        routingPoints,
        source: loop.exit,
        target: loop.entry,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: calculateOrthogonalGeometry
//
// Description:
//
//   Calculates orthogonal geometry.
//
// Parameters:
//
//   - sourceCenter:
//     The source center supplied to the operation.
//
//   - targetCenter:
//     The target center supplied to the operation.
//
//   - data:
//     The data supplied to the operation.
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

function calculateOrthogonalGeometry (
    sourceCenter: ChartVector,
    targetCenter: ChartVector,
    data: StateChartEdgeData,
): RoutedBackboneGeometry
{
    // Handle the case where data self loop geometry differs from undefined.

    if ( data.selfLoopGeometry !== undefined )
    {
        // Return the calculate elliptical self loop geometry result.

        return calculateEllipticalSelfLoopGeometry (
            data.selfLoopGeometry,
            data.transitionLabelPosition ?? 0.5,
        );
    }

    // Initialize the local values needed by this operation.

    const laneOffset      = data.parallelLanePosition * PARALLEL_LANE_SPACING;
    const source          = sourceCenter;
    const target          = targetCenter;
    const obstacles       = data.orthogonalObstacles ?? [];
    const centerDirection = normalizedVector ( {
        x: targetCenter.x - sourceCenter.x,
        y: targetCenter.y - sourceCenter.y,
    } );
    const laneNormal   = canonicalLaneNormal ( centerDirection, data.canonicalDirectionSign );
    const directPoints = laneOffset === 0
        ? [ source, target ]
        : [
            source,
            {
                x: ( source.x + target.x ) / 2 + laneNormal.x * laneOffset * 1.5,
                y: ( source.y + target.y ) / 2 + laneNormal.y * laneOffset * 1.5,
            },
            target,
        ];

    // Handle the case where route intersection count result equals 0.

    if ( routeIntersectionCount ( directPoints, obstacles, data.transitionGravityPointDistance ) === 0 )
    {
        // Return the geometry from orthogonal points result.

        return geometryFromOrthogonalPoints (
            directPoints,
            data.transitionLabelPosition ?? 0.5,
            {
                sourceBoundary: data.sourceBoundary,
                sourceCenter,
                targetBoundary: data.targetBoundary,
                targetCenter,
            },
        );
    }

    // Initialize the local values needed by this operation.

    const obstacleLeft  = Math.min ( source.x, target.x, ...obstacles.map ( obstacle => obstacle.x ) );
    const obstacleRight = Math.max (
        source.x,
        target.x,
        ...obstacles.map ( obstacle => obstacle.x + obstacle.width ),
    );
    const obstacleTop    = Math.min ( source.y, target.y, ...obstacles.map ( obstacle => obstacle.y ) );
    const obstacleBottom = Math.max (
        source.y,
        target.y,
        ...obstacles.map ( obstacle => obstacle.y + obstacle.height ),
    );
    const middleX        = ( source.x + target.x ) / 2 + laneOffset;
    const middleY        = ( source.y + target.y ) / 2 + laneOffset;
    const exteriorOffset = data.transitionGravityPointDistance * 2 + Math.abs ( laneOffset );
    // The clearance proof is a correctness bound and uses the fixed route clearance, matching the
    // worker. The gravity preference continues to place the exterior lanes above through
    // exteriorOffset.

    const inflatedObstacles = obstacles.map ( obstacle => ( {
        height: obstacle.height + ORTHOGONAL_CLEARANCE * 2,
        width:  obstacle.width + ORTHOGONAL_CLEARANCE * 2,
        x:      obstacle.x - ORTHOGONAL_CLEARANCE,
        y:      obstacle.y - ORTHOGONAL_CLEARANCE,
    } ) );
    const candidates = [
        [ source, { x: middleX, y: source.y }, { x: middleX, y: target.y }, target ],
        [ source, { x: source.x, y: middleY }, { x: target.x, y: middleY }, target ],
        [ source, { x: source.x, y: obstacleTop - exteriorOffset },
            { x: target.x, y: obstacleTop - exteriorOffset }, target ],
        [ source, { x: source.x, y: obstacleBottom + exteriorOffset },
            { x: target.x, y: obstacleBottom + exteriorOffset }, target ],
        [ source, { x: obstacleLeft - exteriorOffset, y: source.y },
            { x: obstacleLeft - exteriorOffset, y: target.y }, target ],
        [ source, { x: obstacleRight + exteriorOffset, y: source.y },
            { x: obstacleRight + exteriorOffset, y: target.y }, target ],
    ].flatMap ( points =>
    {
        // Initialize the local values needed by this operation.

        const compactedPoints = compactOrthogonalPoints ( points );
        const fittedPoints    = fitCubicDetourClearance (
            compactedPoints,
            inflatedObstacles,
            data.transitionGravityPointDistance,
        );

        // An unproven lane is still a lane. Discarding every candidate degrades the preview to a
        // straight cubic through each intervening state, which is worse than any lane the ranking
        // below can choose.

        return fittedPoints !== null
            ? [ fittedPoints ]
            : compactedPoints.length > 2 ? [ compactedPoints ] : [];
    } );
    const selected = candidates.map ( ( points, index ) => ( {
        index,
        intersections: routeIntersectionCount ( points, obstacles, data.transitionGravityPointDistance ),
        length: routeLength ( points ),
        points,
    } ) ).sort ( ( left, right ) => left.intersections - right.intersections ||
        left.length - right.length || left.index - right.index ) [ 0 ];

    // Return the geometry from orthogonal points result.

    return geometryFromOrthogonalPoints (
        selected?.points ?? [ source, target ],
        data.transitionLabelPosition ?? 0.5,
        {
            sourceBoundary: data.sourceBoundary,
            sourceCenter,
            targetBoundary: data.targetBoundary,
            targetCenter,
        },
        inflatedObstacles,
    );
}

//--------------------------------------------------------------------------------------------------
// Function: cubicPoint
//
// Description:
//
//   Derives the cubic point.
//
// Parameters:
//
//   - source:
//     The source supplied to the operation.
//
//   - sourceControl:
//     The source control supplied to the operation.
//
//   - targetControl:
//     The target control supplied to the operation.
//
//   - target:
//     The target supplied to the operation.
//
//   - position:
//     The position supplied to the operation.
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

function cubicPoint (
    source: ChartVector,
    sourceControl: ChartVector,
    targetControl: ChartVector,
    target: ChartVector,
    position: number,
): ChartVector
{
    // Calculate the complement value from the current inputs.

    const complement = 1 - position;

    // Return the assembled result.

    return {
        x: complement * complement * complement * source.x +
            3 * complement * complement * position * sourceControl.x +
            3 * complement * position * position * targetControl.x +
            position * position * position * target.x,
        y: complement * complement * complement * source.y +
            3 * complement * complement * position * sourceControl.y +
            3 * complement * position * position * targetControl.y +
            position * position * position * target.y,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: interpolatePoint
//
// Description:
//
//   Derives the interpolate point.
//
// Parameters:
//
//   - source:
//     The source supplied to the operation.
//
//   - target:
//     The target supplied to the operation.
//
//   - position:
//     The position supplied to the operation.
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

function interpolatePoint ( source: ChartVector, target: ChartVector, position: number ): ChartVector
{
    // Return the assembled result.

    return {
        x: source.x + ( target.x - source.x ) * position,
        y: source.y + ( target.y - source.y ) * position,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: splitCubicCurve
//
// Description:
//
//   Derives the split cubic curve.
//
// Parameters:
//
//   - curve:
//     The curve supplied to the operation.
//
//   - position:
//     The position supplied to the operation.
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

function splitCubicCurve ( curve: CubicBezierCurve, position: number ): {
    readonly left:  CubicBezierCurve;
    readonly right: CubicBezierCurve;
}
{
    // Initialize the local values needed by this operation.

    const sourceControlLine = interpolatePoint ( curve.source, curve.sourceControl, position );
    const middleControlLine = interpolatePoint ( curve.sourceControl, curve.targetControl, position );
    const targetControlLine = interpolatePoint ( curve.targetControl, curve.target, position );
    const sourceQuadratic   = interpolatePoint ( sourceControlLine, middleControlLine, position );
    const targetQuadratic   = interpolatePoint ( middleControlLine, targetControlLine, position );
    const split             = interpolatePoint ( sourceQuadratic, targetQuadratic, position );

    // Return the assembled result.

    return {
        left:
        {
            source: curve.source,
            sourceControl: sourceControlLine,
            targetControl: sourceQuadratic,
            target: split,
        },
        right:
        {
            source: split,
            sourceControl: targetQuadratic,
            targetControl: targetControlLine,
            target: curve.target,
        },
    };
}

//--------------------------------------------------------------------------------------------------
// Function: cubicCurveBetween
//
// Description:
//
//   Derives the cubic curve between.
//
// Parameters:
//
//   - curve:
//     The curve supplied to the operation.
//
//   - sourcePosition:
//     The source position supplied to the operation.
//
//   - targetPosition:
//     The target position supplied to the operation.
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

function cubicCurveBetween ( curve: CubicBezierCurve, sourcePosition: number, targetPosition: number ):
    CubicBezierCurve
{
    // Initialize the local values needed by this operation.

    const leftToTarget        = splitCubicCurve ( curve, targetPosition ).left;
    const localSourcePosition = targetPosition === 0 ? 0 : sourcePosition / targetPosition;

    // Return the computed result.

    return splitCubicCurve ( leftToTarget, localSourcePosition ).right;
}

//--------------------------------------------------------------------------------------------------
// Function: cubicCurvePoint
//
// Description:
//
//   Derives the cubic curve point.
//
// Parameters:
//
//   - curve:
//     The curve supplied to the operation.
//
//   - position:
//     The position supplied to the operation.
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

function cubicCurvePoint ( curve: CubicBezierCurve, position: number ): ChartVector
{
    // Return the cubic point result.

    return cubicPoint (
        curve.source,
        curve.sourceControl,
        curve.targetControl,
        curve.target,
        position,
    );
}

//--------------------------------------------------------------------------------------------------
// Function: pointInsideBoundary
//
// Description:
//
//   Derives the point inside boundary.
//
// Parameters:
//
//   - point:
//     The point supplied to the operation.
//
//   - center:
//     The center supplied to the operation.
//
//   - boundary:
//     The boundary supplied to the operation.
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

function pointInsideBoundary (
    point: ChartVector,
    center: ChartVector,
    boundary: ChartNodeBoundary,
): boolean
{
    // Initialize the local values needed by this operation.

    const horizontalOffset = Math.abs ( point.x - center.x );
    const verticalOffset   = Math.abs ( point.y - center.y );

    // Handle the case where boundary kind matches the circle value.

    if ( boundary.kind === "circle" )
    {
        // Return the computed result.

        return horizontalOffset * horizontalOffset + verticalOffset * verticalOffset <=
            boundary.radius * boundary.radius;
    }

    // Initialize the local values needed by this operation.

    const halfWidth  = boundary.width / 2;
    const halfHeight = boundary.height / 2;

    // Handle the case where at least one branch condition is satisfied.

    if ( horizontalOffset > halfWidth || verticalOffset > halfHeight )
    {
        // Return the computed result.

        return false;
    }

    const cornerRadius = Math.min ( STATE_CORNER_RADIUS, halfWidth, halfHeight );

    // Handle the case where at least one branch condition is satisfied.

    if ( horizontalOffset <= halfWidth - cornerRadius || verticalOffset <= halfHeight - cornerRadius )
    {
        // Return the computed result.

        return true;
    }

    // Initialize the local values needed by this operation.

    const cornerOffsetX = horizontalOffset - ( halfWidth - cornerRadius );
    const cornerOffsetY = verticalOffset - ( halfHeight - cornerRadius );

    // Return the computed result.

    return cornerOffsetX * cornerOffsetX + cornerOffsetY * cornerOffsetY <= cornerRadius * cornerRadius;
}

//--------------------------------------------------------------------------------------------------
// Function: boundaryExitLocation
//
// Description:
//
//   Derives the boundary exit location.
//
// Parameters:
//
//   - curves:
//     The curves supplied to the operation.
//
//   - center:
//     The center supplied to the operation.
//
//   - boundary:
//     The boundary supplied to the operation.
//
//   - fromSource:
//     The from source supplied to the operation.
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

function boundaryExitLocation (
    curves: readonly CubicBezierCurve[],
    center: ChartVector,
    boundary: ChartNodeBoundary,
    fromSource: boolean,
): CubicCurveLocation | null
{
    // Initialize the local values needed by this operation.

    const sampleCount = 96;

    // Handle the case where from source is enabled.

    if ( fromSource )
    {
        // Repeat the operation across the bounded iteration range.

        for ( let curveIndex = 0; curveIndex < curves.length; curveIndex += 1 )
        {
            // Initialize the local values needed by this operation.

            const curve = curves [ curveIndex ];

            // Handle the case where at least one branch condition is satisfied.

            if ( curve === undefined || !pointInsideBoundary ( curve.source, center, boundary ) )
            {
                continue;
            }

            let insidePosition = 0;

            // Repeat the operation across the bounded iteration range.

            for ( let sample = 1; sample <= sampleCount; sample += 1 )
            {
                // Calculate the outside position value from the current inputs.

                let outsidePosition = sample / sampleCount;

                // Handle the case where point inside boundary result is enabled.

                if ( pointInsideBoundary ( cubicCurvePoint ( curve, outsidePosition ), center, boundary ) )
                {
                    insidePosition = outsidePosition;
                    continue;
                }

                // Repeat the operation across the bounded iteration range.

                for ( let iteration = 0; iteration < 28; iteration += 1 )
                {
                    // Calculate the middle value from the current inputs.

                    const middle = ( insidePosition + outsidePosition ) / 2;

                    // Handle the case where point inside boundary result is enabled.

                    if ( pointInsideBoundary ( cubicCurvePoint ( curve, middle ), center, boundary ) )
                    {
                        insidePosition = middle;
                    }
                    else
                    {
                        // Handle the remaining case after the preceding condition is false.

                        outsidePosition = middle;
                    }
                }

                // Return the assembled result.

                return { curveIndex, position: outsidePosition };
            }
        }

        // Return the computed result.

        return null;
    }

    // Repeat the operation across the bounded iteration range.

    for ( let curveIndex = curves.length - 1; curveIndex >= 0; curveIndex -= 1 )
    {
        // Initialize the local values needed by this operation.

        const curve = curves [ curveIndex ];

        // Handle the case where at least one branch condition is satisfied.

        if ( curve === undefined || !pointInsideBoundary ( curve.target, center, boundary ) )
        {
            continue;
        }

        let insidePosition = 1;

        // Repeat the operation across the bounded iteration range.

        for ( let sample = sampleCount - 1; sample >= 0; sample -= 1 )
        {
            // Calculate the outside position value from the current inputs.

            let outsidePosition = sample / sampleCount;

            // Handle the case where point inside boundary result is enabled.

            if ( pointInsideBoundary ( cubicCurvePoint ( curve, outsidePosition ), center, boundary ) )
            {
                insidePosition = outsidePosition;
                continue;
            }

            // Repeat the operation across the bounded iteration range.

            for ( let iteration = 0; iteration < 28; iteration += 1 )
            {
                // Calculate the middle value from the current inputs.

                const middle = ( outsidePosition + insidePosition ) / 2;

                // Handle the case where point inside boundary result is enabled.

                if ( pointInsideBoundary ( cubicCurvePoint ( curve, middle ), center, boundary ) )
                {
                    insidePosition = middle;
                }
                else
                {
                    // Handle the remaining case after the preceding condition is false.

                    outsidePosition = middle;
                }
            }

            // Return the assembled result.

            return { curveIndex, position: insidePosition };
        }
    }

    // Return the computed result.

    return null;
}

//--------------------------------------------------------------------------------------------------
// Function: clipCubicBezierCurvesToBoundaries
//
// Description:
//
//   Derives the clip cubic bezier curves to boundaries.
//
// Parameters:
//
//   - curves:
//     The curves supplied to the operation.
//
//   - clipping:
//     The clipping supplied to the operation.
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

function clipCubicBezierCurvesToBoundaries (
    curves: readonly CubicBezierCurve[],
    clipping: CurveBoundaryClipping,
): CubicBezierCurve[] | null
{
    // Initialize the local values needed by this operation.

    const sourceLocation = boundaryExitLocation (
        curves,
        clipping.sourceCenter,
        clipping.sourceBoundary,
        true,
    );
    const targetLocation = boundaryExitLocation (
        curves,
        clipping.targetCenter,
        clipping.targetBoundary,
        false,
    );

    // Handle the case where at least one branch condition is satisfied.

    if ( sourceLocation === null || targetLocation === null ||
        sourceLocation.curveIndex > targetLocation.curveIndex ||
        ( sourceLocation.curveIndex === targetLocation.curveIndex &&
            sourceLocation.position >= targetLocation.position ) )
    {
        // Return the computed result.

        return null;
    }

    // Initialize the local values needed by this operation.

    const sourceCurve = curves [ sourceLocation.curveIndex ];
    const targetCurve = curves [ targetLocation.curveIndex ];

    // Handle the case where at least one branch condition is satisfied.

    if ( sourceCurve === undefined || targetCurve === undefined )
    {
        // Return the computed result.

        return null;
    }

    // Handle the case where source location curve index matches target location curve index.

    if ( sourceLocation.curveIndex === targetLocation.curveIndex )
    {
        // Return the assembled result collection.

        return [ cubicCurveBetween ( sourceCurve, sourceLocation.position, targetLocation.position ) ];
    }

    // Return the assembled result collection.

    return [
        splitCubicCurve ( sourceCurve, sourceLocation.position ).right,
        ...curves.slice ( sourceLocation.curveIndex + 1, targetLocation.curveIndex ),
        splitCubicCurve ( targetCurve, targetLocation.position ).left,
    ];
}

//--------------------------------------------------------------------------------------------------
// Function: calculateOrdinaryCenterCurveGeometry
//
// Description:
//
//   Calculates ordinary center curve geometry.
//
// Parameters:
//
//   - sourceCenter:
//     The source center supplied to the operation.
//
//   - targetCenter:
//     The target center supplied to the operation.
//
//   - data:
//     The data supplied to the operation.
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

function calculateOrdinaryCenterCurveGeometry (
    sourceCenter: ChartVector,
    targetCenter: ChartVector,
    data: StateChartEdgeData,
): StateChartEdgeGeometry
{
    // Initialize the local values needed by this operation.

    const horizontalDistance = targetCenter.x - sourceCenter.x;
    const verticalDistance   = targetCenter.y - sourceCenter.y;
    const length             = Math.hypot ( horizontalDistance, verticalDistance );

    // Handle the case where length equals 0.

    if ( length === 0 )
    {
        // Return the calculate coincident center geometry result.

        return calculateCoincidentCenterGeometry ( sourceCenter, data );
    }

    // Initialize the local values needed by this operation.

    const direction                   = { x: horizontalDistance / length, y: verticalDistance / length };
    const laneNormal                  = canonicalLaneNormal ( direction, data.canonicalDirectionSign );
    const curveOffset                 = data.parallelLanePosition * PARALLEL_LANE_SPACING;
    const fullCurve: CubicBezierCurve = {
        source: sourceCenter,
        sourceControl:
        {
            x: sourceCenter.x + horizontalDistance / 3 + laneNormal.x * curveOffset,
            y: sourceCenter.y + verticalDistance / 3 + laneNormal.y * curveOffset,
        },
        targetControl:
        {
            x: sourceCenter.x + horizontalDistance * 2 / 3 + laneNormal.x * curveOffset,
            y: sourceCenter.y + verticalDistance * 2 / 3 + laneNormal.y * curveOffset,
        },
        target: targetCenter,
    };
    const visibleCurves = clipCubicBezierCurvesToBoundaries ( [ fullCurve ], {
        sourceBoundary: data.sourceBoundary,
        sourceCenter,
        targetBoundary: data.targetBoundary,
        targetCenter,
    } );
    const visibleCurve = visibleCurves?.[ 0 ];

    // Handle the case where visible curve matches undefined.

    if ( visibleCurve === undefined )
    {
        // Return the calculate coincident center geometry result.

        return calculateCoincidentCenterGeometry ( sourceCenter, data );
    }

    const label = pointAlongSampledCurve (
        cubicBezierCurveSamplePoints ( [ visibleCurve ] ),
        data.transitionLabelPosition ?? 0.5,
    );

    // Return the assembled result.

    return {
        labelX: label.x,
        labelY: label.y,
        path: `M ${visibleCurve.source.x} ${visibleCurve.source.y} ` +
            `C ${visibleCurve.sourceControl.x} ${visibleCurve.sourceControl.y}, ` +
            `${visibleCurve.targetControl.x} ${visibleCurve.targetControl.y}, ` +
            `${visibleCurve.target.x} ${visibleCurve.target.y}`,
        source: visibleCurve.source,
        target: visibleCurve.target,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: coincidentCenterDirections
//
// Description:
//
//   Derives the coincident center directions.
//
// Parameters:
//
//   - laneIndex:
//     The lane index supplied to the operation.
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

function coincidentCenterDirections ( laneIndex: number ): {
    readonly source: ChartVector;
    readonly target: ChartVector;
}
{
    // Calculate the quadrant value from the current inputs.

    const quadrant = laneIndex % 4;

    // Handle the case where quadrant equals 0.

    if ( quadrant === 0 )
    {
        // Return the assembled result.

        return { source: { x: 1, y: 0 }, target: { x: 0, y: -1 } };
    }

    // Handle the case where quadrant equals 1.

    if ( quadrant === 1 )
    {
        // Return the assembled result.

        return { source: { x: 0, y: 1 }, target: { x: 1, y: 0 } };
    }

    // Handle the case where quadrant equals 2.

    if ( quadrant === 2 )
    {
        // Return the assembled result.

        return { source: { x: -1, y: 0 }, target: { x: 0, y: 1 } };
    }

    // Return the assembled result.

    return { source: { x: 0, y: -1 }, target: { x: -1, y: 0 } };
}

//--------------------------------------------------------------------------------------------------
// Function: calculateCoincidentCenterGeometry
//
// Description:
//
//   Calculates coincident center geometry.
//
// Parameters:
//
//   - center:
//     The center supplied to the operation.
//
//   - data:
//     The data supplied to the operation.
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

function calculateCoincidentCenterGeometry (
    center: ChartVector,
    data: StateChartEdgeData,
): StateChartEdgeGeometry
{
    // Initialize the local values needed by this operation.

    const laneCount = Math.max ( 1, data.parallelLaneCount );
    const laneIndex = Math.max (
        0,
        Math.min (
            laneCount - 1,
            Math.round ( data.parallelLanePosition + ( laneCount - 1 ) / 2 ),
        ),
    );
    const ring            = Math.floor ( laneIndex / 4 );
    const directions      = coincidentCenterDirections ( laneIndex );
    const sourceDirection = data.canonicalDirectionSign < 0 ? directions.target : directions.source;
    const targetDirection = data.canonicalDirectionSign < 0 ? directions.source : directions.target;
    const source          = rayBoundary ( center, center, sourceDirection, data.sourceBoundary );
    const target          = rayBoundary ( center, center, targetDirection, data.targetBoundary );
    const distance        = COINCIDENT_CENTER_BASE_DISTANCE + ring * COINCIDENT_CENTER_DISTANCE_STEP;
    const sourceControl   = {
        x: source.x + sourceDirection.x * distance,
        y: source.y + sourceDirection.y * distance,
    };
    const targetControl = {
        x: target.x + targetDirection.x * distance,
        y: target.y + targetDirection.y * distance,
    };
    const label = pointAlongSampledCurve (
        cubicBezierCurveSamplePoints ( [ { source, sourceControl, target, targetControl } ] ),
        data.transitionLabelPosition ?? 0.5,
    );

    // Return the assembled result.

    return {
        labelX: label.x,
        labelY: label.y,
        path: `M ${source.x} ${source.y} C ${sourceControl.x} ${sourceControl.y}, ` +
            `${targetControl.x} ${targetControl.y}, ${target.x} ${target.y}`,
        source,
        target,
    };
}

// Pure geometry is exported for deterministic boundary and lane verification.

//--------------------------------------------------------------------------------------------------
// Function: calculateCenterRoutedEdgeGeometry
//
// Description:
//
//   Calculates center routed edge geometry.
//
// Parameters:
//
//   - sourceHandle:
//     The source handle supplied to the operation.
//
//   - targetHandle:
//     The target handle supplied to the operation.
//
//   - data:
//     The data supplied to the operation.
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

// eslint-disable-next-line react-refresh/only-export-components
export function calculateCenterRoutedEdgeGeometry (
    sourceHandle: ChartVector,
    targetHandle: ChartVector,
    data: StateChartEdgeData,
): StateChartEdgeGeometry
{
    // Initialize the local values needed by this operation.

    const sourceCenter = centerFromTechnicalHandle (
        sourceHandle,
        data.sourceTechnicalSide,
        data.sourceBoundary,
    );
    const targetCenter = centerFromTechnicalHandle (
        targetHandle,
        data.targetTechnicalSide,
        data.targetBoundary,
    );

    // Return the calculate center routed edge geometry from centers result.

    return calculateCenterRoutedEdgeGeometryFromCenters ( sourceCenter, targetCenter, data );
}

// Center input supports presentation controls that must coincide exactly with the rendered path
// endpoints.

//--------------------------------------------------------------------------------------------------
// Function: calculateCenterRoutedEdgeGeometryFromCenters
//
// Description:
//
//   Calculates center routed edge geometry from centers.
//
// Parameters:
//
//   - sourceCenter:
//     The source center supplied to the operation.
//
//   - targetCenter:
//     The target center supplied to the operation.
//
//   - data:
//     The data supplied to the operation.
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

// eslint-disable-next-line react-refresh/only-export-components
export function calculateCenterRoutedEdgeGeometryFromCenters (
    sourceCenter: ChartVector,
    targetCenter: ChartVector,
    data: StateChartEdgeData,
): StateChartEdgeGeometry
{
    // A preserved self-transition keeps its exact elliptical arc and adopts only the worker's
    // placed label.

    if ( data.routedGeometry !== undefined && data.selfLoopGeometry !== undefined )
    {
        // Return the assembled result.

        return {
            ...calculateEllipticalSelfLoopGeometry ( data.selfLoopGeometry, data.transitionLabelPosition ?? 0.5 ),
            labelX: data.routedGeometry.label.x + data.routedGeometry.label.width / 2,
            labelY: data.routedGeometry.label.y + data.routedGeometry.label.height / 2,
        };
    }

    // Handle the case where data routed geometry differs from undefined.

    if ( data.routedGeometry !== undefined )
    {
        // Initialize the local values needed by this operation.

        const routed = geometryFromCubicBezierCurves (
            data.routedGeometry.curves,
            compactOrthogonalPoints ( data.routedGeometry.points ),
            data.transitionLabelPosition ?? 0.5,
            data.selfLoopIndex === null
                ? {
                    sourceBoundary: data.sourceBoundary,
                    sourceCenter,
                    targetBoundary: data.targetBoundary,
                    targetCenter,
                }
                : undefined,
        );

        // Return the assembled result.

        return {
            ...routed,
            labelX: data.routedGeometry.label.x + data.routedGeometry.label.width / 2,
            labelY: data.routedGeometry.label.y + data.routedGeometry.label.height / 2,
        };
    }

    // Handle the case where data orthogonal obstacles differs from undefined.

    if ( data.orthogonalObstacles !== undefined )
    {
        // Return the calculate orthogonal geometry result.

        return calculateOrthogonalGeometry ( sourceCenter, targetCenter, data );
    }

    // Handle the case where data self loop geometry differs from undefined.

    if ( data.selfLoopGeometry !== undefined )
    {
        // Return the calculate elliptical self loop geometry result.

        return calculateEllipticalSelfLoopGeometry (
            data.selfLoopGeometry,
            data.transitionLabelPosition ?? 0.5,
        );
    }

    // Return the calculate ordinary center curve geometry result.

    return calculateOrdinaryCenterCurveGeometry ( sourceCenter, targetCenter, data );
}

// Deterministic label-box estimate shared by routing requests and self-transition loop sizing.

//--------------------------------------------------------------------------------------------------
// Function: transitionLabelSize
//
// Description:
//
//   Derives the transition label size.
//
// Parameters:
//
//   - label:
//     The label supplied to the operation.
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

// eslint-disable-next-line react-refresh/only-export-components
export function transitionLabelSize ( label: string ):
{
    readonly labelHeight: number;
    readonly labelWidth:  number;
}
{
    // Initialize the local values needed by this operation.

    const labelLines = label.split ( "\n" );

    // Return the assembled result.

    return {
        labelHeight: label.length === 0 ? 0 : Math.max ( 22, labelLines.length * 16 + 6 ),
        labelWidth:  label.length === 0
            ? 0
            : Math.max ( 28, ...labelLines.map ( line => line.length * 7 + 12 ) ),
    };
}

// Ordinary worker requests retain center endpoints. The completed routed curve is clipped only when
// it is rendered.

//--------------------------------------------------------------------------------------------------
// Function: createChartRoutingRelation
//
// Description:
//
//   Creates chart routing relation.
//
// Parameters:
//
//   - identifier:
//     The identifier supplied to the operation.
//
//   - label:
//     The label supplied to the operation.
//
//   - sourceCenter:
//     The source center supplied to the operation.
//
//   - targetCenter:
//     The target center supplied to the operation.
//
//   - data:
//     The data supplied to the operation.
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

// eslint-disable-next-line react-refresh/only-export-components
export function createChartRoutingRelation (
    identifier: string,
    label: string,
    sourceCenter: ChartVector,
    targetCenter: ChartVector,
    data: StateChartEdgeData,
): ChartRoutingRelation
{
    // Initialize the local values needed by this operation.

    const { labelHeight, labelWidth } = transitionLabelSize ( label );
    const geometry = calculateOrthogonalGeometry ( sourceCenter, targetCenter, data );

    // Return the assembled result.

    return {
        identifier,
        labelHeight,
        labelObstacles: data.orthogonalLabelObstacles ?? data.orthogonalObstacles ?? [],
        labelPosition: data.transitionLabelPosition ?? 0.5,
        labelWidth,
        obstacles: data.orthogonalObstacles ?? [],
        preferredPoints: geometry.routingPoints,
        preservePreferred: data.selfLoopIndex !== null || data.parallelLaneCount > 1,
        ...( data.selfLoopIndex === null
            ? {
                sourceBoundary: data.sourceBoundary,
                targetBoundary: data.targetBoundary,
            }
            : {} ),
    };
}

// SVG collapses a newline inside <text> into ordinary whitespace, so the engine's own edge label
// renders a wrapped event name on one line however many lines the wrapping produced. Routing
// already reserves the taller box such a name occupies, so a one-line label left other relations
// clear of space nothing ever used. Each line is emitted as its own tspan here, and the background
// is measured from what was actually laid out rather than estimated.
//
// The class names are the engine's own, so anything selecting a label by them - image export
// included - keeps working unchanged.

const EDGE_LABEL_BACKGROUND_PADDING_X = 4;
const EDGE_LABEL_BACKGROUND_PADDING_Y = 2;

//--------------------------------------------------------------------------------------------------
// Function: StateChartEdgeLabel
//
// Description:
//
//   Renders the state chart edge label interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered state chart edge label interface.
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

function StateChartEdgeLabel ( properties: {
    readonly label: string;
    readonly x:     number;
    readonly y:     number;
} )
{
    // Initialize the local values needed by this operation.

    const textReference = useRef<SVGTextElement> ( null );
    const [ background, setBackground ] = useState ( { height: 0, width: 0 } );
    const lines = properties.label.split ( "\n" );

    useLayoutEffect ( () =>
    {
        // Initialize the local values needed by this operation.

        const measured = textReference.current?.getBBox ();

        // Handle the case where measured differs from undefined.

        if ( measured !== undefined )
        {
            setBackground ( { height: measured.height, width: measured.width } );
        }
    }, [ properties.label, properties.x, properties.y ] );

    // Calculate the first line offset value from the current inputs.

    const firstLineOffset = -( lines.length - 1 ) / 2;

    // Return the rendered interface.

    return (
        <g className="react-flow__edge-textwrapper">
            { background.width > 0 && (
                <rect
                    className = "react-flow__edge-textbg"
                    height    = { background.height + EDGE_LABEL_BACKGROUND_PADDING_Y * 2 }
                    width     = { background.width + EDGE_LABEL_BACKGROUND_PADDING_X * 2 }
                    x         = { properties.x - background.width / 2 - EDGE_LABEL_BACKGROUND_PADDING_X }
                    y         = { properties.y - background.height / 2 - EDGE_LABEL_BACKGROUND_PADDING_Y }
                />
            ) }
            <text
                className        = "react-flow__edge-text"
                dominantBaseline = "middle"
                ref              = { textReference }
                textAnchor       = "middle"
                x                = { properties.x }
                y                = { properties.y }
            >
                { lines.map ( ( line, lineIndex ) => (
                    <tspan
                        dy  = { lineIndex === 0 ? `${firstLineOffset}em` : "1em" }
                        key = { `${line}-${lineIndex}` }
                        x   = { properties.x }
                    >
                        { line }
                    </tspan>
                ) ) }
            </text>
        </g>
    );
}

//--------------------------------------------------------------------------------------------------
// Function: StateChartCenterEdgeComponent
//
// Description:
//
//   Renders the state chart center edge component interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered state chart center edge component interface.
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

export function StateChartCenterEdgeComponent ( properties: EdgeProps<StateChartEdge> )
{
    // Handle the case where properties data matches undefined.

    if ( properties.data === undefined )
    {
        // Return the computed result.

        return null;
    }

    const geometry = calculateCenterRoutedEdgeGeometry (
        { x: properties.sourceX, y: properties.sourceY },
        { x: properties.targetX, y: properties.targetY },
        properties.data,
    );

    // Return the rendered interface.

    return (
        <>
            <BaseEdge
                labelX = { geometry.labelX }
                labelY = { geometry.labelY }
                path   = { geometry.path }
                { ...( properties.interactionWidth === undefined
                    ? {}
                    : { interactionWidth: properties.interactionWidth } ) }
                { ...( properties.labelBgBorderRadius === undefined
                    ? {}
                    : { labelBgBorderRadius: properties.labelBgBorderRadius } ) }
                { ...( properties.labelBgPadding === undefined ? {} : { labelBgPadding: properties.labelBgPadding } ) }
                { ...( properties.labelBgStyle === undefined ? {} : { labelBgStyle: properties.labelBgStyle } ) }
                { ...( properties.labelShowBg === undefined ? {} : { labelShowBg: properties.labelShowBg } ) }
                { ...( properties.labelStyle === undefined ? {} : { labelStyle: properties.labelStyle } ) }
                { ...( properties.markerEnd === undefined ? {} : { markerEnd: properties.markerEnd } ) }
                { ...( properties.markerStart === undefined ? {} : { markerStart: properties.markerStart } ) }
                { ...( properties.style === undefined ? {} : { style: properties.style } ) }
            />
            { typeof properties.label === "string" && properties.label.length > 0 && (
                <StateChartEdgeLabel label={ properties.label } x={ geometry.labelX } y={ geometry.labelY } />
            ) }
            { COMPILE_TIME_CONFIGURATION.debug.gravityPointsVisible && geometry.gravityPoints?.map ( ( point, index ) => (
                <circle
                    aria-hidden="true"
                    cx = { point.x }
                    cy = { point.y }
                    data-chart-gravity-point="true"
                    fill          = { COMPILE_TIME_CONFIGURATION.debug.gravityPointsColor }
                    key           = { `gravity-point-${index}-${point.x}-${point.y}` }
                    pointerEvents = "none"
                    r             = { COMPILE_TIME_CONFIGURATION.debug.gravityPointsRadius }
                />
            ) ) }
        </>
    );
}
