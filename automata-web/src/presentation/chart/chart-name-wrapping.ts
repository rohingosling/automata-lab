// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Chart Name Wrapping
// Version: 1.0.0
// Date:    2026-08-11
// Author:  Rohin Gosling
//
// Description:
//
//   Wraps state, event, and action names only at the separators permitted by the Chart contract.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

export const CHART_NAME_CHARACTER_LIMIT = 34;

//--------------------------------------------------------------------------------------------------
// Function: wrapChartName
//
// Description:
//
//   Derives the wrap chart name.
//
// Parameters:
//
//   - name:
//     The name supplied to the operation.
//
//   - wrappingEnabled:
//     The wrapping enabled supplied to the operation.
//
//   - characterLimit:
//     The character limit supplied to the operation.
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

export function wrapChartName (
    name: string,
    wrappingEnabled: boolean,
    characterLimit: number = CHART_NAME_CHARACTER_LIMIT,
): readonly string[]
{
    // Handle the case where at least one branch condition is satisfied.

    if ( !wrappingEnabled || name.length <= characterLimit )
    {
        // Return the assembled result collection.

        return [ name ];
    }

    // Initialize the local values needed by this operation.

    const segments        = name.match ( /[^ _-]+(?:[ _-]+|$)/gu ) ?? [ name ];
    const lines: string[] = [];
    let currentLine       = "";

    // Process each segment from the segments collection in order.

    for ( const segment of segments )
    {
        // Handle the case where all required conditions are satisfied.

        if ( currentLine.length > 0 && currentLine.length + segment.length > characterLimit )
        {
            lines.push ( currentLine.trimEnd () );
            currentLine = segment.trimStart ();
        }
        else
        {
            // Handle the remaining case after the preceding condition is false.

            currentLine += segment;
        }
    }

    // Handle the case where current line length exceeds the 0 value.

    if ( currentLine.length > 0 )
    {
        lines.push ( currentLine.trimEnd () );
    }

    // Return the result selected by the current condition.

    return lines.length > 0 ? lines : [ name ];
}
