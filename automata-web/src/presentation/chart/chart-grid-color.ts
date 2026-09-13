// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Chart Grid Color
// Version: 1.0.0
// Date:    2026-08-24
// Author:  Rohin Gosling
//
// Description:
//
//   Re-expresses one authored Chart grid color for the opposite theme, so a color chosen against
//   one canvas keeps its hue and its separation from the canvas when the other theme is selected.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

//--------------------------------------------------------------------------------------------------
// Type: ChartGridColorTheme
//
// Description:
//
//   Defines the supported chart grid color theme alternatives.
//
//--------------------------------------------------------------------------------------------------

export type ChartGridColorTheme = "Dark" | "Light";

// The two Chart canvas surfaces, as HSL lightness. A grid color is authored to sit a certain
// distance from the canvas it was chosen against; carrying that distance to the other canvas is
// what keeps a grid readable after a theme change. Reflecting lightness about the midpoint of the
// two canvases does exactly that, and because the reflection is its own inverse, switching themes
// repeatedly always returns the original color rather than drifting.

const LIGHT_CANVAS_LIGHTNESS = 1;
const DARK_CANVAS_LIGHTNESS  = 24 / 255;
const REFLECTION_MIDPOINT    = LIGHT_CANVAS_LIGHTNESS + DARK_CANVAS_LIGHTNESS;

// Reflection can carry a color darker than the dark canvas past pure white, so the result is held
// inside the representable range. No narrower band is imposed: squeezing the result into a "safe"
// band would break the reflection's symmetry for ordinary colors while doing nothing useful for a
// color the user cannot see in the theme they picked it in either.

const MINIMUM_LIGHTNESS = 0;
const MAXIMUM_LIGHTNESS = 1;

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/iu;

//--------------------------------------------------------------------------------------------------
// Interface: HueSaturationLightness
//
// Description:
//
//   Defines the structure of hue saturation lightness.
//
//--------------------------------------------------------------------------------------------------

interface HueSaturationLightness
{
    readonly hue:        number;
    readonly saturation: number;
    readonly lightness:  number;
}

//--------------------------------------------------------------------------------------------------
// Function: isChartGridColor
//
// Description:
//
//   Determines whether chart grid color.
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

export function isChartGridColor ( value: unknown ): value is string
{
    // Return the computed result.

    return typeof value === "string" && HEX_COLOR_PATTERN.test ( value );
}

//--------------------------------------------------------------------------------------------------
// Function: hueSaturationLightnessFromHex
//
// Description:
//
//   Derives the hue saturation lightness from hex.
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

function hueSaturationLightnessFromHex ( color: string ): HueSaturationLightness
{
    // Initialize the local values needed by this operation.

    const red       = Number.parseInt ( color.slice ( 1, 3 ), 16 ) / 255;
    const green     = Number.parseInt ( color.slice ( 3, 5 ), 16 ) / 255;
    const blue      = Number.parseInt ( color.slice ( 5, 7 ), 16 ) / 255;
    const largest   = Math.max ( red, green, blue );
    const smallest  = Math.min ( red, green, blue );
    const span      = largest - smallest;
    const lightness = ( largest + smallest ) / 2;

    // Handle the case where span equals 0.

    if ( span === 0 )
    {
        // Return the assembled result.

        return { hue: 0, saturation: 0, lightness };
    }

    // Initialize the local values needed by this operation.

    const saturation = span / ( 1 - Math.abs ( 2 * lightness - 1 ) );
    const hue        = largest === red
        ? ( ( green - blue ) / span + ( green < blue ? 6 : 0 ) )
        : largest === green
            ? ( blue - red ) / span + 2
            : ( red - green ) / span + 4;

    // Return the assembled result.

    return { hue: hue * 60, saturation, lightness };
}

//--------------------------------------------------------------------------------------------------
// Function: hexFromHueSaturationLightness
//
// Description:
//
//   Derives the hex from hue saturation lightness.
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

function hexFromHueSaturationLightness ( color: HueSaturationLightness ): string
{
    // Initialize the local values needed by this operation.

    const chroma    = ( 1 - Math.abs ( 2 * color.lightness - 1 ) ) * color.saturation;
    const secondary = chroma * ( 1 - Math.abs ( ( color.hue / 60 ) % 2 - 1 ) );
    const offset    = color.lightness - chroma / 2;
    const sector    = Math.floor ( ( ( color.hue % 360 ) + 360 ) % 360 / 60 );
    const [ red, green, blue ] = sector === 0 ? [ chroma, secondary, 0 ]
        : sector === 1 ? [ secondary, chroma, 0 ]
            : sector === 2 ? [ 0, chroma, secondary ]
                : sector === 3 ? [ 0, secondary, chroma ]
                    : sector === 4 ? [ secondary, 0, chroma ]
                        : [ chroma, 0, secondary ];

    //----------------------------------------------------------------------------------------------
    // Function: channel
    //
    // Description:
    //
    //   Derives the channel.
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
    //----------------------------------------------------------------------------------------------

    const channel = ( value: number ): string =>
        Math.round ( Math.min ( 1, Math.max ( 0, value + offset ) ) * 255 )
            .toString ( 16 )
            .padStart ( 2, "0" );

    // Return the computed result.

    return `#${channel ( red ?? 0 )}${channel ( green ?? 0 )}${channel ( blue ?? 0 )}`;
}

//--------------------------------------------------------------------------------------------------
// Function: adaptChartGridColor
//
// Description:
//
//   Derives the adapt chart grid color.
//
// Parameters:
//
//   - color:
//     The color supplied to the operation.
//
//   - authoredTheme:
//     The authored theme supplied to the operation.
//
//   - currentTheme:
//     The current theme supplied to the operation.
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

export function adaptChartGridColor (
    color: string,
    authoredTheme: ChartGridColorTheme,
    currentTheme: ChartGridColorTheme,
): string
{
    // Handle the case where at least one branch condition is satisfied.

    if ( !isChartGridColor ( color ) || authoredTheme === currentTheme )
    {
        // Return the color.

        return color;
    }

    const authored = hueSaturationLightnessFromHex ( color );

    // Return the hex from hue saturation lightness result.

    return hexFromHueSaturationLightness ( {
        hue:        authored.hue,
        saturation: authored.saturation,
        lightness:  Math.min (
            MAXIMUM_LIGHTNESS,
            Math.max ( MINIMUM_LIGHTNESS, REFLECTION_MIDPOINT - authored.lightness ),
        ),
    } );
}
