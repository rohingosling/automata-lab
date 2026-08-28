// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Solver Workspace Lifecycle
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Coordinates immutable candidate review, progress, stale-result rejection, navigation
//   persistence, and discard.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { SolverCandidate } from "../domain/model/contracts.js";
import type { SolverInferenceResult, SolverObservationDiagnostic } from "../domain/solver/contracts.js";
import type { SolverProgress } from "./ports/contracts.js";

//--------------------------------------------------------------------------------------------------
// Type: SolverWorkspaceStatus
//
// Description:
//
//   Defines the supported solver workspace status alternatives.
//
//--------------------------------------------------------------------------------------------------

export type SolverWorkspaceStatus = "editing" | "failed" | "review" | "running" | "stale";

//--------------------------------------------------------------------------------------------------
// Interface: SolverWorkspaceState
//
// Description:
//
//   Defines the structure of solver workspace state.
//
//--------------------------------------------------------------------------------------------------

export interface SolverWorkspaceState
{
    readonly activeJobId: string | null;
    readonly candidate:   SolverCandidate | null;
    readonly diagnostics: readonly SolverObservationDiagnostic[];
    readonly progress:    SolverProgress | null;
    readonly status:      SolverWorkspaceStatus;
}

//--------------------------------------------------------------------------------------------------
// Function: createSolverWorkspaceState
//
// Description:
//
//   Creates solver workspace state.
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

export function createSolverWorkspaceState (): SolverWorkspaceState
{
    // Return the assembled result.

    return { activeJobId: null, candidate: null, diagnostics: [], progress: null, status: "editing" };
}

//--------------------------------------------------------------------------------------------------
// Function: beginSolverJob
//
// Description:
//
//   Begins the solver job.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
//
//   - jobId:
//     The job identifier supplied to the operation.
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

export function beginSolverJob ( state: SolverWorkspaceState, jobId: string ): SolverWorkspaceState
{
    // Return the assembled result.

    return { ...state, activeJobId: jobId, diagnostics: [], progress: null, status: "running" };
}

//--------------------------------------------------------------------------------------------------
// Function: updateSolverProgress
//
// Description:
//
//   Updates solver progress.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
//
//   - jobId:
//     The job identifier supplied to the operation.
//
//   - progress:
//     The progress supplied to the operation.
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

export function updateSolverProgress (
    state: SolverWorkspaceState,
    jobId: string,
    progress: SolverProgress,
): SolverWorkspaceState
{
    // Return the result selected by the current condition.

    return state.activeJobId === jobId && state.status === "running" ? { ...state, progress } : state;
}

//--------------------------------------------------------------------------------------------------
// Function: completeSolverJob
//
// Description:
//
//   Completes the solver job.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
//
//   - jobId:
//     The job identifier supplied to the operation.
//
//   - result:
//     The result supplied to the operation.
//
//   - currentDocumentRevision:
//     The current document revision supplied to the operation.
//
//   - currentSolverRevision:
//     The current solver revision supplied to the operation.
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

export function completeSolverJob (
    state: SolverWorkspaceState,
    jobId: string,
    result: SolverInferenceResult,
    currentDocumentRevision: number,
    currentSolverRevision: number,
): SolverWorkspaceState
{
    // Handle the case where at least one branch condition is satisfied.

    if ( state.activeJobId !== jobId || state.status !== "running" )
    {
        // Return the state.

        return state;
    }

    // Handle the case where result status matches the failure value.

    if ( result.status === "failure" )
    {
        // Return the assembled result.

        return {
            ...state,
            activeJobId: null,
            diagnostics: result.diagnostics,
            progress: null,
            status: result.diagnostics.some ( diagnostic => diagnostic.code === "SOLVER_CANCELLED" )
                ? "editing"
                : "failed",
        };
    }

    // Handle the case where at least one branch condition is satisfied.

    if ( result.candidate.baselineDocumentRevision !== currentDocumentRevision ||
        result.candidate.baselineSolverRevision !== currentSolverRevision )
    {
        // Return the assembled result.

        return {
            ...state,
            activeJobId: null,
            diagnostics:
            [
                {
                    code: "SOLVER_FAILURE",
                    severity: "warning",
                    message: "A completed Solver result was ignored because its input revision is stale.",
                    remediation: "Run Solve again against the current document and observations.",
                    relatedLocations: [],
                },
            ],
            progress: null,
            status: state.candidate === null ? "editing" : "stale",
        };
    }

    // Return the assembled result.

    return {
        activeJobId: null,
        candidate: result.candidate,
        diagnostics: result.diagnostics,
        progress: null,
        status: "review",
    };
}

//--------------------------------------------------------------------------------------------------
// Function: refreshSolverCandidateFreshness
//
// Description:
//
//   Refreshes the solver candidate freshness.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
//
//   - documentRevision:
//     The document revision supplied to the operation.
//
//   - solverRevision:
//     The solver revision supplied to the operation.
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

export function refreshSolverCandidateFreshness (
    state: SolverWorkspaceState,
    documentRevision: number,
    solverRevision: number,
): SolverWorkspaceState
{
    // Handle the case where at least one branch condition is satisfied.

    if ( state.candidate === null || state.status === "running" )
    {
        // Return the state.

        return state;
    }

    const stale = state.candidate.baselineDocumentRevision !== documentRevision ||
        state.candidate.baselineSolverRevision !== solverRevision;

    // Return the result selected by the current condition.

    return stale && state.status !== "stale" ? { ...state, status: "stale" } : state;
}

//--------------------------------------------------------------------------------------------------
// Function: rebaseSolverCandidateAfterChartSettingChange
//
// Description:
//
//   Derives the rebase solver candidate after chart setting change.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
//
//   - previousDocumentRevision:
//     The previous document revision supplied to the operation.
//
//   - currentDocumentRevision:
//     The current document revision supplied to the operation.
//
//   - currentSolverRevision:
//     The current solver revision supplied to the operation.
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

export function rebaseSolverCandidateAfterChartSettingChange (
    state: SolverWorkspaceState,
    previousDocumentRevision: number,
    currentDocumentRevision: number,
    currentSolverRevision: number,
): SolverWorkspaceState
{
    // Handle the case where at least one branch condition is satisfied.

    if ( state.candidate === null || state.status === "running" ||
        state.candidate.baselineDocumentRevision !== previousDocumentRevision ||
        state.candidate.baselineSolverRevision !== currentSolverRevision )
    {
        // Return the state.

        return state;
    }

    const candidate = Object.freeze ( {
        ...state.candidate,
        baselineDocumentRevision: currentDocumentRevision,
    } );

    // Return the assembled result.

    return { ...state, candidate, status: "review" };
}

//--------------------------------------------------------------------------------------------------
// Function: discardSolverCandidate
//
// Description:
//
//   Derives the discard solver candidate.
//
// Parameters:
//
//   - state:
//     The state supplied to the operation.
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

export function discardSolverCandidate ( state: SolverWorkspaceState ): SolverWorkspaceState
{
    // Return the assembled result.

    return { ...state, activeJobId: null, candidate: null, diagnostics: [], progress: null, status: "editing" };
}
