// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Button Color Preferences
// Version: 1.0.0
// Date:    2026-09-06
// Author:  Rohin Gosling
//
// Description:
//
//   Defines the shared allowlist for independently selected application and Console button colors.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

export const BUTTON_COLORS =
[
    "Blue", "Gray", "Green", "Teal", "Purple", "Red", "Orange", "Yellow", "Black", "White",
] as const;

export type ButtonColor = typeof BUTTON_COLORS[number];

//--------------------------------------------------------------------------------------------------
// Function: readButtonColor
//
// Description:
//
//   Accepts only a named palette choice; missing or invalid values retain the supplied default.
//
//--------------------------------------------------------------------------------------------------

export function readButtonColor ( value: unknown, fallback: ButtonColor ): ButtonColor
{
    return BUTTON_COLORS.find ( color => color === value ) ?? fallback;
}
