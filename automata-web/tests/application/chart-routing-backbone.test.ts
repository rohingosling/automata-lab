// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Chart Routing Backbone Tests
// Version: 1.0.0
// Date:    2026-08-14
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies bounded curve-aware clearance for compact routing backbones.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from "vitest";

import
{
    cubicBezierCurveSamplePoints,
    cubicBezierCurvesFromBackbone,
    fitCubicDetourClearance,
    pointAlongSampledCurve,
    routingBackboneCurveSamplePoints,
} from "../../src/application/chart-routing-backbone.js";
import type { ChartRoutingPoint, ChartRoutingRectangle } from "../../src/application/ports/contracts.js";

//--------------------------------------------------------------------------------------------------
// Function: pointIsInsideRectangle
//
// Description:
//
//   Derives the point is inside rectangle.
//
// Parameters:
//
//   - point:
//     The point supplied to the operation.
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

function pointIsInsideRectangle ( point: ChartRoutingPoint, rectangle: ChartRoutingRectangle ): boolean
{
    // Return the computed result.

    return point.x > rectangle.x && point.x < rectangle.x + rectangle.width &&
        point.y > rectangle.y && point.y < rectangle.y + rectangle.height;
}

describe ( "chart routing backbone clearance", () =>
{
    it ( "samples label anchors by rendered curve arclength", () =>
    {
        // Initialize the local values needed by this operation.

        const samplePoints = routingBackboneCurveSamplePoints ( [
            { x: 0, y: 0 },
            { x: 50, y: 100 },
            { x: 100, y: 0 },
        ] );

        expect ( pointAlongSampledCurve ( samplePoints, 0 ) ).toEqual ( { x: 0, y: 0 } );
        expect ( pointAlongSampledCurve ( samplePoints, 0.5 ).x ).toBeCloseTo ( 50 );
        expect ( pointAlongSampledCurve ( samplePoints, 0.5 ).y ).toBeCloseTo ( 50 );
        expect ( pointAlongSampledCurve ( samplePoints, 1 ) ).toEqual ( { x: 100, y: 0 } );
    } );

    it ( "retains two horizontal-detour gravity points when an adaptive cubic chain clears the blocker", () =>
    {
        // Initialize the local values needed by this operation.

        const inflatedObstacle = { height: 104, width: 104, x: 98, y: -52 };
        const requestedPoints  = [
            { x: 40, y: 0 },
            { x: 40, y: -52 },
            { x: 260, y: -52 },
            { x: 260, y: 0 },
        ];
        const fittedPoints = fitCubicDetourClearance ( requestedPoints, [ inflatedObstacle ], 12 );

        expect ( fittedPoints ).not.toBeNull ();
        expect ( fittedPoints ).toHaveLength ( 4 );
        expect ( fittedPoints?.[ 0 ] ).toEqual ( requestedPoints [ 0 ] );
        expect ( fittedPoints?.[ 1 ]?.x ).toBe ( 40 );
        expect ( fittedPoints?.[ 2 ]?.x ).toBe ( 260 );
        expect ( fittedPoints?.[ 1 ]?.y ).toBe ( -52 );
        expect ( fittedPoints?.[ 2 ]?.y ).toBeCloseTo ( fittedPoints?.[ 1 ]?.y ?? Number.NaN );
        expect ( fittedPoints?.[ 3 ] ).toEqual ( requestedPoints [ 3 ] );

        const curves = cubicBezierCurvesFromBackbone ( fittedPoints ?? [], [ inflatedObstacle ] );

        expect ( curves.length ).toBeGreaterThan ( 1 );

        // Process each point from the cubic bezier curve sample points result collection in order.

        for ( const point of cubicBezierCurveSamplePoints ( curves ) )
        {
            expect ( pointIsInsideRectangle ( point, inflatedObstacle ) ).toBe ( false );
        }
    } );

    it ( "fails closed when an intersecting backbone cannot be expanded with a valid clearance step", () =>
    {
        // Initialize the local values needed by this operation.

        const requestedPoints = [
            { x: 40, y: 0 },
            { x: 80, y: 0 },
            { x: 220, y: 0 },
            { x: 260, y: 0 },
        ];

        expect ( fitCubicDetourClearance (
            requestedPoints,
            [ { height: 104, width: 104, x: 98, y: -52 } ],
            0,
        ) ).toBeNull ();
    } );

    it ( "preserves the selected obstacle side when skewed endpoints lie across its midpoint", () =>
    {
        // Initialize the local values needed by this operation.

        const inflatedObstacle = { height: 144, width: 104, x: 188, y: 98 };
        const requestedPoints  = [
            { x: -100, y: 40 },
            { x: 188, y: 40 },
            { x: 188, y: 260 },
            { x: 300, y: 260 },
        ];
        const fittedPoints = fitCubicDetourClearance ( requestedPoints, [ inflatedObstacle ], 12 );

        expect ( fittedPoints ).not.toBeNull ();
        expect ( fittedPoints?.[ 1 ]?.x ).toBeLessThanOrEqual ( 188 );
        expect ( fittedPoints?.[ 2 ]?.x ).toBeCloseTo ( fittedPoints?.[ 1 ]?.x ?? Number.NaN );

        const curves = cubicBezierCurvesFromBackbone ( fittedPoints ?? [], [ inflatedObstacle ] );

        // Process each point from the cubic bezier curve sample points result collection in order.

        for ( const point of cubicBezierCurveSamplePoints ( curves ) )
        {
            expect ( pointIsInsideRectangle ( point, inflatedObstacle ) ).toBe ( false );
        }
    } );

    it ( "splits a longer backbone into enough certified cubic spans to clear an obstacle", () =>
    {
        // Initialize the local values needed by this operation.

        const requestedPoints = [
            { x: 0, y: 0 },
            { x: 0, y: 28.041654660366476 },
            { x: 341.9591263886541, y: 28.041654660366476 },
            { x: 341.9591263886541, y: 0 },
            { x: 400, y: 0 },
        ];
        const inflatedObstacle = {
            height: 71.92373036965728,
            width:  99.66676922142506,
            x:      135.53776819445193,
            y:      -43.8820757092908,
        };

        const fittedPoints = fitCubicDetourClearance (
            requestedPoints,
            [ inflatedObstacle ],
            12,
        );
        const curves = cubicBezierCurvesFromBackbone ( fittedPoints ?? [], [ inflatedObstacle ] );

        expect ( fittedPoints ).toEqual ( requestedPoints );
        expect ( curves.length ).toBeGreaterThan ( 1 );
        expect ( cubicBezierCurveSamplePoints ( curves ).every ( point =>
            !pointIsInsideRectangle ( point, inflatedObstacle ) ) ).toBe ( true );
    } );
} );
