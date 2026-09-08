// /////////////////////////////////////////////////////////////////////////////////////////////////
// Name:    Shared Standalone Schema Equivalence Tests
// Version: 1.0.0
// Date:    2026-09-08
// Author:  Rohin Gosling
// Description:
//   Compares generated shared validators with independently compiled public version schemas.
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import type { ErrorObject, ValidateFunction } from "ajv";
import { describe, expect, it } from "vitest";
import { openAuthoringDocument } from "../../src/infrastructure/files/file-codec.js";
import validateGenerated from "../../src/infrastructure/files/generated/file-schema-v1-validator.js";

const VERSIONS = [ "1.0.0", "1.1.0", "1.2.0", "1.3.0" ] as const;
const publicValidators = new Map ( VERSIONS.map ( version => [ version,
    new Ajv2020 ( { strict: true, allErrors: true } ).compile ( JSON.parse ( readFileSync (
        "public/schema/automata-lab-state-machine-" + version + ".schema.json", "utf8",
    ) ) ),
] ) );

interface Mutation
{
    readonly path:  string;
    readonly value: unknown;
}

function fixture ( version: string )
{
    return {
        file_id: "automata-lab-state-machine", file_version: version,
        settings: { name: "model", description: "", version: "1.0.0" },
        state_machine:
        {
            initial_state: "A", states: [ { name: "A", description: "" } ],
            events: [ { name: "event", description: "" } ], actions: [ { name: "action", description: "" } ],
            state_actions: { entry: [ { state: "A", action: "action" } ], exit: [ { state: "A", action: "action" } ] },
            transition_table: [ { state: "A", event: "event", state_next: "A" } ],
        },
        chart:
        {
            settings: { expand_states: false }, states: [ { state: "A", x: 100, y: 100 } ],
            indicators:
            {
                initial_state_indicator: { state: "A", x: 0, y: 0 },
                terminal_state_indicators: [ { id: 3, x: 300, y: 300 } ], terminal_state_transitions: [],
            },
            draft_transitions: [ { id: 7, source: { x: 10, y: 20 }, target: { x: 30, y: 40 } } ],
        },
        solver: { sequences: [] }, simulator: { sequences: [] },
    };
}

function mutate ( value: unknown, mutation: Mutation ): unknown
{
    const result = structuredClone ( value ) as Record<string, unknown>;
    const segments = mutation.path.split ( "." );
    let current = result;
    for ( const segment of segments.slice ( 0, -1 ) )
    {
        current = current [ segment ] as Record<string, unknown>;
    }
    current [ segments [ segments.length - 1 ]! ] = mutation.value;
    return result;
}

function applicationDiagnostics ( errors: readonly ErrorObject[] | null | undefined )
{
    return ( errors ?? [] ).map ( error =>
    {
        const path = error.instancePath || "/";
        return { path, message: path + " " + ( error.message ?? "does not satisfy the file schema" ) + "." };
    } );
}

function expectEquivalent ( input: unknown, oracle: ValidateFunction, compareDiagnostics = true ): void
{
    const expectedValid = oracle ( input );
    const expectedDiagnostics = applicationDiagnostics ( oracle.errors );
    expect ( validateGenerated ( input ) ).toBe ( expectedValid );
    if ( compareDiagnostics )
    {
        expect ( applicationDiagnostics ( validateGenerated.errors ) ).toEqual ( expectedDiagnostics );
        if ( !expectedValid )
        {
            const opened = openAuthoringDocument ( JSON.stringify ( input ) );
            expect ( opened.isSuccessful ).toBe ( false );
            expect ( opened.diagnostics.map ( diagnostic => ( { path: diagnostic.path, message: diagnostic.message } ) ) )
                .toEqual ( expectedDiagnostics );
        }
    }
}

const commonMutations: readonly Mutation[] = [
    ...[ "settings.name", "state_machine.events.0.name", "state_machine.states.0.name", "state_machine.actions.0.name",
        "state_machine.state_actions.entry.0.state", "state_machine.state_actions.exit.0.action" ].flatMap ( path =>
        [ "", "x".repeat ( 128 ), "x".repeat ( 129 ), "😀".repeat ( 128 ), "😀".repeat ( 129 ), null ].map ( value => ( { path, value } ) ) ),
    ...[ "settings.description", "state_machine.events.0.description" ].flatMap ( path =>
        [ "", "x".repeat ( 4096 ), "x".repeat ( 4097 ), null ].map ( value => ( { path, value } ) ) ),
    ...[ "chart.draft_transitions.0.id", "chart.indicators.terminal_state_indicators.0.id" ].flatMap ( path =>
        [ 0, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, -1, 1.5, "7" ].map ( value => ( { path, value } ) ) ),
    ...[ "chart.draft_transitions.0.source.x", "chart.draft_transitions.0.target.y" ].flatMap ( path =>
        [ 0, -1.5, "1", null ].map ( value => ( { path, value } ) ) ),
    { path: "state_machine.events.0", value: { description: "" } },
    { path: "state_machine.actions.0", value: { name: "action", description: "", unexpected: true } },
    { path: "state_machine.state_actions.entry.0", value: { action: "action" } },
    { path: "state_machine.state_actions.exit.0", value: { state: "A", action: "action", unexpected: true } },
    { path: "chart.draft_transitions.0.source", value: { x: 10 } },
    { path: "chart.draft_transitions.0.target", value: { x: 30, y: 40, unexpected: true } },
];

describe ( "shared standalone schema equivalence", () =>
{
    it.each ( VERSIONS ) ( "accepts a complete ordinary file under public schema %s", version =>
    {
        const oracle = publicValidators.get ( version )!;
        const input = fixture ( version );
        expectEquivalent ( input, oracle );
        expect ( oracle ( input ) ).toBe ( true );
    } );

    it.each ( VERSIONS ) ( "preserves shared-record acceptance and application diagnostics for %s", version =>
    {
        const oracle = publicValidators.get ( version )!;
        for ( const mutation of commonMutations )
        {
            expectEquivalent ( mutate ( fixture ( version ), mutation ), oracle );
        }
    } );

    it.each ( VERSIONS ) ( "preserves exact extension property gates for %s", version =>
    {
        const oracle = publicValidators.get ( version )!;
        for ( const [ introduced, path, values ] of [
            [ "1.1.0", "chart.draft_transitions.0.source_state", [ null, "A", 9 ] ],
            [ "1.1.0", "chart.draft_transitions.0.target_state", [ null, "A", "" ] ],
            [ "1.2.0", "chart.draft_transitions.0.remembered_event", [ null, "event", 9 ] ],
            [ "1.3.0", "chart.draft_transitions.0.source_indicator", [ null, { kind: "initial" }, { kind: "initial", id: 3 } ] ],
            [ "1.3.0", "chart.draft_transitions.0.target_indicator", [ null, { kind: "terminal", id: 3 }, { kind: "terminal", id: -1 } ] ],
            [ "1.3.0", "chart.indicators.indicator_transitions", [ [], [ {
                id: 0, source: { kind: "initial" }, target: { kind: "terminal", id: 3 },
            } ], null ] ],
        ] as const )
        {
            for ( const value of values )
            {
                // Legacy public schemas use additionalProperties while dispatch uses forbidden fields.
                // Compare their rejection decisions; compare exact diagnostics where the field exists.

                expectEquivalent ( mutate ( fixture ( version ), { path, value } ), oracle, version >= introduced );
            }
        }
    } );
} );
