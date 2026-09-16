// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Terminal Runtime Fixture
// Version: 1.0.0
// Date:    2026-09-16
// Author:  Rohin Gosling
//
// Description:
//
//   Provides ordered entry/exit actions and terminal outgoing/self edges for execution tests.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { AutomataDocument } from "../../src/domain/model/contracts.js";
import { createEmptyAuthoringDraft } from "../../src/domain/model/drafts.js";

export function terminalDocument ( initialTerminal = false, withActions = true ): AutomataDocument
{
    const draft = createEmptyAuthoringDraft ();
    return {
        ...draft,
        stateMachine:
        {
            ...draft.stateMachine,
            initialState: "idle",
            states:
            [
                { name: "idle", description: "", terminalState: initialTerminal },
                { name: "done", description: "", terminalState: true },
            ],
            events: [ "go", "back", "loop", "unmapped" ].map ( name => ( { name, description: "" } ) ),
            actions: [ "initial", "leave", "arrive", "terminal_exit" ].map ( name => ( { name, description: "" } ) ),
            stateActions:
            {
                entry: withActions ? [
                    { state: "idle", action: "initial" },
                    { state: "done", action: "arrive" },
                    { state: "done", action: "arrive" },
                ] : [],
                exit: withActions ? [
                    { state: "idle", action: "leave" },
                    { state: "done", action: "terminal_exit" },
                ] : [],
            },
            transitionTable:
            [
                { state: "idle", event: "go", stateNext: "done" },
                { state: "done", event: "back", stateNext: "idle" },
                { state: "done", event: "loop", stateNext: "done" },
            ],
        },
    };
}
