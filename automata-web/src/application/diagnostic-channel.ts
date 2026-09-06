// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Diagnostic Channel
// Version: 1.0.0
// Date:    2026-08-06
// Author:  Rohin Gosling
//
// Description:
//
//   Provides a bounded, framework-independent channel for structured Console entries.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { ConsoleEntry } from "./contracts";

export const MAXIMUM_CONSOLE_ENTRY_COUNT = 1_000;
export const MAXIMUM_CONSOLE_DIAGNOSTIC_BATCH_COUNT = 100;
export const MAXIMUM_CONSOLE_METADATA_CODE_POINT_COUNT = 256;
export const MAXIMUM_CONSOLE_TEXT_CODE_POINT_COUNT = 4_096;
export const MAXIMUM_CONSOLE_TIMESTAMP_CODE_POINT_COUNT = 64;

//--------------------------------------------------------------------------------------------------
// Type: ConsoleListener
//
// Description:
//
//   Defines the console listener type.
//
//--------------------------------------------------------------------------------------------------

export type ConsoleListener = ( entries: readonly ConsoleEntry[] ) => void;

//--------------------------------------------------------------------------------------------------
// Function: boundedConsoleText
//
// Description:
//
//   Derives the bounded console text.
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

function boundedConsoleText ( value: string, maximumCodePointCount: number ): string
{
    // Initialize the local values needed by this operation.

    let boundedValue   = "";
    let codePointCount = 0;
    let lastCodePoint  = "";

    // Process each code point from the value collection in order.

    for ( const codePoint of value )
    {
        // Handle the case where code point count is at least maximum code point count.

        if ( codePointCount >= maximumCodePointCount )
        {
            // Return the computed result.

            return `${boundedValue.slice ( 0, -lastCodePoint.length )}\u2026`;
        }

        boundedValue += codePoint;
        codePointCount++;
        lastCodePoint = codePoint;
    }

    // Return the bounded value.

    return boundedValue;
}

//--------------------------------------------------------------------------------------------------
// Function: boundedConsoleEntry
//
// Description:
//
//   Derives the bounded console entry.
//
// Parameters:
//
//   - entry:
//     The entry supplied to the operation.
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

function boundedConsoleEntry ( entry: ConsoleEntry ): ConsoleEntry
{
    // Initialize the local values needed by this operation.

    const context = entry.context === undefined
        ? undefined
        : Object.freeze ( {
            label: boundedConsoleText ( entry.context.label, MAXIMUM_CONSOLE_TEXT_CODE_POINT_COUNT ),
            route: entry.context.route,
        } );

    // Return the freeze result.

    return Object.freeze ( {
        code: boundedConsoleText ( entry.code, MAXIMUM_CONSOLE_METADATA_CODE_POINT_COUNT ),
        ...( context === undefined ? {} : { context } ),
        identifier: boundedConsoleText ( entry.identifier, MAXIMUM_CONSOLE_METADATA_CODE_POINT_COUNT ),
        severity: entry.severity,
        source: boundedConsoleText ( entry.source, MAXIMUM_CONSOLE_METADATA_CODE_POINT_COUNT ),
        text: boundedConsoleText ( entry.text, MAXIMUM_CONSOLE_TEXT_CODE_POINT_COUNT ),
        timestamp: boundedConsoleText ( entry.timestamp, MAXIMUM_CONSOLE_TIMESTAMP_CODE_POINT_COUNT ),
    } );
}

//--------------------------------------------------------------------------------------------------
// Class: DiagnosticChannel
//
// Description:
//
//   Implements the diagnostic channel behavior.
//
//--------------------------------------------------------------------------------------------------

export class DiagnosticChannel
{
    private readonly listeners = new Set <ConsoleListener> ();
    private entries: readonly ConsoleEntry[];

    //----------------------------------------------------------------------------------------------
    // Constructor: DiagnosticChannel
    //
    // Description:
    //
    //   Initializes a DiagnosticChannel instance.
    //
    // Parameters:
    //
    //   - initialEntries:
    //     The initial entries supplied to the operation.
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

    public constructor ( initialEntries: readonly ConsoleEntry[] = [] )
    {
        this.entries = Object.freeze ( initialEntries.slice ( -MAXIMUM_CONSOLE_ENTRY_COUNT ).map ( boundedConsoleEntry ) );
    }

    //----------------------------------------------------------------------------------------------
    // Method: clear
    //
    // Description:
    //
    //   Clears the stored state.
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

    public clear (): void
    {
        this.entries = Object.freeze ( [] );
        this.publishSnapshot ();
    }

    //----------------------------------------------------------------------------------------------
    // Method: getEntries
    //
    // Description:
    //
    //   Returns entries.
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

    public getEntries (): readonly ConsoleEntry[]
    {
        // Return the computed result.

        return this.entries;
    }

    //----------------------------------------------------------------------------------------------
    // Method: publish
    //
    // Description:
    //
    //   Publishes the requested value.
    //
    // Parameters:
    //
    //   - entry:
    //     The entry supplied to the operation.
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

    public publish ( entry: ConsoleEntry ): void
    {
        this.entries = Object.freeze ( [ ...this.entries, boundedConsoleEntry ( entry ) ]
            .slice ( -MAXIMUM_CONSOLE_ENTRY_COUNT ) );
        this.publishSnapshot ();
    }

    //----------------------------------------------------------------------------------------------
    // Method: subscribe
    //
    // Description:
    //
    //   Subscribes to the requested value.
    //
    // Parameters:
    //
    //   - listener:
    //     The listener supplied to the operation.
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

    public subscribe ( listener: ConsoleListener ): () => void
    {
        this.listeners.add ( listener );

        // Return the computed result.

        return () => this.listeners.delete ( listener );
    }

    //----------------------------------------------------------------------------------------------
    // Method: publishSnapshot
    //
    // Description:
    //
    //   Publishes snapshot.
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

    private publishSnapshot (): void
    {
        // Process each listener from the listeners collection in order.

        for ( const listener of this.listeners )
        {
            listener ( this.entries );
        }
    }
}
