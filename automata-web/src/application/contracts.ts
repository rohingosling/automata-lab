// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Application Contracts
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Defines browser-neutral navigation, Console, shell, and Editor presentation contracts.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { CommandImpactSummary, DocumentCommand } from "../domain/model/commands.js";
import type { AuthoringDraft, NamedEntity, TransitionDefinition } from "../domain/model/contracts.js";

export const SHELL_ROUTES = [
    "solver",
    "editor",
    "stateMachine",
    "states",
    "events",
    "actions",
    "transitionTable",
    "chart",
    "simulator",
] as const;

//--------------------------------------------------------------------------------------------------
// Type: ShellRoute
//
// Description:
//
//   Defines the shell route type.
//
//--------------------------------------------------------------------------------------------------

export type ShellRoute = typeof SHELL_ROUTES[number];

//--------------------------------------------------------------------------------------------------
// Type: ConsoleSeverity
//
// Description:
//
//   Defines the supported console severity alternatives.
//
//--------------------------------------------------------------------------------------------------

export type ConsoleSeverity = "error" | "message" | "warning";

//--------------------------------------------------------------------------------------------------
// Type: ShellRegion
//
// Description:
//
//   Defines the supported shell region alternatives.
//
//--------------------------------------------------------------------------------------------------

export type ShellRegion = "console" | "detail" | "master";

//--------------------------------------------------------------------------------------------------
// Type: DocumentCommandFactory
//
// Description:
//
//   Defines the document command factory type.
//
//--------------------------------------------------------------------------------------------------

export type DocumentCommandFactory = ( expectedRevision: number ) => DocumentCommand;

//--------------------------------------------------------------------------------------------------
// Type: DocumentCommandImpact
//
// Description:
//
//   Defines the document command impact type.
//
//--------------------------------------------------------------------------------------------------

export type DocumentCommandImpact = CommandImpactSummary;

//--------------------------------------------------------------------------------------------------
// Type: EditorDraftViewModel
//
// Description:
//
//   Defines the editor draft view model type.
//
//--------------------------------------------------------------------------------------------------

export type EditorDraftViewModel = AuthoringDraft;

//--------------------------------------------------------------------------------------------------
// Type: NamedEntityEditorValue
//
// Description:
//
//   Defines the named entity editor value type.
//
//--------------------------------------------------------------------------------------------------

export type NamedEntityEditorValue = NamedEntity;

//--------------------------------------------------------------------------------------------------
// Type: TransitionEditorValue
//
// Description:
//
//   Defines the transition editor value type.
//
//--------------------------------------------------------------------------------------------------

export type TransitionEditorValue = TransitionDefinition;

//--------------------------------------------------------------------------------------------------
// Interface: ConsoleContext
//
// Description:
//
//   Defines the structure of console context.
//
//--------------------------------------------------------------------------------------------------

export interface ConsoleContext
{
    readonly label: string;
    readonly route: ShellRoute;
}

//--------------------------------------------------------------------------------------------------
// Interface: ConsoleEntry
//
// Description:
//
//   Defines the structure of console entry.
//
//--------------------------------------------------------------------------------------------------

export interface ConsoleEntry
{
    readonly code:      string;
    readonly context?:  ConsoleContext;
    readonly identifier: string;
    readonly severity:  ConsoleSeverity;
    readonly source:    string;
    readonly text:      string;
    readonly timestamp: string;
}

//--------------------------------------------------------------------------------------------------
// Interface: ConsoleFilterState
//
// Description:
//
//   Defines the structure of console filter state.
//
//--------------------------------------------------------------------------------------------------

export interface ConsoleFilterState
{
    readonly error:   boolean;
    readonly message: boolean;
    readonly warning: boolean;
}

//--------------------------------------------------------------------------------------------------
// Interface: StatusBarViewModel
//
// Description:
//
//   Defines the structure of status bar view model.
//
//--------------------------------------------------------------------------------------------------

export interface StatusBarViewModel
{
    readonly actionCount:          number | null;
    readonly entryAssignmentCount: number | null;
    readonly eventCount:           number | null;
    readonly exitAssignmentCount:  number | null;
    readonly initialState:         string | null;
    readonly serverConnection:     "Connected" | "Connecting" | "Disconnected";
    readonly stateCount:           number | null;
    readonly transitionCount:      number | null;
    readonly contextualSegments:   readonly string[];
}

//--------------------------------------------------------------------------------------------------
// Interface: HostedModelStatusViewModel
//
// Description:
//
//   Defines the structure of hosted model status view model.
//
//--------------------------------------------------------------------------------------------------

export interface HostedModelStatusViewModel
{
    readonly connection:      "Connected" | "Connecting" | "Disconnected";
    readonly isReady:         boolean;
    readonly modelRevision:   string | null;
    readonly synchronization: "Current" | "Local changes" | "Unknown";
}

export const EMPTY_HOSTED_MODEL_STATUS_VIEW_MODEL: HostedModelStatusViewModel =
{
    connection:      "Disconnected",
    isReady:         false,
    modelRevision:   null,
    synchronization: "Unknown",
};

export const EMPTY_STATUS_BAR_VIEW_MODEL: StatusBarViewModel =
{
    actionCount:          null,
    entryAssignmentCount: null,
    eventCount:           null,
    exitAssignmentCount:  null,
    initialState:         null,
    serverConnection:     "Disconnected",
    stateCount:           null,
    transitionCount:      null,
    contextualSegments:   [],
};
