// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Console Entity Navigation
// Version: 1.0.0
// Date:    2026-09-23
// Author:  Rohin Gosling
//
// Description:
//
//   Resolves transient Console references against current entity lifetimes. Removed keys and
//   document replacements retire references permanently, even when the same names reappear.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { AuthoringDraft } from "../domain/model/contracts";
import type { DocumentCommand } from "../domain/model/commands";
import type { DomainDiagnostic } from "../domain/model/diagnostics";
import type { ShellRoute } from "./contracts";

interface EntityDestination
{
    readonly identifier: number;
    readonly route:      ShellRoute;
    readonly rowKey:     string;
}

// This registry contains only current entity keys, not models or a second authoring history.
export class ConsoleEntityNavigation
{
    private destinations = new Map <string, EntityDestination> ();
    private nextIdentifier = 0;
    private currentDraft: AuthoringDraft | null = null;

    public synchronize ( draft: AuthoringDraft | null, reset = false ): void
    {
        if ( draft === this.currentDraft && !reset )
        {
            return;
        }
        this.currentDraft = draft;
        const previous = reset ? new Map <string, EntityDestination> () : this.destinations;
        const destinations = new Map <string, EntityDestination> ();
        const add = ( route: ShellRoute, key: string, rowKey = key ): void =>
        {
            const identity = JSON.stringify ( [ route, key ] );
            destinations.set ( identity, {
                identifier: previous.get ( identity )?.identifier ?? ++this.nextIdentifier,
                route, rowKey,
            } );
        };
        if ( draft !== null )
        {
            for ( const route of [ "states", "events", "actions" ] as const )
            {
                draft.stateMachine [ route ].forEach ( entity => add ( route, entity.name ) );
            }
            draft.stateMachine.transitionTable.forEach ( ( transition, index ) =>
                add ( "transitionTable", JSON.stringify ( [ transition.state, transition.event ] ), String ( index ) ) );
        }
        this.destinations = destinations;
    }

    public resolve ( identifier: number | undefined ): EntityDestination | undefined
    {
        if ( identifier !== undefined )
        {
            for ( const destination of this.destinations.values () )
            {
                if ( destination.identifier === identifier )
                {
                    return destination;
                }
            }
        }
        return undefined;
    }

    private capture ( route: ShellRoute, key: string ): number | undefined
    {
        return this.destinations.get ( JSON.stringify ( [ route, key ] ) )?.identifier;
    }

    // Only call for diagnostics produced from the current document, never failed imported files.
    public fromDiagnostic ( diagnostic: DomainDiagnostic, draft: AuthoringDraft | null ): number | undefined
    {
        const match = /^\/state_machine\/(states|events|actions|transition_table)\/(\d+)(?:\/|$)/.exec ( diagnostic.path ?? "" );
        if ( draft === null || match === null )
        {
            return undefined;
        }
        const index = Number ( match [ 2 ] );
        if ( match [ 1 ] === "transition_table" )
        {
            const transition = draft.stateMachine.transitionTable [ index ];
            return transition === undefined ? undefined
                : this.capture ( "transitionTable", JSON.stringify ( [ transition.state, transition.event ] ) );
        }
        const route = match [ 1 ];
        if ( route === "states" || route === "events" || route === "actions" )
        {
            const entity = draft.stateMachine [ route ] [ index ];
            return entity === undefined ? undefined : this.capture ( route, entity.name );
        }
        return undefined;
    }

    public fromCommand ( command: DocumentCommand, draft: AuthoringDraft ): number | undefined
    {
        if ( "entityKind" in command )
        {
            const route = command.entityKind === "state" ? "states" : command.entityKind === "event" ? "events" : "actions";
            const name = "previousName" in command ? command.previousName
                : "name" in command ? command.name : "entity" in command ? command.entity.name : undefined;
            return name === undefined ? undefined : this.capture ( route, name );
        }
        if ( command.kind === "add_transition" || command.kind === "update_transition"
            || command.kind === "delete_transition" || command.kind === "move_transition" )
        {
            const transition = command.kind === "add_transition" ? command.transition
                : draft.stateMachine.transitionTable [ command.index ];
            return transition === undefined ? undefined
                : this.capture ( "transitionTable", JSON.stringify ( [ transition.state, transition.event ] ) );
        }
        if ( command.kind === "set_initial_state" && command.initialState !== null )
        {
            return this.capture ( "states", command.initialState );
        }
        return undefined;
    }
}
