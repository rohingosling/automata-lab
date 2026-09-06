// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Self-Transition Loop Tests
// Version: 2.1.0
// Date:    2026-08-19
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies the elliptical construction in which the inner major-axis vertex v0 coincides with the
//   state center o and the entire minor axis lies outside the state body.
//
//   Also covers monotone nesting under mixed label allowances, mouth bounding, room-aware
//   single-edge selection, and the allowlisted Self-Transition Loop preferences.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from "vitest";

import
{
    selectSelfTransitionLoopSide,
    selfTransitionLoopAspectRatio,
    selfTransitionLoopGeometry,
    selfTransitionLoopMajorSemiAxes,
    selfTransitionLoopOutwardRoom,
    selfTransitionLoopProtrusion,
} from "../../src/application/chart-self-transition-loops.js";
import type
{
    ChartSelfTransitionLoopPreferences,
    ChartSelfTransitionLoopSide,
    ChartSelfTransitionLoopStateGeometry,
} from "../../src/application/chart-self-transition-loops.js";
import
{
    COMPILE_TIME_CONFIGURATION,
    DEFAULT_APPLICATION_PREFERENCES,
} from "../../src/configuration/compile-time-configuration.js";
import { parseApplicationPreferences } from "../../src/infrastructure/preferences/application-preferences.js";

const STATE: ChartSelfTransitionLoopStateGeometry =
{
    center:       { x: 400, y: 300 },
    cornerRadius: 10,
    height:       62,
    width:        268,
};

const PREFERENCES: ChartSelfTransitionLoopPreferences =
{
    selfTransitionLoopAspect:    DEFAULT_APPLICATION_PREFERENCES.selfTransitionLoopAspect,
    selfTransitionLoopExtension: DEFAULT_APPLICATION_PREFERENCES.selfTransitionLoopExtension,
    selfTransitionLoopSpacing:   DEFAULT_APPLICATION_PREFERENCES.selfTransitionLoopSpacing,
};

const NO_ATTACHED_RELATIONS                             = { bottom: 0, left: 0, right: 0, top: 0 };
const ONE_LOOP: readonly number[]                       = [ 0 ];
const ALL_SIDES: readonly ChartSelfTransitionLoopSide[] = [ "top", "right", "bottom", "left" ];

//--------------------------------------------------------------------------------------------------
// Function: edgeVectors
//
// Description:
//
//   Derives the edge vectors.
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
//--------------------------------------------------------------------------------------------------

function edgeVectors ( side: ChartSelfTransitionLoopSide ):
{
    readonly halfExtent: number;
    readonly normal:     { readonly x: number; readonly y: number };
    readonly tangent:    { readonly x: number; readonly y: number };
}
{
    // Handle the case where side matches "right".

    if ( side === "right" )
    {
        // Return the assembled result.

        return { halfExtent: STATE.width / 2, normal: { x: 1, y: 0 }, tangent: { x: 0, y: 1 } };
    }

    // Handle the case where side matches "bottom".

    if ( side === "bottom" )
    {
        // Return the assembled result.

        return { halfExtent: STATE.height / 2, normal: { x: 0, y: 1 }, tangent: { x: -1, y: 0 } };
    }

    // Handle the case where side matches "left".

    if ( side === "left" )
    {
        // Return the assembled result.

        return { halfExtent: STATE.width / 2, normal: { x: -1, y: 0 }, tangent: { x: 0, y: -1 } };
    }

    // Return the assembled result.

    return { halfExtent: STATE.height / 2, normal: { x: 0, y: -1 }, tangent: { x: 1, y: 0 } };
}

// Chart coordinates expressed in the ellipse frame: distance outward along the edge normal, and
// offset along the edge.

//--------------------------------------------------------------------------------------------------
// Function: localCoordinates
//
// Description:
//
//   Derives the local coordinates.
//
// Parameters:
//
//   - point:
//     The point supplied to the operation.
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
//--------------------------------------------------------------------------------------------------

function localCoordinates (
    point: { readonly x: number; readonly y: number },
    side:  ChartSelfTransitionLoopSide,
): { readonly alongNormal: number; readonly alongTangent: number }
{
    // Initialize the local values needed by this operation.

    const vectors = edgeVectors ( side );
    const offsetX = point.x - STATE.center.x;
    const offsetY = point.y - STATE.center.y;

    // Return the assembled result.

    return {
        alongNormal:  offsetX * vectors.normal.x + offsetY * vectors.normal.y,
        alongTangent: offsetX * vectors.tangent.x + offsetY * vectors.tangent.y,
    };
}

// The ellipse center sits one major semi-axis outward from the state center, because v0 coincides
// with o.

//--------------------------------------------------------------------------------------------------
// Function: ellipseValue
//
// Description:
//
//   Derives the ellipse value.
//
// Parameters:
//
//   - point:
//     The point supplied to the operation.
//
//   - side:
//     The side supplied to the operation.
//
//   - majorSemiAxis:
//     The major semi axis supplied to the operation.
//
//   - minorSemiAxis:
//     The minor semi axis supplied to the operation.
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

function ellipseValue (
    point:         { readonly x: number; readonly y: number },
    side:          ChartSelfTransitionLoopSide,
    majorSemiAxis: number,
    minorSemiAxis: number,
): number
{
    // Initialize the local values needed by this operation.

    const local      = localCoordinates ( point, side );
    const normalized = ( local.alongNormal - majorSemiAxis ) / majorSemiAxis;

    // Return the computed result.

    return normalized * normalized + ( local.alongTangent / minorSemiAxis ) ** 2;
}

//--------------------------------------------------------------------------------------------------
// Function: curveSamplePoints
//
// Description:
//
//   Derives the curve sample points.
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

function curveSamplePoints ( curves: readonly {
    readonly source:        { readonly x: number; readonly y: number };
    readonly sourceControl: { readonly x: number; readonly y: number };
    readonly target:        { readonly x: number; readonly y: number };
    readonly targetControl: { readonly x: number; readonly y: number };
}[] ): { readonly x: number; readonly y: number }[]
{
    // Return the flat map result.

    return curves.flatMap ( curve => Array.from ( { length: 17 }, ( _value, sampleIndex ) =>
    {
        // Initialize the local values needed by this operation.

        const position   = sampleIndex / 16;
        const complement = 1 - position;

        // Return the assembled result.

        return {
            x: complement ** 3 * curve.source.x + 3 * complement ** 2 * position * curve.sourceControl.x +
                3 * complement * position ** 2 * curve.targetControl.x + position ** 3 * curve.target.x,
            y: complement ** 3 * curve.source.y + 3 * complement ** 2 * position * curve.sourceControl.y +
                3 * complement * position ** 2 * curve.targetControl.y + position ** 3 * curve.target.y,
        };
    } ) );
}

//--------------------------------------------------------------------------------------------------
// Function: resolveLoop
//
// Description:
//
//   Resolves loop.
//
// Parameters:
//
//   - side:
//     The side supplied to the operation.
//
//   - labelAllowances:
//     The label allowances supplied to the operation.
//
//   - loopIndex:
//     The loop index supplied to the operation.
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

function resolveLoop (
    side:            ChartSelfTransitionLoopSide,
    labelAllowances: readonly number[] = ONE_LOOP,
    loopIndex = 0,
)
{
    // Initialize the local values needed by this operation.

    const axes  = selfTransitionLoopMajorSemiAxes ( STATE, side, PREFERENCES, labelAllowances );
    const outer = axes.at ( -1 ) ?? 0;
    const ratio = selfTransitionLoopAspectRatio ( STATE, side, PREFERENCES, outer );

    // Return the self transition loop geometry result.

    return selfTransitionLoopGeometry ( STATE, side, ratio, axes [ loopIndex ] ?? outer );
}

describe ( "AL-UI-036 construction from the design diagram", () =>
{
    it ( "places the inner major-axis vertex exactly at the state center", () =>
    {
        ALL_SIDES.forEach ( side =>
        {
            // Initialize the local values needed by this operation.

            const loop = resolveLoop ( side );

            // v0 = P(pi) lies one major axis inward from the outer vertex, which places it on the
            // state center.

            const innerVertexAlongNormal = localCoordinates ( loop.outerVertex, side ).alongNormal -
                loop.majorSemiAxis * 2;

            expect ( innerVertexAlongNormal ).toBeCloseTo ( 0, 6 );
        } );
    } );

    it ( "places the entire minor axis outside the state body", () =>
    {
        ALL_SIDES.forEach ( side =>
        {
            // Initialize the local values needed by this operation.

            const loop = resolveLoop ( side );

            // The minor-axis endpoints sit at normal distance a from the center, so a > d is the
            // constraint.

            expect ( loop.majorSemiAxis ).toBeGreaterThan ( edgeVectors ( side ).halfExtent );
        } );
    } );

    it ( "leaves and re-enters the same edge at two distinct points", () =>
    {
        ALL_SIDES.forEach ( side =>
        {
            // Initialize the local values needed by this operation.

            const loop  = resolveLoop ( side );
            const exit  = localCoordinates ( loop.exit, side );
            const entry = localCoordinates ( loop.entry, side );

            expect ( exit.alongNormal ).toBeCloseTo ( edgeVectors ( side ).halfExtent, 6 );
            expect ( entry.alongNormal ).toBeCloseTo ( edgeVectors ( side ).halfExtent, 6 );
            expect ( Math.abs ( entry.alongTangent - exit.alongTangent ) ).toBeGreaterThan ( 0 );
        } );
    } );

    it ( "renders only the arc outside the state body", () =>
    {
        ALL_SIDES.forEach ( side =>
        {
            // Initialize the local values needed by this operation.

            const loop = resolveLoop ( side );

            curveSamplePoints ( loop.curves ).forEach ( sample =>
            {
                expect ( localCoordinates ( sample, side ).alongNormal )
                    .toBeGreaterThanOrEqual ( edgeVectors ( side ).halfExtent - 0.5 );
            } );
        } );
    } );

    it ( "orients the final tangent by the ellipse gradient at the re-entry point", () =>
    {
        // Initialize the local values needed by this operation.

        const loop      = resolveLoop ( "right" );
        const lastCurve = loop.curves.at ( -1 );

        expect ( lastCurve ).toBeDefined ();

        // Handle the case where last curve differs from undefined.

        if ( lastCurve !== undefined )
        {
            // Calculate the approach value from the current inputs.

            const approach = {
                x: lastCurve.target.x - lastCurve.targetControl.x,
                y: lastCurve.target.y - lastCurve.targetControl.y,
            };

            // Re-entry heads back toward the body, so the approach has a negative outward
            // component.

            expect ( approach.x ).toBeLessThan ( 0 );
            expect ( localCoordinates ( loop.entry, "right" ).alongTangent ).toBeGreaterThan ( 0 );
        }
    } );
} );

describe ( "AL-UI-036 nesting and mouth bounding", () =>
{
    it ( "nests successive loops on one state without intersecting", () =>
    {
        // Initialize the local values needed by this operation.

        const axes  = selfTransitionLoopMajorSemiAxes ( STATE, "right", PREFERENCES, [ 0, 0, 0 ] );
        const ratio = selfTransitionLoopAspectRatio ( STATE, "right", PREFERENCES, axes.at ( -1 ) ?? 0 );
        const inner = selfTransitionLoopGeometry ( STATE, "right", ratio, axes [ 0 ] ?? 0 );
        const outer = selfTransitionLoopGeometry ( STATE, "right", ratio, axes [ 1 ] ?? 0 );

        curveSamplePoints ( inner.curves ).forEach ( sample =>
        {
            expect ( ellipseValue ( sample, "right", outer.majorSemiAxis, outer.minorSemiAxis ) )
                .toBeLessThan ( 1 );
        } );
    } );

    it ( "keeps the ring progression monotone when label allowances differ", () =>
    {
        // A long event name on an inner loop must not push it past an outer loop with a short name.

        const axes = selfTransitionLoopMajorSemiAxes ( STATE, "right", PREFERENCES, [ 400, 10, 500, 10 ] );

        axes.forEach ( ( axis, index ) =>
        {
            // Calculate the previous value from the current inputs.

            const previous = axes [ index - 1 ];

            // Handle the case where previous differs from undefined.

            if ( previous !== undefined )
            {
                expect ( axis ).toBeGreaterThan ( previous );
            }
        } );
    } );

    it ( "keeps the mouth inside the usable edge span by reducing the aspect ratio uniformly", () =>
    {
        // Initialize the local values needed by this operation.

        const axes  = selfTransitionLoopMajorSemiAxes ( STATE, "right", PREFERENCES, [ 0, 0, 0, 0, 0, 0 ] );
        const outer = axes.at ( -1 ) ?? 0;
        const ratio = selfTransitionLoopAspectRatio ( STATE, "right", PREFERENCES, outer );
        const limit = COMPILE_TIME_CONFIGURATION.chart.routing.selfTransitionLoop.mouthLimit;
        const span  = STATE.height - STATE.cornerRadius * 2;
        const loop  = selfTransitionLoopGeometry ( STATE, "right", ratio, outer );
        const mouth = Math.abs (
            localCoordinates ( loop.entry, "right" ).alongTangent -
            localCoordinates ( loop.exit, "right" ).alongTangent,
        );

        expect ( ratio ).toBeLessThanOrEqual ( PREFERENCES.selfTransitionLoopAspect / 100 );
        expect ( mouth ).toBeLessThanOrEqual ( span * limit + 0.5 );
    } );

    it ( "admits the greater label dimension plus clearance beyond the state body", () =>
    {
        // Initialize the local values needed by this operation.

        const allowance = 240;
        const loop      = resolveLoop ( "right", [ allowance ] );

        expect ( selfTransitionLoopProtrusion ( STATE, "right", loop.majorSemiAxis ) )
            .toBeGreaterThanOrEqual ( allowance );
    } );
} );

describe ( "AL-UI-036 room-aware single-edge selection", () =>
{
    it ( "selects the edge carrying the fewest ordinary relations", () =>
    {
        // Initialize the local values needed by this operation.

        const side = selectSelfTransitionLoopSide (
            STATE,
            { bottom: 3, left: 1, right: 4, top: 2 },
            [],
            PREFERENCES,
            ONE_LOOP,
        );

        expect ( side ).toBe ( "left" );
    } );

    it ( "prefers any completely free edge over one carrying a relation", () =>
    {
        ALL_SIDES.forEach ( freeSide =>
        {
            // Initialize the local values needed by this operation.

            const counts = { bottom: 2, left: 2, right: 2, top: 2 };

            counts [ freeSide ] = 0;

            expect ( selectSelfTransitionLoopSide ( STATE, counts, [], PREFERENCES, ONE_LOOP ) ).toBe ( freeSide );
        } );
    } );

    it ( "breaks a tie by the outward room remaining after that side's own loop reach", () =>
    {
        // A neighbour crowds the right edge, so the tie must not resolve to it.

        const crowdedRight = { height: 400, width: 200, x: STATE.center.x + 150, y: STATE.center.y - 200 };
        const side         = selectSelfTransitionLoopSide (
            STATE,
            NO_ATTACHED_RELATIONS,
            [ crowdedRight ],
            PREFERENCES,
            ONE_LOOP,
        );

        expect ( side ).not.toBe ( "right" );
    } );

    it ( "prefers the connection count over the available room", () =>
    {
        // Initialize the local values needed by this operation.

        const crowdedLeft = { height: 400, width: 200, x: STATE.center.x - 350, y: STATE.center.y - 200 };
        const side        = selectSelfTransitionLoopSide (
            STATE,
            { bottom: 2, left: 0, right: 2, top: 2 },
            [ crowdedLeft ],
            PREFERENCES,
            ONE_LOOP,
        );

        expect ( side ).toBe ( "left" );
    } );

    it ( "resolves a complete tie deterministically", () =>
    {
        expect ( selectSelfTransitionLoopSide ( STATE, NO_ATTACHED_RELATIONS, [], PREFERENCES, ONE_LOOP ) )
            .toBe ( "right" );
    } );

    it ( "does not consult any chart-global quantity", () =>
    {
        // An obstacle far away and out of every edge's band cannot influence the selection.

        const distant = { height: 40, width: 40, x: STATE.center.x + 4_000, y: STATE.center.y + 4_000 };

        expect ( selectSelfTransitionLoopSide ( STATE, NO_ATTACHED_RELATIONS, [ distant ], PREFERENCES, ONE_LOOP ) )
            .toBe ( selectSelfTransitionLoopSide ( STATE, NO_ATTACHED_RELATIONS, [], PREFERENCES, ONE_LOOP ) );
    } );

    it ( "measures outward room only against obstacles standing in front of the edge", () =>
    {
        // Initialize the local values needed by this operation.

        const inFront = { height: 60, width: 60, x: STATE.center.x + 200, y: STATE.center.y - 30 };
        const beside  = { height: 60, width: 60, x: STATE.center.x + 200, y: STATE.center.y + 900 };

        expect ( selfTransitionLoopOutwardRoom ( STATE, "right", [ inFront ] ) )
            .toBeCloseTo ( 200 - STATE.width / 2, 6 );
        expect ( selfTransitionLoopOutwardRoom ( STATE, "right", [ beside ] ) )
            .toBe ( Number.POSITIVE_INFINITY );
        expect ( selfTransitionLoopOutwardRoom ( STATE, "right", [] ) ).toBe ( Number.POSITIVE_INFINITY );
    } );
} );

describe ( "AC-057 Self-Transition Loop preferences", () =>
{
    it ( "publishes the documented defaults and bounds", () =>
    {
        // Initialize the local values needed by this operation.

        const constraints = COMPILE_TIME_CONFIGURATION.applicationSettingConstraints.chart;

        expect ( DEFAULT_APPLICATION_PREFERENCES.selfTransitionLoopAspect ).toBe ( 35 );
        expect ( DEFAULT_APPLICATION_PREFERENCES.selfTransitionLoopExtension ).toBe ( 30 );
        expect ( DEFAULT_APPLICATION_PREFERENCES.selfTransitionLoopSpacing ).toBe ( 24 );
        expect ( constraints.selfTransitionLoopAspect ).toEqual ( { maximum: 100, minimum: 5 } );
        expect ( constraints.selfTransitionLoopExtension ).toEqual ( { maximum: 400, minimum: 1 } );
        expect ( constraints.selfTransitionLoopSpacing ).toEqual ( { maximum: 200, minimum: 1 } );
    } );

    it ( "rejects out-of-range and malformed stored values", () =>
    {
        // Initialize the local values needed by this operation.

        const parsed = parseApplicationPreferences (
            {
                selfTransitionLoopAspect:    500,
                selfTransitionLoopExtension: "wide",
                selfTransitionLoopSpacing:   0,
            },
        );

        expect ( parsed.selfTransitionLoopAspect )
            .toBe ( DEFAULT_APPLICATION_PREFERENCES.selfTransitionLoopAspect );
        expect ( parsed.selfTransitionLoopExtension )
            .toBe ( DEFAULT_APPLICATION_PREFERENCES.selfTransitionLoopExtension );
        expect ( parsed.selfTransitionLoopSpacing )
            .toBe ( DEFAULT_APPLICATION_PREFERENCES.selfTransitionLoopSpacing );
    } );
} );

describe ( "AC-056 default theme", () =>
{
    it ( "defaults to Dark and honors a stored preference", () =>
    {
        expect ( DEFAULT_APPLICATION_PREFERENCES.theme ).toBe ( "Dark" );
        expect ( parseApplicationPreferences ( { theme: "Light" } ).theme ).toBe ( "Light" );
    } );
} );
