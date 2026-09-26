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
//   Application and Console buttons share palettes; severity selects the nearest color family.
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

const CONSOLE_SEVERITY_COLORS: Readonly<Record<ConsoleEntry["severity"], ButtonColor>> =
{
    message: "Green",
    warning: "Blue",
    error:   "Red",
};

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

    // Light-mode Console labels follow the visible neutral shades in the shared palette.

    const consoleColor = preferences.consoleMessageButtonColor;
    const consolePalette = !darkTheme && consoleColor === "Gray" ? BUTTON_COLOR_PALETTES.White
        : !darkTheme && consoleColor === "White" ? BUTTON_COLOR_PALETTES.Gray
        : consoleColor === "Gray" ? grayPalette : BUTTON_COLOR_PALETTES [ consoleColor ];
    const titleColor = preferences.titleBarColor ??
        COMPILE_TIME_CONFIGURATION.applicationSettings.appearance.titleBarColor;
    const titlePalette = titleColor === "Gray" ? grayPalette : BUTTON_COLOR_PALETTES [ titleColor ];
    const matching = preferences.matchConsoleMessageColor;

    // Omitted Console tokens resolve the row's nearest shared palette at the button itself.

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
        "--console-button-text":        matching ? undefined : consolePalette.text,
        "--console-button-icon-filter": matching ? undefined : consolePalette.iconFilter,
    } as CSSProperties;
}

//--------------------------------------------------------------------------------------------------
// Function: consoleSeverityButtonStyle
//
// Description:
//
//   Selects the nearest shared palette color family for each fixed semantic severity color.
//
//--------------------------------------------------------------------------------------------------

export function consoleSeverityButtonStyle ( severity: ConsoleEntry["severity"] ): CSSProperties
{
    const palette = BUTTON_COLOR_PALETTES [ CONSOLE_SEVERITY_COLORS [ severity ] ];

    return {
        "--console-severity-surface":     palette.surface,
        "--console-severity-hover":       palette.hover,
        "--console-severity-active":      palette.active,
        "--console-severity-text":        palette.text,
        "--console-severity-icon-filter": palette.iconFilter,
    } as CSSProperties;
}
