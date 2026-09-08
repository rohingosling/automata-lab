// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Solver Workspace Lifecycle Tests
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies candidate persistence, stale completion rejection, freshness, progress correlation,
//   and discard.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from "vitest";

import
{
    beginSolverJob,
    completeSolverJob,
    createSolverWorkspaceState,
    discardSolverCandidate,
    rebaseSolverCandidateAfterChartSettingChange,
    refreshSolverCandidateFreshness,
    updateSolverProgress,
} from "../../src/application/solver-workspace.js";
import { inferSolverCandidate } from "../../src/domain/solver/inference.js";

//--------------------------------------------------------------------------------------------------
// Function: successfulResult
//
// Description:
//
//   Creates the successful result.
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

function successfulResult ()
{
    // Return the infer solver candidate result.

    return inferSolverCandidate (
        {
            documentRevision: 3,
            solverRevision: 2,
            observations: [],
        },
    );
}

describe ( "Solver workspace lifecycle", () =>
{
    it ( "correlates progress and rejects a stale completion", () =>
    {
        // Initialize the local values needed by this operation.

        const running         = beginSolverJob ( createSolverWorkspaceState (), "current" );
        const ignoredProgress = updateSolverProgress (
            running,
            "old",
            { completedWork: 1, totalWork: 2, message: "Old" },
        );
        const stale = completeSolverJob ( running, "current", successfulResult (), 4, 2 );

        expect ( ignoredProgress ).toBe ( running );
        expect ( stale.candidate ).toBeNull ();
        expect ( stale.status ).toBe ( "editing" );
        expect ( stale.diagnostics [ 0 ]?.message ).toContain ( "ignored" );
    } );

    it ( "preserves a completed candidate until stale or explicitly discarded", () =>
    {
        // Initialize the local values needed by this operation.

        const running   = beginSolverJob ( createSolverWorkspaceState (), "current" );
        const review    = completeSolverJob ( running, "current", successfulResult (), 3, 2 );
        const unchanged = refreshSolverCandidateFreshness ( review, 3, 2 );
        const stale     = refreshSolverCandidateFreshness ( review, 4, 2 );
        const discarded = discardSolverCandidate ( stale );

        expect ( review.status ).toBe ( "review" );
        expect ( unchanged ).toBe ( review );
        expect ( stale.status ).toBe ( "stale" );
        expect ( stale.candidate ).toBe ( review.candidate );
        expect ( discarded ).toMatchObject ( { status: "editing", candidate: null } );
    } );

    it ( "rebases a fresh candidate across a presentation-only chart expansion change", () =>
    {
        // Initialize the local values needed by this operation.

        const running   = beginSolverJob ( createSolverWorkspaceState (), "current" );
        const review    = completeSolverJob ( running, "current", successfulResult (), 3, 2 );
        const rebased   = rebaseSolverCandidateAfterChartSettingChange ( review, 3, 4, 2 );
        const unrelated = rebaseSolverCandidateAfterChartSettingChange ( review, 2, 4, 2 );

        expect ( rebased.status ).toBe ( "review" );
        expect ( rebased.candidate?.baselineDocumentRevision ).toBe ( 4 );
        expect ( Object.isFrozen ( rebased.candidate ) ).toBe ( true );
        expect ( refreshSolverCandidateFreshness ( rebased, 4, 2 ).status ).toBe ( "review" );
        expect ( unrelated ).toBe ( review );
    } );
} );
