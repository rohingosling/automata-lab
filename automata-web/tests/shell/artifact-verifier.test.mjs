// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Fail-Closed Artifact Verifier Tests
// Version: 1.0.0
// Date:    2026-08-21
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies the exact artifact inventory and destructive negative cases in isolated
//   operating-system temp fixtures.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { Buffer } from "node:buffer";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import
{
    assertTextualArtifactIsSafe,
    loadProductionArtifactInventory,
    verifyArtifact,
} from "../../scripts/artifact-verifier.mjs";

const BASE_PATH             = "/automata-lab/";
const PNG_SIGNATURE         = Buffer.from ( [ 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a ] );
const DYNAMIC_FIXTURE_FILES = Object.freeze ( [
    { budget: "applicationJavascript", path: "assets/index-APP00001.js", type: "javascript" },
    { budget: "chartRoutingWorker", path: "assets/chart-routing.worker-ROUTE001.js", type: "javascript" },
    { budget: "elkWorker", path: "assets/elk-worker.min-ELK00001.js", type: "javascript" },
    { budget: "serverWorker", path: "assets/server.worker-SERVER01.js", type: "javascript" },
    { budget: "solverWorker", path: "assets/solver.worker-SOLVER01.js", type: "javascript" },
    { budget: "stylesheet", path: "assets/index-CSS00001.css", type: "css" },
] );

let artifactDirectory;
let artifactInventory;

//--------------------------------------------------------------------------------------------------
// Function: fixtureIndexHtml
//
// Description:
//
//   Derives the fixture index HTML.
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
//--------------------------------------------------------------------------------------------------

function fixtureIndexHtml ()
{
    // Initialize the local values needed by this operation.

    const contentSecurityPolicy = [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-src 'none'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self' ws://127.0.0.1:* ws://localhost:*",
        "worker-src 'self' blob:",
        "media-src 'self' blob:",
        "manifest-src 'self'",
        "form-action 'none'",
    ].join ( "; " );

    // Return the join result.

    return [
        "<!doctype html>",
        "<html><head>",
        `<meta http-equiv="Content-Security-Policy" content="${ contentSecurityPolicy }">`,
        `<link rel="icon" href="${ BASE_PATH }icons/custom/20/state-machine-application.png">`,
        `<link rel="stylesheet" href="${ BASE_PATH }assets/index-CSS00001.css">`,
        `<script type="module" src="${ BASE_PATH }assets/index-APP00001.js"></script>`,
        "</head><body></body></html>",
    ].join ( "\n" );
}

//--------------------------------------------------------------------------------------------------
// Function: fixtureContent
//
// Description:
//
//   Handles the fixture content behavior.
//
// Parameters:
//
//   - artifact:
//     The artifact supplied to the operation.
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

function fixtureContent ( artifact )
{
    // Dispatch according to the artifact type value.

    switch ( artifact.type )
    {
        // Handle the "html" case.

        case "html":

            // Return the fixture index HTML result.

            return fixtureIndexHtml ();

        // Handle the "json" case.

        case "json":

            // Return the computed result.

            return "{}\n";

        // Handle the "png" case.

        case "png":

            // Return the PNG signature.

            return PNG_SIGNATURE;

        // Handle the "svg" case.

        case "svg":

            // Return the computed result.

            return "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>\n";

        // Handle the group of case values that share the following outcome.

        case "css":
        case "javascript":
        case "text":

            // Return the computed result.

            return "fixture\n";

        // Handle values not matched by an earlier case.

        default:
            throw new Error ( `Unsupported fixture type '${ artifact.type }'.` );
    }
}

//--------------------------------------------------------------------------------------------------
// Function: writeArtifact
//
// Description:
//
//   Writes artifact.
//
// Parameters:
//
//   - artifactPath:
//     The artifact path supplied to the operation.
//
//   - content:
//     The content supplied to the operation.
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

async function writeArtifact ( artifactPath, content )
{
    // Initialize the local values needed by this operation.

    const destinationPath = join ( artifactDirectory, artifactPath );

    await mkdir ( dirname ( destinationPath ), { recursive: true } );
    await writeFile ( destinationPath, content );
}

//--------------------------------------------------------------------------------------------------
// Function: createValidFixture
//
// Description:
//
//   Creates valid fixture for the test scenario.
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
//--------------------------------------------------------------------------------------------------

async function createValidFixture ()
{
    // Process each artifact from the current value collection in order.

    for ( const artifact of [ ...artifactInventory.fixedFiles, ...DYNAMIC_FIXTURE_FILES ] )
    {
        await writeArtifact ( artifact.path, fixtureContent ( artifact ) );
    }
}

//--------------------------------------------------------------------------------------------------
// Function: verifyFixture
//
// Description:
//
//   Verifies the fixture.
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
//--------------------------------------------------------------------------------------------------

async function verifyFixture ()
{
    // Return the verify artifact result.

    return verifyArtifact ( artifactDirectory, artifactInventory, BASE_PATH, () => undefined );
}

beforeAll ( async () =>
{
    artifactInventory = await loadProductionArtifactInventory ();
} );

beforeEach ( async () =>
{
    artifactDirectory = await mkdtemp ( join ( tmpdir (), "automata-lab-artifact-" ) );
    await createValidFixture ();
} );

afterEach ( async () =>
{
    await rm ( artifactDirectory, { force: true, recursive: true } );
} );

describe ( "fail-closed artifact verifier", () =>
{
    it ( "accepts only the complete reviewed 67-file fixture inventory", async () =>
    {
        // Initialize the local values needed by this operation.

        const result = await verifyFixture ();

        expect ( artifactInventory.fixedFiles ).toHaveLength ( 61 );
        expect ( artifactInventory.dynamicFiles ).toHaveLength ( 6 );
        expect ( result.fileCount ).toBe ( 67 );
    } );

    it.each ( [
        {
            expectedMessage: /not allowlisted/iu,
            fixturePath:     "assets/unreviewed.wasm",
            label:           "an unknown artifact type",
        },
        {
            expectedMessage: /user-data path/iu,
            fixturePath:     "exports/customer-model.json",
            label:           "a user-data path",
        },
        {
            expectedMessage: /private agent path/iu,
            fixturePath:     "AGENTS.md",
            label:           "a private path",
        },
        {
            expectedMessage: /source-map path/iu,
            fixturePath:     "assets/index-APP00001.js.map",
            label:           "a source map",
        },
        {
            expectedMessage: /credential path/iu,
            fixturePath:     "notices/private-key.pem",
            label:           "a PEM credential path",
        },
    ] ) ( "rejects $label", async ( { expectedMessage, fixturePath } ) =>
    {
        await writeArtifact ( fixturePath, "fixture\n" );

        await expect ( verifyFixture () ).rejects.toThrow ( expectedMessage );
    } );

    it ( "rejects a missing fixed file and a duplicate dynamic bundle slot", async () =>
    {
        // Initialize the local values needed by this operation.

        const noticePath = join ( artifactDirectory, "notices/automata-lab.txt" );

        await rm ( noticePath );
        await expect ( verifyFixture () ).rejects.toThrow ( /missing allowlisted file 'notices\/automata-lab\.txt'/iu );

        await writeArtifact ( "notices/automata-lab.txt", "fixture\n" );
        await writeArtifact ( "assets/index-EXTRA001.js", "fixture\n" );
        await expect ( verifyFixture () ).rejects.toThrow ( /exactly one application JavaScript/iu );
    } );

    it ( "scans SVG/XML text for private paths and source-map directives", async () =>
    {
        await writeArtifact (
            "icons/custom/16/state-machine-solver.svg",
            "<svg><text>C:\\Users\\private\\document.txt</text></svg>",
        );

        await expect ( verifyFixture () ).rejects.toThrow ( /Windows user path/iu );
        expect ( () => assertTextualArtifactIsSafe (
            "metadata.xml",
            "<metadata>//# sourceMappingURL=private.map</metadata>",
        ) ).toThrow ( /source-map directive/iu );
    } );

    it ( "rejects PEM content even when appended to an allowlisted binary path", async () =>
    {
        await writeArtifact (
            "icons/custom/20/state-machine-application.png",
            Buffer.concat ( [ PNG_SIGNATURE, Buffer.from ( "\n-----BEGIN PRIVATE KEY-----\nsecret" ) ] ),
        );

        await expect ( verifyFixture () ).rejects.toThrow ( /PEM block/iu );
    } );

    it ( "rejects benchmark diagnostics in the production Chart routing Worker", async () =>
    {
        await writeArtifact (
            "assets/chart-routing.worker-ROUTE001.js",
            "const recursiveProofCallCount = 1;\n",
        );

        await expect ( verifyFixture () ).rejects.toThrow ( /benchmark diagnostic token/iu );
    } );

    it ( "rejects text masquerading as an allowlisted PNG", async () =>
    {
        await writeArtifact ( "icons/custom/40/state-machine-application.png", "not a png" );

        await expect ( verifyFixture () ).rejects.toThrow ( /PNG signature/iu );
    } );
} );
