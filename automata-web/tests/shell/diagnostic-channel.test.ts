// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Diagnostic Channel Tests
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies bounded structured Console retention, notifications, and non-semantic clearing.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it, vi } from "vitest";

import
{
    DiagnosticChannel,
    MAXIMUM_CONSOLE_ENTRY_COUNT,
    MAXIMUM_CONSOLE_METADATA_CODE_POINT_COUNT,
    MAXIMUM_CONSOLE_TEXT_CODE_POINT_COUNT,
    MAXIMUM_CONSOLE_TIMESTAMP_CODE_POINT_COUNT,
} from "../../src/application/diagnostic-channel";

describe ( "AL-CON-005 structured Console channel", () =>
{
    it ( "evicts the oldest entry after the bounded capacity", () =>
    {
        // Initialize the local values needed by this operation.

        const channel = new DiagnosticChannel ();

        // Repeat the operation across the bounded iteration range.

        for ( let i = 0; i <= MAXIMUM_CONSOLE_ENTRY_COUNT; i++ )
        {
            channel.publish (
                {
                    code: `MESSAGE_${i}`,
                    identifier: `message-${i}`,
                    severity: "message",
                    source: "Test",
                    text: `Message ${i}`,
                    timestamp: "2026-08-10T00:00:00.000Z",
                }
            );
        }

        expect ( channel.getEntries () ).toHaveLength ( MAXIMUM_CONSOLE_ENTRY_COUNT );
        expect ( channel.getEntries () [ 0 ]?.code ).toBe ( "MESSAGE_1" );
    } );

    it ( "notifies subscribers when displayed history is cleared", () =>
    {
        // Initialize the local values needed by this operation.

        const listener = vi.fn ();
        const channel  = new DiagnosticChannel ();

        channel.subscribe ( listener );
        channel.clear ();

        expect ( listener ).toHaveBeenCalledWith ( [] );
    } );

    it ( "bounds and freeze-copies hostile entry text before retention", () =>
    {
        // Initialize the local values needed by this operation.

        const channel = new DiagnosticChannel ();
        const entry   = 
        {
            code: "C".repeat ( MAXIMUM_CONSOLE_METADATA_CODE_POINT_COUNT + 1 ),
            context: { label: "L".repeat ( MAXIMUM_CONSOLE_TEXT_CODE_POINT_COUNT + 1 ), route: "solver" as const },
            identifier: "I".repeat ( MAXIMUM_CONSOLE_METADATA_CODE_POINT_COUNT + 1 ),
            severity: "error" as const,
            source: "S".repeat ( MAXIMUM_CONSOLE_METADATA_CODE_POINT_COUNT + 1 ),
            text: `${"T".repeat ( MAXIMUM_CONSOLE_TEXT_CODE_POINT_COUNT )}\u{1F642}tail`,
            timestamp: "Z".repeat ( MAXIMUM_CONSOLE_TIMESTAMP_CODE_POINT_COUNT + 1 ),
        };

        channel.publish ( entry );

        const retainedEntry = channel.getEntries () [ 0 ];

        expect ( retainedEntry?.code ).toHaveLength ( MAXIMUM_CONSOLE_METADATA_CODE_POINT_COUNT );
        expect ( retainedEntry?.identifier ).toHaveLength ( MAXIMUM_CONSOLE_METADATA_CODE_POINT_COUNT );
        expect ( retainedEntry?.source ).toHaveLength ( MAXIMUM_CONSOLE_METADATA_CODE_POINT_COUNT );
        expect ( Array.from ( retainedEntry?.timestamp ?? "" ) ).toHaveLength (
            MAXIMUM_CONSOLE_TIMESTAMP_CODE_POINT_COUNT,
        );
        expect ( retainedEntry?.timestamp.endsWith ( "\u2026" ) ).toBe ( true );
        expect ( Array.from ( retainedEntry?.text ?? "" ) ).toHaveLength ( MAXIMUM_CONSOLE_TEXT_CODE_POINT_COUNT );
        expect ( retainedEntry?.text.endsWith ( "\u2026" ) ).toBe ( true );
        expect ( Array.from ( retainedEntry?.context?.label ?? "" ) ).toHaveLength (
            MAXIMUM_CONSOLE_TEXT_CODE_POINT_COUNT,
        );
        expect ( retainedEntry?.context?.label.endsWith ( "\u2026" ) ).toBe ( true );
        expect ( Object.isFrozen ( channel.getEntries () ) ).toBe ( true );
        expect ( Object.isFrozen ( retainedEntry ) ).toBe ( true );
        expect ( Object.isFrozen ( retainedEntry?.context ) ).toBe ( true );
    } );
} );
