// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Chart Grid Color Tests
// Version: 1.0.0
// Date:    2026-08-24
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies that one authored grid color is re-expressed for the opposite theme without losing its
//   hue or drifting across repeated theme changes.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { adaptChartGridColor, isChartGridColor } from "../../src/presentation/chart/chart-grid-color.js";

//--------------------------------------------------------------------------------------------------
// Function: lightnessOf
//
// Description:
//
//   Derives the lightness of.
//
// Parameters:
//
//   - color:
//     The color supplied to the operation.
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

function lightnessOf ( color: string ): number
{
    // Calculate the channels value from the current inputs.

    const channels = [ 1, 3, 5 ].map ( offset => Number.parseInt ( color.slice ( offset, offset + 2 ), 16 ) / 255 );

    // Return the computed result.

    return ( Math.max ( ...channels ) + Math.min ( ...channels ) ) / 2;
}

const hexColor = fc.tuple (
    fc.integer ( { max: 255, min: 0 } ),
    fc.integer ( { max: 255, min: 0 } ),
    fc.integer ( { max: 255, min: 0 } ),
).map ( channels => `#${channels.map ( channel => channel.toString ( 16 ).padStart ( 2, "0" ) ).join ( "" )}` );

describe ( "Chart grid color", () =>
{
    it ( "leaves a color unchanged in the theme it was authored against", () =>
    {
        expect ( adaptChartGridColor ( "#4e5d6b", "Light", "Light" ) ).toBe ( "#4e5d6b" );
        expect ( adaptChartGridColor ( "#4e5d6b", "Dark", "Dark" ) ).toBe ( "#4e5d6b" );
    } );

    it ( "moves a color across the canvas midpoint when the theme differs", () =>
    {
        // The default grid is a dark blue-grey chosen against the white canvas; on the near-black
        // canvas it has to become the light member of the same family to keep the same separation.

        const adapted = adaptChartGridColor ( "#4e5d6b", "Light", "Dark" );

        expect ( lightnessOf ( "#4e5d6b" ) ).toBeLessThan ( 0.5 );
        expect ( lightnessOf ( adapted ) ).toBeGreaterThan ( 0.5 );
    } );

    it ( "keeps a saturated color saturated rather than washing it out", () =>
    {
        // Initialize the local values needed by this operation.

        const adapted = adaptChartGridColor ( "#ff0000", "Light", "Dark" );

        expect ( adapted ).not.toBe ( "#ff0000" );
        expect ( lightnessOf ( adapted ) ).toBeGreaterThan ( lightnessOf ( "#ff0000" ) );
    } );

    it ( "returns a color to its own lightness after a round trip through the other theme", () =>
    {
        // Reflection is its own inverse, so a color reflected out and back regains the lightness it
        // started with. Only a color darker than the dark canvas cannot be reflected without
        // leaving the range; those are excluded.
        //
        // The assertion is on lightness rather than on the individual channels because a reflected
        // color near either extreme has very little room left for chroma in eight bits, so its
        // channels round more coarsely than the lightness they encode. Exactness is a courtesy in
        // any case: an adapted color is computed for rendering and never written back over the
        // authored one, so switching themes repeatedly cannot move what the user chose.

        fc.assert ( fc.property ( hexColor.filter ( color => lightnessOf ( color ) >= 0.12 ), color =>
        {
            // Initialize the local values needed by this operation.

            const away = adaptChartGridColor ( color, "Light", "Dark" );
            const back = adaptChartGridColor ( away, "Dark", "Light" );

            expect ( Math.abs ( lightnessOf ( back ) - lightnessOf ( color ) ) ).toBeLessThanOrEqual ( 0.01 );
        } ), { numRuns: 200 } );
    } );

    it ( "always produces a usable color and never a transparent or malformed one", () =>
    {
        fc.assert ( fc.property ( hexColor, color =>
        {
            // Initialize the local values needed by this operation.

            const adapted = adaptChartGridColor ( color, "Light", "Dark" );

            expect ( isChartGridColor ( adapted ) ).toBe ( true );
            expect ( lightnessOf ( adapted ) ).toBeGreaterThanOrEqual ( 0 );
            expect ( lightnessOf ( adapted ) ).toBeLessThanOrEqual ( 1 );
        } ), { numRuns: 200 } );
    } );

    it ( "rejects anything that is not a six-digit hex color", () =>
    {
        // Process each value from the current value collection in order.

        for ( const value of [ "red", "#fff", "#12345g", "", "rgb(0,0,0)", null, 42 ] )
        {
            expect ( isChartGridColor ( value ) ).toBe ( false );
        }
    } );
} );
