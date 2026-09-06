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

import type { ChartDraftTransition, ChartPoint } from "./contracts.js";

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
): ChartDraftTransition
{
    return {
        ...transition,
        source: transition.sourceState == null
            ? transition.source : stateCenters.get ( transition.sourceState ) ?? transition.source,
        target: transition.targetState == null
            ? transition.target : stateCenters.get ( transition.targetState ) ?? transition.target,
    };
}
