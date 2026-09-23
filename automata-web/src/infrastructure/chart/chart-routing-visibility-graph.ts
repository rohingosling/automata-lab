// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Chart Routing Visibility Graph
// Version: 1.0.0
// Date:    2026-08-22
// Author:  Rohin Gosling
//
// Description:
//
//   Builds deterministic dense and exact sparse rectilinear visibility graphs for Chart routing.
//   Sparse construction normalizes positive rectangle overlaps into one rectilinear union boundary.
//   Degenerate and touch-only geometry retains the dense compatibility path.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type
{
    ChartRoutingPoint,
    ChartRoutingRectangle,
} from "../../application/ports/contracts.js";

//--------------------------------------------------------------------------------------------------
// Interface: ChartRoutingVisibilityGraph
//
// Description:
//
//   Defines the structure of chart routing visibility graph.
//
//--------------------------------------------------------------------------------------------------

export interface ChartRoutingVisibilityGraph
{
    readonly adjacency: readonly ( readonly number[] )[];
    readonly points:    readonly ChartRoutingPoint[];
    readonly source:    number;
    readonly target:    number;
}

//--------------------------------------------------------------------------------------------------
// Interface: ChartRoutingVisibilityPredicates
//
// Description:
//
//   Defines the structure of chart routing visibility predicates.
//
//--------------------------------------------------------------------------------------------------

export interface ChartRoutingVisibilityPredicates
{
    readonly pointIsClear:   ( point: ChartRoutingPoint ) => boolean;
    readonly segmentIsClear: ( source: ChartRoutingPoint, target: ChartRoutingPoint ) => boolean;
}

//--------------------------------------------------------------------------------------------------
// Interface: DenseChartRoutingVisibilityProfile
//
// Description:
//
//   Defines the structure of dense chart routing visibility profile.
//
//--------------------------------------------------------------------------------------------------

export interface DenseChartRoutingVisibilityProfile
{
    readonly obstacleXCoordinates: readonly number[];
    readonly obstacleYCoordinates: readonly number[];
    readonly strategy:             "dense";
}

//--------------------------------------------------------------------------------------------------
// Interface: SparseChartRoutingVisibilityProfile
//
// Description:
//
//   Defines the structure of sparse chart routing visibility profile.
//
//--------------------------------------------------------------------------------------------------

export interface SparseChartRoutingVisibilityProfile
{
    readonly boundaryPoints: readonly ChartRoutingPoint[];
    readonly strategy:       "sparse";
}

//--------------------------------------------------------------------------------------------------
// Type: ChartRoutingVisibilityProfile
//
// Description:
//
//   Defines the supported chart routing visibility profile alternatives.
//
//--------------------------------------------------------------------------------------------------

export type ChartRoutingVisibilityProfile =
    DenseChartRoutingVisibilityProfile | SparseChartRoutingVisibilityProfile;

//--------------------------------------------------------------------------------------------------
// Interface: AxisVisibilitySegment
//
// Description:
//
//   Defines the structure of axis visibility segment.
//
//--------------------------------------------------------------------------------------------------

interface AxisVisibilitySegment
{
    readonly fixedCoordinate:   number;
    readonly maximumCoordinate: number;
    readonly minimumCoordinate: number;
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
// Function: segmentIdentifier
//
// Description:
//
//   Derives the segment identifier.
//
// Parameters:
//
//   - segment:
//     The segment supplied to the operation.
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

function segmentIdentifier ( segment: AxisVisibilitySegment ): string
{
    // Return the computed result.

    return `${segment.fixedCoordinate},${segment.minimumCoordinate},${segment.maximumCoordinate}`;
}

//--------------------------------------------------------------------------------------------------
// Function: rectangleMaximumX
//
// Description:
//
//   Derives the rectangle maximum x.
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

function rectangleMaximumX ( rectangle: ChartRoutingRectangle ): number
{
    // Return the computed result.

    return rectangle.x + rectangle.width;
}

//--------------------------------------------------------------------------------------------------
// Function: rectangleMaximumY
//
// Description:
//
//   Derives the rectangle maximum y.
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

function rectangleMaximumY ( rectangle: ChartRoutingRectangle ): number
{
    // Return the computed result.

    return rectangle.y + rectangle.height;
}

//--------------------------------------------------------------------------------------------------
// Function: rectanglesTouchOrOverlap
//
// Description:
//
//   Derives the rectangles touch or overlap.
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

function rectanglesTouchOrOverlap (
    first: ChartRoutingRectangle,
    second: ChartRoutingRectangle,
): boolean
{
    // Return the computed result.

    return !( rectangleMaximumX ( first ) < second.x || rectangleMaximumX ( second ) < first.x ||
        rectangleMaximumY ( first ) < second.y || rectangleMaximumY ( second ) < first.y );
}

//--------------------------------------------------------------------------------------------------
// Function: rectanglesStrictlyOverlap
//
// Description:
//
//   Derives the rectangles strictly overlap.
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

function rectanglesStrictlyOverlap (
    first: ChartRoutingRectangle,
    second: ChartRoutingRectangle,
): boolean
{
    // Return the computed result.

    return Math.min ( rectangleMaximumX ( first ), rectangleMaximumX ( second ) ) >
        Math.max ( first.x, second.x ) &&
        Math.min ( rectangleMaximumY ( first ), rectangleMaximumY ( second ) ) >
        Math.max ( first.y, second.y );
}

//--------------------------------------------------------------------------------------------------
// Function: sparseVisibilityGeometryIsSupported
//
// Description:
//
//   Derives the sparse visibility geometry is supported.
//
// Parameters:
//
//   - obstacles:
//     The obstacles supplied to the operation.
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

export function sparseVisibilityGeometryIsSupported (
    obstacles: readonly ChartRoutingRectangle[],
): boolean
{
    // Handle the case where some result is enabled.

    if ( obstacles.some ( obstacle => obstacle.width <= 0 || obstacle.height <= 0 ) )
    {
        // Return the computed result.

        return false;
    }

    // Repeat the operation across the bounded iteration range.

    for ( let firstIndex = 0; firstIndex < obstacles.length; firstIndex += 1 )
    {
        // Initialize the local values needed by this operation.

        const first = obstacles [ firstIndex ];

        // Handle the case where first matches undefined.

        if ( first === undefined )
        {
            continue;
        }

        // Repeat the operation across the bounded iteration range.

        for ( let secondIndex = firstIndex + 1; secondIndex < obstacles.length; secondIndex += 1 )
        {
            // Initialize the local values needed by this operation.

            const second = obstacles [ secondIndex ];

            // Handle the case where all required conditions are satisfied.

            if ( second !== undefined && rectanglesTouchOrOverlap ( first, second ) &&
                !rectanglesStrictlyOverlap ( first, second ) )
            {
                // Return the computed result.

                return false;
            }
        }
    }

    // Return the computed result.

    return true;
}

//--------------------------------------------------------------------------------------------------
// Function: connectVisibleAdjacentPoints
//
// Description:
//
//   Connects the visible adjacent points.
//
// Parameters:
//
//   - points:
//     The points supplied to the operation.
//
//   - predicates:
//     The predicates supplied to the operation.
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

function connectVisibleAdjacentPoints (
    points: readonly ChartRoutingPoint[],
    predicates: ChartRoutingVisibilityPredicates,
): readonly ( readonly number[] )[]
{
    // Initialize the local values needed by this operation.

    const adjacency = points.map ( () => [] as number[] );
    const rows      = new Map<number, number[]> ();
    const columns   = new Map<number, number[]> ();

    points.forEach ( ( point, pointIndex ) =>
    {
        rows.set ( point.y, [ ...( rows.get ( point.y ) ?? [] ), pointIndex ] );
        columns.set ( point.x, [ ...( columns.get ( point.x ) ?? [] ), pointIndex ] );
    } );

    //----------------------------------------------------------------------------------------------
    // Function: connectAdjacent
    //
    // Description:
    //
    //   Connects the adjacent.
    //
    // Parameters:
    //
    //   - indices:
    //     The indices supplied to the operation.
    //
    //   - coordinate:
    //     The coordinate supplied to the operation.
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

    const connectAdjacent = ( indices: readonly number[], coordinate: "x" | "y" ): void =>
    {
        // Calculate the ordered value from the current inputs.

        const ordered = [ ...indices ].sort ( ( left, right ) =>
            ( points [ left ]?.[ coordinate ] ?? 0 ) - ( points [ right ]?.[ coordinate ] ?? 0 ) );

        // Repeat the operation across the bounded iteration range.

        for ( let index = 1; index < ordered.length; index += 1 )
        {
            // Initialize the local values needed by this operation.

            const sourceIndex = ordered [ index - 1 ];
            const targetIndex = ordered [ index ];
            const source      = sourceIndex === undefined ? undefined : points [ sourceIndex ];
            const target      = targetIndex === undefined ? undefined : points [ targetIndex ];

            // Handle the case where all required conditions are satisfied.

            if ( sourceIndex !== undefined && targetIndex !== undefined && source !== undefined &&
                target !== undefined && predicates.segmentIsClear ( source, target ) )
            {
                adjacency [ sourceIndex ]?.push ( targetIndex );
                adjacency [ targetIndex ]?.push ( sourceIndex );
            }
        }
    };

    rows.forEach ( indices => connectAdjacent ( indices, "x" ) );
    columns.forEach ( indices => connectAdjacent ( indices, "y" ) );

    // Return the adjacency.

    return adjacency;
}

//--------------------------------------------------------------------------------------------------
// Function: assembleVisibilityGraph
//
// Description:
//
//   Derives the assemble visibility graph.
//
// Parameters:
//
//   - points:
//     The points supplied to the operation.
//
//   - source:
//     The source supplied to the operation.
//
//   - target:
//     The target supplied to the operation.
//
//   - predicates:
//     The predicates supplied to the operation.
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

function assembleVisibilityGraph (
    points: readonly ChartRoutingPoint[],
    source: ChartRoutingPoint,
    target: ChartRoutingPoint,
    predicates: ChartRoutingVisibilityPredicates,
): ChartRoutingVisibilityGraph | null
{
    // Initialize the local values needed by this operation.

    const indexByPoint = new Map ( points.map ( ( point, pointIndex ) =>
        [ pointIdentifier ( point ), pointIndex ] ) );
    const sourceIndex = indexByPoint.get ( pointIdentifier ( source ) );
    const targetIndex = indexByPoint.get ( pointIdentifier ( target ) );

    // Handle the case where at least one branch condition is satisfied.

    if ( sourceIndex === undefined || targetIndex === undefined )
    {
        // Return the computed result.

        return null;
    }

    // Return the assembled result.

    return {
        adjacency: connectVisibleAdjacentPoints ( points, predicates ),
        points,
        source: sourceIndex,
        target: targetIndex,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: buildDenseChartRoutingVisibilityGraph
//
// Description:
//
//   Builds dense chart routing visibility graph.
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
//   - predicates:
//     The predicates supplied to the operation.
//
//   - maximumPointCount:
//     The maximum point count supplied to the operation.
//
//   - profile:
//     The profile supplied to the operation.
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

export function buildDenseChartRoutingVisibilityGraph (
    source: ChartRoutingPoint,
    target: ChartRoutingPoint,
    obstacles: readonly ChartRoutingRectangle[],
    predicates: ChartRoutingVisibilityPredicates,
    maximumPointCount: number,
    profile: DenseChartRoutingVisibilityProfile = buildDenseChartRoutingVisibilityProfile ( obstacles ),
): ChartRoutingVisibilityGraph | null
{
    // Initialize the local values needed by this operation.

    const xCoordinates = new Set<number> ( [ source.x, target.x, ...profile.obstacleXCoordinates ] );
    const yCoordinates = new Set<number> ( [ source.y, target.y, ...profile.obstacleYCoordinates ] );

    // Handle the case where current value exceeds maximum point count.

    if ( xCoordinates.size * yCoordinates.size > maximumPointCount )
    {
        // Return the computed result.

        return null;
    }

    // Initialize the local values needed by this operation.

    const orderedXCoordinates = [ ...xCoordinates ].sort ( ( left, right ) => left - right );
    const orderedYCoordinates = [ ...yCoordinates ].sort ( ( left, right ) => left - right );
    const points              = orderedXCoordinates.flatMap ( x => orderedYCoordinates.flatMap ( y =>
    {
        // Initialize the local values needed by this operation.

        const point = { x, y };

        // Return the result selected by the current condition.

        return predicates.pointIsClear ( point ) ? [ point ] : [];
    } ) );

    // Return the assemble visibility graph result.

    return assembleVisibilityGraph ( points, source, target, predicates );
}

//--------------------------------------------------------------------------------------------------
// Function: buildDenseChartRoutingVisibilityProfile
//
// Description:
//
//   Builds dense chart routing visibility profile.
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

export function buildDenseChartRoutingVisibilityProfile (
    obstacles: readonly ChartRoutingRectangle[],
): DenseChartRoutingVisibilityProfile
{
    // Return the assembled result.

    return {
        obstacleXCoordinates: [ ...new Set ( obstacles.flatMap ( obstacle =>
            [ obstacle.x, rectangleMaximumX ( obstacle ) ] ) ) ].sort ( ( left, right ) => left - right ),
        obstacleYCoordinates: [ ...new Set ( obstacles.flatMap ( obstacle =>
            [ obstacle.y, rectangleMaximumY ( obstacle ) ] ) ) ].sort ( ( left, right ) => left - right ),
        strategy: "dense",
    };
}

//--------------------------------------------------------------------------------------------------
// Function: obstacleCornerPoints
//
// Description:
//
//   Derives the obstacle corner points.
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
//--------------------------------------------------------------------------------------------------

function obstacleCornerPoints ( obstacle: ChartRoutingRectangle ): readonly ChartRoutingPoint[]
{
    // Initialize the local values needed by this operation.

    const maximumX = rectangleMaximumX ( obstacle );
    const maximumY = rectangleMaximumY ( obstacle );

    // Return the assembled result collection.

    return [
        { x: obstacle.x, y: obstacle.y },
        { x: obstacle.x, y: maximumY },
        { x: maximumX, y: obstacle.y },
        { x: maximumX, y: maximumY },
    ];
}

//--------------------------------------------------------------------------------------------------
// Function: pointInsideAnyRectangle
//
// Description:
//
//   Derives the point inside any rectangle.
//
// Parameters:
//
//   - point:
//     The point supplied to the operation.
//
//   - rectangles:
//     The rectangles supplied to the operation.
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

function pointInsideAnyRectangle (
    point: ChartRoutingPoint,
    rectangles: readonly ChartRoutingRectangle[],
): boolean
{
    // Return the some result.

    return rectangles.some ( rectangle => point.x > rectangle.x && point.x < rectangleMaximumX ( rectangle ) &&
        point.y > rectangle.y && point.y < rectangleMaximumY ( rectangle ) );
}

//--------------------------------------------------------------------------------------------------
// Function: rectilinearUnionBoundaryPoints
//
// Description:
//
//   Derives the rectilinear union boundary points.
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

function rectilinearUnionBoundaryPoints (
    obstacles: readonly ChartRoutingRectangle[],
): readonly ChartRoutingPoint[]
{
    // Handle the case where every result is enabled.

    if ( obstacles.every ( ( obstacle, obstacleIndex ) => obstacles.every ( ( candidate, candidateIndex ) =>
        obstacleIndex === candidateIndex || !rectanglesStrictlyOverlap ( obstacle, candidate ) ) ) )
    {
        // Return the flat map result.

        return obstacles.flatMap ( obstacleCornerPoints );
    }

    // Initialize the local values needed by this operation.

    const xCoordinates = [ ...new Set ( obstacles.flatMap ( obstacle =>
        [ obstacle.x, rectangleMaximumX ( obstacle ) ] ) ) ].sort ( ( left, right ) => left - right );
    const yCoordinates = [ ...new Set ( obstacles.flatMap ( obstacle =>
        [ obstacle.y, rectangleMaximumY ( obstacle ) ] ) ) ].sort ( ( left, right ) => left - right );

    //----------------------------------------------------------------------------------------------
    // Function: cellIsCovered
    //
    // Description:
    //
    //   Derives the cell is covered.
    //
    // Parameters:
    //
    //   - xIndex:
    //     The x index supplied to the operation.
    //
    //   - yIndex:
    //     The y index supplied to the operation.
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

    const cellIsCovered = ( xIndex: number, yIndex: number ): boolean =>
    {
        // Initialize the local values needed by this operation.

        const minimumX = xCoordinates [ xIndex ];
        const maximumX = xCoordinates [ xIndex + 1 ];
        const minimumY = yCoordinates [ yIndex ];
        const maximumY = yCoordinates [ yIndex + 1 ];

        // Return the computed result.

        return minimumX !== undefined && maximumX !== undefined && minimumY !== undefined && maximumY !== undefined &&
            pointInsideAnyRectangle ( {
                x: ( minimumX + maximumX ) / 2,
                y: ( minimumY + maximumY ) / 2,
            }, obstacles );
    };

    // Return the flat map result.

    return xCoordinates.flatMap ( ( x, xIndex ) => yCoordinates.flatMap ( ( y, yIndex ) =>
    {
        // Calculate the covered quadrant count value from the current inputs.

        const coveredQuadrantCount = [
            cellIsCovered ( xIndex - 1, yIndex - 1 ),
            cellIsCovered ( xIndex, yIndex - 1 ),
            cellIsCovered ( xIndex - 1, yIndex ),
            cellIsCovered ( xIndex, yIndex ),
        ].filter ( Boolean ).length;

        // Return the result selected by the current condition.

        return coveredQuadrantCount === 1 || coveredQuadrantCount === 3 ? [ { x, y } ] : [];
    } ) );
}

//--------------------------------------------------------------------------------------------------
// Function: horizontalVisibilitySegment
//
// Description:
//
//   Derives the horizontal visibility segment.
//
// Parameters:
//
//   - point:
//     The point supplied to the operation.
//
//   - obstacles:
//     The obstacles supplied to the operation.
//
//   - minimumSceneX:
//     The minimum scene x supplied to the operation.
//
//   - maximumSceneX:
//     The maximum scene x supplied to the operation.
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

function horizontalVisibilitySegment (
    point: ChartRoutingPoint,
    obstacles: readonly ChartRoutingRectangle[],
    minimumSceneX: number,
    maximumSceneX: number,
): AxisVisibilitySegment | null
{
    // Initialize the local values needed by this operation.

    let minimumX = minimumSceneX;
    let maximumX = maximumSceneX;

    // Process each obstacle from the obstacles collection in order.

    for ( const obstacle of obstacles )
    {
        // Handle the case where at least one branch condition is satisfied.

        if ( point.y <= obstacle.y || point.y >= rectangleMaximumY ( obstacle ) )
        {
            continue;
        }

        const obstacleMaximumX = rectangleMaximumX ( obstacle );

        // Handle the case where obstacle maximum x does not exceed point x.

        if ( obstacleMaximumX <= point.x )
        {
            minimumX = Math.max ( minimumX, obstacleMaximumX );
        }
        else if ( obstacle.x >= point.x )
        {
            maximumX = Math.min ( maximumX, obstacle.x );
        }
        else
        {
            // Return the computed result.

            return null;
        }
    }

    // Return the assembled result.

    return {
        fixedCoordinate: point.y,
        maximumCoordinate: maximumX,
        minimumCoordinate: minimumX,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: verticalVisibilitySegment
//
// Description:
//
//   Derives the vertical visibility segment.
//
// Parameters:
//
//   - point:
//     The point supplied to the operation.
//
//   - obstacles:
//     The obstacles supplied to the operation.
//
//   - minimumSceneY:
//     The minimum scene y supplied to the operation.
//
//   - maximumSceneY:
//     The maximum scene y supplied to the operation.
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

function verticalVisibilitySegment (
    point: ChartRoutingPoint,
    obstacles: readonly ChartRoutingRectangle[],
    minimumSceneY: number,
    maximumSceneY: number,
): AxisVisibilitySegment | null
{
    // Initialize the local values needed by this operation.

    let minimumY = minimumSceneY;
    let maximumY = maximumSceneY;

    // Process each obstacle from the obstacles collection in order.

    for ( const obstacle of obstacles )
    {
        // Handle the case where at least one branch condition is satisfied.

        if ( point.x <= obstacle.x || point.x >= rectangleMaximumX ( obstacle ) )
        {
            continue;
        }

        const obstacleMaximumY = rectangleMaximumY ( obstacle );

        // Handle the case where obstacle maximum y does not exceed point y.

        if ( obstacleMaximumY <= point.y )
        {
            minimumY = Math.max ( minimumY, obstacleMaximumY );
        }
        else if ( obstacle.y >= point.y )
        {
            maximumY = Math.min ( maximumY, obstacle.y );
        }
        else
        {
            // Return the computed result.

            return null;
        }
    }

    // Return the assembled result.

    return {
        fixedCoordinate: point.x,
        maximumCoordinate: maximumY,
        minimumCoordinate: minimumY,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: uniqueSegments
//
// Description:
//
//   Derives the unique segments.
//
// Parameters:
//
//   - segments:
//     The segments supplied to the operation.
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

function uniqueSegments ( segments: readonly AxisVisibilitySegment[] ): readonly AxisVisibilitySegment[]
{
    // Return the assembled result collection.

    return [ ...new Map ( segments.map ( segment => [ segmentIdentifier ( segment ), segment ] ) ).values () ];
}

//--------------------------------------------------------------------------------------------------
// Function: buildSparseChartRoutingVisibilityGraph
//
// Description:
//
//   Builds sparse chart routing visibility graph.
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
//   - predicates:
//     The predicates supplied to the operation.
//
//   - maximumPointCount:
//     The maximum point count supplied to the operation.
//
//   - profile:
//     The profile supplied to the operation.
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

export function buildSparseChartRoutingVisibilityGraph (
    source: ChartRoutingPoint,
    target: ChartRoutingPoint,
    obstacles: readonly ChartRoutingRectangle[],
    predicates: ChartRoutingVisibilityPredicates,
    maximumPointCount: number,
    profile: SparseChartRoutingVisibilityProfile = buildSparseChartRoutingVisibilityProfile ( obstacles ),
): ChartRoutingVisibilityGraph | null
{
    // Initialize the local values needed by this operation.

    const seedPoints = [ ...new Map ( [ source, target, ...profile.boundaryPoints ]
        .map ( point => [ pointIdentifier ( point ), point ] ) ).values () ];
    const minimumSceneX      = Math.min ( ...seedPoints.map ( point => point.x ) );
    const maximumSceneX      = Math.max ( ...seedPoints.map ( point => point.x ) );
    const minimumSceneY      = Math.min ( ...seedPoints.map ( point => point.y ) );
    const maximumSceneY      = Math.max ( ...seedPoints.map ( point => point.y ) );
    const horizontalSegments = uniqueSegments ( seedPoints.flatMap ( point =>
    {
        // Initialize the local values needed by this operation.

        const segment = horizontalVisibilitySegment ( point, obstacles, minimumSceneX, maximumSceneX );

        // Return the result selected by the current condition.

        return segment === null ? [] : [ segment ];
    } ) );
    const verticalSegments = uniqueSegments ( seedPoints.flatMap ( point =>
    {
        // Initialize the local values needed by this operation.

        const segment = verticalVisibilitySegment ( point, obstacles, minimumSceneY, maximumSceneY );

        // Return the result selected by the current condition.

        return segment === null ? [] : [ segment ];
    } ) );
    const pointByIdentifier = new Map<string, ChartRoutingPoint> ();

    //----------------------------------------------------------------------------------------------
    // Function: addPoint
    //
    // Description:
    //
    //   Adds the point.
    //
    // Parameters:
    //
    //   - point:
    //     The point supplied to the operation.
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

    const addPoint = ( point: ChartRoutingPoint ): boolean =>
    {
        // Handle the case where the point is clear result condition is not satisfied.

        if ( !predicates.pointIsClear ( point ) )
        {
            // Return the computed result.

            return true;
        }

        pointByIdentifier.set ( pointIdentifier ( point ), point );

        // Return the computed result.

        return pointByIdentifier.size <= maximumPointCount;
    };

    // Process each point from the seed points collection in order.

    for ( const point of seedPoints )
    {
        // Handle the case where the add point result condition is not satisfied.

        if ( !addPoint ( point ) )
        {
            // Return the computed result.

            return null;
        }
    }

    // Process each horizontal segment from the horizontal segments collection in order.

    for ( const horizontalSegment of horizontalSegments )
    {
        // Handle the case where at least one branch condition is satisfied.

        if ( !addPoint ( {
            x: horizontalSegment.minimumCoordinate,
            y: horizontalSegment.fixedCoordinate,
        } ) || !addPoint ( {
            x: horizontalSegment.maximumCoordinate,
            y: horizontalSegment.fixedCoordinate,
        } ) )
        {
            // Return the computed result.

            return null;
        }
    }

    // Process each vertical segment from the vertical segments collection in order.

    for ( const verticalSegment of verticalSegments )
    {
        // Handle the case where at least one branch condition is satisfied.

        if ( !addPoint ( {
            x: verticalSegment.fixedCoordinate,
            y: verticalSegment.minimumCoordinate,
        } ) || !addPoint ( {
            x: verticalSegment.fixedCoordinate,
            y: verticalSegment.maximumCoordinate,
        } ) )
        {
            // Return the computed result.

            return null;
        }
    }

    // Process each horizontal segment from the horizontal segments collection in order.

    for ( const horizontalSegment of horizontalSegments )
    {
        // Process each vertical segment from the vertical segments collection in order.

        for ( const verticalSegment of verticalSegments )
        {
            // Handle the case where all required conditions are satisfied.

            if ( verticalSegment.fixedCoordinate >= horizontalSegment.minimumCoordinate &&
                verticalSegment.fixedCoordinate <= horizontalSegment.maximumCoordinate &&
                horizontalSegment.fixedCoordinate >= verticalSegment.minimumCoordinate &&
                horizontalSegment.fixedCoordinate <= verticalSegment.maximumCoordinate &&
                !addPoint ( {
                    x: verticalSegment.fixedCoordinate,
                    y: horizontalSegment.fixedCoordinate,
                } ) )
            {
                // Return the computed result.

                return null;
            }
        }
    }

    // Calculate the points value from the current inputs.

    const points = [ ...pointByIdentifier.values () ].sort ( ( left, right ) =>
        left.x - right.x || left.y - right.y );

    // Return the assemble visibility graph result.

    return assembleVisibilityGraph ( points, source, target, predicates );
}

//--------------------------------------------------------------------------------------------------
// Function: buildSparseChartRoutingVisibilityProfile
//
// Description:
//
//   Builds sparse chart routing visibility profile.
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

export function buildSparseChartRoutingVisibilityProfile (
    obstacles: readonly ChartRoutingRectangle[],
): SparseChartRoutingVisibilityProfile
{
    // Return the assembled result.

    return {
        boundaryPoints: rectilinearUnionBoundaryPoints ( obstacles ),
        strategy: "sparse",
    };
}

//--------------------------------------------------------------------------------------------------
// Function: chartRoutingVisibilityProfileSignature
//
// Description:
//
//   Derives the chart routing visibility profile signature.
//
// Parameters:
//
//   - strategy:
//     The strategy supplied to the operation.
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

export function chartRoutingVisibilityProfileSignature (
    strategy: "dense" | "sparse",
    obstacles: readonly ChartRoutingRectangle[],
): string
{
    // Calculate the canonical rectangles value from the current inputs.

    const canonicalRectangles = [ ...obstacles ].sort ( ( left, right ) =>
        left.x - right.x || left.y - right.y || left.width - right.width || left.height - right.height );

    // Return the computed result.

    return `${strategy}:${canonicalRectangles.map ( rectangle =>
        `${rectangle.x},${rectangle.y},${rectangle.width},${rectangle.height}` ).join ( ";" )}`;
}
