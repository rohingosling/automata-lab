// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Solver Observation Contracts
// Version: 1.0.0
// Date:    2026-08-09
// Author:  Rohin Gosling
//
// Description:
//
//   Defines typed observation tokens, normalized intervals, provenance locations, and deterministic
//   diagnostics.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { SolverStartContext } from "../model/contracts.js";
import type { SolverCandidate } from "../model/contracts.js";

//--------------------------------------------------------------------------------------------------
// Interface: SolverNamedToken
//
// Description:
//
//   Defines the structure of solver named token.
//
//--------------------------------------------------------------------------------------------------

interface SolverNamedToken
{
    readonly name:       string;
    readonly tokenIndex: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: SolverEventToken
//
// Description:
//
//   Defines the structure of solver event token.
//
//--------------------------------------------------------------------------------------------------

export interface SolverEventToken extends SolverNamedToken
{
    readonly kind: "event";
}

//--------------------------------------------------------------------------------------------------
// Interface: SolverStateToken
//
// Description:
//
//   Defines the structure of solver state token.
//
//--------------------------------------------------------------------------------------------------

export interface SolverStateToken extends SolverNamedToken
{
    readonly kind: "state";
}

//--------------------------------------------------------------------------------------------------
// Interface: SolverActionToken
//
// Description:
//
//   Defines the structure of solver action token.
//
//--------------------------------------------------------------------------------------------------

export interface SolverActionToken extends SolverNamedToken
{
    readonly kind: "action";
}

//--------------------------------------------------------------------------------------------------
// Type: SolverToken
//
// Description:
//
//   Defines the supported solver token alternatives.
//
//--------------------------------------------------------------------------------------------------

export type SolverToken = SolverActionToken | SolverEventToken | SolverStateToken;

//--------------------------------------------------------------------------------------------------
// Interface: SolverObservationInput
//
// Description:
//
//   Defines the structure of solver observation input.
//
//--------------------------------------------------------------------------------------------------

export interface SolverObservationInput
{
    readonly name:         string;
    readonly startContext: SolverStartContext;
    readonly rawTokens:    readonly string[];
}

//--------------------------------------------------------------------------------------------------
// Interface: ParsedSolverObservation
//
// Description:
//
//   Defines the structure of parsed solver observation.
//
//--------------------------------------------------------------------------------------------------

export interface ParsedSolverObservation
{
    readonly name:         string;
    readonly startContext: SolverStartContext;
    readonly tokens:       readonly SolverToken[];
}

//--------------------------------------------------------------------------------------------------
// Interface: SolverDiagnosticLocation
//
// Description:
//
//   Defines the structure of solver diagnostic location.
//
//--------------------------------------------------------------------------------------------------

export interface SolverDiagnosticLocation
{
    readonly sequenceName:      string;
    readonly tokenStart:        number;
    readonly tokenEndExclusive: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: SolverObservationDiagnostic
//
// Description:
//
//   Defines the structure of solver observation diagnostic.
//
//--------------------------------------------------------------------------------------------------

export interface SolverObservationDiagnostic
{
    readonly code:
        | "ACTION_WORD_CONFLICT"
        | "CAPACITY_EXCEEDED"
        | "DETERMINISM_CONFLICT"
        | "INITIAL_STATE_CONFLICT"
        | "MULTIPLE_STATES_IN_INTERVAL"
        | "NO_OBSERVATIONS"
        | "SOLVER_CANCELLED"
        | "SOLVER_FAILURE"
        | "SOLVER_TOKEN_INVALID";
    readonly severity:         "error" | "warning";
    readonly message:          string;
    readonly remediation:      string;
    readonly relatedLocations: readonly SolverDiagnosticLocation[];
}

//--------------------------------------------------------------------------------------------------
// Interface: NormalizedSolverInterval
//
// Description:
//
//   Defines the structure of normalized solver interval.
//
//--------------------------------------------------------------------------------------------------

export interface NormalizedSolverInterval
{
    readonly incomingEvent:     string | null;
    readonly explicitState:     string | null;
    readonly entryActions:      readonly string[];
    readonly tokenStart:        number;
    readonly tokenEndExclusive: number;
}

//--------------------------------------------------------------------------------------------------
// Interface: NormalizedSolverObservation
//
// Description:
//
//   Defines the structure of normalized solver observation.
//
//--------------------------------------------------------------------------------------------------

export interface NormalizedSolverObservation
{
    readonly name:         string;
    readonly startContext: SolverStartContext;
    readonly intervals:    readonly NormalizedSolverInterval[];
}

//--------------------------------------------------------------------------------------------------
// Type: SolverParseResult
//
// Description:
//
//   Describes the result produced by solver parse.
//
//--------------------------------------------------------------------------------------------------

export type SolverParseResult =
    | {
        readonly isSuccessful: true;
        readonly observation:  ParsedSolverObservation;
        readonly diagnostics:  readonly SolverObservationDiagnostic[];
    }
    | {
        readonly isSuccessful: false;
        readonly diagnostics:  readonly SolverObservationDiagnostic[];
    };

//--------------------------------------------------------------------------------------------------
// Type: SolverNormalizationResult
//
// Description:
//
//   Describes the result produced by solver normalization.
//
//--------------------------------------------------------------------------------------------------

export type SolverNormalizationResult =
    | {
        readonly isSuccessful: true;
        readonly observations: readonly NormalizedSolverObservation[];
        readonly diagnostics:  readonly SolverObservationDiagnostic[];
    }
    | {
        readonly isSuccessful: false;
        readonly diagnostics:  readonly SolverObservationDiagnostic[];
    };

//--------------------------------------------------------------------------------------------------
// Interface: SolverInferenceRequest
//
// Description:
//
//   Describes a solver inference request.
//
//--------------------------------------------------------------------------------------------------

export interface SolverInferenceRequest
{
    readonly documentRevision: number;
    readonly solverRevision:   number;
    readonly observations:     readonly SolverObservationInput[];
}

//--------------------------------------------------------------------------------------------------
// Type: SolverInferenceResult
//
// Description:
//
//   Describes the result produced by solver inference.
//
//--------------------------------------------------------------------------------------------------

export type SolverInferenceResult =
    | {
        readonly status:      "success";
        readonly candidate:   SolverCandidate;
        readonly diagnostics: readonly SolverObservationDiagnostic[];
    }
    | {
        readonly status:      "failure";
        readonly diagnostics: readonly SolverObservationDiagnostic[];
    };

//--------------------------------------------------------------------------------------------------
// Interface: SolverReplayResult
//
// Description:
//
//   Describes the result produced by solver replay.
//
//--------------------------------------------------------------------------------------------------

export interface SolverReplayResult
{
    readonly isSuccessful: boolean;
    readonly stateNames:   readonly string[];
    readonly diagnostic:   SolverObservationDiagnostic | null;
}
