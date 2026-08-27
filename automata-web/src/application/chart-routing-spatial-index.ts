// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Chart Routing Spatial Index
// Version: 1.0.0
// Date:    2026-08-22
// Author:  Rohin Gosling
//
// Description:
//
//   Provides deterministic request-local axis-aligned bounding-box indexes for exact Chart routing
//   broad-pass candidate searches. Queries may return boundary-touching candidates; callers retain
//   the authoritative exact geometric predicate as their narrow-pass test. Equal packed sort keys
//   and append queries retain insertion order.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

//--------------------------------------------------------------------------------------------------
// Interface: ChartRoutingSpatialBounds
//
// Description:
//
//   Defines the structure of chart routing spatial bounds.
//
//--------------------------------------------------------------------------------------------------

export interface ChartRoutingSpatialBounds
{
    readonly maximumX: number;
    readonly maximumY: number;
    readonly minimumX: number;
    readonly minimumY: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: ChartRoutingSpatialEntry
//
// Description:
//
//   Defines the structure of chart routing spatial entry.
//
//--------------------------------------------------------------------------------------------------

export interface ChartRoutingSpatialEntry<Value>
{
    readonly bounds: ChartRoutingSpatialBounds;
    readonly value:  Value;
}

//--------------------------------------------------------------------------------------------------
// Interface: ChartRoutingSpatialQuery
//
// Description:
//
//   Defines the structure of chart routing spatial query.
//
//--------------------------------------------------------------------------------------------------

export interface ChartRoutingSpatialQuery<Value>
{
    query ( bounds: ChartRoutingSpatialBounds ): readonly Value[];
    visit ( bounds: ChartRoutingSpatialBounds, visitor: ( value: Value ) => boolean ): boolean;
}

//--------------------------------------------------------------------------------------------------
// Interface: IndexedChartRoutingSpatialEntry
//
// Description:
//
//   Defines the structure of indexed chart routing spatial entry.
//
//--------------------------------------------------------------------------------------------------

interface IndexedChartRoutingSpatialEntry<Value> extends ChartRoutingSpatialEntry<Value>
{
    readonly insertionIndex: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: PackedChartRoutingSpatialNode
//
// Description:
//
//   Defines the structure of packed chart routing spatial node.
//
//--------------------------------------------------------------------------------------------------

interface PackedChartRoutingSpatialNode<Value>
{
    readonly bounds:  ChartRoutingSpatialBounds;
    readonly entries: readonly IndexedChartRoutingSpatialEntry<Value>[];
    readonly left:    PackedChartRoutingSpatialNode<Value> | null;
    readonly right:   PackedChartRoutingSpatialNode<Value> | null;
}

const PACKED_LEAF_CAPACITY = 8;

//--------------------------------------------------------------------------------------------------
// Function: chartRoutingSpatialBoundsIntersect
//
// Description:
//
//   Derives the chart routing spatial bounds intersect.
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

export function chartRoutingSpatialBoundsIntersect (
    left: ChartRoutingSpatialBounds,
    right: ChartRoutingSpatialBounds,
): boolean
{
    // Return the computed result.

    return left.minimumX <= right.maximumX && left.maximumX >= right.minimumX &&
        left.minimumY <= right.maximumY && left.maximumY >= right.minimumY;
}

//--------------------------------------------------------------------------------------------------
// Function: chartRoutingSpatialBoundsFromRectangle
//
// Description:
//
//   Derives the chart routing spatial bounds from rectangle.
//
// Parameters:
//
//   - rectangle:
//     The rectangle supplied to the operation.
//
//   - expansion:
//     The expansion supplied to the operation.
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

export function chartRoutingSpatialBoundsFromRectangle (
    rectangle: { readonly height: number; readonly width: number; readonly x: number; readonly y: number },
    expansion = 0,
): ChartRoutingSpatialBounds
{
    // Return the assembled result.

    return {
        maximumX: rectangle.x + rectangle.width + expansion,
        maximumY: rectangle.y + rectangle.height + expansion,
        minimumX: rectangle.x - expansion,
        minimumY: rectangle.y - expansion,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: chartRoutingSpatialBoundsFromPoint
//
// Description:
//
//   Derives the chart routing spatial bounds from point.
//
// Parameters:
//
//   - point:
//     The point supplied to the operation.
//
//   - expansion:
//     The expansion supplied to the operation.
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

export function chartRoutingSpatialBoundsFromPoint (
    point: { readonly x: number; readonly y: number },
    expansion = 0,
): ChartRoutingSpatialBounds
{
    // Return the assembled result.

    return {
        maximumX: point.x + expansion,
        maximumY: point.y + expansion,
        minimumX: point.x - expansion,
        minimumY: point.y - expansion,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: chartRoutingSpatialBoundsFromSegment
//
// Description:
//
//   Derives the chart routing spatial bounds from segment.
//
// Parameters:
//
//   - source:
//     The source supplied to the operation.
//
//   - target:
//     The target supplied to the operation.
//
//   - expansion:
//     The expansion supplied to the operation.
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

export function chartRoutingSpatialBoundsFromSegment (
    source: { readonly x: number; readonly y: number },
    target: { readonly x: number; readonly y: number },
    expansion = 0,
): ChartRoutingSpatialBounds
{
    // Return the assembled result.

    return {
        maximumX: Math.max ( source.x, target.x ) + expansion,
        maximumY: Math.max ( source.y, target.y ) + expansion,
        minimumX: Math.min ( source.x, target.x ) - expansion,
        minimumY: Math.min ( source.y, target.y ) - expansion,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: chartRoutingSpatialBoundsFromPoints
//
// Description:
//
//   Derives the chart routing spatial bounds from points.
//
// Parameters:
//
//   - points:
//     The points supplied to the operation.
//
//   - expansion:
//     The expansion supplied to the operation.
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

export function chartRoutingSpatialBoundsFromPoints (
    points: readonly { readonly x: number; readonly y: number }[],
    expansion = 0,
): ChartRoutingSpatialBounds
{
    // Handle the case where points length equals 0.

    if ( points.length === 0 )
    {
        // Return the assembled result.

        return { maximumX: expansion, maximumY: expansion, minimumX: -expansion, minimumY: -expansion };
    }

    // Initialize the local values needed by this operation.

    let maximumX = Number.NEGATIVE_INFINITY;
    let maximumY = Number.NEGATIVE_INFINITY;
    let minimumX = Number.POSITIVE_INFINITY;
    let minimumY = Number.POSITIVE_INFINITY;

    // Process each point from the points collection in order.

    for ( const point of points )
    {
        maximumX = Math.max ( maximumX, point.x );
        maximumY = Math.max ( maximumY, point.y );
        minimumX = Math.min ( minimumX, point.x );
        minimumY = Math.min ( minimumY, point.y );
    }

    // Return the assembled result.

    return {
        maximumX: maximumX + expansion,
        maximumY: maximumY + expansion,
        minimumX: minimumX - expansion,
        minimumY: minimumY - expansion,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: compareEntries
//
// Description:
//
//   Compares entries.
//
// Parameters:
//
//   - left:
//     The left supplied to the operation.
//
//   - right:
//     The right supplied to the operation.
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
//--------------------------------------------------------------------------------------------------

function compareEntries<Value> (
    left: IndexedChartRoutingSpatialEntry<Value>,
    right: IndexedChartRoutingSpatialEntry<Value>,
    axis: "x" | "y",
): number
{
    // Initialize the local values needed by this operation.

    const leftCenter = axis === "x"
        ? left.bounds.minimumX + left.bounds.maximumX
        : left.bounds.minimumY + left.bounds.maximumY;
    const rightCenter = axis === "x"
        ? right.bounds.minimumX + right.bounds.maximumX
        : right.bounds.minimumY + right.bounds.maximumY;

    // Return the computed result.

    return leftCenter - rightCenter ||
        left.bounds.minimumX - right.bounds.minimumX ||
        left.bounds.minimumY - right.bounds.minimumY ||
        left.bounds.maximumX - right.bounds.maximumX ||
        left.bounds.maximumY - right.bounds.maximumY ||
        left.insertionIndex - right.insertionIndex;
}

//--------------------------------------------------------------------------------------------------
// Function: combinedBounds
//
// Description:
//
//   Derives the combined bounds.
//
// Parameters:
//
//   - entries:
//     The entries supplied to the operation.
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

function combinedBounds<Value> (
    entries: readonly IndexedChartRoutingSpatialEntry<Value>[],
): ChartRoutingSpatialBounds
{
    // Initialize the local values needed by this operation.

    let maximumX = Number.NEGATIVE_INFINITY;
    let maximumY = Number.NEGATIVE_INFINITY;
    let minimumX = Number.POSITIVE_INFINITY;
    let minimumY = Number.POSITIVE_INFINITY;

    // Process each entry from the entries collection in order.

    for ( const entry of entries )
    {
        maximumX = Math.max ( maximumX, entry.bounds.maximumX );
        maximumY = Math.max ( maximumY, entry.bounds.maximumY );
        minimumX = Math.min ( minimumX, entry.bounds.minimumX );
        minimumY = Math.min ( minimumY, entry.bounds.minimumY );
    }

    // Return the assembled result.

    return { maximumX, maximumY, minimumX, minimumY };
}

//--------------------------------------------------------------------------------------------------
// Function: buildPackedNode
//
// Description:
//
//   Builds packed node.
//
// Parameters:
//
//   - entries:
//     The entries supplied to the operation.
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

function buildPackedNode<Value> (
    entries: readonly IndexedChartRoutingSpatialEntry<Value>[],
): PackedChartRoutingSpatialNode<Value>
{
    // Initialize the local values needed by this operation.

    const bounds = combinedBounds ( entries );

    // Handle the case where entries length does not exceed packed leaf capacity.

    if ( entries.length <= PACKED_LEAF_CAPACITY )
    {
        // Return the assembled result.

        return { bounds, entries, left: null, right: null };
    }

    // Initialize the local values needed by this operation.

    const horizontalExtent = bounds.maximumX - bounds.minimumX;
    const verticalExtent   = bounds.maximumY - bounds.minimumY;
    const orderedEntries   = [ ...entries ].sort ( ( left, right ) =>
        compareEntries ( left, right, horizontalExtent >= verticalExtent ? "x" : "y" ) );
    const middleIndex = Math.floor ( orderedEntries.length / 2 );

    // Return the assembled result.

    return {
        bounds,
        entries: [],
        left: buildPackedNode ( orderedEntries.slice ( 0, middleIndex ) ),
        right: buildPackedNode ( orderedEntries.slice ( middleIndex ) ),
    };
}

//--------------------------------------------------------------------------------------------------
// Function: queryPackedNode
//
// Description:
//
//   Queries the packed node.
//
// Parameters:
//
//   - node:
//     The node supplied to the operation.
//
//   - bounds:
//     The bounds supplied to the operation.
//
//   - visitor:
//     The visitor supplied to the operation.
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

function queryPackedNode<Value> (
    node: PackedChartRoutingSpatialNode<Value>,
    bounds: ChartRoutingSpatialBounds,
    visitor: ( value: Value ) => boolean,
): boolean
{
    // Handle the case where the chart routing spatial bounds intersect result condition is not
    // satisfied.

    if ( !chartRoutingSpatialBoundsIntersect ( node.bounds, bounds ) )
    {
        // Return the computed result.

        return true;
    }

    // Process each entry from the node entries collection in order.

    for ( const entry of node.entries )
    {
        // Handle the case where chart routing spatial bounds intersect result is enabled.

        if ( chartRoutingSpatialBoundsIntersect ( entry.bounds, bounds ) )
        {
            // Handle the case where the visitor result condition is not satisfied.

            if ( !visitor ( entry.value ) )
            {
                // Return the computed result.

                return false;
            }
        }
    }

    // Handle the case where node left differs from an absent value.

    if ( node.left !== null )
    {
        // Handle the case where the query packed node result condition is not satisfied.

        if ( !queryPackedNode ( node.left, bounds, visitor ) )
        {
            // Return the computed result.

            return false;
        }
    }

    // Handle the case where node right differs from an absent value.

    if ( node.right !== null )
    {
        // Handle the case where the query packed node result condition is not satisfied.

        if ( !queryPackedNode ( node.right, bounds, visitor ) )
        {
            // Return the computed result.

            return false;
        }
    }

    // Return the computed result.

    return true;
}

//--------------------------------------------------------------------------------------------------
// Class: PackedChartRoutingSpatialIndex
//
// Description:
//
//   Implements the packed chart routing spatial index behavior.
//
//--------------------------------------------------------------------------------------------------

export class PackedChartRoutingSpatialIndex<Value> implements ChartRoutingSpatialQuery<Value>
{
    private readonly root: PackedChartRoutingSpatialNode<Value> | null;

    //----------------------------------------------------------------------------------------------
    // Constructor: PackedChartRoutingSpatialIndex
    //
    // Description:
    //
    //   Initializes a PackedChartRoutingSpatialIndex instance.
    //
    // Parameters:
    //
    //   - entries:
    //     The entries supplied to the operation.
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

    public constructor ( entries: readonly ChartRoutingSpatialEntry<Value>[] )
    {
        this.root = entries.length === 0
            ? null
            : buildPackedNode ( entries.map ( ( entry, insertionIndex ) => ( { ...entry, insertionIndex } ) ) );
    }

    //----------------------------------------------------------------------------------------------
    // Method: query
    //
    // Description:
    //
    //   Queries the requested value.
    //
    // Parameters:
    //
    //   - bounds:
    //     The bounds supplied to the operation.
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

    public query ( bounds: ChartRoutingSpatialBounds ): readonly Value[]
    {
        // Handle the case where root matches an absent value.

        if ( this.root === null )
        {
            // Return the assembled result collection.

            return [];
        }

        const matches: Value[] = [];

        this.visit ( bounds, value =>
        {
            matches.push ( value );

            // Return the computed result.

            return true;
        } );

        // Return the matches.

        return matches;
    }

    //----------------------------------------------------------------------------------------------
    // Method: visit
    //
    // Description:
    //
    //   Visits the requested value.
    //
    // Parameters:
    //
    //   - bounds:
    //     The bounds supplied to the operation.
    //
    //   - visitor:
    //     The visitor supplied to the operation.
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

    public visit ( bounds: ChartRoutingSpatialBounds, visitor: ( value: Value ) => boolean ): boolean
    {
        // Return the computed result.

        return this.root === null || queryPackedNode ( this.root, bounds, visitor );
    }
}

//--------------------------------------------------------------------------------------------------
// Class: AppendChartRoutingSpatialIndex
//
// Description:
//
//   Implements the append chart routing spatial index behavior.
//
//--------------------------------------------------------------------------------------------------

export class AppendChartRoutingSpatialIndex<Value> implements ChartRoutingSpatialQuery<Value>
{
    private readonly entries: ChartRoutingSpatialEntry<Value>[] = [];

    //----------------------------------------------------------------------------------------------
    // Method: append
    //
    // Description:
    //
    //   Appends the requested value.
    //
    // Parameters:
    //
    //   - entry:
    //     The entry supplied to the operation.
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

    public append ( entry: ChartRoutingSpatialEntry<Value> ): void
    {
        this.entries.push ( entry );
    }

    //----------------------------------------------------------------------------------------------
    // Method: query
    //
    // Description:
    //
    //   Queries the requested value.
    //
    // Parameters:
    //
    //   - bounds:
    //     The bounds supplied to the operation.
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

    public query ( bounds: ChartRoutingSpatialBounds ): readonly Value[]
    {
        // Return the mapped collection.

        return this.entries.filter ( entry => chartRoutingSpatialBoundsIntersect ( entry.bounds, bounds ) )
            .map ( entry => entry.value );
    }

    //----------------------------------------------------------------------------------------------
    // Method: visit
    //
    // Description:
    //
    //   Visits the requested value.
    //
    // Parameters:
    //
    //   - bounds:
    //     The bounds supplied to the operation.
    //
    //   - visitor:
    //     The visitor supplied to the operation.
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

    public visit ( bounds: ChartRoutingSpatialBounds, visitor: ( value: Value ) => boolean ): boolean
    {
        // Process each entry from the entries collection in order.

        for ( const entry of this.entries )
        {
            // Handle the case where all required conditions are satisfied.

            if ( chartRoutingSpatialBoundsIntersect ( entry.bounds, bounds ) && !visitor ( entry.value ) )
            {
                // Return the computed result.

                return false;
            }
        }

        // Return the computed result.

        return true;
    }
}
