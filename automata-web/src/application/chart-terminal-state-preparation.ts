// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Terminal State Chart Preparation
// Version: 1.0.0
// Date:    2026-09-16
// Author:  Rohin Gosling
//
// Description:
//
//   Plans bounded, deterministic notation repair before immutable documents become visible.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { AuthoringDraft } from "../domain/model/contracts.js";
import { validatePersistableAuthoringDraft } from "../domain/model/validation.js";
import { hasCoherentTerminalStateNotation, inspectTerminalStateNotation } from "../domain/model/terminal-states.js";
import {
    MAXIMUM_CHART_TERMINAL_INDICATOR_COUNT,
    MAXIMUM_CHART_TERMINAL_RELATION_COUNT,
} from "../domain/model/limits.js";
import { COMPILE_TIME_CONFIGURATION, DEFAULT_APPLICATION_PREFERENCES } from "../configuration/compile-time-configuration.js";
import type { ApplicationPreferences } from "./ports/contracts.js";
import type {
    TerminalStateGeometryContext,
    TerminalStatePreparationPort,
    TerminalStatePreparationRectangle,
    TerminalStatePreparationResult,
} from "./ports/terminal-state-preparation.js";
import {
    CHART_INDICATOR_SIZE,
    createAuthoringChartProjection,
    resolveAuthoringDraftAttachments,
} from "./chart-projection.js";

const EMPTY_SUMMARY = { addedIndicatorCount: 0, addedRelationCount: 0, removedRelationCount: 0 };

function failure ( message: string ): TerminalStatePreparationResult
{
    return {
        isSuccessful: false,
        diagnostics: [ {
            code: "TERMINAL_STATE_PREPARATION_FAILED", severity: "error", source: "chart",
            message,
            remediation: "Remove unused terminal indicators or simplify the source geometry, then retry.",
        } ],
    };
}

export function resolveTerminalStateGeometry (
    document: AuthoringDraft,
    preferences: ApplicationPreferences,
): TerminalStateGeometryContext
{
    const projection = createAuthoringChartProjection ( document, [], {
        actionNames: preferences.wrapActionNames,
        eventNames: preferences.wrapEventNames,
        stateNames: preferences.wrapStateNames,
    }, preferences );
    const resolved = resolveAuthoringDraftAttachments ( document, preferences );
    const indicators = [ ...projection.terminalIndicators,
        ...( projection.initialIndicator === null ? [] : [ projection.initialIndicator ] ) ];

    return {
        stateBounds: new Map ( projection.states.map ( state => [ state.name, state ] ) ),
        occupiedRectangles: [ ...projection.states, ...indicators.map ( indicator => ( {
            x: indicator.x, y: indicator.y, width: CHART_INDICATOR_SIZE, height: CHART_INDICATOR_SIZE,
        } ) ) ],
        retainedDraftEndpoints: resolved.chart.draftTransitions.flatMap ( transition =>
            [ transition.source, transition.target ] ),
        indicatorWidth: CHART_INDICATOR_SIZE,
        indicatorHeight: CHART_INDICATOR_SIZE,
        gridSize: preferences.gridSize,
        routeClearance: COMPILE_TIME_CONFIGURATION.chart.routing.routeClearance,
    };
}

function finiteRectangle ( rectangle: TerminalStatePreparationRectangle ): boolean
{
    return [ rectangle.x, rectangle.y, rectangle.width, rectangle.height,
        rectangle.x + rectangle.width, rectangle.y + rectangle.height ].every ( Number.isFinite ) &&
        rectangle.width > 0 && rectangle.height > 0 &&
        rectangle.x + rectangle.width > rectangle.x && rectangle.y + rectangle.height > rectangle.y;
}

export function prepareTerminalStateNotation (
    document: AuthoringDraft,
    geometry: TerminalStateGeometryContext,
): TerminalStatePreparationResult
{
    const validation = validatePersistableAuthoringDraft ( document );
    if ( !validation.isValid )
    {
        return { isSuccessful: false, diagnostics: validation.diagnostics };
    }
    const changes = inspectTerminalStateNotation ( document );
    if ( changes.missingRelationStates.length + changes.nonterminalRelationStates.length === 0 )
    {
        return { isSuccessful: true, document, summary: EMPTY_SUMMARY };
    }
    const indicators = [ ...document.chart.indicators.terminalStateIndicators ];
    const removedStates = new Set ( changes.nonterminalRelationStates );
    const relations = document.chart.indicators.terminalStateTransitions.filter (
        relation => !removedStates.has ( relation.state ),
    );
    if ( indicators.length + changes.missingRelationStates.length > MAXIMUM_CHART_TERMINAL_INDICATOR_COUNT ||
        relations.length + changes.missingRelationStates.length > MAXIMUM_CHART_TERMINAL_RELATION_COUNT )
    {
        return failure ( "Terminal notation exceeds the indicator or relation capacity." );
    }
    const occupiedRectangles = [ ...geometry.occupiedRectangles ];
    if ( changes.missingRelationStates.length > 0 && (
        ![ geometry.indicatorWidth, geometry.indicatorHeight, geometry.gridSize ].every (
            value => Number.isFinite ( value ) && value > 0 ) ||
        !Number.isFinite ( geometry.routeClearance ) || geometry.routeClearance < 0 ||
        !occupiedRectangles.every ( finiteRectangle ) ||
        !geometry.retainedDraftEndpoints.every ( point => Number.isFinite ( point.x ) && Number.isFinite ( point.y ) ) ) )
    {
        return failure ( "Terminal placement requires finite bounds and positive grid and indicator sizes." );
    }
    const identifiers = new Set ( indicators.map ( indicator => indicator.id ) );
    let nextIdentifier = 0;
    for ( const state of changes.missingRelationStates )
    {
        while ( identifiers.has ( nextIdentifier ) && Number.isSafeInteger ( nextIdentifier ) )
        {
            nextIdentifier += 1;
        }
        const bounds = geometry.stateBounds.get ( state );
        if ( !Number.isSafeInteger ( nextIdentifier ) || bounds === undefined || !finiteRectangle ( bounds ) )
        {
            return failure ( "Terminal placement has no safe identifier or finite state bounds." );
        }
        const horizontalCenter = Math.round ( ( bounds.x + bounds.width / 2 ) / geometry.gridSize ) * geometry.gridSize;
        let verticalCenter = Math.round ( ( bounds.y + bounds.height + geometry.gridSize +
            geometry.routeClearance + geometry.indicatorHeight / 2 ) / geometry.gridSize ) * geometry.gridSize;
        const maximumChecks = occupiedRectangles.length + geometry.retainedDraftEndpoints.length + 1;
        let placed = false;
        for ( let i = 0; i < maximumChecks; i += 1 )
        {
            const rectangle = {
                x: horizontalCenter - geometry.indicatorWidth / 2,
                y: verticalCenter - geometry.indicatorHeight / 2,
                width: geometry.indicatorWidth, height: geometry.indicatorHeight,
            };
            if ( !finiteRectangle ( rectangle ) )
            {
                return failure ( "Terminal placement exceeded finite geometry." );
            }
            const collisions = occupiedRectangles.filter ( occupied =>
                rectangle.x < occupied.x + occupied.width && rectangle.x + rectangle.width > occupied.x &&
                rectangle.y < occupied.y + occupied.height && rectangle.y + rectangle.height > occupied.y );
            const endpoints = geometry.retainedDraftEndpoints.filter ( point =>
                point.x > rectangle.x && point.x < rectangle.x + rectangle.width &&
                point.y > rectangle.y && point.y < rectangle.y + rectangle.height );
            if ( collisions.length + endpoints.length === 0 )
            {
                indicators.push ( { id: nextIdentifier, x: horizontalCenter, y: verticalCenter } );
                relations.push ( { state, terminalStateIndicatorId: nextIdentifier } );
                identifiers.add ( nextIdentifier );
                occupiedRectangles.push ( rectangle );
                placed = true;
                break;
            }
            const greatestBottom = Math.max ( ...collisions.map ( rectangle => rectangle.y + rectangle.height ),
                ...endpoints.map ( point => point.y ) );
            const nextCenter = Math.ceil ( ( greatestBottom + geometry.indicatorHeight / 2 ) /
                geometry.gridSize ) * geometry.gridSize;
            if ( !Number.isFinite ( nextCenter ) || nextCenter <= verticalCenter )
            {
                return failure ( "Terminal placement cannot make finite forward progress." );
            }
            verticalCenter = nextCenter;
        }
        if ( !placed )
        {
            return failure ( "Terminal placement exhausted its bounded collision search." );
        }
    }
    return {
        isSuccessful: true,
        document: { ...document, chart: { ...document.chart, indicators: {
            ...document.chart.indicators, terminalStateIndicators: indicators, terminalStateTransitions: relations,
        } } },
        summary: {
            addedIndicatorCount: changes.missingRelationStates.length,
            addedRelationCount: changes.missingRelationStates.length,
            removedRelationCount: changes.nonterminalRelationStates.length,
        },
    };
}

export function createTerminalStatePreparation (
    preferences: ApplicationPreferences = DEFAULT_APPLICATION_PREFERENCES,
): TerminalStatePreparationPort
{
    return { prepare: document =>
    {
        const validation = validatePersistableAuthoringDraft ( document );
        if ( !validation.isValid )
        {
            return { isSuccessful: false, diagnostics: validation.diagnostics };
        }
        if ( hasCoherentTerminalStateNotation ( document ) )
        {
            return { isSuccessful: true, document, summary: EMPTY_SUMMARY };
        }
        return prepareTerminalStateNotation ( document, resolveTerminalStateGeometry ( document, preferences ) );
    } };
}
