// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Server Worker Entry Point
// Version: 1.0.0
// Date:    2026-08-14
// Author:  Rohin Gosling
//
// Description:
//
//   Composes the real browser adapters and hosts the bundled light-switch model in the dedicated
//   Server Worker.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

/// <reference lib="webworker" />

import bundledDocumentText from "../../../examples/state-machine-light-switch.json?raw";
import { AutomataDocumentCodec } from "../infrastructure/files/file-codec.js";
import { Sha256ContentHasher } from "../infrastructure/hashing/sha256-content-hasher.js";
import { ServerEngine } from "./server/server-engine.js";
import type { ServerOutboundEnvelope } from "./server/protocol.js";

declare const self: DedicatedWorkerGlobalScope;

const serverEngine = new ServerEngine (
    {
        bundledDocumentText,
        clock:
        {
            nowUtc: () => new Date ().toISOString (),
        },
        contentHasher: new Sha256ContentHasher (),
        documentCodec: new AutomataDocumentCodec (),
        uuid:
        {
            create: () => globalThis.crypto.randomUUID (),
        },
    },
);

//--------------------------------------------------------------------------------------------------
// Function: postMessages
//
// Description:
//
//   Posts the messages.
//
// Parameters:
//
//   - messages:
//     The messages supplied to the operation.
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
//--------------------------------------------------------------------------------------------------

function postMessages ( messages: readonly ServerOutboundEnvelope[] ): void
{
    // Process each message from the messages collection in order.

    for ( const message of messages )
    {
        self.postMessage ( message );
    }
}

void serverEngine.start ().then ( postMessages );

self.addEventListener ( "message", event =>
{
    void serverEngine.handle ( event.data ).then ( postMessages );
} );
