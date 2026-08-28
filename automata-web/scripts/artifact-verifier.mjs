// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Fail-Closed Artifact Verifier
// Version: 1.0.0
// Date:    2026-08-21
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies the exact production artifact path and content-type inventory, scans every textual
//   asset class, rejects credentials and private data, and enforces the reviewed bundle budgets and
//   GitHub Pages shell contract.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { lstat, readFile, readdir } from "node:fs/promises";
import { basename, dirname, extname, join, relative } from "node:path";
import { TextDecoder } from "node:util";
import { fileURLToPath } from "node:url";

const scriptDirectory       = dirname ( fileURLToPath ( import.meta.url ) );
const packageDirectory      = dirname ( scriptDirectory );
const privateDirectory      = dirname ( packageDirectory );
const distributionDirectory = join ( packageDirectory, "dist" );
const fluentManifestPath    = join ( privateDirectory, "assets", "images", "icons", "fluent-icons.json" );

const BUNDLE_BUDGET_BYTES = Object.freeze ( {
    applicationJavascript: 1_000_000,
    chartRoutingWorker:       34_000,
    elkWorker:             1_500_000,
    serverWorker:            140_000,
    solverWorker:             32_000,
    stylesheet:               65_000,
    totalArtifact:         2_850_000,
    totalJavascript:       2_700_000,
} );

const ALLOWED_ARTIFACT_DIRECTORIES = Object.freeze ( [
    "assets",
    "icons",
    "icons/custom",
    "icons/custom/16",
    "icons/custom/20",
    "icons/custom/40",
    "icons/fluent",
    "images",
    "notices",
    "schema",
] );

const FIXED_ARTIFACT_FILES = Object.freeze ( [
    { path: "index.html", type: "html" },
    { path: "icons/custom/16/document-save-as.svg", type: "svg" },
    { path: "icons/custom/16/server-connect.svg", type: "svg" },
    { path: "icons/custom/16/server-disconnect.svg", type: "svg" },
    { path: "icons/custom/16/server-test.svg", type: "svg" },
    { path: "icons/custom/16/state-machine-editor-actions.svg", type: "svg" },
    { path: "icons/custom/16/state-machine-editor-events.svg", type: "svg" },
    { path: "icons/custom/16/state-machine-editor-state-machine.svg", type: "svg" },
    { path: "icons/custom/16/state-machine-editor-states.svg", type: "svg" },
    { path: "icons/custom/16/state-machine-editor-transition-table.svg", type: "svg" },
    { path: "icons/custom/16/state-machine-editor.svg", type: "svg" },
    { path: "icons/custom/16/state-machine-simulator.svg", type: "svg" },
    { path: "icons/custom/16/state-machine-solver.svg", type: "svg" },
    { path: "icons/custom/16/state-machine-state-chart.svg", type: "svg" },
    { path: "icons/custom/16/theme-light-dark.svg", type: "svg" },
    { path: "icons/custom/20/state-machine-application.png", type: "png" },
    { path: "icons/custom/20/state-machine-editor.svg", type: "svg" },
    { path: "icons/custom/20/state-machine-simulator.svg", type: "svg" },
    { path: "icons/custom/20/state-machine-solver.svg", type: "svg" },
    { path: "icons/custom/20/state-machine-state-chart-palette-initial-state-indicator.svg", type: "svg" },
    { path: "icons/custom/20/state-machine-state-chart-palette-state.svg", type: "svg" },
    { path: "icons/custom/20/state-machine-state-chart-palette-terminal-state-indicator.svg", type: "svg" },
    { path: "icons/custom/20/state-machine-state-chart-palette-transition.svg", type: "svg" },
    { path: "icons/custom/20/state-machine-state-chart.svg", type: "svg" },
    { path: "icons/custom/40/state-machine-application.png", type: "png" },
    { path: "images/automata-lab-hero-placeholder.svg", type: "svg" },
    { path: "notices/automata-lab.txt", type: "text" },
    { path: "notices/fluent-ui-system-icons.txt", type: "text" },
    { path: "notices/third-party-runtime.txt", type: "text" },
    { path: "release-notes.txt", type: "text" },
    { path: "schema/automata-lab-state-machine-1.0.0.schema.json", type: "json" },
] );

const DYNAMIC_ARTIFACT_FILES = Object.freeze ( [
    {
        budget:  "applicationJavascript",
        label:   "application JavaScript",
        pattern: /^assets\/index-[A-Za-z0-9_-]{8}\.js$/u,
        type:    "javascript",
    },
    {
        budget:  "chartRoutingWorker",
        label:   "Chart routing Worker",
        pattern: /^assets\/chart-routing\.worker-[A-Za-z0-9_-]{8}\.js$/u,
        type:    "javascript",
    },
    {
        budget:  "elkWorker",
        label:   "ELK Worker",
        pattern: /^assets\/elk-worker\.min-[A-Za-z0-9_-]{8}\.js$/u,
        type:    "javascript",
    },
    {
        budget:  "serverWorker",
        label:   "Server Worker",
        pattern: /^assets\/server\.worker-[A-Za-z0-9_-]{8}\.js$/u,
        type:    "javascript",
    },
    {
        budget:  "solverWorker",
        label:   "Solver Worker",
        pattern: /^assets\/solver\.worker-[A-Za-z0-9_-]{8}\.js$/u,
        type:    "javascript",
    },
    {
        budget:  "stylesheet",
        label:   "application stylesheet",
        pattern: /^assets\/index-[A-Za-z0-9_-]{8}\.css$/u,
        type:    "css",
    },
] );

const ARTIFACT_TYPE_EXTENSIONS = Object.freeze ( {
    css:        ".css",
    html:       ".html",
    javascript: ".js",
    json:       ".json",
    png:        ".png",
    svg:        ".svg",
    text:       ".txt",
    xml:        ".xml",
} );

const TEXTUAL_ARTIFACT_TYPES = new Set ( [ "css", "html", "javascript", "json", "svg", "text", "xml" ] );
const PNG_SIGNATURE          = Buffer.from ( [ 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a ] );

const FORBIDDEN_ARTIFACT_PATH_PATTERNS = Object.freeze ( [
    { label: "private agent path", pattern: /(?:^|\/)(?:AGENTS|CLAUDE)\.md$/iu },
    { label: "private metadata path", pattern: /(?:^|\/)\.(?:agents|codex|git)(?:\/|$)/iu },
    {
        label:   "development-only path",
        pattern: /^(?:docs|examples|node_modules|playwright-report|src|test-results|tests)(?:\/|$)/iu,
    },
    {
        label:   "user-data path",
        pattern: /(?:^|\/)(?:backup|backups|download|downloads|export|exports|user-data)(?:\/|$)/iu,
    },
    { label: "credential path", pattern: /(?:^|\/)(?:\.env(?:\.[^/]*)?|[^/]+\.(?:key|p12|pem|pfx))$/iu },
    { label: "source-map path", pattern: /\.map$/iu },
] );

const FORBIDDEN_TEXT_PATTERNS = Object.freeze ( [
    { label: "PEM block", pattern: /-----BEGIN [A-Z0-9][A-Z0-9 ]*-----/u },
    { label: "Windows user path", pattern: /[A-Z]:[\\/]Users[\\/]/iu },
    { label: "POSIX user path", pattern: /\/(?:Users|home)\/[^/\s]+/u },
    { label: "mapped development path", pattern: /(?:E:[\\/]X[\\/]Projects|X:[\\/])/iu },
    { label: "private agent instructions", pattern: /(?:AGENTS|CLAUDE)\.md/iu },
    { label: "private specification path", pattern: /docs[\\/](?:architecture|development-plan|spec)\.md/iu },
    { label: "local file URL", pattern: /file:\/\/(?:\/|[A-Z]:)/iu },
    { label: "source-map directive", pattern: /sourceMappingURL=/u },
] );

const REQUIRED_CONTENT_SECURITY_POLICY_DIRECTIVES = Object.freeze ( [
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
] );

const FORBIDDEN_CHART_ROUTING_PERFORMANCE_DIAGNOSTIC_TOKENS = Object.freeze ( [
    "graphCacheHitCount",
    "performanceCounters",
    "recursiveProofCallCount",
    "totalRequestMilliseconds",
] );

//--------------------------------------------------------------------------------------------------
// Function: assert
//
// Description:
//
//   Verifies the required condition and reports invalid input.
//
// Parameters:
//
//   - condition:
//     The condition supplied to the operation.
//
//   - message:
//     The message supplied to the operation.
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

function assert ( condition, message )
{
    // Handle the case where the condition condition is not satisfied.

    if ( !condition )
    {
        throw new Error ( message );
    }
}

//--------------------------------------------------------------------------------------------------
// Function: normalizeBasePath
//
// Description:
//
//   Normalizes base path.
//
// Parameters:
//
//   - basePath:
//     The base path supplied to the operation.
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

function normalizeBasePath ( basePath )
{
    // Initialize the local values needed by this operation.

    const withLeadingSlash = basePath.startsWith ( "/" ) ? basePath : `/${ basePath }`;

    // Return the result selected by the current condition.

    return withLeadingSlash.endsWith ( "/" ) ? withLeadingSlash : `${ withLeadingSlash }/`;
}

//--------------------------------------------------------------------------------------------------
// Function: relativeArtifactPath
//
// Description:
//
//   Derives the relative artifact path.
//
// Parameters:
//
//   - rootDirectory:
//     The root directory supplied to the operation.
//
//   - absolutePath:
//     The absolute path supplied to the operation.
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

function relativeArtifactPath ( rootDirectory, absolutePath )
{
    // Return the replace all result.

    return relative ( rootDirectory, absolutePath ).replaceAll ( "\\", "/" );
}

//--------------------------------------------------------------------------------------------------
// Function: assertArtifactPathIsSafe
//
// Description:
//
//   Verifies artifact path is safe and reports a failure when it is invalid.
//
// Parameters:
//
//   - artifactPath:
//     The artifact path supplied to the operation.
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

function assertArtifactPathIsSafe ( artifactPath )
{
    // Process each forbidden path from the forbidden artifact path patterns collection in order.

    for ( const forbiddenPath of FORBIDDEN_ARTIFACT_PATH_PATTERNS )
    {
        assert (
            !forbiddenPath.pattern.test ( artifactPath ),
            `Artifact path '${ artifactPath }' is a forbidden ${ forbiddenPath.label }.`,
        );
    }
}

//--------------------------------------------------------------------------------------------------
// Function: assertTextualArtifactIsSafe
//
// Description:
//
//   Verifies textual artifact is safe and reports a failure when it is invalid.
//
// Parameters:
//
//   - artifactPath:
//     The artifact path supplied to the operation.
//
//   - artifactText:
//     The artifact text supplied to the operation.
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

export function assertTextualArtifactIsSafe ( artifactPath, artifactText )
{
    assert ( !artifactText.includes ( "\u0000" ), `${ artifactPath } contains a null byte.` );

    // Process each forbidden text from the forbidden text patterns collection in order.

    for ( const forbiddenText of FORBIDDEN_TEXT_PATTERNS )
    {
        assert (
            !forbiddenText.pattern.test ( artifactText ),
            `${ artifactPath } contains a forbidden ${ forbiddenText.label }.`,
        );
    }
}

//--------------------------------------------------------------------------------------------------
// Function: collectArtifactEntries
//
// Description:
//
//   Collects artifact entries.
//
// Parameters:
//
//   - rootDirectory:
//     The root directory supplied to the operation.
//
//   - currentDirectory:
//     The current directory supplied to the operation.
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

async function collectArtifactEntries ( rootDirectory, currentDirectory = rootDirectory )
{
    // Initialize the local values needed by this operation.

    const entries     = ( await readdir ( currentDirectory, { withFileTypes: true } ) )
        .toSorted ( ( left, right ) => left.name.localeCompare ( right.name, "en" ) );
    const directories = [];
    const files       = [];

    // Process each entry from the entries collection in order.

    for ( const entry of entries )
    {
        // Initialize the local values needed by this operation.

        const absolutePath = join ( currentDirectory, entry.name );
        const artifactPath = relativeArtifactPath ( rootDirectory, absolutePath );

        assertArtifactPathIsSafe ( artifactPath );
        assert ( !entry.isSymbolicLink (), `Artifact path '${ artifactPath }' must not be a symbolic link.` );

        // Handle the case where is directory result is enabled.

        if ( entry.isDirectory () )
        {
            directories.push ( artifactPath );

            const descendants = await collectArtifactEntries ( rootDirectory, absolutePath );

            directories.push ( ...descendants.directories );
            files.push ( ...descendants.files );
            continue;
        }

        assert ( entry.isFile (), `Artifact path '${ artifactPath }' is neither a regular file nor a directory.` );
        files.push ( artifactPath );
    }

    // Return the assembled result.

    return { directories, files };
}

//--------------------------------------------------------------------------------------------------
// Function: readFluentIconNames
//
// Description:
//
//   Returns fluent icon names.
//
// Parameters:
//
//   - manifestPath:
//     The manifest path supplied to the operation.
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

async function readFluentIconNames ( manifestPath )
{
    // Initialize the local values needed by this operation.

    const manifestText = await readFile ( manifestPath, "utf8" );
    const manifest     = JSON.parse ( manifestText );

    assert ( typeof manifest === "object" && manifest !== null && !Array.isArray ( manifest ),
        "The Fluent icon manifest must be an object." );
    assert ( manifest.schema_version === 1, "The Fluent icon manifest schema_version must be 1." );
    assert ( manifest.source === "Microsoft Fluent UI System Icons", "The Fluent icon manifest source is invalid." );
    assert ( Array.isArray ( manifest.icons ) && manifest.icons.length > 0,
        "The Fluent icon manifest must select at least one icon." );

    const iconNames = manifest.icons.map ( ( icon, iconIndex ) =>
    {
        assert ( typeof icon === "object" && icon !== null && !Array.isArray ( icon ),
            `Fluent icon entry ${ iconIndex } must be an object.` );
        assert ( typeof icon.destination === "string" &&
            /^[A-Za-z0-9][A-Za-z0-9._-]*\.svg$/u.test ( icon.destination ),
        `Fluent icon entry ${ iconIndex } has an invalid destination.` );
        assert ( icon.destination === basename ( icon.destination ),
            `Fluent icon entry ${ iconIndex } destination must be one file name.` );

        // Return the computed result.

        return icon.destination;
    } );

    assert ( new Set ( iconNames ).size === iconNames.length,
        "The Fluent icon manifest contains duplicate destinations." );

    // Return the to sorted result.

    return iconNames.toSorted ( ( left, right ) => left.localeCompare ( right, "en" ) );
}

//--------------------------------------------------------------------------------------------------
// Function: loadProductionArtifactInventory
//
// Description:
//
//   Loads production artifact inventory.
//
// Parameters:
//
//   - manifestPath:
//     The manifest path supplied to the operation.
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

export async function loadProductionArtifactInventory ( manifestPath = fluentManifestPath )
{
    // Initialize the local values needed by this operation.

    const fluentIconNames = await readFluentIconNames ( manifestPath );
    const fluentIconFiles = fluentIconNames.map ( iconName =>
        ( { path: `icons/fluent/${ iconName }`, type: "svg" } ) );

    // Return the freeze result.

    return Object.freeze ( {
        directories:  ALLOWED_ARTIFACT_DIRECTORIES,
        dynamicFiles: DYNAMIC_ARTIFACT_FILES,
        fixedFiles:   Object.freeze ( [ ...FIXED_ARTIFACT_FILES, ...fluentIconFiles ] ),
    } );
}

//--------------------------------------------------------------------------------------------------
// Function: classifyArtifactFiles
//
// Description:
//
//   Classifies the artifact files.
//
// Parameters:
//
//   - artifactPaths:
//     The artifact paths supplied to the operation.
//
//   - artifactInventory:
//     The artifact inventory supplied to the operation.
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

function classifyArtifactFiles ( artifactPaths, artifactInventory )
{
    // Initialize the local values needed by this operation.

    const fixedFilesByPath = new Map ( artifactInventory.fixedFiles.map ( artifact => [ artifact.path, artifact ] ) );

    assert ( fixedFilesByPath.size === artifactInventory.fixedFiles.length,
        "The artifact inventory contains duplicate fixed paths." );

    // Initialize the local values needed by this operation.

    const classifications = new Map ();
    const dynamicMatches  = new Map ( artifactInventory.dynamicFiles.map ( dynamicFile => [ dynamicFile.budget, [] ] ) );

    // Process each artifact path from the artifact paths collection in order.

    for ( const artifactPath of artifactPaths )
    {
        // Initialize the local values needed by this operation.

        const fixedFile = fixedFilesByPath.get ( artifactPath );

        // Handle the case where fixed file differs from undefined.

        if ( fixedFile !== undefined )
        {
            classifications.set ( artifactPath, fixedFile );
            continue;
        }

        const matchingDynamicFiles = artifactInventory.dynamicFiles.filter ( dynamicFile =>
            dynamicFile.pattern.test ( artifactPath ) );

        assert ( matchingDynamicFiles.length <= 1,
            `Artifact path '${ artifactPath }' matches multiple dynamic inventory slots.` );
        assert ( matchingDynamicFiles.length === 1,
            `Artifact path '${ artifactPath }' is not allowlisted.` );

        const dynamicFile = matchingDynamicFiles [ 0 ];

        classifications.set ( artifactPath, dynamicFile );
        dynamicMatches.get ( dynamicFile.budget )?.push ( artifactPath );
    }

    // Process each fixed file from the artifact inventory fixed files collection in order.

    for ( const fixedFile of artifactInventory.fixedFiles )
    {
        assert ( classifications.has ( fixedFile.path ),
            `The artifact is missing allowlisted file '${ fixedFile.path }'.` );
    }

    // Process each dynamic file from the artifact inventory dynamic files collection in order.

    for ( const dynamicFile of artifactInventory.dynamicFiles )
    {
        // Initialize the local values needed by this operation.

        const matchingPaths = dynamicMatches.get ( dynamicFile.budget ) ?? [];

        assert ( matchingPaths.length === 1,
            `The artifact must contain exactly one ${ dynamicFile.label } file.` );
    }

    // Return the assembled result.

    return { classifications, dynamicMatches };
}

//--------------------------------------------------------------------------------------------------
// Function: assertArtifactDirectoriesMatch
//
// Description:
//
//   Verifies artifact directories match and reports a failure when it is invalid.
//
// Parameters:
//
//   - artifactDirectories:
//     The artifact directories supplied to the operation.
//
//   - artifactInventory:
//     The artifact inventory supplied to the operation.
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

function assertArtifactDirectoriesMatch ( artifactDirectories, artifactInventory )
{
    // Initialize the local values needed by this operation.

    const expectedDirectories = [ ...artifactInventory.directories ].toSorted ( ( left, right ) =>
        left.localeCompare ( right, "en" ) );
    const actualDirectories = [ ...artifactDirectories ].toSorted ( ( left, right ) =>
        left.localeCompare ( right, "en" ) );

    // Process each artifact directory from the actual directories collection in order.

    for ( const artifactDirectory of actualDirectories )
    {
        assert ( expectedDirectories.includes ( artifactDirectory ),
            `Artifact directory '${ artifactDirectory }' is not allowlisted.` );
    }

    // Process each expected directory from the expected directories collection in order.

    for ( const expectedDirectory of expectedDirectories )
    {
        assert ( actualDirectories.includes ( expectedDirectory ),
            `The artifact is missing allowlisted directory '${ expectedDirectory }'.` );
    }
}

//--------------------------------------------------------------------------------------------------
// Function: decodeTextArtifact
//
// Description:
//
//   Decodes text artifact.
//
// Parameters:
//
//   - artifactPath:
//     The artifact path supplied to the operation.
//
//   - artifactBuffer:
//     The artifact buffer supplied to the operation.
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

function decodeTextArtifact ( artifactPath, artifactBuffer )
{
    // Run the operation that may report a recoverable failure.

    try
    {
        // Return the decode result.

        return new TextDecoder ( "utf-8", { fatal: true } ).decode ( artifactBuffer );
    }
    catch
    {
        // Recover from the reported failure without hiding its outcome.

        throw new Error ( `${ artifactPath } is not valid UTF-8 text.` );
    }
}

//--------------------------------------------------------------------------------------------------
// Function: assertPngContent
//
// Description:
//
//   Verifies PNG content and reports a failure when it is invalid.
//
// Parameters:
//
//   - artifactPath:
//     The artifact path supplied to the operation.
//
//   - artifactBuffer:
//     The artifact buffer supplied to the operation.
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

function assertPngContent ( artifactPath, artifactBuffer )
{
    assert ( artifactBuffer.length >= PNG_SIGNATURE.length &&
        artifactBuffer.subarray ( 0, PNG_SIGNATURE.length ).equals ( PNG_SIGNATURE ),
    `${ artifactPath } does not contain a PNG signature.` );
}

//--------------------------------------------------------------------------------------------------
// Function: assertSvgContent
//
// Description:
//
//   Verifies SVG content and reports a failure when it is invalid.
//
// Parameters:
//
//   - artifactPath:
//     The artifact path supplied to the operation.
//
//   - artifactText:
//     The artifact text supplied to the operation.
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

function assertSvgContent ( artifactPath, artifactText )
{
    assert ( /^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg(?:\s|>)/u.test ( artifactText ),
        `${ artifactPath } does not contain an SVG root element.` );
}

//--------------------------------------------------------------------------------------------------
// Function: assertJsonContent
//
// Description:
//
//   Verifies JSON content and reports a failure when it is invalid.
//
// Parameters:
//
//   - artifactPath:
//     The artifact path supplied to the operation.
//
//   - artifactText:
//     The artifact text supplied to the operation.
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

function assertJsonContent ( artifactPath, artifactText )
{
    // Run the operation that may report a recoverable failure.

    try
    {
        JSON.parse ( artifactText );
    }
    catch
    {
        // Recover from the reported failure without hiding its outcome.

        throw new Error ( `${ artifactPath } does not contain valid JSON.` );
    }
}

//--------------------------------------------------------------------------------------------------
// Function: validateArtifactContent
//
// Description:
//
//   Validates artifact content.
//
// Parameters:
//
//   - artifactPath:
//     The artifact path supplied to the operation.
//
//   - artifactClassification:
//     The artifact classification supplied to the operation.
//
//   - artifactBuffer:
//     The artifact buffer supplied to the operation.
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

function validateArtifactContent ( artifactPath, artifactClassification, artifactBuffer )
{
    // Initialize the local values needed by this operation.

    const expectedExtension = ARTIFACT_TYPE_EXTENSIONS [ artifactClassification.type ];

    assert ( expectedExtension !== undefined,
        `Artifact path '${ artifactPath }' has unknown inventory type '${ artifactClassification.type }'.` );
    assert ( extname ( artifactPath ) === expectedExtension,
        `Artifact path '${ artifactPath }' does not match inventory type '${ artifactClassification.type }'.` );
    assert ( !artifactBuffer.includes ( "-----BEGIN " ),
        `${ artifactPath } contains a forbidden PEM block.` );

    // Handle the case where artifact classification type matches "png".

    if ( artifactClassification.type === "png" )
    {
        assertPngContent ( artifactPath, artifactBuffer );

        // Return the computed result.

        return null;
    }

    assert ( TEXTUAL_ARTIFACT_TYPES.has ( artifactClassification.type ),
        `Artifact path '${ artifactPath }' has an unscannable inventory type '${ artifactClassification.type }'.` );

    const artifactText = decodeTextArtifact ( artifactPath, artifactBuffer );

    assertTextualArtifactIsSafe ( artifactPath, artifactText );

    // Handle the case where artifact classification type matches "svg".

    if ( artifactClassification.type === "svg" )
    {
        assertSvgContent ( artifactPath, artifactText );
    }
    else if ( artifactClassification.type === "json" )
    {
        assertJsonContent ( artifactPath, artifactText );
    }

    // Return the artifact text.

    return artifactText;
}

//--------------------------------------------------------------------------------------------------
// Function: dynamicPath
//
// Description:
//
//   Derives the dynamic path.
//
// Parameters:
//
//   - dynamicMatches:
//     The dynamic matches supplied to the operation.
//
//   - budgetName:
//     The budget name supplied to the operation.
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

function dynamicPath ( dynamicMatches, budgetName )
{
    // Initialize the local values needed by this operation.

    const matchingPaths = dynamicMatches.get ( budgetName ) ?? [];

    assert ( matchingPaths.length === 1, `Dynamic artifact slot '${ budgetName }' is incomplete.` );

    // Return the computed result.

    return matchingPaths [ 0 ];
}

//--------------------------------------------------------------------------------------------------
// Function: assertIndexContract
//
// Description:
//
//   Verifies index contract and reports a failure when it is invalid.
//
// Parameters:
//
//   - indexText:
//     The index text supplied to the operation.
//
//   - expectedBasePath:
//     The expected base path supplied to the operation.
//
//   - dynamicMatches:
//     The dynamic matches supplied to the operation.
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

function assertIndexContract ( indexText, expectedBasePath, dynamicMatches )
{
    // Initialize the local values needed by this operation.

    const applicationJavascriptPath = dynamicPath ( dynamicMatches, "applicationJavascript" );
    const stylesheetPath            = dynamicPath ( dynamicMatches, "stylesheet" );

    assert ( indexText.includes ( `${ expectedBasePath }${ applicationJavascriptPath }` ),
        `index.html does not load '${ applicationJavascriptPath }' beneath ${ expectedBasePath }.` );
    assert ( indexText.includes ( `${ expectedBasePath }${ stylesheetPath }` ),
        `index.html does not load '${ stylesheetPath }' beneath ${ expectedBasePath }.` );
    assert ( indexText.includes ( `${ expectedBasePath }icons/custom/20/state-machine-application.png` ),
        "index.html does not use the curated 20-pixel application icon." );
    assert ( !/(?:src|href)=["']https?:\/\//iu.test ( indexText ),
        "The shell loads an external runtime asset." );
    assert ( indexText.includes ( "http-equiv=\"Content-Security-Policy\"" ),
        "index.html does not declare the required Content Security Policy." );
    assert ( !indexText.includes ( "'unsafe-eval'" ),
        "The Content Security Policy must not permit unsafe-eval." );

    // Process each directive from the required content security policy directives collection in
    // order.

    for ( const directive of REQUIRED_CONTENT_SECURITY_POLICY_DIRECTIVES )
    {
        assert ( indexText.includes ( directive ),
            `The Content Security Policy is missing '${ directive }'.` );
    }
}

//--------------------------------------------------------------------------------------------------
// Function: assertChartRoutingPerformanceDiagnosticsAreAbsent
//
// Description:
//
//   Verifies chart routing performance diagnostics are absent and reports a failure when it is
//   invalid.
//
// Parameters:
//
//   - chartRoutingWorkerText:
//     The chart routing worker text supplied to the operation.
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

function assertChartRoutingPerformanceDiagnosticsAreAbsent ( chartRoutingWorkerText )
{
    // Process each diagnostic token from the forbidden chart routing performance diagnostic tokens
    // collection in order.

    for ( const diagnosticToken of FORBIDDEN_CHART_ROUTING_PERFORMANCE_DIAGNOSTIC_TOKENS )
    {
        assert ( !chartRoutingWorkerText.includes ( diagnosticToken ),
            `The production Chart routing Worker contains benchmark diagnostic token '${ diagnosticToken }'.` );
    }
}

//--------------------------------------------------------------------------------------------------
// Function: measureBundles
//
// Description:
//
//   Calculates bundles.
//
// Parameters:
//
//   - fileRecords:
//     The file records supplied to the operation.
//
//   - classifications:
//     The classifications supplied to the operation.
//
//   - dynamicMatches:
//     The dynamic matches supplied to the operation.
//
//   - dynamicFiles:
//     The dynamic files supplied to the operation.
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

function measureBundles ( fileRecords, classifications, dynamicMatches, dynamicFiles )
{
    // Initialize the local values needed by this operation.

    const bundleMeasurements = dynamicFiles.map ( dynamicFile =>
    {
        // Initialize the local values needed by this operation.

        const artifactPath     = dynamicPath ( dynamicMatches, dynamicFile.budget );
        const byteCount        = fileRecords.get ( artifactPath )?.byteCount;
        const maximumByteCount = BUNDLE_BUDGET_BYTES [ dynamicFile.budget ];

        assert ( byteCount !== undefined, `Artifact size is unavailable for '${ artifactPath }'.` );
        assert ( maximumByteCount !== undefined, `Bundle budget '${ dynamicFile.budget }' is unavailable.` );
        assert ( byteCount <= maximumByteCount,
            `${ artifactPath } is ${ byteCount } bytes; the ${ dynamicFile.label } budget is ` +
            `${ maximumByteCount } bytes.` );

        // Return the assembled result.

        return { byteCount, fileName: artifactPath, label: dynamicFile.label, maximumByteCount };
    } );
    const totalJavascriptByteCount = [ ...fileRecords.entries () ]
        .filter ( ( [ artifactPath ] ) => classifications.get ( artifactPath )?.type === "javascript" )
        .reduce ( ( total, fileEntry ) => total + fileEntry [ 1 ].byteCount, 0 );
    const totalArtifactByteCount = [ ...fileRecords.values () ]
        .reduce ( ( total, fileRecord ) => total + fileRecord.byteCount, 0 );

    assert ( totalJavascriptByteCount <= BUNDLE_BUDGET_BYTES.totalJavascript,
        `Artifact JavaScript is ${ totalJavascriptByteCount } bytes; the total budget is ` +
        `${ BUNDLE_BUDGET_BYTES.totalJavascript } bytes.` );
    assert ( totalArtifactByteCount <= BUNDLE_BUDGET_BYTES.totalArtifact,
        `The artifact is ${ totalArtifactByteCount } bytes; the total budget is ` +
        `${ BUNDLE_BUDGET_BYTES.totalArtifact } bytes.` );

    // Return the assembled result.

    return { bundleMeasurements, totalArtifactByteCount, totalJavascriptByteCount };
}

//--------------------------------------------------------------------------------------------------
// Function: verifyArtifact
//
// Description:
//
//   Verifies the artifact.
//
// Parameters:
//
//   - artifactDirectory:
//     The artifact directory supplied to the operation.
//
//   - artifactInventory:
//     The artifact inventory supplied to the operation.
//
//   - basePath:
//     The base path supplied to the operation.
//
//   - writeLine:
//     The write line supplied to the operation.
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

export async function verifyArtifact (
    artifactDirectory,
    artifactInventory,
    basePath  = "/automata-lab/",
    writeLine = message => console.log ( message ),
)
{
    // Initialize the local values needed by this operation.

    const expectedBasePath = normalizeBasePath ( basePath );
    const rootStatistics   = await lstat ( artifactDirectory );

    assert ( rootStatistics.isDirectory () && !rootStatistics.isSymbolicLink (),
        "The artifact root must be a regular directory, not a symbolic link." );

    const artifactEntries  = await collectArtifactEntries ( artifactDirectory );

    assertArtifactDirectoriesMatch ( artifactEntries.directories, artifactInventory );

    // Initialize the local values needed by this operation.

    const { classifications, dynamicMatches } = classifyArtifactFiles ( artifactEntries.files, artifactInventory );
    const fileRecords = new Map ( await Promise.all ( artifactEntries.files.map ( async artifactPath =>
    {
        // Initialize the local values needed by this operation.

        const artifactBuffer = await readFile ( join ( artifactDirectory, artifactPath ) );

        // Return the assembled result collection.

        return [ artifactPath, { artifactBuffer, byteCount: artifactBuffer.byteLength } ];
    } ) ) );
    const textualContent = new Map ();

    // Process each [ artifact path, file record ] from the file records collection in order.

    for ( const [ artifactPath, fileRecord ] of fileRecords )
    {
        // Initialize the local values needed by this operation.

        const classification = classifications.get ( artifactPath );

        assert ( classification !== undefined, `Artifact path '${ artifactPath }' has no inventory classification.` );

        const artifactText = validateArtifactContent ( artifactPath, classification, fileRecord.artifactBuffer );

        // Handle the case where artifact text differs from an absent value.

        if ( artifactText !== null )
        {
            textualContent.set ( artifactPath, artifactText );
        }
    }

    // Initialize the local values needed by this operation.

    const indexText              = textualContent.get ( "index.html" );
    const chartRoutingWorkerText = textualContent.get ( dynamicPath ( dynamicMatches, "chartRoutingWorker" ) );

    assert ( indexText !== undefined, "The artifact does not contain readable index.html text." );
    assert ( chartRoutingWorkerText !== undefined,
        "The artifact does not contain readable Chart routing Worker JavaScript." );
    assertIndexContract ( indexText, expectedBasePath, dynamicMatches );
    assertChartRoutingPerformanceDiagnosticsAreAbsent ( chartRoutingWorkerText );

    const measurements = measureBundles (
        fileRecords,
        classifications,
        dynamicMatches,
        artifactInventory.dynamicFiles,
    );

    writeLine ( `Verified ${ artifactEntries.files.length } explicitly allowlisted artifact files beneath ` +
        `${ expectedBasePath }.` );
    writeLine ( measurements.bundleMeasurements.map ( measurement =>
        `${ measurement.label }: ${ measurement.byteCount }/${ measurement.maximumByteCount } bytes` ).join ( "; " ) );
    writeLine ( `Total JavaScript: ${ measurements.totalJavascriptByteCount }/` +
        `${ BUNDLE_BUDGET_BYTES.totalJavascript } bytes; total artifact: ${ measurements.totalArtifactByteCount }/` +
        `${ BUNDLE_BUDGET_BYTES.totalArtifact } bytes.` );

    // Return the freeze result.

    return Object.freeze ( {
        fileCount: artifactEntries.files.length,
        ...measurements,
    } );
}

//--------------------------------------------------------------------------------------------------
// Function: verifyProductionArtifact
//
// Description:
//
//   Verifies the production artifact.
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

export async function verifyProductionArtifact ()
{
    // Initialize the local values needed by this operation.

    const artifactInventory = await loadProductionArtifactInventory ();

    // Return the verify artifact result.

    return verifyArtifact (
        distributionDirectory,
        artifactInventory,
        process.env.AUTOMATA_BASE_PATH ?? "/automata-lab/",
    );
}
