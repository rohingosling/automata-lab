// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Localization Tests
// Version: 1.0.0
// Date:    2026-08-10
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies typed English lookup and deterministic fallback for the user-facing surface.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { describe, expect, it } from "vitest";

import { resolveLocale, text } from "../../src/localization/messages";

describe ( "AL-UI-010 typed localization", () =>
{
    it ( "resolves English regional locales", () =>
    {
        expect ( resolveLocale ( "en-GB" ) ).toBe ( "en" );
        expect ( text ( "application.name", "en-AE" ) ).toBe ( "Automata Lab" );
    } );

    it ( "falls back to English for an unsupported locale", () =>
    {
        expect ( resolveLocale ( "ar-AE" ) ).toBe ( "en" );
        expect ( text ( "detail.chart.title", "ar-AE" ) ).toBe ( "State Chart" );
    } );
} );
