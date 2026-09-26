// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Terminal State Foundation Browser Tests
// Version: 1.0.0
// Date:    2026-09-16
// Author:  Rohin Gosling
//
// Description:
//
//   Exercises terminal authoring, execution policy, notification, and accessible dialog layouts.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { terminalDocument } from "../runtime/terminal-state-fixture.js";
import { PREFERENCE_STORAGE_KEY, PREFERENCE_FORMAT_VERSION } from "../../src/infrastructure/preferences/application-preferences.js";
import { createEmptyAuthoringDraft } from "../../src/domain/model/drafts.js";
import { encodeFileDocumentV1, encodeFileDocumentV1_4 } from "../../src/domain/model/canonicalization.js";

function fixture ( legacy = false ): string
{
    const empty = createEmptyAuthoringDraft ();
    const document = { ...empty, stateMachine: { ...empty.stateMachine, initialState: "A",
        states: [ { name: "A", description: "First", terminalState: !legacy },
            { name: "B", description: "Second", terminalState: false } ],
    }, chart: { ...empty.chart, indicators: { ...empty.chart.indicators,
        terminalStateIndicators: legacy ? [ { id: 7, x: 350, y: 350 } ] : [],
        terminalStateTransitions: legacy ? [ { state: "A", terminalStateIndicatorId: 7 },
            { state: "B", terminalStateIndicatorId: 7 } ] : [],
    } } };
    return JSON.stringify ( legacy ? encodeFileDocumentV1 ( document ) : encodeFileDocumentV1_4 ( document ) );
}

async function openFile ( page: Page, content: string ): Promise<void>
{
    const chooser = page.waitForEvent ( "filechooser" );
    await page.getByRole ( "button", { name: "Open", exact: true } ).click ();
    await ( await chooser ).setFiles ( { name: "terminal-test.json", mimeType: "application/json", buffer: Buffer.from ( content ) } );
    await expect ( page.getByRole ( "banner" ) ).toContainText ( "terminal-test.json" );
}

async function saveFile ( page: Page ): Promise<string>
{
    const pending = page.waitForEvent ( "download" );
    await page.getByRole ( "button", { name: "Save", exact: true } ).click ();
    const download = await pending;
    const path = await download.path ();
    if ( path === null )
    {
        throw new Error ( "The downloaded file was not available." );
    }
    return readFile ( path, "utf8" );
}

test.beforeEach ( async ( { page } ) =>
{
    await page.addInitScript ( () =>
    {
        Object.defineProperty ( window, "showOpenFilePicker", { configurable: true, value: undefined } );
        Object.defineProperty ( window, "showSaveFilePicker", { configurable: true, value: undefined } );
    } );
    await page.goto ( "./" );
} );

test ( "TS2 prepares modern terminal notation and saves before the first Chart visit", async ( { page } ) =>
{
    await openFile ( page, fixture () );
    await expect ( page.getByRole ( "gridcell", { name: /Terminal notation repaired: 1 indicator/ } ).first () ).toBeVisible ();
    const savedText = await saveFile ( page );
    const saved = JSON.parse ( savedText );
    expect ( saved.file_version ).toBe ( "1.4.0" );
    expect ( saved.state_machine.states.map ( ( state: { terminal_state: boolean } ) => state.terminal_state ) ).toEqual ( [ true, false ] );
    expect ( saved.chart.indicators.terminal_state_indicators ).toHaveLength ( 1 );
    expect ( saved.chart.indicators.terminal_state_transitions ).toHaveLength ( 1 );
    await page.getByRole ( "treeitem", { name: "Chart", exact: true } ).click ();
    await expect ( page.locator ( ".chart-terminal-indicator" ) ).toHaveCount ( 1 );
    await expect ( page.locator ( ".chart-terminal-edge" ) ).toHaveCount ( 1 );
    expect ( await saveFile ( page ) ).toBe ( savedText );
} );

test ( "TS2 migrates shared legacy notation and deletion plus Undo restores exact flags and geometry", async ( { page } ) =>
{
    await openFile ( page, fixture ( true ) );
    await expect ( page.getByRole ( "gridcell", { name: /migrated 2 terminal state\(s\)/ } ).first () ).toBeVisible ();
    const before = await saveFile ( page );
    await page.getByRole ( "treeitem", { name: "Chart", exact: true } ).click ();
    await expect ( page.locator ( ".chart-terminal-edge" ) ).toHaveCount ( 2 );
    const indicator = page.locator ( ".react-flow__node" ).filter ( { has: page.locator ( ".chart-terminal-indicator" ) } );
    await indicator.click ();
    await indicator.press ( "Delete" );
    await expect ( page.locator ( ".chart-terminal-indicator" ) ).toHaveCount ( 0 );
    const removed = JSON.parse ( await saveFile ( page ) );
    expect ( removed.state_machine.states.every ( ( state: { terminal_state: boolean } ) => !state.terminal_state ) ).toBe ( true );
    await page.getByRole ( "button", { name: "Undo", exact: true } ).click ();
    await expect ( page.locator ( ".chart-terminal-edge" ) ).toHaveCount ( 2 );
    expect ( await saveFile ( page ) ).toBe ( before );
} );

test ( "TS2 imports explicit terminal CSV values atomically and Undo restores the previous notation", async ( { page } ) =>
{
    await openFile ( page, fixture ( true ) );
    const before = await saveFile ( page );
    const chooser = page.waitForEvent ( "filechooser" );
    await page.getByRole ( "menuitem", { name: "File", exact: true } ).click ();
    await page.getByRole ( "menuitem", { name: "Import from CSV" } ).click ();
    await page.getByRole ( "menuitem", { name: "States", exact: true } ).click ();
    await ( await chooser ).setFiles ( { name: "terminal-states.csv", mimeType: "text/csv",
        buffer: Buffer.from ( "name,description,terminal_state\nA,First,false\nB,Second,true\nC,New,true\n" ) } );
    await page.getByRole ( "dialog", { name: "Confirm CSV overwrite" } )
        .getByRole ( "button", { name: "Overwrite" } ).click ();
    await expect ( page.getByText ( "CSV_IMPORT_COMPLETED", { exact: true } ) ).toBeVisible ();
    const saved = JSON.parse ( await saveFile ( page ) );
    expect ( saved.state_machine.states.map ( ( state: { terminal_state: boolean } ) => state.terminal_state ) )
        .toEqual ( [ false, true, true ] );
    expect ( saved.chart.indicators.terminal_state_indicators ).toHaveLength ( 2 );
    expect ( saved.chart.indicators.terminal_state_transitions ).toHaveLength ( 2 );
    await page.getByRole ( "button", { name: "Undo", exact: true } ).click ();
    expect ( await saveFile ( page ) ).toBe ( before );
} );

async function enableTerminalExecution ( page: Page ): Promise<void>
{
    await page.addInitScript ( ( { key, version } ) =>
    {
        localStorage.setItem ( key, JSON.stringify ( { version, preferences: { simulatorEnableTerminalStates: true } } ) );
    }, { key: PREFERENCE_STORAGE_KEY, version: PREFERENCE_FORMAT_VERSION } );
    await page.reload ();
}

async function startTerminalFixture ( page: Page, content: string ): Promise<void>
{
    await openFile ( page, content );
    await expect ( page.locator ( "[data-toolbar-entry='toolbar-push']" ) ).toBeEnabled ();
    await page.locator ( "[data-toolbar-entry='toolbar-simulator']" ).click ();
    await page.getByRole ( "button", { name: "Start Session", exact: true } ).click ();
    await page.getByRole ( "button", { name: "Push and Start Session", exact: true } ).click ();
    await expect ( page.getByRole ( "button", { name: "Run", exact: true } ) ).toBeEnabled ();
}

test ( "TS3 stops after terminal entry and Reset silently starts a new pinned execution", async ( { page } ) =>
{
    await enableTerminalExecution ( page );
    const document = terminalDocument ();
    const withSequence = { ...document, simulator: { sequences: [
        { name: "sequence_1", description: "", sequence: [ "unknown", "go", "back" ] },
    ] } };
    await startTerminalFixture ( page, JSON.stringify ( encodeFileDocumentV1_4 ( withSequence ) ) );
    await page.getByRole ( "button", { name: "Run", exact: true } ).click ();
    await expect ( page.getByRole ( "button", { name: "Run", exact: true } ) ).toBeDisabled ();
    await expect ( page.getByRole ( "button", { name: "Step", exact: true } ) ).toBeDisabled ();
    await expect ( page.locator ( ".simulator-transition-trace tbody tr:not(.simulator-trace-spacer)" ) ).toHaveCount ( 2 );
    await expect ( page.locator ( ".simulator-action-trace tbody tr:not(.simulator-trace-spacer)" ) ).toHaveCount ( 4 );
    await expect ( page.getByRole ( "listbox", { name: "Buffer Position" } ) ).toHaveValue ( "2" );
    await expect ( page.getByRole ( "contentinfo" ).getByText ( "Simulator State: done", { exact: true } ) ).toBeVisible ();
    await page.getByRole ( "button", { name: "Reset", exact: true } ).click ();
    await expect ( page.getByRole ( "button", { name: "Run", exact: true } ) ).toBeEnabled ();
    await expect ( page.locator ( ".simulator-action-trace tbody tr:not(.simulator-trace-spacer)" ) ).toHaveCount ( 0 );
    await expect ( page.getByRole ( "listbox", { name: "Buffer Position" } ) ).toHaveValue ( "0" );
} );

test ( "TS3 initializes a terminal initial state without a sequence or event", async ( { page } ) =>
{
    await enableTerminalExecution ( page );
    await startTerminalFixture ( page, JSON.stringify ( encodeFileDocumentV1_4 ( terminalDocument ( true ) ) ) );
    await page.getByRole ( "button", { name: "Step", exact: true } ).click ();
    await expect ( page.getByRole ( "button", { name: "Run", exact: true } ) ).toBeDisabled ();
    await expect ( page.locator ( ".simulator-action-trace tbody tr:not(.simulator-trace-spacer)" ) ).toHaveCount ( 1 );
    await expect ( page.locator ( ".simulator-transition-trace tbody tr:not(.simulator-trace-spacer)" ) ).toHaveCount ( 0 );
} );

test ( "TS3 a full replay starts accounting at zero and preserves its unconsumed suffix", async ( { page } ) =>
{
    await enableTerminalExecution ( page );
    const document = terminalDocument ();
    const replayDocument = { ...document, stateMachine: { ...document.stateMachine,
        states: [ ...document.stateMachine.states,
            { name: "middle", description: "", terminalState: false },
            { name: "later", description: "", terminalState: false } ],
        transitionTable: [
            { state: "idle", event: "go", stateNext: "middle" },
            { state: "middle", event: "back", stateNext: "later" },
            { state: "later", event: "go", stateNext: "done" },
        ],
    }, simulator: { sequences: [
        { name: "sequence_1", description: "", sequence: [ "go", "back", "unmapped" ] },
    ] } };
    await startTerminalFixture ( page, JSON.stringify ( encodeFileDocumentV1_4 ( replayDocument ) ) );
    await page.getByRole ( "button", { name: "Run", exact: true } ).click ();
    await expect ( page.locator ( ".simulator-transition-trace tbody tr:not(.simulator-trace-spacer)" ) ).toHaveCount ( 3 );
    await expect ( page.getByRole ( "button", { name: "Run", exact: true } ) ).toBeEnabled ();
    await page.getByRole ( "button", { name: "Run", exact: true } ).click ();
    await expect ( page.getByRole ( "button", { name: "Run", exact: true } ) ).toBeDisabled ();
    await expect ( page.locator ( ".simulator-transition-trace tbody tr:not(.simulator-trace-spacer)" ) ).toHaveCount ( 4 );
    await expect ( page.getByRole ( "listbox", { name: "Buffer Position" } ) ).toHaveValue ( "1" );
} );

async function openSimulatorSettings ( page: Page )
{
    await page.getByRole ( "menuitem", { name: "File", exact: true } ).click ();
    await page.getByRole ( "menuitem", { name: "Settings", exact: true } ).click ();
    const dialog = page.getByRole ( "dialog", { name: "Application Settings" } );
    await dialog.getByRole ( "option", { name: "Simulator", exact: true } ).click ();
    return dialog;
}

async function applyTerminalPreference ( page: Page, enabled: boolean ): Promise<void>
{
    const dialog = await openSimulatorSettings ( page );
    await dialog.getByRole ( "checkbox", { name: "Enable Terminal States" } ).setChecked ( enabled );
    await dialog.getByRole ( "button", { name: "Apply", exact: true } ).click ();
}

test ( "TS4 state dialogs synchronize Editor and Chart with exact Undo and cancellation", async ( { page } ) =>
{
    await openFile ( page, fixture ( true ) );
    await page.getByRole ( "treeitem", { name: "Editor", exact: true } ).press ( "ArrowRight" );
    await page.getByRole ( "treeitem", { name: "States", exact: true } ).click ();
    await page.locator ( ".states-list-pane" ).getByRole ( "button", { name: "Add", exact: true } ).click ();
    const dialog = page.getByRole ( "dialog", { name: /^(Add|Edit) State$/u } );
    const terminal = dialog.getByRole ( "checkbox", { name: "Terminal State", exact: true } );
    await expect ( dialog ).toHaveAccessibleName ( "Add State" );
    await expect ( terminal ).not.toBeChecked ();
    await dialog.getByRole ( "button", { name: "Cancel", exact: true } ).click ();
    await page.locator ( ".states-list-pane" ).getByRole ( "button", { name: "Edit", exact: true } ).click ();
    await expect ( dialog ).toHaveAccessibleName ( "Edit State" );
    await expect ( terminal ).toBeChecked ();
    await terminal.uncheck ();
    await dialog.getByRole ( "button", { name: "Confirm", exact: true } ).click ();
    const cleared = await saveFile ( page );
    expect ( JSON.parse ( cleared ).state_machine.states.map ( ( state: { terminal_state: boolean } ) => state.terminal_state ) )
        .toEqual ( [ false, true ] );
    await page.getByRole ( "treeitem", { name: "Chart", exact: true } ).click ();
    await expect ( page.locator ( ".chart-terminal-edge" ) ).toHaveCount ( 1 );
    await page.locator ( "[data-chart-state='A']" ).dblclick ();
    await expect ( terminal ).not.toBeChecked ();
    await terminal.focus ();
    await page.keyboard.press ( "Space" );
    await dialog.getByRole ( "button", { name: "Confirm", exact: true } ).click ();
    await expect ( page.locator ( ".chart-terminal-edge" ) ).toHaveCount ( 2 );
    await page.getByRole ( "button", { name: "Undo", exact: true } ).click ();
    expect ( await saveFile ( page ) ).toBe ( cleared );
    await page.getByRole ( "button", { name: "Redo", exact: true } ).click ();
    await page.locator ( "[data-chart-state='A']" ).dblclick ();
    await expect ( terminal ).toBeChecked ();
    await terminal.uncheck ();
    await page.keyboard.press ( "Escape" );
    await expect ( page.locator ( ".chart-terminal-edge" ) ).toHaveCount ( 2 );
} );

test ( "TS4 preference drafts cancel on every dismissal and Apply persists across reload", async ( { page } ) =>
{
    for ( const dismissal of [ "Cancel", "Close dialog", "Escape" ] )
    {
        const dialog = await openSimulatorSettings ( page );
        const checkbox = dialog.getByRole ( "checkbox", { name: "Enable Terminal States" } );
        await expect ( checkbox ).not.toBeChecked ();
        await checkbox.check ();
        if ( dismissal === "Escape" )
        {
            await page.keyboard.press ( "Escape" );
        }
        else
        {
            await dialog.getByRole ( "button", { name: dismissal, exact: true } ).click ();
        }
    }
    await applyTerminalPreference ( page, true );
    await page.reload ();
    const dialog = await openSimulatorSettings ( page );
    await expect ( dialog.getByRole ( "checkbox", { name: "Enable Terminal States" } ) ).toBeChecked ();
} );

test ( "TS4 captured policy and terminal notifications survive Settings and navigation until Reset", async ( { page } ) =>
{
    const document = terminalDocument ();
    const withSequence = { ...document, simulator: { sequences: [
        { name: "sequence_1", description: "", sequence: [ "go", "back" ] },
    ] } };
    await startTerminalFixture ( page, JSON.stringify ( encodeFileDocumentV1_4 ( withSequence ) ) );
    const messages = page.getByText ( "TERMINAL_STATE_REACHED", { exact: true } );
    await applyTerminalPreference ( page, true );
    await page.getByRole ( "button", { name: "Run", exact: true } ).click ();
    await expect ( page.locator ( ".simulator-transition-trace tbody tr:not(.simulator-trace-spacer)" ) ).toHaveCount ( 2 );
    await expect ( messages ).toHaveCount ( 0 );
    await page.getByRole ( "button", { name: "Reset", exact: true } ).click ();
    await applyTerminalPreference ( page, false );
    await page.getByRole ( "button", { name: "Run", exact: true } ).click ();
    await expect ( messages ).toHaveCount ( 1 );
    await expect ( page.getByRole ( "contentinfo" ).getByText ( "Terminal state reached", { exact: true } ) ).toBeVisible ();
    await expect ( page.getByRole ( "button", { name: "Run", exact: true } ) ).toBeDisabled ();
    await expect ( page.getByRole ( "button", { name: "Step", exact: true } ) ).toBeDisabled ();
    await page.getByRole ( "treeitem", { name: "Chart", exact: true } ).click ();
    await expect ( page.locator ( ".chart-terminal-indicator" ) ).toHaveCount ( 1 );
    await page.getByRole ( "treeitem", { name: "Simulator", exact: true } ).click ();
    await expect ( messages ).toHaveCount ( 1 );
    await expect ( page.getByRole ( "button", { name: "Run", exact: true } ) ).toBeDisabled ();
    await applyTerminalPreference ( page, true );
    await page.getByRole ( "button", { name: "Reset", exact: true } ).click ();
    await expect ( messages ).toHaveCount ( 1 );
    await expect ( page.getByRole ( "contentinfo" ).getByText ( "Terminal state reached", { exact: true } ) ).toHaveCount ( 0 );
    await page.getByRole ( "button", { name: "Step", exact: true } ).click ();
    await expect ( messages ).toHaveCount ( 2 );
    await expect ( page.getByRole ( "button", { name: "Close Session", exact: true } ) ).toBeEnabled ();
} );

for ( const scenario of [ "desktop", "short-dark", "zoom-light", "narrow-forced", "narrow-forced-dark" ] )
{
    test ( `TS4 controls align and remain accessible in ${scenario}`, async ( { page } ) =>
    {
        await openFile ( page, fixture () );
        await page.locator ( "[data-toolbar-entry='toolbar-theme']" ).click ();
        await page.getByRole ( "menuitemradio", { name: scenario === "short-dark" || scenario === "narrow-forced-dark" ? "Dark" : "Light", exact: true } ).click ();
        await page.setViewportSize ( scenario === "desktop" ? { width: 1440, height: 900 }
            : scenario === "short-dark" ? { width: 960, height: 480 }
                : scenario === "zoom-light" ? { width: 720, height: 450 } : { width: 320, height: 640 } );
        if ( scenario.startsWith ( "narrow-forced" ) )
        {
            await page.emulateMedia ( { forcedColors: "active" } );
        }
        if ( await page.getByRole ( "button", { name: "Model", exact: true } ).isVisible () )
        {
            await page.getByRole ( "button", { name: "Model", exact: true } ).click ();
        }
        await page.getByRole ( "treeitem", { name: "Editor", exact: true } ).press ( "ArrowRight" );
        await page.getByRole ( "treeitem", { name: "States", exact: true } ).click ();
        await page.locator ( ".states-list-pane" ).getByRole ( "button", { name: "Add", exact: true } ).click ();
        const stateDialog = page.getByRole ( "dialog", { name: /^(Add|Edit) State$/u } );
        await stateDialog.getByRole ( "textbox", { name: "Name", exact: true } ).fill ( "new_terminal" );
        const checkbox = stateDialog.getByRole ( "checkbox", { name: "Terminal State", exact: true } );
        await checkbox.focus ();
        await page.keyboard.press ( "Space" );
        await expect ( checkbox ).toBeChecked ();
        if ( scenario === "desktop" || scenario === "short-dark" )
        {
            const offsets = await stateDialog.locator ( ".form-field > div" ).evaluateAll ( elements =>
                elements.map ( element => Math.round ( element.getBoundingClientRect ().left ) ) );
            expect ( new Set ( offsets ).size ).toBe ( 1 );
        }
        const accessibilityScan = new AxeBuilder ( { page } ).include ( "dialog[open]" );
        // Forced palettes belong to the user agent; emulated system colors are not WCAG fixtures.
        // Normal Light/Dark scans retain contrast checks.
        // Forced mode verifies system pairing below.
        if ( scenario.startsWith ( "narrow-forced" ) )
        {
            accessibilityScan.disableRules ( [ "color-contrast" ] );
        }
        expect ( ( await accessibilityScan.analyze () ).violations ).toEqual ( [] );
        await page.screenshot ( { path: `tests/test-results/terminal-states-ts4/state-${scenario}.png` } );
        await stateDialog.getByRole ( "button", { name: "Cancel", exact: true } ).click ();
        const settings = await openSimulatorSettings ( page );
        const rows = await settings.locator ( ".form-field:has(input[type='checkbox'])" ).evaluateAll ( elements =>
            elements.map ( element =>
            {
                const label = element.querySelector ( "label" )?.getBoundingClientRect ();
                const input = element.querySelector ( "input" )?.getBoundingClientRect ();
                return { left: input?.left ?? 0, centerDifference: label && input
                    ? Math.abs ( label.top + label.height / 2 - input.top - input.height / 2 ) : 100 };
            } ) );
        expect ( rows ).toHaveLength ( 2 );
        expect ( Math.abs ( ( rows[ 0 ]?.left ?? 0 ) - ( rows[ 1 ]?.left ?? 0 ) ) ).toBeLessThanOrEqual ( 1 );
        expect ( rows.every ( row => row.centerDifference <= 1 ) ).toBe ( true );
        if ( scenario.startsWith ( "narrow-forced" ) )
        {
            const palette = await settings.getByRole ( "option", { name: "Simulator", exact: true } ).evaluate ( element =>
            {
                const probe = document.createElement ( "span" );
                probe.style.backgroundColor = "Highlight";
                probe.style.color = "HighlightText";
                probe.style.forcedColorAdjust = "none";
                element.append ( probe );
                const expected = getComputedStyle ( probe );
                const actual = getComputedStyle ( element );
                const result = { background: actual.backgroundColor, color: actual.color,
                    expectedBackground: expected.backgroundColor, expectedColor: expected.color };
                probe.remove ();
                return result;
            } );
            expect ( palette.background ).toBe ( palette.expectedBackground );
            expect ( palette.color ).toBe ( palette.expectedColor );
        }
        const enable = settings.getByRole ( "checkbox", { name: "Enable Terminal States" } );
        await enable.focus ();
        await page.keyboard.press ( "Space" );
        await expect ( enable ).toBeChecked ();
        await expect ( settings.getByRole ( "button", { name: "Apply", exact: true } ) ).toBeInViewport ();
        const settingsAccessibilityScan = new AxeBuilder ( { page } ).include ( "dialog[open]" );
        // Forced palettes belong to the user agent; emulated system colors are not WCAG fixtures.
        // Normal Light/Dark scans retain contrast checks.
        // Forced mode verifies system pairing below.
        if ( scenario.startsWith ( "narrow-forced" ) )
        {
            settingsAccessibilityScan.disableRules ( [ "color-contrast" ] );
        }
        expect ( ( await settingsAccessibilityScan.analyze () ).violations ).toEqual ( [] );
        await page.screenshot ( { path: `tests/test-results/terminal-states-ts4/${scenario}.png` } );
        await settings.getByRole ( "button", { name: "Apply", exact: true } ).click ();
    } );
}
test ( "TS4 initial terminal names remain literal and a new session can report again", async ( { page } ) =>
{
    await applyTerminalPreference ( page, true );
    const empty = createEmptyAuthoringDraft ();
    const document = { ...empty, stateMachine: { ...empty.stateMachine,
        initialState: "done$&",
        states: [ { name: "done$&", description: "", terminalState: true } ],
    } };
    await startTerminalFixture ( page, JSON.stringify ( encodeFileDocumentV1_4 ( document ) ) );
    const message = page.locator ( ".console-text" ).filter ( {
        hasText: "Terminal state 'done$&' reached. Reset or start a new session to continue.",
    } );
    await expect ( message ).toHaveCount ( 0 );
    await page.getByRole ( "button", { name: "Step", exact: true } ).click ();
    await expect ( message ).toHaveCount ( 1 );
    await page.getByRole ( "button", { name: "Close Session", exact: true } ).click ();
    await page.getByRole ( "button", { name: "Start Session", exact: true } ).click ();
    await expect ( message ).toHaveCount ( 1 );
    await page.getByRole ( "button", { name: "Run", exact: true } ).click ();
    await expect ( message ).toHaveCount ( 2 );
} );

test ( "TS5 Solver discloses removal and Undo restores terminal flags and exact notation", async ( { page, browserName } ) =>
{
    const content = await readFile ( "../examples/state-machine-terminal-states.json", "utf8" );
    await openFile ( page, content );
    const before = await saveFile ( page );
    await page.getByRole ( "treeitem", { name: "Solver", exact: true } ).click ();
    await page.getByRole ( "button", { name: "Solve", exact: true } ).click ();
    await expect ( page.getByRole ( "heading", { name: "Candidate Review" } ) ).toBeVisible ();
    await expect ( page.getByText ( /1 terminal state marking\(s\) will be removed/ ) ).toBeVisible ();
    await page.getByRole ( "tab", { name: "Comparison", exact: true } ).click ();
    await expect ( page.getByRole ( "row", { name: "Terminal States 1 0", exact: true } ) ).toBeVisible ();
    await page.getByRole ( "button", { name: "Apply Candidate" } ).click ();
    const dialog = page.getByRole ( "dialog", { name: "Replace state machine with Solver candidate?" } );
    await expect ( dialog ).toContainText ( "1 terminal state marking(s) will be removed" );
    expect ( ( await new AxeBuilder ( { page } ).include ( "dialog[open]" ).analyze () ).violations ).toEqual ( [] );
    await dialog.screenshot ( { path: `tests/test-results/terminal-states-ts5/solver-${browserName}.png` } );
    await dialog.getByRole ( "button", { name: "Cancel", exact: true } ).click ();
    expect ( await saveFile ( page ) ).toBe ( before );
    await page.getByRole ( "button", { name: "Apply Candidate" } ).click ();
    await dialog.getByRole ( "button", { name: "Replace State Machine", exact: true } ).click ();
    const applied = JSON.parse ( await saveFile ( page ) );
    expect ( applied.state_machine.states.every ( ( state: { terminal_state: boolean } ) => !state.terminal_state ) ).toBe ( true );
    expect ( applied.chart.indicators.terminal_state_transitions ).toEqual ( [] );
    await page.getByRole ( "button", { name: "Undo", exact: true } ).click ();
    expect ( await saveFile ( page ) ).toBe ( before );
} );


for ( const enabled of [ false, true ] )
{
    test ( `TS5 first-visit image export retains repaired terminal notation with execution ${enabled}`, async ( { page } ) =>
    {
        if ( enabled )
        {
            await enableTerminalExecution ( page );
        }
        await openFile ( page, fixture () );
        const before = await saveFile ( page );
        await page.evaluate ( () =>
        {
            const radii: number[] = [];
            const originalArc = CanvasRenderingContext2D.prototype.arc;
            Object.defineProperty ( window, "terminalExportRadii", { value: radii } );
            CanvasRenderingContext2D.prototype.arc = function ( ...argumentsList: Parameters<typeof originalArc> ): void
            {
                radii.push ( argumentsList [ 2 ] );
                originalArc.apply ( this, argumentsList );
            };
        } );
        await page.getByRole ( "treeitem", { name: "Chart", exact: true } ).click ();
        await expect ( page.locator ( ".chart-terminal-indicator" ) ).toHaveCount ( 1 );
        const pending = page.waitForEvent ( "download" );
        await page.getByRole ( "button", { name: "Save As Image", exact: true } ).click ();
        const download = await pending;
        expect ( download.suggestedFilename () ).toMatch ( /-chart\.png$/u );
        expect ( await page.evaluate ( () =>
            ( window as typeof window & { terminalExportRadii: number[] } ).terminalExportRadii ) ).toContain ( 15 );
        expect ( await saveFile ( page ) ).toBe ( before );
    } );
}
