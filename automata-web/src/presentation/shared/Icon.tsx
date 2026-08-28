// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Icon
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Resolves curated same-origin SVG assets beneath the configured application base path.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

//--------------------------------------------------------------------------------------------------
// Interface: IconProperties
//
// Description:
//
//   Defines the properties accepted by the icon interface.
//
//--------------------------------------------------------------------------------------------------

interface IconProperties
{
    readonly className?: string;
    readonly name:       string;
    readonly source:     "custom" | "fluent";
}

//--------------------------------------------------------------------------------------------------
// Function: Icon
//
// Description:
//
//   Renders the icon interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered icon interface.
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

export function Icon ( properties: IconProperties )
{
    // Return the rendered interface.

    return (
        <img
            alt=""
            aria-hidden="true"
            className = { properties.className ?? "command-icon" }
            draggable = { false }
            src       = { `${import.meta.env.BASE_URL}icons/${properties.source}/${properties.name}` }
        />
    );
}
