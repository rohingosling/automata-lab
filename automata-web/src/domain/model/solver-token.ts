// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Solver Token Classifier Grammar
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Canonicalizes the human-friendly token classifiers shared by saved-document validation and
//   Solver parsing.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import
{
    MAXIMUM_NAME_CODE_POINT_COUNT,
    MAXIMUM_SOLVER_TOKEN_CODE_POINT_COUNT,
} from "./limits.js";

//--------------------------------------------------------------------------------------------------
// Type: SolverNamedTokenKind
//
// Description:
//
//   Defines the supported solver named token kind alternatives.
//
//--------------------------------------------------------------------------------------------------

export type SolverNamedTokenKind = "action" | "event" | "state";

//--------------------------------------------------------------------------------------------------
// Interface: CanonicalSolverNamedToken
//
// Description:
//
//   Defines the structure of canonical solver named token.
//
//--------------------------------------------------------------------------------------------------

export interface CanonicalSolverNamedToken
{
    readonly kind: SolverNamedTokenKind;
    readonly name: string;
}

//--------------------------------------------------------------------------------------------------
// Interface: SolverTokenPrefix
//
// Description:
//
//   Defines the structure of solver token prefix.
//
//--------------------------------------------------------------------------------------------------

interface SolverTokenPrefix
{
    readonly canonicalPrefix: string;
    readonly compactPrefix:   string;
    readonly kind:            SolverNamedTokenKind;
    readonly words:           readonly string[];
}

const SOLVER_TOKEN_PREFIXES: readonly SolverTokenPrefix[] =
[
    { canonicalPrefix: "event_", compactPrefix: "Event", kind: "event", words: [ "event", "Event", "EVENT" ] },
    { canonicalPrefix: "state_", compactPrefix: "State", kind: "state", words: [ "state", "State", "STATE" ] },
    { canonicalPrefix: "action_", compactPrefix: "Action", kind: "action", words: [ "action", "Action", "ACTION" ] },
];

//--------------------------------------------------------------------------------------------------
// Function: codePointCountWithin
//
// Description:
//
//   Derives the code point count within.
//
// Parameters:
//
//   - value:
//     The value supplied to the operation.
//
//   - maximumCodePointCount:
//     The maximum code point count supplied to the operation.
//
// Returns:
//
//   True when the named condition is satisfied; otherwise, false.
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

function codePointCountWithin ( value: string, maximumCodePointCount: number ): boolean
{
    // Handle the case where value length exceeds current value.

    if ( value.length > maximumCodePointCount * 2 )
    {
        // Return the computed result.

        return false;
    }

    let codePointCount = 0;

    // Process each code point from the value collection in order.

    for ( const _codePoint of value )
    {
        codePointCount++;

        // Handle the case where code point count exceeds maximum code point count.

        if ( codePointCount > maximumCodePointCount )
        {
            // Return the computed result.

            return false;
        }
    }

    // Return the computed result.

    return true;
}

//--------------------------------------------------------------------------------------------------
// Function: isSolverTokenTextWithinBounds
//
// Description:
//
//   Determines whether solver token text within bounds.
//
// Parameters:
//
//   - value:
//     The value supplied to the operation.
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

export function isSolverTokenTextWithinBounds ( value: unknown ): value is string
{
    // Return the computed result.

    return typeof value === "string" && codePointCountWithin ( value, MAXIMUM_SOLVER_TOKEN_CODE_POINT_COUNT );
}

//--------------------------------------------------------------------------------------------------
// Function: canonicalizeSuffix
//
// Description:
//
//   Canonicalizes the suffix.
//
// Parameters:
//
//   - token:
//     The token supplied to the operation.
//
//   - prefix:
//     The prefix supplied to the operation.
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

function canonicalizeSuffix (
    token: string,
    prefix: SolverTokenPrefix,
): string | null
{
    // Process each word from the prefix words collection in order.

    for ( const word of prefix.words )
    {
        // Process each separator from the current value collection in order.

        for ( const separator of [ "_", "-", " " ] )
        {
            // Initialize the local values needed by this operation.

            const acceptedPrefix = `${word}${separator}`;

            // Handle the case where starts with result is enabled.

            if ( token.startsWith ( acceptedPrefix ) )
            {
                // Initialize the local values needed by this operation.

                const suffix = token.slice ( acceptedPrefix.length ).trim ();

                // Return the result selected by the current condition.

                return suffix.length === 0 ? null : `${prefix.canonicalPrefix}${suffix}`;
            }
        }
    }

    // Handle the case where starts with result is enabled.

    if ( token.startsWith ( prefix.compactPrefix ) )
    {
        // Initialize the local values needed by this operation.

        const compactSuffix = token.slice ( prefix.compactPrefix.length );

        // Handle the case where at least one branch condition is satisfied.

        if ( compactSuffix.startsWith ( "_" ) || compactSuffix.startsWith ( "-" ) || /^\s/u.test ( compactSuffix ) )
        {
            // Return the computed result.

            return null;
        }

        const suffix = compactSuffix.trim ();

        // Return the result selected by the current condition.

        return suffix.length === 0 ? null : `${prefix.canonicalPrefix}${suffix}`;
    }

    // Return the computed result.

    return null;
}

//--------------------------------------------------------------------------------------------------
// Function: canonicalizeSolverNamedToken
//
// Description:
//
//   Canonicalizes the solver named token.
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
//--------------------------------------------------------------------------------------------------

export function canonicalizeSolverNamedToken ( token: string ): CanonicalSolverNamedToken | null
{
    // Process each prefix from the solver token prefixes collection in order.

    for ( const prefix of SOLVER_TOKEN_PREFIXES )
    {
        // Initialize the local values needed by this operation.

        const canonicalName = canonicalizeSuffix ( token, prefix );

        // Handle the case where canonical name differs from an absent value.

        if ( canonicalName !== null )
        {
            // Return the assembled result.

            return { kind: prefix.kind, name: canonicalName };
        }
    }

    // Return the computed result.

    return null;
}

//--------------------------------------------------------------------------------------------------
// Function: canonicalizeBoundedSolverNamedToken
//
// Description:
//
//   Canonicalizes the bounded solver named token.
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
//--------------------------------------------------------------------------------------------------

export function canonicalizeBoundedSolverNamedToken ( token: string ): CanonicalSolverNamedToken | null
{
    // Handle the case where the is solver token text within bounds result condition is not
    // satisfied.

    if ( !isSolverTokenTextWithinBounds ( token ) )
    {
        // Return the computed result.

        return null;
    }

    const canonicalToken = canonicalizeSolverNamedToken ( token );

    // Return the result selected by the current condition.

    return canonicalToken !== null && codePointCountWithin ( canonicalToken.name, MAXIMUM_NAME_CODE_POINT_COUNT )
        ? canonicalToken
        : null;
}
