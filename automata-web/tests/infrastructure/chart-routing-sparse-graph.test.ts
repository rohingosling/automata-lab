// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Chart Routing Sparse Graph Tests
// Version: 1.0.0
// Date:    2026-08-22
// Author:  Rohin Gosling
//
// Description:
//
//   Compares exact sparse Chart routing with the retained dense oracle and verifies deterministic
//   compatibility fallback.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type
{
    ChartRoutingPoint,
    ChartRoutingRectangle,
    ChartRoutingRequest,
    ChartRoutingResultRelation,
} from "../../src/application/ports/contracts.js";
import { cubicBezierCurvesAreClearOfObstacles } from
    "../../src/application/chart-routing-backbone.js";
import { createChartRoutingPerformanceCounters } from
    "../../src/application/chart-routing-performance.js";
import { CHART_ROUTING_CONFIGURATION } from
    "../../src/configuration/compile-time-configuration.js";
import
{
    routeChartRelationsDenseReference,
    routeChartRelationsSparseReference,
} from "../../src/infrastructure/chart/orthogonal-chart-router.js";

const SOURCE            = { x: 0, y: 0 };
const TARGET            = { x: 600, y: 300 };
const BLOCKING_OBSTACLE = { x: 280, y: 130, width: 40, height: 40 };

//--------------------------------------------------------------------------------------------------
// Interface: RouteQuality
//
// Description:
//
//   Defines the structure of route quality.
//
//--------------------------------------------------------------------------------------------------

interface RouteQuality
{
    readonly bends:  number;
    readonly length: number;
}

//--------------------------------------------------------------------------------------------------
// Function: requestWithObstacles
//
// Description:
//
//   Requests the with obstacles.
//
// Parameters:
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

function requestWithObstacles ( obstacles: readonly ChartRoutingRectangle[] ): ChartRoutingRequest
{
    // Return the assembled result.

    return {
        documentRevision: 1,
        geometryRevision: 1,
        preferenceRevision: 1,
        relations:
        [
            {
                identifier: "transition:oracle",
                labelHeight: 0,
                labelObstacles: obstacles,
                labelPosition: 0.5,
                labelWidth: 0,
                obstacles,
                preferredPoints: [ SOURCE, TARGET ],
                preservePreferred: false,
            },
        ],
        requestId: "sparse-oracle",
        transitionGravityPointDistance: CHART_ROUTING_CONFIGURATION.routeClearance,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: segmentDirection
//
// Description:
//
//   Derives the segment direction.
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

function segmentDirection ( source: ChartRoutingPoint, target: ChartRoutingPoint ): "horizontal" | "vertical"
{
    // Return the result selected by the current condition.

    return source.x === target.x ? "vertical" : "horizontal";
}

//--------------------------------------------------------------------------------------------------
// Function: routeQuality
//
// Description:
//
//   Routes the quality.
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

function routeQuality ( points: readonly ChartRoutingPoint[] ): RouteQuality
{
    // Initialize the local values needed by this operation.

    let bends                                               = 0;
    let length                                              = 0;
    let previousDirection: "horizontal" | "vertical" | null = null;

    // Repeat the operation across the bounded iteration range.

    for ( let pointIndex = 1; pointIndex < points.length; pointIndex += 1 )
    {
        // Initialize the local values needed by this operation.

        const source = points [ pointIndex - 1 ];
        const target = points [ pointIndex ];

        // Handle the case where at least one branch condition is satisfied.

        if ( source === undefined || target === undefined )
        {
            continue;
        }

        const direction = segmentDirection ( source, target );

        length += Math.abs ( target.x - source.x ) + Math.abs ( target.y - source.y );

        // Handle the case where all required conditions are satisfied.

        if ( previousDirection !== null && previousDirection !== direction )
        {
            bends += 1;
        }

        previousDirection = direction;
    }

    // Return the assembled result.

    return { bends, length };
}

//--------------------------------------------------------------------------------------------------
// Function: inflateRectangle
//
// Description:
//
//   Inflates the rectangle.
//
// Parameters:
//
//   - rectangle:
//     The rectangle supplied to the operation.
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

function inflateRectangle ( rectangle: ChartRoutingRectangle ): ChartRoutingRectangle
{
    // Initialize the local values needed by this operation.

    const clearance = CHART_ROUTING_CONFIGURATION.routeClearance;

    // Return the assembled result.

    return {
        height: rectangle.height + clearance * 2,
        width: rectangle.width + clearance * 2,
        x: rectangle.x - clearance,
        y: rectangle.y - clearance,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: expectEqualQuality
//
// Description:
//
//   Verifies equal quality and reports a failure when it is invalid.
//
// Parameters:
//
//   - sparseRelation:
//     The sparse relation supplied to the operation.
//
//   - denseRelation:
//     The dense relation supplied to the operation.
//
//   - obstacles:
//     The obstacles supplied to the operation.
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

function expectEqualQuality (
    sparseRelation: ChartRoutingResultRelation,
    denseRelation: ChartRoutingResultRelation,
    obstacles: readonly ChartRoutingRectangle[],
): void
{
    expect ( routeQuality ( sparseRelation.points ) ).toEqual ( routeQuality ( denseRelation.points ) );
    expect ( sparseRelation.exteriorFallback ).toBe ( denseRelation.exteriorFallback );

    // Handle the case where the sparse relation exterior fallback condition is not satisfied.

    if ( !sparseRelation.exteriorFallback )
    {
        expect ( cubicBezierCurvesAreClearOfObstacles (
            sparseRelation.curves,
            obstacles.map ( inflateRectangle ),
        ) ).toBe ( true );
    }
}

describe ( "sparse Chart routing visibility graph", () =>
{
    it ( "matches dense route quality over generated pairwise-disjoint rectangular scenes", () =>
    {
        // Initialize the local values needed by this operation.

        const slotArbitrary = fc.uniqueArray ( fc.integer ( { min: 0, max: 15 } ), { maxLength: 6 } );

        fc.assert ( fc.property ( slotArbitrary, slots =>
        {
            // Initialize the local values needed by this operation.

            const xCoordinates = [ 80, 160, 400, 480 ];
            const yCoordinates = [ -240, -120, 300, 420 ];
            const obstacles    = [
                BLOCKING_OBSTACLE,
                ...slots.map ( slot => ( {
                    height: 30,
                    width: 30,
                    x: xCoordinates [ slot % xCoordinates.length ] ?? 80,
                    y: yCoordinates [ Math.floor ( slot / xCoordinates.length ) ] ?? -240,
                } ) ),
            ];
            const request        = requestWithObstacles ( obstacles );
            const sparse         = routeChartRelationsSparseReference ( request );
            const dense          = routeChartRelationsDenseReference ( request );
            const sparseRelation = sparse.relations [ 0 ];
            const denseRelation  = dense.relations [ 0 ];

            expect ( sparse ).toEqual ( routeChartRelationsSparseReference ( request ) );
            expect ( sparseRelation ).toBeDefined ();
            expect ( denseRelation ).toBeDefined ();

            // Handle the case where all required conditions are satisfied.

            if ( sparseRelation !== undefined && denseRelation !== undefined )
            {
                expectEqualQuality ( sparseRelation, denseRelation, obstacles );
            }
        } ), { numRuns: 150 } );
    } );

    it ( "matches dense route quality over generated overlapping rectangular scenes", () =>
    {
        // Initialize the local values needed by this operation.

        const offsetArbitrary = fc.record ( {
            x: fc.integer ( { min: 40, max: 55 } ),
            y: fc.integer ( { min: -15, max: 15 } ),
        } );

        fc.assert ( fc.property ( offsetArbitrary, offset =>
        {
            // Initialize the local values needed by this operation.

            const obstacles = [
                BLOCKING_OBSTACLE,
                { x: 100, y: 20, width: 40, height: 40 },
                { x: 100 + offset.x, y: 20 + offset.y, width: 40, height: 40 },
            ];
            const request        = requestWithObstacles ( obstacles );
            const sparseCounters = createChartRoutingPerformanceCounters ();
            const sparse         = routeChartRelationsSparseReference ( request, sparseCounters );
            const dense          = routeChartRelationsDenseReference ( request );
            const sparseRelation = sparse.relations [ 0 ];
            const denseRelation  = dense.relations [ 0 ];

            expect ( sparse ).toEqual ( routeChartRelationsSparseReference ( request ) );
            expect ( sparseCounters.denseCompatibilityFallbackCount ).toBe ( 0 );
            expect ( sparseCounters.sparseGraphBuildCount ).toBeGreaterThan ( 0 );
            expect ( sparseRelation ).toBeDefined ();
            expect ( denseRelation ).toBeDefined ();

            // Handle the case where all required conditions are satisfied.

            if ( sparseRelation !== undefined && denseRelation !== undefined )
            {
                expectEqualQuality ( sparseRelation, denseRelation, obstacles );
            }
        } ), { numRuns: 100 } );
    } );

    it ( "uses the byte-identical dense fallback when inflated rectangles only touch", () =>
    {
        // Initialize the local values needed by this operation.

        const request = requestWithObstacles ( [
            BLOCKING_OBSTACLE,
            { x: 100, y: 20, width: 40, height: 40 },
            { x: 164, y: 20, width: 40, height: 40 },
        ] );
        const sparseCounters = createChartRoutingPerformanceCounters ();
        const denseCounters  = createChartRoutingPerformanceCounters ();
        const sparse         = routeChartRelationsSparseReference ( request, sparseCounters );
        const dense          = routeChartRelationsDenseReference ( request, denseCounters );

        expect ( sparse ).toEqual ( dense );
        expect ( sparseCounters.denseCompatibilityFallbackCount ).toBeGreaterThan ( 0 );
        expect ( sparseCounters.sparseGraphBuildCount ).toBe ( 0 );
        expect ( sparseCounters.graphVertexCount ).toBe ( denseCounters.graphVertexCount );
        expect ( sparseCounters.graphEdgeCount ).toBe ( denseCounters.graphEdgeCount );
    } );

    it ( "normalizes overlapping inflated rectangles without using the dense compatibility fallback", () =>
    {
        // Initialize the local values needed by this operation.

        const request = requestWithObstacles ( [
            BLOCKING_OBSTACLE,
            { x: 100, y: 20, width: 40, height: 40 },
            { x: 150, y: 20, width: 40, height: 40 },
        ] );
        const sparseCounters = createChartRoutingPerformanceCounters ();
        const denseCounters  = createChartRoutingPerformanceCounters ();
        const sparse         = routeChartRelationsSparseReference ( request, sparseCounters );
        const dense          = routeChartRelationsDenseReference ( request, denseCounters );

        expect ( sparse ).toEqual ( dense );
        expect ( sparseCounters.denseCompatibilityFallbackCount ).toBe ( 0 );
        expect ( sparseCounters.sparseGraphBuildCount ).toBeGreaterThan ( 0 );
        expect ( sparseCounters.graphVertexCount ).toBeLessThan ( denseCounters.graphVertexCount );
        expect ( sparseCounters.graphEdgeCount ).toBeLessThan ( denseCounters.graphEdgeCount );
    } );
} );
