// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Chart Algorithm Lock
// Version: 1.0.0
// Date:    2026-08-20
// Author:  Rohin Gosling
//
// Description:
//
//   Fails the build when chart automatic-layout or transition-routing source drifts from its stored
//   digest.
//
//   A source edit can alter fallback routing without producing an obvious compile or test failure.
//   The content lock makes that drift explicit during verification by comparing current source
//   digests with the stored manifest.
//   Differences are reported before they can surface only as changed chart output.
//
//   Three things are locked, because there are three ways the behaviour can move:
//
//     1. The content of every algorithm source file, by digest.
//     2. The membership of the locked set, so a new routing module cannot be added outside it.
//     3. The chart layout and routing constants in shared configuration, by value, so unrelated
//        edits remain free while a changed clearance or default does not.
//
//
//   Digests are taken over line-ending-normalized text, so the lock holds across platforms and
//   checkout settings.
//
//   An explicitly enabled update run rewrites the stored digests. Ordinary runs only verify the
//   manifest, so an unexpected algorithm change remains a build failure.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { COMPILE_TIME_CONFIGURATION } from "../../src/configuration/compile-time-configuration";

const packageRoot  = resolve ( dirname ( fileURLToPath ( import.meta.url ) ), "../.." );
const manifestPath = resolve ( packageRoot, "tests/chart/chart-algorithm-lock.json" );

// The locked area. Every file matching one of these groups is locked; the exclusions carry their
// reason so that a later reader can tell a deliberate omission from an oversight.

//--------------------------------------------------------------------------------------------------
// Interface: LockedGroup
//
// Description:
//
//   Defines the structure of locked group.
//
//--------------------------------------------------------------------------------------------------

interface LockedGroup
{
    readonly directory: string;
    readonly pattern:   RegExp;
    readonly exclude:   Readonly<Record<string, string>>;
}

const LOCKED_GROUPS: readonly LockedGroup[] =
[
    {
        directory: "src/application",
        exclude:   {},
        pattern:   /^chart-.*\.ts$/u,
    },
    {
        directory: "src/infrastructure/chart",
        exclude:
        {
            "browser-chart-image-export.ts": "Image export renders the chart; it neither lays out nor routes it.",
            "index.ts":                      "A barrel of re-exports carrying no algorithm.",
        },
        pattern: /\.ts$/u,
    },
    {
        directory: "src/protocol",
        exclude:   {},
        pattern:   /^chart-.*\.ts$/u,
    },
    {
        directory: "src/workers",
        exclude:   {},
        pattern:   /^chart-.*\.ts$/u,
    },
];

// The chart layout and routing values held in the shared configuration file. Recorded here by value
// rather than by digest, so that editing an unrelated part of that file costs nothing while moving
// a clearance, a bound, or a preference default costs a deliberate re-lock.

const LOCKED_CONFIGURATION =
{
    applicationSettings:
    {
        automaticLayoutAndRouting:
        {
            deleteOrphanedChartItemsDuringAutomaticLayout: false,
            minimumStateDistance:                          500,
            selfTransitionLoopAspect:                      35,
            selfTransitionLoopExtension:                   30,
            selfTransitionLoopSpacing:                     24,
            transitionArrowHeadSize:                       40,
            transitionGravityPointDistance:                100,
            transitionLabelAlignment:                      "Start",
        },
        format:
        {
            wrapActionNames: true,
            wrapEventNames:  true,
            wrapStateNames:  true,
        },
        grid:
        {
            gridColor:      "#1e1e1e",
            gridColorTheme: "Dark",
            gridSize:       100,
            gridStyle:      "Solid",
            showGrid:   true,
            snapToGrid: true,
        },
        imageExport:
        {
            imageDpi:                     300,
            imageFileFormat:              "PNG",
            transparentBackground:        false,
            imageUnit:                    "Inches",
            maximumImageExportMegapixels: 1_000,
        },
        stateSize:
        {
            collapsedStateHeight:       62,
            collapsedStateWidth:        268,
            expandedStateMinimumHeight: 62,
            expandedStateWidth:         268,
        },
    },
    constraints:
    {
        gridSize:                       { maximum: 200, minimum: 10 },
        imageDpi:                       { maximum: 1_200, minimum: 72 },
        maximumImageExportMegapixels:   { maximum: 1_000, minimum: 1 },
        minimumStateDistance:           { maximum: 2_000, minimum: 100 },
        selfTransitionLoopAspect:       { maximum: 100, minimum: 5 },
        selfTransitionLoopExtension:    { maximum: 400, minimum: 1 },
        selfTransitionLoopSpacing:      { maximum: 200, minimum: 1 },
        stateDimension:                 { maximum: 4_096, minimum: 1 },
        transitionArrowHeadSize:        { maximum: 160, minimum: 8 },
        transitionGravityPointDistance: { maximum: 200, minimum: 1 },
    },
    automaticLayout:
    {
        elkBetweenLayerSeedSpacing: 200,
        elkWithinLayerSeedSpacing:  40,
    },
    routing:
    {
        cubicDetourClearance:
        {
            clearanceProofMargin:           0.25,
            clearanceRefinementCount:       16,
            coordinateEpsilon:              0.000001,
            maximumClearanceExpansionCount: 16,
            maximumClearanceProofNodeCount: 8_192,
            maximumSubdivisionDepth:        14,
        },
        labelPlacement:
        {
            alignmentFractions:
            {
                center: 0.5,
                end:    0.8,
                start:  0.2,
            },
            candidateIntervalCount: 25,
            curveSamplesPerSpan:    32,
        },
        maximumCurveClearanceSearchCount: 6,
        routeClearance:                   12,
        selfTransitionLoop:
        {
            mouthLimit:   0.55,
            spansPerLoop: 12,
        },
    },
    transitionLines:
    {
        arrowHeadStyle: "NarrowClosed",
    },
} as const;

//--------------------------------------------------------------------------------------------------
// Interface: LockManifest
//
// Description:
//
//   Defines the structure of lock manifest.
//
//--------------------------------------------------------------------------------------------------

interface LockManifest
{
    readonly files: Readonly<Record<string, string>>;
}

// Line endings are normalized before hashing. The same file checked out with CRLF and with LF is
// the same algorithm, and a lock that disagreed would fail on the checkout setting rather than on
// the code.

//--------------------------------------------------------------------------------------------------
// Function: digestOfSourceFile
//
// Description:
//
//   Derives the digest of source file.
//
// Parameters:
//
//   - relativePath:
//     The relative path supplied to the operation.
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

function digestOfSourceFile ( relativePath: string ): string
{
    // Initialize the local values needed by this operation.

    const text = readFileSync ( resolve ( packageRoot, relativePath ), "utf8" ).replace ( /\r\n/gu, "\n" );

    // Return the computed result.

    return `sha256:${createHash ( "sha256" ).update ( text, "utf8" ).digest ( "hex" )}`;
}

//--------------------------------------------------------------------------------------------------
// Function: lockedFilePaths
//
// Description:
//
//   Derives the locked file paths.
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

function lockedFilePaths (): readonly string[]
{
    // Return the sort result.

    return LOCKED_GROUPS.flatMap ( group => readdirSync ( resolve ( packageRoot, group.directory ) )
        .filter ( name => group.pattern.test ( name ) && group.exclude [ name ] === undefined )
        .map ( name => `${group.directory}/${name}` ) ).sort ();
}

//--------------------------------------------------------------------------------------------------
// Function: currentDigests
//
// Description:
//
//   Derives the current digests.
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

function currentDigests (): Record<string, string>
{
    // Return the from entries result.

    return Object.fromEntries ( lockedFilePaths ().map ( path => [ path, digestOfSourceFile ( path ) ] ) );
}

//--------------------------------------------------------------------------------------------------
// Function: readManifest
//
// Description:
//
//   Returns manifest.
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

function readManifest (): LockManifest
{
    // Return the computed result.

    return JSON.parse ( readFileSync ( manifestPath, "utf8" ) ) as LockManifest;
}

// `npm run chart:lock` enables update mode, which writes current digests instead of asserting
// against the stored manifest.

if ( process.env [ "CHART_ALGORITHM_LOCK_UPDATE" ] === "1" )
{
    const files    = currentDigests ();
    const existing = readManifest () as LockManifest & { readonly baseline?: unknown };

    writeFileSync (
        manifestPath,
        `${JSON.stringify (
            {
                description:
                    "Content digests of the locked chart automatic-layout and transition-routing sources. " +
                    "Regenerate only with npm run chart:lock, and only when the change is deliberate.",
                authority: "docs/chart-layout-routing.md section 14",
                baseline:  existing.baseline,
                files,
            },
            null,
            4,
        )}\n`,
        "utf8",
    );

    console.log ( `Chart algorithm lock rewritten with ${Object.keys ( files ).length} files.` );
}

describe ( "the chart layout and routing algorithms are locked", () =>
{
    // Initialize the local values needed by this operation.

    const manifest = readManifest ();

    it ( "locks every file in the layout and routing area, and nothing outside it", () =>
    {
        expect ( lockedFilePaths () ).toEqual ( Object.keys ( manifest.files ).sort () );
    } );

    it ( "leaves every locked file byte-identical to the accepted baseline", () =>
    {
        // Initialize the local values needed by this operation.

        const drifted = lockedFilePaths ().filter ( path => manifest.files [ path ] !== digestOfSourceFile ( path ) );

        expect ( drifted, `Locked chart algorithm sources changed: ${drifted.join ( ", " )}. If the change is `
            + "deliberate, run npm run chart:lock and record what changed in docs/chart-layout-routing.md section 14. If it is "
            + "not, revert it: the algorithms are an accepted baseline and are not part of any other feature's scope." )
            .toEqual ( [] );
    } );

    it ( "holds the chart layout and routing configuration at its accepted values", () =>
    {
        expect ( COMPILE_TIME_CONFIGURATION.applicationSettings.chart )
            .toEqual ( LOCKED_CONFIGURATION.applicationSettings );
        expect ( COMPILE_TIME_CONFIGURATION.applicationSettingConstraints.chart )
            .toEqual ( LOCKED_CONFIGURATION.constraints );
        expect ( COMPILE_TIME_CONFIGURATION.chart.automaticLayout )
            .toEqual ( LOCKED_CONFIGURATION.automaticLayout );
        expect ( COMPILE_TIME_CONFIGURATION.chart.routing ).toEqual ( LOCKED_CONFIGURATION.routing );
        expect ( COMPILE_TIME_CONFIGURATION.chart.transitionLines ).toEqual ( LOCKED_CONFIGURATION.transitionLines );
    } );
} );
