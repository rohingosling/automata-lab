// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Solver Token Parser
// Version: 1.0.0
// Date:    2026-08-09
// Author:  Rohin Gosling
//
// Description:
//
//   Trims observation lines, removes blanks, and converts the public prefix grammar into a typed
//   token union.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type
{
    ParsedSolverObservation,
    SolverObservationDiagnostic,
    SolverObservationInput,
    SolverParseResult,
    SolverToken,
} from "./contracts.js";
import { MAXIMUM_SOLVER_TOKEN_CODE_POINT_COUNT } from "../model/limits.js";
import { canonicalizeBoundedSolverNamedToken } from "../model/solver-token.js";

//--------------------------------------------------------------------------------------------------
// Function: createLocation
//
// Description:
//
//   Creates location.
//
// Parameters:
//
//   - sequenceName:
//     The sequence name supplied to the operation.
//
//   - tokenIndex:
//     The token index supplied to the operation.
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

function createLocation ( sequenceName: string, tokenIndex: number )
{
    // Return the assembled result.

    return {
        sequenceName,
        tokenStart:        tokenIndex,
        tokenEndExclusive: tokenIndex + 1,
    };
}

//--------------------------------------------------------------------------------------------------
// Function: invalidTokenDiagnostic
//
// Description:
//
//   Derives the invalid token diagnostic.
//
// Parameters:
//
//   - sequenceName:
//     The sequence name supplied to the operation.
//
//   - tokenIndex:
//     The token index supplied to the operation.
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

function invalidTokenDiagnostic (
    sequenceName: string,
    tokenIndex: number,
): SolverObservationDiagnostic
{
    // Return the assembled result.

    return {
        code:        "SOLVER_TOKEN_INVALID",
        severity:    "error",
        message:     `Token ${tokenIndex + 1} is not a supported Solver token.`,
        remediation: `Use an Event, State, or Action token that canonicalizes to at most ${MAXIMUM_SOLVER_TOKEN_CODE_POINT_COUNT} Unicode code points.`,
        relatedLocations: [ createLocation ( sequenceName, tokenIndex ) ],
    };
}

//--------------------------------------------------------------------------------------------------
// Function: parseNamedToken
//
// Description:
//
//   Parses named token.
//
// Parameters:
//
//   - token:
//     The token supplied to the operation.
//
//   - tokenIndex:
//     The token index supplied to the operation.
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

function parseNamedToken (
    token: string,
    tokenIndex: number,
): SolverToken | null
{
    // Initialize the local values needed by this operation.

    const canonicalToken = canonicalizeBoundedSolverNamedToken ( token );

    // Return the result selected by the current condition.

    return canonicalToken === null ? null : { ...canonicalToken, tokenIndex };
}

//--------------------------------------------------------------------------------------------------
// Function: parseSolverObservation
//
// Description:
//
//   Parses solver observation.
//
// Parameters:
//
//   - input:
//     The input supplied to the operation.
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

export function parseSolverObservation ( input: SolverObservationInput ): SolverParseResult
{
    // Initialize the local values needed by this operation.

    const tokens: SolverToken[]                      = [];
    const diagnostics: SolverObservationDiagnostic[] = [];

    input.rawTokens.forEach ( ( rawToken, rawTokenIndex ) =>
    {
        // Initialize the local values needed by this operation.

        const token = rawToken.trim ();

        // Handle the case where token length equals 0.

        if ( token.length === 0 )
        {
            // Return control to the caller.

            return;
        }

        const parsedToken = parseNamedToken ( token, rawTokenIndex );

        // Handle the case where parsed token matches an absent value.

        if ( parsedToken === null )
        {
            diagnostics.push ( invalidTokenDiagnostic ( input.name, rawTokenIndex ) );

            // Return control to the caller.

            return;
        }

        tokens.push ( parsedToken );
    } );

    // Handle the case where some result is enabled.

    if ( diagnostics.some ( ( diagnostic ) => diagnostic.severity === "error" ) )
    {
        // Return the assembled result.

        return { isSuccessful: false, diagnostics };
    }

    const observation: ParsedSolverObservation =
    {
        name:         input.name,
        startContext: input.startContext,
        tokens,
    };

    // Return the assembled result.

    return { isSuccessful: true, observation, diagnostics };
}
