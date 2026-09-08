// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Chart Routing Spatial Index Tests
// Version: 1.0.0
// Date:    2026-08-22
// Author:  Rohin Gosling
//
// Description:
//
//   Proves the deterministic packed and append Chart routing indexes equivalent to inclusive linear
//   AABB scans.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import
{
    AppendChartRoutingSpatialIndex,
    PackedChartRoutingSpatialIndex,
    chartRoutingSpatialBoundsIntersect,
    type ChartRoutingSpatialBounds,
    type ChartRoutingSpatialEntry,
} from "../../src/application/chart-routing-spatial-index";

const coordinateArbitrary                                      = fc.integer ( { min: -1_000, max: 1_000 } );
const extentArbitrary                                          = fc.integer ( { min: 0, max: 200 } );
const boundsArbitrary: fc.Arbitrary<ChartRoutingSpatialBounds> = fc.tuple (
    coordinateArbitrary,
    coordinateArbitrary,
    extentArbitrary,
    extentArbitrary,
).map ( ( [ minimumX, minimumY, width, height ] ) => ( {
    maximumX: minimumX + width,
    maximumY: minimumY + height,
    minimumX,
    minimumY,
} ) );

//--------------------------------------------------------------------------------------------------
// Function: expectedValues
//
// Description:
//
//   Derives the expected values.
//
// Parameters:
//
//   - entries:
//     The entries supplied to the operation.
//
//   - queryBounds:
//     The query bounds supplied to the operation.
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

function expectedValues (
    entries: readonly ChartRoutingSpatialEntry<number>[],
    queryBounds: ChartRoutingSpatialBounds,
): readonly number[]
{
    // Return the mapped collection.

    return entries.filter ( entry => chartRoutingSpatialBoundsIntersect ( entry.bounds, queryBounds ) )
        .map ( entry => entry.value );
}

describe ( "Chart routing spatial indexes", () =>
{
    it ( "returns exactly the packed query candidates found by an inclusive linear scan", () =>
    {
        fc.assert ( fc.property (
            fc.array ( boundsArbitrary, { maxLength: 160 } ),
            boundsArbitrary,
            ( entryBounds, queryBounds ) =>
            {
                // Initialize the local values needed by this operation.

                const entries = entryBounds.map ( ( bounds, value ) => ( { bounds, value } ) );
                const index   = new PackedChartRoutingSpatialIndex ( entries );

                expect ( [ ...index.query ( queryBounds ) ].sort ( ( left, right ) => left - right ) )
                    .toEqual ( [ ...expectedValues ( entries, queryBounds ) ].sort ( ( left, right ) => left - right ) );
            },
        ), { numRuns: 500 } );
    } );

    it ( "returns append query candidates in insertion order exactly like an inclusive linear scan", () =>
    {
        fc.assert ( fc.property (
            fc.array ( boundsArbitrary, { maxLength: 160 } ),
            boundsArbitrary,
            ( entryBounds, queryBounds ) =>
            {
                // Initialize the local values needed by this operation.

                const entries = entryBounds.map ( ( bounds, value ) => ( { bounds, value } ) );
                const index   = new AppendChartRoutingSpatialIndex<number> ();

                entries.forEach ( entry => index.append ( entry ) );

                expect ( index.query ( queryBounds ) ).toEqual ( expectedValues ( entries, queryBounds ) );
            },
        ), { numRuns: 500 } );
    } );

    it ( "keeps boundary-touching and zero-area candidates for the exact narrow phase", () =>
    {
        // Initialize the local values needed by this operation.

        const index = new PackedChartRoutingSpatialIndex ( [
            { bounds: { maximumX: 10, maximumY: 10, minimumX: 0, minimumY: 0 }, value: "touching" },
            { bounds: { maximumX: 20, maximumY: 20, minimumX: 20, minimumY: 20 }, value: "point" },
        ] );

        expect ( new Set ( index.query ( { maximumX: 20, maximumY: 20, minimumX: 10, minimumY: 10 } ) ) )
            .toEqual ( new Set ( [ "touching", "point" ] ) );
    } );

    it ( "keeps insertion order when packed sort keys are equal", () =>
    {
        // Initialize the local values needed by this operation.

        const bounds = { maximumX: 10, maximumY: 10, minimumX: 0, minimumY: 0 };
        const index  = new PackedChartRoutingSpatialIndex ( Array.from ( { length: 20 }, ( _, value ) => ( {
            bounds,
            value,
        } ) ) );

        expect ( index.query ( bounds ) ).toEqual ( Array.from ( { length: 20 }, ( _, value ) => value ) );
        expect ( index.query ( bounds ) ).toEqual ( index.query ( bounds ) );
    } );
} );
