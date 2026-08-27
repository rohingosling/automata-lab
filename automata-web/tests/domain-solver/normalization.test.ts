// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Solver Observation Normalization Tests
// Version: 1.0.0
// Date:    2026-08-09
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies token typing, event intervals, state/action ordering, hard conflicts, and contexts.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from "vitest";
import type { SolverStartContext } from "../../src/domain/model/contracts.js";
import
{
    MAXIMUM_NAME_CODE_POINT_COUNT,
    MAXIMUM_SOLVER_TOKEN_COUNT,
    MAXIMUM_SOLVER_TOKEN_CODE_POINT_COUNT,
} from "../../src/domain/model/limits.js";
import { normalizeSolverObservations } from "../../src/domain/solver/normalization.js";
import { parseSolverObservation } from "../../src/domain/solver/parser.js";

const SOLVER_START_CONTEXTS: readonly SolverStartContext[] = [ "initial", "continuation", "infer" ];
const HUMAN_FRIENDLY_PREFIX_CASES                          = 
[
    ...[ "event", "Event", "EVENT" ].flatMap ( word => [ "_", "-", " " ].map ( separator =>
        [ `${word}${separator}sample`, "event", "event_sample" ] as const ) ),
    [ "EventSample", "event", "event_Sample" ] as const,
    ...[ "state", "State", "STATE" ].flatMap ( word => [ "_", "-", " " ].map ( separator =>
        [ `${word}${separator}sample`, "state", "state_sample" ] as const ) ),
    [ "StateSample", "state", "state_Sample" ] as const,
    ...[ "action", "Action", "ACTION" ].flatMap ( word => [ "_", "-", " " ].map ( separator =>
        [ `${word}${separator}sample`, "action", "action_sample" ] as const ) ),
    [ "ActionSample", "action", "action_Sample" ] as const,
] as const;

describe ( "Solver observation parsing and normalization", () =>
{
    it ( "parses prefixes immediately and removes trimmed blank lines", () =>
    {
        // Initialize the local values needed by this operation.

        const result = parseSolverObservation (
            {
                name:         "typed",
                startContext: "initial",
                rawTokens:    [ "  state_ready  ", "", " action_first ", "event_go" ],
            },
        );

        expect ( result.isSuccessful ).toBe ( true );

        // Handle the case where result is successful is enabled.

        if ( result.isSuccessful )
        {
            expect ( result.observation.tokens.map ( ( token ) => token.kind ) ).toEqual (
                [ "state", "action", "event" ],
            );
        }
    } );

    it.each ( HUMAN_FRIENDLY_PREFIX_CASES ) (
        "canonicalizes human-friendly token '%s' as %s",
        ( rawToken, expectedKind, expectedName ) =>
        {
            // Initialize the local values needed by this operation.

            const result = parseSolverObservation (
                { name: "prefix", startContext: "infer", rawTokens: [ rawToken ] },
            );

            expect ( result.isSuccessful ).toBe ( true );

            // Handle the case where result is successful is enabled.

            if ( result.isSuccessful )
            {
                expect ( result.observation.tokens ).toEqual (
                    [ { kind: expectedKind, name: expectedName, tokenIndex: 0 } ],
                );
            }
        },
    );

    it.each ( [ "event_", "Event-", "EVENT ", "state_", "State-", "STATE ", "action_", "Action-", "ACTION " ] ) (
        "rejects an empty human-friendly prefix '%s'",
        ( rawToken ) =>
        {
            // Initialize the local values needed by this operation.

            const result = parseSolverObservation (
                { name: "empty-prefix", startContext: "infer", rawTokens: [ rawToken ] },
            );

            expect ( result.isSuccessful ).toBe ( false );
        },
    );

    it ( "accepts a maximum-length canonical token and rejects raw or post-canonicalization overflow", () =>
    {
        // Initialize the local values needed by this operation.

        const exactToken = `action_${"😀".repeat (
            MAXIMUM_SOLVER_TOKEN_CODE_POINT_COUNT - [ ..."action_" ].length,
        )}`;
        const compactCanonicalOverflow = `Action${"x".repeat (
            MAXIMUM_NAME_CODE_POINT_COUNT - [ ..."Action" ].length,
        )}`;

        //------------------------------------------------------------------------------------------
        // Function: parseToken
        //
        // Description:
        //
        //   Parses token.
        //
        // Parameters:
        //
        //   - token:
        //     The token supplied to the operation.
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
        //------------------------------------------------------------------------------------------

        const parseToken = ( token: string ) => parseSolverObservation ( {
            name:         "token-boundary",
            startContext: "infer",
            rawTokens:    [ token ],
        } );
        const exactResult             = parseToken ( exactToken );
        const excessiveResult         = parseToken ( `${exactToken}😀` );
        const canonicalOverflowResult = parseToken ( compactCanonicalOverflow );

        expect ( exactResult.isSuccessful ).toBe ( true );
        expect ( excessiveResult ).toMatchObject ( {
            isSuccessful: false,
            diagnostics: [ expect.objectContaining ( { code: "SOLVER_TOKEN_INVALID" } ) ],
        } );
        expect ( canonicalOverflowResult ).toMatchObject ( {
            isSuccessful: false,
            diagnostics: [ expect.objectContaining ( { code: "SOLVER_TOKEN_INVALID" } ) ],
        } );

        // Handle the case where the excessive result is successful condition is not satisfied.

        if ( !excessiveResult.isSuccessful )
        {
            expect ( excessiveResult.diagnostics [ 0 ]?.message ).not.toContain ( exactToken );
        }
    } );

    it.each ( SOLVER_START_CONTEXTS ) (
        "preserves the %s start context and event-delimited complete action words",
        ( startContext ) =>
        {
            // Initialize the local values needed by this operation.

            const result = normalizeSolverObservations (
                [
                    {
                        name:         startContext,
                        startContext,
                        rawTokens:
                        [
                            "action_first",
                            "state_before",
                            "action_second",
                            "event_go",
                            "state_after",
                            "action_third",
                            "action_third",
                        ],
                    },
                ],
            );

            expect ( result.isSuccessful ).toBe ( true );

            // Handle the case where result is successful is enabled.

            if ( result.isSuccessful )
            {
                expect ( result.observations [ 0 ]?.startContext ).toBe ( startContext );
                expect ( result.observations [ 0 ]?.intervals ).toMatchObject (
                    [
                        {
                            incomingEvent: null,
                            explicitState: "state_before",
                            entryActions:  [ "action_first", "action_second" ],
                        },
                        {
                            incomingEvent: "event_go",
                            explicitState: "state_after",
                            entryActions:  [ "action_third", "action_third" ],
                        },
                    ],
                );
            }
        },
    );

    it ( "treats state/action and action/state order as the same interval constraint", () =>
    {
        // Initialize the local values needed by this operation.

        const result = normalizeSolverObservations (
            [
                {
                    name:         "state-first",
                    startContext: "continuation",
                    rawTokens:    [ "state_ready", "action_one", "action_two" ],
                },
                {
                    name:         "action-first",
                    startContext: "continuation",
                    rawTokens:    [ "action_one", "state_ready", "action_two" ],
                },
            ],
        );

        expect ( result.isSuccessful ).toBe ( true );

        // Handle the case where result is successful is enabled.

        if ( result.isSuccessful )
        {
            expect ( result.observations [ 0 ]?.intervals [ 0 ]?.entryActions ).toEqual ( [ "action_one", "action_two" ] );
            expect ( result.observations [ 1 ]?.intervals [ 0 ]?.entryActions ).toEqual ( [ "action_one", "action_two" ] );
        }
    } );

    it ( "reports all multiple-state, action-word, and initial-state conflicts", () =>
    {
        // Initialize the local values needed by this operation.

        const result = normalizeSolverObservations (
            [
                {
                    name:         "first",
                    startContext: "initial",
                    rawTokens:    [ "state_one", "state_two", "action_a" ],
                },
                {
                    name:         "second",
                    startContext: "initial",
                    rawTokens:    [ "state_two", "action_b" ],
                },
                {
                    name:         "third",
                    startContext: "continuation",
                    rawTokens:    [ "state_two", "action_c" ],
                },
            ],
        );

        expect ( result.isSuccessful ).toBe ( false );
        expect ( result.diagnostics.map ( ( diagnostic ) => diagnostic.code ) ).toEqual (
            expect.arrayContaining (
                [ "MULTIPLE_STATES_IN_INTERVAL", "ACTION_WORD_CONFLICT", "INITIAL_STATE_CONFLICT" ],
            ),
        );
        expect ( result.diagnostics.every ( ( diagnostic ) => diagnostic.relatedLocations.length > 0 ) ).toBe ( true );
    } );

    it ( "rejects an unsupported unclassified token", () =>
    {
        // Initialize the local values needed by this operation.

        const result = normalizeSolverObservations (
            [
                {
                    name:         "unsupported-token",
                    startContext: "infer",
                    rawTokens:    [ "event_end", "state_done", "unsupported_token" ],
                },
            ],
        );

        expect ( result.isSuccessful ).toBe ( false );
        expect ( result.diagnostics.map ( ( diagnostic ) => diagnostic.code ) ).toContain ( "SOLVER_TOKEN_INVALID" );
    } );

    it ( "returns a deterministic warning for zero observations", () =>
    {
        // Initialize the local values needed by this operation.

        const result = normalizeSolverObservations ( [] );

        expect ( result ).toMatchObject (
            {
                isSuccessful: true,
                observations: [],
                diagnostics:  [ { code: "NO_OBSERVATIONS", severity: "warning" } ],
            },
        );
    } );

    it ( "rejects over-capacity input during the shared Validate and Solve preflight", () =>
    {
        // Calculate the result value from the current inputs.

        const result = normalizeSolverObservations (
            [
                {
                    name: "over-capacity",
                    startContext: "infer",
                    rawTokens: new Array<string> ( MAXIMUM_SOLVER_TOKEN_COUNT + 1 ).fill ( "action repeated" ),
                },
            ],
        );

        expect ( result ).toMatchObject (
            { isSuccessful: false, diagnostics: [ { code: "CAPACITY_EXCEEDED" } ] },
        );
    } );
} );
