// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Chart Routing Performance Counters
// Version: 1.1.0
// Date:    2026-08-22
// Author:  Rohin Gosling
//
// Description:
//
//   Defines request-local diagnostic counters for the opt-in Chart routing benchmark. Production
//   compilation disables and removes their recording branches; the counters do not enter the Worker
//   protocol, application settings, route selection, persistence, or runtime diagnostics.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

//--------------------------------------------------------------------------------------------------
// Interface: ChartRoutingPerformanceCounters
//
// Description:
//
//   Defines the structure of chart routing performance counters.
//
//--------------------------------------------------------------------------------------------------

export interface ChartRoutingPerformanceCounters
{
    acceptedRouteSegmentCandidateCount: number;
    aStarExpandedStateCount:             number;
    broadPhaseCandidateCount:            number;
    clearanceRetryCount:                 number;
    cubicCandidateCount:                 number;
    curveFitMilliseconds:                number;
    denseCompatibilityFallbackCount:     number;
    denseGraphBuildCount:                number;
    exactCrossingTestCount:               number;
    exactLabelTestCount:                  number;
    exactObstacleTestCount:               number;
    fallbackCount:                        number;
    graphBuildCount:                      number;
    graphCacheEvictionCount:              number;
    graphCacheHitCount:                   number;
    graphCacheMissCount:                  number;
    graphEdgeCount:                       number;
    graphVertexCount:                     number;
    heapOperationCount:                   number;
    labelCandidateCount:                  number;
    labelPlacementMilliseconds:           number;
    memoizationHitCount:                  number;
    memoizationEvictionCount:             number;
    memoizationMissCount:                 number;
    passOneMilliseconds:                  number;
    passTwoMilliseconds:                  number;
    recursiveProofCallCount:              number;
    relationCount:                        number;
    relationsRepairedCount:               number;
    relationsRetainedCount:               number;
    repairEligibilityMilliseconds:        number;
    sceneIndexBuildMilliseconds:           number;
    sparseGraphBuildCount:                 number;
    totalRequestMilliseconds:             number;
}

//--------------------------------------------------------------------------------------------------
// Function: createChartRoutingPerformanceCounters
//
// Description:
//
//   Creates chart routing performance counters.
//
// Parameters:
//
//   None.
//
// Returns:
//
//   The value produced by the operation.
//
// Preconditions:
//
//   - None.
//
// Postconditions:
//
//   - The returned value represents the result described above.
//
//--------------------------------------------------------------------------------------------------

export function createChartRoutingPerformanceCounters (): ChartRoutingPerformanceCounters
{
    // Return the assembled result.

    return {
        acceptedRouteSegmentCandidateCount: 0,
        aStarExpandedStateCount:            0,
        broadPhaseCandidateCount:           0,
        clearanceRetryCount:                0,
        cubicCandidateCount:                0,
        curveFitMilliseconds:               0,
        denseCompatibilityFallbackCount:    0,
        denseGraphBuildCount:               0,
        exactCrossingTestCount:             0,
        exactLabelTestCount:                0,
        exactObstacleTestCount:             0,
        fallbackCount:                      0,
        graphBuildCount:                    0,
        graphCacheEvictionCount:            0,
        graphCacheHitCount:                 0,
        graphCacheMissCount:                0,
        graphEdgeCount:                     0,
        graphVertexCount:                   0,
        heapOperationCount:                 0,
        labelCandidateCount:                0,
        labelPlacementMilliseconds:         0,
        memoizationHitCount:                0,
        memoizationEvictionCount:           0,
        memoizationMissCount:               0,
        passOneMilliseconds:                0,
        passTwoMilliseconds:                0,
        recursiveProofCallCount:            0,
        relationCount:                      0,
        relationsRepairedCount:             0,
        relationsRetainedCount:             0,
        repairEligibilityMilliseconds:      0,
        sceneIndexBuildMilliseconds:        0,
        sparseGraphBuildCount:              0,
        totalRequestMilliseconds:           0,
    };
}
