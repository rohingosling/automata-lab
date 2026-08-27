// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Chart Routing Backbone
// Version: 1.0.0
// Date:    2026-08-14
// Author:  Rohin Gosling
//
// Description:
//
//   Applies bounded curve-aware clearance to four-point routing backbones before their two interior
//   gravity points are interpreted as the controls of one cubic Bezier curve.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type
{
    ChartRoutingBoundary,
    ChartRoutingCubicCurve,
    ChartRoutingPoint,
    ChartRoutingRectangle,
} from "./ports/contracts.js";
import type { ChartRoutingPerformanceCounters } from "./chart-routing-performance.js";
import
{
    PackedChartRoutingSpatialIndex,
    chartRoutingSpatialBoundsFromPoints,
    chartRoutingSpatialBoundsFromRectangle,
    type ChartRoutingSpatialQuery,
} from "./chart-routing-spatial-index.js";
import
{
    CHART_ROUTING_CONFIGURATION,
    CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED,
} from "../configuration/compile-time-configuration.js";

export type { ChartRoutingCubicCurve } from "./ports/contracts.js";


//--------------------------------------------------------------------------------------------------
// Interface: ChartRoutingCurveBoundaryClipping
//
// Description:
//
//   Defines the structure of chart routing curve boundary clipping.
//
//--------------------------------------------------------------------------------------------------

export interface ChartRoutingCurveBoundaryClipping
{
    readonly sourceBoundary: ChartRoutingBoundary;
    readonly sourceCenter:   ChartRoutingPoint;
    readonly targetBoundary: ChartRoutingBoundary;
    readonly targetCenter:   ChartRoutingPoint;
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
// Interface: ClearanceProofBudget
//
// Description:
//
//   Defines the structure of clearance proof budget.
//
//--------------------------------------------------------------------------------------------------

interface ClearanceProofBudget
{
    remainingNodes: number;
}

//--------------------------------------------------------------------------------------------------
// Type: DetourShiftDirection
//
// Description:
//
//   Defines the supported detour shift direction alternatives.
//
//--------------------------------------------------------------------------------------------------

type DetourShiftDirection = -1 | 1;

const CUBIC_DETOUR_CLEARANCE_CONFIGURATION = CHART_ROUTING_CONFIGURATION.cubicDetourClearance;
const CLEARANCE_PROOF_MARGIN               = CUBIC_DETOUR_CLEARANCE_CONFIGURATION.clearanceProofMargin;
const CLEARANCE_REFINEMENT_COUNT           = CUBIC_DETOUR_CLEARANCE_CONFIGURATION.clearanceRefinementCount;
const COORDINATE_EPSILON                   = CUBIC_DETOUR_CLEARANCE_CONFIGURATION.coordinateEpsilon;
const MAXIMUM_CLEARANCE_EXPANSION_COUNT    = 
    CUBIC_DETOUR_CLEARANCE_CONFIGURATION.maximumClearanceExpansionCount;
const MAXIMUM_CLEARANCE_PROOF_NODE_COUNT =
    CUBIC_DETOUR_CLEARANCE_CONFIGURATION.maximumClearanceProofNodeCount;
const MAXIMUM_SUBDIVISION_DEPTH         = CUBIC_DETOUR_CLEARANCE_CONFIGURATION.maximumSubdivisionDepth;
const CURVE_ARC_LENGTH_SAMPLES_PER_SPAN = 
    CHART_ROUTING_CONFIGURATION.labelPlacement.curveSamplesPerSpan;


//--------------------------------------------------------------------------------------------------
// Function: interpolatePoint
//
// Description:
//
//   Linearly interpolates from source to target using P(t) = (1 - t) source + t target.
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

function interpolatePoint (
    source: ChartRoutingPoint,
    target: ChartRoutingPoint,
    position: number,
): ChartRoutingPoint
{
    // Apply P(t) = source + t (target - source) independently to x and y.

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
//   Bisects a cubic Bezier curve at t = 1/2 using de Casteljau subdivision.
//
// Parameters:
//
//   - curve:
//     The curve supplied to the operation.
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

function splitCubicCurve (
    curve: ChartRoutingCubicCurve,
): readonly [ ChartRoutingCubicCurve, ChartRoutingCubicCurve ]
{
    // Return the split cubic curve at position result.

    return splitCubicCurveAtPosition ( curve, 0.5 );
}

//--------------------------------------------------------------------------------------------------
// Function: splitCubicCurveAtPosition
//
// Description:
//
//   Subdivides a cubic Bezier curve into equivalent left and right curves at parameter t.
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

function splitCubicCurveAtPosition (
    curve: ChartRoutingCubicCurve,
    position: number,
): readonly [ ChartRoutingCubicCurve, ChartRoutingCubicCurve ]
{
    // Apply de Casteljau subdivision: interpolate the three control-polygon edges, then the two
    // resulting edges, and finally their shared point on the curve.

    const sourceControlLine = interpolatePoint ( curve.source, curve.sourceControl, position );
    const middleControlLine = interpolatePoint ( curve.sourceControl, curve.targetControl, position );
    const targetControlLine = interpolatePoint ( curve.targetControl, curve.target, position );
    const sourceQuadratic   = interpolatePoint ( sourceControlLine, middleControlLine, position );
    const targetQuadratic   = interpolatePoint ( middleControlLine, targetControlLine, position );
    const middle            = interpolatePoint ( sourceQuadratic, targetQuadratic, position );

    // Return the assembled result collection.

    return [
        {
            source: curve.source,
            sourceControl: sourceControlLine,
            target: middle,
            targetControl: sourceQuadratic,
        },
        {
            source: middle,
            sourceControl: targetQuadratic,
            target: curve.target,
            targetControl: targetControlLine,
        },
    ];
}

//--------------------------------------------------------------------------------------------------
// Function: cubicCurveBetween
//
// Description:
//
//   Extracts the portion of a cubic Bezier curve over the requested parameter interval.
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

function cubicCurveBetween (
    curve: ChartRoutingCubicCurve,
    sourcePosition: number,
    targetPosition: number,
): ChartRoutingCubicCurve
{
    // First retain [0, targetPosition], then remap sourcePosition into that local interval as
    // sourcePosition / targetPosition and discard its left portion.

    const leftToTarget        = splitCubicCurveAtPosition ( curve, targetPosition ) [ 0 ];
    const localSourcePosition = targetPosition === 0 ? 0 : sourcePosition / targetPosition;

    // Return the computed result.

    return splitCubicCurveAtPosition ( leftToTarget, localSourcePosition ) [ 1 ];
}

//--------------------------------------------------------------------------------------------------
// Function: openUniformKnotVector
//
// Description:
//
//   Builds a clamped open-uniform knot vector with unit-length interior spans.
//
// Parameters:
//
//   - controlPointCount:
//     The control point count supplied to the operation.
//
//   - degree:
//     The degree supplied to the operation.
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

function openUniformKnotVector ( controlPointCount: number, degree: number ): number[]
{
    // An open vector repeats each endpoint degree + 1 times. The remaining knots advance by one,
    // producing controlPointCount - degree unit parameter spans.

    const spanCount = controlPointCount - degree;

    // Return the generated collection.

    return Array.from ( { length: controlPointCount + degree + 1 }, ( _, index ) =>
    {
        // Handle the case where index does not exceed degree.

        if ( index <= degree )
        {
            // Return the computed result.

            return 0;
        }

        // Handle the case where index is at least control point count.

        if ( index >= controlPointCount )
        {
            // Return the span count.

            return spanCount;
        }

        // Return the computed result.

        return index - degree;
    } );
}

//--------------------------------------------------------------------------------------------------
// Function: knotSpan
//
// Description:
//
//   Finds i such that knots[i] <= parameter < knots[i + 1] using binary search.
//
// Parameters:
//
//   - controlPointCount:
//     The control point count supplied to the operation.
//
//   - degree:
//     The degree supplied to the operation.
//
//   - knots:
//     The knots supplied to the operation.
//
//   - parameter:
//     The parameter supplied to the operation.
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

function knotSpan (
    controlPointCount: number,
    degree: number,
    knots: readonly number[],
    parameter: number,
): number
{
    // Clamp the final endpoint to the last nonempty knot span.

    if ( parameter >= ( knots [ controlPointCount ] ?? 0 ) )
    {
        // Return the computed result.

        return controlPointCount - 1;
    }

    // Search only the nonempty span range. Each comparison halves the candidate interval while
    // preserving knots[lowerIndex] <= parameter < knots[upperIndex].

    let lowerIndex  = degree;
    let upperIndex  = controlPointCount;
    let middleIndex = Math.floor ( ( lowerIndex + upperIndex ) / 2 );

    // Continue until the parameter lies in the half-open interval [knot[i], knot[i + 1]).

    while ( parameter < ( knots [ middleIndex ] ?? 0 ) || parameter >= ( knots [ middleIndex + 1 ] ?? 0 ) )
    {
        // Handle the case where parameter is below current value.

        if ( parameter < ( knots [ middleIndex ] ?? 0 ) )
        {
            upperIndex = middleIndex;
        }
        else
        {
            // Handle the remaining case after the preceding condition is false.

            lowerIndex = middleIndex;
        }

        middleIndex = Math.floor ( ( lowerIndex + upperIndex ) / 2 );
    }

    // Return the middle index.

    return middleIndex;
}

//--------------------------------------------------------------------------------------------------
// Function: pointOnBSpline
//
// Description:
//
//   Evaluates a B-spline point with the iterative de Boor recurrence.
//
// Parameters:
//
//   - controlPoints:
//     The control points supplied to the operation.
//
//   - degree:
//     The degree supplied to the operation.
//
//   - knots:
//     The knots supplied to the operation.
//
//   - parameter:
//     The parameter supplied to the operation.
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

function pointOnBSpline (
    controlPoints: readonly ChartRoutingPoint[],
    degree: number,
    knots: readonly number[],
    parameter: number,
): ChartRoutingPoint
{
    // Copy the degree + 1 control points that influence the selected knot span. De Boor updates
    // this working polygon in place until one evaluated point remains.

    const span          = knotSpan ( controlPoints.length, degree, knots, parameter );
    const workingPoints = Array.from ( { length: degree + 1 }, ( _, index ) =>
    {
        // Calculate the point value from the current inputs.

        const point = controlPoints [ span - degree + index ] ?? controlPoints [ 0 ] ?? { x: 0, y: 0 };

        // Return the assembled result.

        return { ...point };
    } );

    // Repeat the operation across the bounded iteration range.

    for ( let recursion = 1; recursion <= degree; recursion += 1 )
    {
        // Repeat the operation across the bounded iteration range.

        for ( let index = degree; index >= recursion; index -= 1 )
        {
            // Blend adjacent points with alpha = (parameter - lowerKnot) / (upperKnot - lowerKnot).
            // A zero knot interval contributes zero weight.

            const knotIndex   = span - degree + index;
            const lowerKnot   = knots [ knotIndex ] ?? 0;
            const upperKnot   = knots [ knotIndex + degree - recursion + 1 ] ?? lowerKnot;
            const denominator = upperKnot - lowerKnot;
            const weight      = denominator === 0 ? 0 : ( parameter - lowerKnot ) / denominator;
            const previous    = workingPoints [ index - 1 ] ?? { x: 0, y: 0 };
            const current     = workingPoints [ index ] ?? previous;

            workingPoints [ index ] = {
                x: previous.x * ( 1 - weight ) + current.x * weight,
                y: previous.y * ( 1 - weight ) + current.y * weight,
            };
        }
    }

    // Return the computed result.

    return workingPoints [ degree ] ?? { x: 0, y: 0 };
}

//--------------------------------------------------------------------------------------------------
// Function: bSplineDerivativeControlPoints
//
// Description:
//
//   Derives the control points of the first derivative B-spline.
//
// Parameters:
//
//   - controlPoints:
//     The control points supplied to the operation.
//
//   - degree:
//     The degree supplied to the operation.
//
//   - knots:
//     The knots supplied to the operation.
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

function bSplineDerivativeControlPoints (
    controlPoints: readonly ChartRoutingPoint[],
    degree: number,
    knots: readonly number[],
): ChartRoutingPoint[]
{
    // For degree p, derivative point D_i = p (P_{i+1} - P_i) / (U_{i+p+1} - U_{i+1}). Repeated
    // knots produce a zero derivative contribution.

    return controlPoints.slice ( 0, -1 ).map ( ( point, index ) =>
    {
        // Initialize the local values needed by this operation.

        const nextPoint   = controlPoints [ index + 1 ] ?? point;
        const denominator = ( knots [ index + degree + 1 ] ?? 0 ) - ( knots [ index + 1 ] ?? 0 );
        const scale       = denominator === 0 ? 0 : degree / denominator;

        // Return the assembled result.

        return {
            x: ( nextPoint.x - point.x ) * scale,
            y: ( nextPoint.y - point.y ) * scale,
        };
    } );
}

//--------------------------------------------------------------------------------------------------
// Function: cubicBSplineCurvesFromControlPoints
//
// Description:
//
//   Converts every open-uniform cubic B-spline span to an equivalent cubic Bezier curve.
//
// Parameters:
//
//   - controlPoints:
//     The control points supplied to the operation.
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

export function cubicBSplineCurvesFromControlPoints (
    controlPoints: readonly ChartRoutingPoint[],
): ChartRoutingCubicCurve[]
{
    // Handle the case where control points length is less than 4.

    if ( controlPoints.length < 4 )
    {
        // Return the assembled result collection.

        return [];
    }

    // Evaluate each unit knot span at both endpoints. For a cubic, the equivalent Bezier controls
    // are P(u0) + P'(u0) / 3 and P(u1) - P'(u1) / 3.

    const degree                  = 3;
    const knots                   = openUniformKnotVector ( controlPoints.length, degree );
    const derivativeControlPoints = bSplineDerivativeControlPoints ( controlPoints, degree, knots );
    const derivativeKnots         = knots.slice ( 1, -1 );
    const spanCount               = controlPoints.length - degree;

    // Return the generated collection.

    return Array.from ( { length: spanCount }, ( _, spanIndex ) =>
    {
        // Initialize the local values needed by this operation.

        const sourceParameter  = spanIndex;
        const targetParameter  = spanIndex + 1;
        const source           = pointOnBSpline ( controlPoints, degree, knots, sourceParameter );
        const target           = pointOnBSpline ( controlPoints, degree, knots, targetParameter );
        const sourceDerivative = pointOnBSpline (
            derivativeControlPoints,
            degree - 1,
            derivativeKnots,
            sourceParameter,
        );
        const targetDerivative = pointOnBSpline (
            derivativeControlPoints,
            degree - 1,
            derivativeKnots,
            targetParameter,
        );
        const sourceControl = {
            x: source.x + sourceDerivative.x / degree,
            y: source.y + sourceDerivative.y / degree,
        };
        const targetControl = {
            x: target.x - targetDerivative.x / degree,
            y: target.y - targetDerivative.y / degree,
        };

        // Return the assembled result.

        return { source, sourceControl, target, targetControl };
    } );
}

//--------------------------------------------------------------------------------------------------
// Function: cubicBezierCurvesFromPreservedBackbone
//
// Description:
//
//   Converts a preserved routing backbone to straight, quadratic-equivalent, or B-spline cubics.
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

export function cubicBezierCurvesFromPreservedBackbone (
    points: readonly ChartRoutingPoint[],
): ChartRoutingCubicCurve[]
{
    // Initialize the local values needed by this operation.

    const source = points [ 0 ] ?? { x: 0, y: 0 };
    const target = points.at ( -1 ) ?? source;

    // For two endpoints, place controls at one-third and two-thirds of the segment. The resulting
    // cubic is exactly the same straight line.

    if ( points.length <= 2 )
    {
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

    // Interpret one interior gravity point as a quadratic control. Quadratic-to-cubic conversion
    // places each cubic control two-thirds of the way from its endpoint toward that gravity point.

    if ( points.length === 3 )
    {
        // Initialize the local values needed by this operation.

        const gravityPoint = points [ 1 ] ?? source;

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
// Interface: ChartRoutingCurveProofMemoization
//
// Description:
//
//   Defines the structure of chart routing curve proof memoization.
//
//--------------------------------------------------------------------------------------------------

export interface ChartRoutingCurveProofMemoization
{
    get (
        curve: ChartRoutingCubicCurve,
        obstacle: ChartRoutingRectangle,
        performanceCounters?: ChartRoutingPerformanceCounters,
    ): boolean | undefined;
    set (
        curve: ChartRoutingCubicCurve,
        obstacle: ChartRoutingRectangle,
        isClear: boolean,
        performanceCounters?: ChartRoutingPerformanceCounters,
    ): void;
    getSampledLength (
        curve: ChartRoutingCubicCurve,
        performanceCounters?: ChartRoutingPerformanceCounters,
    ): number | undefined;
    setSampledLength (
        curve: ChartRoutingCubicCurve,
        length: number,
        performanceCounters?: ChartRoutingPerformanceCounters,
    ): void;
}


//--------------------------------------------------------------------------------------------------
// Interface: FittedCurveChain
//
// Description:
//
//   Defines the structure of fitted curve chain.
//
//--------------------------------------------------------------------------------------------------

interface FittedCurveChain
{
    readonly curve: ChartRoutingCubicCurve | null;
    readonly length: number;
    readonly previousIndex: number;
    readonly spanCount: number;
}

const MAXIMUM_CUBIC_FIT_LOOKAHEAD     = 64;
const CURVE_LENGTH_COMPARISON_EPSILON = 0.000001;
const CURVE_CONTROL_SCALE_CANDIDATES  = [ 1, 0.75, 0.5, 0.25, 0.125, 0.0625, 0.03125, 0.015625 ] as const;


//--------------------------------------------------------------------------------------------------
// Function: routingPointsEqual
//
// Description:
//
//   Derives the routing points equal.
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

function routingPointsEqual ( left: ChartRoutingPoint, right: ChartRoutingPoint ): boolean
{
    // Return the computed result.

    return Math.abs ( left.x - right.x ) <= COORDINATE_EPSILON &&
        Math.abs ( left.y - right.y ) <= COORDINATE_EPSILON;
}


//--------------------------------------------------------------------------------------------------
// Function: compactRoutingBackbone
//
// Description:
//
//   Compacts the routing backbone.
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

function compactRoutingBackbone ( points: readonly ChartRoutingPoint[] ): ChartRoutingPoint[]
{
    // Calculate the unique points value from the current inputs.

    const uniquePoints = points.filter ( ( point, index ) => index === 0 ||
        !routingPointsEqual ( point, points [ index - 1 ] ?? point ) );


    // Return the filtered collection.

    return uniquePoints.filter ( ( point, index ) =>
    {
        // Initialize the local values needed by this operation.

        const previousPoint = uniquePoints [ index - 1 ];
        const nextPoint     = uniquePoints [ index + 1 ];


        // Return the computed result.

        return previousPoint === undefined || nextPoint === undefined ||
            !( Math.abs ( previousPoint.x - point.x ) <= COORDINATE_EPSILON &&
                Math.abs ( point.x - nextPoint.x ) <= COORDINATE_EPSILON ) &&
            !( Math.abs ( previousPoint.y - point.y ) <= COORDINATE_EPSILON &&
                Math.abs ( point.y - nextPoint.y ) <= COORDINATE_EPSILON );
    } );
}


//--------------------------------------------------------------------------------------------------
// Function: normalizedDirection
//
// Description:
//
//   Returns the unit vector from source to target, with a stable fallback for coincident points.
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

function normalizedDirection (
    source: ChartRoutingPoint,
    target: ChartRoutingPoint,
): ChartRoutingPoint
{
    // Normalize (dx, dy) by its Euclidean length sqrt(dx^2 + dy^2).

    const horizontalDistance = target.x - source.x;
    const verticalDistance   = target.y - source.y;
    const length             = Math.hypot ( horizontalDistance, verticalDistance );


    // Return the result selected by the current condition.

    return length <= COORDINATE_EPSILON
        ? { x: 1, y: 0 }
        : { x: horizontalDistance / length, y: verticalDistance / length };
}


//--------------------------------------------------------------------------------------------------
// Function: backboneTangent
//
// Description:
//
//   Estimates a unit tangent by averaging the incoming and outgoing unit directions.
//
// Parameters:
//
//   - points:
//     The points supplied to the operation.
//
//   - pointIndex:
//     The point index supplied to the operation.
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

function backboneTangent (
    points: readonly ChartRoutingPoint[],
    pointIndex: number,
): ChartRoutingPoint
{
    // Initialize the local values needed by this operation.

    const point         = points [ pointIndex ] ?? { x: 0, y: 0 };
    const previousPoint = points [ pointIndex - 1 ];
    const nextPoint     = points [ pointIndex + 1 ];


    // Handle the case where previous point matches undefined.

    if ( previousPoint === undefined )
    {
        // Return the normalized direction result.

        return normalizedDirection ( point, nextPoint ?? point );
    }


    // Handle the case where next point matches undefined.

    if ( nextPoint === undefined )
    {
        // Return the normalized direction result.

        return normalizedDirection ( previousPoint, point );
    }


    // Add the incoming and outgoing unit vectors, then normalize the sum. Opposing directions
    // cancel, so that degenerate case uses the outgoing direction directly.

    const incomingDirection = normalizedDirection ( previousPoint, point );
    const outgoingDirection = normalizedDirection ( point, nextPoint );
    const combinedLength    = Math.hypot (
        incomingDirection.x + outgoingDirection.x,
        incomingDirection.y + outgoingDirection.y,
    );


    // Return the result selected by the current condition.

    return combinedLength <= COORDINATE_EPSILON
        ? outgoingDirection
        : {
            x: ( incomingDirection.x + outgoingDirection.x ) / combinedLength,
            y: ( incomingDirection.y + outgoingDirection.y ) / combinedLength,
        };
}


//--------------------------------------------------------------------------------------------------
// Function: backboneIntervalLength
//
// Description:
//
//   Sums the Euclidean lengths of consecutive backbone segments over an index interval.
//
// Parameters:
//
//   - points:
//     The points supplied to the operation.
//
//   - sourceIndex:
//     The source index supplied to the operation.
//
//   - targetIndex:
//     The target index supplied to the operation.
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

function backboneIntervalLength (
    points: readonly ChartRoutingPoint[],
    sourceIndex: number,
    targetIndex: number,
): number
{
    // Initialize the local values needed by this operation.

    let length = 0;


    // Repeat the operation across the bounded iteration range.

    for ( let pointIndex = sourceIndex + 1; pointIndex <= targetIndex; pointIndex += 1 )
    {
        // Initialize the local values needed by this operation.

        const source = points [ pointIndex - 1 ];
        const target = points [ pointIndex ];


        // Handle the case where all required conditions are satisfied.

        if ( source !== undefined && target !== undefined )
        {
            // Add sqrt((target.x - source.x)^2 + (target.y - source.y)^2).

            length += Math.hypot ( target.x - source.x, target.y - source.y );
        }
    }


    // Return the length.

    return length;
}


//--------------------------------------------------------------------------------------------------
// Function: fittedCurveForBackboneInterval
//
// Description:
//
//   Derives the fitted curve for backbone interval.
//
// Parameters:
//
//   - points:
//     The points supplied to the operation.
//
//   - sourceIndex:
//     The source index supplied to the operation.
//
//   - targetIndex:
//     The target index supplied to the operation.
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

function fittedCurveForBackboneInterval (
    points: readonly ChartRoutingPoint[],
    sourceIndex: number,
    targetIndex: number,
): ChartRoutingCubicCurve | null
{
    // Initialize the local values needed by this operation.

    const source          = points [ sourceIndex ];
    const target          = points [ targetIndex ];
    const sourceNeighbour = points [ sourceIndex + 1 ];
    const targetNeighbour = points [ targetIndex - 1 ];


    // Handle the case where at least one branch condition is satisfied.

    if ( source === undefined || target === undefined || sourceNeighbour === undefined ||
        targetNeighbour === undefined )
    {
        // Return the computed result.

        return null;
    }


    // Initialize the local values needed by this operation.

    const intervalLength  = backboneIntervalLength ( points, sourceIndex, targetIndex );
    const sourceLegLength = Math.hypot (
        sourceNeighbour.x - source.x,
        sourceNeighbour.y - source.y,
    );
    const targetLegLength = Math.hypot (
        target.x - targetNeighbour.x,
        target.y - targetNeighbour.y,
    );
    const sourceControlDistance = Math.min ( intervalLength / 3, sourceLegLength * 2 / 3 );
    const targetControlDistance = Math.min ( intervalLength / 3, targetLegLength * 2 / 3 );
    const sourceTangent         = backboneTangent ( points, sourceIndex );
    const targetTangent         = backboneTangent ( points, targetIndex );


    // Return the assembled result.

    return {
        source,
        sourceControl:
        {
            x: source.x + sourceTangent.x * sourceControlDistance,
            y: source.y + sourceTangent.y * sourceControlDistance,
        },
        target,
        targetControl:
        {
            x: target.x - targetTangent.x * targetControlDistance,
            y: target.y - targetTangent.y * targetControlDistance,
        },
    };
}


//--------------------------------------------------------------------------------------------------
// Function: curveWithScaledControls
//
// Description:
//
//   Derives the curve with scaled controls.
//
// Parameters:
//
//   - curve:
//     The curve supplied to the operation.
//
//   - scale:
//     The scale supplied to the operation.
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

function curveWithScaledControls (
    curve: ChartRoutingCubicCurve,
    scale: number,
): ChartRoutingCubicCurve
{
    // Return the assembled result.

    return {
        source: curve.source,
        sourceControl:
        {
            x: curve.source.x + ( curve.sourceControl.x - curve.source.x ) * scale,
            y: curve.source.y + ( curve.sourceControl.y - curve.source.y ) * scale,
        },
        target: curve.target,
        targetControl:
        {
            x: curve.target.x + ( curve.targetControl.x - curve.target.x ) * scale,
            y: curve.target.y + ( curve.targetControl.y - curve.target.y ) * scale,
        },
    };
}


//--------------------------------------------------------------------------------------------------
// Function: clearFittedCurveForBackboneInterval
//
// Description:
//
//   Clears the fitted curve for backbone interval.
//
// Parameters:
//
//   - points:
//     The points supplied to the operation.
//
//   - sourceIndex:
//     The source index supplied to the operation.
//
//   - targetIndex:
//     The target index supplied to the operation.
//
//   - obstacles:
//     The obstacles supplied to the operation.
//
//   - performanceCounters:
//     The performance counters supplied to the operation.
//
//   - obstacleIndex:
//     The obstacle index supplied to the operation.
//
//   - proofMemoization:
//     The proof memoization supplied to the operation.
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

function clearFittedCurveForBackboneInterval (
    points: readonly ChartRoutingPoint[],
    sourceIndex: number,
    targetIndex: number,
    obstacles: readonly ChartRoutingRectangle[],
    performanceCounters?: ChartRoutingPerformanceCounters,
    obstacleIndex?: ChartRoutingSpatialQuery<ChartRoutingRectangle>,
    proofMemoization?: ChartRoutingCurveProofMemoization,
): ChartRoutingCubicCurve | null
{
    // Initialize the local values needed by this operation.

    const curve = fittedCurveForBackboneInterval ( points, sourceIndex, targetIndex );


    // Handle the case where curve matches an absent value.

    if ( curve === null )
    {
        // Return the computed result.

        return null;
    }


    // Process each scale from the curve control scale candidates collection in order.

    for ( const scale of CURVE_CONTROL_SCALE_CANDIDATES )
    {
        // Initialize the local values needed by this operation.

        const candidate = curveWithScaledControls ( curve, scale );


        // Handle the case where all required conditions are satisfied.

        if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined )
        {
            performanceCounters.cubicCandidateCount += 1;
        }


        // Handle the case where curve is clear of obstacles result is enabled.

        if ( curveIsClearOfObstacles (
            candidate,
            obstacles,
            performanceCounters,
            obstacleIndex,
            proofMemoization,
        ) )
        {
            // Return the candidate.

            return candidate;
        }
    }


    // Handle the case where target index differs from current value.

    if ( targetIndex !== sourceIndex + 1 )
    {
        // Return the computed result.

        return null;
    }


    // Initialize the local values needed by this operation.

    const source        = points [ sourceIndex ];
    const target        = points [ targetIndex ];
    const straightCurve = source === undefined || target === undefined
        ? undefined
        : cubicBezierCurvesFromPreservedBackbone ( [ source, target ] ) [ 0 ];


    // Handle the case where all required conditions are satisfied.

    if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && straightCurve !== undefined &&
        performanceCounters !== undefined )
    {
        performanceCounters.cubicCandidateCount += 1;
    }


    // Return the result selected by the current condition.

    return straightCurve !== undefined &&
        curveIsClearOfObstacles (
            straightCurve,
            obstacles,
            performanceCounters,
            obstacleIndex,
            proofMemoization,
        )
        ? straightCurve
        : null;
}


//--------------------------------------------------------------------------------------------------
// Function: sampledCurveLength
//
// Description:
//
//   Derives the sampled curve length.
//
// Parameters:
//
//   - curve:
//     The curve supplied to the operation.
//
//   - performanceCounters:
//     The performance counters supplied to the operation.
//
//   - proofMemoization:
//     The proof memoization supplied to the operation.
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

function sampledCurveLength (
    curve: ChartRoutingCubicCurve,
    performanceCounters?: ChartRoutingPerformanceCounters,
    proofMemoization?: ChartRoutingCurveProofMemoization,
): number
{
    // Initialize the local values needed by this operation.

    const memoizedLength = proofMemoization?.getSampledLength ( curve, performanceCounters );


    // Handle the case where memoized length differs from undefined.

    if ( memoizedLength !== undefined )
    {
        // Return the memoized length.

        return memoizedLength;
    }


    // Initialize the local values needed by this operation.

    const samplePoints = cubicBezierCurveSamplePoints ( [ curve ] );

    const length = samplePoints.slice ( 1 ).reduce ( ( accumulatedLength, point, pointIndex ) =>
    {
        // Initialize the local values needed by this operation.

        const previousPoint = samplePoints [ pointIndex ] ?? point;


        // Return the computed result.

        return accumulatedLength + Math.hypot ( point.x - previousPoint.x, point.y - previousPoint.y );
    }, 0 );

    proofMemoization?.setSampledLength ( curve, length, performanceCounters );

    // Return the length.

    return length;
}


//--------------------------------------------------------------------------------------------------
// Function: fittedCurveChainIsBetter
//
// Description:
//
//   Derives the fitted curve chain is better.
//
// Parameters:
//
//   - candidate:
//     The candidate supplied to the operation.
//
//   - current:
//     The current supplied to the operation.
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

function fittedCurveChainIsBetter (
    candidate: FittedCurveChain,
    current: FittedCurveChain | undefined,
): boolean
{
    // Return the computed result.

    return current === undefined ||
        candidate.length < current.length - CURVE_LENGTH_COMPARISON_EPSILON ||
        Math.abs ( candidate.length - current.length ) <= CURVE_LENGTH_COMPARISON_EPSILON &&
            candidate.spanCount < current.spanCount;
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
//   - obstacles:
//     The obstacles supplied to the operation.
//
//   - performanceCounters:
//     The performance counters supplied to the operation.
//
//   - obstacleIndex:
//     The obstacle index supplied to the operation.
//
//   - proofMemoization:
//     The proof memoization supplied to the operation.
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

export function cubicBezierCurvesFromBackbone (
    requestedPoints: readonly ChartRoutingPoint[],
    obstacles: readonly ChartRoutingRectangle[] = [],
    performanceCounters?: ChartRoutingPerformanceCounters,
    obstacleIndex?: ChartRoutingSpatialQuery<ChartRoutingRectangle>,
    proofMemoization?: ChartRoutingCurveProofMemoization,
): ChartRoutingCubicCurve[]
{
    // Initialize the local values needed by this operation.

    const points                = compactRoutingBackbone ( requestedPoints );
    const resolvedObstacleIndex = obstacleIndex ?? new PackedChartRoutingSpatialIndex (
        obstacles.map ( obstacle => ( {
            bounds: chartRoutingSpatialBoundsFromRectangle ( obstacle ),
            value: obstacle,
        } ) ),
    );


    // Handle the case where points length is at most 2.

    if ( points.length <= 2 )
    {
        // Return the cubic bezier curves from preserved backbone result.

        return cubicBezierCurvesFromPreservedBackbone ( points );
    }

    const fittedChains: Array<FittedCurveChain | undefined> = Array.from ( { length: points.length } );

    fittedChains [ 0 ] = { curve: null, length: 0, previousIndex: -1, spanCount: 0 };


    // Repeat the operation across the bounded iteration range.

    for ( let targetIndex = 1; targetIndex < points.length; targetIndex += 1 )
    {
        // Initialize the local values needed by this operation.

        const minimumSourceIndex = Math.max ( 0, targetIndex - MAXIMUM_CUBIC_FIT_LOOKAHEAD );
        const sourceIndices      = Array.from (
            { length: targetIndex - minimumSourceIndex },
            ( _, offset ) => minimumSourceIndex + offset,
        );


        // Handle the case where minimum source index exceeds the 0 value.

        if ( minimumSourceIndex > 0 )
        {
            sourceIndices.unshift ( 0 );
        }


        // Process each source index from the source indices collection in order.

        for ( const sourceIndex of sourceIndices )
        {
            // Initialize the local values needed by this operation.

            const sourceChain = fittedChains [ sourceIndex ];
            const curve       = clearFittedCurveForBackboneInterval (
                points,
                sourceIndex,
                targetIndex,
                obstacles,
                performanceCounters,
                resolvedObstacleIndex,
                proofMemoization,
            );


            // Handle the case where at least one branch condition is satisfied.

            if ( sourceChain === undefined || curve === null )
            {
                continue;
            }


            // Calculate the candidate value from the current inputs.

            const candidate: FittedCurveChain = {
                curve,
                length: sourceChain.length + sampledCurveLength ( curve, performanceCounters, proofMemoization ),
                previousIndex: sourceIndex,
                spanCount: sourceChain.spanCount + 1,
            };


            // Handle the case where fitted curve chain is better result is enabled.

            if ( fittedCurveChainIsBetter ( candidate, fittedChains [ targetIndex ] ) )
            {
                fittedChains [ targetIndex ] = candidate;
            }
        }
    }


    // Initialize the local values needed by this operation.

    const curves: ChartRoutingCubicCurve[] = [];
    let chainIndex                         = points.length - 1;


    // Continue the operation while its terminating condition has not been reached.

    while ( chainIndex > 0 )
    {
        // Initialize the local values needed by this operation.

        const chain = fittedChains [ chainIndex ];


        // Handle the case where at least one branch condition is satisfied.

        if ( chain?.curve === null || chain?.curve === undefined || chain.previousIndex < 0 )
        {
            // Return the assembled result collection.

            return [];
        }

        curves.push ( chain.curve );
        chainIndex = chain.previousIndex;
    }


    // Return the reverse result.

    return curves.reverse ();
}


//--------------------------------------------------------------------------------------------------
// Function: pointOnCubicBezierCurve
//
// Description:
//
//   Derives the point on cubic bezier curve.
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

export function pointOnCubicBezierCurve (
    curve: ChartRoutingCubicCurve,
    position: number,
): ChartRoutingPoint
{
    // Initialize the local values needed by this operation.

    const boundedPosition = Math.max ( 0, Math.min ( 1, position ) );
    const complement      = 1 - boundedPosition;

    // Return the assembled result.

    return {
        x: complement ** 3 * curve.source.x +
            3 * complement ** 2 * boundedPosition * curve.sourceControl.x +
            3 * complement * boundedPosition ** 2 * curve.targetControl.x +
            boundedPosition ** 3 * curve.target.x,
        y: complement ** 3 * curve.source.y +
            3 * complement ** 2 * boundedPosition * curve.sourceControl.y +
            3 * complement * boundedPosition ** 2 * curve.targetControl.y +
            boundedPosition ** 3 * curve.target.y,
    };
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
    point: ChartRoutingPoint,
    center: ChartRoutingPoint,
    boundary: ChartRoutingBoundary,
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

    const cornerRadius = Math.min ( boundary.cornerRadius ?? 10, halfWidth, halfHeight );

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
    curves: readonly ChartRoutingCubicCurve[],
    center: ChartRoutingPoint,
    boundary: ChartRoutingBoundary,
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

                if ( pointInsideBoundary ( pointOnCubicBezierCurve ( curve, outsidePosition ), center, boundary ) )
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

                    if ( pointInsideBoundary ( pointOnCubicBezierCurve ( curve, middle ), center, boundary ) )
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

            if ( pointInsideBoundary ( pointOnCubicBezierCurve ( curve, outsidePosition ), center, boundary ) )
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

                if ( pointInsideBoundary ( pointOnCubicBezierCurve ( curve, middle ), center, boundary ) )
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

export function clipCubicBezierCurvesToBoundaries (
    curves: readonly ChartRoutingCubicCurve[],
    clipping: ChartRoutingCurveBoundaryClipping,
): ChartRoutingCubicCurve[] | null
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
        splitCubicCurveAtPosition ( sourceCurve, sourceLocation.position ) [ 1 ],
        ...curves.slice ( sourceLocation.curveIndex + 1, targetLocation.curveIndex ),
        splitCubicCurveAtPosition ( targetCurve, targetLocation.position ) [ 0 ],
    ];
}

//--------------------------------------------------------------------------------------------------
// Function: cubicBezierCurveSamplePoints
//
// Description:
//
//   Derives the cubic bezier curve sample points.
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

export function cubicBezierCurveSamplePoints (
    curves: readonly ChartRoutingCubicCurve[],
): ChartRoutingPoint[]
{
    // Return the flat map result.

    return curves.flatMap ( ( curve, curveIndex ) =>
        Array.from (
            { length: CURVE_ARC_LENGTH_SAMPLES_PER_SPAN + 1 },
            ( _, sampleIndex ) => pointOnCubicBezierCurve (
                curve,
                sampleIndex / CURVE_ARC_LENGTH_SAMPLES_PER_SPAN,
            ),
        ).slice ( curveIndex === 0 ? 0 : 1 ) );
}

//--------------------------------------------------------------------------------------------------
// Function: routingBackboneCurveSamplePoints
//
// Description:
//
//   Derives the routing backbone curve sample points.
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

export function routingBackboneCurveSamplePoints (
    points: readonly ChartRoutingPoint[],
): ChartRoutingPoint[]
{
    // Return the cubic bezier curve sample points result.

    return cubicBezierCurveSamplePoints ( cubicBezierCurvesFromBackbone ( points ) );
}

//--------------------------------------------------------------------------------------------------
// Function: routingBackboneVisibleCurveSamplePoints
//
// Description:
//
//   Derives the routing backbone visible curve sample points.
//
// Parameters:
//
//   - points:
//     The points supplied to the operation.
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

export function routingBackboneVisibleCurveSamplePoints (
    points: readonly ChartRoutingPoint[],
    clipping: ChartRoutingCurveBoundaryClipping,
): ChartRoutingPoint[]
{
    // Initialize the local values needed by this operation.

    const curves        = cubicBezierCurvesFromBackbone ( points );
    const visibleCurves = clipCubicBezierCurvesToBoundaries ( curves, clipping ) ?? curves;

    // Return the cubic bezier curve sample points result.

    return cubicBezierCurveSamplePoints ( visibleCurves );
}

//--------------------------------------------------------------------------------------------------
// Function: pointAlongSampledCurve
//
// Description:
//
//   Derives the point along sampled curve.
//
// Parameters:
//
//   - points:
//     The points supplied to the operation.
//
//   - fraction:
//     The fraction supplied to the operation.
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

export function pointAlongSampledCurve (
    points: readonly ChartRoutingPoint[],
    fraction: number,
): ChartRoutingPoint
{
    // Initialize the local values needed by this operation.

    const boundedFraction = Math.max ( 0, Math.min ( 1, fraction ) );
    const segmentLengths  = points.slice ( 1 ).map ( ( point, index ) =>
    {
        // Initialize the local values needed by this operation.

        const previousPoint = points [ index ] ?? point;

        // Return the hypot result.

        return Math.hypot ( point.x - previousPoint.x, point.y - previousPoint.y );
    } );
    const totalLength   = segmentLengths.reduce ( ( length, segmentLength ) => length + segmentLength, 0 );
    let remainingLength = totalLength * boundedFraction;

    // Repeat the operation across the bounded iteration range.

    for ( let index = 1; index < points.length; index += 1 )
    {
        // Initialize the local values needed by this operation.

        const source        = points [ index - 1 ];
        const target        = points [ index ];
        const segmentLength = segmentLengths [ index - 1 ] ?? 0;

        // Handle the case where at least one branch condition is satisfied.

        if ( source === undefined || target === undefined )
        {
            continue;
        }

        // Handle the case where remaining length does not exceed segment length.

        if ( remainingLength <= segmentLength )
        {
            // Calculate the segment position value from the current inputs.

            const segmentPosition = segmentLength === 0 ? 0 : remainingLength / segmentLength;

            // Return the interpolate point result.

            return interpolatePoint ( source, target, segmentPosition );
        }

        remainingLength -= segmentLength;
    }

    // Return the computed result.

    return points.at ( -1 ) ?? { x: 0, y: 0 };
}

//--------------------------------------------------------------------------------------------------
// Function: controlBoundsAreDisjoint
//
// Description:
//
//   Derives the control bounds are disjoint.
//
// Parameters:
//
//   - curve:
//     The curve supplied to the operation.
//
//   - rectangle:
//     The rectangle supplied to the operation.
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

function controlBoundsAreDisjoint (
    curve: ChartRoutingCubicCurve,
    rectangle: ChartRoutingRectangle,
): boolean
{
    // Initialize the local values needed by this operation.

    const points   = [ curve.source, curve.sourceControl, curve.targetControl, curve.target ];
    const minimumX = Math.min ( ...points.map ( point => point.x ) );
    const maximumX = Math.max ( ...points.map ( point => point.x ) );
    const minimumY = Math.min ( ...points.map ( point => point.y ) );
    const maximumY = Math.max ( ...points.map ( point => point.y ) );

    // Return the computed result.

    return maximumX <= rectangle.x || minimumX >= rectangle.x + rectangle.width ||
        maximumY <= rectangle.y || minimumY >= rectangle.y + rectangle.height;
}

//--------------------------------------------------------------------------------------------------
// Function: curveIsProvenClear
//
// Description:
//
//   Derives the curve is proven clear.
//
// Parameters:
//
//   - curve:
//     The curve supplied to the operation.
//
//   - rectangle:
//     The rectangle supplied to the operation.
//
//   - budget:
//     The budget supplied to the operation.
//
//   - depth:
//     The depth supplied to the operation.
//
//   - performanceCounters:
//     The performance counters supplied to the operation.
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

function curveIsProvenClear (
    curve: ChartRoutingCubicCurve,
    rectangle: ChartRoutingRectangle,
    budget: ClearanceProofBudget,
    depth = 0,
    performanceCounters?: ChartRoutingPerformanceCounters,
): boolean
{
    // Handle the case where all required conditions are satisfied.

    if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined )
    {
        performanceCounters.recursiveProofCallCount += 1;
    }


    // Handle the case where budget remaining nodes is at most 0.

    if ( budget.remainingNodes <= 0 )
    {
        // Return the computed result.

        return false;
    }

    budget.remainingNodes -= 1;

    // Handle the case where control bounds are disjoint result is enabled.

    if ( controlBoundsAreDisjoint ( curve, rectangle ) )
    {
        // Return the computed result.

        return true;
    }

    // Handle the case where depth is at least maximum subdivision depth.

    if ( depth >= MAXIMUM_SUBDIVISION_DEPTH )
    {
        // Return the computed result.

        return false;
    }

    const [ first, second ] = splitCubicCurve ( curve );

    // Return the computed result.

    return curveIsProvenClear ( first, rectangle, budget, depth + 1, performanceCounters ) &&
        curveIsProvenClear ( second, rectangle, budget, depth + 1, performanceCounters );
}


//--------------------------------------------------------------------------------------------------
// Function: curveIsProvenClearOfObstacle
//
// Description:
//
//   Derives the curve is proven clear of obstacle.
//
// Parameters:
//
//   - curve:
//     The curve supplied to the operation.
//
//   - obstacle:
//     The obstacle supplied to the operation.
//
//   - performanceCounters:
//     The performance counters supplied to the operation.
//
//   - proofMemoization:
//     The proof memoization supplied to the operation.
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

function curveIsProvenClearOfObstacle (
    curve: ChartRoutingCubicCurve,
    obstacle: ChartRoutingRectangle,
    performanceCounters?: ChartRoutingPerformanceCounters,
    proofMemoization?: ChartRoutingCurveProofMemoization,
): boolean
{
    // Initialize the local values needed by this operation.

    const memoizedResult = proofMemoization?.get ( curve, obstacle, performanceCounters );


    // Handle the case where memoized result differs from undefined.

    if ( memoizedResult !== undefined )
    {
        // Return the memoized result.

        return memoizedResult;
    }


    // Handle the case where all required conditions are satisfied.

    if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined )
    {
        performanceCounters.broadPhaseCandidateCount += 1;
        performanceCounters.exactObstacleTestCount += 1;
    }


    // Calculate the is clear value from the current inputs.

    const isClear = curveIsProvenClear (
        curve,
        {
            height: obstacle.height + CLEARANCE_PROOF_MARGIN * 2,
            width:  obstacle.width + CLEARANCE_PROOF_MARGIN * 2,
            x:      obstacle.x - CLEARANCE_PROOF_MARGIN,
            y:      obstacle.y - CLEARANCE_PROOF_MARGIN,
        },
        { remainingNodes: MAXIMUM_CLEARANCE_PROOF_NODE_COUNT },
        0,
        performanceCounters,
    );

    proofMemoization?.set ( curve, obstacle, isClear, performanceCounters );

    // Return the is clear.

    return isClear;
}


//--------------------------------------------------------------------------------------------------
// Function: curveIsClearOfObstacles
//
// Description:
//
//   Derives the curve is clear of obstacles.
//
// Parameters:
//
//   - curve:
//     The curve supplied to the operation.
//
//   - obstacles:
//     The obstacles supplied to the operation.
//
//   - performanceCounters:
//     The performance counters supplied to the operation.
//
//   - obstacleIndex:
//     The obstacle index supplied to the operation.
//
//   - proofMemoization:
//     The proof memoization supplied to the operation.
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

function curveIsClearOfObstacles (
    curve: ChartRoutingCubicCurve,
    obstacles: readonly ChartRoutingRectangle[],
    performanceCounters?: ChartRoutingPerformanceCounters,
    obstacleIndex?: ChartRoutingSpatialQuery<ChartRoutingRectangle>,
    proofMemoization?: ChartRoutingCurveProofMemoization,
): boolean
{
    //----------------------------------------------------------------------------------------------
    // Function: obstacleIsClear
    //
    // Description:
    //
    //   Derives the obstacle is clear.
    //
    // Parameters:
    //
    //   - obstacle:
    //     The obstacle supplied to the operation.
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

    const obstacleIsClear = ( obstacle: ChartRoutingRectangle ): boolean =>
        curveIsProvenClearOfObstacle ( curve, obstacle, performanceCounters, proofMemoization );


    // Return the result selected by the current condition.

    return obstacleIndex === undefined
        ? obstacles.every ( obstacleIsClear )
        : obstacleIndex.visit ( chartRoutingSpatialBoundsFromPoints (
            [ curve.source, curve.sourceControl, curve.targetControl, curve.target ],
            CLEARANCE_PROOF_MARGIN,
        ), obstacleIsClear );
}


//--------------------------------------------------------------------------------------------------
// Function: cubicBezierCurvesAreClearOfObstacles
//
// Description:
//
//   Derives the cubic bezier curves are clear of obstacles.
//
// Parameters:
//
//   - curves:
//     The curves supplied to the operation.
//
//   - obstacles:
//     The obstacles supplied to the operation.
//
//   - performanceCounters:
//     The performance counters supplied to the operation.
//
//   - obstacleIndex:
//     The obstacle index supplied to the operation.
//
//   - proofMemoization:
//     The proof memoization supplied to the operation.
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

export function cubicBezierCurvesAreClearOfObstacles (
    curves: readonly ChartRoutingCubicCurve[],
    obstacles: readonly ChartRoutingRectangle[],
    performanceCounters?: ChartRoutingPerformanceCounters,
    obstacleIndex?: ChartRoutingSpatialQuery<ChartRoutingRectangle>,
    proofMemoization?: ChartRoutingCurveProofMemoization,
): boolean
{
    // Initialize the local values needed by this operation.

    const resolvedObstacleIndex = obstacleIndex ?? new PackedChartRoutingSpatialIndex (
        obstacles.map ( obstacle => ( {
            bounds: chartRoutingSpatialBoundsFromRectangle ( obstacle ),
            value: obstacle,
        } ) ),
    );


    // Return the computed result.

    return curves.length > 0 && curves.every ( curve => curveIsClearOfObstacles (
        curve,
        obstacles,
        performanceCounters,
        resolvedObstacleIndex,
        proofMemoization,
    ) );
}


//--------------------------------------------------------------------------------------------------
// Function: pointsFormCubicDetour
//
// Description:
//
//   Derives the points form cubic detour.
//
// Parameters:
//
//   - points:
//     The points supplied to the operation.
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

function pointsFormCubicDetour ( points: readonly ChartRoutingPoint[] ): boolean
{
    // Initialize the local values needed by this operation.

    const firstGravityPoint  = points [ 1 ];
    const secondGravityPoint = points [ 2 ];

    // Return the computed result.

    return points.length === 4 && firstGravityPoint !== undefined && secondGravityPoint !== undefined &&
        ( Math.abs ( firstGravityPoint.x - secondGravityPoint.x ) <= COORDINATE_EPSILON ||
            Math.abs ( firstGravityPoint.y - secondGravityPoint.y ) <= COORDINATE_EPSILON );
}

//--------------------------------------------------------------------------------------------------
// Function: cubicCurveFromPoints
//
// Description:
//
//   Derives the cubic curve from points.
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

function cubicCurveFromPoints ( points: readonly ChartRoutingPoint[] ): ChartRoutingCubicCurve | null
{
    // Initialize the local values needed by this operation.

    const source        = points [ 0 ];
    const sourceControl = points [ 1 ];
    const targetControl = points [ 2 ];
    const target        = points [ 3 ];

    // Return the result selected by the current condition.

    return source === undefined || sourceControl === undefined || targetControl === undefined || target === undefined
        ? null
        : { source, sourceControl, target, targetControl };
}

//--------------------------------------------------------------------------------------------------
// Function: routingBackboneIsClearOfObstacles
//
// Description:
//
//   Derives the routing backbone is clear of obstacles.
//
// Parameters:
//
//   - points:
//     The points supplied to the operation.
//
//   - obstacles:
//     The obstacles supplied to the operation.
//
//   - performanceCounters:
//     The performance counters supplied to the operation.
//
//   - obstacleIndex:
//     The obstacle index supplied to the operation.
//
//   - proofMemoization:
//     The proof memoization supplied to the operation.
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

export function routingBackboneIsClearOfObstacles (
    points: readonly ChartRoutingPoint[],
    obstacles: readonly ChartRoutingRectangle[],
    performanceCounters?: ChartRoutingPerformanceCounters,
    obstacleIndex?: ChartRoutingSpatialQuery<ChartRoutingRectangle>,
    proofMemoization?: ChartRoutingCurveProofMemoization,
): boolean
{
    // Initialize the local values needed by this operation.

    const resolvedObstacleIndex = obstacleIndex ?? new PackedChartRoutingSpatialIndex (
        obstacles.map ( obstacle => ( {
            bounds: chartRoutingSpatialBoundsFromRectangle ( obstacle ),
            value: obstacle,
        } ) ),
    );
    const curves = cubicBezierCurvesFromBackbone (
        points,
        obstacles,
        performanceCounters,
        resolvedObstacleIndex,
        proofMemoization,
    );


    // Return the cubic bezier curves are clear of obstacles result.

    return cubicBezierCurvesAreClearOfObstacles (
        curves,
        obstacles,
        performanceCounters,
        resolvedObstacleIndex,
        proofMemoization,
    );
}


//--------------------------------------------------------------------------------------------------
// Function: shiftedDetourPoints
//
// Description:
//
//   Derives the shifted detour points.
//
// Parameters:
//
//   - points:
//     The points supplied to the operation.
//
//   - shift:
//     The shift supplied to the operation.
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

function shiftedDetourPoints (
    points: readonly ChartRoutingPoint[],
    shift: number,
    direction: DetourShiftDirection,
): ChartRoutingPoint[] | null
{
    // Initialize the local values needed by this operation.

    const source             = points [ 0 ];
    const firstGravityPoint  = points [ 1 ];
    const secondGravityPoint = points [ 2 ];
    const target             = points [ 3 ];

    // Handle the case where at least one branch condition is satisfied.

    if ( source === undefined || firstGravityPoint === undefined || secondGravityPoint === undefined ||
        target === undefined )
    {
        // Return the computed result.

        return null;
    }

    // Handle the case where abs result does not exceed coordinate epsilon.

    if ( Math.abs ( firstGravityPoint.x - secondGravityPoint.x ) <= COORDINATE_EPSILON )
    {
        // Return the assembled result collection.

        return [
            source,
            { x: firstGravityPoint.x + direction * shift, y: firstGravityPoint.y },
            { x: secondGravityPoint.x + direction * shift, y: secondGravityPoint.y },
            target,
        ];
    }

    // Return the assembled result collection.

    return [
        source,
        { x: firstGravityPoint.x, y: firstGravityPoint.y + direction * shift },
        { x: secondGravityPoint.x, y: secondGravityPoint.y + direction * shift },
        target,
    ];
}

//--------------------------------------------------------------------------------------------------
// Function: detourShiftDirection
//
// Description:
//
//   Derives the detour shift direction.
//
// Parameters:
//
//   - points:
//     The points supplied to the operation.
//
//   - obstacles:
//     The obstacles supplied to the operation.
//
//   - performanceCounters:
//     The performance counters supplied to the operation.
//
//   - obstacleIndex:
//     The obstacle index supplied to the operation.
//
//   - proofMemoization:
//     The proof memoization supplied to the operation.
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

function detourShiftDirection (
    points: readonly ChartRoutingPoint[],
    obstacles: readonly ChartRoutingRectangle[],
    performanceCounters?: ChartRoutingPerformanceCounters,
    obstacleIndex?: ChartRoutingSpatialQuery<ChartRoutingRectangle>,
    proofMemoization?: ChartRoutingCurveProofMemoization,
): DetourShiftDirection | null
{
    // Initialize the local values needed by this operation.

    const curve              = cubicCurveFromPoints ( points );
    const firstGravityPoint  = points [ 1 ];
    const secondGravityPoint = points [ 2 ];

    // Handle the case where at least one branch condition is satisfied.

    if ( curve === null || firstGravityPoint === undefined || secondGravityPoint === undefined )
    {
        // Return the computed result.

        return null;
    }

    // Initialize the local values needed by this operation.

    const detourIsVertical                             = Math.abs ( firstGravityPoint.x - secondGravityPoint.x ) <= COORDINATE_EPSILON;
    const detourPosition                               = detourIsVertical ? firstGravityPoint.x : firstGravityPoint.y;
    let nearestBoundaryDistance                        = Number.POSITIVE_INFINITY;
    let selectedDirection: DetourShiftDirection | null = null;

    //----------------------------------------------------------------------------------------------
    // Function: considerObstacle
    //
    // Description:
    //
    //   Derives the consider obstacle.
    //
    // Parameters:
    //
    //   - obstacle:
    //     The obstacle supplied to the operation.
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

    const considerObstacle = ( obstacle: ChartRoutingRectangle ): boolean =>
    {
        // Handle the case where curve is proven clear of obstacle result is enabled.

        if ( curveIsProvenClearOfObstacle ( curve, obstacle, performanceCounters, proofMemoization ) )
        {
            // Return the computed result.

            return true;
        }

        // Initialize the local values needed by this operation.

        const minimumBoundary         = detourIsVertical ? obstacle.x : obstacle.y;
        const maximumBoundary         = minimumBoundary + ( detourIsVertical ? obstacle.width : obstacle.height );
        const minimumBoundaryDistance = Math.abs ( detourPosition - minimumBoundary );
        const maximumBoundaryDistance = Math.abs ( detourPosition - maximumBoundary );
        const boundaryDistance        = Math.min ( minimumBoundaryDistance, maximumBoundaryDistance );

        // Handle the case where current value is below nearest boundary distance.

        if ( boundaryDistance + COORDINATE_EPSILON < nearestBoundaryDistance )
        {
            nearestBoundaryDistance = boundaryDistance;
            selectedDirection       = minimumBoundaryDistance <= maximumBoundaryDistance ? -1 : 1;
        }


        // Return the computed result.

        return true;
    };


    // Handle the case where obstacle index matches undefined.

    if ( obstacleIndex === undefined )
    {
        obstacles.forEach ( considerObstacle );
    }
    else
    {
        // Handle the remaining case after the preceding condition is false.

        obstacleIndex.visit ( chartRoutingSpatialBoundsFromPoints (
            [ curve.source, curve.sourceControl, curve.targetControl, curve.target ],
            CLEARANCE_PROOF_MARGIN,
        ), considerObstacle );
    }


    // Return the selected direction.

    return selectedDirection;
}

//--------------------------------------------------------------------------------------------------
// Function: fitCubicDetourClearance
//
// Description:
//
//   Derives the fit cubic detour clearance.
//
// Parameters:
//
//   - points:
//     The points supplied to the operation.
//
//   - obstacles:
//     The obstacles supplied to the operation.
//
//   - clearanceStep:
//     The clearance step supplied to the operation.
//
//   - performanceCounters:
//     The performance counters supplied to the operation.
//
//   - obstacleIndex:
//     The obstacle index supplied to the operation.
//
//   - proofMemoization:
//     The proof memoization supplied to the operation.
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

export function fitCubicDetourClearance (
    points: readonly ChartRoutingPoint[],
    obstacles: readonly ChartRoutingRectangle[],
    clearanceStep: number,
    performanceCounters?: ChartRoutingPerformanceCounters,
    obstacleIndex?: ChartRoutingSpatialQuery<ChartRoutingRectangle>,
    proofMemoization?: ChartRoutingCurveProofMemoization,
): ChartRoutingPoint[] | null
{
    // Initialize the local values needed by this operation.

    const requestedPoints       = [ ...points ];
    const resolvedObstacleIndex = obstacleIndex ?? new PackedChartRoutingSpatialIndex (
        obstacles.map ( obstacle => ( {
            bounds: chartRoutingSpatialBoundsFromRectangle ( obstacle ),
            value: obstacle,
        } ) ),
    );


    // Handle the case where at least one branch condition is satisfied.

    if ( obstacles.length === 0 || routingBackboneIsClearOfObstacles (
        requestedPoints,
        obstacles,
        performanceCounters,
        resolvedObstacleIndex,
        proofMemoization,
    ) )
    {
        // Return the requested points.

        return requestedPoints;
    }

    // Handle the case where the points form cubic detour result condition is not satisfied.

    if ( !pointsFormCubicDetour ( requestedPoints ) )
    {
        // Return the computed result.

        return null;
    }

    // Handle the case where at least one branch condition is satisfied.

    if ( !Number.isFinite ( clearanceStep ) || clearanceStep <= 0 )
    {
        // Return the computed result.

        return null;
    }

    const shiftDirection = detourShiftDirection (
        requestedPoints,
        obstacles,
        performanceCounters,
        resolvedObstacleIndex,
        proofMemoization,
    );


    // Handle the case where shift direction matches an absent value.

    if ( shiftDirection === null )
    {
        // Return the computed result.

        return null;
    }

    // Initialize the local values needed by this operation.

    let unsafeShift              = 0;
    let safeShift: number | null = null;

    // Repeat the operation across the bounded iteration range.

    for ( let expansionIndex = 0; expansionIndex < MAXIMUM_CLEARANCE_EXPANSION_COUNT; expansionIndex += 1 )
    {
        // Initialize the local values needed by this operation.

        const shift     = clearanceStep * 2 ** expansionIndex;
        const candidate = shiftedDetourPoints ( requestedPoints, shift, shiftDirection );

        // Handle the case where all required conditions are satisfied.

        if ( candidate !== null && routingBackboneIsClearOfObstacles (
            candidate,
            obstacles,
            performanceCounters,
            resolvedObstacleIndex,
            proofMemoization,
        ) )
        {
            safeShift = shift;
            break;
        }

        unsafeShift = shift;
    }

    // Handle the case where safe shift matches an absent value.

    if ( safeShift === null )
    {
        // Return the computed result.

        return null;
    }

    let provenSafeShift: number = safeShift;

    // Repeat the operation across the bounded iteration range.

    for ( let refinementIndex = 0; refinementIndex < CLEARANCE_REFINEMENT_COUNT; refinementIndex += 1 )
    {
        // Initialize the local values needed by this operation.

        const middleShift: number = ( unsafeShift + provenSafeShift ) / 2;
        const candidate           = shiftedDetourPoints ( requestedPoints, middleShift, shiftDirection );

        // Handle the case where all required conditions are satisfied.

        if ( candidate !== null && routingBackboneIsClearOfObstacles (
            candidate,
            obstacles,
            performanceCounters,
            resolvedObstacleIndex,
            proofMemoization,
        ) )
        {
            provenSafeShift = middleShift;
        }
        else
        {
            // Handle the remaining case after the preceding condition is false.

            unsafeShift = middleShift;
        }
    }

    // Return the shifted detour points result.

    return shiftedDetourPoints ( requestedPoints, provenSafeShift, shiftDirection );
}
