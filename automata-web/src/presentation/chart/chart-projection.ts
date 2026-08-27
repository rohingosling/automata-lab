// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Authoring Chart Projection
// Version: 1.0.0
// Date:    2026-08-11
// Author:  Rohin Gosling
//
// Description:
//
//   Derives deterministic read/write Chart view models from the authoring draft without owning
//   semantic state.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type
{
    AuthoringDraft,
    ChartPoint,
    ChartStatePlacement,
    TerminalStateIndicator,
} from "../../domain/model/contracts.js";
import type { DomainDiagnostic } from "../../domain/model/diagnostics.js";
import
{
    DEFAULT_CHART_STATE_HEIGHT,
    DEFAULT_CHART_STATE_WIDTH,
} from "../../domain/model/limits.js";
import { wrapChartName } from "./chart-name-wrapping.js";

export const CHART_STATE_WIDTH               = DEFAULT_CHART_STATE_WIDTH;
export const CHART_COLLAPSED_STATE_HEIGHT    = DEFAULT_CHART_STATE_HEIGHT;
export const CHART_INDICATOR_SIZE            = 80;
export const CHART_HORIZONTAL_STATE_GAP      = 96;
export const CHART_VERTICAL_STATE_GAP        = 120;
export const CHART_FALLBACK_ORIGIN_X         = 120;
export const CHART_FALLBACK_ORIGIN_Y         = 90;

//--------------------------------------------------------------------------------------------------
// Interface: ChartNameWrapping
//
// Description:
//
//   Defines the structure of chart name wrapping.
//
//--------------------------------------------------------------------------------------------------

export interface ChartNameWrapping
{
    readonly actionNames: boolean;
    readonly eventNames:  boolean;
    readonly stateNames:  boolean;
}

//--------------------------------------------------------------------------------------------------
// Interface: ChartStateSizePreferences
//
// Description:
//
//   Defines the structure of chart state size preferences.
//
//--------------------------------------------------------------------------------------------------

export interface ChartStateSizePreferences
{
    readonly collapsedStateHeight:       number;
    readonly collapsedStateWidth:        number;
    readonly expandedStateMinimumHeight: number;
    readonly expandedStateWidth:         number;
    readonly gridSize:                   number;
}

//--------------------------------------------------------------------------------------------------
// Interface: AuthoringChartStateViewModel
//
// Description:
//
//   Defines the structure of authoring chart state view model.
//
//--------------------------------------------------------------------------------------------------

export interface AuthoringChartStateViewModel
{
    readonly description:       string;
    readonly entryActionLines:  readonly ( readonly string[] )[];
    readonly expanded:          boolean;
    readonly exitActionLines:   readonly ( readonly string[] )[];
    readonly height:            number;
    readonly isInitial:         boolean;
    readonly isPersisted:       boolean;
    readonly minimumHeight:     number;
    readonly name:              string;
    readonly nameLines:         readonly string[];
    readonly savedHeight:       number;
    readonly validationStatus:  "error" | "passed" | "warning";
    readonly width:             number;
    readonly x:                 number;
    readonly y:                 number;
}

//--------------------------------------------------------------------------------------------------
// Interface: AuthoringChartIndicatorViewModel
//
// Description:
//
//   Defines the structure of authoring chart indicator view model.
//
//--------------------------------------------------------------------------------------------------

export interface AuthoringChartIndicatorViewModel
{
    readonly id: number | null;
    readonly x:  number;
    readonly y:  number;
}

//--------------------------------------------------------------------------------------------------
// Interface: AuthoringChartProjectionViewModel
//
// Description:
//
//   Defines the structure of authoring chart projection view model.
//
//--------------------------------------------------------------------------------------------------

export interface AuthoringChartProjectionViewModel
{
    readonly initialIndicator:   AuthoringChartIndicatorViewModel | null;
    readonly states:             readonly AuthoringChartStateViewModel[];
    readonly terminalIndicators: readonly AuthoringChartIndicatorViewModel[];
}

//--------------------------------------------------------------------------------------------------
// Function: stateHeight
//
// Description:
//
//   Derives the state height.
//
// Parameters:
//
//   - nameLines:
//     The name lines supplied to the operation.
//
//   - entryActionLines:
//     The entry action lines supplied to the operation.
//
//   - exitActionLines:
//     The exit action lines supplied to the operation.
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

function stateHeight (
    nameLines: readonly string[],
    entryActionLines: readonly ( readonly string[] )[],
    exitActionLines: readonly ( readonly string[] )[],
): number
{
    // Initialize the local values needed by this operation.

    const headerHeight = Math.max ( 33, 28 + nameLines.length * 17 );

    const entryLineCount = Math.max ( 1, entryActionLines.reduce ( ( count, lines ) => count + lines.length, 0 ) );
    const exitLineCount  = Math.max ( 1, exitActionLines.reduce ( ( count, lines ) => count + lines.length, 0 ) );

    // Return the computed result.

    return headerHeight + 70 + ( entryLineCount + exitLineCount ) * 17;
}

//--------------------------------------------------------------------------------------------------
// Function: nearestGridValue
//
// Description:
//
//   Derives the nearest grid value.
//
// Parameters:
//
//   - value:
//     The value supplied to the operation.
//
//   - gridSize:
//     The grid size supplied to the operation.
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

function nearestGridValue ( value: number, gridSize: number ): number
{
    // Return the max result.

    return Math.max ( gridSize, Math.round ( value / gridSize ) * gridSize );
}

//--------------------------------------------------------------------------------------------------
// Function: upwardGridValue
//
// Description:
//
//   Derives the upward grid value.
//
// Parameters:
//
//   - value:
//     The value supplied to the operation.
//
//   - gridSize:
//     The grid size supplied to the operation.
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

function upwardGridValue ( value: number, gridSize: number ): number
{
    // Return the max result.

    return Math.max ( 1, Math.ceil ( value / gridSize ) * gridSize );
}

//--------------------------------------------------------------------------------------------------
// Function: calculateStateLayers
//
// Description:
//
//   Calculates state layers.
//
// Parameters:
//
//   - draft:
//     The draft supplied to the operation.
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

function calculateStateLayers ( draft: AuthoringDraft ): ReadonlyMap<string, number>
{
    // Initialize the local values needed by this operation.

    const stateNames   = draft.stateMachine.states.map ( state => state.name );
    const layerByState = new Map<string, number> ();
    const initialState = draft.stateMachine.initialState ?? stateNames [ 0 ];

    // Handle the case where initial state differs from undefined.

    if ( initialState !== undefined )
    {
        layerByState.set ( initialState, 0 );
    }

    const queue = initialState === undefined ? [] : [ initialState ];

    // Continue the operation while its terminating condition has not been reached.

    while ( queue.length > 0 )
    {
        // Initialize the local values needed by this operation.

        const sourceState = queue.shift ();

        // Handle the case where source state matches undefined.

        if ( sourceState === undefined )
        {
            continue;
        }

        const sourceLayer = layerByState.get ( sourceState ) ?? 0;

        // Process each transition from the transition table collection in order.

        for ( const transition of draft.stateMachine.transitionTable )
        {
            // Handle the case where all required conditions are satisfied.

            if ( transition.state === sourceState && !layerByState.has ( transition.stateNext ) )
            {
                layerByState.set ( transition.stateNext, sourceLayer + 1 );
                queue.push ( transition.stateNext );
            }
        }
    }

    // Calculate the disconnected layer value from the current inputs.

    const disconnectedLayer = Math.max ( -1, ...layerByState.values () ) + 1;

    // Process each state name from the state names collection in order.

    for ( const stateName of stateNames )
    {
        // Handle the case where the has result condition is not satisfied.

        if ( !layerByState.has ( stateName ) )
        {
            layerByState.set ( stateName, disconnectedLayer );
        }
    }

    // Return the layer by state.

    return layerByState;
}

//--------------------------------------------------------------------------------------------------
// Function: fallbackPositions
//
// Description:
//
//   Derives the fallback positions.
//
// Parameters:
//
//   - draft:
//     The draft supplied to the operation.
//
//   - stateHeights:
//     The state heights supplied to the operation.
//
//   - stateWidths:
//     The state widths supplied to the operation.
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

function fallbackPositions (
    draft: AuthoringDraft,
    stateHeights: ReadonlyMap<string, number>,
    stateWidths: ReadonlyMap<string, number>,
): ReadonlyMap<string, ChartPoint>
{
    // Initialize the local values needed by this operation.

    const layerByState  = calculateStateLayers ( draft );
    const statesByLayer = new Map<number, string[]> ();

    // Process each state from the states collection in order.

    for ( const state of draft.stateMachine.states )
    {
        // Initialize the local values needed by this operation.

        const layer       = layerByState.get ( state.name ) ?? 0;
        const layerStates = statesByLayer.get ( layer ) ?? [];

        layerStates.push ( state.name );
        statesByLayer.set ( layer, layerStates );
    }

    // Initialize the local values needed by this operation.

    const layerNumbers      = [ ...statesByLayer.keys () ].sort ( ( left, right ) => left - right );
    const maximumLayerWidth = Math.max (
        CHART_STATE_WIDTH,
        ...layerNumbers.map ( layer =>
        {
            // Initialize the local values needed by this operation.

            const count = statesByLayer.get ( layer )?.length ?? 0;

            // Return the computed result.

            return ( statesByLayer.get ( layer ) ?? [] ).reduce (
                ( width, stateName ) => width + ( stateWidths.get ( stateName ) ?? CHART_STATE_WIDTH ),
                0,
            ) + Math.max ( 0, count - 1 ) * CHART_HORIZONTAL_STATE_GAP;
        } ),
    );
    const positionByState = new Map<string, ChartPoint> ();
    let layerTop          = CHART_FALLBACK_ORIGIN_Y;

    // Process each layer from the layer numbers collection in order.

    for ( const layer of layerNumbers )
    {
        // Initialize the local values needed by this operation.

        const stateNames = statesByLayer.get ( layer ) ?? [];
        const layerWidth = stateNames.reduce (
            ( width, stateName ) => width + ( stateWidths.get ( stateName ) ?? CHART_STATE_WIDTH ),
            0,
        ) +
            Math.max ( 0, stateNames.length - 1 ) * CHART_HORIZONTAL_STATE_GAP;
        const layerLeft          = CHART_FALLBACK_ORIGIN_X + ( maximumLayerWidth - layerWidth ) / 2;
        const maximumLayerHeight = Math.max ( CHART_COLLAPSED_STATE_HEIGHT,
            ...stateNames.map ( stateName => stateHeights.get ( stateName ) ?? CHART_COLLAPSED_STATE_HEIGHT ) );

        let stateLeft = layerLeft;

        stateNames.forEach ( ( stateName ) =>
        {
            positionByState.set ( stateName, {
                x: stateLeft,
                y: layerTop,
            } );
            stateLeft += ( stateWidths.get ( stateName ) ?? CHART_STATE_WIDTH ) + CHART_HORIZONTAL_STATE_GAP;
        } );
        layerTop += maximumLayerHeight + CHART_VERTICAL_STATE_GAP;
    }

    // Return the position by state.

    return positionByState;
}

//--------------------------------------------------------------------------------------------------
// Function: flowPositionFromStoredStatePlacement
//
// Description:
//
//   Derives the flow position from stored state placement.
//
// Parameters:
//
//   - placement:
//     The placement supplied to the operation.
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

export function flowPositionFromStoredStatePlacement (
    placement: ChartStatePlacement,
): ChartPoint
{
    // Return the assembled result.

    return { x: placement.x, y: placement.y };
}

//--------------------------------------------------------------------------------------------------
// Function: storedStatePlacementFromFlowPosition
//
// Description:
//
//   Derives the stored state placement from flow position.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
//
//   - point:
//     The point supplied to the operation.
//
//   - height:
//     The height supplied to the operation.
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

export function storedStatePlacementFromFlowPosition (
    state: string,
    point: ChartPoint,
    height: number,
): ChartStatePlacement
{
    // Return the assembled result.

    return { state, x: point.x, y: point.y, height };
}

//--------------------------------------------------------------------------------------------------
// Function: flowPositionFromStoredIndicator
//
// Description:
//
//   Derives the flow position from stored indicator.
//
// Parameters:
//
//   - point:
//     The point supplied to the operation.
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

export function flowPositionFromStoredIndicator ( point: ChartPoint ): ChartPoint
{
    // Return the assembled result.

    return { x: point.x - CHART_INDICATOR_SIZE / 2, y: point.y - CHART_INDICATOR_SIZE / 2 };
}

//--------------------------------------------------------------------------------------------------
// Function: storedIndicatorFromFlowPosition
//
// Description:
//
//   Derives the stored indicator from flow position.
//
// Parameters:
//
//   - point:
//     The point supplied to the operation.
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

export function storedIndicatorFromFlowPosition ( point: ChartPoint ): ChartPoint
{
    // Return the assembled result.

    return { x: point.x + CHART_INDICATOR_SIZE / 2, y: point.y + CHART_INDICATOR_SIZE / 2 };
}

//--------------------------------------------------------------------------------------------------
// Function: storedTerminalIndicatorFromFlowPosition
//
// Description:
//
//   Derives the stored terminal indicator from flow position.
//
// Parameters:
//
//   - id:
//     The identifier supplied to the operation.
//
//   - point:
//     The point supplied to the operation.
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

export function storedTerminalIndicatorFromFlowPosition (
    id: number,
    point: ChartPoint,
): TerminalStateIndicator
{
    // Return the assembled result.

    return { id, ...storedIndicatorFromFlowPosition ( point ) };
}

//--------------------------------------------------------------------------------------------------
// Function: createAuthoringChartProjection
//
// Description:
//
//   Creates authoring chart projection.
//
// Parameters:
//
//   - draft:
//     The draft supplied to the operation.
//
//   - diagnostics:
//     The diagnostics supplied to the operation.
//
//   - nameWrapping:
//     The name wrapping supplied to the operation.
//
//   - stateSize:
//     The state size supplied to the operation.
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

export function createAuthoringChartProjection (
    draft: AuthoringDraft,
    diagnostics: readonly DomainDiagnostic[],
    nameWrapping: ChartNameWrapping,
    stateSize: ChartStateSizePreferences = {
        collapsedStateHeight:       CHART_COLLAPSED_STATE_HEIGHT,
        collapsedStateWidth:        CHART_STATE_WIDTH,
        expandedStateMinimumHeight: CHART_COLLAPSED_STATE_HEIGHT,
        expandedStateWidth:         CHART_STATE_WIDTH,
        gridSize:                   1,
    },
): AuthoringChartProjectionViewModel
{
    // Initialize the local values needed by this operation.

    const gridSize                        = Math.max ( 1, stateSize.gridSize );
    const collapsedHeight                 = nearestGridValue ( stateSize.collapsedStateHeight, gridSize );
    const collapsedWidth                  = nearestGridValue ( stateSize.collapsedStateWidth, gridSize );
    const expandedWidth                   = nearestGridValue ( stateSize.expandedStateWidth, gridSize );
    const effectiveWidth                  = draft.chart.settings.expandStates ? expandedWidth : collapsedWidth;
    const contentCharacterLimit           = Math.max ( 1, Math.floor ( ( effectiveWidth - 40 ) / 7 ) );
    const configuredExpandedMinimumHeight = upwardGridValue (
        stateSize.expandedStateMinimumHeight,
        gridSize,
    );
    const placementByState  = new Map ( draft.chart.states.map ( placement => [ placement.state, placement ] ) );
    const stateHeightByName = new Map<string, number> ();
    const stateWidthByName  = new Map<string, number> ();
    const contentByState    = new Map ( draft.stateMachine.states.map ( state =>
    {
        // Initialize the local values needed by this operation.

        const nameLines        = wrapChartName ( state.name, nameWrapping.stateNames, contentCharacterLimit );
        const entryActionLines = draft.stateMachine.stateActions.entry.flatMap ( mapping =>
            mapping.state === state.name
                ? [ wrapChartName ( mapping.action, nameWrapping.actionNames, contentCharacterLimit ) ]
                : [] );
        const exitActionLines = draft.stateMachine.stateActions.exit.flatMap ( mapping =>
            mapping.state === state.name
                ? [ wrapChartName ( mapping.action, nameWrapping.actionNames, contentCharacterLimit ) ]
                : [] );
        const placement             = placementByState.get ( state.name );
        const measuredContentHeight = stateHeight (
            nameLines,
            entryActionLines,
            exitActionLines,
        );
        const minimumHeight = Math.max (
            configuredExpandedMinimumHeight,
            upwardGridValue ( measuredContentHeight, gridSize ),
        );
        const savedHeight = placement?.height ?? stateSize.expandedStateMinimumHeight;
        const height      = draft.chart.settings.expandStates
            ? Math.max ( minimumHeight, savedHeight )
            : collapsedHeight;
        const width = draft.chart.settings.expandStates ? expandedWidth : collapsedWidth;

        stateHeightByName.set ( state.name, height );
        stateWidthByName.set ( state.name, width );

        // Return the computed result.

        return [ state.name,
            { entryActionLines, exitActionLines, height, minimumHeight, nameLines, savedHeight, width } ] as const;
    } ) );
    const fallbackByState = fallbackPositions ( draft, stateHeightByName, stateWidthByName );

    // Return the assembled result.

    return {
        initialIndicator: draft.chart.indicators.initialStateIndicator === null
            ? null
            : { id: null, ...flowPositionFromStoredIndicator ( draft.chart.indicators.initialStateIndicator ) },
        states: draft.stateMachine.states.map ( ( state, stateIndex ) =>
        {
            // Initialize the local values needed by this operation.

            const content   = contentByState.get ( state.name );
            const height    = content?.height ?? CHART_COLLAPSED_STATE_HEIGHT;
            const width     = content?.width ?? CHART_STATE_WIDTH;
            const placement = placementByState.get ( state.name );
            const position  = placement === undefined
                ? fallbackByState.get ( state.name ) ?? { x: CHART_FALLBACK_ORIGIN_X, y: CHART_FALLBACK_ORIGIN_Y }
                : flowPositionFromStoredStatePlacement ( placement );
            const stateDiagnostics = diagnostics.filter ( diagnostic =>
                diagnostic.context === state.name || diagnostic.path?.startsWith ( `/state_machine/states/${stateIndex}` ) === true );
            const validationStatus = stateDiagnostics.some ( diagnostic => diagnostic.severity === "error" )
                ? "error" as const
                : stateDiagnostics.some ( diagnostic => diagnostic.severity === "warning" ) ? "warning" as const : "passed" as const;

            // Return the assembled result.

            return {
                description: state.description,
                entryActionLines: content?.entryActionLines ?? [],
                expanded: draft.chart.settings.expandStates,
                exitActionLines: content?.exitActionLines ?? [],
                height,
                isInitial: draft.stateMachine.initialState === state.name,
                isPersisted: placement !== undefined,
                minimumHeight: content?.minimumHeight ?? CHART_COLLAPSED_STATE_HEIGHT,
                name: state.name,
                nameLines: content?.nameLines ?? [ state.name ],
                savedHeight: content?.savedHeight ?? stateSize.expandedStateMinimumHeight,
                validationStatus,
                width,
                x: position.x,
                y: position.y,
            };
        } ),
        terminalIndicators: draft.chart.indicators.terminalStateIndicators.map ( indicator => ( {
            id: indicator.id,
            ...flowPositionFromStoredIndicator ( indicator ),
        } ) ),
    };
}
