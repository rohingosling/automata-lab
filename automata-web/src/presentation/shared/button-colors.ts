// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Button Color Presentation
// Version: 1.0.0
// Date:    2026-09-06
// Author:  Rohin Gosling
//
// Description:
//
//   Maps allowlisted application colors to shared button and title-bar CSS tokens.
//   Muted solid palettes retain readable text; Console matching uses the same named palettes.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { CSSProperties } from "react";

import type { ConsoleEntry } from "../../application/contracts.js";
import type { ButtonColor } from "../../application/button-colors.js";
import type { ApplicationPreferences } from "../../application/ports/contracts.js";
import { COMPILE_TIME_CONFIGURATION } from "../../configuration/compile-time-configuration.js";

interface ButtonColorPalette
{
    readonly surface:    string;
    readonly hover:      string;
    readonly active:     string;
    readonly text:       string;
    readonly iconFilter: string;
}

const LIGHT_ICON_FILTER = "brightness(0) invert(1)";
const DARK_ICON_FILTER  = "brightness(0)";

const BUTTON_COLOR_PALETTES: Readonly<Record<ButtonColor, ButtonColorPalette>> =
{
    Blue:   { surface: "#355c85", hover: "#2c4d70", active: "#243f5c", text: "#ffffff", iconFilter: LIGHT_ICON_FILTER },
    Green:  { surface: "#3e6248", hover: "#34523c", active: "#294130", text: "#ffffff", iconFilter: LIGHT_ICON_FILTER },
    Teal:   { surface: "#365f62", hover: "#2d5052", active: "#244043", text: "#ffffff", iconFilter: LIGHT_ICON_FILTER },
    Purple: { surface: "#624775", hover: "#533c63", active: "#443151", text: "#ffffff", iconFilter: LIGHT_ICON_FILTER },
    Red:    { surface: "#914941", hover: "#7b3e37", active: "#65332e", text: "#ffffff", iconFilter: LIGHT_ICON_FILTER },
    Orange: { surface: "#875432", hover: "#72472a", active: "#5d3a22", text: "#ffffff", iconFilter: LIGHT_ICON_FILTER },
    Yellow: { surface: "#c4ae65", hover: "#b6a059", active: "#a8914b", text: "#17212b", iconFilter: DARK_ICON_FILTER },
    Black:  { surface: "#141414", hover: "#292929", active: "#383838", text: "#ffffff", iconFilter: LIGHT_ICON_FILTER },
    White:  { surface: "#e6e4e1", hover: "#d8d6d3", active: "#cac8c5", text: "#17212b", iconFilter: DARK_ICON_FILTER },
    Gray:
    {
        surface:    "#fafbfc",
        hover:      "#eef2f5",
        active:     "#e1e7ed",
        text:       "var(--text)",
        iconFilter: "var(--theme-button-icon-filter)",
    },
};

//--------------------------------------------------------------------------------------------------
// Function: buttonColorStyle
//
// Description:
//
//   Supplies independent palettes for title bars, general buttons, and inline Console entry actions.
//
//--------------------------------------------------------------------------------------------------

export function buttonColorStyle ( preferences: ApplicationPreferences ): CSSProperties
{
    const darkTheme = preferences.theme === "Dark";
    const grayPalette: ButtonColorPalette = darkTheme
        ? { surface: "#383838", hover: "#454545", active: "#515151",
            text: "#f2f2f2", iconFilter: LIGHT_ICON_FILTER }
        : BUTTON_COLOR_PALETTES.Gray;
    const applicationPalette = preferences.applicationButtonColor === "Gray"
        ? grayPalette : BUTTON_COLOR_PALETTES [ preferences.applicationButtonColor ];
    const consolePalette = preferences.consoleMessageButtonColor === "Gray"
        ? grayPalette : BUTTON_COLOR_PALETTES [ preferences.consoleMessageButtonColor ];
    const titleColor = preferences.titleBarColor ??
        COMPILE_TIME_CONFIGURATION.applicationSettings.appearance.titleBarColor;
    const titlePalette = titleColor === "Gray" ? grayPalette : BUTTON_COLOR_PALETTES [ titleColor ];
    const matching = preferences.matchConsoleMessageColor;
    const outlineConsoleText = darkTheme &&
        !matching && ( preferences.consoleMessageButtonColor === "Yellow" || preferences.consoleMessageButtonColor === "White" );

    // A fine dark edge preserves white-text contrast on pale Dark-theme Console fills.
    // Omitted Console surfaces resolve each row's shared named palette at the button itself.

    return {
        "--title-bar-surface":          darkTheme ? titlePalette.active : titlePalette.surface,
        "--title-bar-text":             titlePalette.text,
        "--button-surface":             applicationPalette.surface,
        "--button-hover":               applicationPalette.hover,
        "--button-active":              applicationPalette.active,
        "--button-text":                applicationPalette.text,
        "--button-icon-filter":         applicationPalette.iconFilter,
        "--console-button-surface":     matching ? undefined : consolePalette.surface,
        "--console-button-hover":       matching ? undefined : consolePalette.hover,
        "--console-button-active":      matching ? undefined : consolePalette.active,
        "--console-button-text":        darkTheme || matching ? "#ffffff" : consolePalette.text,
        "--console-button-shadow":      outlineConsoleText
            ? "1px 0 #17212b, -1px 0 #17212b, 0 1px #17212b, 0 -1px #17212b" : "none",
        "--console-button-icon-filter": matching ? LIGHT_ICON_FILTER : consolePalette.iconFilter,
    } as CSSProperties;
}

//--------------------------------------------------------------------------------------------------
// Function: consoleSeverityButtonStyle
//
// Description:
//
//   Supplies Green message, Blue warning, and Red error palettes for optional Console matching.
//
//--------------------------------------------------------------------------------------------------

export function consoleSeverityButtonStyle ( severity: ConsoleEntry["severity"] ): CSSProperties
{
    const palette = severity === "message" ? BUTTON_COLOR_PALETTES.Green
        : severity === "warning" ? BUTTON_COLOR_PALETTES.Blue : BUTTON_COLOR_PALETTES.Red;

    return {
        "--console-severity-surface": palette.surface,
        "--console-severity-hover":   palette.hover,
        "--console-severity-active":  palette.active,
    } as CSSProperties;
}
