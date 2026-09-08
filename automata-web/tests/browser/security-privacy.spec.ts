// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Runtime Security and Privacy Browser Tests
// Version: 1.0.0
// Date:    2026-08-21
// Author:  Rohin Gosling
//
// Description:
//
//   Audits the built browser artifact during representative local Server, Chart, Solver, and
//   Simulator work. Runtime requests must remain local, model content must remain out of browser
//   persistence, and the strict CSP must reject dynamic code evaluation without disrupting the
//   application workflows.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { expect, test } from "@playwright/test";

import { PREFERENCE_STORAGE_KEY } from "../../src/infrastructure/preferences/application-preferences.js";
import { openEditorNode } from "./tree-helpers.js";

//--------------------------------------------------------------------------------------------------
// Interface: RuntimeRequestRecord
//
// Description:
//
//   Defines the structure of runtime request record.
//
//--------------------------------------------------------------------------------------------------

interface RuntimeRequestRecord
{
    readonly method:       string;
    readonly postData:     string | null;
    readonly resourceType: string;
    readonly url:          string;
}

//--------------------------------------------------------------------------------------------------
// Interface: SecurityPolicyViolationRecord
//
// Description:
//
//   Defines the structure of security policy violation record.
//
//--------------------------------------------------------------------------------------------------

interface SecurityPolicyViolationRecord
{
    readonly blockedUrl:         string;
    readonly effectiveDirective: string;
    readonly violatedDirective:  string;
}

//--------------------------------------------------------------------------------------------------
// Interface: RuntimeStorageSnapshot
//
// Description:
//
//   Defines the structure of runtime storage snapshot.
//
//--------------------------------------------------------------------------------------------------

interface RuntimeStorageSnapshot
{
    readonly cacheNames:             readonly string[];
    readonly indexedDatabaseNames:  readonly string[];
    readonly localStorageEntries:   readonly ( readonly [ string, string ] )[];
    readonly sessionStorageEntries: readonly ( readonly [ string, string ] )[];
}

//--------------------------------------------------------------------------------------------------
// Function: isLocalRuntimeUrl
//
// Description:
//
//   Determines whether local runtime URL.
//
// Parameters:
//
//   - value:
//     The value supplied to the operation.
//
//   - applicationOrigin:
//     The application origin supplied to the operation.
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

function isLocalRuntimeUrl ( value: string, applicationOrigin: string ): boolean
{
    // Initialize the local values needed by this operation.

    let runtimeUrl: URL;

    // Run the operation that may report a recoverable failure.

    try
    {
        runtimeUrl = new URL ( value, applicationOrigin );
    }
    catch
    {
        // Recover from the reported failure without hiding its outcome.

        return false;
    }

    // Handle the case where runtime URL protocol matches "data:".

    if ( runtimeUrl.protocol === "data:" )
    {
        // Return the computed result.

        return true;
    }

    // Return the computed result.

    return runtimeUrl.origin === applicationOrigin;
}

test ( "Phase 9 keeps representative runtime work local, private, and strict-CSP compatible", async ( { page } ) =>
{
    // Initialize the local values needed by this operation.

    const failedRequests:    string[]               = [];
    const pageErrors:        string[]               = [];
    const runtimeRequests:   RuntimeRequestRecord[] = [];
    const runtimeWorkers:    string[]               = [];
    const runtimeWebSockets: string[]               = [];

    const unsafeEvaluationProbePath = "**/__phase9-csp-eval-probe.js";

    await page.route ( unsafeEvaluationProbePath, route => route.fulfill ( {
        body: [
            "globalThis.__phase9UnsafeEvaluationProbe = { blocked: false, executed: false, name: '' };",
            "try",
            "{",
            "    globalThis.eval ( 'globalThis.__phase9UnsafeEvaluationExecuted = true' );",
            "    globalThis.__phase9UnsafeEvaluationProbe.executed =",
            "        globalThis.__phase9UnsafeEvaluationExecuted === true;",
            "}",
            "catch ( error )",
            "{",
            "    globalThis.__phase9UnsafeEvaluationProbe = {",
            "        blocked: true,",
            "        executed: globalThis.__phase9UnsafeEvaluationExecuted === true,",
            "        name: error instanceof Error ? error.name : 'UnknownError',",
            "    };",
            "}",
        ].join ( "\n" ),
        contentType: "application/javascript",
        status:      200,
    } ) );

    page.context ().on ( "request", request => runtimeRequests.push ( {
        method:       request.method (),
        postData:     request.postData (),
        resourceType: request.resourceType (),
        url:          request.url (),
    } ) );
    page.on ( "pageerror", error => pageErrors.push ( error.message ) );
    page.on ( "requestfailed", request => failedRequests.push (
        `${ request.method () } ${ request.url () }: ${ request.failure ()?.errorText ?? "unknown failure" }`,
    ) );
    page.on ( "worker", worker => runtimeWorkers.push ( worker.url () ) );
    page.on ( "websocket", socket => runtimeWebSockets.push ( socket.url () ) );

    await page.addInitScript ( () =>
    {
        // Initialize the local values needed by this operation.

        const auditWindow = window as typeof window & {
            __phase9SecurityPolicyViolations: SecurityPolicyViolationRecord[];
        };

        auditWindow.__phase9SecurityPolicyViolations = [];
        window.addEventListener ( "securitypolicyviolation", event =>
        {
            auditWindow.__phase9SecurityPolicyViolations.push ( {
                blockedUrl:         event.blockedURI,
                effectiveDirective: event.effectiveDirective,
                violatedDirective:  event.violatedDirective,
            } );
        } );
    } );

    await page.goto ( "./" );

    // Initialize the local values needed by this operation.

    const applicationOrigin = new URL ( page.url () ).origin;
    const statusBar         = page.getByRole ( "contentinfo" );

    await expect ( statusBar.getByText ( "Connected", { exact: true } ) ).toBeVisible ();
    await expect ( page.locator ( "[data-toolbar-entry='toolbar-pull']" ) ).toBeEnabled ();

    // Pull crosses only the built-in Worker boundary; no HTTP server receives the document.

    await page.locator ( "[data-toolbar-entry='toolbar-pull']" ).click ();
    await expect ( page.locator ( ".console-code", { hasText: "HOSTED_MODEL_PULLED" } ) ).toHaveCount ( 1 );
    await expect ( page.getByText ( "state_machine_light_switch", { exact: true } ) ).toBeVisible ();

    // Exercise both Chart workers against the pulled document.

    await page.locator ( "[data-toolbar-entry='toolbar-chart']" ).click ();
    await expect ( page.getByRole ( "heading", { name: "State Chart" } ) ).toBeVisible ();
    await page.locator ( ".chart-footer" ).getByRole ( "button", { name: "Automatic Layout" } ).click ();
    await expect ( page.locator ( ".chart-state-node" ) ).toHaveCount ( 4 );
    await expect ( page.locator ( ".chart-transition-edge" ) ).toHaveCount ( 16 );
    await expect ( page.locator ( ".react-flow__edge-path" ).first () ).toHaveAttribute ( "d", / C /u );

    // Run inference in the dedicated Solver Worker without applying its transient candidate.

    await page.locator ( "[data-toolbar-entry='toolbar-solver']" ).click ();
    await expect ( page.getByRole ( "heading", { name: "Sample Sequences" } ) ).toBeVisible ();
    await page.getByRole ( "button", { name: "Solve", exact: true } ).click ();
    await expect ( page.locator ( ".console-code", { hasText: "SOLVER_STARTED" } ) ).toHaveCount ( 1 );
    await expect ( page.getByRole ( "gridcell", { name: /Candidate replay verification complete/iu } ).first () )
        .toBeVisible ();

    // Run the saved buffer through a pinned session in the already-local Server Worker.

    await page.locator ( "[data-toolbar-entry='toolbar-simulator']" ).click ();
    await expect ( page.getByRole ( "heading", { name: "Event Sequences" } ) ).toBeVisible ();
    await page.getByRole ( "button", { name: "Start Session" } ).click ();
    await expect ( page.getByRole ( "button", { name: "Run" } ) ).toBeEnabled ();
    await page.getByRole ( "button", { name: "Run" } ).click ();
    await expect ( page.locator ( ".simulator-transition-trace tbody tr:not(.simulator-trace-spacer)" ) )
        .toHaveCount ( 5 );

    // Put unique model-owned content into the live draft, then force an ordinary preference write.
    // The only allowed local-storage record remains the preference envelope and must not absorb any
    // model content.

    const modelPrivacyMarker         = "privacy_model_7f2c95e19d";
    const representativeModelContent = [
        modelPrivacyMarker,
        "state_machine_light_switch",
        "state_fuse_blown",
        "event_toggle_main_supply_on",
        "action_device_connected",
    ] as const;

    await openEditorNode ( page );
    await page.getByRole ( "treeitem", { name: "State Machine" } ).click ();
    await page.getByRole ( "textbox", { name: "Name" } ).fill ( modelPrivacyMarker );
    await page.getByRole ( "textbox", { name: "Name" } ).blur ();
    await expect ( page ).toHaveTitle ( /Unsaved changes/u );

    // Initialize the local values needed by this operation.

    const applicationShell = page.locator ( ".application-shell" );
    const currentTheme     = await applicationShell.getAttribute ( "data-theme" );
    const targetTheme      = currentTheme === "light" ? "Dark" : "Light";

    await page.locator ( "[data-toolbar-entry='toolbar-theme']" ).click ();
    await page.getByRole ( "menuitemradio", { name: targetTheme } ).click ();
    await expect ( applicationShell ).toHaveAttribute ( "data-theme", targetTheme.toLowerCase () );

    const storageSnapshot = await page.evaluate ( async (): Promise<RuntimeStorageSnapshot> =>
    {
        //------------------------------------------------------------------------------------------
        // Function: readStorageEntries
        //
        // Description:
        //
        //   Returns storage entries.
        //
        // Parameters:
        //
        //   - storage:
        //     The storage supplied to the operation.
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
        //------------------------------------------------------------------------------------------

        function readStorageEntries ( storage: Storage ): readonly ( readonly [ string, string ] )[]
        {
            // Return the to sorted result.

            return Array.from ( { length: storage.length }, ( _, index ) =>
            {
                // Initialize the local values needed by this operation.

                const key = storage.key ( index ) ?? "";

                // Return the computed result.

                return [ key, storage.getItem ( key ) ?? "" ] as const;
            } ).toSorted ( ( left, right ) => left [ 0 ].localeCompare ( right [ 0 ] ) );
        }

        const databases = await indexedDB.databases ();

        // Return the assembled result.

        return {
            cacheNames:             await caches.keys (),
            indexedDatabaseNames:  databases.map ( database => database.name ?? "" ).toSorted (),
            localStorageEntries:   readStorageEntries ( window.localStorage ),
            sessionStorageEntries: readStorageEntries ( window.sessionStorage ),
        };
    } );

    expect ( storageSnapshot.localStorageEntries.map ( ( [ key ] ) => key ) )
        .toEqual ( [ PREFERENCE_STORAGE_KEY ] );
    expect ( storageSnapshot.sessionStorageEntries ).toEqual ( [] );
    expect ( storageSnapshot.cacheNames ).toEqual ( [] );
    expect ( storageSnapshot.indexedDatabaseNames ).toEqual ( [] );

    const persistedText = JSON.stringify ( storageSnapshot );

    // Process each model content from the representative model content collection in order.

    for ( const modelContent of representativeModelContent )
    {
        expect ( persistedText ).not.toContain ( modelContent );
    }

    // Normal execution must produce neither CSP violations nor uncaught errors. The policy itself
    // must keep scripts strictly same-origin and omit unsafe-eval before the explicit rejection
    // probe below.

    const securityPolicy           = await page.locator ( "meta[http-equiv='Content-Security-Policy']" )
        .getAttribute ( "content" );
    const securityPolicyViolations = await page.evaluate ( () =>
    {
        // Initialize the local values needed by this operation.

        const auditWindow = window as typeof window & {
            __phase9SecurityPolicyViolations: SecurityPolicyViolationRecord[];
        };

        // Return the computed result.

        return auditWindow.__phase9SecurityPolicyViolations;
    } );

    expect ( securityPolicy ).not.toBeNull ();
    expect ( securityPolicy?.split ( ";" ).map ( directive => directive.trim () ) )
        .toContain ( "script-src 'self'" );
    expect ( securityPolicy ).toContain ( "default-src 'self'" );
    expect ( securityPolicy ).toContain ( "base-uri 'self'" );
    expect ( securityPolicy ).toContain ( "object-src 'none'" );
    expect ( securityPolicy ).toContain ( "form-action 'none'" );
    expect ( securityPolicy ).not.toContain ( "'unsafe-eval'" );
    expect ( securityPolicyViolations ).toEqual ( [] );

    await page.evaluate ( () =>
    {
        // Initialize the local values needed by this operation.

        const probeScript = document.createElement ( "script" );

        probeScript.src = new URL ( "__phase9-csp-eval-probe.js", document.baseURI ).href;
        document.head.append ( probeScript );
    } );
    await page.waitForFunction ( () =>
    {
        // Initialize the local values needed by this operation.

        const auditWindow = window as typeof window & {
            __phase9UnsafeEvaluationProbe?: { readonly blocked: boolean };
        };

        // Return the computed result.

        return auditWindow.__phase9UnsafeEvaluationProbe !== undefined;
    } );
    const unsafeEvaluationProbe = await page.evaluate ( () =>
    {
        // Initialize the local values needed by this operation.

        const auditWindow = window as typeof window & {
            __phase9UnsafeEvaluationProbe: {
                readonly blocked:  boolean;
                readonly executed: boolean;
                readonly name:     string;
            };
        };

        // Return the computed result.

        return auditWindow.__phase9UnsafeEvaluationProbe;
    } );

    expect ( unsafeEvaluationProbe.blocked ).toBe ( true );
    expect ( unsafeEvaluationProbe.executed ).toBe ( false );
    expect ( unsafeEvaluationProbe.name ).toBe ( "EvalError" );

    // Initialize the local values needed by this operation.

    const externalRequests   = runtimeRequests.filter ( request =>
        !isLocalRuntimeUrl ( request.url, applicationOrigin ) );
    const externalWorkers    = runtimeWorkers.filter ( workerUrl =>
        !isLocalRuntimeUrl ( workerUrl, applicationOrigin ) );
    const externalWebSockets = runtimeWebSockets.filter ( socketUrl =>
    {
        // Initialize the local values needed by this operation.

        const runtimeUrl              = new URL ( socketUrl );
        const correspondingHttpOrigin = 
            `${ runtimeUrl.protocol === "wss:" ? "https:" : "http:" }//${ runtimeUrl.host }`;

        // Return the computed result.

        return correspondingHttpOrigin !== applicationOrigin;
    } );

    expect ( runtimeRequests.length ).toBeGreaterThan ( 0 );
    expect ( runtimeRequests.every ( request => request.method === "GET" && request.postData === null ) )
        .toBe ( true );
    expect ( externalRequests ).toEqual ( [] );
    expect ( externalWorkers ).toEqual ( [] );
    expect ( externalWebSockets ).toEqual ( [] );
    expect ( failedRequests ).toEqual ( [] );
    expect ( pageErrors ).toEqual ( [] );

    const networkText = JSON.stringify ( { runtimeRequests, runtimeWebSockets } );

    // Process each model content from the representative model content collection in order.

    for ( const modelContent of representativeModelContent )
    {
        expect ( networkText ).not.toContain ( modelContent );
    }

    // Process each expected artifact from the current value collection in order.

    for ( const expectedArtifact of [
        /\/assets\/chart-routing\.worker-.+\.js$/u,
        /\/assets\/elk-worker\.min-.+\.js$/u,
        /\/assets\/server\.worker-.+\.js$/u,
        /\/assets\/solver\.worker-.+\.js$/u,
    ] )
    {
        expect ( runtimeRequests.some ( request => expectedArtifact.test ( new URL ( request.url ).pathname ) ) )
            .toBe ( true );
    }
} );
