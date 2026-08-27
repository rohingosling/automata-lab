// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Orthogonal Chart Router
// Version: 1.0.0
// Date:    2026-08-12
// Author:  Rohin Gosling
//
// Description:
//
//   Routes immutable Chart relation snapshots through a bounded orthogonal visibility graph and
//   places labels without mutating document geometry. Stable exterior lanes preserve a visible
//   diagnostic result when ordinary bounds fail.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type
{
    ChartRoutingCubicCurve,
    ChartRoutingPoint,
    ChartRoutingRectangle,
    ChartRoutingRelation,
    ChartRoutingRequest,
    ChartRoutingResult,
    ChartRoutingResultRelation,
} from "../../application/ports/contracts.js";
import type { ChartRoutingPerformanceCounters } from "../../application/chart-routing-performance.js";
import
{
    AppendChartRoutingSpatialIndex,
    PackedChartRoutingSpatialIndex,
    chartRoutingSpatialBoundsFromPoint,
    chartRoutingSpatialBoundsFromRectangle,
    chartRoutingSpatialBoundsFromSegment,
    type ChartRoutingSpatialQuery,
} from "../../application/chart-routing-spatial-index.js";
import
{
    clipCubicBezierCurvesToBoundaries,
    cubicBezierCurvesAreClearOfObstacles,
    cubicBezierCurveSamplePoints,
    cubicBezierCurvesFromBackbone,
    cubicBezierCurvesFromPreservedBackbone,
    fitCubicDetourClearance,
    pointAlongSampledCurve,
    routingBackboneIsClearOfObstacles,
} from "../../application/chart-routing-backbone.js";
import
{
    CHART_ROUTING_CONFIGURATION,
    CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED,
} from "../../configuration/compile-time-configuration.js";
import
{
    buildDenseChartRoutingVisibilityGraph,
    buildDenseChartRoutingVisibilityProfile,
    buildSparseChartRoutingVisibilityGraph,
    buildSparseChartRoutingVisibilityProfile,
    chartRoutingVisibilityProfileSignature,
    sparseVisibilityGeometryIsSupported,
    type ChartRoutingVisibilityGraph,
    type ChartRoutingVisibilityProfile,
} from "./chart-routing-visibility-graph.js";
import { ChartRoutingReuseCache } from "./chart-routing-reuse-cache.js";

const ROUTING_CONFIGURATION                = CHART_ROUTING_CONFIGURATION;
const ROUTE_CLEARANCE                      = ROUTING_CONFIGURATION.routeClearance;
const MAXIMUM_VISIBILITY_POINTS            = 16_384;
const MAXIMUM_SEARCH_STATES                = 65_536;
const MAXIMUM_CURVE_CLEARANCE_SEARCH_COUNT = 
    ROUTING_CONFIGURATION.maximumCurveClearanceSearchCount;
const LABEL_CANDIDATE_INTERVAL_COUNT =
    ROUTING_CONFIGURATION.labelPlacement.candidateIntervalCount;
const EXTERIOR_LANE_SPACING     = 20;
const ENDPOINT_CLEARANCE_MARGIN = 1;
const CROSSING_POSITION_EPSILON = 0.000001;


//--------------------------------------------------------------------------------------------------
// Interface: RoutingOptimizationOptions
//
// Description:
//
//   Defines the options that control routing optimization.
//
//--------------------------------------------------------------------------------------------------

interface RoutingOptimizationOptions
{
    readonly exactFastPaths:              boolean;
    readonly selectiveSecondPassRetention: boolean;
    readonly visibilityGraphStrategy:      "dense" | "sparse";
}

const EXACT_ROUTING_OPTIMIZATIONS: RoutingOptimizationOptions =
{
    exactFastPaths:               true,
    selectiveSecondPassRetention: true,
    visibilityGraphStrategy:      "sparse",
};

const DENSE_REFERENCE_ROUTING_OPTIONS: RoutingOptimizationOptions =
{
    exactFastPaths:               false,
    selectiveSecondPassRetention: false,
    visibilityGraphStrategy:      "dense",
};

const SPARSE_REFERENCE_ROUTING_OPTIONS: RoutingOptimizationOptions =
{
    exactFastPaths:               false,
    selectiveSecondPassRetention: false,
    visibilityGraphStrategy:      "sparse",
};


//--------------------------------------------------------------------------------------------------
// Type: Direction
//
// Description:
//
//   Defines the supported direction alternatives.
//
//--------------------------------------------------------------------------------------------------

type Direction = "horizontal" | "none" | "vertical";


//--------------------------------------------------------------------------------------------------
// Type: ChartRoutingCancellationCheckpoint
//
// Description:
//
//   Defines the supported chart routing cancellation checkpoint alternatives.
//
//--------------------------------------------------------------------------------------------------

export type ChartRoutingCancellationCheckpoint = "clearance-retry" | "pass" | "relation";


//--------------------------------------------------------------------------------------------------
// Interface: ChartRoutingCooperativeControl
//
// Description:
//
//   Defines the structure of chart routing cooperative control.
//
//--------------------------------------------------------------------------------------------------

export interface ChartRoutingCooperativeControl
{
    readonly isCancelled: ( () => boolean );
    readonly yieldControl: ( checkpoint: ChartRoutingCancellationCheckpoint ) => Promise<void>;
}


//--------------------------------------------------------------------------------------------------
// Interface: SearchCost
//
// Description:
//
//   Defines the structure of search cost.
//
//--------------------------------------------------------------------------------------------------

interface SearchCost
{
    readonly bends:            number;
    readonly crossings:        number;
    readonly length:           number;
}

//--------------------------------------------------------------------------------------------------
// Interface: SearchState
//
// Description:
//
//   Defines the structure of search state.
//
//--------------------------------------------------------------------------------------------------

interface SearchState
{
    readonly cost:      SearchCost;
    readonly direction: Direction;
    readonly nodeIndex: number;
    readonly priority:  number;
}

//--------------------------------------------------------------------------------------------------
// Interface: CurveClearSearchResult
//
// Description:
//
//   Describes the result produced by curve clear search.
//
//--------------------------------------------------------------------------------------------------

interface CurveClearSearchResult
{
    readonly points:                  ChartRoutingPoint[] | null;
    readonly rejectedUnsafeBackbone: boolean;
}

//--------------------------------------------------------------------------------------------------
// Interface: ExteriorRouteResult
//
// Description:
//
//   Describes the result produced by exterior route.
//
//--------------------------------------------------------------------------------------------------

interface ExteriorRouteResult
{
    readonly points: ChartRoutingPoint[];
    readonly proven: boolean;
}

//--------------------------------------------------------------------------------------------------
// Class: SearchHeap
//
// Description:
//
//   Implements the search heap behavior.
//
//--------------------------------------------------------------------------------------------------

class SearchHeap
{
    private readonly values: SearchState[] = [];


    //----------------------------------------------------------------------------------------------
    // Method: length
    //
    // Description:
    //
    //   Derives the length.
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
    //----------------------------------------------------------------------------------------------

    public get length (): number
    {
        // Return the computed result.

        return this.values.length;
    }

    //----------------------------------------------------------------------------------------------
    // Method: push
    //
    // Description:
    //
    //   Pushes the requested value.
    //
    // Parameters:
    //
    //   - value:
    //     The value supplied to the operation.
    //
    //   - performanceCounters:
    //     The performance counters supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    public push ( value: SearchState, performanceCounters?: ChartRoutingPerformanceCounters ): void
    {
        // Handle the case where all required conditions are satisfied.

        if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined )
        {
            performanceCounters.heapOperationCount += 1;
        }

        this.values.push ( value );

        // Calculate the index value from the current inputs.

        let index = this.values.length - 1;

        // Continue the operation while its terminating condition has not been reached.

        while ( index > 0 )
        {
            // Initialize the local values needed by this operation.

            const parentIndex = Math.floor ( ( index - 1 ) / 2 );
            const parent      = this.values [ parentIndex ];

            // Handle the case where at least one branch condition is satisfied.

            if ( parent === undefined || compareSearchStates ( parent, value ) <= 0 )
            {
                break;
            }

            this.values [ index ] = parent;
            index                 = parentIndex;
        }

        this.values [ index ] = value;
    }

    //----------------------------------------------------------------------------------------------
    // Method: pop
    //
    // Description:
    //
    //   Removes and returns the next value.
    //
    // Parameters:
    //
    //   - performanceCounters:
    //     The performance counters supplied to the operation.
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

    public pop ( performanceCounters?: ChartRoutingPerformanceCounters ): SearchState | undefined
    {
        // Handle the case where all required conditions are satisfied.

        if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined )
        {
            performanceCounters.heapOperationCount += 1;
        }


        // Initialize the local values needed by this operation.

        const first = this.values [ 0 ];
        const last  = this.values.pop ();

        // Handle the case where at least one branch condition is satisfied.

        if ( first === undefined || last === undefined || this.values.length === 0 )
        {
            // Return the first.

            return first;
        }

        let index = 0;

        // Continue the operation while its terminating condition has not been reached.

        while ( true )
        {
            // Initialize the local values needed by this operation.

            const leftIndex  = index * 2 + 1;
            const rightIndex = leftIndex + 1;
            const left       = this.values [ leftIndex ];
            const right      = this.values [ rightIndex ];

            // Handle the case where left matches undefined.

            if ( left === undefined )
            {
                break;
            }

            // Initialize the local values needed by this operation.

            const childIndex = right !== undefined && compareSearchStates ( right, left ) < 0
                ? rightIndex
                : leftIndex;
            const child = this.values [ childIndex ];

            // Handle the case where at least one branch condition is satisfied.

            if ( child === undefined || compareSearchStates ( last, child ) <= 0 )
            {
                break;
            }

            this.values [ index ] = child;
            index                 = childIndex;
        }

        this.values [ index ] = last;

        // Return the first.

        return first;
    }
}

//--------------------------------------------------------------------------------------------------
// Function: compareSearchStates
//
// Description:
//
//   Compares search states.
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

function compareSearchStates ( left: SearchState, right: SearchState ): number
{
    // Return the computed result.

    return left.priority - right.priority ||
        left.cost.bends - right.cost.bends ||
        left.cost.crossings - right.cost.crossings ||
        left.cost.length - right.cost.length ||
        left.nodeIndex - right.nodeIndex ||
        left.direction.localeCompare ( right.direction );
}

//--------------------------------------------------------------------------------------------------
// Function: pointIdentifier
//
// Description:
//
//   Derives the point identifier.
//
// Parameters:
//
//   - point:
//     The point supplied to the operation.
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

function pointIdentifier ( point: ChartRoutingPoint ): string
{
    // Return the computed result.

    return `${point.x},${point.y}`;
}

//--------------------------------------------------------------------------------------------------
// Function: stateIdentifier
//
// Description:
//
//   Derives the state identifier.
//
// Parameters:
//
//   - nodeIndex:
//     The node index supplied to the operation.
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

function stateIdentifier ( nodeIndex: number, direction: Direction ): string
{
    // Return the computed result.

    return `${nodeIndex}:${direction}`;
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
//   - clearance:
//     The clearance supplied to the operation.
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

function inflateRectangle (
    rectangle: ChartRoutingRectangle,
    clearance: number,
): ChartRoutingRectangle
{
    // Return the assembled result.

    return {
        x: rectangle.x - clearance,
        y: rectangle.y - clearance,
        width: rectangle.width + clearance * 2,
        height: rectangle.height + clearance * 2,
    };
}


//--------------------------------------------------------------------------------------------------
// Function: packedRectangleIndex
//
// Description:
//
//   Derives the packed rectangle index.
//
// Parameters:
//
//   - rectangles:
//     The rectangles supplied to the operation.
//
//   - performanceCounters:
//     The performance counters supplied to the operation.
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

function packedRectangleIndex (
    rectangles: readonly ChartRoutingRectangle[],
    performanceCounters?: ChartRoutingPerformanceCounters,
): PackedChartRoutingSpatialIndex<ChartRoutingRectangle>
{
    // Initialize the local values needed by this operation.

    const startMilliseconds = !CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED || performanceCounters === undefined
        ? 0
        : monotonicMilliseconds ();
    const index = new PackedChartRoutingSpatialIndex ( rectangles.map ( rectangle => ( {
        bounds: chartRoutingSpatialBoundsFromRectangle ( rectangle ),
        value: rectangle,
    } ) ) );


    // Handle the case where all required conditions are satisfied.

    if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined )
    {
        performanceCounters.sceneIndexBuildMilliseconds += monotonicMilliseconds () - startMilliseconds;
    }


    // Return the index.

    return index;
}


//--------------------------------------------------------------------------------------------------
// Function: routeSegments
//
// Description:
//
//   Routes the segments.
//
// Parameters:
//
//   - points:
//     The points supplied to the operation.
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
//--------------------------------------------------------------------------------------------------

function routeSegments (
    points: readonly ChartRoutingPoint[],
    relationIndex: number,
): readonly ChartRoutingSegment[]
{
    // Return the flat map result.

    return points.slice ( 1 ).flatMap ( ( target, index ) =>
    {
        // Initialize the local values needed by this operation.

        const source = points [ index ];


        // Return the result selected by the current condition.

        return source === undefined ? [] : [ { relationIndex, source, target } ];
    } );
}


//--------------------------------------------------------------------------------------------------
// Function: packedRouteSegmentIndex
//
// Description:
//
//   Derives the packed route segment index.
//
// Parameters:
//
//   - routes:
//     The routes supplied to the operation.
//
//   - performanceCounters:
//     The performance counters supplied to the operation.
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

function packedRouteSegmentIndex (
    routes: readonly ( readonly ChartRoutingPoint[] )[],
    performanceCounters?: ChartRoutingPerformanceCounters,
): PackedChartRoutingSpatialIndex<ChartRoutingSegment>
{
    // Initialize the local values needed by this operation.

    const startMilliseconds = !CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED || performanceCounters === undefined
        ? 0
        : monotonicMilliseconds ();
    const index = new PackedChartRoutingSpatialIndex ( routes.flatMap ( ( route, relationIndex ) =>
        routeSegments ( route, relationIndex ) )
        .map ( segment => ( {
            bounds: chartRoutingSpatialBoundsFromSegment ( segment.source, segment.target ),
            value: segment,
        } ) ) );


    // Handle the case where all required conditions are satisfied.

    if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined )
    {
        performanceCounters.sceneIndexBuildMilliseconds += monotonicMilliseconds () - startMilliseconds;
    }


    // Return the index.

    return index;
}


//--------------------------------------------------------------------------------------------------
// Function: appendRouteSegments
//
// Description:
//
//   Appends the route segments.
//
// Parameters:
//
//   - index:
//     The index supplied to the operation.
//
//   - points:
//     The points supplied to the operation.
//
//   - relationIndex:
//     The relation index supplied to the operation.
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

function appendRouteSegments (
    index: AppendChartRoutingSpatialIndex<ChartRoutingSegment>,
    points: readonly ChartRoutingPoint[],
    relationIndex: number,
): void
{
    routeSegments ( points, relationIndex ).forEach ( segment => index.append ( {
        bounds: chartRoutingSpatialBoundsFromSegment ( segment.source, segment.target ),
        value: segment,
    } ) );
}


//--------------------------------------------------------------------------------------------------
// Function: pointInsideRectangle
//
// Description:
//
//   Derives the point inside rectangle.
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

function pointInsideRectangle ( point: ChartRoutingPoint, rectangle: ChartRoutingRectangle ): boolean
{
    // Return the computed result.

    return point.x > rectangle.x && point.x < rectangle.x + rectangle.width &&
        point.y > rectangle.y && point.y < rectangle.y + rectangle.height;
}

//--------------------------------------------------------------------------------------------------
// Function: rectanglesIntersect
//
// Description:
//
//   Derives the rectangles intersect.
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

function rectanglesIntersect ( left: ChartRoutingRectangle, right: ChartRoutingRectangle ): boolean
{
    // Return the computed result.

    return left.x < right.x + right.width && left.x + left.width > right.x &&
        left.y < right.y + right.height && left.y + left.height > right.y;
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
// Function: segmentIsClear
//
// Description:
//
//   Derives the segment is clear.
//
// Parameters:
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
//   - performanceCounters:
//     The performance counters supplied to the operation.
//
//   - obstacleIndex:
//     The obstacle index supplied to the operation.
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

function segmentIsClear (
    source: ChartRoutingPoint,
    target: ChartRoutingPoint,
    obstacles: readonly ChartRoutingRectangle[],
    performanceCounters?: ChartRoutingPerformanceCounters,
    obstacleIndex?: ChartRoutingSpatialQuery<ChartRoutingRectangle>,
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
    {
        // Handle the case where all required conditions are satisfied.

        if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined )
        {
            performanceCounters.broadPhaseCandidateCount += 1;
            performanceCounters.exactObstacleTestCount += 1;
        }


        // Return the computed result.

        return !segmentIntersectsRectangle ( source, target, obstacle );
    };


    // Return the result selected by the current condition.

    return obstacleIndex === undefined
        ? obstacles.every ( obstacleIsClear )
        : obstacleIndex.visit ( chartRoutingSpatialBoundsFromSegment ( source, target ), obstacleIsClear );
}

//--------------------------------------------------------------------------------------------------
// Function: coordinateInteriorInterval
//
// Description:
//
//   Derives the coordinate interior interval.
//
// Parameters:
//
//   - origin:
//     The origin supplied to the operation.
//
//   - direction:
//     The direction supplied to the operation.
//
//   - minimum:
//     The minimum supplied to the operation.
//
//   - maximum:
//     The maximum supplied to the operation.
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

function coordinateInteriorInterval (
    origin: number,
    direction: number,
    minimum: number,
    maximum: number,
): { readonly maximum: number; readonly minimum: number } | null
{
    // Handle the case where direction equals 0.

    if ( direction === 0 )
    {
        // Return the result selected by the current condition.

        return origin > minimum && origin < maximum
            ? { maximum: Number.POSITIVE_INFINITY, minimum: Number.NEGATIVE_INFINITY }
            : null;
    }

    // Initialize the local values needed by this operation.

    const firstPosition  = ( minimum - origin ) / direction;
    const secondPosition = ( maximum - origin ) / direction;

    // Return the assembled result.

    return {
        maximum: Math.max ( firstPosition, secondPosition ),
        minimum: Math.min ( firstPosition, secondPosition ),
    };
}

//--------------------------------------------------------------------------------------------------
// Function: directSegmentIntersectsRectangle
//
// Description:
//
//   Derives the direct segment intersects rectangle.
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

function directSegmentIntersectsRectangle (
    source: ChartRoutingPoint,
    target: ChartRoutingPoint,
    rectangle: ChartRoutingRectangle,
): boolean
{
    // Initialize the local values needed by this operation.

    const horizontalInterval = coordinateInteriorInterval (
        source.x,
        target.x - source.x,
        rectangle.x,
        rectangle.x + rectangle.width,
    );
    const verticalInterval = coordinateInteriorInterval (
        source.y,
        target.y - source.y,
        rectangle.y,
        rectangle.y + rectangle.height,
    );

    // Handle the case where at least one branch condition is satisfied.

    if ( horizontalInterval === null || verticalInterval === null )
    {
        // Return the computed result.

        return false;
    }

    // Initialize the local values needed by this operation.

    const entryPosition = Math.max ( 0, horizontalInterval.minimum, verticalInterval.minimum );
    const exitPosition  = Math.min ( 1, horizontalInterval.maximum, verticalInterval.maximum );

    // Return the computed result.

    return entryPosition < exitPosition;
}

//--------------------------------------------------------------------------------------------------
// Function: directSegmentIsClear
//
// Description:
//
//   Derives the direct segment is clear.
//
// Parameters:
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
//   - performanceCounters:
//     The performance counters supplied to the operation.
//
//   - obstacleIndex:
//     The obstacle index supplied to the operation.
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

function directSegmentIsClear (
    source: ChartRoutingPoint,
    target: ChartRoutingPoint,
    obstacles: readonly ChartRoutingRectangle[],
    performanceCounters?: ChartRoutingPerformanceCounters,
    obstacleIndex?: ChartRoutingSpatialQuery<ChartRoutingRectangle>,
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
    {
        // Handle the case where all required conditions are satisfied.

        if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined )
        {
            performanceCounters.broadPhaseCandidateCount += 1;
            performanceCounters.exactObstacleTestCount += 1;
        }


        // Return the computed result.

        return !directSegmentIntersectsRectangle ( source, target, obstacle );
    };


    // Return the result selected by the current condition.

    return obstacleIndex === undefined
        ? obstacles.every ( obstacleIsClear )
        : obstacleIndex.visit ( chartRoutingSpatialBoundsFromSegment ( source, target ), obstacleIsClear );
}

//--------------------------------------------------------------------------------------------------
// Function: compactPoints
//
// Description:
//
//   Compacts the points.
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

function compactPoints ( points: readonly ChartRoutingPoint[] ): ChartRoutingPoint[]
{
    // Calculate the unique value from the current inputs.

    const unique = points.filter ( ( point, index ) => index === 0 ||
        pointIdentifier ( point ) !== pointIdentifier ( points [ index - 1 ] ?? point ) );

    // Return the filtered collection.

    return unique.filter ( ( point, index ) =>
    {
        // Initialize the local values needed by this operation.

        const previous = unique [ index - 1 ];
        const next     = unique [ index + 1 ];

        // Return the computed result.

        return previous === undefined || next === undefined ||
            !( previous.x === point.x && point.x === next.x ) &&
            !( previous.y === point.y && point.y === next.y );
    } );
}

//--------------------------------------------------------------------------------------------------
// Function: buildVisibilityGraph
//
// Description:
//
//   Builds visibility graph.
//
// Parameters:
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
//   - strategy:
//     The strategy supplied to the operation.
//
//   - performanceCounters:
//     The performance counters supplied to the operation.
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

function buildVisibilityGraph (
    source: ChartRoutingPoint,
    target: ChartRoutingPoint,
    obstacles: readonly ChartRoutingRectangle[],
    strategy: "dense" | "sparse",
    performanceCounters?: ChartRoutingPerformanceCounters,
    reuseCache?: ChartRoutingReuseCache,
): ChartRoutingVisibilityGraph | null
{
    // Handle the case where all required conditions are satisfied.

    if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined )
    {
        performanceCounters.graphBuildCount += 1;
    }


    // Initialize the local values needed by this operation.

    const obstacleIndex                                    = packedRectangleIndex ( obstacles, performanceCounters );
    const useSparseGraph                                   = strategy === "sparse" && sparseVisibilityGeometryIsSupported ( obstacles );
    const resolvedStrategy                                 = useSparseGraph ? "sparse" : "dense";
    const profileSignature                                 = chartRoutingVisibilityProfileSignature ( resolvedStrategy, obstacles );
    let profile: ChartRoutingVisibilityProfile | undefined = reuseCache?.getGraphProfile (
        profileSignature,
        performanceCounters,
    );


    // Handle the case where profile matches undefined.

    if ( profile === undefined )
    {
        profile = useSparseGraph
            ? buildSparseChartRoutingVisibilityProfile ( obstacles )
            : buildDenseChartRoutingVisibilityProfile ( obstacles );
        reuseCache?.setGraphProfile ( profileSignature, profile, performanceCounters );
    }


    // Handle the case where all required conditions are satisfied.

    if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined )
    {
        performanceCounters.denseGraphBuildCount += useSparseGraph ? 0 : 1;
        performanceCounters.sparseGraphBuildCount += useSparseGraph ? 1 : 0;
        performanceCounters.denseCompatibilityFallbackCount += strategy === "sparse" && !useSparseGraph ? 1 : 0;
    }


    // Initialize the local values needed by this operation.

    const predicates = {
        pointIsClear: ( point: ChartRoutingPoint ): boolean => obstacleIndex.visit (
            chartRoutingSpatialBoundsFromPoint ( point ),
            obstacle =>
            {
                // Handle the case where all required conditions are satisfied.

                if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined )
                {
                    performanceCounters.broadPhaseCandidateCount += 1;
                    performanceCounters.exactObstacleTestCount += 1;
                }


                // Return the computed result.

                return !pointInsideRectangle ( point, obstacle );
            },
        ),
        segmentIsClear: ( segmentSource: ChartRoutingPoint, segmentTarget: ChartRoutingPoint ): boolean =>
            segmentIsClear (
                segmentSource,
                segmentTarget,
                obstacles,
                performanceCounters,
                obstacleIndex,
            ),
    };
    const graph = useSparseGraph && profile.strategy === "sparse"
        ? buildSparseChartRoutingVisibilityGraph (
            source,
            target,
            obstacles,
            predicates,
            MAXIMUM_VISIBILITY_POINTS,
            profile,
        )
        : profile.strategy === "dense" ? buildDenseChartRoutingVisibilityGraph (
            source,
            target,
            obstacles,
            predicates,
            MAXIMUM_VISIBILITY_POINTS,
            profile,
        ) : null;


    // Handle the case where all required conditions are satisfied.

    if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && graph !== null &&
        performanceCounters !== undefined )
    {
        performanceCounters.graphVertexCount += graph.points.length;
        performanceCounters.graphEdgeCount += graph.adjacency.reduce ( ( count, neighbours ) =>
            count + neighbours.length, 0 ) / 2;
    }


    // Return the graph.

    return graph;
}


//--------------------------------------------------------------------------------------------------
// Interface: ChartRoutingSegment
//
// Description:
//
//   Defines the structure of chart routing segment.
//
//--------------------------------------------------------------------------------------------------

interface ChartRoutingSegment
{
    readonly relationIndex: number;
    readonly source: ChartRoutingPoint;
    readonly target: ChartRoutingPoint;
}


//--------------------------------------------------------------------------------------------------
// Function: edgeDirection
//
// Description:
//
//   Derives the edge direction.
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

function edgeDirection ( source: ChartRoutingPoint, target: ChartRoutingPoint ): Direction
{
    // Return the result selected by the current condition.

    return source.x === target.x ? "vertical" : "horizontal";
}

//--------------------------------------------------------------------------------------------------
// Function: manhattanDistance
//
// Description:
//
//   Derives the manhattan distance.
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

function manhattanDistance ( source: ChartRoutingPoint, target: ChartRoutingPoint ): number
{
    // Return the computed result.

    return Math.abs ( target.x - source.x ) + Math.abs ( target.y - source.y );
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

function crossProduct (
    first: ChartRoutingPoint,
    second: ChartRoutingPoint,
): number
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

    // Handle the case where abs result does not exceed crossing position epsilon.

    if ( Math.abs ( denominator ) <= CROSSING_POSITION_EPSILON )
    {
        // Return the computed result.

        return false;
    }

    // Initialize the local values needed by this operation.

    const firstPosition  = crossProduct ( sourceDifference, secondDirection ) / denominator;
    const secondPosition = crossProduct ( sourceDifference, firstDirection ) / denominator;

    // Return the computed result.

    return firstPosition > CROSSING_POSITION_EPSILON &&
        firstPosition < 1 - CROSSING_POSITION_EPSILON &&
        secondPosition > CROSSING_POSITION_EPSILON &&
        secondPosition < 1 - CROSSING_POSITION_EPSILON;
}

//--------------------------------------------------------------------------------------------------
// Function: segmentCrossingCount
//
// Description:
//
//   Derives the segment crossing count.
//
// Parameters:
//
//   - source:
//     The source supplied to the operation.
//
//   - target:
//     The target supplied to the operation.
//
//   - acceptedRouteIndex:
//     The accepted route index supplied to the operation.
//
//   - relationIndex:
//     The relation index supplied to the operation.
//
//   - performanceCounters:
//     The performance counters supplied to the operation.
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

function segmentCrossingCount (
    source: ChartRoutingPoint,
    target: ChartRoutingPoint,
    acceptedRouteIndex: ChartRoutingSpatialQuery<ChartRoutingSegment>,
    relationIndex: number,
    performanceCounters?: ChartRoutingPerformanceCounters,
): number
{
    // Initialize the local values needed by this operation.

    let count = 0;

    acceptedRouteIndex.visit ( chartRoutingSpatialBoundsFromSegment ( source, target ), acceptedSegment =>
    {
        // Handle the case where accepted segment relation index matches relation index.

        if ( acceptedSegment.relationIndex === relationIndex )
        {
            // Return the computed result.

            return true;
        }


        // Handle the case where all required conditions are satisfied.

        if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined )
        {
            performanceCounters.acceptedRouteSegmentCandidateCount += 1;
            performanceCounters.broadPhaseCandidateCount += 1;
            performanceCounters.exactCrossingTestCount += 1;
        }


        // Handle the case where segments properly cross result is enabled.

        if ( segmentsProperlyCross (
            source,
            target,
            acceptedSegment.source,
            acceptedSegment.target,
        ) )
        {
            count += 1;
        }


        // Return the computed result.

        return true;
    } );


    // Return the count.

    return count;
}


//--------------------------------------------------------------------------------------------------
// Function: routeCrossingCount
//
// Description:
//
//   Routes the crossing count.
//
// Parameters:
//
//   - points:
//     The points supplied to the operation.
//
//   - acceptedRouteIndex:
//     The accepted route index supplied to the operation.
//
//   - relationIndex:
//     The relation index supplied to the operation.
//
//   - performanceCounters:
//     The performance counters supplied to the operation.
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

function routeCrossingCount (
    points: readonly ChartRoutingPoint[],
    acceptedRouteIndex: ChartRoutingSpatialQuery<ChartRoutingSegment>,
    relationIndex: number,
    performanceCounters?: ChartRoutingPerformanceCounters,
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
            count += segmentCrossingCount (
                source,
                target,
                acceptedRouteIndex,
                relationIndex,
                performanceCounters,
            );
        }
    }

    // Return the count.

    return count;
}

//--------------------------------------------------------------------------------------------------
// Function: costIsBetter
//
// Description:
//
//   Derives the cost is better.
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

function costIsBetter ( candidate: SearchCost, current: SearchCost | undefined ): boolean
{
    // Return the computed result.

    return current === undefined || candidate.length < current.length ||
        candidate.length === current.length && ( candidate.bends < current.bends ||
            candidate.bends === current.bends && candidate.crossings < current.crossings );
}


//--------------------------------------------------------------------------------------------------
// Function: monotonicMilliseconds
//
// Description:
//
//   Derives the monotonic milliseconds.
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

function monotonicMilliseconds (): number
{
    // Return the computed result.

    return globalThis.performance?.now () ?? Date.now ();
}


//--------------------------------------------------------------------------------------------------
// Function: searchVisibilityGraph
//
// Description:
//
//   Derives the search visibility graph.
//
// Parameters:
//
//   - graph:
//     The graph supplied to the operation.
//
//   - acceptedRouteIndex:
//     The accepted route index supplied to the operation.
//
//   - relationIndex:
//     The relation index supplied to the operation.
//
//   - performanceCounters:
//     The performance counters supplied to the operation.
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

function searchVisibilityGraph (
    graph: ChartRoutingVisibilityGraph,
    acceptedRouteIndex: ChartRoutingSpatialQuery<ChartRoutingSegment>,
    relationIndex: number,
    performanceCounters?: ChartRoutingPerformanceCounters,
): ChartRoutingPoint[] | null
{
    // Initialize the local values needed by this operation.

    const sourcePoint = graph.points [ graph.source ];
    const targetPoint = graph.points [ graph.target ];

    // Handle the case where at least one branch condition is satisfied.

    if ( sourcePoint === undefined || targetPoint === undefined )
    {
        // Return the computed result.

        return null;
    }

    // Initialize the local values needed by this operation.

    const heap        = new SearchHeap ();
    const costs       = new Map<string, SearchCost> ();
    const previous    = new Map<string, string> ();
    const initialKey  = stateIdentifier ( graph.source, "none" );
    const initialCost = { bends: 0, crossings: 0, length: 0 };

    costs.set ( initialKey, initialCost );
    heap.push ( { cost: initialCost, direction: "none", nodeIndex: graph.source, priority: 0 }, performanceCounters );

    // Initialize the local values needed by this operation.

    let expandedStateCount        = 0;
    let winningKey: string | null = null;

    // Continue the operation while its terminating condition has not been reached.

    while ( heap.length > 0 && expandedStateCount < MAXIMUM_SEARCH_STATES )
    {
        // Initialize the local values needed by this operation.

        const state = heap.pop ( performanceCounters );


        // Handle the case where state matches undefined.

        if ( state === undefined )
        {
            break;
        }

        // Initialize the local values needed by this operation.

        const key      = stateIdentifier ( state.nodeIndex, state.direction );
        const bestCost = costs.get ( key );

        // Handle the case where at least one branch condition is satisfied.

        if ( bestCost === undefined || bestCost.bends !== state.cost.bends ||
            bestCost.crossings !== state.cost.crossings || bestCost.length !== state.cost.length )
        {
            continue;
        }

        // Handle the case where state node index matches graph target.

        if ( state.nodeIndex === graph.target )
        {
            winningKey = key;
            break;
        }

        expandedStateCount += 1;


        // Handle the case where all required conditions are satisfied.

        if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined )
        {
            performanceCounters.aStarExpandedStateCount += 1;
        }

        const sourcePoint = graph.points [ state.nodeIndex ];

        // Handle the case where source point matches undefined.

        if ( sourcePoint === undefined )
        {
            continue;
        }

        // Process each neighbour index from the current value collection in order.

        for ( const neighbourIndex of graph.adjacency [ state.nodeIndex ] ?? [] )
        {
            // Initialize the local values needed by this operation.

            const target = graph.points [ neighbourIndex ];

            // Handle the case where target matches undefined.

            if ( target === undefined )
            {
                continue;
            }

            // Initialize the local values needed by this operation.

            const direction     = edgeDirection ( sourcePoint, target );
            const candidateCost = {
                bends: state.cost.bends + ( state.direction === "none" || state.direction === direction ? 0 : 1 ),
                crossings: state.cost.crossings + segmentCrossingCount (
                    sourcePoint,
                    target,
                    acceptedRouteIndex,
                    relationIndex,
                    performanceCounters,
                ),
                length: state.cost.length + manhattanDistance ( sourcePoint, target ),
            };
            const candidateKey = stateIdentifier ( neighbourIndex, direction );

            // Handle the case where the cost is better result condition is not satisfied.

            if ( !costIsBetter ( candidateCost, costs.get ( candidateKey ) ) )
            {
                continue;
            }

            costs.set ( candidateKey, candidateCost );
            previous.set ( candidateKey, key );
            heap.push ( {
                cost: candidateCost,
                direction,
                nodeIndex: neighbourIndex,
                priority: candidateCost.length + manhattanDistance ( target, targetPoint ),
            }, performanceCounters );
        }
    }

    // Handle the case where winning key matches an absent value.

    if ( winningKey === null )
    {
        // Return the computed result.

        return null;
    }

    // Initialize the local values needed by this operation.

    const path: ChartRoutingPoint[]    = [];
    let currentKey: string | undefined = winningKey;

    // Continue the operation while its terminating condition has not been reached.

    while ( currentKey !== undefined )
    {
        // Initialize the local values needed by this operation.

        const nodeIndex = Number ( currentKey.split ( ":", 1 ) [ 0 ] );
        const point     = graph.points [ nodeIndex ];

        // Handle the case where point differs from undefined.

        if ( point !== undefined )
        {
            path.push ( point );
        }

        currentKey = previous.get ( currentKey );
    }

    // Return the compact points result.

    return compactPoints ( path.reverse () );
}

// An obstacle inflated past a route endpoint contains that endpoint, which removes it from the
// visibility lattice and makes the relation unroutable. The preferred rail offset is therefore
// reduced, per obstacle, to the largest offset that still leaves both endpoints outside the
// inflated rectangle. An obstacle whose RAW rectangle already contains an endpoint cannot be
// rescued by any clearance, because the lattice filter tests the raw rectangle; routeRelation
// excludes those obstacles before calling this function, so the zero case here is reached only at
// the boundary.

//--------------------------------------------------------------------------------------------------
// Function: endpointSafeClearance
//
// Description:
//
//   Derives the endpoint safe clearance.
//
// Parameters:
//
//   - rectangle:
//     The rectangle supplied to the operation.
//
//   - source:
//     The source supplied to the operation.
//
//   - target:
//     The target supplied to the operation.
//
//   - requestedClearance:
//     The requested clearance supplied to the operation.
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

function endpointSafeClearance (
    rectangle:          ChartRoutingRectangle,
    source:             ChartRoutingPoint,
    target:             ChartRoutingPoint,
    requestedClearance: number,
): number
{
    //----------------------------------------------------------------------------------------------
    // Function: escapeDistance
    //
    // Description:
    //
    //   Derives the escape distance.
    //
    // Parameters:
    //
    //   - point:
    //     The point supplied to the operation.
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

    function escapeDistance ( point: ChartRoutingPoint ): number
    {
        // Return the max result.

        return Math.max (
            rectangle.x - point.x,
            point.x - ( rectangle.x + rectangle.width ),
            rectangle.y - point.y,
            point.y - ( rectangle.y + rectangle.height ),
        );
    }

    const nearestEscapeDistance = Math.min ( escapeDistance ( source ), escapeDistance ( target ) );

    // Return the result selected by the current condition.

    return nearestEscapeDistance <= 0
        ? 0
        : Math.min ( requestedClearance, Math.max ( 0, nearestEscapeDistance - ENDPOINT_CLEARANCE_MARGIN ) );
}


//--------------------------------------------------------------------------------------------------
// Function: exactOneBendBackbone
//
// Description:
//
//   Derives the exact one bend backbone.
//
// Parameters:
//
//   - source:
//     The source supplied to the operation.
//
//   - target:
//     The target supplied to the operation.
//
//   - inflatedObstacles:
//     The inflated obstacles supplied to the operation.
//
//   - inflatedObstacleIndex:
//     The inflated obstacle index supplied to the operation.
//
//   - proofObstacles:
//     The proof obstacles supplied to the operation.
//
//   - proofObstacleIndex:
//     The proof obstacle index supplied to the operation.
//
//   - acceptedRouteIndex:
//     The accepted route index supplied to the operation.
//
//   - relationIndex:
//     The relation index supplied to the operation.
//
//   - transitionGravityPointDistance:
//     The transition gravity point distance supplied to the operation.
//
//   - reuseCache:
//     The reuse cache supplied to the operation.
//
//   - performanceCounters:
//     The performance counters supplied to the operation.
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

function exactOneBendBackbone (
    source: ChartRoutingPoint,
    target: ChartRoutingPoint,
    inflatedObstacles: readonly ChartRoutingRectangle[],
    inflatedObstacleIndex: ChartRoutingSpatialQuery<ChartRoutingRectangle>,
    proofObstacles: readonly ChartRoutingRectangle[],
    proofObstacleIndex: ChartRoutingSpatialQuery<ChartRoutingRectangle>,
    acceptedRouteIndex: ChartRoutingSpatialQuery<ChartRoutingSegment>,
    relationIndex: number,
    transitionGravityPointDistance: number,
    reuseCache: ChartRoutingReuseCache,
    performanceCounters?: ChartRoutingPerformanceCounters,
): ChartRoutingPoint[] | null
{
    // Handle the case where at least one branch condition is satisfied.

    if ( source.x === target.x || source.y === target.y )
    {
        // Return the computed result.

        return null;
    }


    // Calculate the candidates value from the current inputs.

    const candidates = [
        [ source, { x: target.x, y: source.y }, target ],
        [ source, { x: source.x, y: target.y }, target ],
    ].flatMap ( ( points, candidateIndex ) =>
    {
        // Initialize the local values needed by this operation.

        const bend = points [ 1 ];


        // Handle the case where at least one branch condition is satisfied.

        if ( bend === undefined ||
            !segmentIsClear ( source, bend, inflatedObstacles, performanceCounters, inflatedObstacleIndex ) ||
            !segmentIsClear ( bend, target, inflatedObstacles, performanceCounters, inflatedObstacleIndex ) )
        {
            // Return the assembled result collection.

            return [];
        }


        // Initialize the local values needed by this operation.

        const curveFitStartMilliseconds = monotonicMilliseconds ();
        const fittedPoints              = fitCubicDetourClearance (
            points,
            proofObstacles,
            transitionGravityPointDistance,
            performanceCounters,
            proofObstacleIndex,
            reuseCache,
        );


        // Handle the case where all required conditions are satisfied.

        if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined )
        {
            performanceCounters.curveFitMilliseconds += monotonicMilliseconds () - curveFitStartMilliseconds;
        }


        // Return the result selected by the current condition.

        return fittedPoints === null
            ? []
            : [ {
                candidateIndex,
                crossingCount: routeCrossingCount (
                    fittedPoints,
                    acceptedRouteIndex,
                    relationIndex,
                    performanceCounters,
                ),
                points: fittedPoints,
            } ];
    } );


    // Return the computed result.

    return candidates.sort ( ( left, right ) =>
        left.crossingCount - right.crossingCount || left.candidateIndex - right.candidateIndex ) [ 0 ]?.points ?? null;
}


//--------------------------------------------------------------------------------------------------
// Function: searchCurveClearBackbone
//
// Description:
//
//   Derives the search curve clear backbone.
//
// Parameters:
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
//   - proofObstacles:
//     The proof obstacles supplied to the operation.
//
//   - acceptedRouteIndex:
//     The accepted route index supplied to the operation.
//
//   - relationIndex:
//     The relation index supplied to the operation.
//
//   - obstacleClearances:
//     The obstacle clearances supplied to the operation.
//
//   - transitionGravityPointDistance:
//     The transition gravity point distance supplied to the operation.
//
//   - routingOptions:
//     The routing options supplied to the operation.
//
//   - reuseCache:
//     The reuse cache supplied to the operation.
//
//   - performanceCounters:
//     The performance counters supplied to the operation.
//
//   - proofObstacleIndex:
//     The proof obstacle index supplied to the operation.
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

function* searchCurveClearBackbone (
    source: ChartRoutingPoint,
    target: ChartRoutingPoint,
    obstacles: readonly ChartRoutingRectangle[],
    proofObstacles: readonly ChartRoutingRectangle[],
    acceptedRouteIndex: ChartRoutingSpatialQuery<ChartRoutingSegment>,
    relationIndex: number,
    obstacleClearances: readonly number[],
    transitionGravityPointDistance: number,
    routingOptions: RoutingOptimizationOptions,
    reuseCache: ChartRoutingReuseCache,
    performanceCounters?: ChartRoutingPerformanceCounters,
    proofObstacleIndex?: ChartRoutingSpatialQuery<ChartRoutingRectangle>,
): Generator<ChartRoutingCancellationCheckpoint, CurveClearSearchResult, void>
{
    // Initialize the local values needed by this operation.

    const searchClearances: number[] = obstacles.map ( ( _, obstacleIndex ) =>
        obstacleClearances [ obstacleIndex ] ?? transitionGravityPointDistance );
    let rejectedUnsafeBackbone = false;

    // Repeat the operation across the bounded iteration range.

    for ( let searchIndex = 0; searchIndex < MAXIMUM_CURVE_CLEARANCE_SEARCH_COUNT; searchIndex += 1 )
    {
        yield "clearance-retry";


        // Handle the case where all required conditions are satisfied.

        if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined && searchIndex > 0 )
        {
            performanceCounters.clearanceRetryCount += 1;
        }


        // Initialize the local values needed by this operation.

        const searchObstacles = obstacles.map ( ( obstacle, obstacleIndex ) =>
            inflateRectangle (
                obstacle,
                searchClearances [ obstacleIndex ] ?? transitionGravityPointDistance,
            ) );
        const graph = buildVisibilityGraph (
            source,
            target,
            searchObstacles,
            routingOptions.visibilityGraphStrategy,
            performanceCounters,
            reuseCache,
        );


        // Handle the case where graph matches an absent value.

        if ( graph === null )
        {
            // Return the assembled result.

            return { points: null, rejectedUnsafeBackbone };
        }

        // Initialize the local values needed by this operation.

        const searchedBackbone = searchVisibilityGraph (
            graph,
            acceptedRouteIndex,
            relationIndex,
            performanceCounters,
        );
        const curveFitStartMilliseconds = monotonicMilliseconds ();
        const fittedBackbone            = searchedBackbone === null
            ? null
            : fitCubicDetourClearance (
                searchedBackbone,
                proofObstacles,
                transitionGravityPointDistance,
                performanceCounters,
                proofObstacleIndex,
                reuseCache,
            );


        // Handle the case where all required conditions are satisfied.

        if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined )
        {
            performanceCounters.curveFitMilliseconds += monotonicMilliseconds () - curveFitStartMilliseconds;
        }


        // Handle the case where fitted backbone differs from an absent value.

        if ( fittedBackbone !== null )
        {
            // Return the assembled result.

            return { points: fittedBackbone, rejectedUnsafeBackbone };
        }

        // Handle the case where searched backbone matches an absent value.

        if ( searchedBackbone === null )
        {
            // Return the assembled result.

            return { points: null, rejectedUnsafeBackbone };
        }

        rejectedUnsafeBackbone = true;

        let clearanceExpanded = false;

        proofObstacles.forEach ( ( obstacle, obstacleIndex ) =>
        {
            // Initialize the local values needed by this operation.

            const curveProofStartMilliseconds = monotonicMilliseconds ();
            const isClear                     = routingBackboneIsClearOfObstacles (
                searchedBackbone,
                [ obstacle ],
                performanceCounters,
                undefined,
                reuseCache,
            );


            // Handle the case where all required conditions are satisfied.

            if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined )
            {
                performanceCounters.curveFitMilliseconds += monotonicMilliseconds () - curveProofStartMilliseconds;
            }


            // Handle the case where is clear is enabled.

            if ( isClear )
            {
                // Return control to the caller.

                return;
            }

            searchClearances [ obstacleIndex ] =
                ( searchClearances [ obstacleIndex ] ?? transitionGravityPointDistance ) * 2;
            clearanceExpanded = true;
        } );

        // Handle the case where the clearance expanded condition is not satisfied.

        if ( !clearanceExpanded )
        {
            // A curve chain can fail only under the combined obstacle set even though a different
            // shortcut makes it pass when each obstacle is tested alone. Widen the complete search
            // lattice in that case so the next shortest-path pass gives every required turn enough
            // room for a jointly certified cubic chain.

            searchClearances.forEach ( ( clearance, obstacleIndex ) =>
            {
                searchClearances [ obstacleIndex ] = clearance * 2;
            } );
        }
    }

    // Return the assembled result.

    return { points: null, rejectedUnsafeBackbone };
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
//   - performanceCounters:
//     The performance counters supplied to the operation.
//
//   - obstacleIndex:
//     The obstacle index supplied to the operation.
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
    points: readonly ChartRoutingPoint[],
    obstacles: readonly ChartRoutingRectangle[],
    performanceCounters?: ChartRoutingPerformanceCounters,
    obstacleIndex?: ChartRoutingSpatialQuery<ChartRoutingRectangle>,
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
            // Initialize the local values needed by this operation.

            const candidates = obstacleIndex?.query (
                chartRoutingSpatialBoundsFromSegment ( source, target ),
            ) ?? obstacles;

            count += candidates.filter ( obstacle =>
            {
                // Handle the case where all required conditions are satisfied.

                if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined )
                {
                    performanceCounters.broadPhaseCandidateCount += 1;
                    performanceCounters.exactObstacleTestCount += 1;
                }


                // Return the segment intersects rectangle result.

                return segmentIntersectsRectangle ( source, target, obstacle );
            } ).length;
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

function routeLength ( points: readonly ChartRoutingPoint[] ): number
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
            length += manhattanDistance ( source, target );
        }
    }

    // Return the length.

    return length;
}

//--------------------------------------------------------------------------------------------------
// Function: exteriorRoute
//
// Description:
//
//   Derives the exterior route.
//
// Parameters:
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
//   - relationIndex:
//     The relation index supplied to the operation.
//
//   - acceptedRouteIndex:
//     The accepted route index supplied to the operation.
//
//   - transitionGravityPointDistance:
//     The transition gravity point distance supplied to the operation.
//
//   - reuseCache:
//     The reuse cache supplied to the operation.
//
//   - performanceCounters:
//     The performance counters supplied to the operation.
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

function exteriorRoute (
    source: ChartRoutingPoint,
    target: ChartRoutingPoint,
    obstacles: readonly ChartRoutingRectangle[],
    relationIndex: number,
    acceptedRouteIndex: ChartRoutingSpatialQuery<ChartRoutingSegment>,
    transitionGravityPointDistance: number,
    reuseCache: ChartRoutingReuseCache,
    performanceCounters?: ChartRoutingPerformanceCounters,
): ExteriorRouteResult
{
    // Initialize the local values needed by this operation.

    const obstacleIndex = packedRectangleIndex ( obstacles, performanceCounters );
    const laneOffset    = transitionGravityPointDistance * 2 + relationIndex * EXTERIOR_LANE_SPACING;
    const minimumX      = Math.min ( source.x, target.x, ...obstacles.map ( obstacle => obstacle.x ) ) - laneOffset;
    const maximumX      = Math.max ( source.x, target.x,
        ...obstacles.map ( obstacle => obstacle.x + obstacle.width ) ) + laneOffset;
    const minimumY = Math.min ( source.y, target.y, ...obstacles.map ( obstacle => obstacle.y ) ) - laneOffset;
    const maximumY = Math.max ( source.y, target.y,
        ...obstacles.map ( obstacle => obstacle.y + obstacle.height ) ) + laneOffset;
    const candidates = [
        [ source, { x: source.x, y: minimumY }, { x: target.x, y: minimumY }, target ],
        [ source, { x: maximumX, y: source.y }, { x: maximumX, y: target.y }, target ],
        [ source, { x: source.x, y: maximumY }, { x: target.x, y: maximumY }, target ],
        [ source, { x: minimumX, y: source.y }, { x: minimumX, y: target.y }, target ],
    ];
    const compactedCandidates = candidates.map ( ( points, index ) => ( {
        index,
        points: compactPoints ( points ),
    } ) );
    const provenCandidates = compactedCandidates.flatMap ( candidate =>
    {
        // Initialize the local values needed by this operation.

        const curveFitStartMilliseconds = monotonicMilliseconds ();
        const fittedPoints              = fitCubicDetourClearance (
            candidate.points,
            obstacles,
            transitionGravityPointDistance,
            performanceCounters,
            obstacleIndex,
            reuseCache,
        );


        // Handle the case where all required conditions are satisfied.

        if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined )
        {
            performanceCounters.curveFitMilliseconds += monotonicMilliseconds () - curveFitStartMilliseconds;
        }


        // Return the result selected by the current condition.

        return fittedPoints === null ? [] : [ { ...candidate, points: fittedPoints } ];
    } );
    const rankedCandidates = provenCandidates.length > 0 ? provenCandidates : compactedCandidates;

    // Return the assembled result.

    return {
        points: rankedCandidates
            .sort ( ( left, right ) =>
                routeIntersectionCount ( left.points, obstacles, performanceCounters, obstacleIndex ) -
                    routeIntersectionCount ( right.points, obstacles, performanceCounters, obstacleIndex ) ||
                routeLength ( left.points ) - routeLength ( right.points ) ||
                left.points.length - right.points.length ||
                routeCrossingCount ( left.points, acceptedRouteIndex, relationIndex, performanceCounters ) -
                    routeCrossingCount ( right.points, acceptedRouteIndex, relationIndex, performanceCounters ) ||
                left.index - right.index ) [ 0 ]?.points ?? [ source, target ],
        proven: provenCandidates.length > 0,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: labelCandidateFractions
//
// Description:
//
//   Derives the label candidate fractions.
//
// Parameters:
//
//   - preferredFraction:
//     The preferred fraction supplied to the operation.
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

function labelCandidateFractions ( preferredFraction: number ): number[]
{
    // Initialize the local values needed by this operation.

    const boundedPreferredFraction = Math.max ( 0, Math.min ( 1, preferredFraction ) );
    const fractions                = [
        boundedPreferredFraction,
        ...Array.from ( { length: LABEL_CANDIDATE_INTERVAL_COUNT + 1 },
            ( _, index ) => index / LABEL_CANDIDATE_INTERVAL_COUNT ),
    ].filter ( ( fraction, index, allFractions ) => allFractions.indexOf ( fraction ) === index );

    // Return the sort result.

    return fractions.sort ( ( left, right ) =>
    {
        // Calculate the distance difference value from the current inputs.

        const distanceDifference = Math.abs ( left - boundedPreferredFraction ) -
            Math.abs ( right - boundedPreferredFraction );

        // Return the result selected by the current condition.

        return distanceDifference !== 0
            ? distanceDifference
            : boundedPreferredFraction >= 0.75 ? right - left : left - right;
    } );
}

//--------------------------------------------------------------------------------------------------
// Function: labelRectangle
//
// Description:
//
//   Derives the label rectangle.
//
// Parameters:
//
//   - center:
//     The center supplied to the operation.
//
//   - width:
//     The width supplied to the operation.
//
//   - height:
//     The height supplied to the operation.
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

function labelRectangle (
    center: ChartRoutingPoint,
    width: number,
    height: number,
): ChartRoutingRectangle
{
    // Return the assembled result.

    return { x: center.x - width / 2, y: center.y - height / 2, width, height };
}

//--------------------------------------------------------------------------------------------------
// Function: placeLabel
//
// Description:
//
//   Places the label.
//
// Parameters:
//
//   - relation:
//     The relation supplied to the operation.
//
//   - points:
//     The points supplied to the operation.
//
//   - curves:
//     The curves supplied to the operation.
//
//   - acceptedLabels:
//     The accepted labels supplied to the operation.
//
//   - acceptedLabelIndex:
//     The accepted label index supplied to the operation.
//
//   - relationIndex:
//     The relation index supplied to the operation.
//
//   - performanceCounters:
//     The performance counters supplied to the operation.
//
//   - labelObstacleIndex:
//     The label obstacle index supplied to the operation.
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

function placeLabel (
    relation: ChartRoutingRelation,
    points: readonly ChartRoutingPoint[],
    curves: readonly ChartRoutingCubicCurve[],
    acceptedLabels: readonly ChartRoutingRectangle[],
    acceptedLabelIndex: ChartRoutingSpatialQuery<ChartRoutingRectangle>,
    relationIndex: number,
    performanceCounters?: ChartRoutingPerformanceCounters,
    labelObstacleIndex?: ChartRoutingSpatialQuery<ChartRoutingRectangle>,
): { readonly exteriorFallback: boolean; readonly rectangle: ChartRoutingRectangle }
{
    // Handle the case where at least one branch condition is satisfied.

    if ( relation.labelWidth === 0 || relation.labelHeight === 0 )
    {
        // Initialize the local values needed by this operation.

        const source = points [ 0 ] ?? { x: 0, y: 0 };

        // Return the assembled result.

        return {
            exteriorFallback: false,
            rectangle: { ...source, width: 0, height: 0 },
        };
    }

    // Initialize the local values needed by this operation.

    const sourceCenter  = points [ 0 ];
    const targetCenter  = points.at ( -1 );
    const visibleCurves = relation.sourceBoundary === undefined || relation.targetBoundary === undefined ||
        sourceCenter === undefined || targetCenter === undefined
        ? curves
        : clipCubicBezierCurvesToBoundaries (
            curves,
            {
                sourceBoundary: relation.sourceBoundary,
                sourceCenter,
                targetBoundary: relation.targetBoundary,
                targetCenter,
            },
        ) ?? curves;
    const curveSamplePoints = cubicBezierCurveSamplePoints ( visibleCurves );


    // Process each fraction from the label candidate fractions result collection in order.

    for ( const fraction of labelCandidateFractions ( relation.labelPosition ) )
    {
        // Handle the case where all required conditions are satisfied.

        if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined )
        {
            performanceCounters.labelCandidateCount += 1;
        }


        // Initialize the local values needed by this operation.

        const rectangle = labelRectangle (
            pointAlongSampledCurve ( curveSamplePoints, fraction ),
            relation.labelWidth,
            relation.labelHeight,
        );

        const rectangleBounds = chartRoutingSpatialBoundsFromRectangle ( rectangle );

        //------------------------------------------------------------------------------------------
        // Function: labelIsClearOfObstacle
        //
        // Description:
        //
        //   Derives the label is clear of obstacle.
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
        //------------------------------------------------------------------------------------------

        const labelIsClearOfObstacle = ( obstacle: ChartRoutingRectangle ): boolean =>
        {
            // Handle the case where all required conditions are satisfied.

            if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined )
            {
                performanceCounters.broadPhaseCandidateCount += 1;
                performanceCounters.exactLabelTestCount += 1;
            }


            // Return the computed result.

            return !rectanglesIntersect ( rectangle, obstacle );
        };
        const clearOfLabelObstacles = labelObstacleIndex === undefined
            ? relation.labelObstacles.every ( labelIsClearOfObstacle )
            : labelObstacleIndex.visit ( rectangleBounds, labelIsClearOfObstacle );


        // Handle the case where all required conditions are satisfied.

        if ( clearOfLabelObstacles && acceptedLabelIndex.visit ( rectangleBounds, labelIsClearOfObstacle ) )
        {
            // Return the assembled result.

            return { exteriorFallback: false, rectangle };
        }
    }

    // Initialize the local values needed by this operation.

    const maximumX            = Math.max ( 0, ...relation.labelObstacles.map ( obstacle => obstacle.x + obstacle.width ) );
    const minimumY            = Math.min ( 0, ...relation.labelObstacles.map ( obstacle => obstacle.y ) );
    const acceptedLabelBottom = Math.max ( minimumY,
        ...acceptedLabels.map ( accepted => accepted.y + accepted.height + ROUTE_CLEARANCE ) );

    // Return the assembled result.

    return {
        exteriorFallback: true,
        rectangle:
        {
            x: maximumX + ROUTE_CLEARANCE * 2,
            y: Math.max ( acceptedLabelBottom, minimumY + relationIndex * ( relation.labelHeight + ROUTE_CLEARANCE ) ),
            width: relation.labelWidth,
            height: relation.labelHeight,
        },
    };
}

//--------------------------------------------------------------------------------------------------
// Function: routeRelation
//
// Description:
//
//   Routes the relation.
//
// Parameters:
//
//   - relation:
//     The relation supplied to the operation.
//
//   - relationIndex:
//     The relation index supplied to the operation.
//
//   - acceptedLabels:
//     The accepted labels supplied to the operation.
//
//   - acceptedLabelIndex:
//     The accepted label index supplied to the operation.
//
//   - acceptedRouteIndex:
//     The accepted route index supplied to the operation.
//
//   - transitionGravityPointDistance:
//     The transition gravity point distance supplied to the operation.
//
//   - routingOptions:
//     The routing options supplied to the operation.
//
//   - reuseCache:
//     The reuse cache supplied to the operation.
//
//   - obstacleClearances:
//     The obstacle clearances supplied to the operation.
//
//   - performanceCounters:
//     The performance counters supplied to the operation.
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

function* routeRelation (
    relation: ChartRoutingRelation,
    relationIndex: number,
    acceptedLabels: readonly ChartRoutingRectangle[],
    acceptedLabelIndex: ChartRoutingSpatialQuery<ChartRoutingRectangle>,
    acceptedRouteIndex: ChartRoutingSpatialQuery<ChartRoutingSegment>,
    transitionGravityPointDistance: number,
    routingOptions: RoutingOptimizationOptions,
    reuseCache: ChartRoutingReuseCache,
    obstacleClearances?: readonly number[],
    performanceCounters?: ChartRoutingPerformanceCounters,
): Generator<ChartRoutingCancellationCheckpoint, ChartRoutingResultRelation, void>
{
    // Initialize the local values needed by this operation.

    const preferredPoints          = compactPoints ( relation.preferredPoints );
    const source                   = preferredPoints [ 0 ] ?? { x: 0, y: 0 };
    const target                   = preferredPoints.at ( -1 ) ?? source;
    const relationObstacleIndex    = packedRectangleIndex ( relation.obstacles, performanceCounters );
    const sourceObstacleCandidates = new Set ( relationObstacleIndex.query (
        chartRoutingSpatialBoundsFromPoint ( source ),
    ) );
    const targetObstacleCandidates = new Set ( relationObstacleIndex.query (
        chartRoutingSpatialBoundsFromPoint ( target ),
    ) );

    // An obstacle that strictly contains one of this relation's own endpoints cannot be honoured at
    // all. buildVisibilityGraph discards every lattice point lying inside an obstacle, so such an
    // obstacle removes this relation's own source or target, returns a null graph, and produces a
    // diagnostic exterior fallback that no later stage can recover -- the search never ran, so
    // rejectedUnsafeBackbone stays false and clean exterior recovery cannot apply. Dropping the
    // obstacle for this relation only is strictly better than being unroutable, and it makes the
    // router robust against any obstacle source that overstates its geometry. Clearance clamping
    // alone is not sufficient here: a clamped clearance of zero leaves the raw rectangle in the
    // list, and the raw rectangle is what the lattice filter tests.

    const routableObstacles = relation.obstacles.flatMap ( ( obstacle, obstacleIndex ) =>
    {
        // Handle the case where all required conditions are satisfied.

        if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined &&
            sourceObstacleCandidates.has ( obstacle ) )
        {
            performanceCounters.broadPhaseCandidateCount += 1;
            performanceCounters.exactObstacleTestCount += 1;
        }

        const containsSource = sourceObstacleCandidates.has ( obstacle ) && pointInsideRectangle ( source, obstacle );


        // Handle the case where all required conditions are satisfied.

        if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined && !containsSource &&
            targetObstacleCandidates.has ( obstacle ) )
        {
            performanceCounters.broadPhaseCandidateCount += 1;
            performanceCounters.exactObstacleTestCount += 1;
        }


        // Return the result selected by the current condition.

        return containsSource || targetObstacleCandidates.has ( obstacle ) && pointInsideRectangle ( target, obstacle )
            ? []
            : [ {
                obstacle,
                requestedClearance: obstacleClearances?.[ obstacleIndex ] ?? transitionGravityPointDistance,
            } ];
    } );
    const searchObstacles = routableObstacles.map ( entry => entry.obstacle );

    // The gravity preference is the preferred rail offset, so it is clamped per obstacle so that
    // inflation cannot swallow an endpoint. The rendered-curve clearance proof is a correctness
    // bound and always uses the fixed route clearance instead.

    const effectiveObstacleClearances = routableObstacles.map ( entry =>
        endpointSafeClearance ( entry.obstacle, source, target, entry.requestedClearance ) );
    const inflatedObstacles = routableObstacles.map ( ( entry, obstacleIndex ) =>
        inflateRectangle (
            entry.obstacle,
            effectiveObstacleClearances [ obstacleIndex ] ?? transitionGravityPointDistance,
        ) );
    const proofObstacles = searchObstacles.map ( obstacle =>
        inflateRectangle ( obstacle, ROUTE_CLEARANCE ) );
    const inflatedObstacleIndex = packedRectangleIndex ( inflatedObstacles, performanceCounters );
    const proofObstacleIndex    = packedRectangleIndex ( proofObstacles, performanceCounters );
    const labelObstacleIndex    = packedRectangleIndex ( relation.labelObstacles, performanceCounters );
    const requestedDirectPoints = compactPoints ( [ source, target ] );
    const directSegmentClear    = !relation.preservePreferred && directSegmentIsClear (
        source,
        target,
        inflatedObstacles,
        performanceCounters,
        inflatedObstacleIndex,
    );
    const directCurveFitStartMilliseconds = monotonicMilliseconds ();
    const directCurveClear                = directSegmentClear && cubicBezierCurvesFromBackbone (
        requestedDirectPoints,
        proofObstacles,
        performanceCounters,
        proofObstacleIndex,
        reuseCache,
    ).length > 0;


    // Handle the case where all required conditions are satisfied.

    if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined && directSegmentClear )
    {
        performanceCounters.curveFitMilliseconds += monotonicMilliseconds () - directCurveFitStartMilliseconds;
    }


    // Initialize the local values needed by this operation.

    const directPoints  = directCurveClear ? requestedDirectPoints : null;
    const oneBendPoints = relation.preservePreferred || directPoints !== null || !routingOptions.exactFastPaths
        ? null
        : exactOneBendBackbone (
            source,
            target,
            inflatedObstacles,
            inflatedObstacleIndex,
            proofObstacles,
            proofObstacleIndex,
            acceptedRouteIndex,
            relationIndex,
            transitionGravityPointDistance,
            reuseCache,
            performanceCounters,
        );
    const searchResult = relation.preservePreferred || directPoints !== null || oneBendPoints !== null
        ? { points: null, rejectedUnsafeBackbone: false }
        : yield* searchCurveClearBackbone (
            source,
            target,
            searchObstacles,
            proofObstacles,
            acceptedRouteIndex,
            relationIndex,
            effectiveObstacleClearances,
            transitionGravityPointDistance,
            routingOptions,
            reuseCache,
            performanceCounters,
            proofObstacleIndex,
        );
    const ordinaryPoints = directPoints ?? oneBendPoints ?? searchResult.points;
    const exteriorResult = relation.preservePreferred || ordinaryPoints !== null
        ? null
        : exteriorRoute (
            source,
            target,
            proofObstacles,
            relationIndex,
            acceptedRouteIndex,
            transitionGravityPointDistance,
            reuseCache,
            performanceCounters,
        );
    const cleanExteriorRecovery = searchResult.rejectedUnsafeBackbone && exteriorResult?.proven === true;
    const exteriorFallback      = !relation.preservePreferred && ordinaryPoints === null && !cleanExteriorRecovery;
    const points                = relation.preservePreferred
        ? preferredPoints
        : ordinaryPoints ?? exteriorResult?.points ?? [ source, target ];
    const curveFitStartMilliseconds = monotonicMilliseconds ();
    const requestedCurves           = relation.preservePreferred
        ? cubicBezierCurvesFromPreservedBackbone ( points )
        : cubicBezierCurvesFromBackbone (
            points,
            proofObstacles,
            performanceCounters,
            proofObstacleIndex,
            reuseCache,
        );


    // Handle the case where all required conditions are satisfied.

    if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined )
    {
        performanceCounters.curveFitMilliseconds += monotonicMilliseconds () - curveFitStartMilliseconds;
    }


    // Initialize the local values needed by this operation.

    const curves = requestedCurves.length > 0
        ? requestedCurves
        : cubicBezierCurvesFromPreservedBackbone ( points );
    const labelStartMilliseconds = monotonicMilliseconds ();
    const label                  = placeLabel (
        relation,
        points,
        curves,
        acceptedLabels,
        acceptedLabelIndex,
        relationIndex,
        performanceCounters,
        labelObstacleIndex,
    );


    // Handle the case where all required conditions are satisfied.

    if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined )
    {
        performanceCounters.labelPlacementMilliseconds += monotonicMilliseconds () - labelStartMilliseconds;
    }


    // Return the assembled result.

    return {
        curves,
        exteriorFallback: exteriorFallback || label.exteriorFallback,
        identifier: relation.identifier,
        label: label.rectangle,
        points,
    };
}


//--------------------------------------------------------------------------------------------------
// Function: firstPassRelationCanBeRetained
//
// Description:
//
//   Derives the first pass relation can be retained.
//
// Parameters:
//
//   - initialResult:
//     The initial result supplied to the operation.
//
//   - relationIndex:
//     The relation index supplied to the operation.
//
//   - unrelatedLabels:
//     The unrelated labels supplied to the operation.
//
//   - firstPassRouteIndex:
//     The first pass route index supplied to the operation.
//
//   - repairedLabelIndex:
//     The repaired label index supplied to the operation.
//
//   - reuseCache:
//     The reuse cache supplied to the operation.
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

function firstPassRelationCanBeRetained (
    initialResult: ChartRoutingResultRelation,
    relationIndex: number,
    unrelatedLabels: readonly ChartRoutingRectangle[],
    firstPassRouteIndex: ChartRoutingSpatialQuery<ChartRoutingSegment>,
    repairedLabelIndex: ChartRoutingSpatialQuery<ChartRoutingRectangle>,
    reuseCache: ChartRoutingReuseCache,
    performanceCounters?: ChartRoutingPerformanceCounters,
): boolean
{
    // Handle the case where initial result exterior fallback is enabled.

    if ( initialResult.exteriorFallback )
    {
        // Return the computed result.

        return false;
    }


    // Initialize the local values needed by this operation.

    const inflatedLabels     = unrelatedLabels.map ( label => inflateRectangle ( label, ROUTE_CLEARANCE ) );
    const inflatedLabelIndex = packedRectangleIndex ( inflatedLabels, performanceCounters );


    // Handle the case where at least one branch condition is satisfied.

    if ( !cubicBezierCurvesAreClearOfObstacles (
        initialResult.curves,
        inflatedLabels,
        performanceCounters,
        inflatedLabelIndex,
        reuseCache,
    ) || routeCrossingCount (
        initialResult.points,
        firstPassRouteIndex,
        relationIndex,
        performanceCounters,
    ) > 0 )
    {
        // Return the computed result.

        return false;
    }


    // Handle the case where at least one branch condition is satisfied.

    if ( initialResult.label.width === 0 || initialResult.label.height === 0 )
    {
        // Return the computed result.

        return true;
    }


    // Return the visit result.

    return repairedLabelIndex.visit (
        chartRoutingSpatialBoundsFromRectangle ( initialResult.label ),
        repairedLabel =>
        {
            // Handle the case where all required conditions are satisfied.

            if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined )
            {
                performanceCounters.broadPhaseCandidateCount += 1;
                performanceCounters.exactLabelTestCount += 1;
            }


            // Return the computed result.

            return !rectanglesIntersect ( initialResult.label, repairedLabel );
        },
    );
}


//--------------------------------------------------------------------------------------------------
// Function: routeChartRelationsGenerator
//
// Description:
//
//   Routes the chart relations generator.
//
// Parameters:
//
//   - request:
//     The request supplied to the operation.
//
//   - routingOptions:
//     The routing options supplied to the operation.
//
//   - performanceCounters:
//     The performance counters supplied to the operation.
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

function* routeChartRelationsGenerator (
    request: ChartRoutingRequest,
    routingOptions: RoutingOptimizationOptions,
    performanceCounters?: ChartRoutingPerformanceCounters,
    reuseCache: ChartRoutingReuseCache = new ChartRoutingReuseCache (),
): Generator<ChartRoutingCancellationCheckpoint, ChartRoutingResult, void>
{
    // Initialize the local values needed by this operation.

    const requestStartMilliseconds = monotonicMilliseconds ();


    // Handle the case where all required conditions are satisfied.

    if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined )
    {
        performanceCounters.relationCount += request.relations.length;
    }


    // Initialize the local values needed by this operation.

    const acceptedLabels: ChartRoutingRectangle[]        = [];
    const acceptedLabelIndex                             = new AppendChartRoutingSpatialIndex<ChartRoutingRectangle> ();
    const acceptedRouteIndex                             = new AppendChartRoutingSpatialIndex<ChartRoutingSegment> ();
    const passOneStartMilliseconds                       = monotonicMilliseconds ();
    const initialRelations: ChartRoutingResultRelation[] = [];

    yield "pass";


    // Repeat the operation across the bounded iteration range.

    for ( let relationIndex = 0; relationIndex < request.relations.length; relationIndex += 1 )
    {
        // Initialize the local values needed by this operation.

        const relation = request.relations [ relationIndex ];


        // Handle the case where relation matches undefined.

        if ( relation === undefined )
        {
            continue;
        }

        yield "relation";

        const result = yield* routeRelation (
            relation,
            relationIndex,
            acceptedLabels,
            acceptedLabelIndex,
            acceptedRouteIndex,
            request.transitionGravityPointDistance,
            routingOptions,
            reuseCache,
            undefined,
            performanceCounters,
        );

        // Handle the case where all required conditions are satisfied.

        if ( result.label.width > 0 && result.label.height > 0 )
        {
            acceptedLabels.push ( result.label );
            acceptedLabelIndex.append ( {
                bounds: chartRoutingSpatialBoundsFromRectangle ( result.label ),
                value: result.label,
            } );
        }

        appendRouteSegments ( acceptedRouteIndex, result.points, relationIndex );
        initialRelations.push ( result );
    }


    // Handle the case where all required conditions are satisfied.

    if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined )
    {
        performanceCounters.passOneMilliseconds += monotonicMilliseconds () - passOneStartMilliseconds;
    }


    // Initialize the local values needed by this operation.

    const firstPassRouteIndex = packedRouteSegmentIndex (
        initialRelations.map ( relation => relation.points ),
        performanceCounters,
    );
    const repairedLabels: ChartRoutingRectangle[] = [];
    const repairedLabelIndex                      = new AppendChartRoutingSpatialIndex<ChartRoutingRectangle> ();
    const passTwoStartMilliseconds                = monotonicMilliseconds ();
    const relations: ChartRoutingResultRelation[] = [];

    yield "pass";


    // Repeat the operation across the bounded iteration range.

    for ( let relationIndex = 0; relationIndex < request.relations.length; relationIndex += 1 )
    {
        // Initialize the local values needed by this operation.

        const relation      = request.relations [ relationIndex ];
        const initialResult = initialRelations [ relationIndex ];


        // Handle the case where relation matches undefined.

        if ( relation === undefined )
        {
            continue;
        }

        yield "relation";

        let result: ChartRoutingResultRelation;


        // Handle the case where at least one branch condition is satisfied.

        if ( initialResult === undefined || relation.preservePreferred )
        {
            result = initialResult ?? ( yield* routeRelation (
                    relation,
                    relationIndex,
                    repairedLabels,
                    repairedLabelIndex,
                    firstPassRouteIndex,
                    request.transitionGravityPointDistance,
                    routingOptions,
                    reuseCache,
                    undefined,
                    performanceCounters,
                ) );


            // Handle the case where all required conditions are satisfied.

            if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined )
            {
                performanceCounters.relationsRetainedCount += 1;
            }
        }
        else
        {
            // Handle the remaining case after the preceding condition is false.

            const unrelatedLabels = initialRelations.flatMap ( ( candidateResult, resultIndex ) =>
                resultIndex === relationIndex || candidateResult.label.width === 0 ||
                    candidateResult.label.height === 0
                    ? []
                    : [ candidateResult.label ] );
            const repairEligibilityStartMilliseconds = !CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED ||
                performanceCounters === undefined
                ? 0
                : monotonicMilliseconds ();
            const canRetainInitialResult = routingOptions.selectiveSecondPassRetention &&
                firstPassRelationCanBeRetained (
                    initialResult,
                    relationIndex,
                    unrelatedLabels,
                    firstPassRouteIndex,
                    repairedLabelIndex,
                    reuseCache,
                    performanceCounters,
                );


            // Handle the case where all required conditions are satisfied.

            if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined )
            {
                performanceCounters.repairEligibilityMilliseconds +=
                    monotonicMilliseconds () - repairEligibilityStartMilliseconds;
            }


            // Handle the case where can retain initial result is enabled.

            if ( canRetainInitialResult )
            {
                result = initialResult;


                // Handle the case where all required conditions are satisfied.

                if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined )
                {
                    performanceCounters.relationsRetainedCount += 1;
                }
            }
            else
            {
                // Handle the remaining case after the preceding condition is false.

                const repairedResult = yield* routeRelation (
                    { ...relation, obstacles: [ ...relation.obstacles, ...unrelatedLabels ] },
                    relationIndex,
                    repairedLabels,
                    repairedLabelIndex,
                    firstPassRouteIndex,
                    request.transitionGravityPointDistance,
                    routingOptions,
                    reuseCache,
                    [
                        ...relation.obstacles.map ( () => request.transitionGravityPointDistance ),
                        ...unrelatedLabels.map ( () => ROUTE_CLEARANCE ),
                    ],
                    performanceCounters,
                );

                result = {
                    ...repairedResult,
                    exteriorFallback: initialResult.exteriorFallback || repairedResult.exteriorFallback,
                };


                // Handle the case where all required conditions are satisfied.

                if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined )
                {
                    performanceCounters.relationsRepairedCount += 1;
                }
            }
        }


        // Handle the case where all required conditions are satisfied.

        if ( result.label.width > 0 && result.label.height > 0 )
        {
            repairedLabels.push ( result.label );
            repairedLabelIndex.append ( {
                bounds: chartRoutingSpatialBoundsFromRectangle ( result.label ),
                value: result.label,
            } );
        }

        relations.push ( result );
    }


    // Handle the case where all required conditions are satisfied.

    if ( CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED && performanceCounters !== undefined )
    {
        performanceCounters.passTwoMilliseconds += monotonicMilliseconds () - passTwoStartMilliseconds;
        performanceCounters.fallbackCount += relations.filter ( relation => relation.exteriorFallback ).length;
        performanceCounters.totalRequestMilliseconds += monotonicMilliseconds () - requestStartMilliseconds;
    }


    // Return the assembled result.

    return {
        documentRevision: request.documentRevision,
        geometryRevision: request.geometryRevision,
        preferenceRevision: request.preferenceRevision,
        relations,
        requestId: request.requestId,
    };
}


//--------------------------------------------------------------------------------------------------
// Function: completeRoutingGenerator
//
// Description:
//
//   Completes the routing generator.
//
// Parameters:
//
//   - generator:
//     The generator supplied to the operation.
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

function completeRoutingGenerator (
    generator: Generator<ChartRoutingCancellationCheckpoint, ChartRoutingResult, void>,
): ChartRoutingResult
{
    // Initialize the local values needed by this operation.

    let step = generator.next ();


    // Continue the operation while its terminating condition has not been reached.

    while ( !step.done )
    {
        step = generator.next ();
    }


    // Return the computed result.

    return step.value;
}


//--------------------------------------------------------------------------------------------------
// Function: routeChartRelationsWithOptions
//
// Description:
//
//   Routes the chart relations with options.
//
// Parameters:
//
//   - request:
//     The request supplied to the operation.
//
//   - routingOptions:
//     The routing options supplied to the operation.
//
//   - performanceCounters:
//     The performance counters supplied to the operation.
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

function routeChartRelationsWithOptions (
    request: ChartRoutingRequest,
    routingOptions: RoutingOptimizationOptions,
    performanceCounters?: ChartRoutingPerformanceCounters,
    reuseCache: ChartRoutingReuseCache = new ChartRoutingReuseCache (),
): ChartRoutingResult
{
    // Return the complete routing generator result.

    return completeRoutingGenerator ( routeChartRelationsGenerator (
        request,
        routingOptions,
        performanceCounters,
        reuseCache,
    ) );
}


//--------------------------------------------------------------------------------------------------
// Function: routeChartRelationsCooperatively
//
// Description:
//
//   Routes the chart relations cooperatively.
//
// Parameters:
//
//   - request:
//     The request supplied to the operation.
//
//   - reuseCache:
//     The reuse cache supplied to the operation.
//
//   - cooperativeControl:
//     The cooperative control supplied to the operation.
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

export async function routeChartRelationsCooperatively (
    request: ChartRoutingRequest,
    reuseCache: ChartRoutingReuseCache,
    cooperativeControl: ChartRoutingCooperativeControl,
): Promise<ChartRoutingResult | null>
{
    // Initialize the local values needed by this operation.

    const generator = routeChartRelationsGenerator ( request, EXACT_ROUTING_OPTIMIZATIONS, undefined, reuseCache );
    let step        = generator.next ();


    // Continue the operation while its terminating condition has not been reached.

    while ( !step.done )
    {
        await cooperativeControl.yieldControl ( step.value );


        // Handle the case where is cancelled result is enabled.

        if ( cooperativeControl.isCancelled () )
        {
            // Return the computed result.

            return null;
        }

        step = generator.next ();
    }


    // Return the computed result.

    return step.value;
}


//--------------------------------------------------------------------------------------------------
// Function: routeChartRelations
//
// Description:
//
//   Routes the chart relations.
//
// Parameters:
//
//   - request:
//     The request supplied to the operation.
//
//   - performanceCounters:
//     The performance counters supplied to the operation.
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

export function routeChartRelations (
    request: ChartRoutingRequest,
    performanceCounters?: ChartRoutingPerformanceCounters,
    reuseCache?: ChartRoutingReuseCache,
): ChartRoutingResult
{
    // Return the route chart relations with options result.

    return routeChartRelationsWithOptions ( request, EXACT_ROUTING_OPTIMIZATIONS, performanceCounters, reuseCache );
}


//--------------------------------------------------------------------------------------------------
// Function: routeChartRelationsDenseReference
//
// Description:
//
//   Routes the chart relations dense reference.
//
// Parameters:
//
//   - request:
//     The request supplied to the operation.
//
//   - performanceCounters:
//     The performance counters supplied to the operation.
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

export function routeChartRelationsDenseReference (
    request: ChartRoutingRequest,
    performanceCounters?: ChartRoutingPerformanceCounters,
    reuseCache?: ChartRoutingReuseCache,
): ChartRoutingResult
{
    // Return the route chart relations with options result.

    return routeChartRelationsWithOptions ( request, DENSE_REFERENCE_ROUTING_OPTIONS, performanceCounters, reuseCache );
}


//--------------------------------------------------------------------------------------------------
// Function: routeChartRelationsSparseReference
//
// Description:
//
//   Routes the chart relations sparse reference.
//
// Parameters:
//
//   - request:
//     The request supplied to the operation.
//
//   - performanceCounters:
//     The performance counters supplied to the operation.
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

export function routeChartRelationsSparseReference (
    request: ChartRoutingRequest,
    performanceCounters?: ChartRoutingPerformanceCounters,
    reuseCache?: ChartRoutingReuseCache,
): ChartRoutingResult
{
    // Return the route chart relations with options result.

    return routeChartRelationsWithOptions ( request, SPARSE_REFERENCE_ROUTING_OPTIONS, performanceCounters, reuseCache );
}

export { ChartRoutingReuseCache } from "./chart-routing-reuse-cache.js";
