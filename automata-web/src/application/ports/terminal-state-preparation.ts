// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Terminal State Preparation Boundary
// Version: 1.0.0
// Date:    2026-09-16
// Author:  Rohin Gosling
//
// Description:
//
//   Defines immutable geometry inputs and atomic preparation results for file and command use.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { AuthoringDraft, ChartPoint } from "../../domain/model/contracts.js";
import type { DomainDiagnostic } from "../../domain/model/diagnostics.js";

export interface TerminalStatePreparationRectangle extends ChartPoint
{
    readonly width:  number;
    readonly height: number;
}

// Bounds include deterministic fallbacks for unplaced states. The caller supplies captured client
// preferences or central server defaults. Existing positions are never recalculated by rendering.

export interface TerminalStateGeometryContext
{
    readonly stateBounds:            ReadonlyMap<string, TerminalStatePreparationRectangle>;
    readonly occupiedRectangles:     readonly TerminalStatePreparationRectangle[];
    readonly retainedDraftEndpoints: readonly ChartPoint[];
    readonly indicatorWidth:         number;
    readonly indicatorHeight:        number;
    readonly gridSize:               number;
    readonly routeClearance:         number;
}

export interface TerminalStatePreparationSummary
{
    readonly addedIndicatorCount:  number;
    readonly addedRelationCount:   number;
    readonly removedRelationCount: number;
}

export type TerminalStatePreparationResult =
    | {
        readonly isSuccessful: true;
        readonly document:     AuthoringDraft;
        readonly summary:      TerminalStatePreparationSummary;
    }
    | {
        readonly isSuccessful: false;
        readonly diagnostics:  readonly DomainDiagnostic[];
    };

// Implementations capture geometry at the operation boundary and return one complete plan.
// They preserve semantic flags and all unrelated data, retain existing indicators, never complete
// drafts, and return the original snapshot with zero counts when no repair is required.
// Search is bounded by occupied rectangles + retained endpoints + 1 for each new indicator,
// including prior reservations. Failure returns no partial document and changes no live state.

export interface TerminalStatePreparationPort
{
    prepare ( document: AuthoringDraft ): TerminalStatePreparationResult;
}
