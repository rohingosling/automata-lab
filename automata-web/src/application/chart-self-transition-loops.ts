// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Chart Self-Transition Loops
// Version: 2.1.0
// Date:    2026-08-19
// Author:  Rohin Gosling
//
// Description:
//
//   Derives deterministic elliptical self-transition geometry from state bounds, neighbouring
//   obstacles, and labels. Every loop on one state shares one selected edge and one aspect ratio,
//   and grows its major semi-axis by loop index so successive loops nest without intersecting. All
//   values are presentation-only and are never persisted.
//
//   The construction follows assets/images/design/elliptical-transition-path.png exactly: the inner
//   major-axis vertex v0 coincides with the state center o, the outer vertex v1 lies outside the
//   body, and the entire minor axis lies outside the body. Only the arc beyond the state edge,
//   between the intersections p0 and p1, is rendered.
//
//   A loop is never an obstacle and never grows outward to escape one, because either choice can
//   hide safe routes.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { ChartRoutingCubicCurve } from "./chart-routing-backbone.js";
import type { ChartRoutingPoint, ChartRoutingRectangle } from "./ports/contracts.js";
import { COMPILE_TIME_CONFIGURATION } from "../configuration/compile-time-configuration.js";

//--------------------------------------------------------------------------------------------------
// Type: ChartSelfTransitionLoopSide
//
// Description:
//
//   Defines the supported chart self transition loop side alternatives.
//
//--------------------------------------------------------------------------------------------------

export type ChartSelfTransitionLoopSide = "top" | "right" | "bottom" | "left";

//--------------------------------------------------------------------------------------------------
// Interface: ChartSelfTransitionLoopPreferences
//
// Description:
//
//   Defines the structure of chart self transition loop preferences.
//
//--------------------------------------------------------------------------------------------------

export interface ChartSelfTransitionLoopPreferences
{
    readonly selfTransitionLoopAspect:    number;
    readonly selfTransitionLoopExtension: number;
    readonly selfTransitionLoopSpacing:   number;
}

//--------------------------------------------------------------------------------------------------
// Interface: ChartSelfTransitionLoopStateGeometry
//
// Description:
//
//   Defines the structure of chart self transition loop state geometry.
//
//--------------------------------------------------------------------------------------------------

export interface ChartSelfTransitionLoopStateGeometry
{
    readonly center: ChartRoutingPoint;
    readonly cornerRadius: number;
    readonly height: number;
    readonly width:  number;
}

//--------------------------------------------------------------------------------------------------
// Interface: ChartSelfTransitionLoopGeometry
//
// Description:
//
//   Defines the structure of chart self transition loop geometry.
//
//--------------------------------------------------------------------------------------------------

export interface ChartSelfTransitionLoopGeometry
{
    readonly curves:        readonly ChartRoutingCubicCurve[];
    readonly entry:         ChartRoutingPoint;
    readonly exit:          ChartRoutingPoint;
    readonly majorSemiAxis: number;
    readonly minorSemiAxis: number;
    readonly outerVertex:   ChartRoutingPoint;
    readonly side:          ChartSelfTransitionLoopSide;
}

//--------------------------------------------------------------------------------------------------
// Interface: EdgeFrame
//
// Description:
//
//   Defines the structure of edge frame.
//
//--------------------------------------------------------------------------------------------------

interface EdgeFrame
{
    readonly halfExtent:        number;
    readonly halfTangentExtent: number;
    readonly normal:            ChartRoutingPoint;
    readonly span:              number;
    readonly tangent:           ChartRoutingPoint;
}

const SELF_TRANSITION_LOOP_CONFIGURATION = COMPILE_TIME_CONFIGURATION.chart.routing.selfTransitionLoop;
const MOUTH_LIMIT                        = SELF_TRANSITION_LOOP_CONFIGURATION.mouthLimit;
const SPANS_PER_LOOP                     = SELF_TRANSITION_LOOP_CONFIGURATION.spansPerLoop;
const SIDE_PRECEDENCE                    = [ "right", "bottom", "left", "top" ] as const satisfies readonly ChartSelfTransitionLoopSide[];

// The outward normal and along-edge tangent of one state edge, with the half extent the ellipse
// must clear, the half extent along the edge, and the usable span the loop mouth must fit inside.

//--------------------------------------------------------------------------------------------------
// Function: edgeFrame
//
// Description:
//
//   Derives the edge frame.
//
// Parameters:
//
//   - side:
//     The side supplied to the operation.
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

function edgeFrame ( side: ChartSelfTransitionLoopSide, state: ChartSelfTransitionLoopStateGeometry ): EdgeFrame
{
    // Initialize the local values needed by this operation.

    const halfWidth    = state.width / 2;
    const halfHeight   = state.height / 2;
    const usableWidth  = Math.max ( 1, state.width - state.cornerRadius * 2 );
    const usableHeight = Math.max ( 1, state.height - state.cornerRadius * 2 );

    // Handle the case where side matches the right value.

    if ( side === "right" )
    {
        // Return the assembled result.

        return {
            halfExtent:        halfWidth,
            halfTangentExtent: halfHeight,
            normal:            { x: 1, y: 0 },
            span:              usableHeight,
            tangent:           { x: 0, y: 1 },
        };
    }

    // Handle the case where side matches the bottom value.

    if ( side === "bottom" )
    {
        // Return the assembled result.

        return {
            halfExtent:        halfHeight,
            halfTangentExtent: halfWidth,
            normal:            { x: 0, y: 1 },
            span:              usableWidth,
            tangent:           { x: -1, y: 0 },
        };
    }

    // Handle the case where side matches the left value.

    if ( side === "left" )
    {
        // Return the assembled result.

        return {
            halfExtent:        halfWidth,
            halfTangentExtent: halfHeight,
            normal:            { x: -1, y: 0 },
            span:              usableHeight,
            tangent:           { x: 0, y: -1 },
        };
    }

    // Return the assembled result.

    return {
        halfExtent:        halfHeight,
        halfTangentExtent: halfWidth,
        normal:            { x: 0, y: -1 },
        span:              usableWidth,
        tangent:           { x: 1, y: 0 },
    };
}

// Half the separation between the two edge intersections p0 and p1. The ellipse meets the edge
// where a(1 + cos t) = halfExtent, so cos t0 = halfExtent / a - 1, which lies in (-1, 0) exactly
// while a > halfExtent -- the same condition that places the whole minor axis outside the body.

//--------------------------------------------------------------------------------------------------
// Function: mouthHalfWidth
//
// Description:
//
//   Derives the mouth half width.
//
// Parameters:
//
//   - majorSemiAxis:
//     The major semi axis supplied to the operation.
//
//   - minorSemiAxis:
//     The minor semi axis supplied to the operation.
//
//   - halfExtent:
//     The half extent supplied to the operation.
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

function mouthHalfWidth ( majorSemiAxis: number, minorSemiAxis: number, halfExtent: number ): number
{
    // Calculate the cosine value from the current inputs.

    const cosine = halfExtent / majorSemiAxis - 1;

    // Return the computed result.

    return minorSemiAxis * Math.sqrt ( Math.max ( 0, 1 - cosine * cosine ) );
}

// How far the loop reaches beyond its edge. With v0 at the state center the outer vertex sits at
// 2a, so the reach past the edge is 2a - halfExtent.

//--------------------------------------------------------------------------------------------------
// Function: selfTransitionLoopProtrusion
//
// Description:
//
//   Derives the self transition loop protrusion.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
//
//   - side:
//     The side supplied to the operation.
//
//   - majorSemiAxis:
//     The major semi axis supplied to the operation.
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

export function selfTransitionLoopProtrusion (
    state:         ChartSelfTransitionLoopStateGeometry,
    side:          ChartSelfTransitionLoopSide,
    majorSemiAxis: number,
): number
{
    // Return the computed result.

    return majorSemiAxis * 2 - edgeFrame ( side, state ).halfExtent;
}

// The aspect ratio is uniform across one state. Two ellipses sharing the inner vertex nest only
// while both semi-axes grow together, so the mouth is bounded by reducing the ratio for the whole
// state rather than per loop index.

//--------------------------------------------------------------------------------------------------
// Function: selfTransitionLoopAspectRatio
//
// Description:
//
//   Derives the self transition loop aspect ratio.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
//
//   - side:
//     The side supplied to the operation.
//
//   - preferences:
//     The preferences supplied to the operation.
//
//   - outerMajorSemiAxis:
//     The outer major semi axis supplied to the operation.
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

export function selfTransitionLoopAspectRatio (
    state:              ChartSelfTransitionLoopStateGeometry,
    side:               ChartSelfTransitionLoopSide,
    preferences:        ChartSelfTransitionLoopPreferences,
    outerMajorSemiAxis: number,
): number
{
    // Initialize the local values needed by this operation.

    const frame             = edgeFrame ( side, state );
    const preferredRatio    = Math.max ( 0.01, preferences.selfTransitionLoopAspect / 100 );
    const outerMouthAtUnity = mouthHalfWidth ( outerMajorSemiAxis, outerMajorSemiAxis, frame.halfExtent ) * 2;
    const permittedMouth    = frame.span * MOUTH_LIMIT;

    // Return the result selected by the current condition.

    return outerMouthAtUnity <= 0
        ? preferredRatio
        : Math.min ( preferredRatio, permittedMouth / outerMouthAtUnity );
}

// The major semi-axis of every loop on one state, in transition-table order.
//
// Each loop is at least large enough to place the whole minor axis outside the body plus the
// configured extension, and at least large enough to carry its own label outside the body. A
// running maximum is required rather than a plain first-axis-plus-index-times-spacing series: label
// allowances differ per loop, so a loop carrying a long event name would otherwise exceed the next
// loop and the two would visibly cross.

//--------------------------------------------------------------------------------------------------
// Function: selfTransitionLoopMajorSemiAxes
//
// Description:
//
//   Derives the self transition loop major semi axes.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
//
//   - side:
//     The side supplied to the operation.
//
//   - preferences:
//     The preferences supplied to the operation.
//
//   - labelAllowances:
//     The label allowances supplied to the operation.
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

export function selfTransitionLoopMajorSemiAxes (
    state:           ChartSelfTransitionLoopStateGeometry,
    side:            ChartSelfTransitionLoopSide,
    preferences:     ChartSelfTransitionLoopPreferences,
    labelAllowances: readonly number[],
): readonly number[]
{
    // Initialize the local values needed by this operation.

    const halfExtent     = edgeFrame ( side, state ).halfExtent;
    const axes: number[] = [];

    labelAllowances.forEach ( ( labelAllowance, loopIndex ) =>
    {
        // Initialize the local values needed by this operation.

        const requested = Math.max (
            halfExtent + preferences.selfTransitionLoopExtension,
            ( halfExtent + labelAllowance ) / 2,
        );
        const previous = axes [ loopIndex - 1 ];

        axes.push ( previous === undefined
            ? requested
            : Math.max ( previous + preferences.selfTransitionLoopSpacing, requested ) );
    } );

    // Return the axes.

    return axes;
}

// The angle is measured from the outer major-axis vertex, so angle 0 is v1 and angle +/- pi is v0
// at the state center.

//--------------------------------------------------------------------------------------------------
// Function: ellipsePoint
//
// Description:
//
//   Derives the ellipse point.
//
// Parameters:
//
//   - stateCenter:
//     The state center supplied to the operation.
//
//   - frame:
//     The frame supplied to the operation.
//
//   - majorSemiAxis:
//     The major semi axis supplied to the operation.
//
//   - minorSemiAxis:
//     The minor semi axis supplied to the operation.
//
//   - angle:
//     The angle supplied to the operation.
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

function ellipsePoint (
    stateCenter:   ChartRoutingPoint,
    frame:         EdgeFrame,
    majorSemiAxis: number,
    minorSemiAxis: number,
    angle:         number,
): ChartRoutingPoint
{
    // Initialize the local values needed by this operation.

    const alongNormal  = majorSemiAxis * ( 1 + Math.cos ( angle ) );
    const alongTangent = minorSemiAxis * Math.sin ( angle );

    // Return the assembled result.

    return {
        x: stateCenter.x + frame.normal.x * alongNormal + frame.tangent.x * alongTangent,
        y: stateCenter.y + frame.normal.y * alongNormal + frame.tangent.y * alongTangent,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: ellipseDerivative
//
// Description:
//
//   Derives the ellipse derivative.
//
// Parameters:
//
//   - frame:
//     The frame supplied to the operation.
//
//   - majorSemiAxis:
//     The major semi axis supplied to the operation.
//
//   - minorSemiAxis:
//     The minor semi axis supplied to the operation.
//
//   - angle:
//     The angle supplied to the operation.
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

function ellipseDerivative (
    frame:         EdgeFrame,
    majorSemiAxis: number,
    minorSemiAxis: number,
    angle:         number,
): ChartRoutingPoint
{
    // Initialize the local values needed by this operation.

    const alongNormal  = -majorSemiAxis * Math.sin ( angle );
    const alongTangent = minorSemiAxis * Math.cos ( angle );

    // Return the assembled result.

    return {
        x: frame.normal.x * alongNormal + frame.tangent.x * alongTangent,
        y: frame.normal.y * alongNormal + frame.tangent.y * alongTangent,
    };
}

// Converts the visible arc into cubic Bezier spans so clipping, sampling, labels, and markers reuse
// the shared machinery. Each span covers at most a quarter turn and uses the exact parametric
// tangent at its ends.

//--------------------------------------------------------------------------------------------------
// Function: ellipseArcCurves
//
// Description:
//
//   Derives the ellipse arc curves.
//
// Parameters:
//
//   - stateCenter:
//     The state center supplied to the operation.
//
//   - frame:
//     The frame supplied to the operation.
//
//   - majorSemiAxis:
//     The major semi axis supplied to the operation.
//
//   - minorSemiAxis:
//     The minor semi axis supplied to the operation.
//
//   - startAngle:
//     The start angle supplied to the operation.
//
//   - endAngle:
//     The end angle supplied to the operation.
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

function ellipseArcCurves (
    stateCenter:   ChartRoutingPoint,
    frame:         EdgeFrame,
    majorSemiAxis: number,
    minorSemiAxis: number,
    startAngle:    number,
    endAngle:      number,
): ChartRoutingCubicCurve[]
{
    // Initialize the local values needed by this operation.

    const spanCount                        = Math.max ( 2, SPANS_PER_LOOP );
    const step                             = ( endAngle - startAngle ) / spanCount;
    const alpha                            = ( 4 / 3 ) * Math.tan ( step / 4 );
    const curves: ChartRoutingCubicCurve[] = [];

    // Repeat the operation across the bounded iteration range.

    for ( let spanIndex = 0; spanIndex < spanCount; spanIndex += 1 )
    {
        // Initialize the local values needed by this operation.

        const spanStart   = startAngle + step * spanIndex;
        const spanEnd     = spanStart + step;
        const source      = ellipsePoint ( stateCenter, frame, majorSemiAxis, minorSemiAxis, spanStart );
        const target      = ellipsePoint ( stateCenter, frame, majorSemiAxis, minorSemiAxis, spanEnd );
        const sourceSlope = ellipseDerivative ( frame, majorSemiAxis, minorSemiAxis, spanStart );
        const targetSlope = ellipseDerivative ( frame, majorSemiAxis, minorSemiAxis, spanEnd );

        curves.push ( {
            source,
            sourceControl: { x: source.x + alpha * sourceSlope.x, y: source.y + alpha * sourceSlope.y },
            target,
            targetControl: { x: target.x - alpha * targetSlope.x, y: target.y - alpha * targetSlope.y },
        } );
    }

    // Return the curves.

    return curves;
}

// Resolves one loop from its already-determined major semi-axis.
//
// There is deliberately no outward expansion to escape an overlapping obstacle. Growing the major
// semi-axis lengthens the ellipse along the very normal it would have to escape, so every step
// strictly encloses the previous one and the expansion could only lengthen the overlap it was
// introduced to resolve.

//--------------------------------------------------------------------------------------------------
// Function: selfTransitionLoopGeometry
//
// Description:
//
//   Derives the self transition loop geometry.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
//
//   - side:
//     The side supplied to the operation.
//
//   - aspectRatio:
//     The aspect ratio supplied to the operation.
//
//   - majorSemiAxis:
//     The major semi axis supplied to the operation.
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

export function selfTransitionLoopGeometry (
    state:         ChartSelfTransitionLoopStateGeometry,
    side:          ChartSelfTransitionLoopSide,
    aspectRatio:   number,
    majorSemiAxis: number,
): ChartSelfTransitionLoopGeometry
{
    // Initialize the local values needed by this operation.

    const frame         = edgeFrame ( side, state );
    const minorSemiAxis = Math.max ( 1, aspectRatio * majorSemiAxis );
    const boundaryAngle = Math.acos (
        Math.min ( 1, Math.max ( -1, frame.halfExtent / majorSemiAxis - 1 ) ),
    );
    const curves = ellipseArcCurves (
        state.center,
        frame,
        majorSemiAxis,
        minorSemiAxis,
        -boundaryAngle,
        boundaryAngle,
    );

    // Return the assembled result.

    return {
        curves,
        entry:       ellipsePoint ( state.center, frame, majorSemiAxis, minorSemiAxis, boundaryAngle ),
        exit:        ellipsePoint ( state.center, frame, majorSemiAxis, minorSemiAxis, -boundaryAngle ),
        majorSemiAxis,
        minorSemiAxis,
        outerVertex: ellipsePoint ( state.center, frame, majorSemiAxis, minorSemiAxis, 0 ),
        side,
    };
}

// The clear distance from one state edge outward to the nearest obstacle that stands in front of
// it. An obstacle only counts when it overlaps the state's band along that edge, because an
// obstacle beside the state does not occupy the corridor the loop would reach into.

//--------------------------------------------------------------------------------------------------
// Function: selfTransitionLoopOutwardRoom
//
// Description:
//
//   Derives the self transition loop outward room.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
//
//   - side:
//     The side supplied to the operation.
//
//   - obstacles:
//     The obstacles supplied to the operation.
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

export function selfTransitionLoopOutwardRoom (
    state:     ChartSelfTransitionLoopStateGeometry,
    side:      ChartSelfTransitionLoopSide,
    obstacles: readonly ChartRoutingRectangle[],
): number
{
    // Initialize the local values needed by this operation.

    const frame = edgeFrame ( side, state );

    //----------------------------------------------------------------------------------------------
    // Function: project
    //
    // Description:
    //
    //   Projects the requested value.
    //
    // Parameters:
    //
    //   - value:
    //     The value supplied to the operation.
    //
    //   - axis:
    //     The axis supplied to the operation.
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

    function project ( value: ChartRoutingPoint, axis: ChartRoutingPoint ): number
    {
        // Return the computed result.

        return ( value.x - state.center.x ) * axis.x + ( value.y - state.center.y ) * axis.y;
    }

    // Return the reduce result.

    return obstacles.reduce ( ( room, obstacle ) =>
    {
        // Initialize the local values needed by this operation.

        const corners =
        [
            { x: obstacle.x, y: obstacle.y },
            { x: obstacle.x + obstacle.width, y: obstacle.y },
            { x: obstacle.x, y: obstacle.y + obstacle.height },
            { x: obstacle.x + obstacle.width, y: obstacle.y + obstacle.height },
        ];
        const normalOffsets  = corners.map ( corner => project ( corner, frame.normal ) );
        const tangentOffsets = corners.map ( corner => project ( corner, frame.tangent ) );
        const overlapsBand   = Math.min ( ...tangentOffsets ) < frame.halfTangentExtent &&
            Math.max ( ...tangentOffsets ) > -frame.halfTangentExtent;
        const outwardGap     = Math.min ( ...normalOffsets ) - frame.halfExtent;

        // Return the result selected by the current condition.

        return overlapsBand && outwardGap >= 0 ? Math.min ( room, outwardGap ) : room;
    }, Number.POSITIVE_INFINITY );
}

// Selects the one edge every loop on this state uses.
//
// The ranking is: fewest attached ordinary relations; then the greatest outward room remaining once
// that side's own outermost loop reach is subtracted; then a fixed order. Only local geometry
// participates. A chart-global term such as a center of mass would let an unrelated edit rotate
// this state's loops, and in a top-to-bottom layout its dot product is identically zero for the
// left and right sides, so the fixed order decided in the common case anyway.
//
// The reach is evaluated per candidate side because the loop's length depends on that side's half
// extent.

//--------------------------------------------------------------------------------------------------
// Function: selectSelfTransitionLoopSide
//
// Description:
//
//   Selects self transition loop side.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
//
//   - attachedSideCounts:
//     The attached side counts supplied to the operation.
//
//   - obstacles:
//     The obstacles supplied to the operation.
//
//   - preferences:
//     The preferences supplied to the operation.
//
//   - labelAllowances:
//     The label allowances supplied to the operation.
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

export function selectSelfTransitionLoopSide (
    state:              ChartSelfTransitionLoopStateGeometry,
    attachedSideCounts: Readonly<Record<ChartSelfTransitionLoopSide, number>>,
    obstacles:          readonly ChartRoutingRectangle[],
    preferences:        ChartSelfTransitionLoopPreferences,
    labelAllowances:    readonly number[],
): ChartSelfTransitionLoopSide
{
    //----------------------------------------------------------------------------------------------
    // Function: remainingRoom
    //
    // Description:
    //
    //   Derives the remaining room.
    //
    // Parameters:
    //
    //   - side:
    //     The side supplied to the operation.
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

    function remainingRoom ( side: ChartSelfTransitionLoopSide ): number
    {
        // Initialize the local values needed by this operation.

        const room = selfTransitionLoopOutwardRoom ( state, side, obstacles );

        // Handle the case where room matches number positive infinity.

        if ( room === Number.POSITIVE_INFINITY )
        {
            // Return the computed result.

            return Number.POSITIVE_INFINITY;
        }

        // Initialize the local values needed by this operation.

        const axes  = selfTransitionLoopMajorSemiAxes ( state, side, preferences, labelAllowances );
        const outer = axes.at ( -1 );

        // Return the result selected by the current condition.

        return outer === undefined ? room : room - selfTransitionLoopProtrusion ( state, side, outer );
    }

    // Return the reduce result.

    return SIDE_PRECEDENCE.reduce<ChartSelfTransitionLoopSide> ( ( bestSide, candidateSide ) =>
    {
        // Initialize the local values needed by this operation.

        const bestCount      = attachedSideCounts [ bestSide ];
        const candidateCount = attachedSideCounts [ candidateSide ];

        // Handle the case where candidate count differs from best count.

        if ( candidateCount !== bestCount )
        {
            // Return the result selected by the current condition.

            return candidateCount < bestCount ? candidateSide : bestSide;
        }

        // Return the result selected by the current condition.

        return remainingRoom ( candidateSide ) > remainingRoom ( bestSide ) ? candidateSide : bestSide;
    }, SIDE_PRECEDENCE [ 0 ] );
}
