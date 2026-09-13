// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Candidate State Chart
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Renders the read-only Solver candidate as collapsed or expanded UML-style state symbols with
//   configurable separator-aware wrapping for state, event, and action names. The deterministic
//   layered layout favors transition flow from top to bottom.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { useRef, useState } from "react";
import type
{
    KeyboardEvent as ReactKeyboardEvent,
    PointerEvent as ReactPointerEvent,
    WheelEvent as ReactWheelEvent,
} from "react";

import
{
    MAXIMUM_INTERACTIVE_CHART_EDGE_COUNT,
    MAXIMUM_INTERACTIVE_CHART_NODE_COUNT,
} from "../../application/chart-layout-limits.js";
import type { SolverCandidate } from "../../domain/model/contracts.js";
import { text } from "../../localization/messages.js";
import { wrapCandidateChartName } from "./candidate-chart-layout.js";

const STATE_BOX_WIDTH         = 300;
const STATE_HORIZONTAL_GAP    = 80;
const STATE_VERTICAL_GAP      = 90;
const STATE_NAME_LINE_HEIGHT  = 14;
const ACTION_LINE_HEIGHT      = 13;
const COLLAPSED_STATE_HEIGHT  = 60;
const MINIMUM_EXPANDED_HEIGHT = 184;
const MINIMUM_CHART_ZOOM      = 0.5;
const MAXIMUM_CHART_ZOOM      = 3;
const CHART_ZOOM_FACTOR       = 1.1;
const KEYBOARD_PAN_DISTANCE   = 24;

//--------------------------------------------------------------------------------------------------
// Interface: CandidateChartNameWrapping
//
// Description:
//
//   Defines the structure of candidate chart name wrapping.
//
//--------------------------------------------------------------------------------------------------

export interface CandidateChartNameWrapping
{
    readonly actionNames: boolean;
    readonly eventNames:  boolean;
    readonly stateNames:  boolean;
}

//--------------------------------------------------------------------------------------------------
// Interface: CandidateStateChartProperties
//
// Description:
//
//   Defines the properties accepted by the candidate state chart interface.
//
//--------------------------------------------------------------------------------------------------

interface CandidateStateChartProperties
{
    readonly candidate:    SolverCandidate;
    readonly expanded:     boolean;
    readonly nameWrapping: CandidateChartNameWrapping;
}

//--------------------------------------------------------------------------------------------------
// Interface: CandidateChartState
//
// Description:
//
//   Defines the structure of candidate chart state.
//
//--------------------------------------------------------------------------------------------------

interface CandidateChartState
{
    readonly entryActionLines: readonly ( readonly string[] )[];
    readonly exitActionLines:  readonly ( readonly string[] )[];
    readonly headerHeight:     number;
    readonly height:           number;
    readonly name:             string;
    readonly nameLines:        readonly string[];
    readonly x:                number;
    readonly y:                number;
}

//--------------------------------------------------------------------------------------------------
// Interface: CandidateChartPoint
//
// Description:
//
//   Defines the structure of candidate chart point.
//
//--------------------------------------------------------------------------------------------------

interface CandidateChartPoint
{
    readonly x: number;
    readonly y: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: CandidateChartViewport
//
// Description:
//
//   Defines the structure of candidate chart viewport.
//
//--------------------------------------------------------------------------------------------------

interface CandidateChartViewport
{
    readonly scale:        number;
    readonly translationX: number;
    readonly translationY: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: CandidateChartPointerDrag
//
// Description:
//
//   Defines the structure of candidate chart pointer drag.
//
//--------------------------------------------------------------------------------------------------

interface CandidateChartPointerDrag
{
    readonly pointerIdentifier: number;
    readonly startPoint:        CandidateChartPoint;
    readonly startTranslationX: number;
    readonly startTranslationY: number;
}

//--------------------------------------------------------------------------------------------------
// Function: actionLineCount
//
// Description:
//
//   Derives the action line count.
//
// Parameters:
//
//   - actions:
//     The actions supplied to the operation.
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

function actionLineCount ( actions: readonly ( readonly string[] )[] ): number
{
    // Return the reduce result.

    return actions.reduce ( ( lineCount, actionLines ) => lineCount + actionLines.length, 0 );
}

//--------------------------------------------------------------------------------------------------
// Function: createStateLevelByName
//
// Description:
//
//   Creates state level by name.
//
// Parameters:
//
//   - candidate:
//     The candidate supplied to the operation.
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

function createStateLevelByName ( candidate: SolverCandidate ): ReadonlyMap<string, number>
{
    // Initialize the local values needed by this operation.

    const stateNames          = candidate.chart.states.map ( placement => placement.state );
    const knownStateNames     = new Set ( stateNames );
    const destinationsByState = new Map<string, string[]> ();

    // Process each transition from the transition table collection in order.

    for ( const transition of candidate.stateMachine.transitionTable )
    {
        // Handle the case where at least one branch condition is satisfied.

        if ( !knownStateNames.has ( transition.state ) || !knownStateNames.has ( transition.stateNext ) )
        {
            continue;
        }

        const destinations = destinationsByState.get ( transition.state ) ?? [];

        destinations.push ( transition.stateNext );
        destinationsByState.set ( transition.state, destinations );
    }

    // Initialize the local values needed by this operation.

    const initialState   = candidate.stateMachine.initialState;
    const componentRoots = initialState !== null && knownStateNames.has ( initialState )
        ? [ initialState, ...stateNames.filter ( stateName => stateName !== initialState ) ]
        : stateNames;
    const levelByStateName = new Map<string, number> ();
    let nextComponentLevel = 0;

    // Process each component root from the component roots collection in order.

    for ( const componentRoot of componentRoots )
    {
        // Handle the case where has result is enabled.

        if ( levelByStateName.has ( componentRoot ) )
        {
            continue;
        }

        // Initialize the local values needed by this operation.

        const pendingStateNames = [ componentRoot ];
        let pendingStateIndex   = 0;

        levelByStateName.set ( componentRoot, nextComponentLevel );

        // Continue the operation while its terminating condition has not been reached.

        while ( pendingStateIndex < pendingStateNames.length )
        {
            // Initialize the local values needed by this operation.

            const sourceStateName = pendingStateNames [ pendingStateIndex ];

            pendingStateIndex++;

            // Handle the case where source state name matches undefined.

            if ( sourceStateName === undefined )
            {
                continue;
            }

            const sourceLevel = levelByStateName.get ( sourceStateName ) ?? nextComponentLevel;

            // Process each destination state name from the current value collection in order.

            for ( const destinationStateName of destinationsByState.get ( sourceStateName ) ?? [] )
            {
                // Handle the case where has result is enabled.

                if ( levelByStateName.has ( destinationStateName ) )
                {
                    continue;
                }

                levelByStateName.set ( destinationStateName, sourceLevel + 1 );
                pendingStateNames.push ( destinationStateName );
            }
        }

        nextComponentLevel = Math.max ( ...levelByStateName.values () ) + 1;
    }

    // Return the level by state name.

    return levelByStateName;
}

//--------------------------------------------------------------------------------------------------
// Function: createCandidateChartStates
//
// Description:
//
//   Creates candidate chart states.
//
// Parameters:
//
//   - properties:
//     The component properties.
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

function createCandidateChartStates (
    properties: CandidateStateChartProperties,
): readonly CandidateChartState[]
{
    // Initialize the local values needed by this operation.

    const stateLevelByName = createStateLevelByName ( properties.candidate );
    const stateDefinitions = properties.candidate.chart.states.map ( ( placement, index ) =>
    {
        // Initialize the local values needed by this operation.

        const nameLines = wrapCandidateChartName (
            placement.state,
            properties.nameWrapping.stateNames,
        );
        const entryActionLines = properties.candidate.stateMachine.stateActions.entry
            .filter ( assignment => assignment.state === placement.state )
            .map ( assignment => wrapCandidateChartName ( assignment.action, properties.nameWrapping.actionNames ) );
        const exitActionLines = properties.candidate.stateMachine.stateActions.exit
            .filter ( assignment => assignment.state === placement.state )
            .map ( assignment => wrapCandidateChartName ( assignment.action, properties.nameWrapping.actionNames ) );
        const headerHeight          = Math.max ( 42, 18 + nameLines.length * STATE_NAME_LINE_HEIGHT );
        const expandedContentHeight = 72 +
            ( actionLineCount ( entryActionLines ) + actionLineCount ( exitActionLines ) ) * ACTION_LINE_HEIGHT;

        // Return the assembled result.

        return {
            entryActionLines,
            exitActionLines,
            headerHeight,
            height: properties.expanded
                ? Math.max ( MINIMUM_EXPANDED_HEIGHT, headerHeight + expandedContentHeight )
                : COLLAPSED_STATE_HEIGHT,
            index,
            level: stateLevelByName.get ( placement.state ) ?? 0,
            name: placement.state,
            nameLines,
        };
    } );
    const stateDefinitionsByLevel = new Map<number, typeof stateDefinitions> ();

    // Process each state definition from the state definitions collection in order.

    for ( const stateDefinition of stateDefinitions )
    {
        // Initialize the local values needed by this operation.

        const levelStates = stateDefinitionsByLevel.get ( stateDefinition.level ) ?? [];

        stateDefinitionsByLevel.set ( stateDefinition.level, [ ...levelStates, stateDefinition ] );
    }

    // Initialize the local values needed by this operation.

    const orderedLevels    = [ ...stateDefinitionsByLevel.keys () ].sort ( ( left, right ) => left - right );
    const levelTopByNumber = new Map<number, number> ();
    let nextLevelTop       = 0;

    // Process each level from the ordered levels collection in order.

    for ( const level of orderedLevels )
    {
        // Initialize the local values needed by this operation.

        const levelStates = stateDefinitionsByLevel.get ( level ) ?? [];
        const levelHeight = Math.max ( ...levelStates.map ( state => state.height ) );

        levelTopByNumber.set ( level, nextLevelTop );
        nextLevelTop += levelHeight + STATE_VERTICAL_GAP;
    }

    // Initialize the local values needed by this operation.

    const maximumStatesInLevel = Math.max ( 1, ...[ ...stateDefinitionsByLevel.values () ].map ( states => states.length ) );
    const maximumLevelWidth    = maximumStatesInLevel * STATE_BOX_WIDTH +
        ( maximumStatesInLevel - 1 ) * STATE_HORIZONTAL_GAP;

    // Return the mapped collection.

    return stateDefinitions.map ( state =>
    {
        // Initialize the local values needed by this operation.

        const levelStates       = stateDefinitionsByLevel.get ( state.level ) ?? [];
        const stateIndexInLevel = levelStates.findIndex ( levelState => levelState.name === state.name );
        const levelWidth        = levelStates.length * STATE_BOX_WIDTH +
            Math.max ( 0, levelStates.length - 1 ) * STATE_HORIZONTAL_GAP;

        // Return the assembled result.

        return {
            entryActionLines: state.entryActionLines,
            exitActionLines:  state.exitActionLines,
            headerHeight:     state.headerHeight,
            height:           state.height,
            name:             state.name,
            nameLines:        state.nameLines,
            x:                ( maximumLevelWidth - levelWidth ) / 2 +
                stateIndexInLevel * ( STATE_BOX_WIDTH + STATE_HORIZONTAL_GAP ),
            y:                levelTopByNumber.get ( state.level ) ?? 0,
        };
    } );
}

//--------------------------------------------------------------------------------------------------
// Function: renderTextLines
//
// Description:
//
//   Renders text lines.
//
// Parameters:
//
//   - lines:
//     The lines supplied to the operation.
//
//   - x:
//     The x supplied to the operation.
//
//   - firstLineY:
//     The first line y supplied to the operation.
//
//   - className:
//     The class name supplied to the operation.
//
//   - lineHeight:
//     The line height supplied to the operation.
//
//   - textAnchor:
//     The text anchor supplied to the operation.
//
//   - nameKind:
//     The name kind supplied to the operation.
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

function renderTextLines (
    lines: readonly string[],
    x: number,
    firstLineY: number,
    className: string,
    lineHeight: number,
    textAnchor: "middle" | "start",
    nameKind: "action" | "event" | "state",
)
{
    // Return the rendered interface.

    return (
        <text
            className={ className }
            data-chart-name-kind={ nameKind }
            textAnchor = { textAnchor }
            x          = { x }
            y          = { firstLineY }
        >
            { lines.map ( ( line, lineIndex ) => (
                <tspan dy={ lineIndex === 0 ? 0 : lineHeight } key={ `${line}-${lineIndex}` } x={ x }>{ line }</tspan>
            ) ) }
        </text>
    );
}

//--------------------------------------------------------------------------------------------------
// Function: transitionEndpoints
//
// Description:
//
//   Derives the transition endpoints.
//
// Parameters:
//
//   - source:
//     The source supplied to the operation.
//
//   - destination:
//     The destination supplied to the operation.
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

function transitionEndpoints ( source: CandidateChartState, destination: CandidateChartState )
{
    // Initialize the local values needed by this operation.

    const sourceCenterX      = source.x + STATE_BOX_WIDTH / 2;
    const sourceCenterY      = source.y + source.height / 2;
    const destinationCenterX = destination.x + STATE_BOX_WIDTH / 2;
    const destinationCenterY = destination.y + destination.height / 2;
    const horizontalDistance = destinationCenterX - sourceCenterX;
    const verticalDistance   = destinationCenterY - sourceCenterY;

    // Handle the case where source name matches destination name.

    if ( source.name === destination.name )
    {
        // Return the assembled result.

        return {
            labelX: sourceCenterX,
            labelY: source.y - 42,
            path: `M ${sourceCenterX - 44} ${source.y} C ${sourceCenterX - 44} ${source.y - 66}, ` +
                `${sourceCenterX + 44} ${source.y - 66}, ${sourceCenterX + 44} ${source.y}`,
        };
    }

    // Initialize the local values needed by this operation.

    const distance       = Math.hypot ( horizontalDistance, verticalDistance ) || 1;
    const horizontalUnit = horizontalDistance / distance;
    const verticalUnit   = verticalDistance / distance;
    const sourceRadius   = Math.min (
        Math.abs ( horizontalUnit ) < 0.001 ? Number.POSITIVE_INFINITY : STATE_BOX_WIDTH / 2 / Math.abs ( horizontalUnit ),
        Math.abs ( verticalUnit ) < 0.001 ? Number.POSITIVE_INFINITY : source.height / 2 / Math.abs ( verticalUnit ),
    );
    const destinationRadius = Math.min (
        Math.abs ( horizontalUnit ) < 0.001 ? Number.POSITIVE_INFINITY : STATE_BOX_WIDTH / 2 / Math.abs ( horizontalUnit ),
        Math.abs ( verticalUnit ) < 0.001 ? Number.POSITIVE_INFINITY : destination.height / 2 / Math.abs ( verticalUnit ),
    );
    const startX = sourceCenterX + horizontalUnit * sourceRadius;
    const startY = sourceCenterY + verticalUnit * sourceRadius;
    const endX   = destinationCenterX - horizontalUnit * destinationRadius;
    const endY   = destinationCenterY - verticalUnit * destinationRadius;

    // Return the assembled result.

    return {
        labelX: ( startX + endX ) / 2,
        labelY: ( startY + endY ) / 2 - 9,
        path: `M ${startX} ${startY} L ${endX} ${endY}`,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: clientPointInChart
//
// Description:
//
//   Derives the client point in chart.
//
// Parameters:
//
//   - svg:
//     The SVG supplied to the operation.
//
//   - clientX:
//     The client x supplied to the operation.
//
//   - clientY:
//     The client y supplied to the operation.
//
//   - fallbackPoint:
//     The fallback point supplied to the operation.
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

function clientPointInChart (
    svg: SVGSVGElement,
    clientX: number,
    clientY: number,
    fallbackPoint: CandidateChartPoint,
): CandidateChartPoint
{
    // Initialize the local values needed by this operation.

    const transformationMatrix = svg.getScreenCTM ();

    // Handle the case where all required conditions are satisfied.

    if ( transformationMatrix !== null && typeof svg.createSVGPoint === "function" )
    {
        // Initialize the local values needed by this operation.

        const point = svg.createSVGPoint ();

        point.x = clientX;
        point.y = clientY;

        const chartPoint = point.matrixTransform ( transformationMatrix.inverse () );

        // Return the assembled result.

        return { x: chartPoint.x, y: chartPoint.y };
    }

    // Return the fallback point.

    return fallbackPoint;
}

//--------------------------------------------------------------------------------------------------
// Function: CandidateStateChart
//
// Description:
//
//   Renders the candidate state chart interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered candidate state chart interface.
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

export function CandidateStateChart ( properties: CandidateStateChartProperties )
{
    // Initialize the local values needed by this operation.

    const svgReference         = useRef<SVGSVGElement> ( null );
    const pointerDragReference = useRef<CandidateChartPointerDrag | null> ( null );
    const [ viewport, setViewport ] = useState<CandidateChartViewport> (
        { scale: 1, translationX: 0, translationY: 0 },
    );
    const [ panning, setPanning ] = useState ( false );
    const candidateStateCount      = properties.candidate.stateMachine.states.length;
    const candidateTransitionCount = properties.candidate.stateMachine.transitionTable.length;

    // Handle the case where at least one branch condition is satisfied.

    if ( candidateStateCount > MAXIMUM_INTERACTIVE_CHART_NODE_COUNT ||
        candidateTransitionCount > MAXIMUM_INTERACTIVE_CHART_EDGE_COUNT )
    {
        // Return the rendered interface.

        return (
            <p className="empty-state" role="status">
                { text ( "solver.candidate.chartCapacity" ) }
            </p>
        );
    }

    // Initialize the local values needed by this operation.

    const states      = createCandidateChartStates ( properties );
    const stateByName = new Map ( states.map ( state => [ state.name, state ] ) );
    const chartWidth  = Math.max ( 700, ...states.map ( state => state.x + STATE_BOX_WIDTH + 80 ) );
    const chartHeight = Math.max ( 300, ...states.map ( state => state.y + state.height + 90 ) );
    const viewBox     = { height: chartHeight + 160, width: chartWidth + 120, x: -60, y: -80 };

    //----------------------------------------------------------------------------------------------
    // Function: zoomAroundPoint
    //
    // Description:
    //
    //   Handles the zoom around point behavior.
    //
    // Parameters:
    //
    //   - factor:
    //     The factor supplied to the operation.
    //
    //   - anchor:
    //     The anchor supplied to the operation.
    //
    // Returns:
    //
    //   No value is returned.
    //
    // Preconditions:
    //
    //   - The supplied arguments satisfy their declared TypeScript contracts.
    //
    // Postconditions:
    //
    //   - The described side effects are complete when the callable returns.
    //
    //----------------------------------------------------------------------------------------------

    function zoomAroundPoint ( factor: number, anchor: CandidateChartPoint ): void
    {
        setViewport ( currentViewport =>
        {
            // Initialize the local values needed by this operation.

            const nextScale = Math.min (
                MAXIMUM_CHART_ZOOM,
                Math.max ( MINIMUM_CHART_ZOOM, currentViewport.scale * factor ),
            );
            const scaleRatio = nextScale / currentViewport.scale;

            // Return the assembled result.

            return {
                scale: nextScale,
                translationX: anchor.x - ( anchor.x - currentViewport.translationX ) * scaleRatio,
                translationY: anchor.y - ( anchor.y - currentViewport.translationY ) * scaleRatio,
            };
        } );
    }

    //----------------------------------------------------------------------------------------------
    // Function: chartPoint
    //
    // Description:
    //
    //   Derives the chart point.
    //
    // Parameters:
    //
    //   - clientX:
    //     The client x supplied to the operation.
    //
    //   - clientY:
    //     The client y supplied to the operation.
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

    function chartPoint ( clientX: number, clientY: number ): CandidateChartPoint
    {
        // Calculate the fallback point value from the current inputs.

        const fallbackPoint = { x: viewBox.x + viewBox.width / 2, y: viewBox.y + viewBox.height / 2 };

        // Return the result selected by the current condition.

        return svgReference.current === null
            ? fallbackPoint
            : clientPointInChart ( svgReference.current, clientX, clientY, fallbackPoint );
    }

    //----------------------------------------------------------------------------------------------
    // Function: handleWheel
    //
    // Description:
    //
    //   Handles wheel.
    //
    // Parameters:
    //
    //   - event:
    //     The event to process.
    //
    // Returns:
    //
    //   No value is returned.
    //
    // Preconditions:
    //
    //   - The supplied arguments satisfy their declared TypeScript contracts.
    //
    // Postconditions:
    //
    //   - The described side effects are complete when the callable returns.
    //
    //----------------------------------------------------------------------------------------------

    function handleWheel ( event: ReactWheelEvent<HTMLDivElement> ): void
    {
        // Handle the case where event delta y equals 0.

        if ( event.deltaY === 0 )
        {
            // Return control to the caller.

            return;
        }

        event.preventDefault ();
        zoomAroundPoint (
            event.deltaY < 0 ? CHART_ZOOM_FACTOR : 1 / CHART_ZOOM_FACTOR,
            chartPoint ( event.clientX, event.clientY ),
        );
    }

    //----------------------------------------------------------------------------------------------
    // Function: beginPanning
    //
    // Description:
    //
    //   Begins the panning.
    //
    // Parameters:
    //
    //   - event:
    //     The event to process.
    //
    // Returns:
    //
    //   No value is returned.
    //
    // Preconditions:
    //
    //   - The supplied arguments satisfy their declared TypeScript contracts.
    //
    // Postconditions:
    //
    //   - The described side effects are complete when the callable returns.
    //
    //----------------------------------------------------------------------------------------------

    function beginPanning ( event: ReactPointerEvent<HTMLDivElement> ): void
    {
        // Handle the case where event button differs from the 0 value.

        if ( event.button !== 0 )
        {
            // Return control to the caller.

            return;
        }

        event.preventDefault ();
        event.currentTarget.focus ();
        event.currentTarget.setPointerCapture?.( event.pointerId );
        pointerDragReference.current =
        {
            pointerIdentifier: event.pointerId,
            startPoint: chartPoint ( event.clientX, event.clientY ),
            startTranslationX: viewport.translationX,
            startTranslationY: viewport.translationY,
        };
        setPanning ( true );
    }

    //----------------------------------------------------------------------------------------------
    // Function: continuePanning
    //
    // Description:
    //
    //   Handles the continue panning behavior.
    //
    // Parameters:
    //
    //   - event:
    //     The event to process.
    //
    // Returns:
    //
    //   No value is returned.
    //
    // Preconditions:
    //
    //   - The supplied arguments satisfy their declared TypeScript contracts.
    //
    // Postconditions:
    //
    //   - The described side effects are complete when the callable returns.
    //
    //----------------------------------------------------------------------------------------------

    function continuePanning ( event: ReactPointerEvent<HTMLDivElement> ): void
    {
        // Initialize the local values needed by this operation.

        const pointerDrag = pointerDragReference.current;

        // Handle the case where at least one branch condition is satisfied.

        if ( pointerDrag === null || pointerDrag.pointerIdentifier !== event.pointerId )
        {
            // Return control to the caller.

            return;
        }

        const currentPoint = chartPoint ( event.clientX, event.clientY );

        setViewport ( currentViewport => ( {
            ...currentViewport,
            translationX: pointerDrag.startTranslationX + currentPoint.x - pointerDrag.startPoint.x,
            translationY: pointerDrag.startTranslationY + currentPoint.y - pointerDrag.startPoint.y,
        } ) );
    }

    //----------------------------------------------------------------------------------------------
    // Function: finishPanning
    //
    // Description:
    //
    //   Finalizes the panning.
    //
    // Parameters:
    //
    //   - event:
    //     The event to process.
    //
    // Returns:
    //
    //   No value is returned.
    //
    // Preconditions:
    //
    //   - The supplied arguments satisfy their declared TypeScript contracts.
    //
    // Postconditions:
    //
    //   - The described side effects are complete when the callable returns.
    //
    //----------------------------------------------------------------------------------------------

    function finishPanning ( event: ReactPointerEvent<HTMLDivElement> ): void
    {
        // Handle the case where pointer identifier differs from event pointer identifier.

        if ( pointerDragReference.current?.pointerIdentifier !== event.pointerId )
        {
            // Return control to the caller.

            return;
        }

        // Handle the case where has pointer capture result is enabled.

        if ( event.currentTarget.hasPointerCapture?.( event.pointerId ) )
        {
            event.currentTarget.releasePointerCapture?.( event.pointerId );
        }

        pointerDragReference.current = null;
        setPanning ( false );
    }

    //----------------------------------------------------------------------------------------------
    // Function: handleKeyboard
    //
    // Description:
    //
    //   Handles keyboard.
    //
    // Parameters:
    //
    //   - event:
    //     The event to process.
    //
    // Returns:
    //
    //   No value is returned.
    //
    // Preconditions:
    //
    //   - The supplied arguments satisfy their declared TypeScript contracts.
    //
    // Postconditions:
    //
    //   - The described side effects are complete when the callable returns.
    //
    //----------------------------------------------------------------------------------------------

    function handleKeyboard ( event: ReactKeyboardEvent<HTMLDivElement> ): void
    {
        // Calculate the center point value from the current inputs.

        const centerPoint = { x: viewBox.x + viewBox.width / 2, y: viewBox.y + viewBox.height / 2 };

        // Handle the case where at least one branch condition is satisfied.

        if ( event.key === "+" || event.key === "=" )
        {
            event.preventDefault ();
            zoomAroundPoint ( CHART_ZOOM_FACTOR, centerPoint );
        }
        else if ( event.key === "-" )
        {
            event.preventDefault ();
            zoomAroundPoint ( 1 / CHART_ZOOM_FACTOR, centerPoint );
        }
        else if ( event.key === "Home" )
        {
            event.preventDefault ();
            setViewport ( { scale: 1, translationX: 0, translationY: 0 } );
        }
        else if ( [ "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown" ].includes ( event.key ) )
        {
            event.preventDefault ();
            setViewport ( currentViewport => ( {
                ...currentViewport,
                translationX: currentViewport.translationX +
                    ( event.key === "ArrowLeft" ? -KEYBOARD_PAN_DISTANCE : event.key === "ArrowRight" ? KEYBOARD_PAN_DISTANCE : 0 ),
                translationY: currentViewport.translationY +
                    ( event.key === "ArrowUp" ? -KEYBOARD_PAN_DISTANCE : event.key === "ArrowDown" ? KEYBOARD_PAN_DISTANCE : 0 ),
            } ) );
        }
    }

    // Return the rendered interface.

    return (
        <div
            aria-describedby="solver-candidate-chart-instructions"
            className="solver-chart"
            data-layout-direction="top-to-bottom"
            data-pan-x={ Math.round ( viewport.translationX ) }
            data-pan-y={ Math.round ( viewport.translationY ) }
            data-panning={ panning }
            data-zoom={ viewport.scale.toFixed ( 2 ) }
            onKeyDown       = { handleKeyboard }
            onPointerCancel = { finishPanning }
            onPointerDown   = { beginPanning }
            onPointerMove   = { continuePanning }
            onPointerUp     = { finishPanning }
            onWheel         = { handleWheel }
            role            = "img"
            aria-label={ text ( "solver.candidate.stateChart" ) }
            tabIndex={ 0 }
        >
            <span className="visually-hidden" id="solver-candidate-chart-instructions">
                { text ( "solver.candidate.chartInstructions" ) }
            </span>
            <svg
                preserveAspectRatio = "xMinYMin meet"
                ref                 = { svgReference }
                viewBox             = { `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}` }
            >
                <defs>
                    <marker id="solver-candidate-arrow" markerHeight="7" markerWidth="7" orient="auto" refX="6" refY="3.5">
                        <path className="solver-chart-arrow" d="M 0 0 L 7 3.5 L 0 7 z" />
                    </marker>
                </defs>
                <g
                    className = "solver-chart-content"
                    transform = { `translate(${viewport.translationX} ${viewport.translationY}) scale(${viewport.scale})` }
                >
                { properties.candidate.stateMachine.transitionTable.map ( transition =>
                {
                    // Initialize the local values needed by this operation.

                    const source      = stateByName.get ( transition.state );
                    const destination = stateByName.get ( transition.stateNext );

                    // Handle the case where at least one branch condition is satisfied.

                    if ( source === undefined || destination === undefined )
                    {
                        // Return the computed result.

                        return null;
                    }

                    // Initialize the local values needed by this operation.

                    const endpoints  = transitionEndpoints ( source, destination );
                    const eventLines = wrapCandidateChartName (
                        transition.event,
                        properties.nameWrapping.eventNames,
                    );

                    // Return the rendered interface.

                    return (
                        <g className="solver-chart-transition" key={ `${transition.state}-${transition.event}` }>
                            <path className="solver-chart-transition-line" d={ endpoints.path } markerEnd="url(#solver-candidate-arrow)" />
                            { renderTextLines (
                                eventLines,
                                endpoints.labelX,
                                endpoints.labelY,
                                "solver-chart-event-name",
                                STATE_NAME_LINE_HEIGHT,
                                "middle",
                                "event",
                            ) }
                        </g>
                    );
                } ) }
                { states.map ( state =>
                {
                    // Initialize the local values needed by this operation.

                    const stateNameFirstLineY = state.y + state.headerHeight / 2 -
                        ( state.nameLines.length - 1 ) * STATE_NAME_LINE_HEIGHT / 2 + 4;
                    const entryHeadingY = state.y + state.headerHeight + 21;
                    let actionLineY     = entryHeadingY + 18;

                    // Return the rendered interface.

                    return (
                        <g aria-label={ state.name } className="solver-chart-state" data-state={ state.name } key={ state.name }>
                            <rect
                                className = "solver-chart-state-box"
                                height    = { state.height }
                                rx        = "10"
                                width     = { STATE_BOX_WIDTH }
                                x         = { state.x }
                                y         = { state.y }
                            />
                            { renderTextLines (
                                state.nameLines,
                                state.x + STATE_BOX_WIDTH / 2,
                                stateNameFirstLineY,
                                "solver-chart-state-name",
                                STATE_NAME_LINE_HEIGHT,
                                "middle",
                                "state",
                            ) }
                            { properties.expanded && (
                                <>
                                    <line
                                        className = "solver-chart-state-divider"
                                        x1        = { state.x }
                                        x2        = { state.x + STATE_BOX_WIDTH }
                                        y1        = { state.y + state.headerHeight }
                                        y2        = { state.y + state.headerHeight }
                                    />
                                    <text className="solver-chart-action-heading" x={ state.x + 12 } y={ entryHeadingY }>
                                        { text ( "solver.candidate.actions" ) }
                                    </text>
                                    { state.entryActionLines.map ( ( lines, actionIndex ) =>
                                    {
                                        // Initialize the local values needed by this operation.

                                        const firstLineY = actionLineY;

                                        actionLineY += lines.length * ACTION_LINE_HEIGHT;

                                        // Return the rendered interface.

                                        return (
                                            <g key={ `entry-action-${actionIndex}` }>
                                                { renderTextLines (
                                                    lines.map ( ( line, lineIndex ) => lineIndex === 0
                                                        ? `\u2022 ${line}`
                                                        : `  ${line}` ),
                                                    state.x + 18,
                                                    firstLineY,
                                                    "solver-chart-action-name",
                                                    ACTION_LINE_HEIGHT,
                                                    "start",
                                                    "action",
                                                ) }
                                            </g>
                                        );
                                    } ) }
                                    <text className="solver-chart-action-heading" x={ state.x + 12 } y={ actionLineY + 17 }>
                                        { text ( "solver.candidate.exitActions" ) }
                                    </text>
                                    { state.exitActionLines.map ( ( lines, actionIndex ) =>
                                    {
                                        // Calculate the first line y value from the current inputs.

                                        const firstLineY = actionLineY + 35;

                                        actionLineY += lines.length * ACTION_LINE_HEIGHT;

                                        // Return the rendered interface.

                                        return (
                                            <g key={ `exit-action-${actionIndex}` }>
                                                { renderTextLines (
                                                    lines.map ( ( line, lineIndex ) => lineIndex === 0
                                                        ? `\u2022 ${line}`
                                                        : `  ${line}` ),
                                                    state.x + 18,
                                                    firstLineY,
                                                    "solver-chart-action-name",
                                                    ACTION_LINE_HEIGHT,
                                                    "start",
                                                    "action",
                                                ) }
                                            </g>
                                        );
                                    } ) }
                                </>
                            ) }
                            { properties.candidate.stateMachine.initialState === state.name && (
                                <text className="solver-chart-marker" x={ state.x - 22 } y={ state.y + state.height / 2 + 4 }>I</text>
                            ) }
                        </g>
                    );
                } ) }
                </g>
            </svg>
        </div>
    );
}
