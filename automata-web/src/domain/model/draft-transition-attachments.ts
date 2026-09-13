// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Draft Transition Attachment Geometry
// Version: 1.0.0
// Date:    2026-09-06
// Author:  Rohin Gosling
//
// Description:
//
//   Resolves attached endpoints from current state centers without changing attachment identity.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { ChartDraftTransition, ChartIndicatorReference, ChartIndicators, ChartPoint } from "./contracts.js";

//--------------------------------------------------------------------------------------------------
// Function: resolveDraftTransitionEndpoints
//
// Description:
//
//   Uses the supplied current centers for attached ends and retains free/fallback coordinates.
//--------------------------------------------------------------------------------------------------

export function resolveDraftTransitionEndpoints (
    transition: ChartDraftTransition,
    stateCenters: ReadonlyMap<string, ChartPoint>,
    indicators?: ChartIndicators,
): ChartDraftTransition
{
    return {
        ...transition,
        source: transition.sourceIndicator != null && indicators !== undefined
            ? resolveChartIndicatorPoint ( transition.sourceIndicator, indicators ) ?? transition.source
            : transition.sourceState == null ? transition.source : stateCenters.get ( transition.sourceState ) ?? transition.source,
        target: transition.targetIndicator != null && indicators !== undefined
            ? resolveChartIndicatorPoint ( transition.targetIndicator, indicators ) ?? transition.target
            : transition.targetState == null ? transition.target : stateCenters.get ( transition.targetState ) ?? transition.target,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: normalizeDraftTransitionIndicatorDirection
//
// Description:
//
//   Reverses endpoint roles together after an explicit drop onto an indicator in the wrong role.
//   The physical endpoint positions and their attached entities stay paired. Passive readers and
//   geometry resolution do not call this helper, so saved history remains unchanged until edited.
//--------------------------------------------------------------------------------------------------

export function normalizeDraftTransitionIndicatorDirection ( transition: ChartDraftTransition ): ChartDraftTransition
{
    if ( transition.targetIndicator?.kind !== "initial" && transition.sourceIndicator?.kind !== "terminal" )
    {
        return transition;
    }

    return (
        {
            ...transition,
            source:          transition.target,
            target:          transition.source,
            sourceState:     transition.targetState ?? null,
            targetState:     transition.sourceState ?? null,
            sourceIndicator: transition.targetIndicator ?? null,
            targetIndicator: transition.sourceIndicator ?? null,
        }
    );
}

// Validates an exact indicator identity at untrusted file and Worker boundaries.

export function isChartIndicatorReference ( value: unknown ): value is ChartIndicatorReference
{
    if ( value === null || typeof value !== "object" || Array.isArray ( value ) )
    {
        return false;
    }
    const reference = value as Record<string, unknown>;
    const keys = Object.keys ( reference );
    return reference [ "kind" ] === "initial" && keys.length === 1 ||
        reference [ "kind" ] === "terminal" && keys.length === 2 &&
        Number.isSafeInteger ( reference [ "id" ] ) && ( reference [ "id" ] as number ) >= 0;
}

export function chartIndicatorReferenceKey ( reference: ChartIndicatorReference ): string
{
    return reference.kind === "initial" ? "initial" : "terminal:" + reference.id;
}

export function resolveChartIndicatorPoint (
    reference: ChartIndicatorReference,
    indicators: ChartIndicators,
): ChartPoint | null
{
    const indicator = reference.kind === "initial" ? indicators.initialStateIndicator :
        indicators.terminalStateIndicators.find ( current => current.id === reference.id );
    return indicator == null ? null : { x: indicator.x, y: indicator.y };
}

export function isChartIndicatorReferencePresent ( value: unknown, indicators: ChartIndicators ): boolean
{
    return isChartIndicatorReference ( value ) && resolveChartIndicatorPoint ( value, indicators ) !== null;
}

// Direct notation relations currently flow from the sole initial indicator to a terminal indicator.

export function isAllowedChartIndicatorPair ( source: ChartIndicatorReference, target: ChartIndicatorReference ): boolean
{
    return source.kind === "initial" && target.kind === "terminal";
}
