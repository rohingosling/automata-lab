// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Strict JSON Parser
// Version: 1.0.0
// Date:    2026-08-09
// Author:  Rohin Gosling
//
// Description:
//
//   Parses bounded JSON with duplicate-member and prototype-pollution rejection before ordinary
//   object construction.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { JsonValue } from "../../domain/model/contracts.js";
import { MAXIMUM_FILE_BYTE_COUNT } from "../../domain/model/limits.js";

//--------------------------------------------------------------------------------------------------
// Type: StrictJsonErrorCode
//
// Description:
//
//   Defines the supported strict JSON error code alternatives.
//
//--------------------------------------------------------------------------------------------------

export type StrictJsonErrorCode =
    | "DUPLICATE_JSON_MEMBER"
    | "FILE_TOO_LARGE"
    | "JSON_MALFORMED"
    | "PROTOTYPE_KEY_FORBIDDEN";

//--------------------------------------------------------------------------------------------------
// Interface: StrictJsonError
//
// Description:
//
//   Defines the structure of strict JSON error.
//
//--------------------------------------------------------------------------------------------------

export interface StrictJsonError
{
    readonly code:     StrictJsonErrorCode;
    readonly message:  string;
    readonly position: number;
}

//--------------------------------------------------------------------------------------------------
// Type: StrictJsonResult
//
// Description:
//
//   Describes the result produced by strict JSON.
//
//--------------------------------------------------------------------------------------------------

export type StrictJsonResult =
    | { readonly isSuccessful: true; readonly value: JsonValue }
    | { readonly isSuccessful: false; readonly error: StrictJsonError };

//--------------------------------------------------------------------------------------------------
// Class: JsonParseFailure
//
// Description:
//
//   Implements the JSON parse failure behavior.
//
//--------------------------------------------------------------------------------------------------

class JsonParseFailure extends Error
{
    public readonly code:     StrictJsonErrorCode;
    public readonly position: number;

    //----------------------------------------------------------------------------------------------
    // Constructor: JsonParseFailure
    //
    // Description:
    //
    //   Initializes a JsonParseFailure instance.
    //
    // Parameters:
    //
    //   - code:
    //     The code supplied to the operation.
    //
    //   - message:
    //     The message supplied to the operation.
    //
    //   - position:
    //     The position supplied to the operation.
    //
    // Returns:
    //
    //   No value is returned.
    //
    // Preconditions:
    //
    //   - The supplied arguments satisfy their declared TypeScript contracts.
    //
    // Postconditions:
    //
    //   - The described side effects are complete when the callable returns.
    //
    //----------------------------------------------------------------------------------------------

    public constructor ( code: StrictJsonErrorCode, message: string, position: number )
    {
        super ( message );
        this.name     = "JsonParseFailure";
        this.code     = code;
        this.position = position;
    }
}

const FORBIDDEN_PROPERTY_NAMES = new Set ( [ "__proto__", "constructor", "prototype" ] );

//--------------------------------------------------------------------------------------------------
// Class: StrictJsonReader
//
// Description:
//
//   Implements the strict JSON reader behavior.
//
//--------------------------------------------------------------------------------------------------

class StrictJsonReader
{
    readonly #text: string;
    #position: number;

    //----------------------------------------------------------------------------------------------
    // Constructor: StrictJsonReader
    //
    // Description:
    //
    //   Initializes a StrictJsonReader instance.
    //
    // Parameters:
    //
    //   - text:
    //     The text supplied to the operation.
    //
    // Returns:
    //
    //   No value is returned.
    //
    // Preconditions:
    //
    //   - The supplied arguments satisfy their declared TypeScript contracts.
    //
    // Postconditions:
    //
    //   - The described side effects are complete when the callable returns.
    //
    //----------------------------------------------------------------------------------------------

    public constructor ( text: string )
    {
        this.#text     = text;
        this.#position = 0;
    }

    //----------------------------------------------------------------------------------------------
    // Method: parse
    //
    // Description:
    //
    //   Derives the parse.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   The value produced by the operation.
    //
    // Preconditions:
    //
    //   - None.
    //
    // Postconditions:
    //
    //   - The returned value represents the result described above.
    //
    //----------------------------------------------------------------------------------------------

    public parse (): JsonValue
    {
        this.skipWhitespace ();
        const value = this.parseValue ();

        this.skipWhitespace ();

        // Handle the case where #position differs from length.

        if ( this.#position !== this.#text.length )
        {
            this.fail ( "JSON_MALFORMED", "Unexpected content follows the root JSON value." );
        }

        // Return the value.

        return value;
    }

    //----------------------------------------------------------------------------------------------
    // Method: parseValue
    //
    // Description:
    //
    //   Parses value.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   The value produced by the operation.
    //
    // Preconditions:
    //
    //   - None.
    //
    // Postconditions:
    //
    //   - The returned value represents the result described above.
    //
    //----------------------------------------------------------------------------------------------

    private parseValue (): JsonValue
    {
        // Initialize the local values needed by this operation.

        const character = this.#text [ this.#position ];

        // Dispatch according to the character value.

        switch ( character )
        {
            // Handle the "{" case.

            case "{":

                // Return the parse object result.

                return this.parseObject ();

            // Handle the "[" case.

            case "[":

                // Return the parse array result.

                return this.parseArray ();

            // Handle the """ case.

            case "\"":

                // Return the parse string result.

                return this.parseString ();

            // Handle the "t" case.

            case "t":
                this.expectLiteral ( "true" );

                // Return the computed result.

                return true;

            // Handle the "f" case.

            case "f":
                this.expectLiteral ( "false" );

                // Return the computed result.

                return false;

            // Handle the "n" case.

            case "n":
                this.expectLiteral ( "null" );

                // Return the computed result.

                return null;

            // Handle values not matched by an earlier case.

            default:

                // Handle the case where at least one branch condition is satisfied.

                if ( character === "-" || ( character !== undefined && character >= "0" && character <= "9" ) )
                {
                    // Return the parse number result.

                    return this.parseNumber ();
                }

                this.fail ( "JSON_MALFORMED", "Expected a JSON value." );
        }
    }

    //----------------------------------------------------------------------------------------------
    // Method: parseObject
    //
    // Description:
    //
    //   Parses object.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   The value produced by the operation.
    //
    // Preconditions:
    //
    //   - None.
    //
    // Postconditions:
    //
    //   - The returned value represents the result described above.
    //
    //----------------------------------------------------------------------------------------------

    private parseObject (): { readonly [ propertyName: string ]: JsonValue }
    {
        // Initialize the local values needed by this operation.

        const entries: [ string, JsonValue ][] = [];
        const propertyNames                    = new Set<string> ();

        this.expectCharacter ( "{" );
        this.skipWhitespace ();

        // Handle the case where peek character result matches the } value.

        if ( this.peekCharacter () === "}" )
        {
            this.#position++;

            // Return the from entries result.

            return Object.fromEntries ( entries );
        }

        // Continue the operation while its terminating condition has not been reached.

        while ( true )
        {
            // Handle the case where peek character result differs from the " value.

            if ( this.peekCharacter () !== "\"" )
            {
                this.fail ( "JSON_MALFORMED", "Expected a quoted object member name." );
            }

            // Initialize the local values needed by this operation.

            const propertyPosition = this.#position;
            const propertyName     = this.parseString ();

            // Handle the case where has result is enabled.

            if ( propertyNames.has ( propertyName ) )
            {
                throw new JsonParseFailure (
                    "DUPLICATE_JSON_MEMBER",
                    `Object member '${propertyName}' occurs more than once.`,
                    propertyPosition,
                );
            }

            // Handle the case where has result is enabled.

            if ( FORBIDDEN_PROPERTY_NAMES.has ( propertyName ) )
            {
                throw new JsonParseFailure (
                    "PROTOTYPE_KEY_FORBIDDEN",
                    `Object member '${propertyName}' is forbidden.`,
                    propertyPosition,
                );
            }

            propertyNames.add ( propertyName );
            this.skipWhitespace ();
            this.expectCharacter ( ":" );
            this.skipWhitespace ();
            entries.push ( [ propertyName, this.parseValue () ] );
            this.skipWhitespace ();

            const delimiter = this.peekCharacter ();

            // Handle the case where delimiter matches the } value.

            if ( delimiter === "}" )
            {
                this.#position++;
                break;
            }

            // Handle the case where delimiter differs from the , value.

            if ( delimiter !== "," )
            {
                this.fail ( "JSON_MALFORMED", "Expected ',' or '}' after an object member." );
            }

            this.#position++;
            this.skipWhitespace ();
        }

        // Return the from entries result.

        return Object.fromEntries ( entries );
    }

    //----------------------------------------------------------------------------------------------
    // Method: parseArray
    //
    // Description:
    //
    //   Parses array.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   The value produced by the operation.
    //
    // Preconditions:
    //
    //   - None.
    //
    // Postconditions:
    //
    //   - The returned value represents the result described above.
    //
    //----------------------------------------------------------------------------------------------

    private parseArray (): readonly JsonValue[]
    {
        // Initialize the local values needed by this operation.

        const values: JsonValue[] = [];

        this.expectCharacter ( "[" );
        this.skipWhitespace ();

        // Handle the case where peek character result matches the ] value.

        if ( this.peekCharacter () === "]" )
        {
            this.#position++;

            // Return the values.

            return values;
        }

        // Continue the operation while its terminating condition has not been reached.

        while ( true )
        {
            values.push ( this.parseValue () );
            this.skipWhitespace ();

            const delimiter = this.peekCharacter ();

            // Handle the case where delimiter matches the ] value.

            if ( delimiter === "]" )
            {
                this.#position++;
                break;
            }

            // Handle the case where delimiter differs from the , value.

            if ( delimiter !== "," )
            {
                this.fail ( "JSON_MALFORMED", "Expected ',' or ']' after an array item." );
            }

            this.#position++;
            this.skipWhitespace ();
        }

        // Return the values.

        return values;
    }

    //----------------------------------------------------------------------------------------------
    // Method: parseString
    //
    // Description:
    //
    //   Parses string.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   The value produced by the operation.
    //
    // Preconditions:
    //
    //   - None.
    //
    // Postconditions:
    //
    //   - The returned value represents the result described above.
    //
    //----------------------------------------------------------------------------------------------

    private parseString (): string
    {
        // Initialize the local values needed by this operation.

        const startPosition = this.#position;
        let escaped         = false;

        this.#position++;

        // Continue the operation while its terminating condition has not been reached.

        while ( this.#position < this.#text.length )
        {
            // Initialize the local values needed by this operation.

            const character = this.#text [ this.#position ];

            // Handle the case where all required conditions are satisfied.

            if ( !escaped && character === "\"" )
            {
                this.#position++;
                const rawString: unknown = JSON.parse ( this.#text.slice ( startPosition, this.#position ) );

                // Handle the case where current value differs from the string value.

                if ( typeof rawString !== "string" )
                {
                    this.fail ( "JSON_MALFORMED", "Expected a JSON string." );
                }

                // Return the raw string.

                return rawString;
            }

            // Handle the case where all required conditions are satisfied.

            if ( !escaped && character !== undefined && character.charCodeAt ( 0 ) < 0x20 )
            {
                this.fail ( "JSON_MALFORMED", "Unescaped control character in JSON string." );
            }

            // Handle the case where escaped is enabled.

            if ( escaped )
            {
                escaped = false;
            }
            else if ( character === "\\" )
            {
                escaped = true;
            }

            this.#position++;
        }

        this.fail ( "JSON_MALFORMED", "Unterminated JSON string." );
    }

    //----------------------------------------------------------------------------------------------
    // Method: parseNumber
    //
    // Description:
    //
    //   Parses number.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   The value produced by the operation.
    //
    // Preconditions:
    //
    //   - None.
    //
    // Postconditions:
    //
    //   - The returned value represents the result described above.
    //
    //----------------------------------------------------------------------------------------------

    private parseNumber (): number
    {
        // Initialize the local values needed by this operation.

        const remainingText = this.#text.slice ( this.#position );
        const match         = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec ( remainingText );

        // Handle the case where match matches an absent value.

        if ( match === null )
        {
            this.fail ( "JSON_MALFORMED", "Invalid JSON number." );
        }

        // Initialize the local values needed by this operation.

        const numberText = match [ 0 ];
        const value      = Number ( numberText );

        // Handle the case where the is finite result condition is not satisfied.

        if ( !Number.isFinite ( value ) )
        {
            this.fail ( "JSON_MALFORMED", "JSON number is outside the finite numeric range." );
        }

        this.#position += numberText.length;

        // Return the value.

        return value;
    }

    //----------------------------------------------------------------------------------------------
    // Method: expectLiteral
    //
    // Description:
    //
    //   Verifies literal and reports a failure when it is invalid.
    //
    // Parameters:
    //
    //   - literal:
    //     The literal supplied to the operation.
    //
    // Returns:
    //
    //   No value is returned.
    //
    // Preconditions:
    //
    //   - The supplied arguments satisfy their declared TypeScript contracts.
    //
    // Postconditions:
    //
    //   - The described side effects are complete when the callable returns.
    //
    //----------------------------------------------------------------------------------------------

    private expectLiteral ( literal: string ): void
    {
        // Handle the case where slice result differs from literal.

        if ( this.#text.slice ( this.#position, this.#position + literal.length ) !== literal )
        {
            this.fail ( "JSON_MALFORMED", `Expected '${literal}'.` );
        }

        this.#position += literal.length;
    }

    //----------------------------------------------------------------------------------------------
    // Method: expectCharacter
    //
    // Description:
    //
    //   Verifies character and reports a failure when it is invalid.
    //
    // Parameters:
    //
    //   - character:
    //     The character supplied to the operation.
    //
    // Returns:
    //
    //   No value is returned.
    //
    // Preconditions:
    //
    //   - The supplied arguments satisfy their declared TypeScript contracts.
    //
    // Postconditions:
    //
    //   - The described side effects are complete when the callable returns.
    //
    //----------------------------------------------------------------------------------------------

    private expectCharacter ( character: string ): void
    {
        // Handle the case where peek character result differs from character.

        if ( this.peekCharacter () !== character )
        {
            this.fail ( "JSON_MALFORMED", `Expected '${character}'.` );
        }

        this.#position++;
    }

    //----------------------------------------------------------------------------------------------
    // Method: peekCharacter
    //
    // Description:
    //
    //   Derives the peek character.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   The value produced by the operation.
    //
    // Preconditions:
    //
    //   - None.
    //
    // Postconditions:
    //
    //   - The returned value represents the result described above.
    //
    //----------------------------------------------------------------------------------------------

    private peekCharacter (): string | undefined
    {
        // Return the computed result.

        return this.#text [ this.#position ];
    }

    //----------------------------------------------------------------------------------------------
    // Method: skipWhitespace
    //
    // Description:
    //
    //   Handles the skip whitespace behavior.
    //
    // Parameters:
    //
    //   None.
    //
    // Returns:
    //
    //   No value is returned.
    //
    // Preconditions:
    //
    //   - None.
    //
    // Postconditions:
    //
    //   - The described side effects are complete when the callable returns.
    //
    //----------------------------------------------------------------------------------------------

    private skipWhitespace (): void
    {
        // Continue the operation while its terminating condition has not been reached.

        while ( /[\t\n\r ]/.test ( this.#text [ this.#position ] ?? "" ) )
        {
            this.#position++;
        }
    }

    //----------------------------------------------------------------------------------------------
    // Method: fail
    //
    // Description:
    //
    //   Marks the operation as failed.
    //
    // Parameters:
    //
    //   - code:
    //     The code supplied to the operation.
    //
    //   - message:
    //     The message supplied to the operation.
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
    //----------------------------------------------------------------------------------------------

    private fail ( code: StrictJsonErrorCode, message: string ): never
    {
        throw new JsonParseFailure ( code, message, this.#position );
    }
}

//--------------------------------------------------------------------------------------------------
// Function: parseStrictJson
//
// Description:
//
//   Parses strict JSON.
//
// Parameters:
//
//   - text:
//     The text supplied to the operation.
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

export function parseStrictJson ( text: string ): StrictJsonResult
{
    // Initialize the local values needed by this operation.

    const byteCount = new TextEncoder ().encode ( text ).byteLength;

    // Handle the case where byte count exceeds maximum file byte count.

    if ( byteCount > MAXIMUM_FILE_BYTE_COUNT )
    {
        // Return the assembled result.

        return {
            isSuccessful: false,
            error:
            {
                code:     "FILE_TOO_LARGE",
                message:  `The file contains ${byteCount} bytes; the maximum is ${MAXIMUM_FILE_BYTE_COUNT}.`,
                position: 0,
            },
        };
    }

    // Run the operation that may report a recoverable failure.

    try
    {
        // Return the assembled result.

        return { isSuccessful: true, value: new StrictJsonReader ( text ).parse () };
    }
    catch ( error: unknown )
    {
        // Recover from the reported failure without hiding its outcome.

        if ( error instanceof JsonParseFailure )
        {
            // Return the assembled result.

            return {
                isSuccessful: false,
                error:
                {
                    code:     error.code,
                    message:  error.message,
                    position: error.position,
                },
            };
        }

        // Return the assembled result.

        return {
            isSuccessful: false,
            error:
            {
                code:     "JSON_MALFORMED",
                message:  error instanceof Error ? error.message : "The JSON text is malformed.",
                position: 0,
            },
        };
    }
}
