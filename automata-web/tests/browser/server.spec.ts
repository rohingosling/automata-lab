// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Browser Server Integration Tests
// Version: 1.0.0
// Date:    2026-08-14
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies the real built-in Server Worker connection, hosted-document, revision, and reconnect
//   workflows.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { openEditorNode } from "./tree-helpers.js";

//--------------------------------------------------------------------------------------------------
// Function: waitForReadyServer
//
// Description:
//
//   Derives the wait for ready server.
//
// Parameters:
//
//   - page:
//     The page supplied to the operation.
//
// Returns:
//
//   A promise that resolves when the operation is complete.
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

async function waitForReadyServer ( page: Page ): Promise<void>
{
    // Initialize the local values needed by this operation.

    const applicationStatus = page.getByRole ( "contentinfo" );

    await expect ( applicationStatus.getByText ( "Connected", { exact: true } ) ).toBeVisible ();
    await expect ( page.locator ( "[data-toolbar-entry='toolbar-pull']" ) ).toBeEnabled ();
}

//--------------------------------------------------------------------------------------------------
// Function: pullHostedDocument
//
// Description:
//
//   Pulls the hosted document.
//
// Parameters:
//
//   - page:
//     The page supplied to the operation.
//
// Returns:
//
//   A promise that resolves when the operation is complete.
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

async function pullHostedDocument ( page: Page ): Promise<void>
{
    await page.locator ( "[data-toolbar-entry='toolbar-pull']" ).click ();
    await expect ( page.locator ( ".console-code", { hasText: "HOSTED_MODEL_PULLED" } ) ).toHaveCount ( 1 );
    await expect ( page.getByRole ( "heading", { name: "State Machine Info" } ) ).toBeVisible ();
}

test.beforeEach ( async ( { page } ) =>
{
    await page.goto ( "./" );
    await waitForReadyServer ( page );
} );

test ( "Phase 7 auto-connects the real Server Worker and Pulls its bundled light-switch model", async ( { page } ) =>
{
    await expect ( page.locator ( ".console-code", { hasText: "SERVER_WORKER_STARTING" } ) ).toHaveCount ( 1 );
    await expect ( page.locator ( ".console-code", { hasText: "SERVER_WORKER_READY" } ) ).toHaveCount ( 1 );
    await expect ( page.locator ( ".console-code", { hasText: "SERVER_CONNECTED" } ) ).toHaveCount ( 1 );
    await pullHostedDocument ( page );

    const hostedModel = page.getByRole ( "group", { name: "Hosted Model" } );

    await expect ( hostedModel.getByText ( "Connected", { exact: true } ) ).toBeVisible ();
    await expect ( hostedModel.getByText ( "Ready", { exact: true } ) ).toBeVisible ();
    await expect ( hostedModel.locator ( "dd" ).nth ( 2 ) ).toHaveText ( /^sha256:[0-9a-f]{64}$/u );
    await expect ( hostedModel.getByText ( "Current", { exact: true } ) ).toBeVisible ();
    await expect ( page.getByText ( "state_machine_light_switch", { exact: true } ) ).toBeVisible ();
    await expect ( page.getByText ( "Initial State: state_start", { exact: true } ) ).toBeVisible ();
    await expect ( page.getByText ( "States: 4", { exact: true } ) ).toBeVisible ();
    await expect ( page ).toHaveTitle ( "Automata Lab" );

    // The Simulator sequence collection makes both commands available while a document is open. The
    // bundled light-switch model carries saved sequences, which is what enables Export as well as
    // Import.

    await page.getByRole ( "menuitem", { name: "File", exact: true } ).click ();
    await page.getByRole ( "menuitem", { name: "Import from CSV" } ).click ();
    await expect ( page.getByRole ( "menuitem", { name: "Simulator Event Sequence" } ) ).toBeEnabled ();
    await page.keyboard.press ( "Escape" );
    await page.keyboard.press ( "Escape" );

    await page.getByRole ( "menuitem", { name: "File", exact: true } ).click ();
    await page.getByRole ( "menuitem", { name: "Export to CSV" } ).click ();
    await expect ( page.getByRole ( "menuitem", { name: "Simulator Event Sequence" } ) ).toBeEnabled ();
} );

test ( "Phase 7 tests the live built-in server without disturbing the hosted model", async ( { page } ) =>
{
    // Initialize the local values needed by this operation.

    const hostedModel = page.getByRole ( "group", { name: "Hosted Model" } );

    await pullHostedDocument ( page );

    const revisionBeforeTest = await hostedModel.locator ( "dd" ).nth ( 2 ).innerText ();

    await page.getByRole ( "menuitem", { name: "File", exact: true } ).click ();
    await page.getByRole ( "menuitem", { name: "Test Server" } ).click ();

    await expect ( page.locator ( ".console-code", { hasText: "SERVER_TEST_PASSED" } ) ).toHaveCount ( 1 );
    await expect ( page.getByRole ( "dialog" ) ).toHaveCount ( 0 );
    await expect ( page.getByRole ( "contentinfo" ).getByText ( "Connected", { exact: true } ) ).toBeVisible ();
    await expect ( hostedModel.locator ( "dd" ).nth ( 2 ) ).toHaveText ( revisionBeforeTest );
    await expect ( hostedModel.getByText ( "Current", { exact: true } ) ).toBeVisible ();
    await expect ( page ).toHaveTitle ( "Automata Lab" );
} );

test ( "Phase 7 conditionally Pushes a valid change and reconnects to the preserved hosted snapshot", async ( { page } ) =>
{
    await pullHostedDocument ( page );

    // Initialize the local values needed by this operation.

    const hostedModel     = page.getByRole ( "group", { name: "Hosted Model" } );
    const initialRevision = await hostedModel.locator ( "dd" ).nth ( 2 ).innerText ();

    await openEditorNode ( page );
    await page.getByRole ( "treeitem", { name: "State Machine" } ).click ();
    await page.getByRole ( "textbox", { name: "Name" } ).fill ( "Hosted Light Switch Edited" );
    await page.getByRole ( "textbox", { name: "Name" } ).press ( "Tab" );
    await expect ( page ).toHaveTitle ( /Unsaved changes/u );

    await page.locator ( "[data-toolbar-entry='toolbar-editor']" ).click ();
    await expect ( hostedModel.getByText ( "Local changes", { exact: true } ) ).toBeVisible ();
    await expect ( page.locator ( "[data-toolbar-entry='toolbar-push']" ) ).toBeEnabled ();

    await page.locator ( "[data-toolbar-entry='toolbar-push']" ).click ();
    await expect ( page.locator ( ".console-code", { hasText: "HOSTED_MODEL_PUSHED" } ) ).toHaveCount ( 1 );
    await expect ( hostedModel.getByText ( "Current", { exact: true } ) ).toBeVisible ();

    const pushedRevision = await hostedModel.locator ( "dd" ).nth ( 2 ).innerText ();

    expect ( pushedRevision ).toMatch ( /^sha256:[0-9a-f]{64}$/u );
    expect ( pushedRevision ).not.toBe ( initialRevision );

    await page.getByRole ( "menuitem", { name: "File", exact: true } ).click ();
    await page.getByRole ( "menuitem", { name: "Disconnect from Server" } ).click ();
    await expect ( page.getByRole ( "contentinfo" ).getByText ( "Disconnected", { exact: true } ) ).toBeVisible ();
    await expect ( page.locator ( "[data-toolbar-entry='toolbar-pull']" ) ).toBeDisabled ();

    await page.getByRole ( "menuitem", { name: "File", exact: true } ).click ();
    await page.getByRole ( "menuitem", { name: "Connect to Server" } ).click ();
    await waitForReadyServer ( page );
    await expect ( hostedModel.locator ( "dd" ).nth ( 2 ) ).toHaveText ( pushedRevision );

    await page.locator ( "[data-toolbar-entry='toolbar-pull']" ).click ();
    const dirtyDialog = page.getByRole ( "dialog", { name: "Unsaved changes" } );

    await expect ( dirtyDialog ).toBeVisible ();
    await dirtyDialog.getByRole ( "button", { name: "Discard and Continue" } ).click ();
    await expect ( page.locator ( ".console-code", { hasText: "HOSTED_MODEL_PULLED" } ) ).toHaveCount ( 2 );

    await openEditorNode ( page );
    await page.getByRole ( "treeitem", { name: "State Machine" } ).click ();
    await expect ( page.getByRole ( "textbox", { name: "Name" } ) ).toHaveValue ( "Hosted Light Switch Edited" );
    await expect ( page ).toHaveTitle ( "Automata Lab" );
} );
