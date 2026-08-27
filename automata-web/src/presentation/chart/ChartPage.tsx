// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    State Chart Page
// Version: 1.0.0
// Date:    2026-08-11
// Author:  Rohin Gosling
//
// Description:
//
//   Provides the accessible read/write graph projection over the shared revisioned authoring
//   command path.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import
{
    Background,
    BackgroundVariant,
    ConnectionLineType,
    ConnectionMode,
    Controls,
    ReactFlow,
    ReactFlowProvider,
    SelectionMode,
    ViewportPortal,
    applyEdgeChanges,
    applyNodeChanges,
} from "@xyflow/react";
import type
{
    AriaLabelConfig,
    Connection,
    EdgeChange,
    NodeChange,
    OnSelectionChangeParams,
    ReactFlowInstance,
    ResizeParams,
    Viewport,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, FocusEvent, KeyboardEvent, MouseEvent, PointerEvent } from "react";

import type
{
    ChartGridStyle,
    ChartLayoutEdge,
    ChartLayoutNode,
    ChartLayoutPort,
    ChartRoutingPort,
    ChartRoutingRelation,
} from "../../application/ports/contracts.js";
import
{
    MAXIMUM_INTERACTIVE_CHART_EDGE_COUNT,
    MAXIMUM_INTERACTIVE_CHART_NODE_COUNT,
} from "../../application/chart-layout-limits.js";
import type { DocumentCommandFactory } from "../../application/contracts.js";
import
{
    COMPILE_TIME_CONFIGURATION,
    DEFAULT_APPLICATION_PREFERENCES,
} from "../../configuration/compile-time-configuration.js";
import type
{
    AuthoringDraft,
    ChartDraftTransition,
    ChartPoint,
    TransitionDefinition,
} from "../../domain/model/contracts.js";
import type { DomainDiagnostic } from "../../domain/model/diagnostics.js";
import
{
    DEFAULT_CHART_STATE_HEIGHT,
    MAXIMUM_CHART_STATE_DIMENSION,
} from "../../domain/model/limits.js";
import { text } from "../../localization/messages.js";
import { NamedEntityDialog, SelectionDialog, TransitionDialog } from "../dialogs/DialogPatterns.js";
import { Icon } from "../shared/Icon.js";
import
{
    CHART_INDICATOR_SIZE,
    createAuthoringChartProjection,
    flowPositionFromStoredIndicator,
    storedIndicatorFromFlowPosition,
    storedStatePlacementFromFlowPosition,
    storedTerminalIndicatorFromFlowPosition,
} from "./chart-projection.js";
import type { ChartNameWrapping, ChartStateSizePreferences } from "./chart-projection.js";
import { wrapChartName } from "./chart-name-wrapping.js";
import
{
    StateChartCenterEdgeComponent,
    TRANSITION_ARROW_MARKER_IDENTIFIER,
    TransitionArrowMarkerDefinition,
    calculateCenterRoutedEdgeGeometryFromCenters,
    createChartRoutingRelation,
    transitionLabelSize,
} from "./StateChartEdges.js";
import
{
    selfTransitionLoopAspectRatio,
    selfTransitionLoopGeometry,
    selfTransitionLoopMajorSemiAxes,
    selectSelfTransitionLoopSide,
} from "../../application/chart-self-transition-loops.js";
import type
{
    ChartSelfTransitionLoopGeometry,
    ChartSelfTransitionLoopPreferences,
    ChartSelfTransitionLoopStateGeometry,
} from "../../application/chart-self-transition-loops.js";
import type
{
    ChartNodeBoundary,
    ChartNodeSide,
    ChartOrthogonalObstacle,
    StateChartEdge,
} from "./StateChartEdges.js";
import
{
    StateChartDraftTransitionNodeComponent,
    StateChartIndicatorNodeComponent,
    StateChartStateNodeComponent,
} from "./StateChartNodes.js";
import type
{
    StateChartDraftTransitionNode,
    StateChartIndicatorNode,
    StateChartNode,
    StateChartStateNode,
} from "./StateChartNodes.js";

const CHART_DROP_DATA_TYPE                                                         = "application/x-automata-chart-item";
const KEYBOARD_MOVE_DISTANCE                                                       = 10;
const KEYBOARD_LARGE_MOVE_DISTANCE                                                 = 50;
const KEYBOARD_PAN_DISTANCE                                                        = 48;
const KEYBOARD_COMMIT_DELAY                                                        = 220;
const CHART_DRAFT_TRANSITION_PADDING                                               = 16;
const CHART_DRAFT_TRANSITION_MINIMUM_SIZE                                          = 40;
const CHART_DRAFT_TRANSITION_LENGTH                                                = 180;
const CHART_STATE_BORDER_RADIUS                                                    = 10;
const CHART_ROUTE_CLEARANCE                                                        = COMPILE_TIME_CONFIGURATION.chart.routing.routeClearance;
const CHART_STATE_CORNER_RADIUS                                                    = 10;
const DEFAULT_CHART_SETTINGS                                                       = DEFAULT_APPLICATION_PREFERENCES;
const DEFAULT_SELF_TRANSITION_LOOP_PREFERENCES: ChartSelfTransitionLoopPreferences = 
{
    selfTransitionLoopAspect:    DEFAULT_APPLICATION_PREFERENCES.selfTransitionLoopAspect,
    selfTransitionLoopExtension: DEFAULT_APPLICATION_PREFERENCES.selfTransitionLoopExtension,
    selfTransitionLoopSpacing:   DEFAULT_APPLICATION_PREFERENCES.selfTransitionLoopSpacing,
};
const DEBUG_CONFIGURATION                  = COMPILE_TIME_CONFIGURATION.debug;
const TRANSITION_LABEL_ALIGNMENT_FRACTIONS = 
    COMPILE_TIME_CONFIGURATION.chart.routing.labelPlacement.alignmentFractions;
const TRANSITION_ARROW_MARKER_END = TRANSITION_ARROW_MARKER_IDENTIFIER;

//--------------------------------------------------------------------------------------------------
// Type: ChartPaletteItem
//
// Description:
//
//   Defines the supported chart palette item alternatives.
//
//--------------------------------------------------------------------------------------------------

type ChartPaletteItem = "initial" | "state" | "terminal" | "transition";

//--------------------------------------------------------------------------------------------------
// Interface: ChartRectangle
//
// Description:
//
//   Defines the structure of chart rectangle.
//
//--------------------------------------------------------------------------------------------------

interface ChartRectangle
{
    readonly height: number;
    readonly width:  number;
    readonly x:      number;
    readonly y:      number;
}

//--------------------------------------------------------------------------------------------------
// Interface: ChartTechnicalSides
//
// Description:
//
//   Defines the structure of chart technical sides.
//
//--------------------------------------------------------------------------------------------------

interface ChartTechnicalSides
{
    readonly sourceSide: ChartNodeSide;
    readonly targetSide: ChartNodeSide;
}

//--------------------------------------------------------------------------------------------------
// Type: ChartFocusRequest
//
// Description:
//
//   Describes a chart focus request.
//
//--------------------------------------------------------------------------------------------------

type ChartFocusRequest =
    | { readonly kind: "canvas" }
    | { readonly identifier: string; readonly kind: "control" | "draft-endpoint" | "edge" | "node" };

//--------------------------------------------------------------------------------------------------
// Interface: PendingStateDialog
//
// Description:
//
//   Defines the structure of pending state dialog.
//
//--------------------------------------------------------------------------------------------------

interface PendingStateDialog
{
    readonly mode:          "add" | "edit";
    readonly originalName:  string | null;
    readonly point:         ChartPoint | null;
    readonly initialValue:  { readonly name: string; readonly description: string };
}

//--------------------------------------------------------------------------------------------------
// Interface: PendingTransitionDialog
//
// Description:
//
//   Defines the structure of pending transition dialog.
//
//--------------------------------------------------------------------------------------------------

interface PendingTransitionDialog
{
    readonly draftTransitionId: number | null;
    readonly index:              number | null;
    readonly initialValue:       TransitionDefinition;
}

//--------------------------------------------------------------------------------------------------
// Interface: DraftEndpointDrag
//
// Description:
//
//   Defines the structure of draft endpoint drag.
//
//--------------------------------------------------------------------------------------------------

interface DraftEndpointDrag
{
    readonly draftTransitionId: number;
    readonly displayOffset:     ChartPoint;
    readonly endpoint:          "source" | "target";
    readonly pointerOffset:     ChartPoint;
    readonly pointerId:         number;
}

//--------------------------------------------------------------------------------------------------
// Interface: SemanticEndpointDrag
//
// Description:
//
//   Defines the structure of semantic endpoint drag.
//
//--------------------------------------------------------------------------------------------------

interface SemanticEndpointDrag
{
    readonly edgeIdentifier: string;
    readonly endpoint:       "source" | "target";
    readonly pointerId:      number;
}

//--------------------------------------------------------------------------------------------------
// Interface: SemanticEndpointPreview
//
// Description:
//
//   Defines the structure of semantic endpoint preview.
//
//--------------------------------------------------------------------------------------------------

interface SemanticEndpointPreview extends SemanticEndpointDrag
{
    readonly point: ChartPoint;
}

//--------------------------------------------------------------------------------------------------
// Interface: PendingViewportRestoration
//
// Description:
//
//   Defines the structure of pending viewport restoration.
//
//--------------------------------------------------------------------------------------------------

interface PendingViewportRestoration
{
    readonly documentRevision: number;
    readonly viewport:         Viewport;
}

//--------------------------------------------------------------------------------------------------
// Interface: ChartPageProperties
//
// Description:
//
//   Defines the properties accepted by the chart page interface.
//
//--------------------------------------------------------------------------------------------------

export interface ChartPageProperties
{
    readonly collapsedStateHeight?: number;
    readonly collapsedStateWidth?:  number;
    readonly deleteOrphanedChartItemsDuringAutomaticLayout?: boolean;
    readonly diagnostics:    readonly DomainDiagnostic[];
    readonly documentRevision: number;
    readonly draft:          AuthoringDraft | null;
    readonly expandedStateMinimumHeight?: number;
    readonly expandedStateWidth?: number;
    readonly gridSize?:      number;
    readonly layoutPort:     ChartLayoutPort;
    readonly nameWrapping:   ChartNameWrapping;
    readonly onCommand:      ( commandFactory: DocumentCommandFactory ) => boolean;
    readonly onInteractionError: ( message: string ) => void;
    readonly onNew:          () => void;
    readonly onSaveAsImage?: ( canvas: HTMLElement ) => Promise<void> | void;
    readonly onSceneReady?:  ( canvas: HTMLElement ) => void;
    readonly onLayoutDiagnostic?: ( message: string ) => void;
    readonly onRoutingDiagnostic?: ( message: string ) => void;
    readonly onSelectionCountChange?: ( count: number ) => void;
    readonly routingPort?:   ChartRoutingPort;
    readonly gridColor?:     string;
    readonly gridStyle?:     ChartGridStyle;
    readonly showGrid?:      boolean;
    readonly snapToGrid?:    boolean;
    readonly selfTransitionLoopAspect?:    number;
    readonly selfTransitionLoopExtension?: number;
    readonly selfTransitionLoopSpacing?:   number;
    readonly minimumStateDistance?: number;
    readonly transitionArrowHeadSize?: number;
    readonly transitionGravityPointDistance?: number;
    readonly transitionLabelAlignment?: "Center" | "End" | "Start";
}

//--------------------------------------------------------------------------------------------------
// Interface: ChartCanvasProperties
//
// Description:
//
//   Defines the properties accepted by the chart canvas interface.
//
//--------------------------------------------------------------------------------------------------

interface ChartCanvasProperties extends ChartPageProperties
{
    readonly draft:                  AuthoringDraft;
    readonly initialViewport:        Viewport | null;
    readonly onAnnouncement:         ( message: string ) => void;
    readonly onFocusAfterRevision:   ( request: ChartFocusRequest | null ) => void;
    readonly onPreserveViewport:     ( viewport: Viewport | null ) => void;
    readonly onViewportRestored:     () => void;
}

const CHART_NODE_TYPES =
{
    draftTransition: StateChartDraftTransitionNodeComponent,
    indicator:       StateChartIndicatorNodeComponent,
    state:           StateChartStateNodeComponent,
};

const CHART_EDGE_TYPES =
{
    center: StateChartCenterEdgeComponent,
};

const CHART_ARIA_LABEL_CONFIG: Partial<AriaLabelConfig> =
{
    "edge.a11yDescription.default": text ( "chart.a11y.edgeDescription" ),
    "node.a11yDescription.ariaLiveMessage": ( { direction, x, y } ) =>
        `${text ( "chart.a11y.nodeMoved" )} ${direction}. X ${x}, Y ${y}.`,
    "node.a11yDescription.default": text ( "chart.a11y.nodeDescription" ),
    "node.a11yDescription.keyboardDisabled": text ( "chart.a11y.nodeDescription" ),
};

//--------------------------------------------------------------------------------------------------
// Function: stateNodeIdentifier
//
// Description:
//
//   Derives the state node identifier.
//
// Parameters:
//
//   - stateName:
//     The state name supplied to the operation.
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

function stateNodeIdentifier ( stateName: string ): string
{
    // Return the computed result.

    return `state:${encodeURIComponent ( stateName )}`;
}

//--------------------------------------------------------------------------------------------------
// Function: terminalIndicatorNodeIdentifier
//
// Description:
//
//   Derives the terminal indicator node identifier.
//
// Parameters:
//
//   - indicatorId:
//     The indicator identifier supplied to the operation.
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

function terminalIndicatorNodeIdentifier ( indicatorId: number ): string
{
    // Return the computed result.

    return `terminal:${indicatorId}`;
}

//--------------------------------------------------------------------------------------------------
// Function: draftTransitionNodeIdentifier
//
// Description:
//
//   Derives the draft transition node identifier.
//
// Parameters:
//
//   - draftTransitionId:
//     The draft transition identifier supplied to the operation.
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

function draftTransitionNodeIdentifier ( draftTransitionId: number ): string
{
    // Return the computed result.

    return `draft-transition:${draftTransitionId}`;
}

//--------------------------------------------------------------------------------------------------
// Function: draftEndpointFocusIdentifier
//
// Description:
//
//   Derives the draft endpoint focus identifier.
//
// Parameters:
//
//   - draftTransitionId:
//     The draft transition identifier supplied to the operation.
//
//   - endpoint:
//     The endpoint supplied to the operation.
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

function draftEndpointFocusIdentifier (
    draftTransitionId: number,
    endpoint: "source" | "target",
): string
{
    // Return the computed result.

    return `draft-endpoint:${draftTransitionId}:${endpoint}`;
}

//--------------------------------------------------------------------------------------------------
// Function: chartPointsApproximatelyEqual
//
// Description:
//
//   Derives the chart points approximately equal.
//
// Parameters:
//
//   - left:
//     The left supplied to the operation.
//
//   - right:
//     The right supplied to the operation.
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

function chartPointsApproximatelyEqual ( left: ChartPoint, right: ChartPoint ): boolean
{
    // Return the computed result.

    return Math.abs ( left.x - right.x ) < 0.5 && Math.abs ( left.y - right.y ) < 0.5;
}

//--------------------------------------------------------------------------------------------------
// Function: roundedRectangleContainsPoint
//
// Description:
//
//   Derives the rounded rectangle contains point.
//
// Parameters:
//
//   - point:
//     The point supplied to the operation.
//
//   - rectangle:
//     The rectangle supplied to the operation.
//
//   - requestedRadius:
//     The requested radius supplied to the operation.
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

function roundedRectangleContainsPoint (
    point: ChartPoint,
    rectangle: ChartRectangle,
    requestedRadius: number,
): boolean
{
    // Handle the case where at least one branch condition is satisfied.

    if ( point.x < rectangle.x || point.x > rectangle.x + rectangle.width ||
        point.y < rectangle.y || point.y > rectangle.y + rectangle.height )
    {
        // Return the computed result.

        return false;
    }

    // Initialize the local values needed by this operation.

    const radius               = Math.min ( requestedRadius, rectangle.width / 2, rectangle.height / 2 );
    const nearestCornerCenterX = Math.max (
        rectangle.x + radius,
        Math.min ( point.x, rectangle.x + rectangle.width - radius ),
    );
    const nearestCornerCenterY = Math.max (
        rectangle.y + radius,
        Math.min ( point.y, rectangle.y + rectangle.height - radius ),
    );
    const horizontalDistance = point.x - nearestCornerCenterX;
    const verticalDistance   = point.y - nearestCornerCenterY;

    // Return the computed result.

    return horizontalDistance * horizontalDistance + verticalDistance * verticalDistance <= radius * radius;
}

//--------------------------------------------------------------------------------------------------
// Function: endpointControlPoint
//
// Description:
//
//   Derives the endpoint control point.
//
// Parameters:
//
//   - source:
//     The source supplied to the operation.
//
//   - target:
//     The target supplied to the operation.
//
//   - endpoint:
//     The endpoint supplied to the operation.
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

function endpointControlPoint (
    source: ChartPoint,
    target: ChartPoint,
    endpoint: "source" | "target",
): ChartPoint
{
    // Initialize the local values needed by this operation.

    const horizontalDistance     = target.x - source.x;
    const verticalDistance       = target.y - source.y;
    const distance               = Math.hypot ( horizontalDistance, verticalDistance );
    const minimumControlDistance = 24;

    // Handle the case where distance is at least minimum control distance.

    if ( distance >= minimumControlDistance )
    {
        // Return the result selected by the current condition.

        return endpoint === "source" ? source : target;
    }

    // Initialize the local values needed by this operation.

    const normal = distance === 0
        ? { x: 1, y: 0 }
        : { x: -verticalDistance / distance, y: horizontalDistance / distance };
    const separation = Math.sqrt ( minimumControlDistance * minimumControlDistance - distance * distance ) / 2;
    const direction  = endpoint === "source" ? -1 : 1;
    const point      = endpoint === "source" ? source : target;

    // Return the assembled result.

    return {
        x: point.x + normal.x * separation * direction,
        y: point.y + normal.y * separation * direction,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: transitionEdgeIdentifier
//
// Description:
//
//   Derives the transition edge identifier.
//
// Parameters:
//
//   - stateName:
//     The state name supplied to the operation.
//
//   - eventName:
//     The event name supplied to the operation.
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

function transitionEdgeIdentifier ( stateName: string, eventName: string ): string
{
    // Return the computed result.

    return `transition:${encodeURIComponent ( stateName )}:${encodeURIComponent ( eventName )}`;
}

//--------------------------------------------------------------------------------------------------
// Function: transitionEndpointFocusIdentifier
//
// Description:
//
//   Derives the transition endpoint focus identifier.
//
// Parameters:
//
//   - edgeIdentifier:
//     The edge identifier supplied to the operation.
//
//   - endpoint:
//     The endpoint supplied to the operation.
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

function transitionEndpointFocusIdentifier (
    edgeIdentifier: string,
    endpoint: "source" | "target",
): string
{
    // Return the computed result.

    return `transition-endpoint:${edgeIdentifier}:${endpoint}`;
}

//--------------------------------------------------------------------------------------------------
// Function: draftTransitionNodeGeometry
//
// Description:
//
//   Derives the draft transition node geometry.
//
// Parameters:
//
//   - draftTransition:
//     The draft transition supplied to the operation.
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

function draftTransitionNodeGeometry ( draftTransition: ChartDraftTransition )
{
    // Initialize the local values needed by this operation.

    const naturalWidth = Math.abs ( draftTransition.target.x - draftTransition.source.x ) +
        CHART_DRAFT_TRANSITION_PADDING * 2;
    const naturalHeight = Math.abs ( draftTransition.target.y - draftTransition.source.y ) +
        CHART_DRAFT_TRANSITION_PADDING * 2;
    const width  = Math.max ( CHART_DRAFT_TRANSITION_MINIMUM_SIZE, naturalWidth );
    const height = Math.max ( CHART_DRAFT_TRANSITION_MINIMUM_SIZE, naturalHeight );
    const left   = Math.min ( draftTransition.source.x, draftTransition.target.x ) - CHART_DRAFT_TRANSITION_PADDING -
        ( width - naturalWidth ) / 2;
    const top = Math.min ( draftTransition.source.y, draftTransition.target.y ) - CHART_DRAFT_TRANSITION_PADDING -
        ( height - naturalHeight ) / 2;

    // Return the assembled result.

    return {
        height,
        origin: { x: left, y: top },
        source: { x: draftTransition.source.x - left, y: draftTransition.source.y - top },
        target: { x: draftTransition.target.x - left, y: draftTransition.target.y - top },
        width,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: draftTransitionFromNode
//
// Description:
//
//   Derives the draft transition from node.
//
// Parameters:
//
//   - node:
//     The node supplied to the operation.
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

function draftTransitionFromNode ( node: StateChartDraftTransitionNode ): ChartDraftTransition
{
    // Return the assembled result.

    return {
        id: node.data.draftTransitionId,
        source:
        {
            x: node.position.x + node.data.source.x,
            y: node.position.y + node.data.source.y,
        },
        target:
        {
            x: node.position.x + node.data.target.x,
            y: node.position.y + node.data.target.y,
        },
    };
}

//--------------------------------------------------------------------------------------------------
// Function: replaceDraftTransitionEndpoint
//
// Description:
//
//   Replaces the draft transition endpoint.
//
// Parameters:
//
//   - chartNodes:
//     The chart nodes supplied to the operation.
//
//   - draftTransitionId:
//     The draft transition identifier supplied to the operation.
//
//   - endpoint:
//     The endpoint supplied to the operation.
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

function replaceDraftTransitionEndpoint (
    chartNodes: readonly StateChartNode[],
    draftTransitionId: number,
    endpoint: "source" | "target",
    point: ChartPoint,
): StateChartNode[]
{
    // Return the mapped collection.

    return chartNodes.map ( node =>
    {
        // Handle the case where at least one branch condition is satisfied.

        if ( !isDraftTransitionNode ( node ) || node.data.draftTransitionId !== draftTransitionId )
        {
            // Return the node.

            return node;
        }

        // Initialize the local values needed by this operation.

        const draftTransition = draftTransitionFromNode ( node );
        const replacement     = endpoint === "source"
            ? { ...draftTransition, source: point }
            : { ...draftTransition, target: point };
        const geometry = draftTransitionNodeGeometry ( replacement );

        // Return the assembled result.

        return {
            ...node,
            position: geometry.origin,
            data:
            {
                ...node.data,
                origin: geometry.origin,
                source: geometry.source,
                target: geometry.target,
            },
            style: { ...node.style, height: geometry.height, width: geometry.width },
        };
    } );
}

//--------------------------------------------------------------------------------------------------
// Function: chartSidePoint
//
// Description:
//
//   Derives the chart side point.
//
// Parameters:
//
//   - rectangle:
//     The rectangle supplied to the operation.
//
//   - side:
//     The side supplied to the operation.
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

function chartSidePoint ( rectangle: ChartRectangle, side: ChartNodeSide ): ChartPoint
{
    // Handle the case where side matches the top value.

    if ( side === "top" )
    {
        // Return the assembled result.

        return { x: rectangle.x + rectangle.width / 2, y: rectangle.y };
    }

    // Handle the case where side matches the right value.

    if ( side === "right" )
    {
        // Return the assembled result.

        return { x: rectangle.x + rectangle.width, y: rectangle.y + rectangle.height / 2 };
    }

    // Handle the case where side matches the bottom value.

    if ( side === "bottom" )
    {
        // Return the assembled result.

        return { x: rectangle.x + rectangle.width / 2, y: rectangle.y + rectangle.height };
    }

    // Return the assembled result.

    return { x: rectangle.x, y: rectangle.y + rectangle.height / 2 };
}

//--------------------------------------------------------------------------------------------------
// Function: nearestChartConnectionSides
//
// Description:
//
//   Derives the nearest chart connection sides.
//
// Parameters:
//
//   - sourceRectangle:
//     The source rectangle supplied to the operation.
//
//   - targetRectangle:
//     The target rectangle supplied to the operation.
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

function nearestChartConnectionSides (
    sourceRectangle: ChartRectangle,
    targetRectangle: ChartRectangle,
): ChartTechnicalSides
{
    // Handle the case where all required conditions are satisfied.

    if ( sourceRectangle.x === targetRectangle.x && sourceRectangle.y === targetRectangle.y &&
        sourceRectangle.width === targetRectangle.width && sourceRectangle.height === targetRectangle.height )
    {
        // Return the assembled result.

        return { sourceSide: "right", targetSide: "top" };
    }

    // Initialize the local values needed by this operation.

    const sides: readonly ChartNodeSide[] = [ "top", "right", "bottom", "left" ];
    let nearestSides: ChartTechnicalSides = { sourceSide: "bottom", targetSide: "top" };
    let nearestDistanceSquared            = Number.POSITIVE_INFINITY;

    // Process each source side from the sides collection in order.

    for ( const sourceSide of sides )
    {
        // Initialize the local values needed by this operation.

        const sourcePoint = chartSidePoint ( sourceRectangle, sourceSide );

        // Process each target side from the sides collection in order.

        for ( const targetSide of sides )
        {
            // Initialize the local values needed by this operation.

            const targetPoint        = chartSidePoint ( targetRectangle, targetSide );
            const horizontalDistance = targetPoint.x - sourcePoint.x;
            const verticalDistance   = targetPoint.y - sourcePoint.y;
            const distanceSquared    = horizontalDistance * horizontalDistance + verticalDistance * verticalDistance;

            // Handle the case where distance squared is below nearest distance squared.

            if ( distanceSquared < nearestDistanceSquared )
            {
                nearestDistanceSquared = distanceSquared;
                nearestSides           = { sourceSide, targetSide };
            }
        }
    }

    // Return the nearest sides.

    return nearestSides;
}

//--------------------------------------------------------------------------------------------------
// Function: nextTerminalIndicatorIdentifier
//
// Description:
//
//   Advances the terminal indicator identifier.
//
// Parameters:
//
//   - indicators:
//     The indicators supplied to the operation.
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

function nextTerminalIndicatorIdentifier (
    indicators: AuthoringDraft[ "chart" ][ "indicators" ][ "terminalStateIndicators" ],
): number
{
    // Initialize the local values needed by this operation.

    const usedIdentifiers = new Set ( indicators.map ( indicator => indicator.id ) );

    // Repeat the operation across the bounded iteration range.

    for ( let identifier = 0; identifier <= usedIdentifiers.size; identifier += 1 )
    {
        // Handle the case where the has result condition is not satisfied.

        if ( !usedIdentifiers.has ( identifier ) )
        {
            // Return the identifier.

            return identifier;
        }
    }

    // Return the computed result.

    return usedIdentifiers.size;
}

//--------------------------------------------------------------------------------------------------
// Function: nextDraftTransitionIdentifier
//
// Description:
//
//   Advances the draft transition identifier.
//
// Parameters:
//
//   - draftTransitions:
//     The draft transitions supplied to the operation.
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

function nextDraftTransitionIdentifier ( draftTransitions: readonly ChartDraftTransition[] ): number
{
    // Initialize the local values needed by this operation.

    const usedIdentifiers = new Set ( draftTransitions.map ( draftTransition => draftTransition.id ) );

    // Repeat the operation across the bounded iteration range.

    for ( let identifier = 0; identifier <= usedIdentifiers.size; identifier += 1 )
    {
        // Handle the case where the has result condition is not satisfied.

        if ( !usedIdentifiers.has ( identifier ) )
        {
            // Return the identifier.

            return identifier;
        }
    }

    // Return the computed result.

    return usedIdentifiers.size;
}

//--------------------------------------------------------------------------------------------------
// Function: nextGeneratedStateName
//
// Description:
//
//   Advances the generated state name.
//
// Parameters:
//
//   - states:
//     The states supplied to the operation.
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

function nextGeneratedStateName ( states: AuthoringDraft[ "stateMachine" ][ "states" ] ): string
{
    // Initialize the local values needed by this operation.

    const usedNames = new Set ( states.map ( state => state.name ) );

    // Repeat the operation across the bounded iteration range.

    for ( let suffix = 1; suffix <= usedNames.size + 1; suffix += 1 )
    {
        // Initialize the local values needed by this operation.

        const candidateName = `state_${suffix}`;

        // Handle the case where the has result condition is not satisfied.

        if ( !usedNames.has ( candidateName ) )
        {
            // Return the candidate name.

            return candidateName;
        }
    }

    // Return the computed result.

    return `state_${usedNames.size + 1}`;
}

//--------------------------------------------------------------------------------------------------
// Function: createFlowNodes
//
// Description:
//
//   Creates flow nodes.
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
//   - transitionArrowHeadSize:
//     The transition arrow head size supplied to the operation.
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

function createFlowNodes (
    draft: AuthoringDraft,
    diagnostics: readonly DomainDiagnostic[],
    nameWrapping: ChartNameWrapping,
    stateSize: ChartStateSizePreferences,
    transitionArrowHeadSize = DEFAULT_CHART_SETTINGS.transitionArrowHeadSize,
): StateChartNode[]
{
    // Initialize the local values needed by this operation.

    const projection                        = createAuthoringChartProjection ( draft, diagnostics, nameWrapping, stateSize );
    const stateNodes: StateChartStateNode[] = projection.states.map ( state => ( {
        id: stateNodeIdentifier ( state.name ),
        type: "state",
        position: { x: state.x, y: state.y },
        data: { viewModel: state },
        initialHeight: state.height,
        initialWidth: state.width,
        draggable: true,
        focusable: true,
        selectable: true,
        zIndex: 2,
        ariaRole: "button",
        ariaLabel: `${text ( "chart.node.state" )} ${state.name}. ` +
            `${state.isInitial ? text ( "chart.state.initial" ) + ". " : ""}` +
            `${state.validationStatus === "passed" ? text ( "chart.validation.passed" ) :
                state.validationStatus === "warning" ? text ( "chart.validation.warning" ) : text ( "chart.validation.error" )}. ` +
            chartStateHeightDescription ( state.height, state.savedHeight, state.minimumHeight ),
        style: { height: state.height, width: state.width },
    } ) );
    const initialNode: StateChartIndicatorNode[] = projection.initialIndicator === null
        ? []
        : [ {
            id: "initial-indicator",
            type: "indicator",
            position: { x: projection.initialIndicator.x, y: projection.initialIndicator.y },
            data: { indicatorId: null, kind: "initial", label: text ( "chart.indicator.initial" ) },
            initialHeight: CHART_INDICATOR_SIZE,
            initialWidth: CHART_INDICATOR_SIZE,
            draggable: true,
            focusable: true,
            selectable: true,
            zIndex: 2,
            ariaLabel: text ( "chart.indicator.initial" ),
            style: { height: CHART_INDICATOR_SIZE, width: CHART_INDICATOR_SIZE },
        } ];
    const terminalNodes: StateChartIndicatorNode[] = projection.terminalIndicators.flatMap ( indicator =>
        indicator.id === null ? [] : [ {
            id: terminalIndicatorNodeIdentifier ( indicator.id ),
            type: "indicator" as const,
            position: { x: indicator.x, y: indicator.y },
            data:
            {
                indicatorId: indicator.id,
                kind:        "terminal" as const,
                label:       `${text ( "chart.indicator.terminal" )} ${indicator.id}`,
            },
            initialHeight: CHART_INDICATOR_SIZE,
            initialWidth: CHART_INDICATOR_SIZE,
            draggable: true,
            focusable: true,
            selectable: true,
            zIndex: 2,
            ariaLabel: `${text ( "chart.indicator.terminal" )} ${indicator.id}. ` +
                text ( "chart.indicator.terminalInstruction" ),
            ariaRole: "button",
            style: { height: CHART_INDICATOR_SIZE, width: CHART_INDICATOR_SIZE },
        } ] );
    const draftTransitionNodes: StateChartDraftTransitionNode[] = draft.chart.draftTransitions.map ( draftTransition =>
    {
        // Initialize the local values needed by this operation.

        const geometry = draftTransitionNodeGeometry ( draftTransition );

        // Return the assembled result.

        return {
            id: draftTransitionNodeIdentifier ( draftTransition.id ),
            type: "draftTransition" as const,
            position: geometry.origin,
            data:
            {
                draftTransitionId: draftTransition.id,
                label: `${text ( "chart.draftTransition" )} ${draftTransition.id}`,
                origin: geometry.origin,
                source: geometry.source,
                target: geometry.target,
                transitionArrowHeadSize,
            },
            initialHeight: geometry.height,
            initialWidth: geometry.width,
            draggable: true,
            focusable: true,
            selectable: true,
            zIndex: 0,
            ariaLabel: `${text ( "chart.draftTransition" )} ${draftTransition.id}. ` +
                text ( "chart.draftTransition.instruction" ),
            ariaRole: "button",
            style: { height: geometry.height, width: geometry.width },
        };
    } );

    // Return the assembled result collection.

    return [ ...initialNode, ...stateNodes, ...terminalNodes, ...draftTransitionNodes ];
}

//--------------------------------------------------------------------------------------------------
// Function: chartStateHeightDescription
//
// Description:
//
//   Derives the chart state height description.
//
// Parameters:
//
//   - effectiveHeight:
//     The effective height supplied to the operation.
//
//   - savedHeight:
//     The saved height supplied to the operation.
//
//   - minimumHeight:
//     The minimum height supplied to the operation.
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

function chartStateHeightDescription ( effectiveHeight: number, savedHeight: number, minimumHeight: number ): string
{
    // Return the computed result.

    return `${text ( "chart.announcement.effectiveHeight" )}: ${effectiveHeight} ` +
        `${text ( "chart.announcement.pixels" )}. ` +
        `${text ( "chart.announcement.savedHeight" )}: ${savedHeight} ` +
        `${text ( "chart.announcement.pixels" )}. ` +
        `${text ( "chart.announcement.minimumHeight" )}: ${minimumHeight} ` +
        `${text ( "chart.announcement.pixels" )}.`;
}

const CHART_GRID_DOT_SIZE = 1;

// React Flow shifts its background pattern by half a cell whenever the `offset` prop is left at its
// default of zero: its scaled offset reads `offsetXY[0] * transform[2] || 1 + patternDimensions[0]
// / 2`, and a zero offset is falsy, so the `||` falls through to the half-cell branch. Dots then
// land in the middle of each cell rather than on its corners, which is why a correctly snapped
// state never lined up with one. Passing a non-zero offset bypasses that branch, and the value that
// puts the pattern exactly on the grid differs by variant: a dot is drawn at its own radius from
// the cell corner, while the line pair is drawn through the cell centre.

//--------------------------------------------------------------------------------------------------
// Function: chartGridPatternOffset
//
// Description:
//
//   Derives the chart grid pattern offset.
//
// Parameters:
//
//   - gridStyle:
//     The grid style supplied to the operation.
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

function chartGridPatternOffset ( gridStyle: ChartGridStyle, gridSize: number ): number
{
    // Return the result selected by the current condition.

    return gridStyle === "Dots" ? CHART_GRID_DOT_SIZE / 2 : gridSize / 2;
}

//--------------------------------------------------------------------------------------------------
// Function: chartGridClassName
//
// Description:
//
//   Derives the chart grid class name.
//
// Parameters:
//
//   - gridStyle:
//     The grid style supplied to the operation.
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

function chartGridClassName ( gridStyle: ChartGridStyle ): string
{
    // Return the computed result.

    return `chart-grid chart-grid-${gridStyle.toLocaleLowerCase ( "en" )}`;
}

//--------------------------------------------------------------------------------------------------
// Function: chartNodeRectangle
//
// Description:
//
//   Derives the chart node rectangle.
//
// Parameters:
//
//   - node:
//     The node supplied to the operation.
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

function chartNodeRectangle ( node: StateChartNode ): ChartRectangle
{
    // Return the assembled result.

    return {
        x: node.position.x,
        y: node.position.y,
        width: isStateNode ( node ) ? node.data.viewModel.width : CHART_INDICATOR_SIZE,
        height: isStateNode ( node ) ? node.data.viewModel.height : CHART_INDICATOR_SIZE,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: chartNodeBoundary
//
// Description:
//
//   Derives the chart node boundary.
//
// Parameters:
//
//   - node:
//     The node supplied to the operation.
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

function chartNodeBoundary ( node: StateChartNode ): ChartNodeBoundary
{
    // Handle the case where is state node result is enabled.

    if ( isStateNode ( node ) )
    {
        // Return the assembled result.

        return {
            cornerRadius: 10,
            height: node.data.viewModel.height,
            kind:   "rectangle",
            radius: 0,
            width:  node.data.viewModel.width,
        };
    }

    // Return the assembled result.

    return {
        cornerRadius: 0,
        height: CHART_INDICATOR_SIZE,
        kind:   "circle",
        radius: isIndicatorNode ( node ) && node.data.kind === "initial" ? 12 : 16,
        width:  CHART_INDICATOR_SIZE,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: chartRectangleCenter
//
// Description:
//
//   Derives the chart rectangle center.
//
// Parameters:
//
//   - rectangle:
//     The rectangle supplied to the operation.
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

function chartRectangleCenter ( rectangle: ChartRectangle ): ChartPoint
{
    // Return the assembled result.

    return {
        x: rectangle.x + rectangle.width / 2,
        y: rectangle.y + rectangle.height / 2,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: chartRectanglesIntersect
//
// Description:
//
//   Derives the chart rectangles intersect.
//
// Parameters:
//
//   - left:
//     The left supplied to the operation.
//
//   - right:
//     The right supplied to the operation.
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

function chartRectanglesIntersect ( left: ChartRectangle, right: ChartRectangle ): boolean
{
    // Return the computed result.

    return left.x < right.x + right.width && left.x + left.width > right.x &&
        left.y < right.y + right.height && left.y + left.height > right.y;
}

//--------------------------------------------------------------------------------------------------
// Function: chartRectangleContainsPoint
//
// Description:
//
//   Derives the chart rectangle contains point.
//
// Parameters:
//
//   - rectangle:
//     The rectangle supplied to the operation.
//
//   - point:
//     The point supplied to the operation.
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

function chartRectangleContainsPoint ( rectangle: ChartRectangle, point: ChartPoint ): boolean
{
    // Return the computed result.

    return point.x > rectangle.x && point.x < rectangle.x + rectangle.width &&
        point.y > rectangle.y && point.y < rectangle.y + rectangle.height;
}

//--------------------------------------------------------------------------------------------------
// Function: semanticEdgeGeometry
//
// Description:
//
//   Derives the semantic edge geometry.
//
// Parameters:
//
//   - edge:
//     The edge supplied to the operation.
//
//   - chartNodes:
//     The chart nodes supplied to the operation.
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

function semanticEdgeGeometry (
    edge: StateChartEdge,
    chartNodes: readonly StateChartNode[],
): ReturnType<typeof calculateCenterRoutedEdgeGeometryFromCenters> | null
{
    // Handle the case where kind differs from the transition value.

    if ( edge.data?.kind !== "transition" )
    {
        // Return the computed result.

        return null;
    }

    // Initialize the local values needed by this operation.

    const sourceNode = chartNodes.find ( node => node.id === edge.source && isStateNode ( node ) );
    const targetNode = chartNodes.find ( node => node.id === edge.target && isStateNode ( node ) );

    // Handle the case where at least one branch condition is satisfied.

    if ( sourceNode === undefined || targetNode === undefined )
    {
        // Return the computed result.

        return null;
    }

    // Return the calculate center routed edge geometry from centers result.

    return calculateCenterRoutedEdgeGeometryFromCenters (
        chartRectangleCenter ( chartNodeRectangle ( sourceNode ) ),
        chartRectangleCenter ( chartNodeRectangle ( targetNode ) ),
        edge.data,
    );
}

//--------------------------------------------------------------------------------------------------
// Interface: ConfiguredRelationDebugGeometry
//
// Description:
//
//   Defines the structure of configured relation debug geometry.
//
//--------------------------------------------------------------------------------------------------

interface ConfiguredRelationDebugGeometry
{
    readonly sourceCenter: ChartPoint;
    readonly sourceEdge:   ChartPoint;
    readonly targetCenter: ChartPoint;
    readonly targetEdge:   ChartPoint;
}

//--------------------------------------------------------------------------------------------------
// Function: configuredRelationDebugGeometry
//
// Description:
//
//   Derives the configured relation debug geometry.
//
// Parameters:
//
//   - edge:
//     The edge supplied to the operation.
//
//   - chartNodes:
//     The chart nodes supplied to the operation.
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

function configuredRelationDebugGeometry (
    edge: StateChartEdge,
    chartNodes: readonly StateChartNode[],
): ConfiguredRelationDebugGeometry | null
{
    // Handle the case where edge data matches undefined.

    if ( edge.data === undefined )
    {
        // Return the computed result.

        return null;
    }

    // Initialize the local values needed by this operation.

    const sourceNode = chartNodes.find ( node => node.id === edge.source && !isDraftTransitionNode ( node ) );
    const targetNode = chartNodes.find ( node => node.id === edge.target && !isDraftTransitionNode ( node ) );

    // Handle the case where at least one branch condition is satisfied.

    if ( sourceNode === undefined || targetNode === undefined )
    {
        // Return the computed result.

        return null;
    }

    // Initialize the local values needed by this operation.

    const sourceCenter      = chartRectangleCenter ( chartNodeRectangle ( sourceNode ) );
    const targetCenter      = chartRectangleCenter ( chartNodeRectangle ( targetNode ) );
    const immediateGeometry = calculateCenterRoutedEdgeGeometryFromCenters (
        sourceCenter,
        targetCenter,
        edge.data,
    );

    // Return the assembled result.

    return {
        sourceCenter,
        sourceEdge: immediateGeometry.source,
        targetCenter,
        targetEdge: immediateGeometry.target,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: routingRelationForEdge
//
// Description:
//
//   Derives the routing relation for edge.
//
// Parameters:
//
//   - edge:
//     The edge supplied to the operation.
//
//   - chartNodes:
//     The chart nodes supplied to the operation.
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

function routingRelationForEdge (
    edge: StateChartEdge,
    chartNodes: readonly StateChartNode[],
): ChartRoutingRelation | null
{
    // Handle the case where edge data matches undefined.

    if ( edge.data === undefined )
    {
        // Return the computed result.

        return null;
    }

    // Initialize the local values needed by this operation.

    const sourceNode = chartNodes.find ( node => node.id === edge.source );
    const targetNode = chartNodes.find ( node => node.id === edge.target );

    // Handle the case where at least one branch condition is satisfied.

    if ( sourceNode === undefined || targetNode === undefined )
    {
        // Return the computed result.

        return null;
    }

    // Return the create chart routing relation result.

    return createChartRoutingRelation (
        edge.id,
        typeof edge.label === "string" ? edge.label : "",
        chartRectangleCenter ( chartNodeRectangle ( sourceNode ) ),
        chartRectangleCenter ( chartNodeRectangle ( targetNode ) ),
        edge.data,
    );
}

//--------------------------------------------------------------------------------------------------
// Function: routingRelationForDraft
//
// Description:
//
//   Derives the routing relation for draft.
//
// Parameters:
//
//   - node:
//     The node supplied to the operation.
//
//   - chartNodes:
//     The chart nodes supplied to the operation.
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

function routingRelationForDraft (
    node: StateChartDraftTransitionNode,
    chartNodes: readonly StateChartNode[],
): ChartRoutingRelation
{
    // Initialize the local values needed by this operation.

    const transition = draftTransitionFromNode ( node );
    const obstacles  = chartNodes.flatMap ( obstacleNode =>
    {
        // Handle the case where is draft transition node result is enabled.

        if ( isDraftTransitionNode ( obstacleNode ) )
        {
            // Return the assembled result collection.

            return [];
        }

        const rectangle = chartNodeRectangle ( obstacleNode );

        // Return the result selected by the current condition.

        return chartRectangleContainsPoint ( rectangle, transition.source ) ||
            chartRectangleContainsPoint ( rectangle, transition.target )
            ? []
            : [ rectangle ];
    } );

    // Return the assembled result.

    return {
        identifier: node.id,
        labelHeight: 0,
        labelObstacles: obstacles,
        labelPosition: 0.5,
        labelWidth: 0,
        obstacles,
        preferredPoints: [ transition.source, transition.target ],
        preservePreferred: false,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: transitionPairIdentifier
//
// Description:
//
//   Derives the transition pair identifier.
//
// Parameters:
//
//   - sourceState:
//     The source state supplied to the operation.
//
//   - targetState:
//     The target state supplied to the operation.
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

function transitionPairIdentifier ( sourceState: string, targetState: string ): string
{
    // Return the stringify result.

    return JSON.stringify ( [ sourceState, targetState ].sort ( compareChartNames ) );
}

//--------------------------------------------------------------------------------------------------
// Function: compareChartNames
//
// Description:
//
//   Compares chart names.
//
// Parameters:
//
//   - left:
//     The left supplied to the operation.
//
//   - right:
//     The right supplied to the operation.
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

function compareChartNames ( left: string, right: string ): number
{
    // Return the result selected by the current condition.

    return left < right ? -1 : left > right ? 1 : 0;
}

//--------------------------------------------------------------------------------------------------
// Function: chartPreferenceRevision
//
// Description:
//
//   Derives the chart preference revision.
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

function chartPreferenceRevision ( properties: {
    readonly collapsedStateHeight: number | undefined;
    readonly collapsedStateWidth: number | undefined;
    readonly expandedStateMinimumHeight: number | undefined;
    readonly expandedStateWidth: number | undefined;
    readonly gridSize: number | undefined;
    readonly selfTransitionLoopAspect: number | undefined;
    readonly selfTransitionLoopExtension: number | undefined;
    readonly selfTransitionLoopSpacing: number | undefined;
    readonly transitionGravityPointDistance: number | undefined;
    readonly transitionLabelAlignment: "Center" | "End" | "Start" | undefined;
} ): number
{
    // Initialize the local values needed by this operation.

    const serialized = JSON.stringify ( [
        properties.collapsedStateHeight ?? DEFAULT_CHART_STATE_HEIGHT,
        properties.collapsedStateWidth ?? DEFAULT_CHART_SETTINGS.collapsedStateWidth,
        properties.expandedStateMinimumHeight ?? DEFAULT_CHART_STATE_HEIGHT,
        properties.expandedStateWidth ?? DEFAULT_CHART_SETTINGS.expandedStateWidth,
        properties.gridSize ?? DEFAULT_CHART_SETTINGS.gridSize,
        properties.selfTransitionLoopAspect ?? DEFAULT_CHART_SETTINGS.selfTransitionLoopAspect,
        properties.selfTransitionLoopExtension ?? DEFAULT_CHART_SETTINGS.selfTransitionLoopExtension,
        properties.selfTransitionLoopSpacing ?? DEFAULT_CHART_SETTINGS.selfTransitionLoopSpacing,
        properties.transitionGravityPointDistance ??
            DEFAULT_CHART_SETTINGS.transitionGravityPointDistance,
        properties.transitionLabelAlignment ?? DEFAULT_CHART_SETTINGS.transitionLabelAlignment,
    ] );
    let revision = 0;

    // Process each character from the serialized collection in order.

    for ( const character of serialized )
    {
        revision = ( revision * 31 + character.codePointAt ( 0 )! ) >>> 0;
    }

    // Return the revision.

    return revision;
}

// Resolves the elliptical loop of every self-transition. One edge and one aspect ratio are chosen
// per state, so the loops on that state nest without intersecting.

//--------------------------------------------------------------------------------------------------
// Function: resolveSelfTransitionLoops
//
// Description:
//
//   Resolves self transition loops.
//
// Parameters:
//
//   - draft:
//     The draft supplied to the operation.
//
//   - nameWrapping:
//     The name wrapping supplied to the operation.
//
//   - flowNodes:
//     The flow nodes supplied to the operation.
//
//   - stateNodesByName:
//     The state nodes by name supplied to the operation.
//
//   - selfTransitionIndices:
//     The self transition indices supplied to the operation.
//
//   - preferences:
//     The preferences supplied to the operation.
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

function resolveSelfTransitionLoops (
    draft: AuthoringDraft,
    nameWrapping: ChartNameWrapping,
    flowNodes: readonly StateChartNode[],
    stateNodesByName: ReadonlyMap<string, StateChartNode>,
    selfTransitionIndices: ReadonlyMap<string, readonly number[]>,
    preferences: ChartSelfTransitionLoopPreferences,
): Map<number, ChartSelfTransitionLoopGeometry>
{
    // Initialize the local values needed by this operation.

    const resolved = new Map<number, ChartSelfTransitionLoopGeometry> ();

    // Handle the case where self transition indices size equals 0.

    if ( selfTransitionIndices.size === 0 )
    {
        // Return the resolved.

        return resolved;
    }

    const obstacleNodes = flowNodes.filter ( node => !isDraftTransitionNode ( node ) );

    selfTransitionIndices.forEach ( ( transitionIndices, stateName ) =>
    {
        // Initialize the local values needed by this operation.

        const stateNode = stateNodesByName.get ( stateName );

        // Handle the case where state node matches undefined.

        if ( stateNode === undefined )
        {
            // Return control to the caller.

            return;
        }

        // Initialize the local values needed by this operation.

        const stateRectangle                                      = chartNodeRectangle ( stateNode );
        const stateGeometry: ChartSelfTransitionLoopStateGeometry = 
        {
            center:       chartRectangleCenter ( stateRectangle ),
            cornerRadius: CHART_STATE_CORNER_RADIUS,
            height:       stateRectangle.height,
            width:        stateRectangle.width,
        };
        const attachedSideCounts = { bottom: 0, left: 0, right: 0, top: 0 };

        draft.stateMachine.transitionTable.forEach ( transition =>
        {
            // Handle the case where transition state matches transition state next.

            if ( transition.state === transition.stateNext )
            {
                // Return control to the caller.

                return;
            }

            // Initialize the local values needed by this operation.

            const otherName = transition.state === stateName
                ? transition.stateNext
                : transition.stateNext === stateName ? transition.state : null;
            const otherNode = otherName === null ? undefined : stateNodesByName.get ( otherName );

            // Handle the case where other node matches undefined.

            if ( otherNode === undefined )
            {
                // Return control to the caller.

                return;
            }

            const sides = nearestChartConnectionSides ( stateRectangle, chartNodeRectangle ( otherNode ) );

            attachedSideCounts [ sides.sourceSide ] += 1;
        } );

        const indicatorRelationTargets = [
            ...( draft.chart.indicators.initialStateIndicator !== null &&
                ( draft.chart.indicators.initialStateIndicator.state ?? draft.stateMachine.initialState ) === stateName
                ? flowNodes.filter ( node => node.id === "initial-indicator" )
                : [] ),
            ...draft.chart.indicators.terminalStateTransitions.flatMap ( relation =>
                relation.state === stateName
                    ? flowNodes.filter ( node =>
                        node.id === terminalIndicatorNodeIdentifier ( relation.terminalStateIndicatorId ) )
                    : [] ),
        ];

        indicatorRelationTargets.forEach ( indicatorNode =>
        {
            // Initialize the local values needed by this operation.

            const sides = nearestChartConnectionSides ( stateRectangle, chartNodeRectangle ( indicatorNode ) );

            attachedSideCounts [ sides.sourceSide ] += 1;
        } );

        // Initialize the local values needed by this operation.

        const labelAllowances = transitionIndices.map ( transitionIndex =>
        {
            // Initialize the local values needed by this operation.

            const transition = draft.stateMachine.transitionTable [ transitionIndex ];
            const label      = transition === undefined
                ? ""
                : wrapChartName ( transition.event, nameWrapping.eventNames ).join ( "\n" );
            const size = transitionLabelSize ( label );

            // Return the computed result.

            return Math.max ( size.labelWidth, size.labelHeight ) + CHART_ROUTE_CLEARANCE * 2;
        } );

        // A loop's length depends on the half extent of the edge it sits on, so the edge is chosen
        // first and the axis series is then resolved for that edge. The selection evaluates each
        // candidate side's own reach.

        const neighbourObstacles = obstacleNodes.flatMap ( node =>
            node.id === stateNode.id ? [] : [ chartNodeRectangle ( node ) ] );
        const side = selectSelfTransitionLoopSide (
            stateGeometry,
            attachedSideCounts,
            neighbourObstacles,
            preferences,
            labelAllowances,
        );
        const majorSemiAxes      = selfTransitionLoopMajorSemiAxes (
            stateGeometry,
            side,
            preferences,
            labelAllowances,
        );
        const outerMajorSemiAxis = majorSemiAxes.at ( -1 ) ?? 0;
        const aspectRatio        = selfTransitionLoopAspectRatio (
            stateGeometry,
            side,
            preferences,
            outerMajorSemiAxis,
        );

        transitionIndices.forEach ( ( transitionIndex, loopIndex ) =>
        {
            resolved.set ( transitionIndex, selfTransitionLoopGeometry (
                stateGeometry,
                side,
                aspectRatio,
                majorSemiAxes [ loopIndex ] ?? outerMajorSemiAxis,
            ) );
        } );
    } );

    // Return the resolved.

    return resolved;
}

//--------------------------------------------------------------------------------------------------
// Function: createFlowEdges
//
// Description:
//
//   Creates flow edges.
//
// Parameters:
//
//   - draft:
//     The draft supplied to the operation.
//
//   - nameWrapping:
//     The name wrapping supplied to the operation.
//
//   - flowNodes:
//     The flow nodes supplied to the operation.
//
//   - transitionGravityPointDistance:
//     The transition gravity point distance supplied to the operation.
//
//   - transitionLabelAlignment:
//     The transition label alignment supplied to the operation.
//
//   - selfTransitionLoopPreferences:
//     The self transition loop preferences supplied to the operation.
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

function createFlowEdges (
    draft: AuthoringDraft,
    nameWrapping: ChartNameWrapping,
    flowNodes: readonly StateChartNode[],
    transitionGravityPointDistance = DEFAULT_CHART_SETTINGS.transitionGravityPointDistance,
    transitionLabelAlignment: "Center" | "End" | "Start" = DEFAULT_CHART_SETTINGS.transitionLabelAlignment,
    selfTransitionLoopPreferences: ChartSelfTransitionLoopPreferences = DEFAULT_SELF_TRANSITION_LOOP_PREFERENCES,
): StateChartEdge[]
{
    // Initialize the local values needed by this operation.

    const transitionLabelPosition = transitionLabelAlignment === "Start"
        ? TRANSITION_LABEL_ALIGNMENT_FRACTIONS.start
        : transitionLabelAlignment === "End"
            ? TRANSITION_LABEL_ALIGNMENT_FRACTIONS.end
            : TRANSITION_LABEL_ALIGNMENT_FRACTIONS.center;
    const nodeObstacles = flowNodes.flatMap ( node =>
        isDraftTransitionNode ( node ) ? [] : [ chartNodeRectangle ( node ) ] );
    const placedStateNames = new Set ( draft.stateMachine.states.map ( state => state.name ) );
    const stateNodesByName = new Map ( flowNodes.flatMap ( node =>
        isStateNode ( node ) ? [ [ node.data.viewModel.name, node ] as const ] : [] ) );
    const terminalIndicatorIds = new Set (
        draft.chart.indicators.terminalStateIndicators.map ( indicator => indicator.id ),
    );
    const parallelTransitionIndices = new Map<string, number[]> ();
    const selfTransitionIndices     = new Map<string, number[]> ();

    draft.stateMachine.transitionTable.forEach ( ( transition, index ) =>
    {
        // Initialize the local values needed by this operation.

        const indexMap = transition.state === transition.stateNext
            ? selfTransitionIndices
            : parallelTransitionIndices;
        const identifier = transition.state === transition.stateNext
            ? transition.state
            : transitionPairIdentifier ( transition.state, transition.stateNext );
        const indices = indexMap.get ( identifier ) ?? [];

        indices.push ( index );
        indexMap.set ( identifier, indices );
    } );

    // Self-transitions resolve before the routing request so their loops can act as ordinary
    // obstacles for every unrelated relation, even though the loops themselves are preserved and
    // are never worker-searched.

    const selfTransitionLoopGeometries = resolveSelfTransitionLoops (
        draft,
        nameWrapping,
        flowNodes,
        stateNodesByName,
        selfTransitionIndices,
        selfTransitionLoopPreferences,
    );
    // A self-transition loop is never an obstacle, for routes or for labels. Its bounding rectangle
    // encloses an arc whose interior is empty, so it overstates the drawn geometry by roughly an
    // order of magnitude. More seriously, ordinary relations attach at state centers and
    // buildVisibilityGraph discards any lattice point lying inside an obstacle: a loop rectangle
    // reaching a neighbouring state's center removed that relation's own endpoint, returned a null
    // graph, and forced every transition incident on that neighbour into fallback. Measured
    // fallback counts equalled endpoint-capture counts exactly, while route-versus-loop crossings
    // were unchanged by publication. This exclusion prevents presentation-only loop bounds from
    // invalidating otherwise safe ordinary routes.

    const allOrthogonalObstacles = nodeObstacles;

    //----------------------------------------------------------------------------------------------
    // Function: orthogonalObstacles
    //
    // Description:
    //
    //   Derives the orthogonal obstacles.
    //
    // Parameters:
    //
    //   - sourceIdentifier:
    //     The source identifier supplied to the operation.
    //
    //   - targetIdentifier:
    //     The target identifier supplied to the operation.
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

    const orthogonalObstacles = ( sourceIdentifier: string, targetIdentifier: string ):
        readonly ChartOrthogonalObstacle[] =>
        flowNodes.flatMap ( node =>
            node.id === sourceIdentifier || node.id === targetIdentifier || isDraftTransitionNode ( node )
                ? []
                : [ chartNodeRectangle ( node ) ] );
    const transitionEdges: StateChartEdge[] = draft.stateMachine.transitionTable.flatMap ( ( transition, index ) =>
        !placedStateNames.has ( transition.state ) || !placedStateNames.has ( transition.stateNext )
            ? []
            : ( () =>
            {
                // Initialize the local values needed by this operation.

                const sourceNode = stateNodesByName.get ( transition.state );
                const targetNode = stateNodesByName.get ( transition.stateNext );

                // Handle the case where at least one branch condition is satisfied.

                if ( sourceNode === undefined || targetNode === undefined )
                {
                    // Return the assembled result collection.

                    return [];
                }

                // Initialize the local values needed by this operation.

                const selfTransition   = transition.state === transition.stateNext;
                const selfIndices      = selfTransitionIndices.get ( transition.state ) ?? [ index ];
                const selfLoopIndex    = selfTransition ? Math.max ( 0, selfIndices.indexOf ( index ) ) : null;
                const selfLoopGeometry = selfTransitionLoopGeometries.get ( index );
                const connectionSides  = selfLoopGeometry === undefined
                    ? nearestChartConnectionSides ( chartNodeRectangle ( sourceNode ), chartNodeRectangle ( targetNode ) )
                    : { sourceSide: selfLoopGeometry.side, targetSide: selfLoopGeometry.side };
                const parallelIndices = selfTransition
                    ? [ index ]
                    : parallelTransitionIndices.get (
                        transitionPairIdentifier ( transition.state, transition.stateNext ),
                    ) ?? [ index ];
                const parallelIndex = Math.max ( 0, parallelIndices.indexOf ( index ) );

                // Return the assembled result collection.

                return [ {
                    id: transitionEdgeIdentifier ( transition.state, transition.event ),
                    source: stateNodeIdentifier ( transition.state ),
                    sourceHandle: connectionSides.sourceSide,
                    target: stateNodeIdentifier ( transition.stateNext ),
                    targetHandle: connectionSides.targetSide,
                    type: "center" as const,
                    markerEnd: TRANSITION_ARROW_MARKER_END,
                    label: wrapChartName ( transition.event, nameWrapping.eventNames ).join ( "\n" ),
                    className: "chart-transition-edge",
                    data:
                    {
                        kind: "transition" as const,
                        transitionIndex: index,
                        state: transition.state,
                        stateNext: transition.stateNext,
                        event: transition.event,
                        canonicalDirectionSign: compareChartNames ( transition.state, transition.stateNext ) <= 0 ? 1 : -1,
                        parallelLaneCount: parallelIndices.length,
                        parallelLanePosition: parallelIndex - ( parallelIndices.length - 1 ) / 2,
                        orthogonalObstacles: orthogonalObstacles ( sourceNode.id, targetNode.id ),
                        orthogonalLabelObstacles: allOrthogonalObstacles,
                        selfLoopIndex,
                        ...( selfLoopGeometry === undefined ? {} : { selfLoopGeometry } ),
                        sourceBoundary: chartNodeBoundary ( sourceNode ),
                        sourceTechnicalSide: connectionSides.sourceSide,
                        targetBoundary: chartNodeBoundary ( targetNode ),
                        targetTechnicalSide: connectionSides.targetSide,
                        transitionGravityPointDistance,
                        transitionLabelPosition,
                    },
                    focusable: true,
                    reconnectable: false,
                    selectable: true,
                    zIndex: 0,
                    ariaRole: "button",
                    ariaLabel: `${transition.state}, ${transition.event}, ${transition.stateNext}`,
                } ];
            } ) () );
    const attachedInitialState = draft.chart.indicators.initialStateIndicator === null
        ? null
        : draft.chart.indicators.initialStateIndicator.state === undefined
            ? draft.stateMachine.initialState
            : draft.chart.indicators.initialStateIndicator.state;
    const initialEdges: StateChartEdge[] = draft.chart.indicators.initialStateIndicator !== null &&
        attachedInitialState !== null && draft.stateMachine.initialState === attachedInitialState &&
        placedStateNames.has ( attachedInitialState )
        ? ( () =>
        {
            // Initialize the local values needed by this operation.

            const initialNode     = flowNodes.find ( node => node.id === "initial-indicator" );
            const targetNode      = stateNodesByName.get ( attachedInitialState );
            const connectionSides = initialNode === undefined || targetNode === undefined
                ? { sourceSide: "bottom" as const, targetSide: "top" as const }
                : nearestChartConnectionSides (
                    chartNodeRectangle ( initialNode ),
                    chartNodeRectangle ( targetNode ),
                );

            // Handle the case where at least one branch condition is satisfied.

            if ( initialNode === undefined || targetNode === undefined )
            {
                // Return the assembled result collection.

                return [];
            }

            // Return the assembled result collection.

            return [ {
                id: "initial-relation",
                source: "initial-indicator",
                sourceHandle: connectionSides.sourceSide,
                target: stateNodeIdentifier ( attachedInitialState ),
                targetHandle: connectionSides.targetSide,
                type: "center" as const,
                markerEnd: TRANSITION_ARROW_MARKER_END,
                className: "chart-indicator-edge chart-initial-edge",
                data:
                {
                    kind: "initial" as const,
                    canonicalDirectionSign: 1,
                    parallelLaneCount: 1,
                    parallelLanePosition: 0,
                    orthogonalObstacles: orthogonalObstacles ( initialNode.id, targetNode.id ),
                    orthogonalLabelObstacles: allOrthogonalObstacles,
                    selfLoopIndex: null,
                    sourceBoundary: chartNodeBoundary ( initialNode ),
                    sourceTechnicalSide: connectionSides.sourceSide,
                    targetBoundary: chartNodeBoundary ( targetNode ),
                    targetTechnicalSide: connectionSides.targetSide,
                    transitionGravityPointDistance,
                },
                focusable: true,
                reconnectable: false,
                selectable: true,
                zIndex: 0,
                ariaLabel: `${text ( "chart.edge.initial" )}: ${attachedInitialState}`,
            } ];
        } ) ()
        : [];
    const terminalEdges: StateChartEdge[] = draft.chart.indicators.terminalStateTransitions.flatMap ( relation =>
        !placedStateNames.has ( relation.state ) || !terminalIndicatorIds.has ( relation.terminalStateIndicatorId )
            ? []
            : ( () =>
            {
                // Initialize the local values needed by this operation.

                const sourceNode = stateNodesByName.get ( relation.state );
                const targetNode = flowNodes.find ( node =>
                    node.id === terminalIndicatorNodeIdentifier ( relation.terminalStateIndicatorId ) );
                const connectionSides = sourceNode === undefined || targetNode === undefined
                    ? { sourceSide: "bottom" as const, targetSide: "top" as const }
                    : nearestChartConnectionSides (
                        chartNodeRectangle ( sourceNode ),
                        chartNodeRectangle ( targetNode ),
                    );

                // Handle the case where at least one branch condition is satisfied.

                if ( sourceNode === undefined || targetNode === undefined )
                {
                    // Return the assembled result collection.

                    return [];
                }

                // Return the assembled result collection.

                return [ {
                    id: `terminal-relation:${encodeURIComponent ( relation.state )}`,
                    source: stateNodeIdentifier ( relation.state ),
                    sourceHandle: connectionSides.sourceSide,
                    target: terminalIndicatorNodeIdentifier ( relation.terminalStateIndicatorId ),
                    targetHandle: connectionSides.targetSide,
                    type: "center" as const,
                    markerEnd: TRANSITION_ARROW_MARKER_END,
                    className: "chart-indicator-edge chart-terminal-edge",
                    data:
                    {
                        kind: "terminal" as const,
                        state: relation.state,
                        canonicalDirectionSign: 1,
                        parallelLaneCount: 1,
                        parallelLanePosition: 0,
                        orthogonalObstacles: orthogonalObstacles ( sourceNode.id, targetNode.id ),
                        orthogonalLabelObstacles: allOrthogonalObstacles,
                        selfLoopIndex: null,
                        sourceBoundary: chartNodeBoundary ( sourceNode ),
                        sourceTechnicalSide: connectionSides.sourceSide,
                        targetBoundary: chartNodeBoundary ( targetNode ),
                        targetTechnicalSide: connectionSides.targetSide,
                        transitionGravityPointDistance,
                    },
                    focusable: true,
                    reconnectable: false,
                    selectable: true,
                    zIndex: 0,
                    ariaLabel: `${text ( "chart.edge.terminal" )}: ${relation.state}, ` +
                        `${text ( "chart.indicator.terminal" )} ${relation.terminalStateIndicatorId}`,
                } ];
            } ) () );

    // Return the assembled result collection.

    return [ ...transitionEdges, ...initialEdges, ...terminalEdges ];
}

//--------------------------------------------------------------------------------------------------
// Function: isStateNode
//
// Description:
//
//   Determines whether state node.
//
// Parameters:
//
//   - node:
//     The node supplied to the operation.
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

function isStateNode ( node: StateChartNode ): node is StateChartStateNode
{
    // Return the computed result.

    return node.type === "state";
}

//--------------------------------------------------------------------------------------------------
// Function: isIndicatorNode
//
// Description:
//
//   Determines whether indicator node.
//
// Parameters:
//
//   - node:
//     The node supplied to the operation.
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

function isIndicatorNode ( node: StateChartNode ): node is StateChartIndicatorNode
{
    // Return the computed result.

    return node.type === "indicator";
}

//--------------------------------------------------------------------------------------------------
// Function: isDraftTransitionNode
//
// Description:
//
//   Determines whether draft transition node.
//
// Parameters:
//
//   - node:
//     The node supplied to the operation.
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

function isDraftTransitionNode ( node: StateChartNode ): node is StateChartDraftTransitionNode
{
    // Return the computed result.

    return node.type === "draftTransition";
}

//--------------------------------------------------------------------------------------------------
// Function: handleChartPaletteDragStart
//
// Description:
//
//   Handles chart palette drag start.
//
// Parameters:
//
//   - event:
//     The event to process.
//
//   - item:
//     The item supplied to the operation.
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
//--------------------------------------------------------------------------------------------------

function handleChartPaletteDragStart ( event: DragEvent<HTMLButtonElement>, item: ChartPaletteItem ): void
{
    event.dataTransfer.setData ( CHART_DROP_DATA_TYPE, item );
    event.dataTransfer.effectAllowed = "copy";

    const icon = event.currentTarget.querySelector<HTMLImageElement> ( "img" );

    // Handle the case where all required conditions are satisfied.

    if ( icon !== null && typeof event.dataTransfer.setDragImage === "function" )
    {
        event.dataTransfer.setDragImage (
            icon,
            Math.max ( 1, icon.clientWidth / 2 ),
            Math.max ( 1, icon.clientHeight / 2 ),
        );
    }
}

//--------------------------------------------------------------------------------------------------
// Function: ChartPalette
//
// Description:
//
//   Renders the chart palette interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered chart palette interface.
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

function ChartPalette ( properties: {
    readonly canAddInitialIndicator:  boolean;
    readonly canAddState:             boolean;
    readonly canAddTerminalIndicator: boolean;
    readonly canAddTransition:        boolean;
    readonly canDragTransition:       boolean;
} )
{
    // Return the rendered interface.

    return (
        <aside aria-label={ text ( "chart.palette" ) } className="chart-palette">
            <h2>{ text ( "chart.palette" ) }</h2>
            <button
                aria-describedby="chart-keyboard-instructions"
                disabled    = { !properties.canAddState }
                draggable   = { properties.canAddState }
                onDragStart = { event => handleChartPaletteDragStart ( event, "state" ) }
                type        = "button"
            >
                <Icon name="20/state-machine-state-chart-palette-state.svg" source="custom" />
                { text ( "chart.palette.state" ) }
            </button>
            <button
                disabled    = { !properties.canAddInitialIndicator }
                draggable   = { properties.canAddInitialIndicator }
                onDragStart = { event => handleChartPaletteDragStart ( event, "initial" ) }
                type        = "button"
            >
                <Icon name="20/state-machine-state-chart-palette-initial-state-indicator.svg" source="custom" />
                { text ( "chart.palette.initial" ) }
            </button>
            <button
                disabled    = { !properties.canAddTerminalIndicator }
                draggable   = { properties.canAddTerminalIndicator }
                onDragStart = { event => handleChartPaletteDragStart ( event, "terminal" ) }
                type        = "button"
            >
                <Icon name="20/state-machine-state-chart-palette-terminal-state-indicator.svg" source="custom" />
                { text ( "chart.palette.terminal" ) }
            </button>
            <button
                aria-describedby="chart-keyboard-instructions"
                disabled    = { !properties.canAddTransition }
                draggable   = { properties.canDragTransition }
                onDragStart = { event => handleChartPaletteDragStart ( event, "transition" ) }
                type        = "button"
            >
                <Icon name="20/state-machine-state-chart-palette-transition.svg" source="custom" />
                { text ( "chart.palette.transition" ) }
            </button>
        </aside>
    );
}

//--------------------------------------------------------------------------------------------------
// Function: ChartCanvas
//
// Description:
//
//   Renders the chart canvas interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered chart canvas interface.
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

function ChartCanvas ( properties: ChartCanvasProperties )
{
    // Initialize the local values needed by this operation.

    const wrapperReference = useRef<HTMLDivElement> ( null );
    const [ initialViewport ] = useState<Viewport | null> ( properties.initialViewport );

    // Every routing request needs its own identity. The document and preference revisions alone are
    // not unique, because the derived edge and node set can change without either of them changing,
    // so two requests carrying different geometry would otherwise share one identifier. When that
    // happened, a result from a superseded worker satisfied the newer job's correlation guard and
    // was applied to geometry it was never computed for, which is how a transient intermediate
    // state could leave a permanent exterior-fallback route behind.

    const routingRequestSequenceReference            = useRef ( 0 );
    const keyboardCommitTimerReference               = useRef<number | null> ( null );
    const pendingKeyboardGeometryReference           = useRef<readonly StateChartNode[] | null> ( null );
    const pendingKeyboardFocusRequestReference       = useRef<ChartFocusRequest | null> ( null );
    const pendingKeyboardResizeAnnouncementReference = useRef<string | null> ( null );
    const draftEndpointDragReference                 = useRef<DraftEndpointDrag | null> ( null );
    const semanticEndpointDragReference              = useRef<SemanticEndpointDrag | null> ( null );
    const routingDiagnosticReference                 = useRef ( properties.onRoutingDiagnostic );
    const sceneReadyReference                        = useRef ( properties.onSceneReady );
    const primaryNodeIdentifierReference             = useRef<string | null> ( null );
    const [ flowInstance, setFlowInstance ] = useState<ReactFlowInstance<StateChartNode, StateChartEdge> | null> ( null );
    const [ routingReady, setRoutingReady ] = useState ( false );
    const chartNodeCount = properties.draft.stateMachine.states.length +
        properties.draft.chart.indicators.terminalStateIndicators.length +
        properties.draft.chart.draftTransitions.length +
        ( properties.draft.chart.indicators.initialStateIndicator === null ? 0 : 1 );
    const initialIndicatorAttachment = properties.draft.chart.indicators.initialStateIndicator?.state === undefined
        ? properties.draft.stateMachine.initialState
        : properties.draft.chart.indicators.initialStateIndicator.state;
    const chartRelationCount = properties.draft.stateMachine.transitionTable.length +
        properties.draft.chart.indicators.terminalStateTransitions.length +
        properties.draft.chart.draftTransitions.length +
        ( properties.draft.chart.indicators.initialStateIndicator !== null &&
            initialIndicatorAttachment !== null ? 1 : 0 );
    const hasInteractiveNodeCapacity     = chartNodeCount < MAXIMUM_INTERACTIVE_CHART_NODE_COUNT;
    const hasInteractiveRelationCapacity = chartRelationCount < MAXIMUM_INTERACTIVE_CHART_EDGE_COUNT;
    const graphWithinInteractiveLimit    = chartNodeCount <= MAXIMUM_INTERACTIVE_CHART_NODE_COUNT &&
        chartRelationCount <= MAXIMUM_INTERACTIVE_CHART_EDGE_COUNT;
    const wrapActionNames    = properties.nameWrapping.actionNames;
    const wrapEventNames     = properties.nameWrapping.eventNames;
    const wrapStateNames     = properties.nameWrapping.stateNames;
    const stableNameWrapping = useMemo ( () => ( {
        actionNames: wrapActionNames,
        eventNames: wrapEventNames,
        stateNames: wrapStateNames,
    } ), [ wrapActionNames, wrapEventNames, wrapStateNames ] );
    const stableStateSize = useMemo<ChartStateSizePreferences> ( () => ( {
        collapsedStateHeight:       properties.collapsedStateHeight ?? DEFAULT_CHART_STATE_HEIGHT,
        collapsedStateWidth:        properties.collapsedStateWidth ?? DEFAULT_CHART_SETTINGS.collapsedStateWidth,
        expandedStateMinimumHeight: properties.expandedStateMinimumHeight ?? DEFAULT_CHART_STATE_HEIGHT,
        expandedStateWidth:         properties.expandedStateWidth ?? DEFAULT_CHART_SETTINGS.expandedStateWidth,
        gridSize:                   properties.gridSize ?? DEFAULT_CHART_SETTINGS.gridSize,
    } ), [
        properties.collapsedStateHeight,
        properties.collapsedStateWidth,
        properties.expandedStateMinimumHeight,
        properties.expandedStateWidth,
        properties.gridSize,
    ] );
    const projectedNodes = useMemo (
        () => graphWithinInteractiveLimit
            ? createFlowNodes (
                properties.draft,
                properties.diagnostics,
                stableNameWrapping,
                stableStateSize,
                properties.transitionArrowHeadSize,
            )
            : [],
        [
            graphWithinInteractiveLimit,
            properties.diagnostics,
            properties.draft,
            stableNameWrapping,
            stableStateSize,
            properties.transitionArrowHeadSize,
        ],
    );
    const flowEdges = useMemo (
        () => graphWithinInteractiveLimit
            ? createFlowEdges (
                properties.draft,
                stableNameWrapping,
                projectedNodes,
                properties.transitionGravityPointDistance,
                properties.transitionLabelAlignment,
                {
                    selfTransitionLoopAspect:
                        properties.selfTransitionLoopAspect ?? DEFAULT_CHART_SETTINGS.selfTransitionLoopAspect,
                    selfTransitionLoopExtension:
                        properties.selfTransitionLoopExtension ?? DEFAULT_CHART_SETTINGS.selfTransitionLoopExtension,
                    selfTransitionLoopSpacing:
                        properties.selfTransitionLoopSpacing ?? DEFAULT_CHART_SETTINGS.selfTransitionLoopSpacing,
                },
            )
            : [],
        [
            graphWithinInteractiveLimit,
            projectedNodes,
            properties.draft,
            stableNameWrapping,
            properties.selfTransitionLoopAspect,
            properties.selfTransitionLoopExtension,
            properties.selfTransitionLoopSpacing,
            properties.transitionGravityPointDistance,
            properties.transitionLabelAlignment,
        ],
    );
    const [ nodes, setNodes ]                                                               = useState<StateChartNode[]> ( projectedNodes );
    const [ edges, setEdges ]                                                               = useState<StateChartEdge[]> ( flowEdges );
    const [ selectedNodeIdentifiers, setSelectedNodeIdentifiers ]                           = useState<readonly string[]> ( [] );
    const [ selectedEdgeIdentifiers, setSelectedEdgeIdentifiers ]                           = useState<readonly string[]> ( [] );
    const [ pendingStateDialog, setPendingStateDialog ]                                     = useState<PendingStateDialog | null> ( null );
    const [ stateDialogOpen, setStateDialogOpen ]                                           = useState ( false );
    const [ stateDialogSession, setStateDialogSession ]                                     = useState ( 0 );
    const [ pendingTerminalConnectionIndicatorId, setPendingTerminalConnectionIndicatorId ] = useState<number | null> ( null );
    const [ pendingTransitionDialog, setPendingTransitionDialog ]                           = useState<PendingTransitionDialog | null> ( null );
    const [ transitionDialogOpen, setTransitionDialogOpen ]                                 = useState ( false );
    const [ transitionDialogSession, setTransitionDialogSession ]                           = useState ( 0 );
    const [ activeDraftEndpointDrag, setActiveDraftEndpointDrag ]                           = useState<DraftEndpointDrag | null> ( null );
    const [ semanticEndpointPreview, setSemanticEndpointPreview ]                           = useState<SemanticEndpointPreview | null> ( null );
    const [ layoutBusy, setLayoutBusy ]                                                     = useState ( false );
    const onAnnouncement         = properties.onAnnouncement;
    const onCommand              = properties.onCommand;
    const onFocusAfterRevision   = properties.onFocusAfterRevision;
    const onSelectionCountChange = properties.onSelectionCountChange;

    useEffect ( () =>
    {
        routingDiagnosticReference.current = properties.onRoutingDiagnostic;
        sceneReadyReference.current        = properties.onSceneReady;
    }, [ properties.onRoutingDiagnostic, properties.onSceneReady ] );

    //----------------------------------------------------------------------------------------------
    // Function: keyboardMovementDistance
    //
    // Description:
    //
    //   Derives the keyboard movement distance.
    //
    // Parameters:
    //
    //   - large:
    //     The large supplied to the operation.
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

    function keyboardMovementDistance ( large: boolean ): number
    {
        // Return the result selected by the current condition.

        return properties.snapToGrid ?? false
            ? ( properties.gridSize ?? DEFAULT_CHART_SETTINGS.gridSize ) * ( large ? 4 : 1 )
            : large ? KEYBOARD_LARGE_MOVE_DISTANCE : KEYBOARD_MOVE_DISTANCE;
    }

    //----------------------------------------------------------------------------------------------
    // Function: snapChartCoordinate
    //
    // Description:
    //
    //   Derives the snap chart coordinate.
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
    //----------------------------------------------------------------------------------------------

    function snapChartCoordinate ( value: number ): number
    {
        // Initialize the local values needed by this operation.

        const gridSize = properties.gridSize ?? DEFAULT_CHART_SETTINGS.gridSize;

        // Return the result selected by the current condition.

        return properties.snapToGrid ?? false
            ? Math.round ( value / gridSize ) * gridSize
            : value;
    }

    //----------------------------------------------------------------------------------------------
    // Function: snapChartPoint
    //
    // Description:
    //
    //   Derives the snap chart point.
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
    //----------------------------------------------------------------------------------------------

    function snapChartPoint ( point: ChartPoint ): ChartPoint
    {
        // Return the assembled result.

        return { x: snapChartCoordinate ( point.x ), y: snapChartCoordinate ( point.y ) };
    }

    // Initialize the local values needed by this operation.

    const centreSnappedIndicatorPosition = useCallback ( ( position: ChartPoint ): ChartPoint =>
    {
        // Initialize the local values needed by this operation.

        const gridSize = properties.gridSize ?? DEFAULT_CHART_SETTINGS.gridSize;

        // Handle the case where the current value condition is not satisfied.

        if ( !( properties.snapToGrid ?? false ) )
        {
            // Return the position.

            return position;
        }

        const centre = storedIndicatorFromFlowPosition ( position );

        // Return the flow position from stored indicator result.

        return flowPositionFromStoredIndicator ( {
            x: Math.round ( centre.x / gridSize ) * gridSize,
            y: Math.round ( centre.y / gridSize ) * gridSize,
        } );
    }, [ properties.gridSize, properties.snapToGrid ] );

    const commitGeometry = useCallback ( (
        geometryNodes: readonly StateChartNode[],
        deleteOrphanedItems = false,
    ): boolean =>
    {
        // Initialize the local values needed by this operation.

        const statePlacements = geometryNodes.flatMap ( node =>
        {
            // Handle the case where the is state node result condition is not satisfied.

            if ( !isStateNode ( node ) )
            {
                // Return the assembled result collection.

                return [];
            }

            // Return the assembled result collection.

            return [ storedStatePlacementFromFlowPosition (
                node.data.viewModel.name,
                node.position,
                node.data.viewModel.savedHeight,
            ) ];
        } );
        const initialIndicatorNode = geometryNodes.find ( node =>
            isIndicatorNode ( node ) && node.data.kind === "initial" );
        const terminalStateIndicators = geometryNodes.flatMap ( node =>
            isIndicatorNode ( node ) && node.data.kind === "terminal" && node.data.indicatorId !== null
                ? [ storedTerminalIndicatorFromFlowPosition ( node.data.indicatorId, node.position ) ]
                : [] );
        const draftTransitions = geometryNodes.flatMap ( node =>
            isDraftTransitionNode ( node )
                ? [ {
                    id: node.data.draftTransitionId,
                    source:
                    {
                        x: node.position.x + node.data.source.x,
                        y: node.position.y + node.data.source.y,
                    },
                    target:
                    {
                        x: node.position.x + node.data.target.x,
                        y: node.position.y + node.data.target.y,
                    },
                } ]
                : [] );

        // Return the on command result.

        return onCommand ( expectedRevision => ( {
            kind: "replace_chart_geometry",
            deleteOrphanedItems,
            statePlacements,
            initialStateIndicator: initialIndicatorNode === undefined
                ? null
                : {
                    ...storedIndicatorFromFlowPosition ( initialIndicatorNode.position ),
                    state: properties.draft.chart.indicators.initialStateIndicator?.state ?? null,
                },
            terminalStateIndicators,
            draftTransitions,
            expectedRevision,
        } ) );
    }, [ onCommand, properties.draft.chart.indicators.initialStateIndicator?.state ] );

    //----------------------------------------------------------------------------------------------
    // Function: handleStateResizeEnd
    //
    // Description:
    //
    //   Handles state resize end.
    //
    // Parameters:
    //
    //   - stateName:
    //     The state name supplied to the operation.
    //
    //   - parameters:
    //     The parameters supplied to the operation.
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

    function handleStateResizeEnd ( stateName: string, parameters: ResizeParams ): void
    {
        // Initialize the local values needed by this operation.

        const stateNode = ( flowInstance?.getNodes () ?? nodes ).find ( node =>
            isStateNode ( node ) && node.data.viewModel.name === stateName );

        // Handle the case where at least one branch condition is satisfied.

        if ( stateNode === undefined || !isStateNode ( stateNode ) || !stateNode.data.viewModel.expanded )
        {
            // Return control to the caller.

            return;
        }

        // Initialize the local values needed by this operation.

        const minimumHeight = stateNode !== undefined && isStateNode ( stateNode )
            ? stateNode.data.viewModel.minimumHeight
            : DEFAULT_CHART_STATE_HEIGHT;
        const gridSize             = properties.gridSize ?? DEFAULT_CHART_SETTINGS.gridSize;
        const alignedMinimumHeight = properties.snapToGrid ?? false
            ? Math.ceil ( minimumHeight / gridSize ) * gridSize
            : minimumHeight;
        const height = Math.min (
            MAXIMUM_CHART_STATE_DIMENSION,
            Math.max ( alignedMinimumHeight, snapChartCoordinate ( parameters.height ) ),
        );
        const x            = stateNode.position.x;
        const y            = snapChartCoordinate ( parameters.y );
        const resizedNodes = ( flowInstance?.getNodes () ?? nodes ).map ( node =>
            isStateNode ( node ) && node.data.viewModel.name === stateName
                ? {
                    ...node,
                    data:
                    {
                        ...node.data,
                        viewModel:
                        {
                            ...node.data.viewModel,
                            height,
                            savedHeight: height,
                            x,
                            y,
                        },
                    },
                    position: { x, y },
                    style: { ...node.style, height, width: node.data.viewModel.width },
                }
                : node );

        setNodes ( resizedNodes );

        // Handle the case where commit geometry result is enabled.

        if ( commitGeometry ( resizedNodes ) )
        {
            properties.onAnnouncement ( `${text ( "chart.announcement.nodeResized" )}. ` +
                chartStateHeightDescription ( height, height, alignedMinimumHeight ) );
            properties.onFocusAfterRevision ( {
                kind: "node",
                identifier: stateNodeIdentifier ( stateName ),
            } );
        }
    }

    //----------------------------------------------------------------------------------------------
    // Function: draftEndpointFromEventTarget
    //
    // Description:
    //
    //   Derives the draft endpoint from event target.
    //
    // Parameters:
    //
    //   - target:
    //     The target supplied to the operation.
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

    function draftEndpointFromEventTarget ( target: EventTarget | null ): {
        readonly draftTransitionId: number;
        readonly element:             Element;
        readonly endpoint:            "source" | "target";
    } | null
    {
        // Handle the case where the current value condition is not satisfied.

        if ( !( target instanceof Element ) )
        {
            // Return the computed result.

            return null;
        }

        // Initialize the local values needed by this operation.

        const element           = target.closest ( "[data-draft-endpoint][data-draft-transition-id]" );
        const endpoint          = element?.getAttribute ( "data-draft-endpoint" );
        const identifierText    = element?.getAttribute ( "data-draft-transition-id" );
        const draftTransitionId = identifierText === null || identifierText === undefined
            ? Number.NaN
            : Number ( identifierText );

        // Handle the case where at least one branch condition is satisfied.

        if ( element === null || ( endpoint !== "source" && endpoint !== "target" ) ||
            !Number.isSafeInteger ( draftTransitionId ) )
        {
            // Return the computed result.

            return null;
        }

        // Return the assembled result.

        return { draftTransitionId, element, endpoint };
    }

    //----------------------------------------------------------------------------------------------
    // Function: flowPointFromClientPoint
    //
    // Description:
    //
    //   Derives the flow point from client point.
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
    //----------------------------------------------------------------------------------------------

    function flowPointFromClientPoint ( point: ChartPoint ): ChartPoint
    {
        // Return the computed result.

        return flowInstance?.screenToFlowPosition ( point ) ?? point;
    }

    //----------------------------------------------------------------------------------------------
    // Function: stateContainingPoint
    //
    // Description:
    //
    //   Derives the state containing point.
    //
    // Parameters:
    //
    //   - point:
    //     The point supplied to the operation.
    //
    //   - chartNodes:
    //     The chart nodes supplied to the operation.
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

    function stateContainingPoint (
        point: ChartPoint,
        chartNodes: readonly StateChartNode[],
    ): { readonly center: ChartPoint; readonly identifier: string } | null
    {
        // Repeat the operation across the bounded iteration range.

        for ( let index = chartNodes.length - 1; index >= 0; index -= 1 )
        {
            // Initialize the local values needed by this operation.

            const node = chartNodes [ index ];

            // Handle the case where node matches undefined.

            if ( node === undefined )
            {
                continue;
            }

            // Handle the case where the is state node result condition is not satisfied.

            if ( !isStateNode ( node ) )
            {
                continue;
            }

            const rectangle = chartNodeRectangle ( node );

            // Handle the case where rounded rectangle contains point result is enabled.

            if ( roundedRectangleContainsPoint ( point, rectangle, CHART_STATE_BORDER_RADIUS ) )
            {
                // Return the assembled result.

                return {
                    center:
                    {
                        x: rectangle.x + rectangle.width / 2,
                        y: rectangle.y + rectangle.height / 2,
                    },
                    identifier: node.id,
                };
            }
        }

        // Return the computed result.

        return null;
    }

    //----------------------------------------------------------------------------------------------
    // Function: stateNameFromChartIdentifier
    //
    // Description:
    //
    //   Derives the state name from chart identifier.
    //
    // Parameters:
    //
    //   - identifier:
    //     The identifier supplied to the operation.
    //
    //   - chartNodes:
    //     The chart nodes supplied to the operation.
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

    function stateNameFromChartIdentifier (
        identifier: string,
        chartNodes: readonly StateChartNode[],
    ): string
    {
        // Initialize the local values needed by this operation.

        const stateNode = chartNodes.find ( node => node.id === identifier && isStateNode ( node ) );

        // Return the result selected by the current condition.

        return stateNode !== undefined && isStateNode ( stateNode )
            ? stateNode.data.viewModel.name
            : identifier;
    }

    //----------------------------------------------------------------------------------------------
    // Function: announceDraftEndpointMovement
    //
    // Description:
    //
    //   Handles the announce draft endpoint movement behavior.
    //
    // Parameters:
    //
    //   - draftTransitionId:
    //     The draft transition identifier supplied to the operation.
    //
    //   - endpoint:
    //     The endpoint supplied to the operation.
    //
    //   - point:
    //     The point supplied to the operation.
    //
    //   - movement:
    //     The movement supplied to the operation.
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

    function announceDraftEndpointMovement (
        draftTransitionId: number,
        endpoint: "source" | "target",
        point: ChartPoint,
        movement: string,
    ): void
    {
        properties.onAnnouncement (
            `${text ( "chart.announcement.draftTransition" )} ${draftTransitionId} ` +
            `${text ( endpoint === "source"
                ? "chart.announcement.sourceEndpoint"
                : "chart.announcement.targetEndpoint" )} ${movement}. ` +
            `${text ( "chart.announcement.newCoordinates" )}: X ${Math.round ( point.x )}, Y ${Math.round ( point.y )}.`,
        );
    }

    //----------------------------------------------------------------------------------------------
    // Function: handleDraftEndpointPointerDown
    //
    // Description:
    //
    //   Handles draft endpoint pointer down.
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

    function handleDraftEndpointPointerDown ( event: PointerEvent<HTMLButtonElement> ): void
    {
        // Initialize the local values needed by this operation.

        const endpointTarget = draftEndpointFromEventTarget ( event.target );

        // Handle the case where endpoint target matches an absent value.

        if ( endpointTarget === null )
        {
            // Return control to the caller.

            return;
        }

        event.preventDefault ();
        event.stopPropagation ();
        endpointTarget.element instanceof HTMLElement && endpointTarget.element.focus ();

        // Initialize the local values needed by this operation.

        const currentNodes = flowInstance?.getNodes () ?? nodes;
        const draftNode    = currentNodes.find ( node => isDraftTransitionNode ( node ) &&
            node.data.draftTransitionId === endpointTarget.draftTransitionId );

        // Handle the case where at least one branch condition is satisfied.

        if ( draftNode === undefined || !isDraftTransitionNode ( draftNode ) )
        {
            // Return control to the caller.

            return;
        }

        // Initialize the local values needed by this operation.

        const transition     = draftTransitionFromNode ( draftNode );
        const endpointPoint  = transition [ endpointTarget.endpoint ];
        const displayedPoint = endpointControlPoint (
            transition.source,
            transition.target,
            endpointTarget.endpoint,
        );
        const pointerPoint = flowPointFromClientPoint ( { x: event.clientX, y: event.clientY } );
        const drag         = {
            draftTransitionId: endpointTarget.draftTransitionId,
            displayOffset:
            {
                x: displayedPoint.x - endpointPoint.x,
                y: displayedPoint.y - endpointPoint.y,
            },
            endpoint: endpointTarget.endpoint,
            pointerOffset:
            {
                x: pointerPoint.x - endpointPoint.x,
                y: pointerPoint.y - endpointPoint.y,
            },
            pointerId: event.pointerId,
        };

        draftEndpointDragReference.current = drag;
        setActiveDraftEndpointDrag ( drag );
        event.currentTarget.setPointerCapture?. ( event.pointerId );
    }

    //----------------------------------------------------------------------------------------------
    // Function: handleDraftEndpointPointerMove
    //
    // Description:
    //
    //   Handles draft endpoint pointer move.
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

    function handleDraftEndpointPointerMove ( event: PointerEvent<HTMLButtonElement> ): void
    {
        // Initialize the local values needed by this operation.

        const drag = draftEndpointDragReference.current;

        // Handle the case where at least one branch condition is satisfied.

        if ( drag === null || drag.pointerId !== event.pointerId )
        {
            // Return control to the caller.

            return;
        }

        event.preventDefault ();

        // Initialize the local values needed by this operation.

        const pointerPoint = flowPointFromClientPoint ( { x: event.clientX, y: event.clientY } );
        const point        = {
            x: pointerPoint.x - drag.pointerOffset.x,
            y: pointerPoint.y - drag.pointerOffset.y,
        };
        const currentNodes = flowInstance?.getNodes () ?? nodes;

        setNodes ( replaceDraftTransitionEndpoint (
            currentNodes,
            drag.draftTransitionId,
            drag.endpoint,
            point,
        ) );
    }

    //----------------------------------------------------------------------------------------------
    // Function: finishDraftEndpointPointerMove
    //
    // Description:
    //
    //   Finalizes the draft endpoint pointer move.
    //
    // Parameters:
    //
    //   - event:
    //     The event to process.
    //
    //   - cancelled:
    //     The cancelled supplied to the operation.
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

    function finishDraftEndpointPointerMove ( event: PointerEvent<HTMLButtonElement>, cancelled: boolean ): void
    {
        // Initialize the local values needed by this operation.

        const drag = draftEndpointDragReference.current;

        // Handle the case where at least one branch condition is satisfied.

        if ( drag === null || drag.pointerId !== event.pointerId )
        {
            // Return control to the caller.

            return;
        }

        event.preventDefault ();
        event.stopPropagation ();
        draftEndpointDragReference.current = null;
        setActiveDraftEndpointDrag ( null );
        event.currentTarget.releasePointerCapture?. ( event.pointerId );

        // Handle the case where cancelled is enabled.

        if ( cancelled )
        {
            setNodes ( projectedNodes );

            // Return control to the caller.

            return;
        }

        // Initialize the local values needed by this operation.

        const currentNodes  = flowInstance?.getNodes () ?? nodes;
        const pointerPoint  = flowPointFromClientPoint ( { x: event.clientX, y: event.clientY } );
        const releasedPoint = {
            x: pointerPoint.x - drag.pointerOffset.x,
            y: pointerPoint.y - drag.pointerOffset.y,
        };
        const releasedState         = stateContainingPoint ( releasedPoint, currentNodes );
        const snappedPoint          = releasedState?.center ?? snapChartPoint ( releasedPoint );
        const storedDraftTransition = properties.draft.chart.draftTransitions.find (
            draftTransition => draftTransition.id === drag.draftTransitionId,
        );
        const originalState = storedDraftTransition === undefined
            ? null
            : stateContainingPoint ( storedDraftTransition [ drag.endpoint ], currentNodes );
        const updatedNodes = replaceDraftTransitionEndpoint (
            currentNodes,
            drag.draftTransitionId,
            drag.endpoint,
            snappedPoint,
        );

        setNodes ( updatedNodes );

        // Handle the case where all required conditions are satisfied.

        if ( storedDraftTransition !== undefined && chartPointsApproximatelyEqual (
            storedDraftTransition [ drag.endpoint ],
            snappedPoint,
        ) )
        {
            // Return control to the caller.

            return;
        }

        // Calculate the movement value from the current inputs.

        const movement = releasedState !== null
            ? `${text ( "chart.announcement.snappedToState" )} ` +
                stateNameFromChartIdentifier ( releasedState.identifier, currentNodes )
            : originalState !== null
                ? `${text ( "chart.announcement.detachedFromState" )} ` +
                    stateNameFromChartIdentifier ( originalState.identifier, currentNodes )
                : text ( "chart.announcement.moved" );

        announceDraftEndpointMovement ( drag.draftTransitionId, drag.endpoint, snappedPoint, movement );

        properties.onFocusAfterRevision ( {
            kind: "draft-endpoint",
            identifier: draftEndpointFocusIdentifier ( drag.draftTransitionId, drag.endpoint ),
        } );

        // Handle the case where the commit geometry result condition is not satisfied.

        if ( !commitGeometry ( updatedNodes ) )
        {
            properties.onFocusAfterRevision ( null );
        }
    }

    const flushKeyboardGeometry = useCallback ( (): void =>
    {
        // Handle the case where keyboard commit timer reference current differs from an absent
        // value.

        if ( keyboardCommitTimerReference.current !== null )
        {
            window.clearTimeout ( keyboardCommitTimerReference.current );
            keyboardCommitTimerReference.current = null;
        }

        // Initialize the local values needed by this operation.

        const pendingGeometry    = pendingKeyboardGeometryReference.current;
        const focusRequest       = pendingKeyboardFocusRequestReference.current;
        const resizeAnnouncement = pendingKeyboardResizeAnnouncementReference.current;

        pendingKeyboardGeometryReference.current           = null;
        pendingKeyboardFocusRequestReference.current       = null;
        pendingKeyboardResizeAnnouncementReference.current = null;

        // Handle the case where all required conditions are satisfied.

        if ( pendingGeometry !== null && commitGeometry ( pendingGeometry ) )
        {
            // Handle the case where focus request differs from an absent value.

            if ( focusRequest !== null )
            {
                onFocusAfterRevision ( focusRequest );
            }

            // Handle the case where resize announcement differs from an absent value.

            if ( resizeAnnouncement !== null )
            {
                onAnnouncement ( resizeAnnouncement );
            }
        }
    }, [ commitGeometry, onAnnouncement, onFocusAfterRevision ] );

    useEffect ( () => () =>
    {
        flushKeyboardGeometry ();
    }, [ flushKeyboardGeometry ] );

    useEffect ( () =>
    {
        // Initialize the local values needed by this operation.

        const routingPort = properties.routingPort;

        // Handle the case where routing port matches undefined.

        if ( routingPort === undefined )
        {
            // Initialize the local values needed by this operation.

            const animationFrame = window.requestAnimationFrame ( () => setRoutingReady ( true ) );

            // Return the computed result.

            return () => window.cancelAnimationFrame ( animationFrame );
        }

        // Initialize the local values needed by this operation.

        const orderedEdges = [
            ...flowEdges.filter ( edge => edge.data?.kind === "initial" ),
            ...flowEdges.filter ( edge => edge.data?.kind === "transition" ),
            ...flowEdges.filter ( edge => edge.data?.kind === "terminal" ),
        ];
        const relations = orderedEdges
            .flatMap ( edge =>
            {
                // Initialize the local values needed by this operation.

                const relation = routingRelationForEdge ( edge, projectedNodes );

                // Return the result selected by the current condition.

                return relation === null ? [] : [ relation ];
            } )
            .concat ( projectedNodes.filter ( isDraftTransitionNode )
                .sort ( ( left, right ) => left.data.draftTransitionId - right.data.draftTransitionId )
                .map ( node => routingRelationForDraft ( node, projectedNodes ) ) );

        // Handle the case where relations length equals 0.

        if ( relations.length === 0 )
        {
            // Initialize the local values needed by this operation.

            const animationFrame = window.requestAnimationFrame ( () => setRoutingReady ( true ) );

            // Return the computed result.

            return () => window.cancelAnimationFrame ( animationFrame );
        }

        const preferenceRevision = chartPreferenceRevision ( {
            collapsedStateHeight: properties.collapsedStateHeight,
            collapsedStateWidth: properties.collapsedStateWidth,
            expandedStateMinimumHeight: properties.expandedStateMinimumHeight,
            expandedStateWidth: properties.expandedStateWidth,
            gridSize: properties.gridSize,
            selfTransitionLoopAspect: properties.selfTransitionLoopAspect,
            selfTransitionLoopExtension: properties.selfTransitionLoopExtension,
            selfTransitionLoopSpacing: properties.selfTransitionLoopSpacing,
            transitionGravityPointDistance: properties.transitionGravityPointDistance,
            transitionLabelAlignment: properties.transitionLabelAlignment,
        } );
        routingRequestSequenceReference.current += 1;

        // Initialize the local values needed by this operation.

        const requestId = `chart-routing:${properties.documentRevision}:${preferenceRevision}:` +
            `${routingRequestSequenceReference.current}`;
        let active = true;

        void routingPort.route ( {
            documentRevision: properties.documentRevision,
            geometryRevision: properties.documentRevision,
            preferenceRevision,
            relations,
            requestId,
            transitionGravityPointDistance: properties.transitionGravityPointDistance ??
                DEFAULT_CHART_SETTINGS.transitionGravityPointDistance,
        } ).then ( result =>
        {
            // Handle the case where at least one branch condition is satisfied.

            if ( !active || result.requestId !== requestId )
            {
                // Return control to the caller.

                return;
            }

            // Initialize the local values needed by this operation.

            const resultByIdentifier = new Map ( result.relations.map ( relation =>
                [ relation.identifier, relation ] ) );
            const fallbackDescription    = text ( "chart.routing.exteriorFallback" );
            const focusBeforeRouteUpdate = document.activeElement instanceof HTMLElement &&
                document.activeElement.closest ( ".chart-page" ) !== null
                ? document.activeElement
                : null;

            setEdges ( currentEdges => currentEdges.map ( edge =>
            {
                // Initialize the local values needed by this operation.

                const routedGeometry = resultByIdentifier.get ( edge.id );
                const baseAriaLabel  = edge.ariaLabel?.replace ( `. ${fallbackDescription}`, "" );
                const ariaLabel      = routedGeometry?.exteriorFallback
                    ? `${baseAriaLabel ?? edge.id}. ${fallbackDescription}`
                    : baseAriaLabel;

                // Return the result selected by the current condition.

                return routedGeometry === undefined || edge.data === undefined
                    ? edge
                    : {
                        ...edge,
                        ...( ariaLabel === undefined ? {} : { ariaLabel } ),
                        data: { ...edge.data, routedGeometry },
                    };
            } ) );
            setNodes ( currentNodes => currentNodes.map ( node =>
            {
                // Handle the case where the is draft transition node result condition is not
                // satisfied.

                if ( !isDraftTransitionNode ( node ) )
                {
                    // Return the node.

                    return node;
                }

                // Initialize the local values needed by this operation.

                const routedGeometry = resultByIdentifier.get ( node.id );
                const baseAriaLabel  = node.ariaLabel?.replace ( `. ${fallbackDescription}`, "" );
                const ariaLabel      = routedGeometry?.exteriorFallback
                    ? `${baseAriaLabel ?? node.id}. ${fallbackDescription}`
                    : baseAriaLabel;

                // Return the result selected by the current condition.

                return routedGeometry === undefined
                    ? node
                    : {
                        ...node,
                        ...( ariaLabel === undefined ? {} : { ariaLabel } ),
                        data: { ...node.data, routedGeometry },
                    };
            } ) );

            // Handle the case where focus before route update differs from an absent value.

            if ( focusBeforeRouteUpdate !== null )
            {
                window.setTimeout ( () =>
                {
                    // Initialize the local values needed by this operation.

                    const activeElement           = document.activeElement;
                    const focusRemainsInsideChart = activeElement instanceof HTMLElement &&
                        activeElement.closest ( ".chart-page" ) !== null;

                    // Handle the case where all required conditions are satisfied.

                    if ( document.contains ( focusBeforeRouteUpdate ) &&
                        ( activeElement === document.body || activeElement === null || focusRemainsInsideChart ) )
                    {
                        focusBeforeRouteUpdate.focus ();
                    }
                }, 0 );
            }

            // Handle the case where some result is enabled.

            if ( result.relations.some ( relation => relation.exteriorFallback ) )
            {
                routingDiagnosticReference.current?. ( text ( "chart.routing.exteriorFallback" ) );
            }

            setRoutingReady ( true );
        } ).catch ( () =>
        {
            // Handle the case where active is enabled.

            if ( active )
            {
                routingDiagnosticReference.current?. ( text ( "chart.routing.failed" ) );
                setRoutingReady ( true );
            }
        } );

        // Return the computed result.

        return () =>
        {
            active = false;
            void routingPort.cancel ();
        };
    }, [
        flowEdges,
        projectedNodes,
        properties.documentRevision,
        properties.collapsedStateHeight,
        properties.collapsedStateWidth,
        properties.expandedStateMinimumHeight,
        properties.expandedStateWidth,
        properties.gridSize,
        properties.routingPort,
        properties.selfTransitionLoopAspect,
        properties.selfTransitionLoopExtension,
        properties.selfTransitionLoopSpacing,
        properties.transitionGravityPointDistance,
        properties.transitionLabelAlignment,
    ] );

    const projectedLabelCount = flowEdges.filter (
        edge => typeof edge.label === "string" && edge.label.length > 0,
    ).length;

    useEffect ( () =>
    {
        // Handle the case where the scene cannot be reported yet.

        if ( !routingReady || flowInstance === null || sceneReadyReference.current === undefined )
        {
            // Return control to the caller.

            return;
        }

        // Initialize the local values needed by this operation.

        let completeFrameCount       = 0;
        let projectionAnimationFrame = 0;

        const awaitCompleteProjection = (): void =>
        {
            projectionAnimationFrame = window.requestAnimationFrame ( () =>
            {
                // Initialize the local values needed by this operation.

                const wrapper            = wrapperReference.current;
                const projectionComplete = wrapper !== null &&
                    wrapper.querySelectorAll ( ".react-flow__node" ).length === nodes.length &&
                    wrapper.querySelectorAll ( ".react-flow__edge" ).length === edges.length &&
                    wrapper.querySelectorAll ( ".react-flow__edge-textwrapper" ).length === projectedLabelCount;

                // Handle the case where projection complete is disabled.

                if ( !projectionComplete )
                {
                    completeFrameCount = 0;
                    awaitCompleteProjection ();

                    // Return control to the caller.

                    return;
                }

                completeFrameCount += 1;

                // Handle the case where the projection has not remained complete for two frames.

                if ( completeFrameCount < 2 )
                {
                    awaitCompleteProjection ();

                    // Return control to the caller.

                    return;
                }

                sceneReadyReference.current?. ( wrapper );
            } );
        };

        awaitCompleteProjection ();

        // Return the computed result.

        return () =>
        {
            window.cancelAnimationFrame ( projectionAnimationFrame );
        };
    }, [ edges.length, flowInstance, nodes.length, projectedLabelCount, routingReady ] );

    useEffect ( () =>
    {
        onSelectionCountChange?. ( 0 );

        // Return the computed result.

        return () => onSelectionCountChange?. ( 0 );
    }, [ onSelectionCountChange ] );

    // React Flow snaps a node's top-left corner. That suits a state, whose stored position is its
    // corner, but an indicator stores its geometric centre, so corner snapping leaves the centre
    // half an indicator away from the grid and no indicator can be lined up with a state's centre
    // axis. Re-snap an indicator's centre here instead.

    const handleNodesChange = useCallback ( ( changes: NodeChange<StateChartNode>[] ): void =>
    {
        setNodes ( currentNodes =>
        {
            // Initialize the local values needed by this operation.

            const indicatorIdentifiers = new Set (
                currentNodes.filter ( isIndicatorNode ).map ( node => node.id ) );
            const centredChanges = changes.map ( change =>
            {
                // Handle the case where at least one branch condition is satisfied.

                if ( change.type !== "position" || change.position === undefined ||
                    !indicatorIdentifiers.has ( change.id ) )
                {
                    // Return the change.

                    return change;
                }

                // Return the assembled result.

                return { ...change, position: centreSnappedIndicatorPosition ( change.position ) };
            } );

            // Return the apply node changes result.

            return applyNodeChanges ( centredChanges, currentNodes );
        } );
    }, [ centreSnappedIndicatorPosition ] );

    const handleEdgesChange = useCallback ( ( changes: EdgeChange<StateChartEdge>[] ): void =>
    {
        // Initialize the local values needed by this operation.

        const presentationChanges = changes.filter ( change => change.type !== "remove" );

        // Handle the case where presentation changes length exceeds the 0 value.

        if ( presentationChanges.length > 0 )
        {
            setEdges ( currentEdges => applyEdgeChanges ( presentationChanges, currentEdges ) );
        }
    }, [] );

    const handleSelectionChange = useCallback ( (
        selection: OnSelectionChangeParams<StateChartNode, StateChartEdge>,
    ): void =>
    {
        // Initialize the local values needed by this operation.

        const nextNodeIdentifiers = selection.nodes.map ( node => node.id );
        const nextEdgeIdentifiers = selection.edges.map ( edge => edge.id );

        setSelectedNodeIdentifiers ( currentIdentifiers =>
            currentIdentifiers.length === nextNodeIdentifiers.length && currentIdentifiers.every (
                ( identifier, index ) => identifier === nextNodeIdentifiers [ index ],
            ) ? currentIdentifiers : nextNodeIdentifiers );
        setSelectedEdgeIdentifiers ( currentIdentifiers =>
            currentIdentifiers.length === nextEdgeIdentifiers.length && currentIdentifiers.every (
                ( identifier, index ) => identifier === nextEdgeIdentifiers [ index ],
            ) ? currentIdentifiers : nextEdgeIdentifiers );
        onSelectionCountChange?. (
            nextNodeIdentifiers.length + nextEdgeIdentifiers.length,
        );
    }, [ onSelectionCountChange ] );

    //----------------------------------------------------------------------------------------------
    // Function: missingTransitionPlacements
    //
    // Description:
    //
    //   Derives the missing transition placements.
    //
    // Parameters:
    //
    //   - transition:
    //     The transition supplied to the operation.
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

    function missingTransitionPlacements ( transition: TransitionDefinition )
    {
        // Initialize the local values needed by this operation.

        const persistedStates = new Set ( properties.draft.chart.states.map ( placement => placement.state ) );
        const endpointNames   = [ transition.state, transition.stateNext ];

        // Return the flat map result.

        return nodes.flatMap ( node =>
            isStateNode ( node ) && endpointNames.includes ( node.data.viewModel.name ) &&
                !persistedStates.has ( node.data.viewModel.name )
                ? [ storedStatePlacementFromFlowPosition (
                    node.data.viewModel.name,
                    node.position,
                    node.data.viewModel.savedHeight,
                ) ]
                : [] );
    }

    //----------------------------------------------------------------------------------------------
    // Function: openStateDialog
    //
    // Description:
    //
    //   Opens the state dialog.
    //
    // Parameters:
    //
    //   - dialog:
    //     The dialog supplied to the operation.
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

    function openStateDialog ( dialog: PendingStateDialog ): void
    {
        setPendingStateDialog ( dialog );
        setStateDialogSession ( currentSession => currentSession + 1 );
        setStateDialogOpen ( true );
    }

    //----------------------------------------------------------------------------------------------
    // Function: openTransitionDialog
    //
    // Description:
    //
    //   Opens the transition dialog.
    //
    // Parameters:
    //
    //   - transition:
    //     The transition supplied to the operation.
    //
    //   - index:
    //     The index supplied to the operation.
    //
    //   - draftTransitionId:
    //     The draft transition identifier supplied to the operation.
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

    function openTransitionDialog (
        transition: TransitionDefinition,
        index: number | null,
        draftTransitionId: number | null = null,
    ): void
    {
        // Handle the case where all required conditions are satisfied.

        if ( index === null && draftTransitionId === null && !hasInteractiveRelationCapacity )
        {
            properties.onInteractionError ( text ( "chart.limit.relations" ) );

            // Return control to the caller.

            return;
        }

        setPendingTransitionDialog ( {
            draftTransitionId,
            index,
            initialValue: transition,
        } );
        setTransitionDialogSession ( currentSession => currentSession + 1 );
        setTransitionDialogOpen ( true );
    }

    //----------------------------------------------------------------------------------------------
    // Function: attemptQuickConnection
    //
    // Description:
    //
    //   Derives the attempt quick connection.
    //
    // Parameters:
    //
    //   - firstNode:
    //     The first node supplied to the operation.
    //
    //   - secondNode:
    //     The second node supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    function attemptQuickConnection ( firstNode: StateChartNode, secondNode: StateChartNode ): boolean
    {
        // Handle the case where first node identifier matches second node identifier.

        if ( firstNode.id === secondNode.id )
        {
            // Return the computed result.

            return false;
        }

        // Handle the case where all required conditions are satisfied.

        if ( isStateNode ( firstNode ) && isStateNode ( secondNode ) )
        {
            openTransitionDialog ( {
                event: "",
                state: firstNode.data.viewModel.name,
                stateNext: secondNode.data.viewModel.name,
            }, null );

            // Return the computed result.

            return true;
        }

        // Initialize the local values needed by this operation.

        const stateNode = isStateNode ( firstNode )
            ? firstNode
            : isStateNode ( secondNode ) ? secondNode : null;
        const indicatorNode = isIndicatorNode ( firstNode )
            ? firstNode
            : isIndicatorNode ( secondNode ) ? secondNode : null;

        // Handle the case where at least one branch condition is satisfied.

        if ( stateNode === null || indicatorNode === null )
        {
            // Return the computed result.

            return false;
        }

        // Handle the case where kind matches the initial value.

        if ( indicatorNode.data.kind === "initial" )
        {
            // Initialize the local values needed by this operation.

            const commandCommitted = properties.onCommand ( expectedRevision => ( {
                kind: "set_chart_initial_indicator",
                indicator:
                {
                    ...storedIndicatorFromFlowPosition ( indicatorNode.position ),
                    state: stateNode.data.viewModel.name,
                },
                expectedRevision,
            } ) );

            // Handle the case where command committed is enabled.

            if ( commandCommitted )
            {
                properties.onFocusAfterRevision ( { kind: "node", identifier: secondNode.id } );
            }

            // Return the computed result.

            return true;
        }

        // Handle the case where indicator identifier matches an absent value.

        if ( indicatorNode.data.indicatorId === null )
        {
            // Return the computed result.

            return false;
        }

        // Initialize the local values needed by this operation.

        const indicatorId      = indicatorNode.data.indicatorId;
        const commandCommitted = properties.onCommand ( expectedRevision => ( {
            kind: "connect_chart_terminal_indicator",
            state: stateNode.data.viewModel.name,
            indicatorId,
            expectedRevision,
        } ) );

        // Handle the case where command committed is enabled.

        if ( commandCommitted )
        {
            properties.onFocusAfterRevision ( { kind: "node", identifier: secondNode.id } );
        }

        // Return the computed result.

        return true;
    }

    //----------------------------------------------------------------------------------------------
    // Function: handleNodeClick
    //
    // Description:
    //
    //   Handles node click.
    //
    // Parameters:
    //
    //   - event:
    //     The event to process.
    //
    //   - node:
    //     The node supplied to the operation.
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

    function handleNodeClick ( event: MouseEvent<Element>, node: StateChartNode ): void
    {
        // Handle the case where all required conditions are satisfied.

        if ( event.shiftKey && primaryNodeIdentifierReference.current !== null )
        {
            // Initialize the local values needed by this operation.

            const primaryNode = nodes.find ( candidate =>
                candidate.id === primaryNodeIdentifierReference.current );

            // Handle the case where all required conditions are satisfied.

            if ( primaryNode !== undefined && attemptQuickConnection ( primaryNode, node ) )
            {
                event.preventDefault ();
                event.stopPropagation ();
                primaryNodeIdentifierReference.current = node.id;

                // Return control to the caller.

                return;
            }
        }

        // Handle the case where all required conditions are satisfied.

        if ( !event.ctrlKey && !event.metaKey && !event.shiftKey )
        {
            primaryNodeIdentifierReference.current = node.id;
        }
    }

    //----------------------------------------------------------------------------------------------
    // Function: closeTransitionDialog
    //
    // Description:
    //
    //   Closes the transition dialog.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   No value is returned.
    //
    // Preconditions:
    //
    //   - None.
    //
    // Postconditions:
    //
    //   - The described side effects are complete when the callable returns.
    //
    //----------------------------------------------------------------------------------------------

    function closeTransitionDialog (): void
    {
        setTransitionDialogOpen ( false );
    }

    //----------------------------------------------------------------------------------------------
    // Function: openTerminalConnectionDialog
    //
    // Description:
    //
    //   Opens the terminal connection dialog.
    //
    // Parameters:
    //
    //   - node:
    //     The node supplied to the operation.
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

    function openTerminalConnectionDialog ( node: StateChartNode ): void
    {
        // Handle the case where all required conditions are satisfied.

        if ( isIndicatorNode ( node ) && node.data.kind === "terminal" && node.data.indicatorId !== null )
        {
            setPendingTerminalConnectionIndicatorId ( node.data.indicatorId );
        }
    }

    //----------------------------------------------------------------------------------------------
    // Function: handleConnect
    //
    // Description:
    //
    //   Handles connect.
    //
    // Parameters:
    //
    //   - connection:
    //     The connection supplied to the operation.
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

    function handleConnect ( connection: Connection ): void
    {
        // Initialize the local values needed by this operation.

        const sourceNode = nodes.find ( node => node.id === connection.source );
        const targetNode = nodes.find ( node => node.id === connection.target );

        // Handle the case where at least one branch condition is satisfied.

        if ( sourceNode === undefined || targetNode === undefined )
        {
            // Return control to the caller.

            return;
        }

        // Handle the case where all required conditions are satisfied.

        if ( isIndicatorNode ( sourceNode ) && sourceNode.data.kind === "initial" && isStateNode ( targetNode ) )
        {
            // Initialize the local values needed by this operation.

            const initialAttachment = properties.draft.chart.indicators.initialStateIndicator?.state === undefined
                ? properties.draft.stateMachine.initialState
                : properties.draft.chart.indicators.initialStateIndicator.state;

            // Handle the case where all required conditions are satisfied.

            if ( initialAttachment === null && !hasInteractiveRelationCapacity )
            {
                properties.onInteractionError ( text ( "chart.limit.relations" ) );

                // Return control to the caller.

                return;
            }

            properties.onCommand ( expectedRevision => ( {
                kind: "set_chart_initial_indicator",
                indicator:
                {
                    ...storedIndicatorFromFlowPosition ( sourceNode.position ),
                    state: targetNode.data.viewModel.name,
                },
                expectedRevision,
            } ) );

            // Return control to the caller.

            return;
        }

        // Handle the case where all required conditions are satisfied.

        if ( isStateNode ( sourceNode ) && isIndicatorNode ( targetNode ) &&
            targetNode.data.kind === "terminal" && targetNode.data.indicatorId !== null )
        {
            // Handle the case where the has interactive relation capacity condition is not
            // satisfied.

            if ( !hasInteractiveRelationCapacity )
            {
                properties.onInteractionError ( text ( "chart.limit.relations" ) );

                // Return control to the caller.

                return;
            }

            const indicatorId = targetNode.data.indicatorId;

            properties.onCommand ( expectedRevision => ( {
                kind: "connect_chart_terminal_indicator",
                state: sourceNode.data.viewModel.name,
                indicatorId,
                expectedRevision,
            } ) );

            // Return control to the caller.

            return;
        }

        // Handle the case where all required conditions are satisfied.

        if ( isStateNode ( sourceNode ) && isStateNode ( targetNode ) )
        {
            // Handle the case where the has interactive relation capacity condition is not
            // satisfied.

            if ( !hasInteractiveRelationCapacity )
            {
                properties.onInteractionError ( text ( "chart.limit.relations" ) );

                // Return control to the caller.

                return;
            }

            openTransitionDialog (
                {
                    state: sourceNode.data.viewModel.name,
                    event: properties.draft.stateMachine.events [ 0 ]?.name ?? "",
                    stateNext: targetNode.data.viewModel.name,
                },
                null,
            );
        }
    }

    //----------------------------------------------------------------------------------------------
    // Function: stateNameForNodeIdentifier
    //
    // Description:
    //
    //   Derives the state name for node identifier.
    //
    // Parameters:
    //
    //   - identifier:
    //     The identifier supplied to the operation.
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

    function stateNameForNodeIdentifier ( identifier: string ): string | null
    {
        // Initialize the local values needed by this operation.

        const stateNode = nodes.find ( node => node.id === identifier && isStateNode ( node ) );

        // Return the result selected by the current condition.

        return stateNode !== undefined && isStateNode ( stateNode ) ? stateNode.data.viewModel.name : null;
    }

    //----------------------------------------------------------------------------------------------
    // Function: reconnectTransition
    //
    // Description:
    //
    //   Handles the reconnect transition behavior.
    //
    // Parameters:
    //
    //   - edge:
    //     The edge supplied to the operation.
    //
    //   - sourceIdentifier:
    //     The source identifier supplied to the operation.
    //
    //   - targetIdentifier:
    //     The target identifier supplied to the operation.
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

    function reconnectTransition (
        edge: StateChartEdge,
        sourceIdentifier: string,
        targetIdentifier: string,
    ): void
    {
        // Handle the case where kind differs from the transition value.

        if ( edge.data?.kind !== "transition" )
        {
            // Return control to the caller.

            return;
        }

        // Initialize the local values needed by this operation.

        const transition  = properties.draft.stateMachine.transitionTable [ edge.data.transitionIndex ];
        const sourceState = stateNameForNodeIdentifier ( sourceIdentifier );
        const targetState = stateNameForNodeIdentifier ( targetIdentifier );

        // Handle the case where at least one branch condition is satisfied.

        if ( transition === undefined || sourceState === null || targetState === null ||
            ( transition.state === sourceState && transition.stateNext === targetState ) )
        {
            // Return control to the caller.

            return;
        }

        const replacement = { ...transition, state: sourceState, stateNext: targetState };
        properties.onFocusAfterRevision ( {
            kind: "edge",
            identifier: transitionEdgeIdentifier ( replacement.state, replacement.event ),
        } );
        const commandCommitted = properties.onCommand ( expectedRevision => ( {
            kind: "update_transition",
            index: edge.data?.kind === "transition" ? edge.data.transitionIndex : -1,
            transition: replacement,
            chartStatePlacements: missingTransitionPlacements ( replacement ),
            expectedRevision,
        } ) );

        // Handle the case where the command committed condition is not satisfied.

        if ( !commandCommitted )
        {
            properties.onFocusAfterRevision ( null );
        }
    }

    //----------------------------------------------------------------------------------------------
    // Function: stateIdentifierAtClientPoint
    //
    // Description:
    //
    //   Derives the state identifier at client point.
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
    //----------------------------------------------------------------------------------------------

    function stateIdentifierAtClientPoint ( point: ChartPoint ): string | null
    {
        // Initialize the local values needed by this operation.

        const stateElements = Array.from (
            wrapperReference.current?.querySelectorAll<HTMLElement> ( ".react-flow__node-state" ) ?? [],
        ).reverse ();

        // Process each state element from the state elements collection in order.

        for ( const stateElement of stateElements )
        {
            // Initialize the local values needed by this operation.

            const bounds = stateElement.getBoundingClientRect ();

            // Handle the case where rounded rectangle contains point result is enabled.

            if ( roundedRectangleContainsPoint ( point, {
                height: bounds.height,
                width: bounds.width,
                x: bounds.left,
                y: bounds.top,
            }, CHART_STATE_BORDER_RADIUS * ( flowInstance?.getViewport ().zoom ?? 1 ) ) )
            {
                // Return the computed result.

                return stateElement.dataset [ "id" ] ?? null;
            }
        }

        // Return the computed result.

        return null;
    }

    //----------------------------------------------------------------------------------------------
    // Function: handleSemanticEndpointPointerDown
    //
    // Description:
    //
    //   Handles semantic endpoint pointer down.
    //
    // Parameters:
    //
    //   - event:
    //     The event to process.
    //
    //   - edge:
    //     The edge supplied to the operation.
    //
    //   - endpoint:
    //     The endpoint supplied to the operation.
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

    function handleSemanticEndpointPointerDown (
        event: PointerEvent<HTMLButtonElement>,
        edge: StateChartEdge,
        endpoint: "source" | "target",
    ): void
    {
        // Handle the case where kind differs from the transition value.

        if ( edge.data?.kind !== "transition" )
        {
            // Return control to the caller.

            return;
        }

        event.preventDefault ();
        event.stopPropagation ();
        event.currentTarget.focus ();
        semanticEndpointDragReference.current = {
            edgeIdentifier: edge.id,
            endpoint,
            pointerId: event.pointerId,
        };
        event.currentTarget.setPointerCapture?. ( event.pointerId );
    }

    //----------------------------------------------------------------------------------------------
    // Function: handleSemanticEndpointPointerMove
    //
    // Description:
    //
    //   Handles semantic endpoint pointer move.
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

    function handleSemanticEndpointPointerMove ( event: PointerEvent<HTMLButtonElement> ): void
    {
        // Initialize the local values needed by this operation.

        const drag = semanticEndpointDragReference.current;

        // Handle the case where at least one branch condition is satisfied.

        if ( drag === null || drag.pointerId !== event.pointerId )
        {
            // Return control to the caller.

            return;
        }

        event.preventDefault ();
        event.stopPropagation ();
        setSemanticEndpointPreview ( {
            ...drag,
            point: flowPointFromClientPoint ( { x: event.clientX, y: event.clientY } ),
        } );
    }

    //----------------------------------------------------------------------------------------------
    // Function: finishSemanticEndpointPointerMove
    //
    // Description:
    //
    //   Finalizes the semantic endpoint pointer move.
    //
    // Parameters:
    //
    //   - event:
    //     The event to process.
    //
    //   - edge:
    //     The edge supplied to the operation.
    //
    //   - cancelled:
    //     The cancelled supplied to the operation.
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

    function finishSemanticEndpointPointerMove (
        event: PointerEvent<HTMLButtonElement>,
        edge: StateChartEdge,
        cancelled: boolean,
    ): void
    {
        // Initialize the local values needed by this operation.

        const drag = semanticEndpointDragReference.current;

        // Handle the case where at least one branch condition is satisfied.

        if ( drag === null || drag.pointerId !== event.pointerId || drag.edgeIdentifier !== edge.id )
        {
            // Return control to the caller.

            return;
        }

        event.preventDefault ();
        event.stopPropagation ();
        semanticEndpointDragReference.current = null;
        setSemanticEndpointPreview ( null );
        event.currentTarget.releasePointerCapture?. ( event.pointerId );

        // Handle the case where cancelled is enabled.

        if ( cancelled )
        {
            // Return control to the caller.

            return;
        }

        const stateIdentifier = stateIdentifierAtClientPoint ( { x: event.clientX, y: event.clientY } );

        // Handle the case where state identifier matches an absent value.

        if ( stateIdentifier === null )
        {
            // Return control to the caller.

            return;
        }

        reconnectTransition (
            edge,
            drag.endpoint === "source" ? stateIdentifier : edge.source,
            drag.endpoint === "target" ? stateIdentifier : edge.target,
        );
    }

    //----------------------------------------------------------------------------------------------
    // Function: placeOrphanIndicator
    //
    // Description:
    //
    //   Places the orphan indicator.
    //
    // Parameters:
    //
    //   - item:
    //     The item supplied to the operation.
    //
    //   - point:
    //     The point supplied to the operation.
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

    function placeOrphanIndicator ( item: "initial" | "terminal", point: ChartPoint ): void
    {
        // Handle the case where the has interactive node capacity condition is not satisfied.

        if ( !hasInteractiveNodeCapacity )
        {
            properties.onInteractionError ( text ( "chart.limit.nodes" ) );

            // Return control to the caller.

            return;
        }

        const indicatorCenter = snapChartPoint ( storedIndicatorFromFlowPosition ( point ) );

        // Handle the case where item matches the initial value.

        if ( item === "initial" )
        {
            // Initialize the local values needed by this operation.

            const commandCommitted = properties.onCommand ( expectedRevision => ( {
                kind: "set_chart_initial_indicator",
                indicator: { ...indicatorCenter, state: null },
                expectedRevision,
            } ) );

            // Handle the case where command committed is enabled.

            if ( commandCommitted )
            {
                properties.onFocusAfterRevision ( { kind: "node", identifier: "initial-indicator" } );
            }

            // Return control to the caller.

            return;
        }

        // Initialize the local values needed by this operation.

        const nextIdentifier = nextTerminalIndicatorIdentifier (
            properties.draft.chart.indicators.terminalStateIndicators,
        );
        const commandCommitted = properties.onCommand ( expectedRevision => ( {
            kind: "add_chart_terminal_indicator",
            indicator: { id: nextIdentifier, ...indicatorCenter },
            expectedRevision,
        } ) );

        // Handle the case where command committed is enabled.

        if ( commandCommitted )
        {
            properties.onFocusAfterRevision ( {
                kind: "node",
                identifier: terminalIndicatorNodeIdentifier ( nextIdentifier ),
            } );
        }
    }

    //----------------------------------------------------------------------------------------------
    // Function: placeIndicatorOnState
    //
    // Description:
    //
    //   Places the indicator on state.
    //
    // Parameters:
    //
    //   - item:
    //     The item supplied to the operation.
    //
    //   - targetStateNode:
    //     The target state node supplied to the operation.
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

    function placeIndicatorOnState (
        item: "initial" | "terminal",
        targetStateNode: StateChartStateNode,
    ): void
    {
        // Initialize the local values needed by this operation.

        const currentNodes    = flowInstance?.getNodes () ?? nodes;
        const targetRectangle = chartNodeRectangle ( targetStateNode );
        const direction       = item === "initial" ? -1 : 1;
        const gridSize        = properties.gridSize ?? DEFAULT_CHART_SETTINGS.gridSize;
        const indicatorCenter = {
            x: snapChartCoordinate ( targetRectangle.x + targetRectangle.width / 2 ),
            y: snapChartCoordinate ( item === "initial"
                ? targetRectangle.y - gridSize - CHART_ROUTE_CLEARANCE - CHART_INDICATOR_SIZE / 2
                : targetRectangle.y + targetRectangle.height + gridSize + CHART_ROUTE_CLEARANCE +
                    CHART_INDICATOR_SIZE / 2 ),
        };
        const occupiedRectangles: ChartRectangle[] = [ {
            x: indicatorCenter.x - CHART_INDICATOR_SIZE / 2,
            y: indicatorCenter.y - CHART_INDICATOR_SIZE / 2,
            width: CHART_INDICATOR_SIZE,
            height: CHART_INDICATOR_SIZE,
        } ];
        const displacedNodes = currentNodes.map ( node =>
        {
            // Handle the case where is draft transition node result is enabled.

            if ( isDraftTransitionNode ( node ) )
            {
                // Return the node.

                return node;
            }

            let rectangle = chartNodeRectangle ( node );

            // Repeat the operation across the bounded iteration range.

            for ( let attempt = 0; attempt <= occupiedRectangles.length; attempt += 1 )
            {
                // Initialize the local values needed by this operation.

                const collisions = occupiedRectangles.filter ( occupied =>
                    chartRectanglesIntersect ( occupied, rectangle ) );

                // Handle the case where collisions length equals 0.

                if ( collisions.length === 0 )
                {
                    break;
                }

                // Initialize the local values needed by this operation.

                const displacement = direction > 0
                    ? Math.max ( ...collisions.map ( occupied => occupied.y + occupied.height - rectangle.y ) )
                    : Math.max ( ...collisions.map ( occupied => rectangle.y + rectangle.height - occupied.y ) );
                const alignedDisplacement = Math.ceil ( displacement / gridSize ) * gridSize;

                rectangle = { ...rectangle, y: rectangle.y + direction * alignedDisplacement };
            }

            // Handle the case where some result is enabled.

            if ( occupiedRectangles.some ( occupied => chartRectanglesIntersect ( occupied, rectangle ) ) )
            {
                throw new Error ( "The Chart indicator collision could not be resolved within the bounded pass." );
            }

            occupiedRectangles.push ( rectangle );

            // Return the result selected by the current condition.

            return rectangle.x === node.position.x && rectangle.y === node.position.y
                ? node
                : { ...node, position: { x: rectangle.x, y: rectangle.y } };
        } );
        const displacedDraftTransitions = properties.draft.chart.draftTransitions.map ( draftTransition =>
        {
            //--------------------------------------------------------------------------------------
            // Function: displacePoint
            //
            // Description:
            //
            //   Derives the displace point.
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
            //--------------------------------------------------------------------------------------

            const displacePoint = ( point: ChartPoint ): ChartPoint =>
            {
                // Initialize the local values needed by this operation.

                const indicatorRectangle = occupiedRectangles [ 0 ];

                // Handle the case where at least one branch condition is satisfied.

                if ( indicatorRectangle === undefined || !chartRectangleContainsPoint ( indicatorRectangle, point ) )
                {
                    // Return the point.

                    return point;
                }

                // Initialize the local values needed by this operation.

                const displacement = direction > 0
                    ? indicatorRectangle.y + indicatorRectangle.height - point.y
                    : point.y - indicatorRectangle.y;
                const alignedDisplacement = Math.ceil ( displacement / gridSize ) * gridSize;

                // Return the assembled result.

                return { x: point.x, y: point.y + direction * alignedDisplacement };
            };

            // Return the assembled result.

            return {
                ...draftTransition,
                source: displacePoint ( draftTransition.source ),
                target: displacePoint ( draftTransition.target ),
            };
        } );
        const statePlacements = displacedNodes.flatMap ( node => isStateNode ( node )
            ? [ storedStatePlacementFromFlowPosition (
                node.data.viewModel.name,
                node.position,
                node.data.viewModel.savedHeight,
            ) ]
            : [] );
        const displacedInitialNode = displacedNodes.find ( node =>
            isIndicatorNode ( node ) && node.data.kind === "initial" );
        const initialStateIndicator = item === "initial"
            ? { ...indicatorCenter, state: targetStateNode.data.viewModel.name }
            : displacedInitialNode === undefined
                ? null
                : {
                    ...storedIndicatorFromFlowPosition ( displacedInitialNode.position ),
                    state: properties.draft.chart.indicators.initialStateIndicator?.state === undefined
                        ? properties.draft.stateMachine.initialState
                        : properties.draft.chart.indicators.initialStateIndicator.state,
                };
        const displacedTerminalIndicators = displacedNodes.flatMap ( node =>
            isIndicatorNode ( node ) && node.data.kind === "terminal" && node.data.indicatorId !== null
                ? [ storedTerminalIndicatorFromFlowPosition ( node.data.indicatorId, node.position ) ]
                : [] );
        const nextTerminalIdentifier = nextTerminalIndicatorIdentifier (
            properties.draft.chart.indicators.terminalStateIndicators,
        );
        const terminalStateIndicators = item === "terminal"
            ? [ ...displacedTerminalIndicators, { id: nextTerminalIdentifier, ...indicatorCenter } ]
            : displacedTerminalIndicators;
        const terminalStateTransitions = item === "terminal"
            ? [
                ...properties.draft.chart.indicators.terminalStateTransitions.filter (
                    relation => relation.state !== targetStateNode.data.viewModel.name,
                ),
                {
                    state: targetStateNode.data.viewModel.name,
                    terminalStateIndicatorId: nextTerminalIdentifier,
                },
            ]
            : properties.draft.chart.indicators.terminalStateTransitions;
        const commandCommitted = properties.onCommand ( expectedRevision => ( {
            kind: "place_chart_indicator",
            initialState: item === "initial"
                ? targetStateNode.data.viewModel.name
                : properties.draft.stateMachine.initialState,
            initialStateIndicator,
            terminalStateIndicators,
            terminalStateTransitions,
            statePlacements,
            draftTransitions: displacedDraftTransitions,
            expectedRevision,
        } ) );

        // Handle the case where command committed is enabled.

        if ( commandCommitted )
        {
            properties.onFocusAfterRevision ( {
                kind: "node",
                identifier: item === "initial"
                    ? "initial-indicator"
                    : terminalIndicatorNodeIdentifier ( nextTerminalIdentifier ),
            } );
        }
    }

    //----------------------------------------------------------------------------------------------
    // Function: placePaletteItemWithoutDialog
    //
    // Description:
    //
    //   Places the palette item without dialog.
    //
    // Parameters:
    //
    //   - item:
    //     The item supplied to the operation.
    //
    //   - point:
    //     The point supplied to the operation.
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

    function placePaletteItemWithoutDialog ( item: "state" | "transition", point: ChartPoint ): void
    {
        // Handle the case where the has interactive node capacity condition is not satisfied.

        if ( !hasInteractiveNodeCapacity )
        {
            properties.onInteractionError ( text ( "chart.limit.nodes" ) );

            // Return control to the caller.

            return;
        }

        // Handle the case where item matches the state value.

        if ( item === "state" )
        {
            // Initialize the local values needed by this operation.

            const stateName        = nextGeneratedStateName ( properties.draft.stateMachine.states );
            const placementPoint   = snapChartPoint ( point );
            const commandCommitted = properties.onCommand ( expectedRevision => ( {
                kind: "add_entity",
                entityKind: "state",
                entity: { name: stateName, description: "" },
                chartPlacement:
                {
                    state: stateName,
                    x: placementPoint.x,
                    y: placementPoint.y,
                    height: properties.expandedStateMinimumHeight ?? DEFAULT_CHART_STATE_HEIGHT,
                },
                expectedRevision,
            } ) );

            // Handle the case where command committed is enabled.

            if ( commandCommitted )
            {
                properties.onFocusAfterRevision ( { kind: "node", identifier: stateNodeIdentifier ( stateName ) } );
            }

            // Return control to the caller.

            return;
        }

        // Handle the case where the has interactive relation capacity condition is not satisfied.

        if ( !hasInteractiveRelationCapacity )
        {
            properties.onInteractionError ( text ( "chart.limit.relations" ) );

            // Return control to the caller.

            return;
        }

        // Initialize the local values needed by this operation.

        const draftTransitionId = nextDraftTransitionIdentifier ( properties.draft.chart.draftTransitions );
        const source            = snapChartPoint ( {
            x: point.x - CHART_DRAFT_TRANSITION_LENGTH / 2,
            y: point.y,
        } );
        const target = snapChartPoint ( {
            x: point.x + CHART_DRAFT_TRANSITION_LENGTH / 2,
            y: point.y,
        } );
        const commandCommitted = properties.onCommand ( expectedRevision => ( {
            kind: "add_chart_draft_transition",
            draftTransition:
            {
                id: draftTransitionId,
                source,
                target,
            },
            expectedRevision,
        } ) );

        // Handle the case where command committed is enabled.

        if ( commandCommitted )
        {
            properties.onFocusAfterRevision ( {
                kind: "node",
                identifier: draftTransitionNodeIdentifier ( draftTransitionId ),
            } );
        }
    }

    //----------------------------------------------------------------------------------------------
    // Function: handleDrop
    //
    // Description:
    //
    //   Handles drop.
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

    function handleDrop ( event: DragEvent<HTMLDivElement> ): void
    {
        event.preventDefault ();

        const item = event.dataTransfer.getData ( CHART_DROP_DATA_TYPE );

        // Handle the case where the includes result condition is not satisfied.

        if ( ![ "initial", "state", "terminal", "transition" ].includes ( item ) )
        {
            // Return control to the caller.

            return;
        }

        const point = flowInstance?.screenToFlowPosition ( { x: event.clientX, y: event.clientY } ) ??
            { x: event.clientX, y: event.clientY };

        // Handle the case where item matches the state value.

        if ( item === "state" )
        {
            placePaletteItemWithoutDialog ( "state", point );

            // Return control to the caller.

            return;
        }

        // Handle the case where item matches the transition value.

        if ( item === "transition" )
        {
            placePaletteItemWithoutDialog ( "transition", point );

            // Return control to the caller.

            return;
        }

        // Initialize the local values needed by this operation.

        const currentNodes    = flowInstance?.getNodes () ?? nodes;
        const targetState     = stateContainingPoint ( point, currentNodes );
        const targetStateNode = targetState === null
            ? undefined
            : currentNodes.find ( node => node.id === targetState.identifier && isStateNode ( node ) );

        // Handle the case where all required conditions are satisfied.

        if ( targetStateNode !== undefined && isStateNode ( targetStateNode ) )
        {
            // Handle the case where at least one branch condition is satisfied.

            if ( !hasInteractiveRelationCapacity && item === "initial" ||
                !hasInteractiveRelationCapacity && item === "terminal" &&
                    !properties.draft.chart.indicators.terminalStateTransitions.some (
                        relation => relation.state === targetStateNode.data.viewModel.name,
                    ) )
            {
                properties.onInteractionError ( text ( "chart.limit.relations" ) );

                // Return control to the caller.

                return;
            }

            placeIndicatorOnState ( item === "initial" ? "initial" : "terminal", targetStateNode );

            // Return control to the caller.

            return;
        }

        placeOrphanIndicator ( item === "initial" ? "initial" : "terminal", point );
    }

    //----------------------------------------------------------------------------------------------
    // Function: requestDeleteSelection
    //
    // Description:
    //
    //   Requests the delete selection.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   No value is returned.
    //
    // Preconditions:
    //
    //   - None.
    //
    // Postconditions:
    //
    //   - The described side effects are complete when the callable returns.
    //
    //----------------------------------------------------------------------------------------------

    function requestDeleteSelection (): void
    {
        // Initialize the local values needed by this operation.

        const currentNodes                     = flowInstance?.getNodes () ?? nodes;
        const currentEdges                     = flowInstance?.getEdges () ?? edges;
        const activeElement                    = document.activeElement;
        const focusedDraftTransitionIdentifier = activeElement instanceof Element
            ? activeElement.closest ( "[data-draft-transition-id]" )?.getAttribute ( "data-draft-transition-id" )
            : null;
        const focusedNodeIdentifier = activeElement instanceof Element
            ? activeElement.closest ( ".react-flow__node" )?.getAttribute ( "data-id" ) ??
                ( focusedDraftTransitionIdentifier === null || focusedDraftTransitionIdentifier === undefined
                    ? null
                    : draftTransitionNodeIdentifier ( Number ( focusedDraftTransitionIdentifier ) ) )
            : null;
        const focusedEdgeIdentifier = activeElement instanceof Element
            ? activeElement.closest ( ".react-flow__edge" )?.getAttribute ( "data-id" ) ?? null
            : null;
        const focusedNode = currentNodes.find ( node => node.id === focusedNodeIdentifier );
        const focusedEdge = currentEdges.find ( edge => edge.id === focusedEdgeIdentifier );
        let selectedNodes = currentNodes.filter ( node =>
            node.selected === true || selectedNodeIdentifiers.includes ( node.id ) );
        let selectedEdges = currentEdges.filter ( edge =>
            edge.selected === true || selectedEdgeIdentifiers.includes ( edge.id ) );

        // Handle the case where all required conditions are satisfied.

        if ( focusedNode !== undefined && !selectedNodes.some ( node => node.id === focusedNode.id ) )
        {
            selectedNodes = [ focusedNode ];
            selectedEdges = [];
        }
        else if ( focusedEdge !== undefined && !selectedEdges.some ( edge => edge.id === focusedEdge.id ) )
        {
            selectedNodes = [];
            selectedEdges = [ focusedEdge ];
        }

        // Handle the case where all required conditions are satisfied.

        if ( selectedNodes.length === 0 && selectedEdges.length === 0 )
        {
            // Return control to the caller.

            return;
        }

        const commandCommitted = properties.onCommand ( expectedRevision => ( {
            kind: "delete_chart_selection",
            stateNames: selectedNodes.flatMap ( node => isStateNode ( node ) ? [ node.data.viewModel.name ] : [] ),
            transitionKeys: selectedEdges.flatMap ( edge => edge.data?.kind === "transition"
                ? [ { state: edge.data.state, event: edge.data.event } ]
                : [] ),
            terminalStateIndicatorIds: selectedNodes.flatMap ( node =>
                isIndicatorNode ( node ) && node.data.kind === "terminal" && node.data.indicatorId !== null
                    ? [ node.data.indicatorId ]
                    : [] ),
            terminalStateRelationStates: selectedEdges.flatMap ( edge => edge.data?.kind === "terminal"
                ? [ edge.data.state ]
                : [] ),
            draftTransitionIds: selectedNodes.flatMap ( node => isDraftTransitionNode ( node )
                ? [ node.data.draftTransitionId ]
                : [] ),
            clearInitialStateRelation: selectedEdges.some ( edge => edge.data?.kind === "initial" ),
            deleteInitialStateIndicator: selectedNodes.some ( node =>
                isIndicatorNode ( node ) && node.data.kind === "initial" ),
            expectedRevision,
        } ) );

        // Handle the case where command committed is enabled.

        if ( commandCommitted )
        {
            properties.onFocusAfterRevision ( { kind: "canvas" } );
        }
    }

    //----------------------------------------------------------------------------------------------
    // Function: editNode
    //
    // Description:
    //
    //   Handles the edit node behavior.
    //
    // Parameters:
    //
    //   - node:
    //     The node supplied to the operation.
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

    function editNode ( node: StateChartNode ): void
    {
        // Handle the case where is draft transition node result is enabled.

        if ( isDraftTransitionNode ( node ) )
        {
            openTransitionDialog ( {
                state: properties.draft.stateMachine.states [ 0 ]?.name ?? "",
                event: properties.draft.stateMachine.events [ 0 ]?.name ?? "",
                stateNext: properties.draft.stateMachine.states [ 0 ]?.name ?? "",
            }, null, node.data.draftTransitionId );

            // Return control to the caller.

            return;
        }

        // Handle the case where is indicator node result is enabled.

        if ( isIndicatorNode ( node ) )
        {
            openTerminalConnectionDialog ( node );

            // Return control to the caller.

            return;
        }

        // Handle the case where the is state node result condition is not satisfied.

        if ( !isStateNode ( node ) )
        {
            // Return control to the caller.

            return;
        }

        openStateDialog ( {
            mode: "edit",
            originalName: node.data.viewModel.name,
            point: null,
            initialValue: { name: node.data.viewModel.name, description: node.data.viewModel.description },
        } );
    }

    //----------------------------------------------------------------------------------------------
    // Function: editEdge
    //
    // Description:
    //
    //   Handles the edit edge behavior.
    //
    // Parameters:
    //
    //   - edge:
    //     The edge supplied to the operation.
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

    function editEdge ( edge: StateChartEdge ): void
    {
        // Handle the case where kind differs from the transition value.

        if ( edge.data?.kind !== "transition" )
        {
            // Return control to the caller.

            return;
        }

        const transition = properties.draft.stateMachine.transitionTable [ edge.data.transitionIndex ];

        // Handle the case where transition differs from undefined.

        if ( transition !== undefined )
        {
            openTransitionDialog ( transition, edge.data.transitionIndex );
        }
    }

    //----------------------------------------------------------------------------------------------
    // Function: handleNodeContextMenu
    //
    // Description:
    //
    //   Handles node context menu.
    //
    // Parameters:
    //
    //   - event:
    //     The event to process.
    //
    //   - node:
    //     The node supplied to the operation.
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

    function handleNodeContextMenu ( event: MouseEvent, node: StateChartNode ): void
    {
        // Handle the case where at least one branch condition is satisfied.

        if ( !event.ctrlKey || !isStateNode ( node ) )
        {
            // Return control to the caller.

            return;
        }

        const selectedSource = nodes.find ( candidate => candidate.selected && isStateNode ( candidate ) &&
            candidate.id !== node.id );

        // Handle the case where all required conditions are satisfied.

        if ( selectedSource !== undefined && isStateNode ( selectedSource ) )
        {
            event.preventDefault ();
            openTransitionDialog ( {
                state: selectedSource.data.viewModel.name,
                event: properties.draft.stateMachine.events [ 0 ]?.name ?? "",
                stateNext: node.data.viewModel.name,
            }, null );
        }
    }

    //----------------------------------------------------------------------------------------------
    // Function: moveFocusedDraftEndpoint
    //
    // Description:
    //
    //   Moves the focused draft endpoint.
    //
    // Parameters:
    //
    //   - event:
    //     The event to process.
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
    //----------------------------------------------------------------------------------------------

    function moveFocusedDraftEndpoint ( event: KeyboardEvent<HTMLDivElement> ): boolean
    {
        // Initialize the local values needed by this operation.

        const endpointTarget      = draftEndpointFromEventTarget ( event.target );
        const horizontalDirection = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
        const verticalDirection   = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;

        // Handle the case where at least one branch condition is satisfied.

        if ( endpointTarget === null || ( horizontalDirection === 0 && verticalDirection === 0 ) )
        {
            // Return the computed result.

            return false;
        }

        // Initialize the local values needed by this operation.

        const currentNodes = flowInstance?.getNodes () ?? nodes;
        const draftNode    = currentNodes.find ( node => isDraftTransitionNode ( node ) &&
            node.data.draftTransitionId === endpointTarget.draftTransitionId );

        // Handle the case where at least one branch condition is satisfied.

        if ( draftNode === undefined || !isDraftTransitionNode ( draftNode ) )
        {
            // Return the computed result.

            return false;
        }

        // Initialize the local values needed by this operation.

        const transition    = draftTransitionFromNode ( draftNode );
        const endpoint      = endpointTarget.endpoint === "source" ? transition.source : transition.target;
        const distance      = keyboardMovementDistance ( event.shiftKey );
        const proposedPoint = {
            x: endpoint.x + horizontalDirection * distance,
            y: endpoint.y + verticalDirection * distance,
        };
        const currentStateIdentifier = stateContainingPoint ( endpoint, currentNodes )?.identifier ?? null;
        const proposedState          = stateContainingPoint ( proposedPoint, currentNodes );
        const snappedPoint           = proposedState !== null && proposedState.identifier !== currentStateIdentifier
            ? proposedState.center
            : proposedPoint;
        const movement = proposedState !== null && proposedState.identifier !== currentStateIdentifier
            ? `${text ( "chart.announcement.snappedToState" )} ` +
                stateNameFromChartIdentifier ( proposedState.identifier, currentNodes )
            : currentStateIdentifier !== null
                ? `${text ( "chart.announcement.detachedFromState" )} ` +
                    stateNameFromChartIdentifier ( currentStateIdentifier, currentNodes )
                : text ( "chart.announcement.moved" );
        const updatedNodes = replaceDraftTransitionEndpoint (
            currentNodes,
            endpointTarget.draftTransitionId,
            endpointTarget.endpoint,
            snappedPoint,
        );

        setNodes ( updatedNodes );
        announceDraftEndpointMovement (
            endpointTarget.draftTransitionId,
            endpointTarget.endpoint,
            snappedPoint,
            movement,
        );
        pendingKeyboardGeometryReference.current     = updatedNodes;
        pendingKeyboardFocusRequestReference.current = {
            kind: "draft-endpoint",
            identifier: draftEndpointFocusIdentifier ( endpointTarget.draftTransitionId, endpointTarget.endpoint ),
        };

        // Handle the case where keyboard commit timer reference current differs from an absent
        // value.

        if ( keyboardCommitTimerReference.current !== null )
        {
            window.clearTimeout ( keyboardCommitTimerReference.current );
        }

        keyboardCommitTimerReference.current = window.setTimeout ( flushKeyboardGeometry, KEYBOARD_COMMIT_DELAY );

        // Return the computed result.

        return true;
    }

    //----------------------------------------------------------------------------------------------
    // Function: moveSelectedNodes
    //
    // Description:
    //
    //   Moves the selected nodes.
    //
    // Parameters:
    //
    //   - event:
    //     The event to process.
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
    //----------------------------------------------------------------------------------------------

    function moveSelectedNodes ( event: KeyboardEvent<HTMLDivElement> ): boolean
    {
        // Initialize the local values needed by this operation.

        const horizontalDirection = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
        const verticalDirection   = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;

        // Handle the case where all required conditions are satisfied.

        if ( horizontalDirection === 0 && verticalDirection === 0 )
        {
            // Return the computed result.

            return false;
        }

        // Initialize the local values needed by this operation.

        const currentNodes          = flowInstance?.getNodes () ?? nodes;
        const focusedNodeIdentifier = event.target instanceof Element
            ? event.target.closest ( ".react-flow__node" )?.getAttribute ( "data-id" ) ?? null
            : null;
        const selectedIdentifiers = new Set ( [
            ...selectedNodeIdentifiers,
            ...currentNodes.filter ( node => node.selected ).map ( node => node.id ),
            ...( focusedNodeIdentifier === null ? [] : [ focusedNodeIdentifier ] ),
        ] );

        // Handle the case where selected identifiers size equals 0.

        if ( selectedIdentifiers.size === 0 )
        {
            // Return the computed result.

            return false;
        }

        const selectedNodes = currentNodes.filter ( node => selectedIdentifiers.has ( node.id ) );

        // Handle the case where selected nodes length equals 0.

        if ( selectedNodes.length === 0 )
        {
            // Return the computed result.

            return false;
        }

        // Handle the case where event alt key is enabled.

        if ( event.altKey )
        {
            // Initialize the local values needed by this operation.

            const selectedStateNodes  = selectedNodes.filter ( isStateNode );
            const resizableStateNodes = selectedStateNodes.filter ( node => node.data.viewModel.expanded );

            // Handle the case where selected state nodes length equals 0.

            if ( selectedStateNodes.length === 0 )
            {
                // Return the computed result.

                return false;
            }

            // Handle the case where at least one branch condition is satisfied.

            if ( horizontalDirection !== 0 || resizableStateNodes.length === 0 )
            {
                // Return the computed result.

                return true;
            }

            // Initialize the local values needed by this operation.

            const distance     = keyboardMovementDistance ( event.shiftKey );
            const resizedNodes = currentNodes.map ( node =>
            {
                // Handle the case where at least one branch condition is satisfied.

                if ( !selectedIdentifiers.has ( node.id ) || !isStateNode ( node ) ||
                    !node.data.viewModel.expanded )
                {
                    // Return the node.

                    return node;
                }

                // Calculate the height value from the current inputs.

                const height = Math.min (
                    MAXIMUM_CHART_STATE_DIMENSION,
                    Math.max (
                        node.data.viewModel.minimumHeight,
                        snapChartCoordinate ( node.data.viewModel.height + verticalDirection * distance ),
                    ),
                );

                // Return the assembled result.

                return {
                    ...node,
                    data:
                    {
                        ...node.data,
                        viewModel: { ...node.data.viewModel, height, savedHeight: height },
                    },
                    style: { ...node.style, height, width: node.data.viewModel.width },
                };
            } );

            setNodes ( resizedNodes );
            const resizedStateDescriptions = resizedNodes.flatMap ( node =>
                selectedIdentifiers.has ( node.id ) && isStateNode ( node ) && node.data.viewModel.expanded
                    ? [ `${node.data.viewModel.name}. ${chartStateHeightDescription (
                        node.data.viewModel.height,
                        node.data.viewModel.savedHeight,
                        node.data.viewModel.minimumHeight,
                    )}` ]
                    : [] );

            pendingKeyboardResizeAnnouncementReference.current =
                `${resizableStateNodes.length} ${text ( resizableStateNodes.length === 1
                    ? "chart.announcement.nodeResized"
                    : "chart.announcement.nodesResized" )} ` +
                `${text ( "chart.announcement.by" )} ${distance} ${text ( "chart.announcement.pixels" )}. ` +
                resizedStateDescriptions.join ( " " );
            pendingKeyboardGeometryReference.current = resizedNodes;
            const focusIdentifier = focusedNodeIdentifier ?? selectedNodeIdentifiers [ 0 ] ?? null;

            pendingKeyboardFocusRequestReference.current = focusIdentifier === null
                ? null
                : { kind: "node", identifier: focusIdentifier };

            // Handle the case where keyboard commit timer reference current differs from an absent
            // value.

            if ( keyboardCommitTimerReference.current !== null )
            {
                window.clearTimeout ( keyboardCommitTimerReference.current );
            }

            keyboardCommitTimerReference.current = window.setTimeout (
                flushKeyboardGeometry,
                KEYBOARD_COMMIT_DELAY,
            );

            // Return the computed result.

            return true;
        }

        // Initialize the local values needed by this operation.

        const distance   = keyboardMovementDistance ( event.shiftKey );
        const movedNodes = currentNodes.map ( node => selectedIdentifiers.has ( node.id )
            ? {
                ...node,
                position:
                {
                    x: snapChartCoordinate ( node.position.x + horizontalDirection * distance ),
                    y: snapChartCoordinate ( node.position.y + verticalDirection * distance ),
                },
            }
            : node );

        setNodes ( movedNodes );
        const direction = text ( horizontalDirection < 0
            ? "chart.announcement.left"
            : horizontalDirection > 0
                ? "chart.announcement.right"
                : verticalDirection < 0 ? "chart.announcement.up" : "chart.announcement.down" );

        properties.onAnnouncement (
            `${selectedNodes.length} ${text ( selectedNodes.length === 1
                ? "chart.announcement.nodeMoved"
                : "chart.announcement.nodesMoved" )} ${direction} ` +
            `${text ( "chart.announcement.by" )} ${distance} ${text ( "chart.announcement.pixels" )}.`,
        );
        pendingKeyboardGeometryReference.current = movedNodes;
        const focusIdentifier = focusedNodeIdentifier ?? selectedNodeIdentifiers [ 0 ] ?? null;

        pendingKeyboardFocusRequestReference.current = focusIdentifier === null
            ? null
            : { kind: "node", identifier: focusIdentifier };

        // Handle the case where keyboard commit timer reference current differs from an absent
        // value.

        if ( keyboardCommitTimerReference.current !== null )
        {
            window.clearTimeout ( keyboardCommitTimerReference.current );
        }

        keyboardCommitTimerReference.current = window.setTimeout ( flushKeyboardGeometry, KEYBOARD_COMMIT_DELAY );

        // Return the computed result.

        return true;
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

    function handleKeyboard ( event: KeyboardEvent<HTMLDivElement> ): void
    {
        // Handle the case where move focused draft endpoint result is enabled.

        if ( moveFocusedDraftEndpoint ( event ) )
        {
            event.preventDefault ();
            event.stopPropagation ();

            // Return control to the caller.

            return;
        }

        // Handle the case where all required conditions are satisfied.

        if ( event.shiftKey && event.key === "Enter" && event.target instanceof Element )
        {
            // Initialize the local values needed by this operation.

            const focusedNodeIdentifier = event.target.closest ( ".react-flow__node" )?.getAttribute ( "data-id" );
            const focusedNode           = nodes.find ( node => node.id === focusedNodeIdentifier );
            const primaryNode           = nodes.find ( node => node.id === primaryNodeIdentifierReference.current );

            // Handle the case where all required conditions are satisfied.

            if ( focusedNode !== undefined && primaryNode !== undefined &&
                attemptQuickConnection ( primaryNode, focusedNode ) )
            {
                event.preventDefault ();
                event.stopPropagation ();
                primaryNodeIdentifierReference.current = focusedNode.id;

                // Return control to the caller.

                return;
            }
        }

        // Handle the case where all required conditions are satisfied.

        if ( ( event.key === "Enter" || event.key === " " ) && event.target instanceof Element )
        {
            // Initialize the local values needed by this operation.

            const focusedNodeIdentifier = event.target.closest ( ".react-flow__node" )?.getAttribute ( "data-id" );
            const focusedNode           = nodes.find ( node => node.id === focusedNodeIdentifier );

            // Handle the case where all required conditions are satisfied.

            if ( focusedNode !== undefined && isIndicatorNode ( focusedNode ) && focusedNode.data.kind === "terminal" )
            {
                event.preventDefault ();
                event.stopPropagation ();
                openTerminalConnectionDialog ( focusedNode );

                // Return control to the caller.

                return;
            }

            // Handle the case where all required conditions are satisfied.

            if ( focusedNode !== undefined && ( isDraftTransitionNode ( focusedNode ) || isStateNode ( focusedNode ) ) )
            {
                event.preventDefault ();
                event.stopPropagation ();
                editNode ( focusedNode );

                // Return control to the caller.

                return;
            }

            // Initialize the local values needed by this operation.

            const focusedEdgeIdentifier = event.target.closest ( ".react-flow__edge" )?.getAttribute ( "data-id" );
            const focusedEdge           = edges.find ( edge => edge.id === focusedEdgeIdentifier );

            // Handle the case where all required conditions are satisfied.

            if ( focusedEdge !== undefined && focusedEdge.data?.kind === "transition" )
            {
                event.preventDefault ();
                event.stopPropagation ();
                editEdge ( focusedEdge );

                // Return control to the caller.

                return;
            }
        }

        // Handle the case where at least one branch condition is satisfied.

        if ( event.key === "Delete" || event.key === "Backspace" )
        {
            event.preventDefault ();
            event.stopPropagation ();
            requestDeleteSelection ();

            // Return control to the caller.

            return;
        }

        // Handle the case where move selected nodes result is enabled.

        if ( moveSelectedNodes ( event ) )
        {
            event.preventDefault ();
            event.stopPropagation ();

            // Return control to the caller.

            return;
        }

        // Handle the case where flow instance matches an absent value.

        if ( flowInstance === null )
        {
            // Return control to the caller.

            return;
        }

        // Handle the case where at least one branch condition is satisfied.

        if ( event.key === "+" || event.key === "=" )
        {
            event.preventDefault ();
            void flowInstance.zoomIn ();
        }
        else if ( event.key === "-" )
        {
            event.preventDefault ();
            void flowInstance.zoomOut ();
        }
        else if ( event.key === "Home" )
        {
            event.preventDefault ();
            void flowInstance.fitView ( { padding: 0.15 } );
        }
        else if ( [ "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown" ].includes ( event.key ) )
        {
            event.preventDefault ();
            const viewport = flowInstance.getViewport ();

            void flowInstance.setViewport ( {
                ...viewport,
                x: viewport.x + ( event.key === "ArrowLeft" ? -KEYBOARD_PAN_DISTANCE :
                    event.key === "ArrowRight" ? KEYBOARD_PAN_DISTANCE : 0 ),
                y: viewport.y + ( event.key === "ArrowUp" ? -KEYBOARD_PAN_DISTANCE :
                    event.key === "ArrowDown" ? KEYBOARD_PAN_DISTANCE : 0 ),
            } );
        }
    }

    //----------------------------------------------------------------------------------------------
    // Function: handleKeyboardCommit
    //
    // Description:
    //
    //   Handles keyboard commit.
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

    function handleKeyboardCommit ( event: KeyboardEvent<HTMLDivElement> ): void
    {
        // Handle the case where includes result is enabled.

        if ( [ "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown" ].includes ( event.key ) )
        {
            flushKeyboardGeometry ();
        }
    }

    //----------------------------------------------------------------------------------------------
    // Function: handleCanvasBlur
    //
    // Description:
    //
    //   Handles canvas blur.
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

    function handleCanvasBlur ( event: FocusEvent<HTMLDivElement> ): void
    {
        // Handle the case where all required conditions are satisfied.

        if ( event.relatedTarget instanceof Node && event.currentTarget.contains ( event.relatedTarget ) )
        {
            // Return control to the caller.

            return;
        }

        flushKeyboardGeometry ();
    }

    // Calculate the run automatic layout value from the current inputs.

    const runAutomaticLayout = useCallback ( async (): Promise<void> =>
    {
        // Handle the case where layout busy is enabled.

        if ( layoutBusy )
        {
            // Return control to the caller.

            return;
        }

        setLayoutBusy ( true );

        // Run the operation that may report a recoverable failure.

        try
        {
            // Initialize the local values needed by this operation.

            const gridSize                = properties.gridSize ?? DEFAULT_CHART_SETTINGS.gridSize;
            const automaticallySizedNodes = nodes.map ( node =>
            {
                // Handle the case where at least one branch condition is satisfied.

                if ( !isStateNode ( node ) || !node.data.viewModel.expanded )
                {
                    // Return the node.

                    return node;
                }

                // Initialize the local values needed by this operation.

                const savedHeight = Math.max (
                    gridSize,
                    Math.round ( node.data.viewModel.savedHeight / gridSize ) * gridSize,
                );
                const height = Math.max ( node.data.viewModel.minimumHeight, savedHeight );

                // Return the assembled result.

                return {
                    ...node,
                    data:
                    {
                        ...node.data,
                        viewModel: { ...node.data.viewModel, height, savedHeight },
                    },
                    style: { ...node.style, height, width: node.data.viewModel.width },
                };
            } );
            const stateNodes    = automaticallySizedNodes.filter ( isStateNode );
            const initialState  = properties.draft.stateMachine.initialState;
            const flowRootState = initialState ??
                properties.draft.stateMachine.transitionTable [ 0 ]?.state ??
                properties.draft.stateMachine.states [ 0 ]?.name ?? null;
            const layoutNodes: readonly ChartLayoutNode[] = stateNodes.map ( node => ( {
                state: node.data.viewModel.name,
                width: node.data.viewModel.width,
                height: node.data.viewModel.height,
                isInitial: node.data.viewModel.name === flowRootState,
            } ) );
            const stateOrder = new Map ( properties.draft.stateMachine.states.map (
                ( state, index ) => [ state.name, index ],
            ) );
            const degreeByState = new Map<string, number> ( layoutNodes.map ( node => [ node.state, 0 ] ) );

            properties.draft.stateMachine.transitionTable.forEach ( transition =>
            {
                degreeByState.set ( transition.state, ( degreeByState.get ( transition.state ) ?? 0 ) + 1 );
                degreeByState.set ( transition.stateNext, ( degreeByState.get ( transition.stateNext ) ?? 0 ) + 1 );
            } );

            // Initialize the local values needed by this operation.

            const initialNodes = flowRootState === null
                ? []
                : layoutNodes.filter ( node => node.state === flowRootState );
            const rankedNodes = layoutNodes.filter ( node => node.state !== flowRootState ).sort ( ( left, right ) =>
            {
                // Calculate the degree difference value from the current inputs.

                const degreeDifference = ( degreeByState.get ( right.state ) ?? 0 ) -
                    ( degreeByState.get ( left.state ) ?? 0 );

                // Return the result selected by the current condition.

                return degreeDifference !== 0
                    ? degreeDifference
                    : ( stateOrder.get ( left.state ) ?? 0 ) - ( stateOrder.get ( right.state ) ?? 0 );
            } );
            const centeredNodes: ChartLayoutNode[] = [];

            rankedNodes.forEach ( ( node, index ) =>
            {
                // Calculate the place after center value from the current inputs.

                const placeAfterCenter = index === 0 || index % 2 === 1;

                // Handle the case where place after center is enabled.

                if ( placeAfterCenter )
                {
                    centeredNodes.push ( node );
                }
                else
                {
                    // Handle the remaining case after the preceding condition is false.

                    centeredNodes.unshift ( node );
                }
            } );

            // Initialize the local values needed by this operation.

            const orderedNodes                            = [ ...initialNodes, ...centeredNodes ];
            const layoutEdges: readonly ChartLayoutEdge[] = properties.draft.stateMachine.transitionTable.map (
                transition =>
                {
                    // Initialize the local values needed by this operation.

                    const labelLines = wrapChartName ( transition.event, stableNameWrapping.eventNames );

                    // Return the assembled result.

                    return {
                        sourceState:      transition.state,
                        destinationState: transition.stateNext,
                        labelHeight:      Math.max ( 22, labelLines.length * 16 + 6 ),
                        labelWidth:       Math.max ( 28, ...labelLines.map ( line => line.length * 7 + 12 ) ),
                    };
                },
            );
            const requestedMinimumStateDistance =
                properties.minimumStateDistance ?? DEFAULT_CHART_SETTINGS.minimumStateDistance;
            const result = await properties.layoutPort.layout ( orderedNodes, layoutEdges, {
                gridSize,
                minimumStateDistance: requestedMinimumStateDistance,
            } );

            // The layout raises its own target when the current state geometry would otherwise
            // permit two states to overlap. Report that once per run so the rendered separation
            // never silently disagrees with the setting.

            if ( result.effectiveMinimumStateDistance > requestedMinimumStateDistance )
            {
                properties.onLayoutDiagnostic?.(
                    text ( "chart.layout.minimumStateDistanceRaised" )
                        .replace ( "{requested}", String ( requestedMinimumStateDistance ) )
                        .replace ( "{applied}", String ( Math.ceil ( result.effectiveMinimumStateDistance ) ) ),
                );
            }

            // Initialize the local values needed by this operation.

            const positionedByState = new Map ( result.states.map ( state => [ state.state, state ] ) );
            const laidOutStateNodes = automaticallySizedNodes.map ( node =>
            {
                // Handle the case where the is state node result condition is not satisfied.

                if ( !isStateNode ( node ) )
                {
                    // Return the node.

                    return node;
                }

                const position = positionedByState.get ( node.data.viewModel.name );

                // Handle the case where at least one branch condition is satisfied.

                if ( position === undefined || ( node.position.x === position.x && node.position.y === position.y ) )
                {
                    // Return the node.

                    return node;
                }

                // Return the assembled result.

                return { ...node, position: { x: position.x, y: position.y } };
            } );
            const laidOutStateByName = new Map ( laidOutStateNodes.flatMap ( node => isStateNode ( node )
                ? [ [ node.data.viewModel.name, node ] as const ]
                : [] ) );

            //--------------------------------------------------------------------------------------
            // Function: alignLayoutCoordinate
            //
            // Description:
            //
            //   Aligns the layout coordinate.
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
            //--------------------------------------------------------------------------------------

            const alignLayoutCoordinate = ( value: number ): number =>
                Math.round ( value / gridSize ) * gridSize;

            // An indicator's grid alignment is defined on its centre, not on the corner the layout
            // works in, so the requested corner is converted to a centre, aligned, and converted
            // back. Automatic Layout then produces the same alignment a user gets by dragging one.

            //--------------------------------------------------------------------------------------
            // Function: alignIndicatorLayoutPosition
            //
            // Description:
            //
            //   Aligns the indicator layout position.
            //
            // Parameters:
            //
            //   - position:
            //     The position supplied to the operation.
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
            //--------------------------------------------------------------------------------------

            const alignIndicatorLayoutPosition = ( position: ChartPoint ): ChartPoint =>
                flowPositionFromStoredIndicator ( {
                    x: alignLayoutCoordinate ( position.x + CHART_INDICATOR_SIZE / 2 ),
                    y: alignLayoutCoordinate ( position.y + CHART_INDICATOR_SIZE / 2 ),
                } );
            const stateRectangles = [ ...laidOutStateByName.values () ].map ( chartNodeRectangle );
            const shelfLeft       = alignLayoutCoordinate ( Math.max (
                0,
                ...stateRectangles.map ( rectangle => rectangle.x + rectangle.width ),
            ) + gridSize * 4 );
            const shelfTop = alignLayoutCoordinate ( Math.min (
                0,
                ...stateRectangles.map ( rectangle => rectangle.y ),
            ) );
            const deleteOrphanedItems = properties.deleteOrphanedChartItemsDuringAutomaticLayout ??
                DEFAULT_CHART_SETTINGS.deleteOrphanedChartItemsDuringAutomaticLayout;
            const initialAttachment = properties.draft.chart.indicators.initialStateIndicator?.state === undefined
                ? properties.draft.stateMachine.initialState
                : properties.draft.chart.indicators.initialStateIndicator.state;
            const terminalSourceStatesByIdentifier = new Map<number, string[]> ();

            properties.draft.chart.indicators.terminalStateTransitions.forEach ( relation =>
            {
                // Initialize the local values needed by this operation.

                const sourceStates = terminalSourceStatesByIdentifier.get ( relation.terminalStateIndicatorId ) ?? [];

                sourceStates.push ( relation.state );
                terminalSourceStatesByIdentifier.set ( relation.terminalStateIndicatorId, sourceStates );
            } );

            // Initialize the local values needed by this operation.

            const draftEndpoints = deleteOrphanedItems
                ? []
                : laidOutStateNodes.flatMap ( node => isDraftTransitionNode ( node )
                    ? [
                        {
                            x: node.position.x + node.data.source.x,
                            y: node.position.y + node.data.source.y,
                        },
                        {
                            x: node.position.x + node.data.target.x,
                            y: node.position.y + node.data.target.y,
                        },
                    ]
                    : [] );
            const occupiedRectangles                  = [ ...stateRectangles ];
            const placedIndicatorPositionByIdentifier = new Map<string, ChartPoint> ();
            const removedIndicatorIdentifiers         = new Set<string> ();
            let orphanShelfIndex                      = 0;

            //--------------------------------------------------------------------------------------
            // Function: nextOrphanShelfPosition
            //
            // Description:
            //
            //   Advances the orphan shelf position.
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
            //--------------------------------------------------------------------------------------

            const nextOrphanShelfPosition = (): ChartPoint =>
            {
                // Calculate the position value from the current inputs.

                const position = alignIndicatorLayoutPosition ( {
                    x: shelfLeft,
                    y: shelfTop + orphanShelfIndex * ( CHART_INDICATOR_SIZE + gridSize ),
                } );

                orphanShelfIndex += 1;

                // Return the position.

                return position;
            };

            //--------------------------------------------------------------------------------------
            // Function: placeIndicatorWithoutCollision
            //
            // Description:
            //
            //   Places the indicator without collision.
            //
            // Parameters:
            //
            //   - requestedPosition:
            //     The requested position supplied to the operation.
            //
            //   - verticalDirection:
            //     The vertical direction supplied to the operation.
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
            //--------------------------------------------------------------------------------------

            const placeIndicatorWithoutCollision = ( requestedPosition: ChartPoint, verticalDirection: -1 | 1 ):
                ChartPoint =>
            {
                // Initialize the local values needed by this operation.

                let position          = requestedPosition;
                const maximumAttempts = occupiedRectangles.length + draftEndpoints.length + 1;

                // Repeat the operation across the bounded iteration range.

                for ( let attempt = 0; attempt < maximumAttempts; attempt += 1 )
                {
                    // Initialize the local values needed by this operation.

                    const rectangle = {
                        x: position.x,
                        y: position.y,
                        width: CHART_INDICATOR_SIZE,
                        height: CHART_INDICATOR_SIZE,
                    };
                    const collidingRectangles = occupiedRectangles.filter ( occupied =>
                        chartRectanglesIntersect ( rectangle, occupied ) );
                    const containedDraftEndpoints = draftEndpoints.filter ( endpoint =>
                        chartRectangleContainsPoint ( rectangle, endpoint ) );

                    // Handle the case where all required conditions are satisfied.

                    if ( collidingRectangles.length === 0 && containedDraftEndpoints.length === 0 )
                    {
                        occupiedRectangles.push ( rectangle );

                        // Return the position.

                        return position;
                    }

                    // Handle the case where vertical direction exceeds the 0 value.

                    if ( verticalDirection > 0 )
                    {
                        // Calculate the next top value from the current inputs.

                        const nextTop = Math.max (
                            ...collidingRectangles.map ( occupied => occupied.y + occupied.height ),
                            ...containedDraftEndpoints.map ( endpoint => endpoint.y ),
                        );

                        position = { ...position, y: Math.ceil ( nextTop / gridSize ) * gridSize };
                    }
                    else
                    {
                        // Handle the remaining case after the preceding condition is false.

                        const nextBottom = Math.min (
                            ...collidingRectangles.map ( occupied => occupied.y ),
                            ...containedDraftEndpoints.map ( endpoint => endpoint.y ),
                        );

                        position = {
                            ...position,
                            y: Math.floor ( ( nextBottom - CHART_INDICATOR_SIZE ) / gridSize ) * gridSize,
                        };
                    }
                }

                throw new Error ( "Automatic Chart layout could not place an indicator without a collision." );
            };
            const orderedIndicatorNodes = laidOutStateNodes.filter ( isIndicatorNode ).sort ( ( left, right ) =>
            {
                // Handle the case where kind differs from kind.

                if ( left.data.kind !== right.data.kind )
                {
                    // Return the result selected by the current condition.

                    return left.data.kind === "initial" ? -1 : 1;
                }

                // Return the computed result.

                return ( left.data.indicatorId ?? -1 ) - ( right.data.indicatorId ?? -1 );
            } );

            orderedIndicatorNodes.forEach ( node =>
            {
                // Handle the case where kind matches the initial value.

                if ( node.data.kind === "initial" )
                {
                    // Handle the case where initial attachment matches an absent value.

                    if ( initialAttachment === null )
                    {
                        // Handle the case where delete orphaned items is enabled.

                        if ( deleteOrphanedItems )
                        {
                            removedIndicatorIdentifiers.add ( node.id );

                            // Return control to the caller.

                            return;
                        }

                        placedIndicatorPositionByIdentifier.set (
                            node.id,
                            placeIndicatorWithoutCollision ( nextOrphanShelfPosition (), 1 ),
                        );

                        // Return control to the caller.

                        return;
                    }

                    const targetNode = laidOutStateByName.get ( initialAttachment );

                    // Handle the case where target node matches undefined.

                    if ( targetNode === undefined )
                    {
                        placedIndicatorPositionByIdentifier.set ( node.id, node.position );

                        // Return control to the caller.

                        return;
                    }

                    // Initialize the local values needed by this operation.

                    const targetRectangle   = chartNodeRectangle ( targetNode );
                    const requestedPosition = alignIndicatorLayoutPosition ( {
                        x: targetRectangle.x + targetRectangle.width / 2 - CHART_INDICATOR_SIZE / 2,
                        y: targetRectangle.y - gridSize - CHART_ROUTE_CLEARANCE - CHART_INDICATOR_SIZE,
                    } );

                    placedIndicatorPositionByIdentifier.set (
                        node.id,
                        placeIndicatorWithoutCollision ( requestedPosition, -1 ),
                    );

                    // Return control to the caller.

                    return;
                }

                const sourceStateNames = node.data.indicatorId === null
                    ? []
                    : terminalSourceStatesByIdentifier.get ( node.data.indicatorId ) ?? [];

                // Handle the case where source state names length equals 0.

                if ( sourceStateNames.length === 0 )
                {
                    // Handle the case where delete orphaned items is enabled.

                    if ( deleteOrphanedItems )
                    {
                        removedIndicatorIdentifiers.add ( node.id );

                        // Return control to the caller.

                        return;
                    }

                    placedIndicatorPositionByIdentifier.set (
                        node.id,
                        placeIndicatorWithoutCollision ( nextOrphanShelfPosition (), 1 ),
                    );

                    // Return control to the caller.

                    return;
                }

                const sourceRectangles = sourceStateNames.flatMap ( stateName =>
                {
                    // Initialize the local values needed by this operation.

                    const sourceNode = laidOutStateByName.get ( stateName );

                    // Return the result selected by the current condition.

                    return sourceNode === undefined ? [] : [ chartNodeRectangle ( sourceNode ) ];
                } );

                // Handle the case where source rectangles length equals 0.

                if ( sourceRectangles.length === 0 )
                {
                    placedIndicatorPositionByIdentifier.set ( node.id, node.position );

                    // Return control to the caller.

                    return;
                }

                // Initialize the local values needed by this operation.

                const horizontalCenter = ( Math.min ( ...sourceRectangles.map ( rectangle => rectangle.x ) ) +
                    Math.max ( ...sourceRectangles.map ( rectangle => rectangle.x + rectangle.width ) ) ) / 2;
                const lowestEdge        = Math.max ( ...sourceRectangles.map ( rectangle => rectangle.y + rectangle.height ) );
                const requestedPosition = alignIndicatorLayoutPosition ( {
                    x: horizontalCenter - CHART_INDICATOR_SIZE / 2,
                    y: lowestEdge + gridSize + CHART_ROUTE_CLEARANCE,
                } );

                placedIndicatorPositionByIdentifier.set (
                    node.id,
                    placeIndicatorWithoutCollision ( requestedPosition, 1 ),
                );
            } );

            // Initialize the local values needed by this operation.

            const laidOutNodes = laidOutStateNodes.flatMap<StateChartNode> ( ( node ): StateChartNode[] =>
            {
                // Handle the case where is draft transition node result is enabled.

                if ( isDraftTransitionNode ( node ) )
                {
                    // Return the result selected by the current condition.

                    return deleteOrphanedItems ? [] : [ node ];
                }

                // Handle the case where the is indicator node result condition is not satisfied.

                if ( !isIndicatorNode ( node ) )
                {
                    // Return the assembled result collection.

                    return [ node ];
                }

                // Handle the case where has result is enabled.

                if ( removedIndicatorIdentifiers.has ( node.id ) )
                {
                    // Return the assembled result collection.

                    return [];
                }

                // Return the assembled result collection.

                return [ { ...node, position: placedIndicatorPositionByIdentifier.get ( node.id ) ?? node.position } ];
            } );
            const geometryChanged = laidOutNodes.length !== nodes.length || laidOutNodes.some ( ( node, index ) =>
            {
                // Initialize the local values needed by this operation.

                const currentNode = nodes [ index ];

                // Return the computed result.

                return currentNode === undefined || node.id !== currentNode.id ||
                    node.position.x !== currentNode.position.x || node.position.y !== currentNode.position.y ||
                    isStateNode ( node ) && isStateNode ( currentNode ) &&
                    node.data.viewModel.savedHeight !== currentNode.data.viewModel.savedHeight;
            } );

            // Handle the case where geometry changed is enabled.

            if ( geometryChanged )
            {
                setNodes ( laidOutNodes );

                // Handle the case where commit geometry result is enabled.

                if ( commitGeometry ( laidOutNodes, deleteOrphanedItems ) )
                {
                    properties.onFocusAfterRevision ( { kind: "control", identifier: "automatic-layout" } );
                }
            }

            window.setTimeout ( () => void flowInstance?.fitView ( { padding: 0.15 } ), 0 );
        }
        catch ( error )
        {
            // Recover from the reported failure without hiding its outcome.

            properties.onInteractionError ( error instanceof Error ? error.message : text ( "chart.layout.failed" ) );
        }
        finally
        {
            // Complete the cleanup required after the attempted operation.

            setLayoutBusy ( false );
        }
    }, [ commitGeometry, flowInstance, layoutBusy, nodes, properties, stableNameWrapping.eventNames ] );

    // Handle the case where the graph within interactive limit condition is not satisfied.

    if ( !graphWithinInteractiveLimit )
    {
        // Return the rendered interface.

        return (
            <section className="chart-large-graph" role="status">
                <h2>{ text ( "chart.largeGraph.title" ) }</h2>
                <p>{ text ( "chart.largeGraph.description" ) }</p>
                <dl>
                    <div><dt>{ text ( "chart.largeGraph.nodes" ) }</dt><dd>{ chartNodeCount }</dd></div>
                    <div><dt>{ text ( "chart.largeGraph.relations" ) }</dt><dd>{ chartRelationCount }</dd></div>
                </dl>
            </section>
        );
    }

    // Initialize the local values needed by this operation.

    const connectedTerminalStateNames = new Set (
        properties.draft.chart.indicators.terminalStateTransitions.map ( relation => relation.state ),
    );
    const terminalConnectionOptions = chartRelationCount >= MAXIMUM_INTERACTIVE_CHART_EDGE_COUNT
        ? []
        : properties.draft.stateMachine.states.flatMap ( state =>
            connectedTerminalStateNames.has ( state.name ) ? [] : [ { identifier: state.name, label: state.name } ] );
    const terminalConnectionEmptyMessage = chartRelationCount >= MAXIMUM_INTERACTIVE_CHART_EDGE_COUNT
        ? text ( "chart.limit.relations" )
        : text ( "chart.terminalConnection.empty" );
    const interactiveNodes = nodes.map ( node => isStateNode ( node )
        ? {
            ...node,
            data:
            {
                ...node.data,
                onResizeEnd: ( parameters: ResizeParams ) =>
                    handleStateResizeEnd ( node.data.viewModel.name, parameters ),
            },
        }
        : node );
    const chartGridStyle = properties.gridStyle ?? DEFAULT_CHART_SETTINGS.gridStyle;
    const chartGridSize  = properties.gridSize ?? DEFAULT_CHART_SETTINGS.gridSize;

    // Return the rendered interface.

    return (
        <>
            <div
                aria-label={ text ( "chart.canvas" ) }
                aria-describedby="chart-keyboard-instructions"
                className        = "chart-canvas"
                onBlurCapture    = { handleCanvasBlur }
                onDragOver       = { event => event.preventDefault () }
                onDrop           = { handleDrop }
                onKeyDownCapture = { handleKeyboard }
                onKeyUpCapture   = { handleKeyboardCommit }
                ref              = { wrapperReference }
                role             = "region"
                tabIndex         = { 0 }
            >
                <p className="visually-hidden" id="chart-keyboard-instructions">{ text ( "chart.instructions" ) }</p>
                <ReactFlow<StateChartNode, StateChartEdge>
                    { ...( initialViewport === null
                        ? {}
                        : { defaultViewport: initialViewport } ) }
                    attributionPosition="top-right"
                    aria-describedby="chart-keyboard-instructions"
                    ariaLabelConfig      = { CHART_ARIA_LABEL_CONFIG }
                    connectionLineType   = { ConnectionLineType.Straight }
                    connectionMode       = { ConnectionMode.Loose }
                    defaultMarkerColor   = "var(--text-muted)"
                    deleteKeyCode        = { null }
                    edgeTypes            = { CHART_EDGE_TYPES }
                    edges                = { edges }
                    edgesReconnectable   = { false }
                    elevateEdgesOnSelect = { false }
                    elevateNodesOnSelect = { false }
                    elementsSelectable
                    fitView               = { initialViewport === null }
                    fitViewOptions        = { { padding: 0.15 } }
                    minZoom               = { COMPILE_TIME_CONFIGURATION.chart.viewport.minimumZoom }
                    multiSelectionKeyCode = { [ "Control", "Meta" ] }
                    nodeTypes             = { CHART_NODE_TYPES }
                    nodes                 = { interactiveNodes }
                    onConnect             = { handleConnect }
                    onEdgeContextMenu     = { ( event, edge ) =>
                    {
                        event.preventDefault ();
                        editEdge ( edge );
                    } }
                    onEdgeDoubleClick = { ( _event, edge ) => editEdge ( edge ) }
                    onEdgesChange     = { handleEdgesChange }
                    onInit            = { instance =>
                    {
                        setFlowInstance ( instance );

                        // Handle the case where initial viewport differs from an absent value.

                        if ( initialViewport !== null )
                        {
                            properties.onViewportRestored ();
                        }
                    } }
                    onNodeContextMenu = { handleNodeContextMenu }
                    onNodeClick       = { handleNodeClick }
                    onNodeDoubleClick = { ( _event, node ) => editNode ( node ) }
                    onNodeDragStop    = { ( _event, node ) =>
                    {
                        // Initialize the local values needed by this operation.

                        const preserveViewport = isStateNode ( node ) && flowInstance !== null;

                        // Handle the case where preserve viewport is enabled.

                        if ( preserveViewport )
                        {
                            properties.onPreserveViewport ( flowInstance.getViewport () );
                        }

                        // Handle the case where commit geometry result is enabled.

                        if ( commitGeometry ( flowInstance?.getNodes () ?? nodes ) )
                        {
                            properties.onFocusAfterRevision ( { kind: "node", identifier: node.id } );
                        }
                        else if ( preserveViewport )
                        {
                            properties.onPreserveViewport ( null );
                        }
                    } }
                    onNodesChange     = { handleNodesChange }
                    onSelectionChange = { handleSelectionChange }
                    panOnDrag         = { [ 0, 1 ] }
                    snapGrid          = { [
                        properties.gridSize ?? DEFAULT_CHART_SETTINGS.gridSize,
                        properties.gridSize ?? DEFAULT_CHART_SETTINGS.gridSize,
                    ] }
                    snapToGrid    = { properties.snapToGrid ?? false }
                    selectionMode = { SelectionMode.Partial }
                    selectionOnDrag
                    zoomOnDoubleClick = { false }
                    zIndexMode        = "manual"
                >
                    { ( properties.showGrid ?? DEFAULT_CHART_SETTINGS.showGrid ) && (
                        <Background
                            className = { chartGridClassName ( chartGridStyle ) }
                            color     = { properties.gridColor ?? "currentColor" }
                            gap       = { chartGridSize }
                            offset    = { chartGridPatternOffset ( chartGridStyle, chartGridSize ) }
                            size      = { CHART_GRID_DOT_SIZE }
                            variant   = { chartGridStyle === "Dots" ? BackgroundVariant.Dots : BackgroundVariant.Lines }
                        />
                    ) }
                    <Controls position="bottom-right" showFitView={ false } showInteractive={ false } />
                    <ViewportPortal>
                        <svg aria-hidden="true" height="0" width="0">
                            <defs>
                                <TransitionArrowMarkerDefinition
                                    identifier = { TRANSITION_ARROW_MARKER_IDENTIFIER }
                                    size       = { properties.transitionArrowHeadSize ??
                                        DEFAULT_CHART_SETTINGS.transitionArrowHeadSize }
                                />
                            </defs>
                        </svg>
                        { ( DEBUG_CONFIGURATION.transitionHiddenLinesVisible ||
                            DEBUG_CONFIGURATION.transitionLineConnectorsVisible ) && (
                            <svg
                                aria-hidden="true"
                                className="chart-transition-debug-overlay"
                                data-chart-debug-overlay="true"
                            >
                                { edges.flatMap ( edge =>
                                {
                                    // Initialize the local values needed by this operation.

                                    const geometry = configuredRelationDebugGeometry ( edge, nodes );

                                    // Handle the case where geometry matches an absent value.

                                    if ( geometry === null )
                                    {
                                        // Return the assembled result collection.

                                        return [];
                                    }

                                    // Return the assembled result collection.

                                    return [ (
                                        <g key={ `debug-${edge.id}` }>
                                            { DEBUG_CONFIGURATION.transitionHiddenLinesVisible && (
                                                <>
                                                    <line
                                                        data-chart-transition-hidden-line="source"
                                                        stroke          = { DEBUG_CONFIGURATION.transitionHiddenLinesColor }
                                                        strokeDasharray = { DEBUG_CONFIGURATION.transitionHiddenLinesDashPattern }
                                                        strokeLinecap   = "round"
                                                        x1              = { geometry.sourceCenter.x }
                                                        x2              = { geometry.sourceEdge.x }
                                                        y1              = { geometry.sourceCenter.y }
                                                        y2              = { geometry.sourceEdge.y }
                                                    />
                                                    <line
                                                        data-chart-transition-hidden-line="target"
                                                        stroke          = { DEBUG_CONFIGURATION.transitionHiddenLinesColor }
                                                        strokeDasharray = { DEBUG_CONFIGURATION.transitionHiddenLinesDashPattern }
                                                        strokeLinecap   = "round"
                                                        x1              = { geometry.targetCenter.x }
                                                        x2              = { geometry.targetEdge.x }
                                                        y1              = { geometry.targetCenter.y }
                                                        y2              = { geometry.targetEdge.y }
                                                    />
                                                </>
                                            ) }
                                            { DEBUG_CONFIGURATION.transitionLineConnectorsVisible && (
                                                <>
                                                    <circle
                                                        cx = { geometry.sourceCenter.x }
                                                        cy = { geometry.sourceCenter.y }
                                                        data-chart-transition-connector="source"
                                                        fill = { DEBUG_CONFIGURATION.transitionLineConnectorColor }
                                                        r    = { DEBUG_CONFIGURATION.transitionLineConnectorRadius }
                                                    />
                                                    <circle
                                                        cx = { geometry.targetCenter.x }
                                                        cy = { geometry.targetCenter.y }
                                                        data-chart-transition-connector="target"
                                                        fill = { DEBUG_CONFIGURATION.transitionLineConnectorColor }
                                                        r    = { DEBUG_CONFIGURATION.transitionLineConnectorRadius }
                                                    />
                                                </>
                                            ) }
                                        </g>
                                    ) ];
                                } ) }
                            </svg>
                        ) }
                        {
                            // Drag refs are read only by the pointer handlers created inside this
                            // render map.
                            // eslint-disable-next-line react-hooks/refs
                            edges.flatMap ( edge =>
                        {
                            // Handle the case where at least one branch condition is satisfied.

                            if ( edge.data?.kind !== "transition" ||
                                ( !edge.selected && !selectedEdgeIdentifiers.includes ( edge.id ) ) )
                            {
                                // Return the assembled result collection.

                                return [];
                            }

                            const geometry = semanticEdgeGeometry ( edge, nodes );

                            // Handle the case where geometry matches an absent value.

                            if ( geometry === null )
                            {
                                // Return the assembled result collection.

                                return [];
                            }

                            const transitionIdentity = `${edge.data.state}, ${edge.data.event}, ${edge.data.stateNext}`;

                            // Return the mapped collection.

                            return ( [ "source", "target" ] as const ).map ( endpoint =>
                            {
                                // Initialize the local values needed by this operation.

                                const preview = semanticEndpointPreview?.edgeIdentifier === edge.id &&
                                    semanticEndpointPreview.endpoint === endpoint
                                    ? semanticEndpointPreview.point
                                    : null;
                                const point = preview ?? geometry [ endpoint ];

                                // Return the rendered interface.

                                return (
                                    <button
                                        aria-label={ `${text ( endpoint === "source"
                                            ? "chart.transition.sourceEndpoint"
                                            : "chart.transition.targetEndpoint" )} ${transitionIdentity}` }
                                        className="chart-transition-endpoint nodrag nopan"
                                        data-chart-focus-id={ transitionEndpointFocusIdentifier ( edge.id, endpoint ) }
                                        data-transition-edge-id={ edge.id }
                                        data-transition-endpoint={ endpoint }
                                        key     = { `${edge.id}-${endpoint}` }
                                        onClick = { event =>
                                        {
                                            // Handle the case where event detail matches the 0
                                            // value.

                                            if ( event.detail === 0 )
                                            {
                                                editEdge ( edge );
                                            }
                                        } }
                                        onPointerCancel = { event => finishSemanticEndpointPointerMove ( event, edge, true ) }
                                        onPointerDown   = { event => handleSemanticEndpointPointerDown ( event, edge, endpoint ) }
                                        onPointerMove   = { handleSemanticEndpointPointerMove }
                                        onPointerUp     = { event => finishSemanticEndpointPointerMove ( event, edge, false ) }
                                        style           = { { left: point.x, top: point.y } }
                                        type            = "button"
                                    />
                                );
                            } );
                        } ) }
                        { nodes.flatMap ( node =>
                        {
                            // Handle the case where the is draft transition node result condition
                            // is not satisfied.

                            if ( !isDraftTransitionNode ( node ) )
                            {
                                // Return the assembled result collection.

                                return [];
                            }

                            const transition = draftTransitionFromNode ( node );

                            // Return the mapped collection.

                            return ( [ "source", "target" ] as const ).map ( endpoint =>
                            {
                                // Initialize the local values needed by this operation.

                                const drag = activeDraftEndpointDrag?.draftTransitionId === transition.id &&
                                    activeDraftEndpointDrag.endpoint === endpoint
                                    ? activeDraftEndpointDrag
                                    : null;
                                const endpointPoint = transition [ endpoint ];
                                const point         = drag === null
                                    ? endpointControlPoint ( transition.source, transition.target, endpoint )
                                    : {
                                        x: endpointPoint.x + drag.displayOffset.x,
                                        y: endpointPoint.y + drag.displayOffset.y,
                                    };

                                // Return the rendered interface.

                                return (
                                    <button
                                        aria-label={ `${text ( endpoint === "source"
                                            ? "chart.draftTransition.sourceEndpoint"
                                            : "chart.draftTransition.targetEndpoint" )} ${transition.id}` }
                                        className="chart-draft-transition-endpoint nodrag nopan"
                                        data-chart-focus-id={ draftEndpointFocusIdentifier ( transition.id, endpoint ) }
                                        data-draft-endpoint={ endpoint }
                                        data-draft-transition-id={ transition.id }
                                        key             = { `${transition.id}-${endpoint}` }
                                        onPointerCancel = { event => finishDraftEndpointPointerMove ( event, true ) }
                                        onPointerDown   = { handleDraftEndpointPointerDown }
                                        onPointerMove   = { handleDraftEndpointPointerMove }
                                        onPointerUp     = { event => finishDraftEndpointPointerMove ( event, false ) }
                                        style           = { { left: point.x, top: point.y } }
                                        type            = "button"
                                    />
                                );
                            } );
                        } ) }
                    </ViewportPortal>
                </ReactFlow>
            </div>
            <div className="chart-footer">
                <div className="detail-button-panel chart-command-panel">
                    <button
                        data-chart-focus-id="automatic-layout"
                        disabled = { layoutBusy || nodes.length === 0 }
                        onClick  = { () => void runAutomaticLayout () }
                        type     = "button"
                    >
                        { layoutBusy ? text ( "chart.layout.running" ) : text ( "chart.layout.automatic" ) }
                    </button>
                    <button disabled={ flowInstance === null || nodes.length === 0 } onClick={ () => void flowInstance?.fitView ( { padding: 0.15 } ) } type="button">
                        { text ( "chart.fit" ) }
                    </button>
                    <button
                        disabled = { flowInstance === null || nodes.length === 0 }
                        onClick  = { event =>
                        {
                            // Initialize the local values needed by this operation.

                            const button = event.currentTarget;

                            void Promise.resolve ( properties.onSaveAsImage?. ( wrapperReference.current ?? button ) )
                                .finally ( () => button.focus () );
                        } }
                        type="button"
                    >
                        { text ( "chart.saveAsImage" ) }
                    </button>
                </div>
            </div>
            { pendingStateDialog !== null && (
                <NamedEntityDialog
                initialValue = { pendingStateDialog.initialValue }
                key          = { stateDialogSession }
                onClose      = { () => setStateDialogOpen ( false ) }
                onConfirm    = { entity =>
                {
                    // Handle the case where pending state dialog matches an absent value.

                    if ( pendingStateDialog === null )
                    {
                        // Return the computed result.

                        return false;
                    }

                    const commandCommitted = pendingStateDialog.mode === "add" && pendingStateDialog.point !== null
                        ? properties.onCommand ( expectedRevision => ( {
                            kind: "add_entity",
                            entityKind: "state",
                            entity,
                            chartPlacement:
                            {
                                state: entity.name,
                                x: pendingStateDialog.point?.x ?? 0,
                                y: pendingStateDialog.point?.y ?? 0,
                            },
                            expectedRevision,
                        } ) )
                        : pendingStateDialog.originalName !== null
                            ? properties.onCommand ( expectedRevision => ( {
                                kind: "update_entity",
                                entityKind: "state",
                                previousName: pendingStateDialog.originalName ?? entity.name,
                                entity,
                                expectedRevision,
                            } ) )
                            : false;

                    // Handle the case where command committed is enabled.

                    if ( commandCommitted )
                    {
                        properties.onFocusAfterRevision ( {
                            kind: "node",
                            identifier: stateNodeIdentifier ( entity.name ),
                        } );
                    }

                    // Return the command committed.

                    return commandCommitted;
                } }
                open={ stateDialogOpen }
                />
            ) }
            <SelectionDialog
                description={ pendingTerminalConnectionIndicatorId === null
                    ? undefined
                    : `${text ( "chart.terminalConnection.description" )} ` +
                        `${text ( "chart.palette.terminal" )} ${pendingTerminalConnectionIndicatorId}.` }
                emptyMessage = { terminalConnectionEmptyMessage }
                label        = { text ( "chart.terminalConnection.state" ) }
                onClose      = { () => setPendingTerminalConnectionIndicatorId ( null ) }
                onConfirm    = { stateName =>
                {
                    // Handle the case where the has interactive relation capacity condition is not
                    // satisfied.

                    if ( !hasInteractiveRelationCapacity )
                    {
                        properties.onInteractionError ( text ( "chart.limit.relations" ) );

                        // Return the computed result.

                        return false;
                    }

                    // Handle the case where pending terminal connection indicator identifier
                    // matches an absent value.

                    if ( pendingTerminalConnectionIndicatorId === null )
                    {
                        // Return the computed result.

                        return false;
                    }

                    // Initialize the local values needed by this operation.

                    const indicatorId      = pendingTerminalConnectionIndicatorId;
                    const commandCommitted = properties.onCommand ( expectedRevision => ( {
                        kind: "connect_chart_terminal_indicator",
                        state: stateName,
                        indicatorId,
                        expectedRevision,
                    } ) );

                    // Handle the case where command committed is enabled.

                    if ( commandCommitted )
                    {
                        properties.onFocusAfterRevision ( {
                            kind: "node",
                            identifier: terminalIndicatorNodeIdentifier ( indicatorId ),
                        } );
                    }

                    // Return the command committed.

                    return commandCommitted;
                } }
                open    = { pendingTerminalConnectionIndicatorId !== null }
                options = { terminalConnectionOptions }
                title   = { text ( "chart.terminalConnection.title" ) }
            />
            { pendingTransitionDialog !== null && (
                <TransitionDialog
                    events       = { properties.draft.stateMachine.events.map ( event => event.name ) }
                    initialValue = { pendingTransitionDialog.initialValue }
                    key          = { transitionDialogSession }
                    onClose      = { closeTransitionDialog }
                    onConfirm    = { transition =>
                    {
                        // Handle the case where pending transition dialog matches an absent value.

                        if ( pendingTransitionDialog === null )
                        {
                            // Return the computed result.

                            return false;
                        }

                        // Handle the case where all required conditions are satisfied.

                        if ( pendingTransitionDialog.index === null && pendingTransitionDialog.draftTransitionId === null &&
                            !hasInteractiveRelationCapacity )
                        {
                            properties.onInteractionError ( text ( "chart.limit.relations" ) );

                            // Return the computed result.

                            return false;
                        }

                        const chartStatePlacements = missingTransitionPlacements ( transition );

                        // Handle the case where pending transition dialog draft transition
                        // identifier differs from an absent value.

                        if ( pendingTransitionDialog.draftTransitionId !== null )
                        {
                            // Initialize the local values needed by this operation.

                            const draftTransitionId = pendingTransitionDialog.draftTransitionId;
                            const commandCommitted  = properties.onCommand ( expectedRevision => ( {
                                kind: "configure_chart_draft_transition",
                                draftTransitionId,
                                transition,
                                chartStatePlacements,
                                expectedRevision,
                            } ) );

                            // Handle the case where command committed is enabled.

                            if ( commandCommitted )
                            {
                                properties.onFocusAfterRevision ( {
                                    kind: "edge",
                                    identifier: transitionEdgeIdentifier ( transition.state, transition.event ),
                                } );
                            }

                            // Return the command committed.

                            return commandCommitted;
                        }

                        const commandCommitted = properties.onCommand ( expectedRevision =>
                            pendingTransitionDialog.index === null
                            ? {
                                kind: "add_transition",
                                transition,
                                chartStatePlacements,
                                expectedRevision,
                            }
                            : {
                                kind: "update_transition",
                                index: pendingTransitionDialog.index,
                                transition,
                                chartStatePlacements,
                                expectedRevision,
                            } );

                        // Handle the case where command committed is enabled.

                        if ( commandCommitted )
                        {
                            properties.onFocusAfterRevision ( {
                                kind: "edge",
                                identifier: transitionEdgeIdentifier ( transition.state, transition.event ),
                            } );
                        }

                        // Return the command committed.

                        return commandCommitted;
                    } }
                    open   = { transitionDialogOpen }
                    states = { properties.draft.stateMachine.states.map ( state => state.name ) }
                />
            ) }
        </>
    );
}

//--------------------------------------------------------------------------------------------------
// Function: ChartPage
//
// Description:
//
//   Renders the chart page interface.
//
// Parameters:
//
//   - properties:
//     The component properties.
//
// Returns:
//
//   The rendered chart page interface.
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

export function ChartPage ( properties: ChartPageProperties )
{
    // Initialize the local values needed by this operation.

    const [ announcement, setAnnouncement ]                             = useState ( { message: "", sequence: 0 } );
    const [ pendingViewportRestoration, setPendingViewportRestoration ] = 
        useState<PendingViewportRestoration | null> ( null );
    const [ pendingFocusRequest, setPendingFocusRequest ] = useState<{
        readonly documentRevision: number;
        readonly request:          ChartFocusRequest;
    } | null> ( null );

    useEffect ( () =>
    {
        // Handle the case where at least one branch condition is satisfied.

        if ( pendingFocusRequest === null || pendingFocusRequest.documentRevision === properties.documentRevision )
        {
            // Return control to the caller.

            return;
        }

        const focusTimer = window.setTimeout ( () =>
        {
            window.requestAnimationFrame ( () =>
            {
                window.requestAnimationFrame ( () =>
                {
                    // Initialize the local values needed by this operation.

                    const canvas  = document.querySelector<HTMLElement> ( ".chart-canvas" );
                    const request = pendingFocusRequest.request;
                    const target  = request.kind === "canvas"
                        ? canvas
                        : request.kind === "control" || request.kind === "draft-endpoint"
                            ? document.querySelector<HTMLElement> (
                                `[data-chart-focus-id="${request.identifier}"]`,
                            )
                            : document.querySelector<HTMLElement> (
                                `.chart-canvas .react-flow__${request.kind}[data-id="${request.identifier}"]`,
                            );

                    ( target ?? canvas )?.focus ();
                    setPendingFocusRequest ( null );
                } );
            } );
        }, 0 );

        // Return the computed result.

        return () => window.clearTimeout ( focusTimer );
    }, [ pendingFocusRequest, properties.documentRevision ] );

    // Handle the case where properties draft matches an absent value.

    if ( properties.draft === null )
    {
        // Return the rendered interface.

        return (
            <section className="chart-no-document">
                <p>{ text ( "chart.noDocument" ) }</p>
                <button onClick={ properties.onNew } type="button">{ text ( "button.newDocument" ) }</button>
            </section>
        );
    }

    // Initialize the local values needed by this operation.

    const chartNodeCount = properties.draft.stateMachine.states.length +
        properties.draft.chart.indicators.terminalStateIndicators.length +
        properties.draft.chart.draftTransitions.length +
        ( properties.draft.chart.indicators.initialStateIndicator === null ? 0 : 1 );
    const initialIndicatorAttachment = properties.draft.chart.indicators.initialStateIndicator?.state === undefined
        ? properties.draft.stateMachine.initialState
        : properties.draft.chart.indicators.initialStateIndicator.state;
    const chartRelationCount = properties.draft.stateMachine.transitionTable.length +
        properties.draft.chart.indicators.terminalStateTransitions.length +
        properties.draft.chart.draftTransitions.length +
        ( properties.draft.chart.indicators.initialStateIndicator !== null &&
            initialIndicatorAttachment !== null ? 1 : 0 );
    const hasInteractiveNodeCapacity     = chartNodeCount < MAXIMUM_INTERACTIVE_CHART_NODE_COUNT;
    const hasInteractiveRelationCapacity = chartRelationCount < MAXIMUM_INTERACTIVE_CHART_EDGE_COUNT;
    const initialViewport                = pendingViewportRestoration?.documentRevision === properties.documentRevision
        ? pendingViewportRestoration.viewport
        : null;
    const chartCanvasRevisionKey = [
        properties.documentRevision,
        properties.draft.chart.settings.expandStates,
        properties.nameWrapping.actionNames,
        properties.nameWrapping.eventNames,
        properties.nameWrapping.stateNames,
        properties.gridSize,
        properties.collapsedStateWidth,
        properties.collapsedStateHeight,
        properties.expandedStateWidth,
        properties.expandedStateMinimumHeight,
        properties.selfTransitionLoopAspect,
        properties.selfTransitionLoopExtension,
        properties.selfTransitionLoopSpacing,
        properties.transitionGravityPointDistance,
        properties.transitionLabelAlignment,
    ].join ( ":" );

    // Return the rendered interface.

    return (
        <>
            <p
                aria-atomic="true"
                aria-live="polite"
                className="visually-hidden"
                data-chart-announcement
            >
                <span key={ announcement.sequence }>{ announcement.message }</span>
            </p>
            <div className="chart-page">
                <ChartPalette
                    canAddInitialIndicator={ properties.draft.chart.indicators.initialStateIndicator === null &&
                        hasInteractiveNodeCapacity }
                    canAddState             = { hasInteractiveNodeCapacity }
                    canAddTerminalIndicator = { hasInteractiveNodeCapacity }
                    canAddTransition        = { hasInteractiveRelationCapacity }
                    canDragTransition       = { hasInteractiveRelationCapacity && hasInteractiveNodeCapacity }
                />
                <ReactFlowProvider key={ chartCanvasRevisionKey }>
                    <ChartCanvas
                        { ...properties }
                        draft           = { properties.draft }
                        initialViewport = { initialViewport }
                        onAnnouncement  = { message => setAnnouncement ( current => ( {
                            message,
                            sequence: current.sequence + 1,
                        } ) ) }
                        onFocusAfterRevision={ request =>
                        {
                            setPendingFocusRequest ( request === null
                                ? null
                                : { documentRevision: properties.documentRevision, request } );
                        } }
                        onPreserveViewport={ viewport =>
                        {
                            setPendingViewportRestoration ( viewport === null
                                ? null
                                : {
                                    documentRevision: properties.documentRevision + 1,
                                    viewport,
                                } );
                        } }
                        onViewportRestored={ () =>
                        {
                            setPendingViewportRestoration ( current =>
                                current?.documentRevision === properties.documentRevision ? null : current );
                        } }
                    />
                </ReactFlowProvider>
            </div>
        </>
    );
}
