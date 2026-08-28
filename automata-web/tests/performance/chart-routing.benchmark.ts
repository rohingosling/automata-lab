// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Chart Routing Performance Benchmark
// Version: 1.1.0
// Date:    2026-08-22
// Author:  Rohin Gosling
//
// Description:
//
//   Records the current exact Chart router's deterministic correctness signatures, dense-oracle
//   quality comparisons, repeated timing distributions, and request-local work counters. The
//   benchmark is opt-in and is not discovered by ordinary Vitest commands.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { cpus, release as operatingSystemRelease, totalmem as totalMemory } from "node:os";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { AutomataDocument } from "../../src/domain/model/contracts.js";
import type
{
    ChartRoutingPoint,
    ChartRoutingRectangle,
    ChartRoutingRelation,
    ChartRoutingRequest,
    ChartRoutingResult,
} from "../../src/application/ports/contracts.js";
import
{
    createChartRoutingPerformanceCounters,
} from "../../src/application/chart-routing-performance.js";
import type { ChartRoutingPerformanceCounters } from
    "../../src/application/chart-routing-performance.js";
import { openAutomataDocument } from "../../src/infrastructure/files/file-codec.js";
import
{
    ChartRoutingReuseCache,
    routeChartRelations,
    routeChartRelationsDenseReference,
    routeChartRelationsSparseReference,
} from "../../src/infrastructure/chart/orthogonal-chart-router.js";
import { createAuthoringChartProjection } from "../../src/presentation/chart/chart-projection.js";
import { wrapChartName } from "../../src/presentation/chart/chart-name-wrapping.js";

const PACKAGE_ROOT      = resolve ( dirname ( fileURLToPath ( import.meta.url ) ), "../.." );
const FNB_FIXTURE_PATH  = resolve ( PACKAGE_ROOT, "../examples/test-1/fnb-etc-delivery-tracking-1.json" );
const WARMUP_COUNT      = 10;
const SAMPLE_COUNT      = 100;
const INDICATOR_SIZE    = 42;
const ROUTING_CLEARANCE = 100;

//--------------------------------------------------------------------------------------------------
// Interface: BenchmarkScenario
//
// Description:
//
//   Defines the structure of benchmark scenario.
//
//--------------------------------------------------------------------------------------------------

interface BenchmarkScenario
{
    readonly expectedRelationCount: number;
    readonly expectedSignature:     string;
    readonly name:                  string;
    readonly request:               ChartRoutingRequest;
}

//--------------------------------------------------------------------------------------------------
// Interface: MeasuredRouting
//
// Description:
//
//   Defines the structure of measured routing.
//
//--------------------------------------------------------------------------------------------------

interface MeasuredRouting
{
    readonly completeMilliseconds: number;
    readonly counters:             ChartRoutingPerformanceCounters;
    readonly signature:            string;
}

const EXPECTED_SIGNATURES: Readonly<Record<string, string>> =
{
    "simple-direct":          "sha256:92c06bceb91e394bb467e960c1b80f2165f08f467f41f4e216d2225185b68c6a",
    "one-bend":               "sha256:755ffcdab0d580ed614fecf53f9173a04cf04076740f3a421072648ad6c03ddd",
    "fnb-maintained-fixture": "sha256:a58fb838b73b4dc99b4f7df03c7c2c120fd0fcfcc24c5a31a49ea1537a659a76",
    "synthetic-long-maze":    "sha256:7ac364ace03b8780133efab5268c1f5a46c075a800504b403587bce09aaae772",
    "dense-two-pass":         "sha256:c14fc67b7af764691a89ddd79123391af878a6dd0ac5591aba6782907f2dc389",
};

//--------------------------------------------------------------------------------------------------
// Function: nearestRankPercentile
//
// Description:
//
//   Derives the nearest rank percentile.
//
// Parameters:
//
//   - values:
//     The values supplied to the operation.
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

function nearestRankPercentile ( values: readonly number[], fraction: number ): number
{
    // Initialize the local values needed by this operation.

    const sortedValues = [ ...values ].sort ( ( left, right ) => left - right );
    const index        = Math.max ( 0, Math.ceil ( sortedValues.length * fraction ) - 1 );
    const value        = sortedValues [ index ];

    // Handle the case where value matches undefined.

    if ( value === undefined )
    {
        throw new Error ( "A benchmark percentile requires at least one sample." );
    }

    // Return the value.

    return value;
}

//--------------------------------------------------------------------------------------------------
// Function: roundedMilliseconds
//
// Description:
//
//   Derives the rounded milliseconds.
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

function roundedMilliseconds ( value: number ): number
{
    // Return the number result.

    return Number ( value.toFixed ( 3 ) );
}

//--------------------------------------------------------------------------------------------------
// Function: resultSignature
//
// Description:
//
//   Derives the result signature.
//
// Parameters:
//
//   - result:
//     The result supplied to the operation.
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

function resultSignature ( result: ChartRoutingResult ): string
{
    // Return the computed result.

    return `sha256:${createHash ( "sha256" ).update ( JSON.stringify ( result ), "utf8" ).digest ( "hex" )}`;
}

//--------------------------------------------------------------------------------------------------
// Function: routeBendCount
//
// Description:
//
//   Routes the bend count.
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

function routeBendCount ( points: readonly ChartRoutingPoint[] ): number
{
    // Initialize the local values needed by this operation.

    let bendCount                                           = 0;
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

        const direction = source.x === target.x ? "vertical" : "horizontal";

        // Handle the case where all required conditions are satisfied.

        if ( previousDirection !== null && previousDirection !== direction )
        {
            bendCount += 1;
        }

        previousDirection = direction;
    }

    // Return the bend count.

    return bendCount;
}

//--------------------------------------------------------------------------------------------------
// Function: routeManhattanLength
//
// Description:
//
//   Routes the manhattan length.
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

function routeManhattanLength ( points: readonly ChartRoutingPoint[] ): number
{
    // Return the reduce result.

    return points.slice ( 1 ).reduce ( ( length, target, pointIndex ) =>
    {
        // Initialize the local values needed by this operation.

        const source = points [ pointIndex ] ?? target;

        // Return the computed result.

        return length + Math.abs ( target.x - source.x ) + Math.abs ( target.y - source.y );
    }, 0 );
}

//--------------------------------------------------------------------------------------------------
// Function: crossProduct
//
// Description:
//
//   Derives the cross product.
//
// Parameters:
//
//   - first:
//     The first supplied to the operation.
//
//   - second:
//     The second supplied to the operation.
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

function crossProduct ( first: ChartRoutingPoint, second: ChartRoutingPoint ): number
{
    // Return the computed result.

    return first.x * second.y - first.y * second.x;
}

//--------------------------------------------------------------------------------------------------
// Function: segmentsProperlyCross
//
// Description:
//
//   Derives the segments properly cross.
//
// Parameters:
//
//   - firstSource:
//     The first source supplied to the operation.
//
//   - firstTarget:
//     The first target supplied to the operation.
//
//   - secondSource:
//     The second source supplied to the operation.
//
//   - secondTarget:
//     The second target supplied to the operation.
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

function segmentsProperlyCross (
    firstSource: ChartRoutingPoint,
    firstTarget: ChartRoutingPoint,
    secondSource: ChartRoutingPoint,
    secondTarget: ChartRoutingPoint,
): boolean
{
    // Initialize the local values needed by this operation.

    const firstDirection = {
        x: firstTarget.x - firstSource.x,
        y: firstTarget.y - firstSource.y,
    };
    const secondDirection = {
        x: secondTarget.x - secondSource.x,
        y: secondTarget.y - secondSource.y,
    };
    const sourceDifference = {
        x: secondSource.x - firstSource.x,
        y: secondSource.y - firstSource.y,
    };
    const denominator = crossProduct ( firstDirection, secondDirection );

    // Handle the case where abs result does not exceed 0.000001.

    if ( Math.abs ( denominator ) <= 0.000001 )
    {
        // Return the computed result.

        return false;
    }

    // Initialize the local values needed by this operation.

    const firstPosition  = crossProduct ( sourceDifference, secondDirection ) / denominator;
    const secondPosition = crossProduct ( sourceDifference, firstDirection ) / denominator;

    // Return the computed result.

    return firstPosition > 0.000001 && firstPosition < 0.999999 &&
        secondPosition > 0.000001 && secondPosition < 0.999999;
}

//--------------------------------------------------------------------------------------------------
// Function: resultQualitySnapshot
//
// Description:
//
//   Derives the result quality snapshot.
//
// Parameters:
//
//   - result:
//     The result supplied to the operation.
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

function resultQualitySnapshot ( result: ChartRoutingResult )
{
    //----------------------------------------------------------------------------------------------
    // Function: crossingCount
    //
    // Description:
    //
    //   Derives the crossing count.
    //
    // Parameters:
    //
    //   - relationIndex:
    //     The relation index supplied to the operation.
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

    const crossingCount = ( relationIndex: number ): number =>
    {
        // Initialize the local values needed by this operation.

        const relation = result.relations [ relationIndex ];

        // Handle the case where relation matches undefined.

        if ( relation === undefined )
        {
            // Return the computed result.

            return 0;
        }

        // Return the reduce result.

        return relation.points.slice ( 1 ).reduce ( ( count, target, pointIndex ) =>
        {
            // Initialize the local values needed by this operation.

            const source = relation.points [ pointIndex ];

            // Handle the case where source matches undefined.

            if ( source === undefined )
            {
                // Return the count.

                return count;
            }

            // Return the computed result.

            return count + result.relations.reduce ( ( relationCount, candidate, candidateIndex ) =>
            {
                // Handle the case where candidate index matches relation index.

                if ( candidateIndex === relationIndex )
                {
                    // Return the relation count.

                    return relationCount;
                }

                // Return the computed result.

                return relationCount + candidate.points.slice ( 1 ).filter ( ( candidateTarget, candidatePointIndex ) =>
                {
                    // Initialize the local values needed by this operation.

                    const candidateSource = candidate.points [ candidatePointIndex ];

                    // Return the computed result.

                    return candidateSource !== undefined && segmentsProperlyCross (
                        source,
                        target,
                        candidateSource,
                        candidateTarget,
                    );
                } ).length;
            }, 0 );
        }, 0 );
    };

    // Return the mapped collection.

    return result.relations.map ( ( relation, relationIndex ) => ( {
        bendCount: routeBendCount ( relation.points ),
        crossingCount: crossingCount ( relationIndex ),
        exteriorFallback: relation.exteriorFallback,
        identifier: relation.identifier,
        manhattanLength: routeManhattanLength ( relation.points ),
    } ) );
}

//--------------------------------------------------------------------------------------------------
// Function: expectSparseQualityMatchesOrImprovesDense
//
// Description:
//
//   Verifies sparse quality matches or improves dense and reports a failure when it is invalid.
//
// Parameters:
//
//   - scenarioName:
//     The scenario name supplied to the operation.
//
//   - sparseResult:
//     The sparse result supplied to the operation.
//
//   - denseResult:
//     The dense result supplied to the operation.
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

function expectSparseQualityMatchesOrImprovesDense (
    scenarioName: string,
    sparseResult: ChartRoutingResult,
    denseResult: ChartRoutingResult,
): void
{
    // Initialize the local values needed by this operation.

    const sparseQuality = resultQualitySnapshot ( sparseResult );
    const denseQuality  = resultQualitySnapshot ( denseResult );

    expect ( sparseQuality ).toHaveLength ( denseQuality.length );
    sparseQuality.forEach ( ( sparseRelation, relationIndex ) =>
    {
        // Initialize the local values needed by this operation.

        const denseRelation = denseQuality [ relationIndex ];

        expect ( denseRelation, `${scenarioName} dense relation ${relationIndex}` ).toBeDefined ();

        // Handle the case where dense relation matches undefined.

        if ( denseRelation === undefined )
        {
            // Return control to the caller.

            return;
        }

        expect ( sparseRelation.identifier ).toBe ( denseRelation.identifier );
        expect ( sparseRelation.manhattanLength, `${scenarioName} relation ${relationIndex} length` )
            .toBe ( denseRelation.manhattanLength );
        expect ( sparseRelation.bendCount, `${scenarioName} relation ${relationIndex} bends` )
            .toBeLessThanOrEqual ( denseRelation.bendCount );
        expect ( sparseRelation.crossingCount, `${scenarioName} relation ${relationIndex} crossings` )
            .toBeLessThanOrEqual ( denseRelation.crossingCount );
        expect ( sparseRelation.exteriorFallback, `${scenarioName} relation ${relationIndex} fallback` )
            .toBe ( denseRelation.exteriorFallback );
    } );
}

//--------------------------------------------------------------------------------------------------
// Function: measuredRouting
//
// Description:
//
//   Derives the measured routing.
//
// Parameters:
//
//   - request:
//     The request supplied to the operation.
//
//   - reuseCache:
//     The reuse cache supplied to the operation.
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

function measuredRouting (
    request: ChartRoutingRequest,
    reuseCache?: ChartRoutingReuseCache,
): MeasuredRouting
{
    // Initialize the local values needed by this operation.

    const startMilliseconds       = performance.now ();
    const uninstrumentedResult    = routeChartRelations ( request, undefined, reuseCache );
    const completeMilliseconds    = performance.now () - startMilliseconds;
    const counters                = createChartRoutingPerformanceCounters ();
    const instrumentedResult      = routeChartRelations ( request, counters, reuseCache );
    const uninstrumentedSignature = resultSignature ( uninstrumentedResult );
    const instrumentedSignature   = resultSignature ( instrumentedResult );

    // Handle the case where instrumented signature differs from uninstrumented signature.

    if ( instrumentedSignature !== uninstrumentedSignature )
    {
        throw new Error ( "Instrumented Chart routing changed the benchmark result." );
    }

    // Return the assembled result.

    return { completeMilliseconds, counters, signature: uninstrumentedSignature };
}

//--------------------------------------------------------------------------------------------------
// Function: rectangleCenter
//
// Description:
//
//   Derives the rectangle center.
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

function rectangleCenter ( rectangle: ChartRoutingRectangle ): ChartRoutingPoint
{
    // Return the assembled result.

    return {
        x: rectangle.x + rectangle.width / 2,
        y: rectangle.y + rectangle.height / 2,
    };
}

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

function transitionLabelSize ( label: string ):
{
    readonly labelHeight: number;
    readonly labelWidth:  number;
}
{
    // Initialize the local values needed by this operation.

    const lines = label.split ( "\n" );

    // Return the assembled result.

    return {
        labelHeight: label.length === 0 ? 0 : Math.max ( 22, lines.length * 16 + 6 ),
        labelWidth:  label.length === 0 ? 0 : Math.max ( 28, ...lines.map ( line => line.length * 7 + 12 ) ),
    };
}

//--------------------------------------------------------------------------------------------------
// Function: ordinaryRelation
//
// Description:
//
//   Derives the ordinary relation.
//
// Parameters:
//
//   - identifier:
//     The identifier supplied to the operation.
//
//   - source:
//     The source supplied to the operation.
//
//   - target:
//     The target supplied to the operation.
//
//   - obstacles:
//     The obstacles supplied to the operation.
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

function ordinaryRelation (
    identifier: string,
    source: ChartRoutingPoint,
    target: ChartRoutingPoint,
    obstacles: readonly ChartRoutingRectangle[],
    label = identifier,
): ChartRoutingRelation
{
    // Initialize the local values needed by this operation.

    const { labelHeight, labelWidth } = transitionLabelSize ( label );

    // Return the assembled result.

    return {
        identifier,
        labelHeight,
        labelObstacles: obstacles,
        labelPosition: 0.5,
        labelWidth,
        obstacles,
        preferredPoints: [ source, target ],
        preservePreferred: false,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: requestForRelations
//
// Description:
//
//   Requests the for relations.
//
// Parameters:
//
//   - requestId:
//     The request identifier supplied to the operation.
//
//   - relations:
//     The relations supplied to the operation.
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

function requestForRelations ( requestId: string, relations: readonly ChartRoutingRelation[] ): ChartRoutingRequest
{
    // Return the assembled result.

    return {
        documentRevision: 1,
        geometryRevision: 1,
        preferenceRevision: 1,
        relations,
        requestId,
        transitionGravityPointDistance: ROUTING_CLEARANCE,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: relationPairIdentifier
//
// Description:
//
//   Derives the relation pair identifier.
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

function relationPairIdentifier ( source: string, target: string ): string
{
    // Return the stringify result.

    return JSON.stringify ( [ source, target ].sort () );
}

//--------------------------------------------------------------------------------------------------
// Function: preservedLanePoints
//
// Description:
//
//   Derives the preserved lane points.
//
// Parameters:
//
//   - source:
//     The source supplied to the operation.
//
//   - target:
//     The target supplied to the operation.
//
//   - lanePosition:
//     The lane position supplied to the operation.
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

function preservedLanePoints (
    source: ChartRoutingPoint,
    target: ChartRoutingPoint,
    lanePosition: number,
): readonly ChartRoutingPoint[]
{
    // Initialize the local values needed by this operation.

    const horizontalDistance = target.x - source.x;
    const verticalDistance   = target.y - source.y;
    const length             = Math.hypot ( horizontalDistance, verticalDistance );

    // Handle the case where length matches 0.

    if ( length === 0 )
    {
        // Calculate the extension value from the current inputs.

        const extension = 80 + Math.abs ( lanePosition ) * 24;

        // Return the assembled result collection.

        return [
            source,
            { x: source.x + extension, y: source.y - extension },
            { x: source.x - extension, y: source.y - extension },
            target,
        ];
    }

    // Initialize the local values needed by this operation.

    const normal = { x: -verticalDistance / length, y: horizontalDistance / length };
    const offset = lanePosition * 24;

    // Return the assembled result collection.

    return [
        source,
        {
            x: source.x + horizontalDistance / 3 + normal.x * offset,
            y: source.y + verticalDistance / 3 + normal.y * offset,
        },
        {
            x: source.x + horizontalDistance * 2 / 3 + normal.x * offset,
            y: source.y + verticalDistance * 2 / 3 + normal.y * offset,
        },
        target,
    ];
}

//--------------------------------------------------------------------------------------------------
// Function: fnbRoutingRequest
//
// Description:
//
//   Derives the fnb routing request.
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

function fnbRoutingRequest (): ChartRoutingRequest
{
    // Initialize the local values needed by this operation.

    const fixtureText = readFileSync ( FNB_FIXTURE_PATH, "utf8" );
    const openResult  = openAutomataDocument ( fixtureText );

    // Handle the case where the open result is successful condition is not satisfied.

    if ( !openResult.isSuccessful )
    {
        throw new Error ( `Maintained FNB fixture is invalid: ${openResult.diagnostics [ 0 ]?.message ?? "unknown"}` );
    }

    // Initialize the local values needed by this operation.

    const document: AutomataDocument = openResult.document;
    const projection                 = createAuthoringChartProjection (
        document,
        openResult.diagnostics,
        { actionNames: true, eventNames: true, stateNames: true },
    );
    const rectangleByState = new Map ( projection.states.map ( state => [ state.name, {
        x: state.x,
        y: state.y,
        width: state.width,
        height: state.height,
    } ] as const ) );
    const stateRectangles                              = [ ...rectangleByState.values () ];
    const initialIndicator                             = document.chart.indicators.initialStateIndicator;
    const terminalIndicators                           = document.chart.indicators.terminalStateIndicators;
    const indicatorRectangles: ChartRoutingRectangle[] = [
        ...( initialIndicator === null ? [] : [ {
            x: initialIndicator.x - INDICATOR_SIZE / 2,
            y: initialIndicator.y - INDICATOR_SIZE / 2,
            width: INDICATOR_SIZE,
            height: INDICATOR_SIZE,
        } ] ),
        ...terminalIndicators.map ( indicator => ( {
            x: indicator.x - INDICATOR_SIZE / 2,
            y: indicator.y - INDICATOR_SIZE / 2,
            width: INDICATOR_SIZE,
            height: INDICATOR_SIZE,
        } ) ),
    ];
    const labelObstacles          = [ ...stateRectangles, ...indicatorRectangles ];
    const transitionIndicesByPair = new Map<string, number[]> ();

    document.stateMachine.transitionTable.forEach ( ( transition, transitionIndex ) =>
    {
        // Initialize the local values needed by this operation.

        const pairIdentifier    = relationPairIdentifier ( transition.state, transition.stateNext );
        const transitionIndices = transitionIndicesByPair.get ( pairIdentifier ) ?? [];

        transitionIndices.push ( transitionIndex );
        transitionIndicesByPair.set ( pairIdentifier, transitionIndices );
    } );

    // Initialize the local values needed by this operation.

    const transitionRelations = document.stateMachine.transitionTable.flatMap ( ( transition, transitionIndex ) =>
    {
        // Initialize the local values needed by this operation.

        const sourceRectangle = rectangleByState.get ( transition.state );
        const targetRectangle = rectangleByState.get ( transition.stateNext );

        // Handle the case where at least one branch condition is satisfied.

        if ( sourceRectangle === undefined || targetRectangle === undefined )
        {
            // Return the assembled result collection.

            return [];
        }

        // Initialize the local values needed by this operation.

        const source      = rectangleCenter ( sourceRectangle );
        const target      = rectangleCenter ( targetRectangle );
        const pairIndices = transitionIndicesByPair.get (
            relationPairIdentifier ( transition.state, transition.stateNext ),
        ) ?? [ transitionIndex ];
        const laneIndex         = pairIndices.indexOf ( transitionIndex );
        const lanePosition      = laneIndex - ( pairIndices.length - 1 ) / 2;
        const preservePreferred = transition.state === transition.stateNext || pairIndices.length > 1;
        const eventLabel        = wrapChartName ( transition.event, true ).join ( "\n" );
        const { labelHeight, labelWidth } = transitionLabelSize ( eventLabel );

        // Return the assembled result collection.

        return [ {
            identifier: `transition:${transition.state}:${transition.event}`,
            labelHeight,
            labelObstacles,
            labelPosition: 0.5,
            labelWidth,
            obstacles: stateRectangles.filter ( rectangle =>
                rectangle !== sourceRectangle && rectangle !== targetRectangle ),
            preferredPoints: preservePreferred
                ? preservedLanePoints ( source, target, lanePosition )
                : [ source, target ],
            preservePreferred,
            ...( transition.state === transition.stateNext ? {} : {
                sourceBoundary:
                {
                    cornerRadius: 10,
                    height: sourceRectangle.height,
                    kind: "rectangle" as const,
                    radius: 0,
                    width: sourceRectangle.width,
                },
                targetBoundary:
                {
                    cornerRadius: 10,
                    height: targetRectangle.height,
                    kind: "rectangle" as const,
                    radius: 0,
                    width: targetRectangle.width,
                },
            } ),
        } ];
    } );
    const initialRelations: ChartRoutingRelation[] = initialIndicator === null || document.stateMachine.initialState === null
        ? []
        : ( () =>
        {
            // Initialize the local values needed by this operation.

            const targetRectangle = rectangleByState.get ( document.stateMachine.initialState );

            // Return the result selected by the current condition.

            return targetRectangle === undefined ? [] : [ ordinaryRelation (
                "initial-indicator",
                { x: initialIndicator.x, y: initialIndicator.y },
                rectangleCenter ( targetRectangle ),
                labelObstacles.filter ( rectangle => rectangle !== targetRectangle ),
                "",
            ) ];
        } ) ();
    const terminalRelations = document.chart.indicators.terminalStateTransitions.flatMap ( relation =>
    {
        // Initialize the local values needed by this operation.

        const sourceRectangle = rectangleByState.get ( relation.state );
        const targetIndicator = terminalIndicators.find ( indicator => indicator.id === relation.terminalStateIndicatorId );

        // Return the result selected by the current condition.

        return sourceRectangle === undefined || targetIndicator === undefined ? [] : [ ordinaryRelation (
            `terminal:${relation.state}:${relation.terminalStateIndicatorId}`,
            rectangleCenter ( sourceRectangle ),
            { x: targetIndicator.x, y: targetIndicator.y },
            labelObstacles.filter ( rectangle => rectangle !== sourceRectangle ),
            "",
        ) ];
    } );

    // Return the request for relations result.

    return requestForRelations (
        "benchmark:fnb-maintained-fixture",
        [ ...initialRelations, ...transitionRelations, ...terminalRelations ],
    );
}

//--------------------------------------------------------------------------------------------------
// Function: scenarios
//
// Description:
//
//   Derives the scenarios.
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

function scenarios (): readonly BenchmarkScenario[]
{
    // Initialize the local values needed by this operation.

    const oneBendObstacles = [ { x: 170, y: 40, width: 60, height: 120 } ];
    const mazeObstacles    = Array.from ( { length: 10 }, ( _, obstacleIndex ) => ( {
        x: 120 + obstacleIndex * 140,
        y: obstacleIndex % 2 === 0 ? -180 : -20,
        width: 50,
        height: 200,
    } ) );
    const denseObstacles = [
        { x: 260, y: 140, width: 100, height: 220 },
        { x: 440, y: -40, width: 100, height: 220 },
        { x: 620, y: 140, width: 100, height: 220 },
    ];
    const denseRelations = Array.from ( { length: 10 }, ( _, relationIndex ) => ordinaryRelation (
        `dense:${relationIndex}`,
        { x: 0, y: relationIndex * 36 },
        { x: 980, y: 324 - relationIndex * 36 },
        denseObstacles,
        `event_dense_conflict_${relationIndex.toString ().padStart ( 2, "0" )}`,
    ) );
    const scenarioRequests = [
        {
            name: "simple-direct",
            request: requestForRelations ( "benchmark:simple-direct", [
                ordinaryRelation ( "direct", { x: 0, y: 0 }, { x: 400, y: 0 }, [], "event_direct" ),
            ] ),
        },
        {
            name: "one-bend",
            request: requestForRelations ( "benchmark:one-bend", [
                ordinaryRelation (
                    "one-bend",
                    { x: 0, y: 0 },
                    { x: 400, y: 200 },
                    oneBendObstacles,
                    "event_one_bend",
                ),
            ] ),
        },
        { name: "fnb-maintained-fixture", request: fnbRoutingRequest () },
        {
            name: "synthetic-long-maze",
            request: requestForRelations ( "benchmark:synthetic-long-maze", [
                ordinaryRelation (
                    "long-maze",
                    { x: 0, y: 0 },
                    { x: 1_600, y: 0 },
                    mazeObstacles,
                    "event_synthetic_long_maze",
                ),
            ] ),
        },
        {
            name: "dense-two-pass",
            request: requestForRelations ( "benchmark:dense-two-pass", denseRelations ),
        },
    ];

    // Return the mapped collection.

    return scenarioRequests.map ( scenario => ( {
        ...scenario,
        expectedRelationCount: scenario.request.relations.length,
        expectedSignature: EXPECTED_SIGNATURES [ scenario.name ] ?? "MISSING",
    } ) );
}

//--------------------------------------------------------------------------------------------------
// Function: counterSnapshot
//
// Description:
//
//   Derives the counter snapshot.
//
// Parameters:
//
//   - counters:
//     The counters supplied to the operation.
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

function counterSnapshot ( counters: ChartRoutingPerformanceCounters )
{
    // Return the assembled result.

    return {
        acceptedRouteSegmentCandidateCount: counters.acceptedRouteSegmentCandidateCount,
        aStarExpandedStateCount:             counters.aStarExpandedStateCount,
        broadPhaseCandidateCount:            counters.broadPhaseCandidateCount,
        clearanceRetryCount:                 counters.clearanceRetryCount,
        cubicCandidateCount:                 counters.cubicCandidateCount,
        denseCompatibilityFallbackCount:     counters.denseCompatibilityFallbackCount,
        denseGraphBuildCount:                counters.denseGraphBuildCount,
        exactCrossingTestCount:               counters.exactCrossingTestCount,
        exactLabelTestCount:                  counters.exactLabelTestCount,
        exactObstacleTestCount:               counters.exactObstacleTestCount,
        fallbackCount:                        counters.fallbackCount,
        graphBuildCount:                      counters.graphBuildCount,
        graphCacheEvictionCount:              counters.graphCacheEvictionCount,
        graphCacheHitCount:                   counters.graphCacheHitCount,
        graphCacheMissCount:                  counters.graphCacheMissCount,
        graphEdgeCount:                       counters.graphEdgeCount,
        graphVertexCount:                     counters.graphVertexCount,
        heapOperationCount:                   counters.heapOperationCount,
        labelCandidateCount:                  counters.labelCandidateCount,
        memoizationHitCount:                  counters.memoizationHitCount,
        memoizationEvictionCount:             counters.memoizationEvictionCount,
        memoizationMissCount:                 counters.memoizationMissCount,
        recursiveProofCallCount:              counters.recursiveProofCallCount,
        relationCount:                        counters.relationCount,
        relationsRepairedCount:               counters.relationsRepairedCount,
        relationsRetainedCount:               counters.relationsRetainedCount,
        sparseGraphBuildCount:                counters.sparseGraphBuildCount,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: timingSummary
//
// Description:
//
//   Derives the timing summary.
//
// Parameters:
//
//   - samples:
//     The samples supplied to the operation.
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

function timingSummary ( samples: readonly MeasuredRouting[] )
{
    //----------------------------------------------------------------------------------------------
    // Function: summary
    //
    // Description:
    //
    //   Derives the summary.
    //
    // Parameters:
    //
    //   - selector:
    //     The selector supplied to the operation.
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

    const summary = ( selector: ( sample: MeasuredRouting ) => number ) =>
    {
        // Initialize the local values needed by this operation.

        const values = samples.map ( selector );

        // Return the assembled result.

        return {
            percentile50Milliseconds: roundedMilliseconds ( nearestRankPercentile ( values, 0.50 ) ),
            percentile95Milliseconds: roundedMilliseconds ( nearestRankPercentile ( values, 0.95 ) ),
        };
    };

    // Return the assembled result.

    return {
        complete:          summary ( sample => sample.completeMilliseconds ),
        totalRequest:      summary ( sample => sample.counters.totalRequestMilliseconds ),
        sceneIndexBuild:   summary ( sample => sample.counters.sceneIndexBuildMilliseconds ),
        passOne:           summary ( sample => sample.counters.passOneMilliseconds ),
        repairEligibility: summary ( sample => sample.counters.repairEligibilityMilliseconds ),
        passTwo:           summary ( sample => sample.counters.passTwoMilliseconds ),
        curveFit:          summary ( sample => sample.counters.curveFitMilliseconds ),
        labelPlacement:    summary ( sample => sample.counters.labelPlacementMilliseconds ),
    };
}

describe ( "Slice 6 final exact Chart routing", () =>
{
    it ( "records validated fixture signatures, work counters, and nearest-rank P50/P95 distributions", () =>
    {
        // Initialize the local values needed by this operation.

        const evidence = scenarios ().map ( scenario =>
        {
            expect ( scenario.request.relations ).toHaveLength ( scenario.expectedRelationCount );

            // Initialize the local values needed by this operation.

            const optimizedResult         = routeChartRelations ( scenario.request );
            const denseReferenceResult    = routeChartRelationsDenseReference ( scenario.request );
            const sparseReferenceResult   = routeChartRelationsSparseReference ( scenario.request );
            const uninstrumentedSignature = resultSignature ( optimizedResult );

            expectSparseQualityMatchesOrImprovesDense (
                scenario.name,
                sparseReferenceResult,
                denseReferenceResult,
            );

            expect ( uninstrumentedSignature, `${scenario.name} uninstrumented` )
                .toBe ( scenario.expectedSignature );

            // Repeat the operation across the bounded iteration range.

            for ( let warmupIndex = 0; warmupIndex < WARMUP_COUNT; warmupIndex += 1 )
            {
                // Initialize the local values needed by this operation.

                const warmup = measuredRouting ( scenario.request );

                expect ( warmup.signature, `${scenario.name} warmup ${warmupIndex}` )
                    .toBe ( scenario.expectedSignature );
            }

            // Initialize the local values needed by this operation.

            const samples              = Array.from ( { length: SAMPLE_COUNT }, () => measuredRouting ( scenario.request ) );
            const firstCounterSnapshot = counterSnapshot ( samples [ 0 ]!.counters );

            samples.forEach ( ( sample, sampleIndex ) =>
            {
                expect ( sample.signature, `${scenario.name} sample ${sampleIndex}` )
                    .toBe ( scenario.expectedSignature );
                expect ( counterSnapshot ( sample.counters ), `${scenario.name} counters ${sampleIndex}` )
                    .toEqual ( firstCounterSnapshot );
            } );
            expect ( firstCounterSnapshot.relationsRetainedCount + firstCounterSnapshot.relationsRepairedCount )
                .toBe ( scenario.expectedRelationCount );

            const warmReuseCache = new ChartRoutingReuseCache ();

            routeChartRelations ( scenario.request, undefined, warmReuseCache );

            // Initialize the local values needed by this operation.

            const warmSamples = Array.from ( { length: SAMPLE_COUNT }, () =>
                measuredRouting ( scenario.request, warmReuseCache ) );
            const firstWarmCounterSnapshot = counterSnapshot ( warmSamples [ 0 ]!.counters );

            warmSamples.forEach ( ( sample, sampleIndex ) =>
            {
                expect ( sample.signature, `${scenario.name} warm-cache sample ${sampleIndex}` )
                    .toBe ( scenario.expectedSignature );
                expect ( counterSnapshot ( sample.counters ), `${scenario.name} warm-cache counters ${sampleIndex}` )
                    .toEqual ( firstWarmCounterSnapshot );
            } );

            // Return the assembled result.

            return {
                name: scenario.name,
                fixture:
                {
                    relationCount: scenario.expectedRelationCount,
                    signature: scenario.expectedSignature,
                },
                counters: firstCounterSnapshot,
                timings: timingSummary ( samples ),
                warmReuse:
                {
                    counters: firstWarmCounterSnapshot,
                    timings: timingSummary ( warmSamples ),
                },
            };
        } );
        const processorDescription = cpus () [ 0 ]?.model ?? "unknown";
        const report               = 
        {
            candidate: "slice-6-production-gated-exact-router",
            environment:
            {
                architecture:           process.arch,
                logicalProcessors:      cpus ().length,
                node:                   process.version,
                operatingSystemRelease: operatingSystemRelease (),
                platform:               process.platform,
                processor:              processorDescription.trim (),
                totalMemoryBytes:       totalMemory (),
                v8:                     process.versions.v8,
            },
            method:
            {
                clock: "node:perf_hooks.performance.now",
                percentile: "nearest-rank",
                sampleCount: SAMPLE_COUNT,
                warmupCount: WARMUP_COUNT,
                warmReusePrimeCount: 1,
                workerBoundary: "excluded; synchronous router CPU baseline",
            },
            scenarios: evidence,
        };

        process.stdout.write ( `\nCHART_ROUTING_PERFORMANCE_EVIDENCE ${JSON.stringify ( report )}\n` );
    } );
} );
