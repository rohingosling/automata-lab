// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Chart Routing Core Tests
// Version: 1.0.0
// Date:    2026-08-12
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies deterministic bounded visibility routing, obstacle avoidance, label separation, and
//   exterior fallback.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from "vitest";

import type
{
    ChartRoutingPoint,
    ChartRoutingRectangle,
    ChartRoutingRequest,
} from "../../src/application/ports/contracts.js";
import
{
    cubicBezierCurveSamplePoints,
} from "../../src/application/chart-routing-backbone.js";
import { createChartRoutingPerformanceCounters } from
    "../../src/application/chart-routing-performance.js";
import
{
    routeChartRelations,
    routeChartRelationsDenseReference,
} from "../../src/infrastructure/chart/orthogonal-chart-router.js";
import
{
    CHART_ROUTING_PROTOCOL_VERSION,
    decodeChartRoutingWorkerRequest,
    isChartRoutingWorkerResult,
} from "../../src/protocol/chart-routing-worker-protocol.js";

//--------------------------------------------------------------------------------------------------
// Function: createRequest
//
// Description:
//
//   Creates request for the test scenario.
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

function createRequest ( obstacles: readonly ChartRoutingRectangle[] = [] ): ChartRoutingRequest
{
    // Return the assembled result.

    return {
        documentRevision: 7,
        geometryRevision: 7,
        preferenceRevision: 3,
        requestId: "route-test",
        transitionGravityPointDistance: 12,
        relations:
        [
            {
                identifier: "transition:one",
                labelHeight: 22,
                labelObstacles: obstacles,
                labelPosition: 0.5,
                labelWidth: 70,
                obstacles,
                preferredPoints: [ { x: 0, y: 0 }, { x: 12, y: 0 }, { x: 188, y: 0 }, { x: 200, y: 0 } ],
                preservePreferred: false,
            },
        ],
    };
}

//--------------------------------------------------------------------------------------------------
// Function: segmentIntersectsRectangle
//
// Description:
//
//   Derives the segment intersects rectangle.
//
// Parameters:
//
//   - source:
//     The source supplied to the operation.
//
//   - target:
//     The target supplied to the operation.
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

function segmentIntersectsRectangle (
    source: ChartRoutingPoint,
    target: ChartRoutingPoint,
    rectangle: ChartRoutingRectangle,
): boolean
{
    // Handle the case where source x matches target x.

    if ( source.x === target.x )
    {
        // Return the computed result.

        return source.x > rectangle.x && source.x < rectangle.x + rectangle.width &&
            Math.max ( source.y, target.y ) > rectangle.y &&
            Math.min ( source.y, target.y ) < rectangle.y + rectangle.height;
    }

    // Return the computed result.

    return source.y === target.y && source.y > rectangle.y && source.y < rectangle.y + rectangle.height &&
        Math.max ( source.x, target.x ) > rectangle.x &&
        Math.min ( source.x, target.x ) < rectangle.x + rectangle.width;
}

//--------------------------------------------------------------------------------------------------
// Function: pointOnCubic
//
// Description:
//
//   Derives the point on cubic.
//
// Parameters:
//
//   - points:
//     The points supplied to the operation.
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

function pointOnCubic (
    points: readonly ChartRoutingPoint[],
    position: number,
): ChartRoutingPoint
{
    // Initialize the local values needed by this operation.

    const source        = points [ 0 ] ?? { x: 0, y: 0 };
    const sourceControl = points [ 1 ] ?? source;
    const targetControl = points [ 2 ] ?? source;
    const target        = points [ 3 ] ?? source;
    const complement    = 1 - position;

    // Return the assembled result.

    return {
        x: complement ** 3 * source.x + 3 * complement ** 2 * position * sourceControl.x +
            3 * complement * position ** 2 * targetControl.x + position ** 3 * target.x,
        y: complement ** 3 * source.y + 3 * complement ** 2 * position * sourceControl.y +
            3 * complement * position ** 2 * targetControl.y + position ** 3 * target.y,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: backboneManhattanLength
//
// Description:
//
//   Derives the backbone manhattan length.
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

function backboneManhattanLength ( points: readonly ChartRoutingPoint[] ): number
{
    // Return the reduce result.

    return points.slice ( 1 ).reduce ( ( length, point, pointIndex ) =>
    {
        // Initialize the local values needed by this operation.

        const previousPoint = points [ pointIndex ] ?? point;

        // Return the computed result.

        return length + Math.abs ( point.x - previousPoint.x ) + Math.abs ( point.y - previousPoint.y );
    }, 0 );
}

describe ( "orthogonal Chart router", () =>
{
    it ( "collects opt-in request-local counters without changing the routing result", () =>
    {
        // Initialize the local values needed by this operation.

        const request             = createRequest ( [ { x: 80, y: -20, width: 40, height: 40 } ] );
        const expected            = routeChartRelations ( request );
        const performanceCounters = createChartRoutingPerformanceCounters ();
        const measured            = routeChartRelations ( request, performanceCounters );

        expect ( measured ).toEqual ( expected );
        expect ( performanceCounters.relationCount ).toBe ( 1 );
        expect ( performanceCounters.relationsRetainedCount ).toBe ( 1 );
        expect ( performanceCounters.relationsRepairedCount ).toBe ( 0 );
        expect ( performanceCounters.graphBuildCount ).toBeGreaterThan ( 0 );
        expect ( performanceCounters.graphVertexCount ).toBeGreaterThan ( 0 );
        expect ( performanceCounters.graphEdgeCount ).toBeGreaterThan ( 0 );
        expect ( performanceCounters.aStarExpandedStateCount ).toBeGreaterThan ( 0 );
        expect ( performanceCounters.heapOperationCount ).toBeGreaterThan ( 0 );
        expect ( performanceCounters.exactObstacleTestCount ).toBeGreaterThan ( 0 );
        expect ( performanceCounters.totalRequestMilliseconds ).toBeGreaterThanOrEqual ( 0 );
        expect ( performanceCounters.passOneMilliseconds ).toBeGreaterThanOrEqual ( 0 );
        expect ( performanceCounters.passTwoMilliseconds ).toBeGreaterThanOrEqual ( 0 );
        expect ( performanceCounters.repairEligibilityMilliseconds ).toBeGreaterThanOrEqual ( 0 );
    } );

    it ( "reduces a directly visible relation to its two endpoints", () =>
    {
        // Initialize the local values needed by this operation.

        const request  = createRequest ();
        const relation = request.relations [ 0 ]!;
        const result   = routeChartRelations ( {
            ...request,
            relations:
            [
                {
                    ...relation,
                    preferredPoints:
                    [
                        { x: 0, y: 0 },
                        { x: 12, y: 0 },
                        { x: 188, y: 100 },
                        { x: 200, y: 100 },
                    ],
                },
            ],
        } );

        expect ( result.relations [ 0 ]?.exteriorFallback ).toBe ( false );
        expect ( result.relations [ 0 ]?.points ).toEqual ( [ { x: 0, y: 0 }, { x: 200, y: 100 } ] );
    } );

    it ( "uses an exact clear one-bend route without building a visibility graph", () =>
    {
        // Initialize the local values needed by this operation.

        const obstacle                     = { x: 190, y: 190, width: 20, height: 20 };
        const relation                     = createRequest ().relations [ 0 ]!;
        const request: ChartRoutingRequest = {
            ...createRequest (),
            relations:
            [
                {
                    ...relation,
                    labelHeight: 0,
                    labelObstacles: [ obstacle ],
                    labelWidth: 0,
                    obstacles: [ obstacle ],
                    preferredPoints: [ { x: 0, y: 0 }, { x: 400, y: 400 } ],
                },
            ],
            transitionGravityPointDistance: 100,
        };
        const performanceCounters    = createChartRoutingPerformanceCounters ();
        const denseReferenceCounters = createChartRoutingPerformanceCounters ();
        const result                 = routeChartRelations ( request, performanceCounters );
        const denseReference         = routeChartRelationsDenseReference ( request, denseReferenceCounters );
        const resultPoints           = result.relations [ 0 ]?.points ?? [];
        const denseReferencePoints   = denseReference.relations [ 0 ]?.points ?? [];

        expect ( resultPoints ).toEqual ( [
            { x: 0, y: 0 },
            { x: 400, y: 0 },
            { x: 400, y: 400 },
        ] );
        expect ( denseReferencePoints ).toEqual ( [
            { x: 0, y: 0 },
            { x: 0, y: 400 },
            { x: 400, y: 400 },
        ] );
        expect ( backboneManhattanLength ( resultPoints ) ).toBe ( backboneManhattanLength ( denseReferencePoints ) );
        expect ( resultPoints ).toHaveLength ( denseReferencePoints.length );
        expect ( result.relations [ 0 ]?.exteriorFallback )
            .toBe ( denseReference.relations [ 0 ]?.exteriorFallback );
        expect ( performanceCounters.graphBuildCount ).toBe ( 0 );
        expect ( denseReferenceCounters.graphBuildCount ).toBe ( 2 );
        expect ( performanceCounters.relationsRetainedCount ).toBe ( 1 );
        expect ( performanceCounters.relationsRepairedCount ).toBe ( 0 );
    } );

    it ( "selects the clear one-bend orientation with fewer proper crossings", () =>
    {
        // Initialize the local values needed by this operation.

        const obstacle      = { x: 190, y: 190, width: 20, height: 20 };
        const relation      = createRequest ().relations [ 0 ]!;
        const crossingRoute = {
            ...relation,
            identifier: "transition:crossing-route",
            labelHeight: 0,
            labelObstacles: [],
            labelWidth: 0,
            obstacles: [],
            preferredPoints: [ { x: 200, y: -100 }, { x: 200, y: 100 } ],
            preservePreferred: true,
        };
        const candidate = {
            ...relation,
            identifier: "transition:one-bend-candidate",
            labelHeight: 0,
            labelObstacles: [ obstacle ],
            labelWidth: 0,
            obstacles: [ obstacle ],
            preferredPoints: [ { x: 0, y: 0 }, { x: 400, y: 400 } ],
        };
        const performanceCounters = createChartRoutingPerformanceCounters ();
        const result              = routeChartRelations ( {
            ...createRequest (),
            relations: [ crossingRoute, candidate ],
            transitionGravityPointDistance: 100,
        }, performanceCounters );

        expect ( result.relations [ 1 ]?.points ).toEqual ( [
            { x: 0, y: 0 },
            { x: 0, y: 400 },
            { x: 400, y: 400 },
        ] );
        expect ( performanceCounters.graphBuildCount ).toBe ( 0 );
        expect ( performanceCounters.exactCrossingTestCount ).toBeGreaterThan ( 0 );
    } );

    it ( "does not treat a label-free relation as a routing obstacle", () =>
    {
        // Initialize the local values needed by this operation.

        const request          = createRequest ();
        const labelledRelation = {
            ...request.relations [ 0 ]!,
            preferredPoints: [ { x: 0, y: 0 }, { x: 200, y: 100 } ],
        };
        const result = routeChartRelations ( {
            ...request,
            relations:
            [
                labelledRelation,
                {
                    ...labelledRelation,
                    identifier: "draft:zero-label",
                    labelHeight: 0,
                    labelWidth: 0,
                    preferredPoints: [ { x: 100, y: 50 }, { x: 100, y: 50 } ],
                },
            ],
        } );

        expect ( result.relations [ 0 ]?.points ).toEqual ( [ { x: 0, y: 0 }, { x: 200, y: 100 } ] );
        expect ( result.relations [ 0 ]?.exteriorFallback ).toBe ( false );
    } );

    it ( "keeps the shortest one-span route ahead of crossing avoidance", () =>
    {
        // Initialize the local values needed by this operation.

        const relation   = createRequest ().relations [ 0 ]!;
        const fixedRoute = {
            ...relation,
            identifier: "transition:fixed",
            labelHeight: 0,
            labelWidth: 0,
            preferredPoints: [ { x: 100, y: -100 }, { x: 100, y: 100 } ],
            preservePreferred: true,
        };
        const crossingCandidate = {
            ...relation,
            identifier: "transition:crossing-candidate",
            labelHeight: 0,
            labelObstacles: [],
            labelWidth: 0,
            obstacles: [ { x: 300, y: 120, width: 20, height: 20 } ],
            preferredPoints: [ { x: 0, y: 0 }, { x: 200, y: 0 } ],
        };
        const request = {
            ...createRequest (),
            relations: [ fixedRoute, crossingCandidate ],
        };
        const performanceCounters = createChartRoutingPerformanceCounters ();
        const first               = routeChartRelations ( request, performanceCounters );
        const second              = routeChartRelations ( request );
        const routedPoints        = first.relations [ 1 ]?.points ?? [];

        expect ( first ).toEqual ( second );
        expect ( first ).toEqual ( routeChartRelationsDenseReference ( request ) );
        expect ( routedPoints ).toEqual ( [ { x: 0, y: 0 }, { x: 200, y: 0 } ] );
        expect ( performanceCounters.relationsRetainedCount ).toBe ( 1 );
        expect ( performanceCounters.relationsRepairedCount ).toBe ( 1 );
    } );

    it ( "finds a deterministic orthogonal route around an unrelated opaque obstacle", () =>
    {
        // Initialize the local values needed by this operation.

        const obstacle         = { x: 80, y: -30, width: 40, height: 60 };
        const request          = createRequest ( [ obstacle ] );
        const first            = routeChartRelations ( request );
        const second           = routeChartRelations ( request );
        const points           = first.relations [ 0 ]?.points ?? [];
        const inflatedObstacle = { x: 68, y: -42, width: 64, height: 84 };

        expect ( first ).toEqual ( second );
        expect ( first.relations [ 0 ]?.exteriorFallback ).toBe ( false );
        expect ( points.length ).toBeGreaterThanOrEqual ( 4 );

        // Repeat the operation across the bounded iteration range.

        for ( let index = 1; index < points.length; index += 1 )
        {
            // Initialize the local values needed by this operation.

            const source = points [ index - 1 ];
            const target = points [ index ];

            expect ( source?.x === target?.x || source?.y === target?.y ).toBe ( true );
            expect ( source === undefined || target === undefined
                ? false
                : segmentIntersectsRectangle ( source, target, inflatedObstacle ) ).toBe ( false );
        }
    } );

    it ( "uses only two obstacle-side gravity points for one vertically blocking state", () =>
    {
        // Initialize the local values needed by this operation.

        const obstacle         = { height: 80, width: 80, x: -40, y: 110 };
        const request          = createRequest ( [ obstacle ] );
        const relation         = request.relations [ 0 ]!;
        const blockingRelation = {
            ...relation,
            labelHeight: 0,
            labelObstacles: [],
            labelWidth: 0,
            preferredPoints: [ { x: 0, y: 0 }, { x: 0, y: 300 } ],
        };
        const result = routeChartRelations ( {
            ...request,
            relations: [ blockingRelation ],
        } );
        const repeatedResult = routeChartRelations ( {
            ...request,
            relations: [ blockingRelation ],
        } );

        const routedRelation = result.relations [ 0 ];

        expect ( repeatedResult ).toEqual ( result );
        expect ( routedRelation?.exteriorFallback ).toBe ( false );
        expect ( routedRelation?.points ).toHaveLength ( 4 );
        expect ( routedRelation?.points [ 0 ] ).toEqual ( { x: 0, y: 0 } );
        expect ( routedRelation?.points [ 1 ]?.x ).toBeLessThanOrEqual ( -52 );
        expect ( routedRelation?.points [ 1 ]?.y ).toBe ( 0 );
        expect ( routedRelation?.points [ 2 ]?.x ).toBeCloseTo (
            routedRelation?.points [ 1 ]?.x ?? Number.NaN,
        );
        expect ( routedRelation?.points [ 2 ]?.y ).toBe ( 300 );
        expect ( routedRelation?.points [ 3 ] ).toEqual ( { x: 0, y: 300 } );

        // Process each point from the cubic bezier curve sample points result collection in order.

        for ( const point of cubicBezierCurveSamplePoints ( routedRelation?.curves ?? [] ) )
        {
            expect ( point.x > -52 && point.x < 52 && point.y > 98 && point.y < 202 ).toBe ( false );
        }
    } );

    it ( "moves obstacle gravity points farther outward when the configured distance increases", () =>
    {
        // Initialize the local values needed by this operation.

        const obstacle = { height: 80, width: 80, x: -40, y: 110 };
        const request  = createRequest ( [ obstacle ] );
        const relation = {
            ...request.relations [ 0 ]!,
            labelHeight: 0,
            labelObstacles: [],
            labelWidth: 0,
            preferredPoints: [ { x: 0, y: 0 }, { x: 0, y: 300 } ],
        };
        const nearResult = routeChartRelations ( {
            ...request,
            relations: [ relation ],
            transitionGravityPointDistance: 12,
        } );
        const farResult = routeChartRelations ( {
            ...request,
            relations: [ relation ],
            transitionGravityPointDistance: 24,
        } );
        const nearGravityPoint = nearResult.relations [ 0 ]?.points [ 1 ];
        const farGravityPoint  = farResult.relations [ 0 ]?.points [ 1 ];

        expect ( nearGravityPoint ).toBeDefined ();
        expect ( farGravityPoint ).toBeDefined ();
        expect ( Math.abs ( farGravityPoint?.x ?? 0 ) ).toBeGreaterThan (
            Math.abs ( nearGravityPoint?.x ?? 0 ),
        );
        expect ( farResult ).toEqual ( routeChartRelations ( {
            ...request,
            relations: [ relation ],
            transitionGravityPointDistance: 24,
        } ) );
    } );

    it ( "re-searches or uses a proven clean exterior recovery when a longer spline is unsafe", () =>
    {
        // Initialize the local values needed by this operation.

        const obstacles = [
            { x: 308.8503418583423, y: -92.16629297006875, width: 79.20383684337139,
                height: 65.40715059265494 },
            { x: 353.9591263886541, y: 13.336928165517747, width: 65.64669340848923,
                height: 21.231203358620405 },
            { x: 147.53776819445193, y: -31.882075709290802, width: 75.66676922142506,
                height: 47.92373036965728 },
            { x: 56.26071433536708, y: 93.3460479369387, width: 60.336699932813644,
                height: 44.341104459017515 },
            { x: 352.08660681732, y: -53.40378500986844, width: 42.82049082219601,
                height: 36.37125363573432 },
        ];
        const request        = createRequest ( obstacles );
        const relation       = request.relations [ 0 ]!;
        const routingRequest = {
            ...request,
            relations:
            [
                {
                    ...relation,
                    labelHeight: 0,
                    labelObstacles: [],
                    labelWidth: 0,
                    preferredPoints: [ { x: 0, y: 0 }, { x: 500, y: 0 } ],
                },
            ],
        };
        const result         = routeChartRelations ( routingRequest );
        const routedRelation = result.relations [ 0 ];
        const curves         = routedRelation?.curves ?? [];

        expect ( result ).toEqual ( routeChartRelations ( routingRequest ) );
        expect ( routedRelation?.exteriorFallback ).toBe ( false );
        expect ( routedRelation?.points.length ).toBeGreaterThanOrEqual ( 4 );

        // Process each obstacle from the obstacles collection in order.

        for ( const obstacle of obstacles )
        {
            // Calculate the inflated obstacle value from the current inputs.

            const inflatedObstacle = {
                x: obstacle.x - 12,
                y: obstacle.y - 12,
                width: obstacle.width + 24,
                height: obstacle.height + 24,
            };

            // Process each curve from the curves collection in order.

            for ( const curve of curves )
            {
                // Initialize the local values needed by this operation.

                const points = [ curve.source, curve.sourceControl, curve.targetControl, curve.target ];

                // Repeat the operation across the bounded iteration range.

                for ( let sampleIndex = 0; sampleIndex <= 200; sampleIndex += 1 )
                {
                    // Calculate the point value from the current inputs.

                    const point = pointOnCubic ( points, sampleIndex / 200 );

                    expect ( point.x > inflatedObstacle.x &&
                        point.x < inflatedObstacle.x + inflatedObstacle.width &&
                        point.y > inflatedObstacle.y &&
                        point.y < inflatedObstacle.y + inflatedObstacle.height ).toBe ( false );
                }
            }
        }
    } );

    it ( "allocates as many certified cubic spans as a staggered obstacle maze requires", () =>
    {
        // Initialize the local values needed by this operation.

        const obstacles = [
            { x: 100, y: -1_000, width: 50, height: 1_040 },
            { x: 220, y: -40, width: 50, height: 1_040 },
            { x: 340, y: -1_000, width: 50, height: 1_040 },
            { x: 460, y: -40, width: 50, height: 1_040 },
            { x: 580, y: -1_000, width: 50, height: 1_040 },
        ];
        const baseRequest                  = createRequest ( obstacles );
        const relation                     = baseRequest.relations [ 0 ]!;
        const request: ChartRoutingRequest = {
            ...baseRequest,
            relations:
            [
                {
                    ...relation,
                    labelHeight: 0,
                    labelObstacles: [],
                    labelWidth: 0,
                    preferredPoints: [ { x: 0, y: 0 }, { x: 700, y: 0 } ],
                },
            ],
        };
        const result         = routeChartRelations ( request );
        const routedRelation = result.relations [ 0 ];

        expect ( result ).toEqual ( routeChartRelations ( request ) );
        expect ( routedRelation?.exteriorFallback ).toBe ( false );
        expect ( routedRelation?.points.length ).toBeGreaterThanOrEqual ( 10 );
        expect ( routedRelation?.curves.length ).toBeGreaterThanOrEqual ( 5 );

        // Process each obstacle from the obstacles collection in order.

        for ( const obstacle of obstacles )
        {
            // Calculate the inflated obstacle value from the current inputs.

            const inflatedObstacle = {
                x: obstacle.x - 12,
                y: obstacle.y - 12,
                width: obstacle.width + 24,
                height: obstacle.height + 24,
            };

            // Process each curve from the current value collection in order.

            for ( const curve of routedRelation?.curves ?? [] )
            {
                // Initialize the local values needed by this operation.

                const curvePoints = [ curve.source, curve.sourceControl, curve.targetControl, curve.target ];

                // Repeat the operation across the bounded iteration range.

                for ( let sampleIndex = 0; sampleIndex <= 200; sampleIndex += 1 )
                {
                    // Calculate the point value from the current inputs.

                    const point = pointOnCubic ( curvePoints, sampleIndex / 200 );

                    expect ( point.x > inflatedObstacle.x &&
                        point.x < inflatedObstacle.x + inflatedObstacle.width &&
                        point.y > inflatedObstacle.y &&
                        point.y < inflatedObstacle.y + inflatedObstacle.height ).toBe ( false );
                }
            }
        }
    } );

    it ( "uses stable geometry order to break equal-cost route-side ties", () =>
    {
        // Initialize the local values needed by this operation.

        const obstacle       = { x: 80, y: -30, width: 40, height: 60 };
        const first          = routeChartRelations ( createRequest ( [ obstacle ] ) );
        const second         = routeChartRelations ( createRequest ( [ obstacle ] ) );
        const interiorPoints = first.relations [ 0 ]?.points.slice ( 1, -1 ) ?? [];

        expect ( first ).toEqual ( second );
        expect ( interiorPoints.some ( point => point.y < 0 ) ).toBe ( true );
        expect ( interiorPoints.every ( point => point.y <= 0 ) ).toBe ( true );
    } );

    it ( "places a Start label on the curve near its source-state intersection", () =>
    {
        // Initialize the local values needed by this operation.

        const upperState = { x: 40, y: 100, width: 320, height: 116 };
        const lowerState = { x: 40, y: 260, width: 320, height: 116 };
        const relation   = createRequest ().relations [ 0 ]!;
        const result     = routeChartRelations ( {
            ...createRequest (),
            relations:
            [
                {
                    ...relation,
                    labelObstacles: [ upperState, lowerState ],
                    labelPosition: 0.2,
                    obstacles: [],
                    preferredPoints: [ { x: 200, y: 260 }, { x: 200, y: 216 } ],
                },
            ],
        } );
        const routedRelation = result.relations [ 0 ];

        expect ( routedRelation?.exteriorFallback ).toBe ( false );
        expect ( ( routedRelation?.label.x ?? 0 ) + ( routedRelation?.label.width ?? 0 ) / 2 ).toBe ( 200 );
        expect ( routedRelation?.label.y ).toBeGreaterThanOrEqual ( 216 );
        expect ( ( routedRelation?.label.y ?? 0 ) + ( routedRelation?.label.height ?? 0 ) ).toBeLessThanOrEqual ( 260 );
    } );

    it ( "uses the bounded label fallback when no on-curve rectangle fits between states", () =>
    {
        // Initialize the local values needed by this operation.

        const upperState = { x: 40, y: 100, width: 320, height: 116 };
        const lowerState = { x: 40, y: 226, width: 320, height: 116 };
        const relation   = createRequest ().relations [ 0 ]!;
        const result     = routeChartRelations ( {
            ...createRequest (),
            relations:
            [
                {
                    ...relation,
                    labelObstacles: [ upperState, lowerState ],
                    labelPosition: 0.2,
                    obstacles: [],
                    preferredPoints: [ { x: 200, y: 226 }, { x: 200, y: 216 } ],
                },
            ],
        } );
        const routedRelation = result.relations [ 0 ];
        const label          = routedRelation?.label;

        expect ( routedRelation?.exteriorFallback ).toBe ( true );
        expect ( label === undefined || label.x + label.width <= upperState.x ||
            label.x >= upperState.x + upperState.width ).toBe ( true );
    } );

    it ( "places Start, Center, and End labels at 20, 50, and 80 percent of the visible curve", () =>
    {
        // Initialize the local values needed by this operation.

        const relation = createRequest ().relations [ 0 ]!;

        //------------------------------------------------------------------------------------------
        // Function: labelCenter
        //
        // Description:
        //
        //   Derives the label center.
        //
        // Parameters:
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
        //------------------------------------------------------------------------------------------

        const labelCenter = ( labelPosition: number ): ChartRoutingPoint =>
        {
            // Initialize the local values needed by this operation.

            const label = routeChartRelations ( {
                ...createRequest (),
                relations:
                [
                    {
                        ...relation,
                        labelHeight: 20,
                        labelObstacles: [],
                        labelPosition,
                        labelWidth: 40,
                        obstacles: [],
                        preferredPoints: [ { x: 0, y: 0 }, { x: 300, y: 0 } ],
                        sourceBoundary: { cornerRadius: 10, height: 80, kind: "rectangle", radius: 0, width: 80 },
                        targetBoundary: { cornerRadius: 10, height: 80, kind: "rectangle", radius: 0, width: 80 },
                    },
                ],
            } ).relations [ 0 ]?.label;

            // Return the result selected by the current condition.

            return label === undefined
                ? { x: Number.NaN, y: Number.NaN }
                : { x: label.x + label.width / 2, y: label.y + label.height / 2 };
        };

        const startLabel  = labelCenter ( 0.2 );
        const centerLabel = labelCenter ( 0.5 );
        const endLabel    = labelCenter ( 0.8 );

        expect ( startLabel.x ).toBeCloseTo ( 84 );
        expect ( startLabel.y ).toBeCloseTo ( 0 );
        expect ( centerLabel.x ).toBeCloseTo ( 150 );
        expect ( centerLabel.y ).toBeCloseTo ( 0 );
        expect ( endLabel.x ).toBeCloseTo ( 216 );
        expect ( endLabel.y ).toBeCloseTo ( 0 );
    } );

    it ( "measures Center against the clipped visible curve when endpoint widths differ", () =>
    {
        // Initialize the local values needed by this operation.

        const sourceState = { x: -100, y: -40, width: 200, height: 80 };
        const targetState = { x: 375, y: -40, width: 50, height: 80 };
        const relation    = createRequest ().relations [ 0 ]!;
        const result      = routeChartRelations ( {
            ...createRequest (),
            relations:
            [
                {
                    ...relation,
                    labelHeight: 10,
                    labelObstacles: [ sourceState, targetState ],
                    labelPosition: 0.5,
                    labelWidth: 20,
                    obstacles: [],
                    preferredPoints: [ { x: 0, y: 0 }, { x: 400, y: 0 } ],
                    sourceBoundary: { cornerRadius: 10, height: 80, kind: "rectangle", radius: 0, width: 200 },
                    targetBoundary: { cornerRadius: 10, height: 80, kind: "rectangle", radius: 0, width: 50 },
                },
            ],
        } );
        const label = result.relations [ 0 ]?.label;

        expect ( label === undefined ? Number.NaN : label.x + label.width / 2 ).toBeCloseTo ( 237.5 );
        expect ( label === undefined ? Number.NaN : label.y + label.height / 2 ).toBeCloseTo ( 0 );
    } );

    it ( "places a Center label on the rendered Bezier curve rather than its control polyline", () =>
    {
        // Initialize the local values needed by this operation.

        const relation = createRequest ().relations [ 0 ]!;
        const result   = routeChartRelations ( {
            ...createRequest (),
            relations:
            [
                {
                    ...relation,
                    labelObstacles: [],
                    labelPosition: 0.5,
                    obstacles: [],
                    preferredPoints: [ { x: 0, y: 0 }, { x: 100, y: 100 }, { x: 200, y: 0 } ],
                    preservePreferred: true,
                },
            ],
        } );
        const label = result.relations [ 0 ]?.label;

        expect ( label === undefined ? Number.NaN : label.x + label.width / 2 ).toBeCloseTo ( 100 );
        expect ( label === undefined ? Number.NaN : label.y + label.height / 2 ).toBeCloseTo ( 50 );
    } );

    it ( "places sequential labels without overlap", () =>
    {
        // Initialize the local values needed by this operation.

        const firstRelation                = createRequest ().relations [ 0 ]!;
        const request: ChartRoutingRequest = {
            ...createRequest (),
            relations:
            [
                firstRelation,
                { ...firstRelation, identifier: "transition:two", labelPosition: 0.52 },
            ],
        };
        const result      = routeChartRelations ( request );
        const firstLabel  = result.relations [ 0 ]?.label;
        const secondLabel = result.relations [ 1 ]?.label;

        expect ( firstLabel ).toBeDefined ();
        expect ( secondLabel ).toBeDefined ();
        expect ( firstLabel !== undefined && secondLabel !== undefined &&
            firstLabel.x < secondLabel.x + secondLabel.width && firstLabel.x + firstLabel.width > secondLabel.x &&
            firstLabel.y < secondLabel.y + secondLabel.height && firstLabel.y + firstLabel.height > secondLabel.y )
            .toBe ( false );

        result.relations.forEach ( ( relation, relationIndex ) =>
        {
            // Initialize the local values needed by this operation.

            const unrelatedLabel = result.relations [ relationIndex === 0 ? 1 : 0 ]?.label;

            // Handle the case where unrelated label matches undefined.

            if ( unrelatedLabel === undefined )
            {
                // Return control to the caller.

                return;
            }

            // Repeat the operation across the bounded iteration range.

            for ( let pointIndex = 1; pointIndex < relation.points.length; pointIndex += 1 )
            {
                // Initialize the local values needed by this operation.

                const source = relation.points [ pointIndex - 1 ];
                const target = relation.points [ pointIndex ];

                expect ( source === undefined || target === undefined
                    ? false
                    : segmentIntersectsRectangle ( source, target, unrelatedLabel ) ).toBe ( false );
            }
        } );
    } );

    it ( "preserves canonical relation order when accepting repaired labels", () =>
    {
        // Initialize the local values needed by this operation.

        const firstRelation  = createRequest ().relations [ 0 ]!;
        const secondRelation = { ...firstRelation, identifier: "transition:two" };
        const firstOnlyLabel = routeChartRelations ( {
            ...createRequest (),
            relations: [ firstRelation ],
        } ).relations [ 0 ]?.label;
        const forward = routeChartRelations ( {
            ...createRequest (),
            relations: [ firstRelation, secondRelation ],
        } );
        const reverse = routeChartRelations ( {
            ...createRequest (),
            relations: [ secondRelation, firstRelation ],
        } );

        expect ( forward.relations [ 0 ]?.identifier ).toBe ( "transition:one" );
        expect ( forward.relations [ 0 ]?.label ).toEqual ( firstOnlyLabel );
        expect ( forward.relations [ 1 ]?.label ).not.toEqual ( firstOnlyLabel );
        expect ( reverse.relations [ 0 ]?.identifier ).toBe ( "transition:two" );
        expect ( reverse.relations [ 0 ]?.label ).toEqual ( firstOnlyLabel );
        expect ( reverse.relations [ 1 ]?.label ).not.toEqual ( firstOnlyLabel );
    } );

    it ( "runs complete repair when a first-pass curve enters a foreign label clearance", () =>
    {
        // Initialize the local values needed by this operation.

        const relation      = createRequest ().relations [ 0 ]!;
        const labelledRoute = {
            ...relation,
            identifier: "transition:labelled-route",
            labelHeight: 20,
            labelObstacles: [],
            labelWidth: 20,
            obstacles: [],
            preferredPoints: [ { x: 0, y: 0 }, { x: 100, y: 0 } ],
            preservePreferred: true,
        };
        const nearbyRoute = {
            ...relation,
            identifier: "transition:nearby-route",
            labelHeight: 0,
            labelObstacles: [],
            labelWidth: 0,
            obstacles: [],
            preferredPoints: [ { x: 0, y: 15 }, { x: 100, y: 15 } ],
        };
        const performanceCounters = createChartRoutingPerformanceCounters ();
        const result              = routeChartRelations ( {
            ...createRequest (),
            relations: [ labelledRoute, nearbyRoute ],
        }, performanceCounters );

        expect ( result ).toEqual ( routeChartRelationsDenseReference ( {
            ...createRequest (),
            relations: [ labelledRoute, nearbyRoute ],
        } ) );
        expect ( performanceCounters.relationsRetainedCount ).toBe ( 1 );
        expect ( performanceCounters.relationsRepairedCount ).toBe ( 1 );
    } );

    it ( "keeps second-pass label clearance independent from increased gravity-point distance", () =>
    {
        // Initialize the local values needed by this operation.

        const labelledRelation = {
            identifier: "transition:labelled",
            labelHeight: 20,
            labelObstacles: [],
            labelPosition: 0.5,
            labelWidth: 20,
            obstacles: [],
            preferredPoints: [ { x: 0, y: 0 }, { x: 100, y: 0 } ],
            preservePreferred: true,
        };
        const nearbyRelation = {
            ...labelledRelation,
            identifier: "transition:nearby",
            labelHeight: 0,
            labelWidth: 0,
            preferredPoints: [ { x: 0, y: 28 }, { x: 100, y: 28 } ],
            preservePreferred: false,
        };
        const request: ChartRoutingRequest = {
            ...createRequest (),
            relations: [ labelledRelation, nearbyRelation ],
            transitionGravityPointDistance: 24,
        };
        const result       = routeChartRelations ( request );
        const nearbyResult = result.relations [ 1 ];

        expect ( result ).toEqual ( routeChartRelations ( request ) );
        expect ( result.relations [ 0 ]?.label ).toEqual ( { height: 20, width: 20, x: 40, y: -10 } );
        expect ( nearbyResult?.exteriorFallback ).toBe ( false );
        expect ( nearbyResult?.points ).toEqual ( [ { x: 0, y: 28 }, { x: 100, y: 28 } ] );
    } );

    it ( "uses a stable exterior lane when the visibility graph point bound is exceeded", () =>
    {
        // Initialize the local values needed by this operation.

        const obstacles = [
            ...Array.from ( { length: 70 }, ( _, index ) => ( {
                x: index * 20 + 20,
                y: index === 0 ? -10 : index * 7 - 100,
                width: 8,
                height: index === 0 ? 20 : 8,
            } ) ),
            { x: 2_000, y: 1_000, width: 8, height: 8 },
            { x: 2_032, y: 1_000, width: 8, height: 8 },
        ];
        const performanceCounters = createChartRoutingPerformanceCounters ();
        const result              = routeChartRelations ( createRequest ( obstacles ), performanceCounters );

        expect ( result.relations [ 0 ]?.exteriorFallback ).toBe ( true );
        expect ( result.relations [ 0 ]?.points.length ).toBeGreaterThanOrEqual ( 2 );
        expect ( result ).toEqual ( routeChartRelations ( createRequest ( obstacles ) ) );
        expect ( performanceCounters.denseCompatibilityFallbackCount ).toBeGreaterThan ( 0 );
        expect ( performanceCounters.relationsRetainedCount ).toBe ( 0 );
        expect ( performanceCounters.relationsRepairedCount ).toBe ( 1 );
    } );

    it ( "fits the rendered exterior fallback curve clear of an inflated obstacle", () =>
    {
        // Initialize the local values needed by this operation.

        const primaryObstacle = { x: 20, y: -50, width: 40, height: 60 };
        const obstacles       = [
            primaryObstacle,
            ...Array.from ( { length: 70 }, ( _, index ) => ( {
                x: 500 + index * 10,
                y: 100 + index * 10,
                width: 5,
                height: 5,
            } ) ),
            { x: 2_000, y: 1_000, width: 8, height: 8 },
            { x: 2_032, y: 1_000, width: 8, height: 8 },
        ];
        const request        = createRequest ( obstacles );
        const relation       = request.relations [ 0 ]!;
        const routingRequest = {
            ...request,
            relations:
            [
                {
                    ...relation,
                    labelHeight: 0,
                    labelObstacles: [],
                    labelWidth: 0,
                    preferredPoints: [ { x: 0, y: 0 }, { x: 400, y: 0 } ],
                },
            ],
        };
        const result                  = routeChartRelations ( routingRequest );
        const repeatedResult          = routeChartRelations ( routingRequest );
        const routedRelation          = result.relations [ 0 ];
        const inflatedPrimaryObstacle = { x: 8, y: -62, width: 64, height: 84 };

        expect ( result ).toEqual ( repeatedResult );
        expect ( routedRelation?.exteriorFallback ).toBe ( true );
        expect ( routedRelation?.points ).toHaveLength ( 4 );
        expect ( routedRelation?.points [ 1 ]?.y ).toBeLessThanOrEqual ( -86 );
        expect ( routedRelation?.points [ 2 ]?.y ).toBeCloseTo ( routedRelation?.points [ 1 ]?.y ?? Number.NaN );

        // Process each point from the cubic bezier curve sample points result collection in order.

        for ( const point of cubicBezierCurveSamplePoints ( routedRelation?.curves ?? [] ) )
        {
            expect ( point.x > inflatedPrimaryObstacle.x &&
                point.x < inflatedPrimaryObstacle.x + inflatedPrimaryObstacle.width &&
                point.y > inflatedPrimaryObstacle.y &&
                point.y < inflatedPrimaryObstacle.y + inflatedPrimaryObstacle.height ).toBe ( false );
        }
    } );

    it ( "validates bounded requests and worker results", () =>
    {
        // Initialize the local values needed by this operation.

        const request        = createRequest ();
        const boundedRequest = {
            ...request,
            relations:
            [
                {
                    ...request.relations [ 0 ]!,
                    sourceBoundary: { cornerRadius: 10, height: 80, kind: "rectangle" as const, radius: 0, width: 80 },
                    targetBoundary: { height: 32, kind: "circle" as const, radius: 16, width: 32 },
                },
            ],
        };
        const decoded = decodeChartRoutingWorkerRequest ( {
            generation: 1,
            kind: "route",
            protocolVersion: CHART_ROUTING_PROTOCOL_VERSION,
            request,
        } );
        const result = routeChartRelations ( request );

        const decodedBounded = decodeChartRoutingWorkerRequest ( {
            generation: 1,
            kind: "route",
            protocolVersion: CHART_ROUTING_PROTOCOL_VERSION,
            request: boundedRequest,
        } );

        expect ( decoded?.kind === "route" ? decoded.request : null ).toEqual ( request );
        expect ( decodedBounded?.kind === "route" ? decodedBounded.request : null ).toEqual ( boundedRequest );
        expect ( decodeChartRoutingWorkerRequest ( {
            generation: 1,
            kind: "route",
            protocolVersion: CHART_ROUTING_PROTOCOL_VERSION,
            request:
            {
                ...boundedRequest,
                relations: [ { ...boundedRequest.relations [ 0 ]!, targetBoundary: undefined } ],
            },
        } ) ).toBeNull ();
        expect ( decodeChartRoutingWorkerRequest ( {
            generation: 1,
            kind: "route",
            protocolVersion: CHART_ROUTING_PROTOCOL_VERSION,
            request: { ...request, relations: [ { ...request.relations [ 0 ], preferredPoints: [ { x: NaN, y: 0 } ] } ] },
        } ) ).toBeNull ();

        // Process each transition gravity point distance from the current value collection in
        // order.

        for ( const transitionGravityPointDistance of [ undefined, 0, 1.5, 201 ] )
        {
            expect ( decodeChartRoutingWorkerRequest ( {
                generation: 1,
                kind: "route",
                protocolVersion: CHART_ROUTING_PROTOCOL_VERSION,
                request: { ...request, transitionGravityPointDistance },
            } ) ).toBeNull ();
        }
        expect ( isChartRoutingWorkerResult ( {
            generation: 1,
            kind: "result",
            protocolVersion: CHART_ROUTING_PROTOCOL_VERSION,
            result,
        } ) ).toBe ( true );
    } );

    it ( "detours a stacked relation around the intervening state at the shipped default gravity", () =>
    {
        // Initialize the local values needed by this operation.

        const stackedStates = [ -160, 80, 320 ].map ( verticalOrigin => ( {
            height: 62,
            width:  268,
            x:      660,
            y:      verticalOrigin,
        } ) );
        const blockingState                = stackedStates [ 1 ]!;
        const sourceCenter                 = { x: 794, y: -129 };
        const targetCenter                 = { x: 794, y: 351 };
        const request: ChartRoutingRequest = {
            documentRevision: 1,
            geometryRevision: 1,
            preferenceRevision: 1,
            requestId: "stacked-detour",
            transitionGravityPointDistance: 100,
            relations:
            [
                {
                    identifier:        "transition:A:x:C",
                    labelHeight:       22,
                    labelObstacles:    [ blockingState ],
                    labelPosition:     0.5,
                    labelWidth:        70,
                    obstacles:         [ blockingState ],
                    preferredPoints:   [ sourceCenter, targetCenter ],
                    preservePreferred: false,
                },
            ],
        };
        const relation = routeChartRelations ( request ).relations [ 0 ];

        expect ( relation ).toBeDefined ();
        expect ( relation?.points.length ).toBeGreaterThan ( 2 );
        expect ( relation?.exteriorFallback ).toBe ( false );

        // Initialize the local values needed by this operation.

        const samples         = cubicBezierCurveSamplePoints ( relation?.curves ?? [] );
        const crossingSamples = samples.filter ( sample => sample.x > blockingState.x &&
            sample.x < blockingState.x + blockingState.width && sample.y > blockingState.y &&
            sample.y < blockingState.y + blockingState.height );

        expect ( crossingSamples ).toHaveLength ( 0 );

        // The excursion must stay proportional to the field being avoided rather than growing with
        // the preference.

        const horizontalExcursion = Math.max (
            ...samples.map ( sample => Math.abs ( sample.x - sourceCenter.x ) ),
        );

        expect ( horizontalExcursion ).toBeLessThan ( blockingState.width * 2 );
    } );

    it ( "keeps the stacked detour clear and bounded across the full gravity preference range", () =>
    {
        // Initialize the local values needed by this operation.

        const blockingState = { height: 62, width: 268, x: 660, y: 80 };
        const sourceCenter  = { x: 794, y: -129 };
        const targetCenter  = { x: 794, y: 351 };

        [ 1, 12, 50, 100, 150, 200 ].forEach ( transitionGravityPointDistance =>
        {
            // Initialize the local values needed by this operation.

            const relation = routeChartRelations ( {
                documentRevision: 1,
                geometryRevision: 1,
                preferenceRevision: 1,
                requestId: `stacked-gravity-${transitionGravityPointDistance}`,
                transitionGravityPointDistance,
                relations:
                [
                    {
                        identifier:        "transition:A:x:C",
                        labelHeight:       22,
                        labelObstacles:    [ blockingState ],
                        labelPosition:     0.5,
                        labelWidth:        70,
                        obstacles:         [ blockingState ],
                        preferredPoints:   [ sourceCenter, targetCenter ],
                        preservePreferred: false,
                    },
                ],
            } ).relations [ 0 ];
            const samples         = cubicBezierCurveSamplePoints ( relation?.curves ?? [] );
            const crossingSamples = samples.filter ( sample => sample.x > blockingState.x &&
                sample.x < blockingState.x + blockingState.width && sample.y > blockingState.y &&
                sample.y < blockingState.y + blockingState.height );
            const excursion = Math.max ( ...samples.map ( sample => Math.abs ( sample.x - sourceCenter.x ) ) );

            expect ( relation?.points.length ).toBeGreaterThan ( 2 );
            expect ( crossingSamples ).toHaveLength ( 0 );
            expect ( excursion ).toBeLessThan ( 3 * blockingState.width );
        } );
    } );
} );

describe ( "AL-UI-032 obstacles that enclose a route endpoint", () =>
{
    // buildVisibilityGraph discards every lattice point lying inside an obstacle. An obstacle
    // enclosing a relation's own source or target therefore removed that endpoint, returned a null
    // graph, and produced a dashed exterior fallback that nothing downstream could recover, because
    // the search never ran. The router now excludes such an obstacle for that relation only.

    //----------------------------------------------------------------------------------------------
    // Function: requestWithObstacle
    //
    // Description:
    //
    //   Requests the with obstacle.
    //
    // Parameters:
    //
    //   - obstacle:
    //     The obstacle supplied to the operation.
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

    function requestWithObstacle ( obstacle: ChartRoutingRectangle ): ChartRoutingRequest
    {
        // Return the assembled result.

        return {
            documentRevision:   7,
            geometryRevision:   7,
            preferenceRevision: 3,
            requestId:          "endpoint-capture",
            transitionGravityPointDistance: 100,
            relations:
            [
                {
                    identifier:        "transition:captured",
                    labelHeight:       22,
                    labelObstacles:    [],
                    labelPosition:     0.5,
                    labelWidth:        70,
                    obstacles:         [ obstacle ],
                    preferredPoints:   [ { x: 0, y: 0 }, { x: 600, y: 0 } ],
                    preservePreferred: false,
                },
            ],
        };
    }

    it ( "routes solid when an obstacle strictly contains the target endpoint", () =>
    {
        // Initialize the local values needed by this operation.

        const result = routeChartRelations ( requestWithObstacle (
            { height: 400, width: 400, x: 400, y: -200 },
        ) );
        const relation = result.relations [ 0 ];

        expect ( relation?.exteriorFallback ).toBe ( false );
        expect ( relation?.points.length ).toBeGreaterThanOrEqual ( 2 );
    } );

    it ( "routes solid when an obstacle strictly contains the source endpoint", () =>
    {
        // Initialize the local values needed by this operation.

        const result = routeChartRelations ( requestWithObstacle (
            { height: 400, width: 400, x: -200, y: -200 },
        ) );

        expect ( result.relations [ 0 ]?.exteriorFallback ).toBe ( false );
    } );

    it ( "still honours an obstacle that encloses neither endpoint", () =>
    {
        // Initialize the local values needed by this operation.

        const result = routeChartRelations ( requestWithObstacle (
            { height: 120, width: 120, x: 240, y: -60 },
        ) );
        const relation = result.relations [ 0 ];

        // The obstacle stands between the endpoints, so the route must detour around it rather than
        // ignore it.

        expect ( relation?.exteriorFallback ).toBe ( false );
        expect ( relation?.points.length ).toBeGreaterThan ( 2 );
    } );
} );
