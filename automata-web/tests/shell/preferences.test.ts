// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Application Preference Tests
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies versioning, corruption fallback, allowlisting, and bounded panel values.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from "vitest";

import { COMPILE_TIME_CONFIGURATION } from "../../src/configuration/compile-time-configuration.js";
import {
    DEFAULT_APPLICATION_PREFERENCES,
    PREFERENCE_FORMAT_VERSION,
    PREFERENCE_STORAGE_KEY,
    loadApplicationPreferences,
    loadBrowserApplicationPreferences,
    parseApplicationPreferences,
    saveApplicationPreferences,
    saveBrowserApplicationPreferences,
} from "../../src/infrastructure/preferences";

describe ( "AL-SEC-002 allowlisted application preferences", () =>
{
    it ( "falls back safely and reports malformed storage", () =>
    {
        // Initialize the local values needed by this operation.

        const result = loadApplicationPreferences ( { getItem: () => "{" } );

        expect ( result.preferences ).toEqual ( DEFAULT_APPLICATION_PREFERENCES );
        expect ( result.warningCode ).toBe ( "PREFERENCE_CORRUPT" );
    } );

    it ( "contains denial while acquiring the browser storage property", () =>
    {
        //------------------------------------------------------------------------------------------
        // Function: storageProvider
        //
        // Description:
        //
        //   Derives the storage provider.
        //
        // Parameters:
        //
        //   None.
        //
        // Returns:
        //
        //   The value produced by the operation.
        //
        // Preconditions:
        //
        //   - None.
        //
        // Postconditions:
        //
        //   - The returned value represents the result described above.
        //
        //------------------------------------------------------------------------------------------

        const storageProvider = (): Storage =>
        {
            throw new DOMException ( "Storage is unavailable.", "SecurityError" );
        };

        expect ( loadBrowserApplicationPreferences ( storageProvider ) ).toEqual ( {
            preferences: DEFAULT_APPLICATION_PREFERENCES,
            warningCode: "PREFERENCE_CORRUPT",
        } );
        expect ( saveBrowserApplicationPreferences ( DEFAULT_APPLICATION_PREFERENCES, storageProvider ) ).toBe ( false );
    } );

    it ( "rejects an unsupported preference envelope version", () =>
    {
        // Initialize the local values needed by this operation.

        const result = loadApplicationPreferences (
            { getItem: () => JSON.stringify ( { preferences: {}, version: 99 } ) }
        );

        expect ( result.preferences ).toEqual ( DEFAULT_APPLICATION_PREFERENCES );
        expect ( result.warningCode ).toBe ( "PREFERENCE_VERSION_UNSUPPORTED" );
    } );

    it ( "accepts only bounded content-independent values", () =>
    {
        // Initialize the local values needed by this operation.

        const preferences = parseApplicationPreferences (
            {
                consolePanelHeight: -100,
                masterPanelWidth: 100_000,
                model: { secret: "must not persist" },
                serverUrl: "  builtin://test  ",
                gridSize: 9,
                imageDpi: 4_000,
                maximumImageExportMegapixels: 1_001,
                minimumStateDistance: 0,
                theme: "Dark",
                transitionGravityPointDistance: 0,
            }
        );

        expect ( preferences.masterPanelWidth ).toBe ( DEFAULT_APPLICATION_PREFERENCES.masterPanelWidth );
        expect ( preferences.consolePanelHeight ).toBe ( DEFAULT_APPLICATION_PREFERENCES.consolePanelHeight );
        expect ( preferences.serverUrl ).toBe ( "builtin://test" );
        expect ( preferences.gridSize ).toBe ( DEFAULT_APPLICATION_PREFERENCES.gridSize );
        expect ( preferences.imageDpi ).toBe ( DEFAULT_APPLICATION_PREFERENCES.imageDpi );
        expect ( preferences.maximumImageExportMegapixels ).toBe (
            DEFAULT_APPLICATION_PREFERENCES.maximumImageExportMegapixels,
        );
        expect ( preferences.minimumStateDistance ).toBe (
            DEFAULT_APPLICATION_PREFERENCES.minimumStateDistance,
        );
        expect ( preferences.theme ).toBe ( "Dark" );
        expect ( preferences.transitionGravityPointDistance ).toBe (
            DEFAULT_APPLICATION_PREFERENCES.transitionGravityPointDistance,
        );
        expect ( preferences ).not.toHaveProperty ( "model" );
    } );

    it ( "falls back each invalid stored Chart preference independently and reports one warning", () =>
    {
        // Initialize the local values needed by this operation.

        const storedPreferences = {
            ...DEFAULT_APPLICATION_PREFERENCES,
            collapsedStateWidth: 0,
            expandedStateWidth: 512,
        };
        const result = loadApplicationPreferences ( { getItem: () => JSON.stringify ( {
            preferences: storedPreferences,
            version: PREFERENCE_FORMAT_VERSION,
        } ) } );

        expect ( result.preferences.collapsedStateWidth ).toBe (
            DEFAULT_APPLICATION_PREFERENCES.collapsedStateWidth,
        );
        expect ( result.preferences.expandedStateWidth ).toBe ( 512 );
        expect ( result.warningCode ).toBe ( "PREFERENCE_CORRUPT" );
    } );

    it ( "uses the documented Phase 6 defaults", () =>
    {
        expect ( DEFAULT_APPLICATION_PREFERENCES ).toMatchObject ( {
            collapsedStateHeight: 62,
            collapsedStateWidth: 268,
            deleteOrphanedChartItemsDuringAutomaticLayout: false,
            expandedStateMinimumHeight: 62,
            expandedStateWidth: 268,
            gridColor: "#1e1e1e",
            gridColorTheme: "Dark",
            gridSize: 100,
            gridStyle: "Solid",
            imageDpi: 300,
            minimumStateDistance: 500,
            imageFileFormat: "PNG",
            imageUnit: "Inches",
            maximumImageExportMegapixels: 1_000,
            printIncludeActions: true,
            printIncludeChart: true,
            printIncludeEvents: true,
            printIncludeModelSummary: true,
            printIncludeSimulator: true,
            printIncludeSolver: true,
            printIncludeStateChart: true,
            printIncludeStates: true,
            printIncludeTransitionTable: true,
            printMarginBottomMillimetres: 12.7,
            printMarginLeftMillimetres: 12.7,
            printMarginRightMillimetres: 12.7,
            printMarginTopMillimetres: 12.7,
            printOrientation: "Portrait",
            printPaperSize: "A4",
            printStyle: "Academic",
            saveBackup: false,
            showGrid: true,
            snapToGrid: true,
            transitionArrowHeadSize: 40,
            transitionGravityPointDistance: 100,
            transitionLabelAlignment: "Start",
            transparentBackground: false,
            wrapActionNames: true,
            wrapEventNames: true,
            wrapStateNames: true,
        } );
    } );

    it ( "derives all default preferences from the centralized compile-time configuration", () =>
    {
        expect ( DEFAULT_APPLICATION_PREFERENCES.gridSize ).toBe (
            COMPILE_TIME_CONFIGURATION.applicationSettings.chart.grid.gridSize,
        );
        expect ( DEFAULT_APPLICATION_PREFERENCES.minimumStateDistance ).toBe (
            COMPILE_TIME_CONFIGURATION.applicationSettings.chart.automaticLayoutAndRouting
                .minimumStateDistance,
        );
        expect ( DEFAULT_APPLICATION_PREFERENCES.transitionGravityPointDistance ).toBe (
            COMPILE_TIME_CONFIGURATION.applicationSettings.chart.automaticLayoutAndRouting
                .transitionGravityPointDistance,
        );
        expect ( DEFAULT_APPLICATION_PREFERENCES.transitionArrowHeadSize ).toBe (
            COMPILE_TIME_CONFIGURATION.applicationSettings.chart.automaticLayoutAndRouting
                .transitionArrowHeadSize,
        );
        expect ( DEFAULT_APPLICATION_PREFERENCES.theme ).toBe (
            COMPILE_TIME_CONFIGURATION.applicationSettings.appearance.theme,
        );
        expect ( DEFAULT_APPLICATION_PREFERENCES.serverUrl ).toBe (
            COMPILE_TIME_CONFIGURATION.applicationSettings.server.serverUrl,
        );
        expect ( DEFAULT_APPLICATION_PREFERENCES.printPaperSize ).toBe (
            COMPILE_TIME_CONFIGURATION.applicationSettings.printing.paperSize,
        );
        expect ( DEFAULT_APPLICATION_PREFERENCES.printMarginTopMillimetres ).toBe (
            COMPILE_TIME_CONFIGURATION.applicationSettings.printing.marginsMillimetres.top,
        );
        expect ( COMPILE_TIME_CONFIGURATION.debug ).toEqual ( {
            chartRoutingPerformanceCountersEnabled: true,
            gravityPointsColor:                   "red",
            gravityPointsRadius:                  3,
            gravityPointsVisible:                 false,
            transitionHiddenLinesColor:           "white",
            transitionHiddenLinesDashPattern:     "1 4",
            transitionHiddenLinesVisible:         false,
            transitionLineConnectorColor:         "blue",
            transitionLineConnectorRadius:        3,
            transitionLineConnectorsVisible:      false,
        } );
        expect ( COMPILE_TIME_CONFIGURATION.chart.transitionLines ).toEqual ( {
            arrowHeadStyle: "NarrowClosed",
        } );
        expect ( COMPILE_TIME_CONFIGURATION.chart.routing.routeClearance ).toBe ( 12 );
        expect ( COMPILE_TIME_CONFIGURATION.chart.routing.maximumCurveClearanceSearchCount ).toBe ( 6 );
        expect ( COMPILE_TIME_CONFIGURATION.chart.routing.labelPlacement.alignmentFractions ).toEqual ( {
            center: 0.5,
            end:    0.8,
            start:  0.2,
        } );
        expect ( COMPILE_TIME_CONFIGURATION.chart.routing.labelPlacement.candidateIntervalCount ).toBe ( 25 );
        expect ( COMPILE_TIME_CONFIGURATION.chart.routing.labelPlacement.curveSamplesPerSpan ).toBe ( 32 );
    } );

    it ( "accepts Minimum State Distance only from 100 through 2000", () =>
    {
        expect ( parseApplicationPreferences ( { minimumStateDistance: 100 } ).minimumStateDistance ).toBe ( 100 );
        expect ( parseApplicationPreferences ( { minimumStateDistance: 2_000 } ).minimumStateDistance ).toBe ( 2_000 );
        expect ( parseApplicationPreferences ( { minimumStateDistance: 99 } ).minimumStateDistance ).toBe (
            DEFAULT_APPLICATION_PREFERENCES.minimumStateDistance,
        );
        expect ( parseApplicationPreferences ( { minimumStateDistance: 2_001 } ).minimumStateDistance ).toBe (
            DEFAULT_APPLICATION_PREFERENCES.minimumStateDistance,
        );
    } );

    it ( "migrates every superseded Automatic Layout spacing preference to the current default", () =>
    {
        // Process each legacy key from the current value collection in order.

        for ( const legacyKey of [
            "stateSpacing",
            "horizontalStateSpacing",
            "verticalStateSpacing",
            "withinLayerStateSpacing",
            "betweenLayerStateSpacing",
        ] )
        {
            // Initialize the local values needed by this operation.

            const migrated = parseApplicationPreferences ( { [ legacyKey ]: 750 } );

            expect ( migrated.minimumStateDistance ).toBe (
                DEFAULT_APPLICATION_PREFERENCES.minimumStateDistance,
            );
            expect ( migrated ).not.toHaveProperty ( legacyKey );
        }
    } );

    it ( "prefers a stored Minimum State Distance over a superseded spacing preference", () =>
    {
        expect ( parseApplicationPreferences ( {
            minimumStateDistance: 640,
            withinLayerStateSpacing: 300,
        } ).minimumStateDistance ).toBe ( 640 );
    } );

    it ( "accepts Route Obstacle Offset only from 1 through 200", () =>
    {
        expect ( parseApplicationPreferences ( {
            transitionGravityPointDistance: 1,
        } ).transitionGravityPointDistance ).toBe ( 1 );
        expect ( parseApplicationPreferences ( {
            transitionGravityPointDistance: 200,
        } ).transitionGravityPointDistance ).toBe ( 200 );
        expect ( parseApplicationPreferences ( {
            transitionGravityPointDistance: 0,
        } ).transitionGravityPointDistance ).toBe (
            DEFAULT_APPLICATION_PREFERENCES.transitionGravityPointDistance,
        );
        expect ( parseApplicationPreferences ( {
            transitionGravityPointDistance: 201,
        } ).transitionGravityPointDistance ).toBe (
            DEFAULT_APPLICATION_PREFERENCES.transitionGravityPointDistance,
        );
    } );

    it ( "accepts Transition Arrowhead Size only from 8 through 160", () =>
    {
        expect ( parseApplicationPreferences ( { transitionArrowHeadSize: 8 } ).transitionArrowHeadSize ).toBe ( 8 );
        expect ( parseApplicationPreferences ( { transitionArrowHeadSize: 160 } ).transitionArrowHeadSize ).toBe ( 160 );
        expect ( parseApplicationPreferences ( { transitionArrowHeadSize: 7 } ).transitionArrowHeadSize ).toBe (
            DEFAULT_APPLICATION_PREFERENCES.transitionArrowHeadSize,
        );
        expect ( parseApplicationPreferences ( { transitionArrowHeadSize: 161 } ).transitionArrowHeadSize ).toBe (
            DEFAULT_APPLICATION_PREFERENCES.transitionArrowHeadSize,
        );
    } );

    it ( "accepts Maximum Megapixels only from 1 through 1000", () =>
    {
        expect ( parseApplicationPreferences ( {
            maximumImageExportMegapixels: 1,
        } ).maximumImageExportMegapixels ).toBe ( 1 );
        expect ( parseApplicationPreferences ( {
            maximumImageExportMegapixels: 1_000,
        } ).maximumImageExportMegapixels ).toBe ( 1_000 );
        expect ( parseApplicationPreferences ( {
            maximumImageExportMegapixels: 0,
        } ).maximumImageExportMegapixels ).toBe (
            DEFAULT_APPLICATION_PREFERENCES.maximumImageExportMegapixels,
        );
        expect ( parseApplicationPreferences ( {
            maximumImageExportMegapixels: 1_001,
        } ).maximumImageExportMegapixels ).toBe (
            DEFAULT_APPLICATION_PREFERENCES.maximumImageExportMegapixels,
        );
    } );

    it ( "allowlists Page Setup enums, style, section choices, and margins from 0 through 50 millimetres", () =>
    {
        expect ( parseApplicationPreferences ( {
            printIncludeChart: false,
            printIncludeStateChart: false,
            printMarginBottomMillimetres: 0,
            printMarginLeftMillimetres: 50,
            printOrientation: "Landscape",
            printPaperSize: "Legal",
            printStyle: "Industry",
        } ) ).toMatchObject ( {
            printIncludeChart: false,
            printIncludeStateChart: false,
            printMarginBottomMillimetres: 0,
            printMarginLeftMillimetres: 50,
            printOrientation: "Landscape",
            printPaperSize: "Legal",
            printStyle: "Industry",
        } );
        expect ( parseApplicationPreferences ( { printPaperSize: "A3" } ).printPaperSize ).toBe ( "A4" );
        expect ( parseApplicationPreferences ( { printStyle: "Publishing" } ).printStyle ).toBe ( "Academic" );
        expect ( parseApplicationPreferences ( { printOrientation: "Reverse" } ).printOrientation )
            .toBe ( "Portrait" );
        expect ( parseApplicationPreferences ( { printMarginTopMillimetres: -0.1 } )
            .printMarginTopMillimetres ).toBe ( 12.7 );
        expect ( parseApplicationPreferences ( { printMarginRightMillimetres: 50.1 } )
            .printMarginRightMillimetres ).toBe ( 12.7 );
    } );
    it ( "serializes only the versioned typed preference surface", () =>
    {
        // Initialize the local values needed by this operation.

        let storedKey   = "";
        let storedValue = "";

        saveApplicationPreferences (
            {
                setItem: ( key: string, value: string ) =>
                {
                    storedKey   = key;
                    storedValue = value;
                },
            },
            DEFAULT_APPLICATION_PREFERENCES
        );

        const envelope = JSON.parse ( storedValue ) as { preferences: object; version: number };

        expect ( storedKey ).toBe ( PREFERENCE_STORAGE_KEY );
        expect ( envelope.version ).toBe ( PREFERENCE_FORMAT_VERSION );
        expect ( Object.keys ( envelope.preferences ).sort () ).toEqual (
            [
                "collapsedStateHeight",
                "collapsedStateWidth",
                "consolePanelHeight",
                "consoleVisible",
                "deleteOrphanedChartItemsDuringAutomaticLayout",
                "expandedStateMinimumHeight",
                "expandedStateWidth",
                "followConsoleTail",
                "gridColor",
                "gridColorTheme",
                "gridSize",
                "gridStyle",
                "imageDpi",
                "imageFileFormat",
                "imageUnit",
                "masterPanelVisible",
                "masterPanelWidth",
                "maximumImageExportMegapixels",
                "minimumStateDistance",
                "printIncludeActions",
                "printIncludeChart",
                "printIncludeEvents",
                "printIncludeModelSummary",
                "printIncludeSimulator",
                "printIncludeSolver",
                "printIncludeStateChart",
                "printIncludeStates",
                "printIncludeTransitionTable",
                "printMarginBottomMillimetres",
                "printMarginLeftMillimetres",
                "printMarginRightMillimetres",
                "printMarginTopMillimetres",
                "printOrientation",
                "printPaperSize",
                "printStyle",
                "saveBackup",
                "selfTransitionLoopAspect",
                "selfTransitionLoopExtension",
                "selfTransitionLoopSpacing",
                "serverUrl",
                "showGrid",
                "snapToGrid",
                "theme",
                "transitionArrowHeadSize",
                "transitionGravityPointDistance",
                "transitionLabelAlignment",
                "transparentBackground",
                "wrapActionNames",
                "wrapEventNames",
                "wrapStateNames",
            ]
        );
    } );

    it ( "contains a denied durable-storage write without changing the active preferences", () =>
    {
        // Initialize the local values needed by this operation.

        const saved = saveApplicationPreferences (
            {
                setItem: () =>
                {
                    throw new DOMException ( "Storage is unavailable.", "SecurityError" );
                },
            },
            DEFAULT_APPLICATION_PREFERENCES,
        );

        expect ( saved ).toBe ( false );
        expect ( DEFAULT_APPLICATION_PREFERENCES.theme ).toBe ( "Dark" );
    } );
} );
