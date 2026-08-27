// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Compile-Time Configuration
// Version: 1.0.0
// Date:    2026-08-14
// Author:  Rohin Gosling
//
// Description:
//
//   Centralizes developer-tunable application defaults, preference bounds, persistence metadata,
//   shell defaults, and diagnostic visualization switches. Values in this module are compiled into
//   the application and are not document data. Persisted user preferences override the Application
//   Settings defaults at runtime.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { ConsoleFilterState } from "../application/contracts.js";
import type { ApplicationPreferences } from "../application/ports/contracts.js";

declare const __AUTOMATA_CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED__: boolean;

export const CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED =
    typeof __AUTOMATA_CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED__ === "boolean" &&
    __AUTOMATA_CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED__;


//--------------------------------------------------------------------------------------------------
// Type: TransitionArrowHeadStyle
//
// Description:
//
//   Defines the supported transition arrow head style alternatives.
//
//--------------------------------------------------------------------------------------------------

export type TransitionArrowHeadStyle = "Closed" | "NarrowClosed" | "NarrowOpen" | "Open";


//--------------------------------------------------------------------------------------------------
// Interface: TransitionLineConfiguration
//
// Description:
//
//   Defines the structure of transition line configuration.
//
//--------------------------------------------------------------------------------------------------

interface TransitionLineConfiguration
{
    readonly arrowHeadStyle: TransitionArrowHeadStyle;
}

const TRANSITION_LINE_CONFIGURATION: TransitionLineConfiguration =
{
    arrowHeadStyle: "NarrowClosed",
};

export const CHART_ROUTING_OBSTACLE_OFFSET_CONSTRAINTS = { maximum: 200, minimum: 1 } as const;

export const CHART_ROUTING_CONFIGURATION =
{
    maximumCurveClearanceSearchCount: 6,
    routeClearance:                   12,
    selfTransitionLoop:
    {
        mouthLimit:   0.55,
        spansPerLoop: 12,
    },
    cubicDetourClearance:
    {
        clearanceProofMargin:           0.25,
        clearanceRefinementCount:       16,
        coordinateEpsilon:              0.000001,
        maximumClearanceExpansionCount: 16,
        maximumClearanceProofNodeCount: 8_192,
        maximumSubdivisionDepth:        14,
    },
    labelPlacement:
    {
        alignmentFractions:
        {
            center: 0.5,
            end:    0.8,
            start:  0.2,
        },
        candidateIntervalCount: 25,
        curveSamplesPerSpan:    32,
    },
} as const;

export const COMPILE_TIME_CONFIGURATION =
{
    applicationSettings:
    {
        appearance:
        {
            theme: "Dark",
        },
        chart:
        {
            automaticLayoutAndRouting:
            {
                deleteOrphanedChartItemsDuringAutomaticLayout: false,
                minimumStateDistance:                          500,
                selfTransitionLoopAspect:                      35,
                selfTransitionLoopExtension:                   30,
                selfTransitionLoopSpacing:                     24,
                transitionArrowHeadSize:                       40,
                transitionGravityPointDistance:                100,
                transitionLabelAlignment:                      "Start",
            },
            format:
            {
                wrapActionNames: true,
                wrapEventNames:  true,
                wrapStateNames:  true,
            },
            grid:
            {
                gridColor:      "#1e1e1e",
                gridColorTheme: "Dark",
                gridSize:       100,
                gridStyle:      "Solid",
                showGrid:   true,
                snapToGrid: true,
            },
            imageExport:
            {
                imageDpi:                     300,
                imageFileFormat:              "PNG",
                transparentBackground:        false,
                imageUnit:                    "Inches",
                maximumImageExportMegapixels: 1_000,
            },
            stateSize:
            {
                collapsedStateHeight:       62,
                collapsedStateWidth:        268,
                expandedStateMinimumHeight: 62,
                expandedStateWidth:         268,
            },
        },
        console:
        {
            followConsoleTail: true,
        },
        general:
        {
            saveBackup: false,
        },
        printing:
        {
            stateChartImage:
            {
                dotsPerInch:       300,
                maximumMegapixels: 16,
            },
            includedSections:
            {
                actions:         true,
                chart:           true,
                events:          true,
                modelSummary:    true,
                simulator:       true,
                solver:          true,
                stateChart:      true,
                states:          true,
                transitionTable: true,
            },
            marginsMillimetres:
            {
                bottom: 12.7,
                left:   12.7,
                right:  12.7,
                top:    12.7,
            },
            orientation: "Portrait",
            paperSize:   "A4",
            style:       "Academic",
        },
        server:
        {
            serverUrl: "builtin://server",
        },
        workspace:
        {
            consolePanelHeight: 196,
            consoleVisible:     true,
            masterPanelVisible: true,
            masterPanelWidth:   252,
        },
    },
    applicationSettingConstraints:
    {
        chart:
        {
            gridSize:                     { maximum: 200, minimum: 10 },
            imageDpi:                     { maximum: 1_200, minimum: 72 },
            maximumImageExportMegapixels: { maximum: 1_000, minimum: 1 },
            minimumStateDistance:         { maximum: 2_000, minimum: 100 },
            stateDimension:               { maximum: 4_096, minimum: 1 },
            selfTransitionLoopAspect:       { maximum: 100, minimum: 5 },
            selfTransitionLoopExtension:    { maximum: 400, minimum: 1 },
            selfTransitionLoopSpacing:      { maximum: 200, minimum: 1 },
            transitionArrowHeadSize:        { maximum: 160, minimum: 8 },
            transitionGravityPointDistance: CHART_ROUTING_OBSTACLE_OFFSET_CONSTRAINTS,
        },
        server:
        {
            maximumUrlLength: 2_048,
        },
        printing:
        {
            marginMillimetres: { maximum: 50, minimum: 0 },
        },
        workspace:
        {
            maximumStoredPanelSize:   10_000,
            minimumConsolePanelHeight: 122,
            minimumMasterPanelWidth:   190,
        },
    },
    chart:
    {
        // Automatic Layout seeds ELK Layered with these fixed edge-to-edge gaps and then scales the
        // returned centres until every pair clears the Minimum State Distance. The seeds are
        // deliberately small: once the result is scaled, a wide seed only widens the chart without
        // improving the guarantee. A measured sweep over the reference model found a minimal
        // within-layer seed paired with a moderate between-layer seed produced the most compact
        // chart satisfying the same distance.

        automaticLayout:
        {
            elkBetweenLayerSeedSpacing: 200,
            elkWithinLayerSeedSpacing:  40,
        },
        viewport:
        {
            minimumZoom: 0.1,
        },
        routing: CHART_ROUTING_CONFIGURATION,
        transitionLines: TRANSITION_LINE_CONFIGURATION,
    },
    debug:
    {
        chartRoutingPerformanceCountersEnabled: CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED,
        gravityPointsColor:                   "red",
        gravityPointsRadius:                  3,
        gravityPointsVisible:                 false,
        transitionHiddenLinesColor:           "white",
        transitionHiddenLinesDashPattern:     "1 4",
        transitionHiddenLinesVisible:         false,
        transitionLineConnectorColor:         "blue",
        transitionLineConnectorRadius:        3,
        transitionLineConnectorsVisible:      false,
    },
    dialog:
    {
        formLayout:
        {
            labelColumnMarginFactor: 1.1,
        },
    },
    persistence:
    {
        applicationPreferencesFormatVersion: 1,
        applicationPreferencesStorageKey:    "automata-lab.preferences.v1",
    },
    server:
    {
        gateway:
        {
            requestTimeoutMilliseconds: 5_000,
        },
    },
    shell:
    {
        defaultConsoleFilters:
        {
            error:   true,
            message: true,
            warning: true,
        },
        minimumDetailPaneButtonWidth: 784,
        progressiveRendering:
        {
            batchSize:        100,
            initialItemCount: 100,
        },
    },
} as const;


//--------------------------------------------------------------------------------------------------
// Function: createDefaultApplicationPreferences
//
// Description:
//
//   Creates default application preferences.
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
//--------------------------------------------------------------------------------------------------

function createDefaultApplicationPreferences (): ApplicationPreferences
{
    // Initialize the local values needed by this operation.

    const applicationSettings = COMPILE_TIME_CONFIGURATION.applicationSettings;


    // Return the assembled result.

    return {
        collapsedStateHeight: applicationSettings.chart.stateSize.collapsedStateHeight,
        collapsedStateWidth:  applicationSettings.chart.stateSize.collapsedStateWidth,
        consolePanelHeight:   applicationSettings.workspace.consolePanelHeight,
        consoleVisible:       applicationSettings.workspace.consoleVisible,
        deleteOrphanedChartItemsDuringAutomaticLayout:
            applicationSettings.chart.automaticLayoutAndRouting.deleteOrphanedChartItemsDuringAutomaticLayout,
        expandedStateMinimumHeight: applicationSettings.chart.stateSize.expandedStateMinimumHeight,
        expandedStateWidth:         applicationSettings.chart.stateSize.expandedStateWidth,
        followConsoleTail:           applicationSettings.console.followConsoleTail,
        gridColor:                   applicationSettings.chart.grid.gridColor,
        gridColorTheme:              applicationSettings.chart.grid.gridColorTheme,
        gridSize:                    applicationSettings.chart.grid.gridSize,
        gridStyle:                   applicationSettings.chart.grid.gridStyle,
        imageDpi:                    applicationSettings.chart.imageExport.imageDpi,
        imageFileFormat:             applicationSettings.chart.imageExport.imageFileFormat,
        imageUnit:                   applicationSettings.chart.imageExport.imageUnit,
        maximumImageExportMegapixels: applicationSettings.chart.imageExport.maximumImageExportMegapixels,
        transparentBackground:       applicationSettings.chart.imageExport.transparentBackground,
        masterPanelVisible:          applicationSettings.workspace.masterPanelVisible,
        masterPanelWidth:            applicationSettings.workspace.masterPanelWidth,
        minimumStateDistance:
            applicationSettings.chart.automaticLayoutAndRouting.minimumStateDistance,
        printIncludeActions:         applicationSettings.printing.includedSections.actions,
        printIncludeChart:           applicationSettings.printing.includedSections.chart,
        printIncludeEvents:          applicationSettings.printing.includedSections.events,
        printIncludeModelSummary:    applicationSettings.printing.includedSections.modelSummary,
        printIncludeSimulator:       applicationSettings.printing.includedSections.simulator,
        printIncludeSolver:          applicationSettings.printing.includedSections.solver,
        printIncludeStateChart:      applicationSettings.printing.includedSections.stateChart,
        printIncludeStates:          applicationSettings.printing.includedSections.states,
        printIncludeTransitionTable: applicationSettings.printing.includedSections.transitionTable,
        printMarginBottomMillimetres: applicationSettings.printing.marginsMillimetres.bottom,
        printMarginLeftMillimetres:   applicationSettings.printing.marginsMillimetres.left,
        printMarginRightMillimetres:  applicationSettings.printing.marginsMillimetres.right,
        printMarginTopMillimetres:    applicationSettings.printing.marginsMillimetres.top,
        printOrientation:             applicationSettings.printing.orientation,
        printPaperSize:               applicationSettings.printing.paperSize,
        printStyle:                   applicationSettings.printing.style,
        saveBackup:                  applicationSettings.general.saveBackup,
        selfTransitionLoopAspect:    applicationSettings.chart.automaticLayoutAndRouting.selfTransitionLoopAspect,
        selfTransitionLoopExtension: applicationSettings.chart.automaticLayoutAndRouting.selfTransitionLoopExtension,
        selfTransitionLoopSpacing:   applicationSettings.chart.automaticLayoutAndRouting.selfTransitionLoopSpacing,
        serverUrl:                   applicationSettings.server.serverUrl,
        showGrid:                    applicationSettings.chart.grid.showGrid,
        snapToGrid:                  applicationSettings.chart.grid.snapToGrid,
        theme:                       applicationSettings.appearance.theme,
        transitionArrowHeadSize:
            applicationSettings.chart.automaticLayoutAndRouting.transitionArrowHeadSize,
        transitionGravityPointDistance:
            applicationSettings.chart.automaticLayoutAndRouting.transitionGravityPointDistance,
        transitionLabelAlignment:
            applicationSettings.chart.automaticLayoutAndRouting.transitionLabelAlignment,
        wrapActionNames: applicationSettings.chart.format.wrapActionNames,
        wrapEventNames:  applicationSettings.chart.format.wrapEventNames,
        wrapStateNames:  applicationSettings.chart.format.wrapStateNames,
    };
}


//--------------------------------------------------------------------------------------------------
// Function: createDefaultConsoleFilters
//
// Description:
//
//   Creates default console filters.
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
//--------------------------------------------------------------------------------------------------

function createDefaultConsoleFilters (): ConsoleFilterState
{
    // Return the assembled result.

    return { ...COMPILE_TIME_CONFIGURATION.shell.defaultConsoleFilters };
}

export const DEFAULT_APPLICATION_PREFERENCES: ApplicationPreferences =
    /* @__PURE__ */ createDefaultApplicationPreferences ();

export const DEFAULT_CONSOLE_FILTERS: ConsoleFilterState =
    /* @__PURE__ */ createDefaultConsoleFilters ();
