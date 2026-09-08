// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    SHA-256 Content Hash Tests
// Version: 1.0.0
// Date:    2026-08-09
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies lowercase stable revision formatting through the browser-neutral content-hash port.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from "vitest";
import type { ContentHashPort } from "../../src/application/ports/contracts.js";
import { createHostedSnapshot } from "../../src/application/revisions.js";
import { serializeCanonicalHostedContent } from "../../src/domain/model/canonicalization.js";
import { Sha256ContentHasher } from "../../src/infrastructure/hashing/sha256-content-hasher.js";
import { loadExampleDocument } from "../model/example-helpers.js";

describe ( "SHA-256 content hashing", () =>
{
    it ( "matches the standard SHA-256 digest for a known value", async () =>
    {
        // Initialize the local values needed by this operation.

        const hasher: ContentHashPort = new Sha256ContentHasher ();

        await expect ( hasher.hashCanonicalText ( "abc" ) ).resolves.toBe (
            "sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
        );
    } );

    it ( "hashes only the canonical hosted semantic projection", async () =>
    {
        // Initialize the local values needed by this operation.

        const hasher         = new Sha256ContentHasher ();
        const document       = loadExampleDocument ( "state-machine-comprehensive.json" );
        const chartVariation = 
        {
            ...document,
            chart:
            {
                ...document.chart,
                draftTransitions:
                [
                    ...document.chart.draftTransitions,
                    { id: 27, source: { x: -5, y: 15 }, target: { x: 50, y: 70 } },
                ],
                settings: { ...document.chart.settings, expandStates: !document.chart.settings.expandStates },
            },
        };
        const firstHash      = await hasher.hashCanonicalText ( serializeCanonicalHostedContent ( document ) );
        const secondHash     = await hasher.hashCanonicalText ( serializeCanonicalHostedContent ( chartVariation ) );
        const hostedSnapshot = await createHostedSnapshot ( chartVariation, hasher );

        expect ( firstHash ).toBe ( secondHash );
        expect ( hostedSnapshot.modelRevision ).toBe ( firstHash );
        expect ( hostedSnapshot.document ).toBe ( chartVariation );
        expect ( firstHash ).toMatch ( /^sha256:[0-9a-f]{64}$/ );
    } );
} );
