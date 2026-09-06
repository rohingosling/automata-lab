// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Documentation Dependency Audit
// Version: 1.0.0
// Date:    2026-08-26
// Author:  Rohin Gosling
//
// Description:
//
//   Derives the installed VitePress build dependency closure from package-lock.json, assembles
//   its available license evidence, and verifies that the committed documentation notice
//   is exactly current. The audit is fully offline.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory  = dirname ( fileURLToPath ( import.meta.url ) );
const packageDirectory = dirname ( scriptDirectory );
const packageLockPath  = join ( packageDirectory, "package-lock.json" );
const noticePath       = join ( packageDirectory, "public", "notices", "third-party-documentation.txt" );
const WRITE_ARGUMENT   = "--write";


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
// Function: normalizeText
//
// Description:
//
//   Normalizes text.
//
// Parameters:
//
//   - value:
//     The value supplied to the operation.
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

function normalizeText ( value )
{
    // Return the computed result.

    return `${value.replace ( /\r\n?/gu, "\n" ).trimEnd ()}\n`;
}

//--------------------------------------------------------------------------------------------------
// Function: sha256
//
// Description:
//
//   Derives the sha256.
//
// Parameters:
//
//   - value:
//     The value supplied to the operation.
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

function sha256 ( value )
{
    // Return the digest result.

    return createHash ( "sha256" ).update ( value, "utf8" ).digest ( "hex" );
}

//--------------------------------------------------------------------------------------------------
// Function: compareText
//
// Description:
//
//   Compares text.
//
// Parameters:
//
//   - left:
//     The left supplied to the operation.
//
//   - right:
//     The right supplied to the operation.
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

function compareText ( left, right )
{
    // Return the result selected by the current condition.

    return left < right ? -1 : left > right ? 1 : 0;
}

//--------------------------------------------------------------------------------------------------
// Function: packageNameFromLockPath
//
// Description:
//
//   Derives the package name from lock path.
//
// Parameters:
//
//   - packagePath:
//     The package path supplied to the operation.
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

function packageNameFromLockPath ( packagePath )
{
    // Initialize the local values needed by this operation.

    const marker      = "node_modules/";
    const markerIndex = packagePath.lastIndexOf ( marker );

    assert ( markerIndex >= 0, `The lockfile package path '${ packagePath }' is not beneath node_modules.` );

    // Return the slice result.

    return packagePath.slice ( markerIndex + marker.length );
}

//--------------------------------------------------------------------------------------------------
// Function: resolveDependencyPath
//
// Description:
//
//   Resolves dependency path.
//
// Parameters:
//
//   - packages:
//     The packages supplied to the operation.
//
//   - sourcePackagePath:
//     The source package path supplied to the operation.
//
//   - dependencyName:
//     The dependency name supplied to the operation.
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

function resolveDependencyPath ( packages, sourcePackagePath, dependencyName )
{
    // Initialize the local values needed by this operation.

    let searchPackagePath = sourcePackagePath;

    // Continue the operation while its terminating condition has not been reached.

    while ( true )
    {
        // Initialize the local values needed by this operation.

        const candidatePath = searchPackagePath.length === 0
            ? `node_modules/${ dependencyName }`
            : `${ searchPackagePath }/node_modules/${ dependencyName }`;

        // Handle the case where selected collection value differs from undefined.

        if ( packages [ candidatePath ] !== undefined )
        {
            // Return the candidate path.

            return candidatePath;
        }

        const parentMarkerIndex = searchPackagePath.lastIndexOf ( "/node_modules/" );

        // Handle the case where parent marker index is below 0.

        if ( parentMarkerIndex < 0 )
        {
            // Return the result selected by the current condition.

            return searchPackagePath.length === 0 ? null : resolveDependencyPath ( packages, "", dependencyName );
        }

        searchPackagePath = searchPackagePath.slice ( 0, parentMarkerIndex );
    }
}

//--------------------------------------------------------------------------------------------------
// Function: runtimeDependencyRequirements
//
// Description:
//
//   Derives the runtime dependency requirements.
//
// Parameters:
//
//   - packageMetadata:
//     The package metadata supplied to the operation.
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

function runtimeDependencyRequirements ( packageMetadata )
{
    // Initialize the local values needed by this operation.

    const requirements = new Map ();

    // Process each dependency name from the keys result collection in order.

    for ( const dependencyName of Object.keys ( packageMetadata.dependencies ?? {} ) )
    {
        requirements.set ( dependencyName, true );
    }

    // Process each dependency name from the keys result collection in order.

    for ( const dependencyName of Object.keys ( packageMetadata.optionalDependencies ?? {} ) )
    {
        requirements.set ( dependencyName, false );
    }

    // Process each dependency name from the keys result collection in order.

    for ( const dependencyName of Object.keys ( packageMetadata.peerDependencies ?? {} ) )
    {
        // Initialize the local values needed by this operation.

        const isOptional         = packageMetadata.peerDependenciesMeta?.[ dependencyName ]?.optional === true;
        const wasAlreadyRequired = requirements.get ( dependencyName ) === true;

        requirements.set ( dependencyName, wasAlreadyRequired || !isOptional );
    }

    // Return the to sorted result.

    return [ ...requirements.entries () ].toSorted ( ( left, right ) => compareText ( left [ 0 ], right [ 0 ] ) );
}

//--------------------------------------------------------------------------------------------------
// Function: documentationClosurePaths
//
// Description:
//
//   Derives the documentation build dependency closure paths.
//
// Parameters:
//
//   - lockfile:
//     The lockfile supplied to the operation.
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

function documentationClosurePaths ( lockfile )
{
    // Initialize the local values needed by this operation.

    const packages    = lockfile.packages;
    const rootPackage = packages?.[ "" ];

    assert ( lockfile.lockfileVersion === 3,
        "The documentation dependency audit requires package-lock.json lockfileVersion 3." );
    assert ( packages !== null && typeof packages === "object", "package-lock.json has no packages map." );
    assert ( rootPackage !== null && typeof rootPackage === "object", "package-lock.json has no root package entry." );

    // Initialize the local values needed by this operation.

    const closurePaths = new Set ();
    const pendingPaths = Object.keys ( rootPackage.devDependencies ?? {} )
        .toSorted ( compareText )
        .map ( dependencyName =>
        {
            // Initialize the local values needed by this operation.

            const dependencyPath = resolveDependencyPath ( packages, "", dependencyName );

            assert (
                dependencyPath !== null,
                `Root documentation dependency '${ dependencyName }' is absent from the lockfile.`,
            );

            // Return the dependency path.

            return dependencyPath;
        } );

    // Continue the operation while its terminating condition has not been reached.

    while ( pendingPaths.length > 0 )
    {
        // Initialize the local values needed by this operation.

        const packagePath = pendingPaths.shift ();

        // Handle the case where has result is enabled.

        if ( closurePaths.has ( packagePath ) )
        {
            continue;
        }

        const packageMetadata = packages [ packagePath ];

        assert ( packageMetadata !== undefined, `Lockfile package '${ packagePath }' disappeared during traversal.` );
        assert ( packageMetadata.link !== true,
            `Documentation dependency '${ packagePath }' is an unsupported local link.` );
        closurePaths.add ( packagePath );

        // Process each [ dependency name, is required ] from the runtime dependency requirements
        // result collection in order.

        for ( const [ dependencyName, isRequired ] of runtimeDependencyRequirements ( packageMetadata ) )
        {
            // Initialize the local values needed by this operation.

            const dependencyPath = resolveDependencyPath ( packages, packagePath, dependencyName );

            // Handle the case where dependency path matches an absent value.

            if ( dependencyPath === null )
            {
                assert ( !isRequired,
                    `Documentation dependency '${ packagePath }' cannot resolve '${ dependencyName }'.` );
                continue;
            }

            pendingPaths.push ( dependencyPath );
        }
    }

    // Return the deterministic traversed closure.

    return [ ...closurePaths ].toSorted ( compareText );
}

//--------------------------------------------------------------------------------------------------
// Function: auditedPackages
//
// Description:
//
//   Derives the audited packages.
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

async function auditedPackages ()
{
    // Initialize the local values needed by this operation.

    const lockfile              = JSON.parse ( await readFile ( packageLockPath, "utf8" ) );
    const directDependencyNames = new Set ( Object.keys ( lockfile.packages [ "" ].devDependencies ?? {} ) );
    const packages              = [];

    // Process each package path from the documentation closure in order.

    for ( const packagePath of documentationClosurePaths ( lockfile ) )
    {
        // Initialize the local values needed by this operation.

        const lockMetadata = lockfile.packages [ packagePath ];
        const packageName  = packageNameFromLockPath ( packagePath );

        assert ( typeof lockMetadata.version === "string", `Lockfile package '${ packagePath }' has no version.` );
        assert (
            typeof lockMetadata.license === "string",
            `Lockfile package '${ packagePath }' has no license field.`,
        );
        assert (
            typeof lockMetadata.integrity === "string",
            `Lockfile package '${ packagePath }' has no integrity digest.`,
        );

        packages.push ( {
            declaredLicense: lockMetadata.license,
            identifier:      `${ packageName }@${ lockMetadata.version }`,
            integrity:       lockMetadata.integrity,
            packageName,
            packagePath,
            relationship:    directDependencyNames.has ( packageName ) &&
                packagePath === `node_modules/${ packageName }`
                ? "direct"
                : "transitive",
            version: lockMetadata.version,
        } );
    }

    // Return the to sorted result.

    return packages.toSorted ( ( left, right ) =>
        compareText ( left.identifier, right.identifier ) || compareText ( left.packagePath, right.packagePath ) );
}

//--------------------------------------------------------------------------------------------------
// Function: buildNotice
//
// Description:
//
//   Builds notice.
//
// Parameters:
//
//   - packages:
//     The packages supplied to the operation.
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

function buildNotice ( packages )
{
    // Initialize the deterministic closure summary.

    const directCount = packages.filter ( packageEntry => packageEntry.relationship === "direct" ).length;
    const closureFingerprint = sha256 ( packages.map ( packageEntry =>
        `${ packageEntry.packagePath }\t${ packageEntry.version }\t${ packageEntry.declaredLicense }\t` +
            `${ packageEntry.integrity }\n` ).join ( "" ) );
    const lines = [
        "Third-Party Documentation Dependency Inventory",
        "==============================================",
        "",
        "Generated mechanically by scripts/audit-documentation-dependencies.mjs from package-lock.json. This",
        "inventory records the complete locked VitePress build closure, declared SPDX license metadata, and npm",
        "integrity digests. Do not edit it by hand; run `npm run audit:dependencies:write`, then review it.",
        "",
        `Documentation closure package count: ${ packages.length } (${ directCount } direct, ` +
            `${ packages.length - directCount } transitive).`,
        `Documentation closure fingerprint (SHA-256): ${ closureFingerprint }`,
        "",
        `The packages below are development-time documentation build tools. The generated static site ships`,
        `their emitted browser code but no Node development server or node_modules tree. Package source archives`,
        `and their complete legal files remain available through the exact registry versions and integrity`,
        `digests recorded here. This inventory is a factual build record, not legal advice.`,
        "",
        "| Package | Version | Closure relationship | Declared license | npm integrity |",
        "|---|---:|---|---|---|",
        ...packages.map ( packageEntry =>
            `| ${ packageEntry.packageName } | ${ packageEntry.version } | ${ packageEntry.relationship } | ` +
                `${ packageEntry.declaredLicense } | ${ packageEntry.integrity } |` ),
    ];

    // Return the normalized notice.

    return normalizeText ( lines.join ( "\n" ) );
}

const argumentsList = process.argv.slice ( 2 );

assert (
    argumentsList.length === 0 || ( argumentsList.length === 1 && argumentsList [ 0 ] === WRITE_ARGUMENT ),
    `Usage: node scripts/audit-documentation-dependencies.mjs [${ WRITE_ARGUMENT }]`,
);

const packages = await auditedPackages ();

const expectedNotice = buildNotice ( packages );

if ( argumentsList [ 0 ] === WRITE_ARGUMENT )
{
    await writeFile ( noticePath, expectedNotice, "utf8" );
    console.log (
        `Wrote ${ packages.length } documentation packages to public/notices/third-party-documentation.txt.`,
    );
}
else
{
    const committedNotice = normalizeText ( await readFile ( noticePath, "utf8" ) );

    assert (
        committedNotice === expectedNotice,
        "public/notices/third-party-documentation.txt drifted from package-lock.json. " +
            "Run `npm run audit:dependencies:write`, review the result, and commit it.",
    );
    console.log (
        `Verified ${ packages.length } locked documentation dependencies and their license metadata.`,
    );
}
