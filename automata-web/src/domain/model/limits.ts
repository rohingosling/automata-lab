// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Domain Capacity Limits
// Version: 1.0.0
// Date:    2026-08-09
// Author:  Rohin Gosling
//
// Description:
//
//   Defines the file, model, and Solver limits shared by pure domain validation and boundary
//   adapters.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { COMPILE_TIME_CONFIGURATION } from "../../configuration/compile-time-configuration.js";

const DEFAULT_STATE_SIZE          = COMPILE_TIME_CONFIGURATION.applicationSettings.chart.stateSize;
const STATE_DIMENSION_CONSTRAINTS = COMPILE_TIME_CONFIGURATION.applicationSettingConstraints.chart.stateDimension;

export const MAXIMUM_FILE_BYTE_COUNT                    = 5 * 1024 * 1024;
export const MAXIMUM_NAME_CODE_POINT_COUNT              = 128;
export const MAXIMUM_DESCRIPTION_CODE_POINTS            = 4_096;
export const MAXIMUM_STATE_COUNT                        = 10_000;
export const MAXIMUM_EVENT_COUNT                        = 256;
export const MAXIMUM_ACTION_COUNT                       = 1_000;
export const MAXIMUM_TRANSITION_COUNT                   = 50_000;
export const MAXIMUM_CHART_DRAFT_TRANSITION_COUNT       = 10_000;
export const MAXIMUM_CHART_TERMINAL_INDICATOR_COUNT     = MAXIMUM_STATE_COUNT;
export const MAXIMUM_CHART_TERMINAL_RELATION_COUNT      = MAXIMUM_STATE_COUNT;
export const DEFAULT_CHART_STATE_WIDTH: number          = DEFAULT_STATE_SIZE.expandedStateWidth;
export const DEFAULT_CHART_STATE_HEIGHT: number         = DEFAULT_STATE_SIZE.expandedStateMinimumHeight;
export const MINIMUM_CHART_STATE_DIMENSION: number      = STATE_DIMENSION_CONSTRAINTS.minimum;
export const MAXIMUM_CHART_STATE_DIMENSION: number      = STATE_DIMENSION_CONSTRAINTS.maximum;
export const MAXIMUM_ENTRY_ACTION_COUNT                 = 50_000;
export const MAXIMUM_EXIT_ACTION_COUNT                  = 50_000;
export const MAXIMUM_SOLVER_SEQUENCE_COUNT              = 1_000;
export const MAXIMUM_SOLVER_TOKEN_COUNT                 = 50_000;

// Every accepted Solver token canonicalizes to the state, event, or action name that a candidate
// publishes.

export const MAXIMUM_SOLVER_TOKEN_CODE_POINT_COUNT      = MAXIMUM_NAME_CODE_POINT_COUNT;
export const MAXIMUM_SIMULATOR_SEQUENCE_COUNT           = 1_000;

// One Simulator sequence is submitted to the server as a single Run event buffer, so the buffer
// bound and the sequence bound are the same number by construction rather than by coincidence. The
// server protocol derives its per-request bound from this constant.

export const MAXIMUM_EVENT_BUFFER_COUNT                 = 10_000;
export const FILE_IDENTIFIER                            = "automata-lab-state-machine";
export const FILE_VERSION                               = "1.0.0";
