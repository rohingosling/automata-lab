// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    State Chart Nodes
// Version: 1.0.0
// Date:    2026-08-11
// Author:  Rohin Gosling
//
// Description:
//
//   Renders accessible state and indicator nodes for the read/write authoring Chart.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { Handle, NodeResizeControl, Position, ResizeControlVariant } from "@xyflow/react";
import type { Node, NodeProps, ResizeParams } from "@xyflow/react";

import { text } from "../../localization/messages.js";
import type { ChartRoutingResultRelation } from "../../application/ports/contracts.js";
import { COMPILE_TIME_CONFIGURATION } from "../../configuration/compile-time-configuration.js";
import type { ChartPoint } from "../../domain/model/contracts.js";
import type { AuthoringChartStateViewModel } from "./chart-projection.js";
import
{
    TransitionArrowMarkerDefinition,
    curvedBezierPathFromBackbone,
    curvedBezierPathFromCurves,
    gravityPointsFromBackbone,
} from "./StateChartEdges.js";
import
{
    MAXIMUM_CHART_STATE_DIMENSION,
} from "../../domain/model/limits.js";

//--------------------------------------------------------------------------------------------------
// Type: StateChartNodeData
//
// Description:
//
//   Defines the state chart node data type.
//
//--------------------------------------------------------------------------------------------------

export type StateChartNodeData =
{
    readonly onResizeEnd?: ( parameters: ResizeParams ) => void;
    readonly viewModel: AuthoringChartStateViewModel;
};

//--------------------------------------------------------------------------------------------------
// Type: StateChartIndicatorNodeData
//
// Description:
//
//   Defines the state chart indicator node data type.
//
//--------------------------------------------------------------------------------------------------

export type StateChartIndicatorNodeData =
{
    readonly indicatorId: number | null;
    readonly kind:        "initial" | "terminal";
    readonly label:       string;
};

//--------------------------------------------------------------------------------------------------
// Type: StateChartDraftTransitionNodeData
//
// Description:
//
//   Defines the state chart draft transition node data type.
//
//--------------------------------------------------------------------------------------------------

export type StateChartDraftTransitionNodeData =
{
    readonly draftTransitionId: number;
    readonly label:             string;
    readonly origin:            ChartPoint;
    readonly routedGeometry?:   ChartRoutingResultRelation;
    readonly source:            ChartPoint;
    readonly target:            ChartPoint;
    readonly transitionArrowHeadSize: number;
};

//--------------------------------------------------------------------------------------------------
// Type: StateChartStateNode
//
// Description:
//
//   Defines the state chart state node type.
//
//--------------------------------------------------------------------------------------------------

export type StateChartStateNode = Node<StateChartNodeData, "state">;

//--------------------------------------------------------------------------------------------------
// Type: StateChartIndicatorNode
//
// Description:
//
//   Defines the state chart indicator node type.
//
//--------------------------------------------------------------------------------------------------

export type StateChartIndicatorNode = Node<StateChartIndicatorNodeData, "indicator">;

//--------------------------------------------------------------------------------------------------
// Type: StateChartDraftTransitionNode
//
// Description:
//
//   Defines the state chart draft transition node type.
//
//--------------------------------------------------------------------------------------------------

export type StateChartDraftTransitionNode = Node<StateChartDraftTransitionNodeData, "draftTransition">;

//--------------------------------------------------------------------------------------------------
// Type: StateChartNode
//
// Description:
//
//   Defines the supported state chart node alternatives.
//
//--------------------------------------------------------------------------------------------------

export type StateChartNode = StateChartStateNode | StateChartIndicatorNode | StateChartDraftTransitionNode;

const CHART_STATE_HANDLES =
[
    { identifier: "top", position: Position.Top },
    { identifier: "right", position: Position.Right },
    { identifier: "bottom", position: Position.Bottom },
    { identifier: "left", position: Position.Left },
] as const;

const CHART_INDICATOR_HANDLES = CHART_STATE_HANDLES;

//--------------------------------------------------------------------------------------------------
// Function: ActionLines
//
// Description:
//
//   Renders the action lines interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered action lines interface.
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

function ActionLines ( properties: { readonly lines: readonly ( readonly string[] )[] } )
{
    // Handle the case where length equals 0.

    if ( properties.lines.length === 0 )
    {
        // Return the rendered interface.

        return <p className="chart-empty-actions">{ text ( "chart.actions.none" ) }</p>;
    }

    // Return the rendered interface.

    return (
        <ol className="chart-action-list">
            { properties.lines.map ( ( lines, actionIndex ) => (
                <li key={ `action-${actionIndex}` }>
                    { lines.map ( ( line, lineIndex ) => (
                        <span key={ `${line}-${lineIndex}` }>{ lineIndex > 0 && <br /> }{ line }</span>
                    ) ) }
                </li>
            ) ) }
        </ol>
    );
}

//--------------------------------------------------------------------------------------------------
// Function: StateChartStateNodeComponent
//
// Description:
//
//   Renders the state chart state node component interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered state chart state node component interface.
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

export function StateChartStateNodeComponent ( properties: NodeProps<StateChartStateNode> )
{
    // Initialize the local values needed by this operation.

    const state = properties.data.viewModel;

    // Return the rendered interface.

    return (
        <div
            className={ `chart-state-node${properties.selected ? " chart-node-selected" : ""}` }
            data-chart-state={ state.name }
            data-persisted={ state.isPersisted }
            data-validation={ state.validationStatus }
            title={ state.description.length === 0 ? state.name : `${state.name} — ${state.description}` }
        >
            { properties.selected && state.expanded && ( [ "top", "bottom" ] as const ).map ( position => (
                <NodeResizeControl
                    className       = { `chart-state-height-resizer chart-state-height-resizer-${position}` }
                    key             = { position }
                    maxHeight       = { MAXIMUM_CHART_STATE_DIMENSION }
                    maxWidth        = { state.width }
                    minHeight       = { state.minimumHeight }
                    minWidth        = { state.width }
                    onResizeEnd     = { ( _event, parameters ) => properties.data.onResizeEnd?. ( parameters ) }
                    position        = { position }
                    resizeDirection = "vertical"
                    variant         = { ResizeControlVariant.Line }
                />
            ) ) }
            { CHART_STATE_HANDLES.map ( handle => (
                <Handle id={ handle.identifier } key={ handle.identifier } position={ handle.position } type="source" />
            ) ) }
            <header className="chart-state-header">
                <strong>
                    { state.nameLines.map ( ( line, lineIndex ) => (
                        <span key={ `${line}-${lineIndex}` }>{ lineIndex > 0 && <br /> }{ line }</span>
                    ) ) }
                </strong>
            </header>
            { !state.isPersisted && (
                <div className="chart-state-markers">
                    <span className="chart-semantic-marker">{ text ( "chart.state.unplaced" ) }</span>
                </div>
            ) }
            { state.expanded && state.entryActionLines !== undefined && state.exitActionLines !== undefined && (
                <div className="chart-state-compartments">
                    <section>
                        <h3>{ text ( "chart.state.entryActions" ) }</h3>
                        <ActionLines lines={ state.entryActionLines } />
                    </section>
                    <section>
                        <h3>{ text ( "chart.state.exitActions" ) }</h3>
                        <ActionLines lines={ state.exitActionLines } />
                    </section>
                </div>
            ) }
        </div>
    );
}

//--------------------------------------------------------------------------------------------------
// Function: StateChartIndicatorNodeComponent
//
// Description:
//
//   Renders the state chart indicator node component interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered state chart indicator node component interface.
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

export function StateChartIndicatorNodeComponent ( properties: NodeProps<StateChartIndicatorNode> )
{
    // Initialize the local values needed by this operation.

    const isInitial = properties.data.kind === "initial";

    // Return the rendered interface.

    return (
        <div
            aria-hidden="true"
            className={ `chart-indicator-node chart-${properties.data.kind}-indicator${properties.selected ? " chart-node-selected" : ""}` }
            data-indicator-id={ properties.data.indicatorId ?? "initial" }
            title={ properties.data.label }
        >
            { CHART_INDICATOR_HANDLES.map ( handle => isInitial
                ? <Handle id={ handle.identifier } key={ handle.identifier } position={ handle.position } type="source" />
                : <Handle id={ handle.identifier } key={ handle.identifier } position={ handle.position } type="target" /> ) }
            <span aria-hidden="true" className="chart-indicator-symbol" />
        </div>
    );
}

//--------------------------------------------------------------------------------------------------
// Function: StateChartDraftTransitionNodeComponent
//
// Description:
//
//   Renders the state chart draft transition node component interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered state chart draft transition node component interface.
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

export function StateChartDraftTransitionNodeComponent ( properties: NodeProps<StateChartDraftTransitionNode> )
{
    // Initialize the local values needed by this operation.

    const markerIdentifier = `chart-draft-transition-arrow-${properties.data.draftTransitionId}`;
    const routingPoints    = properties.data.routedGeometry?.points.map ( point => ( {
        x: point.x - properties.data.origin.x,
        y: point.y - properties.data.origin.y,
    } ) ) ?? [ properties.data.source, properties.data.target ];
    const routingCurves = properties.data.routedGeometry?.curves.map ( curve => ( {
        source:
        {
            x: curve.source.x - properties.data.origin.x,
            y: curve.source.y - properties.data.origin.y,
        },
        sourceControl:
        {
            x: curve.sourceControl.x - properties.data.origin.x,
            y: curve.sourceControl.y - properties.data.origin.y,
        },
        target:
        {
            x: curve.target.x - properties.data.origin.x,
            y: curve.target.y - properties.data.origin.y,
        },
        targetControl:
        {
            x: curve.targetControl.x - properties.data.origin.x,
            y: curve.targetControl.y - properties.data.origin.y,
        },
    } ) );
    const gravityPoints = gravityPointsFromBackbone ( routingPoints );

    // Return the rendered interface.

    return (
        <div
            aria-hidden="true"
            className={ `chart-draft-transition-node${properties.selected ? " chart-node-selected" : ""}` }
            data-draft-transition-id={ properties.data.draftTransitionId }
            title={ properties.data.label }
        >
            <svg aria-hidden="true" height="100%" width="100%">
                <defs>
                    <TransitionArrowMarkerDefinition
                        identifier = { markerIdentifier }
                        size       = { properties.data.transitionArrowHeadSize }
                    />
                </defs>
                <path
                    d={ routingCurves === undefined
                        ? curvedBezierPathFromBackbone ( routingPoints )
                        : curvedBezierPathFromCurves ( routingCurves ) }
                    markerEnd={ `url(#${markerIdentifier})` }
                />
                { COMPILE_TIME_CONFIGURATION.debug.gravityPointsVisible && gravityPoints.map ( ( point, index ) => (
                    <circle
                        cx = { point.x }
                        cy = { point.y }
                        data-chart-gravity-point="true"
                        fill          = { COMPILE_TIME_CONFIGURATION.debug.gravityPointsColor }
                        key           = { `gravity-point-${index}-${point.x}-${point.y}` }
                        pointerEvents = "none"
                        r             = { COMPILE_TIME_CONFIGURATION.debug.gravityPointsRadius }
                    />
                ) ) }
                { COMPILE_TIME_CONFIGURATION.debug.transitionLineConnectorsVisible && (
                    <>
                        <circle
                            cx = { routingPoints [ 0 ]?.x ?? properties.data.source.x }
                            cy = { routingPoints [ 0 ]?.y ?? properties.data.source.y }
                            data-chart-transition-connector="source"
                            fill          = { COMPILE_TIME_CONFIGURATION.debug.transitionLineConnectorColor }
                            pointerEvents = "none"
                            r             = { COMPILE_TIME_CONFIGURATION.debug.transitionLineConnectorRadius }
                        />
                        <circle
                            cx = { routingPoints.at ( -1 )?.x ?? properties.data.target.x }
                            cy = { routingPoints.at ( -1 )?.y ?? properties.data.target.y }
                            data-chart-transition-connector="target"
                            fill          = { COMPILE_TIME_CONFIGURATION.debug.transitionLineConnectorColor }
                            pointerEvents = "none"
                            r             = { COMPILE_TIME_CONFIGURATION.debug.transitionLineConnectorRadius }
                        />
                    </>
                ) }
            </svg>
        </div>
    );
}
