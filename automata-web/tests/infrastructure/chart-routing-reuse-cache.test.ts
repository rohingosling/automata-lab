// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Chart Routing Reuse Cache Tests
// Version: 1.0.0
// Date:    2026-08-22
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies exact cache signatures, query-local endpoint attachment, bounded eviction, disposal,
//   and cold/warm result equivalence for Chart routing visibility profiles and cubic-clearance
//   proofs.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from "vitest";

import type
{
    ChartRoutingPoint,
    ChartRoutingRectangle,
    ChartRoutingRequest,
} from "../../src/application/ports/contracts.js";
import { createChartRoutingPerformanceCounters } from
    "../../src/application/chart-routing-performance.js";
import
{
    ChartRoutingReuseCache,
    routeChartRelations,
} from "../../src/infrastructure/chart/orthogonal-chart-router.js";

const SOURCE    = { x: 0, y: 0 };
const TARGET    = { x: 800, y: 0 };
const OBSTACLES = [
    { x: 180, y: -120, width: 60, height: 180 },
    { x: 360, y: -20, width: 60, height: 180 },
    { x: 540, y: -120, width: 60, height: 180 },
];

//--------------------------------------------------------------------------------------------------
// Function: requestForGeometry
//
// Description:
//
//   Requests the for geometry.
//
// Parameters:
//
//   - obstacles:
//     The obstacles supplied to the operation.
//
//   - target:
//     The target supplied to the operation.
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

function requestForGeometry (
    obstacles: readonly ChartRoutingRectangle[],
    target: ChartRoutingPoint = TARGET,
    transitionGravityPointDistance = 100,
): ChartRoutingRequest
{
    // Return the assembled result.

    return {
        documentRevision: 1,
        geometryRevision: 1,
        preferenceRevision: 1,
        relations:
        [
            {
                identifier: "transition:cache",
                labelHeight: 20,
                labelObstacles: obstacles,
                labelPosition: 0.5,
                labelWidth: 80,
                obstacles,
                preferredPoints: [ SOURCE, target ],
                preservePreferred: false,
            },
        ],
        requestId: "reuse-cache",
        transitionGravityPointDistance,
    };
}

describe ( "Chart routing exact reuse cache", () =>
{
    it ( "returns byte-identical cold and warm results with graph and proof hits", () =>
    {
        // Initialize the local values needed by this operation.

        const request      = requestForGeometry ( OBSTACLES );
        const reuseCache   = new ChartRoutingReuseCache ();
        const coldCounters = createChartRoutingPerformanceCounters ();
        const warmCounters = createChartRoutingPerformanceCounters ();
        const cold         = routeChartRelations ( request, coldCounters, reuseCache );
        const warm         = routeChartRelations ( request, warmCounters, reuseCache );

        expect ( warm ).toEqual ( cold );
        expect ( coldCounters.graphCacheMissCount ).toBeGreaterThan ( 0 );
        expect ( coldCounters.memoizationMissCount ).toBeGreaterThan ( 0 );
        expect ( warmCounters.graphCacheHitCount ).toBeGreaterThan ( 0 );
        expect ( warmCounters.memoizationHitCount ).toBeGreaterThan ( 0 );
        expect ( warmCounters.recursiveProofCallCount ).toBeLessThan ( coldCounters.recursiveProofCallCount );
    } );

    it ( "keeps endpoints and revisions query-local while exact geometry, membership, and clearance changes miss", () =>
    {
        // Initialize the local values needed by this operation.

        const reuseCache = new ChartRoutingReuseCache ();

        routeChartRelations ( requestForGeometry ( OBSTACLES ), undefined, reuseCache );

        // Initialize the local values needed by this operation.

        const endpointCounters = createChartRoutingPerformanceCounters ();
        const endpointResult   = routeChartRelations (
            requestForGeometry ( OBSTACLES, { x: TARGET.x, y: 20 } ),
            endpointCounters,
            reuseCache,
        );
        const revisionCounters = createChartRoutingPerformanceCounters ();
        const revisionRequest  = {
            ...requestForGeometry ( OBSTACLES ),
            documentRevision:   99,
            geometryRevision:   99,
            preferenceRevision: 99,
            requestId:          "reuse-cache-revision-only",
        };
        const revisionResult    = routeChartRelations ( revisionRequest, revisionCounters, reuseCache );
        const clearanceCounters = createChartRoutingPerformanceCounters ();
        const clearanceResult   = routeChartRelations (
            requestForGeometry ( OBSTACLES, TARGET, 101 ),
            clearanceCounters,
            reuseCache,
        );
        const geometryCounters = createChartRoutingPerformanceCounters ();
        const changedObstacles = [
            { ...OBSTACLES [ 0 ]!, x: OBSTACLES [ 0 ]!.x + 1 },
            ...OBSTACLES.slice ( 1 ),
        ];
        const geometryResult = routeChartRelations (
            requestForGeometry ( changedObstacles ),
            geometryCounters,
            reuseCache,
        );
        const membershipCounters         = createChartRoutingPerformanceCounters ();
        const changedMembershipObstacles = [
            ...OBSTACLES,
            { x: 700, y: 300, width: 20, height: 20 },
        ];
        const membershipResult = routeChartRelations (
            requestForGeometry ( changedMembershipObstacles ),
            membershipCounters,
            reuseCache,
        );

        expect ( endpointResult ).toEqual ( routeChartRelations (
            requestForGeometry ( OBSTACLES, { x: TARGET.x, y: 20 } ),
        ) );
        expect ( revisionResult ).toEqual ( routeChartRelations ( revisionRequest ) );
        expect ( clearanceResult ).toEqual ( routeChartRelations ( requestForGeometry ( OBSTACLES, TARGET, 101 ) ) );
        expect ( geometryResult ).toEqual ( routeChartRelations ( requestForGeometry ( changedObstacles ) ) );
        expect ( membershipResult ).toEqual ( routeChartRelations (
            requestForGeometry ( changedMembershipObstacles ),
        ) );
        expect ( endpointCounters.graphCacheHitCount ).toBeGreaterThan ( 0 );
        expect ( revisionCounters.graphCacheHitCount ).toBeGreaterThan ( 0 );
        expect ( clearanceCounters.graphCacheMissCount ).toBeGreaterThan ( 0 );
        expect ( geometryCounters.graphCacheMissCount ).toBeGreaterThan ( 0 );
        expect ( membershipCounters.graphCacheMissCount ).toBeGreaterThan ( 0 );
    } );

    it ( "uses canonical obstacle order without sharing a stale routed result", () =>
    {
        // Initialize the local values needed by this operation.

        const reuseCache      = new ChartRoutingReuseCache ();
        const forwardRequest  = requestForGeometry ( OBSTACLES );
        const reverseRequest  = requestForGeometry ( [ ...OBSTACLES ].reverse () );
        const forward         = routeChartRelations ( forwardRequest, undefined, reuseCache );
        const reverseCounters = createChartRoutingPerformanceCounters ();
        const reverse         = routeChartRelations ( reverseRequest, reverseCounters, reuseCache );

        expect ( reverse ).toEqual ( forward );
        expect ( reverseCounters.graphCacheHitCount ).toBeGreaterThan ( 0 );
    } );

    it ( "bounds least-recently-used entries, evicts deterministically, and clears on disposal", () =>
    {
        // Initialize the local values needed by this operation.

        const reuseCache       = new ChartRoutingReuseCache ( 2, 8 );
        const evictionCounters = createChartRoutingPerformanceCounters ();

        // Repeat the operation across the bounded iteration range.

        for ( let profileIndex = 0; profileIndex < 4; profileIndex += 1 )
        {
            // Calculate the obstacles value from the current inputs.

            const obstacles = OBSTACLES.map ( obstacle => ( {
                ...obstacle,
                x: obstacle.x + profileIndex,
            } ) );

            routeChartRelations ( requestForGeometry ( obstacles ), evictionCounters, reuseCache );
        }

        expect ( reuseCache.graphProfileCount ).toBeLessThanOrEqual ( reuseCache.graphProfileCapacity );
        expect ( reuseCache.curveProofCount ).toBeLessThanOrEqual ( reuseCache.curveProofCapacity );
        expect ( evictionCounters.graphCacheEvictionCount ).toBeGreaterThan ( 0 );
        expect ( evictionCounters.memoizationEvictionCount ).toBeGreaterThan ( 0 );

        const evictedProfileCounters = createChartRoutingPerformanceCounters ();

        routeChartRelations ( requestForGeometry ( OBSTACLES ), evictedProfileCounters, reuseCache );
        expect ( evictedProfileCounters.graphCacheMissCount ).toBeGreaterThan ( 0 );

        reuseCache.clear ();
        expect ( reuseCache.graphProfileCount ).toBe ( 0 );
        expect ( reuseCache.curveProofCount ).toBe ( 0 );
        expect ( reuseCache.sampledCurveLengthCount ).toBe ( 0 );

        const disposedCounters = createChartRoutingPerformanceCounters ();

        routeChartRelations ( requestForGeometry ( OBSTACLES ), disposedCounters, reuseCache );
        expect ( disposedCounters.graphCacheMissCount ).toBeGreaterThan ( 0 );
        expect ( disposedCounters.memoizationMissCount ).toBeGreaterThan ( 0 );
    } );
} );
