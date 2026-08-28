// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Browser Application Preferences
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Loads and saves the versioned allowlist of content-independent application preferences.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { ApplicationPreferences } from "../../application/ports/contracts";
import
{
    COMPILE_TIME_CONFIGURATION,
    DEFAULT_APPLICATION_PREFERENCES,
} from "../../configuration/compile-time-configuration.js";

const APPLICATION_SETTING_CONSTRAINTS = COMPILE_TIME_CONFIGURATION.applicationSettingConstraints;

export const PREFERENCE_STORAGE_KEY = COMPILE_TIME_CONFIGURATION.persistence.applicationPreferencesStorageKey;
export const PREFERENCE_FORMAT_VERSION =
    COMPILE_TIME_CONFIGURATION.persistence.applicationPreferencesFormatVersion;

export const DEFAULT_MASTER_PANEL_WIDTH = DEFAULT_APPLICATION_PREFERENCES.masterPanelWidth;
export const DEFAULT_CONSOLE_PANEL_HEIGHT = DEFAULT_APPLICATION_PREFERENCES.consolePanelHeight;
export const MINIMUM_MASTER_PANEL_WIDTH =
    APPLICATION_SETTING_CONSTRAINTS.workspace.minimumMasterPanelWidth;
export const MINIMUM_CONSOLE_PANEL_HEIGHT =
    APPLICATION_SETTING_CONSTRAINTS.workspace.minimumConsolePanelHeight;
export const MAXIMUM_STORED_PANEL_SIZE =
    APPLICATION_SETTING_CONSTRAINTS.workspace.maximumStoredPanelSize;

export { DEFAULT_APPLICATION_PREFERENCES };


//--------------------------------------------------------------------------------------------------
// Interface: StoredPreferenceEnvelope
//
// Description:
//
//   Defines the structure of stored preference envelope.
//
//--------------------------------------------------------------------------------------------------

interface StoredPreferenceEnvelope
{
    readonly version: number;
    readonly preferences: ApplicationPreferences;
}


//--------------------------------------------------------------------------------------------------
// Interface: PreferenceLoadResult
//
// Description:
//
//   Describes the result produced by preference load.
//
//--------------------------------------------------------------------------------------------------

export interface PreferenceLoadResult
{
    readonly preferences: ApplicationPreferences;
    readonly warningCode:  "PREFERENCE_CORRUPT" | "PREFERENCE_VERSION_UNSUPPORTED" | null;
}


//--------------------------------------------------------------------------------------------------
// Function: isRecord
//
// Description:
//
//   Determines whether record.
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

function isRecord ( value: unknown ): value is Record <string, unknown>
{
    // Return the computed result.

    return typeof value === "object" && value !== null && !Array.isArray ( value );
}


//--------------------------------------------------------------------------------------------------
// Function: readBoolean
//
// Description:
//
//   Returns boolean.
//
// Parameters:
//
//   - value:
//     The value supplied to the operation.
//
//   - fallback:
//     The fallback supplied to the operation.
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

function readBoolean ( value: unknown, fallback: boolean ): boolean
{
    // Return the result selected by the current condition.

    return typeof value === "boolean" ? value : fallback;
}


//--------------------------------------------------------------------------------------------------
// Function: readNumber
//
// Description:
//
//   Returns number.
//
// Parameters:
//
//   - value:
//     The value supplied to the operation.
//
//   - fallback:
//     The fallback supplied to the operation.
//
//   - minimum:
//     The minimum supplied to the operation.
//
//   - maximum:
//     The maximum supplied to the operation.
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

function readNumber ( value: unknown, fallback: number, minimum: number, maximum: number ): number
{
    // Return the result selected by the current condition.

    return typeof value === "number" && Number.isFinite ( value ) && value >= minimum && value <= maximum
        ? value
        : fallback;
}


//--------------------------------------------------------------------------------------------------
// Function: readInteger
//
// Description:
//
//   Returns integer.
//
// Parameters:
//
//   - value:
//     The value supplied to the operation.
//
//   - fallback:
//     The fallback supplied to the operation.
//
//   - minimum:
//     The minimum supplied to the operation.
//
//   - maximum:
//     The maximum supplied to the operation.
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

function readInteger ( value: unknown, fallback: number, minimum: number, maximum: number ): number
{
    // Return the result selected by the current condition.

    return typeof value === "number" && Number.isInteger ( value ) && value >= minimum && value <= maximum
        ? value
        : fallback;
}


//--------------------------------------------------------------------------------------------------
// Function: hasInvalidAllowlistedValue
//
// Description:
//
//   Determines whether invalid allowlisted value.
//
// Parameters:
//
//   - value:
//     The value supplied to the operation.
//
//   - preferences:
//     The preferences supplied to the operation.
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

function hasInvalidAllowlistedValue ( value: Readonly<Record<string, unknown>>, preferences: ApplicationPreferences ):
    boolean
{
    // Initialize the local values needed by this operation.

    const parsedValues = preferences as unknown as Readonly<Record<string, unknown>>;


    // Return the some result.

    return Object.keys ( parsedValues ).some ( key => key in value && value [ key ] !== parsedValues [ key ] );
}


//--------------------------------------------------------------------------------------------------
// Function: readImageFileFormat
//
// Description:
//
//   Returns image file format.
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

function readImageFileFormat ( value: unknown ): ApplicationPreferences["imageFileFormat"]
{
    // Return the result selected by the current condition.

    return value === "JPG" || value === "PNG" || value === "SVG"
        ? value
        : DEFAULT_APPLICATION_PREFERENCES.imageFileFormat;
}


//--------------------------------------------------------------------------------------------------
// Function: readImageUnit
//
// Description:
//
//   Returns image unit.
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

function readImageUnit ( value: unknown ): ApplicationPreferences["imageUnit"]
{
    // Return the result selected by the current condition.

    return value === "Centimetres" || value === "Inches" || value === "Pixels"
        ? value
        : DEFAULT_APPLICATION_PREFERENCES.imageUnit;
}


//--------------------------------------------------------------------------------------------------
// Function: readPrintOrientation
//
// Description:
//
//   Returns print orientation.
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

function readPrintOrientation ( value: unknown ): ApplicationPreferences["printOrientation"]
{
    // Return the result selected by the current condition.

    return value === "Landscape" || value === "Portrait"
        ? value
        : DEFAULT_APPLICATION_PREFERENCES.printOrientation;
}


//--------------------------------------------------------------------------------------------------
// Function: readPrintPaperSize
//
// Description:
//
//   Returns print paper size.
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

function readPrintPaperSize ( value: unknown ): ApplicationPreferences["printPaperSize"]
{
    // Return the result selected by the current condition.

    return value === "A4" || value === "Legal" || value === "Letter"
        ? value
        : DEFAULT_APPLICATION_PREFERENCES.printPaperSize;
}


//--------------------------------------------------------------------------------------------------
// Function: readPrintStyle
//
// Description:
//
//   Returns print style.
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

function readPrintStyle ( value: unknown ): ApplicationPreferences["printStyle"]
{
    // Return the result selected by the current condition.

    return value === "Academic" || value === "Industry"
        ? value
        : DEFAULT_APPLICATION_PREFERENCES.printStyle;
}


//--------------------------------------------------------------------------------------------------
// Function: readTransitionLabelAlignment
//
// Description:
//
//   Returns transition label alignment.
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

function readTransitionLabelAlignment ( value: unknown ): ApplicationPreferences["transitionLabelAlignment"]
{
    // Return the result selected by the current condition.

    return value === "Center" || value === "End" || value === "Start"
        ? value
        : DEFAULT_APPLICATION_PREFERENCES.transitionLabelAlignment;
}


//--------------------------------------------------------------------------------------------------
// Function: readServerUrl
//
// Description:
//
//   Returns server URL.
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

function readServerUrl ( value: unknown ): string
{
    // Handle the case where current value differs from the string value.

    if ( typeof value !== "string" )
    {
        // Return the computed result.

        return DEFAULT_APPLICATION_PREFERENCES.serverUrl;
    }

    const trimmedValue = value.trim ();


    // Return the result selected by the current condition.

    return trimmedValue.length > 0 &&
        trimmedValue.length <= APPLICATION_SETTING_CONSTRAINTS.server.maximumUrlLength
        ? trimmedValue
        : DEFAULT_APPLICATION_PREFERENCES.serverUrl;
}

// Minimum State Distance replaced three earlier Automatic Layout spacing preferences: a single
// percentage, then a horizontal/vertical pair, then a within-layer/between-layer pair. All of them
// were percentages of a state dimension describing an edge-to-edge gap along one axis, and none
// converts meaningfully into a centre-to-centre Euclidean distance, so a stored value under any
// legacy name migrates to the current default rather than to an invented number. The legacy names
// are matched explicitly, so a preference blob written by an older build migrates once and is then
// rewritten without them.

const LEGACY_STATE_SPACING_KEYS: readonly string[] =
[
    "betweenLayerStateSpacing",
    "horizontalStateSpacing",
    "stateSpacing",
    "verticalStateSpacing",
    "withinLayerStateSpacing",
];


//--------------------------------------------------------------------------------------------------
// Function: readMinimumStateDistance
//
// Description:
//
//   Returns minimum state distance.
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

function readMinimumStateDistance ( value: Record<string, unknown> ): number
{
    // Handle the case where all required conditions are satisfied.

    if ( value [ "minimumStateDistance" ] === undefined &&
        LEGACY_STATE_SPACING_KEYS.some ( key => value [ key ] !== undefined ) )
    {
        // Return the computed result.

        return DEFAULT_APPLICATION_PREFERENCES.minimumStateDistance;
    }


    // Return the read integer result.

    return readInteger (
        value [ "minimumStateDistance" ],
        DEFAULT_APPLICATION_PREFERENCES.minimumStateDistance,
        APPLICATION_SETTING_CONSTRAINTS.chart.minimumStateDistance.minimum,
        APPLICATION_SETTING_CONSTRAINTS.chart.minimumStateDistance.maximum,
    );
}

// Six-digit hex only. The persisted surface stays a plain, self-describing value that a colour
// input round-trips exactly, rather than a named or functional colour whose meaning would depend on
// a stylesheet.

const GRID_COLOR_PATTERN = /^#[0-9a-f]{6}$/iu;


//--------------------------------------------------------------------------------------------------
// Function: readGridColor
//
// Description:
//
//   Returns grid color.
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

function readGridColor ( value: unknown ): string
{
    // Return the result selected by the current condition.

    return typeof value === "string" && GRID_COLOR_PATTERN.test ( value )
        ? value.toLocaleLowerCase ( "en" )
        : DEFAULT_APPLICATION_PREFERENCES.gridColor;
}


//--------------------------------------------------------------------------------------------------
// Function: readGridStyle
//
// Description:
//
//   Returns grid style.
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

function readGridStyle ( value: unknown ): ApplicationPreferences["gridStyle"]
{
    // Return the result selected by the current condition.

    return value === "Dots" || value === "Dotted" || value === "Solid"
        ? value
        : DEFAULT_APPLICATION_PREFERENCES.gridStyle;
}


//--------------------------------------------------------------------------------------------------
// Function: readTheme
//
// Description:
//
//   Returns theme.
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

function readTheme ( value: unknown ): ApplicationPreferences["theme"]
{
    // Return the result selected by the current condition.

    return value === "Dark" || value === "Light"
        ? value
        : DEFAULT_APPLICATION_PREFERENCES.theme;
}


//--------------------------------------------------------------------------------------------------
// Function: parseApplicationPreferences
//
// Description:
//
//   Parses application preferences.
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

export function parseApplicationPreferences ( value: unknown ): ApplicationPreferences
{
    // Handle the case where the is record result condition is not satisfied.

    if ( !isRecord ( value ) )
    {
        // Return the default application preferences.

        return DEFAULT_APPLICATION_PREFERENCES;
    }


    // Return the assembled result.

    return {
        collapsedStateHeight: readInteger (
            value [ "collapsedStateHeight" ],
            DEFAULT_APPLICATION_PREFERENCES.collapsedStateHeight,
            APPLICATION_SETTING_CONSTRAINTS.chart.stateDimension.minimum,
            APPLICATION_SETTING_CONSTRAINTS.chart.stateDimension.maximum,
        ),
        collapsedStateWidth: readInteger (
            value [ "collapsedStateWidth" ],
            DEFAULT_APPLICATION_PREFERENCES.collapsedStateWidth,
            APPLICATION_SETTING_CONSTRAINTS.chart.stateDimension.minimum,
            APPLICATION_SETTING_CONSTRAINTS.chart.stateDimension.maximum,
        ),
        consolePanelHeight: readNumber (
            value [ "consolePanelHeight" ],
            DEFAULT_APPLICATION_PREFERENCES.consolePanelHeight,
            MINIMUM_CONSOLE_PANEL_HEIGHT,
            MAXIMUM_STORED_PANEL_SIZE
        ),
        consoleVisible: readBoolean ( value [ "consoleVisible" ], DEFAULT_APPLICATION_PREFERENCES.consoleVisible ),
        followConsoleTail: readBoolean (
            value [ "followConsoleTail" ],
            DEFAULT_APPLICATION_PREFERENCES.followConsoleTail
        ),
        deleteOrphanedChartItemsDuringAutomaticLayout: readBoolean (
            value [ "deleteOrphanedChartItemsDuringAutomaticLayout" ],
            DEFAULT_APPLICATION_PREFERENCES.deleteOrphanedChartItemsDuringAutomaticLayout,
        ),
        expandedStateMinimumHeight: readInteger (
            value [ "expandedStateMinimumHeight" ],
            DEFAULT_APPLICATION_PREFERENCES.expandedStateMinimumHeight,
            APPLICATION_SETTING_CONSTRAINTS.chart.stateDimension.minimum,
            APPLICATION_SETTING_CONSTRAINTS.chart.stateDimension.maximum,
        ),
        expandedStateWidth: readInteger (
            value [ "expandedStateWidth" ],
            DEFAULT_APPLICATION_PREFERENCES.expandedStateWidth,
            APPLICATION_SETTING_CONSTRAINTS.chart.stateDimension.minimum,
            APPLICATION_SETTING_CONSTRAINTS.chart.stateDimension.maximum,
        ),
        gridSize: readInteger (
            value [ "gridSize" ],
            DEFAULT_APPLICATION_PREFERENCES.gridSize,
            APPLICATION_SETTING_CONSTRAINTS.chart.gridSize.minimum,
            APPLICATION_SETTING_CONSTRAINTS.chart.gridSize.maximum,
        ),
        gridColor: readGridColor ( value [ "gridColor" ] ),
        gridColorTheme: value [ "gridColorTheme" ] === "Dark" || value [ "gridColorTheme" ] === "Light"
            ? value [ "gridColorTheme" ]
            : DEFAULT_APPLICATION_PREFERENCES.gridColorTheme,
        gridStyle: readGridStyle ( value [ "gridStyle" ] ),
        imageDpi: readInteger (
            value [ "imageDpi" ],
            DEFAULT_APPLICATION_PREFERENCES.imageDpi,
            APPLICATION_SETTING_CONSTRAINTS.chart.imageDpi.minimum,
            APPLICATION_SETTING_CONSTRAINTS.chart.imageDpi.maximum,
        ),
        imageFileFormat: readImageFileFormat ( value [ "imageFileFormat" ] ),
        imageUnit: readImageUnit ( value [ "imageUnit" ] ),
        maximumImageExportMegapixels: readInteger (
            value [ "maximumImageExportMegapixels" ],
            DEFAULT_APPLICATION_PREFERENCES.maximumImageExportMegapixels,
            APPLICATION_SETTING_CONSTRAINTS.chart.maximumImageExportMegapixels.minimum,
            APPLICATION_SETTING_CONSTRAINTS.chart.maximumImageExportMegapixels.maximum,
        ),
        masterPanelVisible: readBoolean (
            value [ "masterPanelVisible" ],
            DEFAULT_APPLICATION_PREFERENCES.masterPanelVisible
        ),
        masterPanelWidth: readNumber (
            value [ "masterPanelWidth" ],
            DEFAULT_APPLICATION_PREFERENCES.masterPanelWidth,
            MINIMUM_MASTER_PANEL_WIDTH,
            MAXIMUM_STORED_PANEL_SIZE
        ),
        minimumStateDistance: readMinimumStateDistance ( value ),
        printIncludeActions: readBoolean (
            value [ "printIncludeActions" ],
            DEFAULT_APPLICATION_PREFERENCES.printIncludeActions,
        ),
        printIncludeChart: readBoolean (
            value [ "printIncludeChart" ],
            DEFAULT_APPLICATION_PREFERENCES.printIncludeChart,
        ),
        printIncludeEvents: readBoolean (
            value [ "printIncludeEvents" ],
            DEFAULT_APPLICATION_PREFERENCES.printIncludeEvents,
        ),
        printIncludeModelSummary: readBoolean (
            value [ "printIncludeModelSummary" ],
            DEFAULT_APPLICATION_PREFERENCES.printIncludeModelSummary,
        ),
        printIncludeSimulator: readBoolean (
            value [ "printIncludeSimulator" ],
            DEFAULT_APPLICATION_PREFERENCES.printIncludeSimulator,
        ),
        printIncludeSolver: readBoolean (
            value [ "printIncludeSolver" ],
            DEFAULT_APPLICATION_PREFERENCES.printIncludeSolver,
        ),
        printIncludeStateChart: readBoolean (
            value [ "printIncludeStateChart" ],
            DEFAULT_APPLICATION_PREFERENCES.printIncludeStateChart,
        ),
        printIncludeStates: readBoolean (
            value [ "printIncludeStates" ],
            DEFAULT_APPLICATION_PREFERENCES.printIncludeStates,
        ),
        printIncludeTransitionTable: readBoolean (
            value [ "printIncludeTransitionTable" ],
            DEFAULT_APPLICATION_PREFERENCES.printIncludeTransitionTable,
        ),
        printMarginBottomMillimetres: readNumber (
            value [ "printMarginBottomMillimetres" ],
            DEFAULT_APPLICATION_PREFERENCES.printMarginBottomMillimetres,
            APPLICATION_SETTING_CONSTRAINTS.printing.marginMillimetres.minimum,
            APPLICATION_SETTING_CONSTRAINTS.printing.marginMillimetres.maximum,
        ),
        printMarginLeftMillimetres: readNumber (
            value [ "printMarginLeftMillimetres" ],
            DEFAULT_APPLICATION_PREFERENCES.printMarginLeftMillimetres,
            APPLICATION_SETTING_CONSTRAINTS.printing.marginMillimetres.minimum,
            APPLICATION_SETTING_CONSTRAINTS.printing.marginMillimetres.maximum,
        ),
        printMarginRightMillimetres: readNumber (
            value [ "printMarginRightMillimetres" ],
            DEFAULT_APPLICATION_PREFERENCES.printMarginRightMillimetres,
            APPLICATION_SETTING_CONSTRAINTS.printing.marginMillimetres.minimum,
            APPLICATION_SETTING_CONSTRAINTS.printing.marginMillimetres.maximum,
        ),
        printMarginTopMillimetres: readNumber (
            value [ "printMarginTopMillimetres" ],
            DEFAULT_APPLICATION_PREFERENCES.printMarginTopMillimetres,
            APPLICATION_SETTING_CONSTRAINTS.printing.marginMillimetres.minimum,
            APPLICATION_SETTING_CONSTRAINTS.printing.marginMillimetres.maximum,
        ),
        printOrientation: readPrintOrientation ( value [ "printOrientation" ] ),
        printPaperSize:   readPrintPaperSize ( value [ "printPaperSize" ] ),
        printStyle:       readPrintStyle ( value [ "printStyle" ] ),
        saveBackup: readBoolean ( value [ "saveBackup" ], DEFAULT_APPLICATION_PREFERENCES.saveBackup ),
        selfTransitionLoopAspect: readInteger (
            value [ "selfTransitionLoopAspect" ],
            DEFAULT_APPLICATION_PREFERENCES.selfTransitionLoopAspect,
            APPLICATION_SETTING_CONSTRAINTS.chart.selfTransitionLoopAspect.minimum,
            APPLICATION_SETTING_CONSTRAINTS.chart.selfTransitionLoopAspect.maximum,
        ),
        selfTransitionLoopExtension: readInteger (
            value [ "selfTransitionLoopExtension" ],
            DEFAULT_APPLICATION_PREFERENCES.selfTransitionLoopExtension,
            APPLICATION_SETTING_CONSTRAINTS.chart.selfTransitionLoopExtension.minimum,
            APPLICATION_SETTING_CONSTRAINTS.chart.selfTransitionLoopExtension.maximum,
        ),
        selfTransitionLoopSpacing: readInteger (
            value [ "selfTransitionLoopSpacing" ],
            DEFAULT_APPLICATION_PREFERENCES.selfTransitionLoopSpacing,
            APPLICATION_SETTING_CONSTRAINTS.chart.selfTransitionLoopSpacing.minimum,
            APPLICATION_SETTING_CONSTRAINTS.chart.selfTransitionLoopSpacing.maximum,
        ),
        serverUrl: readServerUrl ( value [ "serverUrl" ] ),
        showGrid: readBoolean ( value [ "showGrid" ], DEFAULT_APPLICATION_PREFERENCES.showGrid ),
        snapToGrid: readBoolean ( value [ "snapToGrid" ], DEFAULT_APPLICATION_PREFERENCES.snapToGrid ),
        theme: readTheme ( value [ "theme" ] ),
        transitionArrowHeadSize: readInteger (
            value [ "transitionArrowHeadSize" ],
            DEFAULT_APPLICATION_PREFERENCES.transitionArrowHeadSize,
            APPLICATION_SETTING_CONSTRAINTS.chart.transitionArrowHeadSize.minimum,
            APPLICATION_SETTING_CONSTRAINTS.chart.transitionArrowHeadSize.maximum,
        ),
        transitionGravityPointDistance: readInteger (
            value [ "transitionGravityPointDistance" ],
            DEFAULT_APPLICATION_PREFERENCES.transitionGravityPointDistance,
            APPLICATION_SETTING_CONSTRAINTS.chart.transitionGravityPointDistance.minimum,
            APPLICATION_SETTING_CONSTRAINTS.chart.transitionGravityPointDistance.maximum,
        ),
        transitionLabelAlignment: readTransitionLabelAlignment ( value [ "transitionLabelAlignment" ] ),
        transparentBackground: readBoolean (
            value [ "transparentBackground" ],
            DEFAULT_APPLICATION_PREFERENCES.transparentBackground,
        ),
        wrapActionNames: readBoolean (
            value [ "wrapActionNames" ],
            DEFAULT_APPLICATION_PREFERENCES.wrapActionNames
        ),
        wrapEventNames: readBoolean (
            value [ "wrapEventNames" ],
            DEFAULT_APPLICATION_PREFERENCES.wrapEventNames
        ),
        wrapStateNames: readBoolean (
            value [ "wrapStateNames" ],
            DEFAULT_APPLICATION_PREFERENCES.wrapStateNames
        ),
    };
}


//--------------------------------------------------------------------------------------------------
// Function: loadApplicationPreferences
//
// Description:
//
//   Loads application preferences.
//
// Parameters:
//
//   - storage:
//     The storage supplied to the operation.
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

export function loadApplicationPreferences ( storage: Pick <Storage, "getItem"> ): PreferenceLoadResult
{
    // Run the operation that may report a recoverable failure.

    try
    {
        // Initialize the local values needed by this operation.

        const serializedPreferences = storage.getItem ( PREFERENCE_STORAGE_KEY );


        // Handle the case where serialized preferences matches an absent value.

        if ( serializedPreferences === null )
        {
            // Return the assembled result.

            return { preferences: DEFAULT_APPLICATION_PREFERENCES, warningCode: null };
        }

        const envelope: unknown = JSON.parse ( serializedPreferences );


        // Handle the case where the is record result condition is not satisfied.

        if ( !isRecord ( envelope ) )
        {
            // Return the assembled result.

            return { preferences: DEFAULT_APPLICATION_PREFERENCES, warningCode: "PREFERENCE_CORRUPT" };
        }


        // Handle the case where selected collection value differs from preference format version.

        if ( envelope [ "version" ] !== PREFERENCE_FORMAT_VERSION )
        {
            // Return the assembled result.

            return { preferences: DEFAULT_APPLICATION_PREFERENCES, warningCode: "PREFERENCE_VERSION_UNSUPPORTED" };
        }


        // Initialize the local values needed by this operation.

        const storedPreferences = envelope [ "preferences" ];
        const preferences       = parseApplicationPreferences ( storedPreferences );


        // Return the assembled result.

        return {
            preferences,
            warningCode: isRecord ( storedPreferences ) && !hasInvalidAllowlistedValue ( storedPreferences, preferences )
                ? null
                : "PREFERENCE_CORRUPT",
        };
    }
    catch
    {
        // Recover from the reported failure without hiding its outcome.

        return { preferences: DEFAULT_APPLICATION_PREFERENCES, warningCode: "PREFERENCE_CORRUPT" };
    }
}


//--------------------------------------------------------------------------------------------------
// Function: loadBrowserApplicationPreferences
//
// Description:
//
//   Loads browser application preferences.
//
// Parameters:
//
//   - storageProvider:
//     The storage provider supplied to the operation.
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

export function loadBrowserApplicationPreferences (
    storageProvider: () => Pick <Storage, "getItem"> = () => window.localStorage,
): PreferenceLoadResult
{
    // Run the operation that may report a recoverable failure.

    try
    {
        // Return the load application preferences result.

        return loadApplicationPreferences ( storageProvider () );
    }
    catch
    {
        // Recover from the reported failure without hiding its outcome.

        return { preferences: DEFAULT_APPLICATION_PREFERENCES, warningCode: "PREFERENCE_CORRUPT" };
    }
}


//--------------------------------------------------------------------------------------------------
// Function: saveApplicationPreferences
//
// Description:
//
//   Saves the application preferences.
//
// Parameters:
//
//   - storage:
//     The storage supplied to the operation.
//
//   - preferences:
//     The preferences supplied to the operation.
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

export function saveApplicationPreferences (
    storage: Pick <Storage, "setItem">,
    preferences: ApplicationPreferences
): boolean
{
    // Initialize the local values needed by this operation.

    const envelope: StoredPreferenceEnvelope =
    {
        preferences: parseApplicationPreferences ( preferences ),
        version: PREFERENCE_FORMAT_VERSION,
    };


    // Run the operation that may report a recoverable failure.

    try
    {
        storage.setItem ( PREFERENCE_STORAGE_KEY, JSON.stringify ( envelope ) );

        // Return the computed result.

        return true;
    }
    catch
    {
        // Recover from the reported failure without hiding its outcome.

        return false;
    }
}


//--------------------------------------------------------------------------------------------------
// Function: saveBrowserApplicationPreferences
//
// Description:
//
//   Saves the browser application preferences.
//
// Parameters:
//
//   - preferences:
//     The preferences supplied to the operation.
//
//   - storageProvider:
//     The storage provider supplied to the operation.
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

export function saveBrowserApplicationPreferences (
    preferences: ApplicationPreferences,
    storageProvider: () => Pick <Storage, "setItem"> = () => window.localStorage,
): boolean
{
    // Run the operation that may report a recoverable failure.

    try
    {
        // Return the save application preferences result.

        return saveApplicationPreferences ( storageProvider (), preferences );
    }
    catch
    {
        // Recover from the reported failure without hiding its outcome.

        return false;
    }
}
