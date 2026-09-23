// @vitest-environment jsdom
// /////////////////////////////////////////////////////////////////////////////////////////////////
// Name:    Console Entity Navigation Tests
// Version: 1.0.0
// Date:    2026-09-23
// Author:  Rohin Gosling
// Description: Verifies entity lifetimes, diagnostic targets, and selection beyond rendered rows.
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConsoleEntityNavigation } from "../../src/application/console-entity-navigation";
import { createEmptyAuthoringDraft } from "../../src/domain/model/drafts";
import { EditorWorkspace } from "../../src/presentation/editor/EditorPages";
import type { ShellRoute } from "../../src/application/contracts";

const emptyDraft = createEmptyAuthoringDraft ();
const draft = {
    ...emptyDraft,
    stateMachine: {
        ...emptyDraft.stateMachine,
        states: Array.from ( { length: 150 }, ( _, index ) => ( { name: "state_" + index, description: "", terminalState: false } ) ),
        events: [ { name: "first_event", description: "" }, { name: "last_event", description: "" } ],
        actions: [ { name: "first_action", description: "" }, { name: "last_action", description: "" } ],
        transitionTable: [
            { state: "state_0", event: "first_event", stateNext: "state_1" },
            { state: "state_1", event: "last_event", stateNext: "state_2" },
        ],
    },
};
const diagnostic = ( path: string ) => ( {
    code: "TEST", message: "Diagnostic", remediation: "Review", severity: "warning" as const, source: "Validation", path,
} );

describe ( "Console entity references", () =>
{
    afterEach ( cleanup );

    it ( "captures structured targets and follows reordered transition keys", () =>
    {
        const navigation = new ConsoleEntityNavigation ();
        navigation.synchronize ( draft );
        for ( const route of [ "states", "events", "actions" ] as const )
        {
            const reference = navigation.fromDiagnostic ( diagnostic ( "/state_machine/" + route + "/1" ), draft );
            expect ( navigation.resolve ( reference ) ).toMatchObject ( { route, rowKey: draft.stateMachine [ route ] [ 1 ]?.name } );
        }
        const reference = navigation.fromDiagnostic ( diagnostic ( "/state_machine/transition_table/1/state_next" ), draft );
        navigation.synchronize ( { ...draft, stateMachine: { ...draft.stateMachine, transitionTable: [ ...draft.stateMachine.transitionTable ].reverse () } } );
        expect ( navigation.resolve ( reference ) ).toMatchObject ( { route: "transitionTable", rowKey: "0" } );
        expect ( navigation.fromDiagnostic ( diagnostic ( "/unrelated/1" ), draft ) ).toBeUndefined ();
        expect ( navigation.fromDiagnostic ( diagnostic ( "/state_machine/states/9999" ), draft ) ).toBeUndefined ();
    } );

    it ( "retires removed, renamed, and replacement-document references without name reuse", () =>
    {
        const navigation = new ConsoleEntityNavigation ();
        navigation.synchronize ( draft );
        const reference = navigation.fromDiagnostic ( diagnostic ( "/state_machine/events/1" ), draft );
        navigation.synchronize ( { ...draft, stateMachine: { ...draft.stateMachine, events: [ { name: "renamed", description: "" } ] } } );
        navigation.synchronize ( draft );
        expect ( navigation.resolve ( reference ) ).toBeUndefined ();
        const replacementReference = navigation.fromDiagnostic ( diagnostic ( "/state_machine/events/1" ), draft );
        navigation.synchronize ( draft, true );
        expect ( navigation.resolve ( replacementReference ) ).toBeUndefined ();
        expect ( navigation.resolve ( undefined ) ).toBeUndefined ();
    } );

    it ( "preserves targets across unrelated edits and captures failed entity/transition commands", () =>
    {
        const navigation = new ConsoleEntityNavigation ();
        navigation.synchronize ( draft );
        const reference = navigation.fromCommand ( { kind: "add_entity", entityKind: "action", entity: draft.stateMachine.actions [ 1 ] ?? { name: "", description: "" }, expectedRevision: 1 }, draft );
        navigation.synchronize ( { ...draft, settings: { ...draft.settings, description: "changed" } } );
        expect ( navigation.resolve ( reference ) ).toMatchObject ( { route: "actions", rowKey: "last_action" } );
        expect ( navigation.resolve ( navigation.fromCommand ( { kind: "delete_transition", index: 1, expectedRevision: 1 }, draft ) ) )
            .toMatchObject ( { route: "transitionTable", rowKey: "1" } );
    } );

    it.each ( [
        [ "states", "state_149" ], [ "events", "last_event" ], [ "actions", "last_action" ], [ "transitionTable", "1" ],
    ] as const ) ( "selects and focuses the requested row on %s", async ( route, key ) =>
    {
        const properties = { draft, onCommand: vi.fn (), onNew: vi.fn (), onValidate: vi.fn (), validationStatus: "not_validated" as const, route: route as ShellRoute };
        const { rerender } = render ( <EditorWorkspace { ...properties } rowNavigation={ { key, sequence: 1 } } /> );
        await waitFor ( () => expect ( screen.getAllByRole ( "grid" ) [ 0 ]?.querySelector ( "[aria-selected='true']" ) ).toContainElement ( document.activeElement as HTMLElement ) );
        const selected = screen.getAllByRole ( "grid" ) [ 0 ]?.querySelector ( "[aria-selected='true']" );
        expect ( selected ).toHaveAttribute ( "aria-rowindex", route === "states" ? "151" : "3" );
        const firstCell = screen.getAllByRole ( "grid" ) [ 0 ]?.querySelector ( "[role='gridcell']" );
        if ( firstCell !== null && firstCell !== undefined )
        {
            fireEvent.click ( firstCell );
        }
        rerender ( <EditorWorkspace { ...properties } rowNavigation={ { key, sequence: 2 } } /> );
        await waitFor ( () => expect ( screen.getAllByRole ( "grid" ) [ 0 ]?.querySelector ( "[aria-selected='true']" ) ).toHaveAttribute ( "aria-rowindex", route === "states" ? "151" : "3" ) );
        rerender ( <EditorWorkspace { ...properties } rowNavigation={ undefined } /> );
        expect ( screen.getAllByRole ( "grid" ) [ 0 ]?.querySelector ( "[aria-selected='true']" ) ).toHaveAttribute ( "aria-rowindex", route === "states" ? "151" : "3" );
    } );
} );
