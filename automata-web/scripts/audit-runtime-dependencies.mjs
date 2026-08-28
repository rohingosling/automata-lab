// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Runtime Dependency Audit
// Version: 1.0.0
// Date:    2026-08-21
// Author:  Rohin Gosling
//
// Description:
//
//   Derives the installed production dependency closure from package-lock.json, assembles its
//   complete license-text inventory, and verifies that the committed runtime notice is exactly
//   current. The audit is fully offline.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory  = dirname ( fileURLToPath ( import.meta.url ) );
const packageDirectory = dirname ( scriptDirectory );
const packageLockPath  = join ( packageDirectory, "package-lock.json" );
const noticePath       = join ( packageDirectory, "public", "notices", "third-party-runtime.txt" );
const WRITE_ARGUMENT   = "--write";

const LICENSE_FILE_PATTERN = /^(?:licen[cs]e|copying|notice)(?:[._-].*)?$/iu;
const ELKJS_IDENTIFIER     = "elkjs@0.12.0";
const ELKJS_LICENSE        = "EPL-2.0 OR GPL-3.0-or-later";

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
// Function: productionClosurePaths
//
// Description:
//
//   Derives the production closure paths.
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

function productionClosurePaths ( lockfile )
{
    // Initialize the local values needed by this operation.

    const packages    = lockfile.packages;
    const rootPackage = packages?.[ "" ];

    assert ( lockfile.lockfileVersion === 3, "The runtime audit requires package-lock.json lockfileVersion 3." );
    assert ( packages !== null && typeof packages === "object", "package-lock.json has no packages map." );
    assert ( rootPackage !== null && typeof rootPackage === "object", "package-lock.json has no root package entry." );

    // Initialize the local values needed by this operation.

    const closurePaths = new Set ();
    const pendingPaths = Object.keys ( rootPackage.dependencies ?? {} )
        .toSorted ( compareText )
        .map ( dependencyName =>
        {
            // Initialize the local values needed by this operation.

            const dependencyPath = resolveDependencyPath ( packages, "", dependencyName );

            assert (
                dependencyPath !== null,
                `Root runtime dependency '${ dependencyName }' is absent from the lockfile.`,
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
        assert ( packageMetadata.dev !== true, `Runtime dependency '${ packagePath }' is marked development-only.` );
        assert ( packageMetadata.link !== true, `Runtime dependency '${ packagePath }' is an unsupported local link.` );
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
                assert ( !isRequired, `Runtime dependency '${ packagePath }' cannot resolve '${ dependencyName }'.` );
                continue;
            }

            const dependencyMetadata = packages [ dependencyPath ];

            // Reject packages marked as development-only from the production dependency closure.

            if ( dependencyMetadata.dev === true )
            {
                assert ( !isRequired, `Runtime dependency '${ dependencyPath }' is marked development-only.` );
                continue;
            }

            pendingPaths.push ( dependencyPath );
        }
    }

    // Initialize the local values needed by this operation.

    const lockfileProductionPaths = Object.entries ( packages )
        .filter ( ( [ packagePath, packageMetadata ] ) =>
            packagePath.length > 0 && packageMetadata.dev !== true && packageMetadata.link !== true )
        .map ( ( [ packagePath ] ) => packagePath )
        .toSorted ( compareText );
    const traversedPaths = [ ...closurePaths ].toSorted ( compareText );

    assert (
        JSON.stringify ( traversedPaths ) === JSON.stringify ( lockfileProductionPaths ),
        "The traversed runtime closure differs from the lockfile's production classification.",
    );

    // Return the traversed paths.

    return traversedPaths;
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
    const directDependencyNames = new Set ( Object.keys ( lockfile.packages [ "" ].dependencies ?? {} ) );
    const packages              = [];

    // Process each package path from the production closure paths result collection in order.

    for ( const packagePath of productionClosurePaths ( lockfile ) )
    {
        // Initialize the local values needed by this operation.

        const lockMetadata      = lockfile.packages [ packagePath ];
        const packageName       = packageNameFromLockPath ( packagePath );
        const packageJsonPath   = join ( packageDirectory, packagePath, "package.json" );
        const installedMetadata = JSON.parse ( await readFile ( packageJsonPath, "utf8" ) );
        const licenseFileNames  = ( await readdir ( join ( packageDirectory, packagePath ) ) )
            .filter ( fileName => LICENSE_FILE_PATTERN.test ( fileName ) )
            .toSorted ( compareText );

        assert ( typeof lockMetadata.version === "string", `Lockfile package '${ packagePath }' has no version.` );
        assert (
            typeof lockMetadata.license === "string",
            `Lockfile package '${ packagePath }' has no license field.`,
        );
        assert ( installedMetadata.name === packageName, `Installed package name drifted at '${ packagePath }'.` );
        assert (
            installedMetadata.version === lockMetadata.version,
            `Installed package version drifted at '${ packagePath }'.`,
        );
        assert (
            installedMetadata.license === lockMetadata.license,
            `Installed package license drifted at '${ packagePath }'.`,
        );
        assert (
            licenseFileNames.length === 1,
            `Runtime package '${ packageName }@${ lockMetadata.version }' must expose exactly one recognized ` +
                "license file.",
        );

        // Initialize the local values needed by this operation.

        const licenseFileName = licenseFileNames [ 0 ];
        const licenseText     = normalizeText (
            await readFile ( join ( packageDirectory, packagePath, licenseFileName ), "utf8" ),
        );

        packages.push ( {
            declaredLicense: lockMetadata.license,
            identifier:      `${ packageName }@${ lockMetadata.version }`,
            licenseFileName,
            licenseHash:     sha256 ( licenseText ),
            licenseText,
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
    // Initialize the local values needed by this operation.

    const directCount        = packages.filter ( packageEntry => packageEntry.relationship === "direct" ).length;
    const closureFingerprint = sha256 ( packages.map ( packageEntry =>
        `${ packageEntry.packagePath }\t${ packageEntry.version }\t${ packageEntry.declaredLicense }\t` +
            `${ packageEntry.licenseHash }\n` ).join ( "" ) );
    const licenseGroups      = [];
    const licenseGroupByHash = new Map ();

    // Process each package entry from the packages collection in order.

    for ( const packageEntry of packages )
    {
        // Initialize the local values needed by this operation.

        let licenseGroup = licenseGroupByHash.get ( packageEntry.licenseHash );

        // Handle the case where license group matches undefined.

        if ( licenseGroup === undefined )
        {
            licenseGroup = {
                hash:     packageEntry.licenseHash,
                packages: [],
                text:     packageEntry.licenseText,
            };
            licenseGroupByHash.set ( packageEntry.licenseHash, licenseGroup );
            licenseGroups.push ( licenseGroup );
        }

        licenseGroup.packages.push ( packageEntry );
    }

    // Initialize the local values needed by this operation.

    const licenseSectionIdentifiers = new Map (
        licenseGroups.flatMap ( ( licenseGroup, index ) => licenseGroup.packages.map ( packageEntry =>
            [ packageEntry.packagePath, `L${ String ( index + 1 ).padStart ( 3, "0" ) }` ] ) ),
    );
    const lines = [
        "Third-Party Runtime Notices",
        "===========================",
        "",
        "Generated mechanically by scripts/audit-runtime-dependencies.mjs from package-lock.json and the installed",
        "package license files. Do not edit this file by hand; run `npm run audit:runtime:write`, then review it.",
        "",
        `Production closure package count: ${ packages.length } (${ directCount } direct, ` +
            `${ packages.length - directCount } transitive).`,
        `Production closure fingerprint (SHA-256): ${ closureFingerprint }`,
        "",
        `elkjs 0.12.0 declares '${ ELKJS_LICENSE }'. Automata Lab distributes its included elkjs copy under the`,
        "EPL-2.0 option and reproduces the package's complete EPL-2.0 license file below. This is a factual record of",
        "the project's distribution choice, not legal advice.",
        "",
        "Runtime Inventory",
        "-----------------",
        "",
        "| Package | Version | Closure relationship | Declared license | License text |",
        "|---|---:|---|---|---|",
        ...packages.map ( packageEntry =>
            `| ${ packageEntry.packageName } | ${ packageEntry.version } | ${ packageEntry.relationship } | ` +
                `${ packageEntry.declaredLicense } | ` +
                `${ licenseSectionIdentifiers.get ( packageEntry.packagePath ) } |` ),
        "",
        "Complete License Texts",
        "----------------------",
        "",
    ];

    // Process each [ index, license group ] from the entries result collection in order.

    for ( const [ index, licenseGroup ] of licenseGroups.entries () )
    {
        // Initialize the local values needed by this operation.

        const sectionIdentifier  = `L${ String ( index + 1 ).padStart ( 3, "0" ) }`;
        const packageIdentifiers = licenseGroup.packages
            .map ( packageEntry => packageEntry.identifier )
            .join ( ", " );

        lines.push (
            `${ sectionIdentifier } — ${ packageIdentifiers }`,
            "=".repeat ( sectionIdentifier.length + 3 + packageIdentifiers.length ),
            `License-file SHA-256: ${ licenseGroup.hash }`,
            "",
            licenseGroup.text.trimEnd (),
            "",
        );
    }

    // Return the normalize text result.

    return normalizeText ( lines.join ( "\n" ) );
}

const argumentsList = process.argv.slice ( 2 );

assert (
    argumentsList.length === 0 || ( argumentsList.length === 1 && argumentsList [ 0 ] === WRITE_ARGUMENT ),
    `Usage: node scripts/audit-runtime-dependencies.mjs [${ WRITE_ARGUMENT }]`,
);

const packages     = await auditedPackages ();
const elkjsPackage = packages.find ( packageEntry => packageEntry.identifier === ELKJS_IDENTIFIER );

assert ( elkjsPackage !== undefined, `${ ELKJS_IDENTIFIER } is absent from the production closure.` );
assert ( elkjsPackage.declaredLicense === ELKJS_LICENSE, `${ ELKJS_IDENTIFIER } changed its declared license.` );

const expectedNotice = buildNotice ( packages );

if ( argumentsList [ 0 ] === WRITE_ARGUMENT )
{
    await writeFile ( noticePath, expectedNotice, "utf8" );
    console.log ( `Wrote ${ packages.length } runtime packages to public/notices/third-party-runtime.txt.` );
}
else
{
    const committedNotice = normalizeText ( await readFile ( noticePath, "utf8" ) );

    assert (
        committedNotice === expectedNotice,
        "public/notices/third-party-runtime.txt drifted from package-lock.json or installed license text. " +
            "Run `npm run audit:runtime:write`, review the result, and commit it.",
    );
    console.log ( `Verified ${ packages.length } production runtime packages and their complete license texts.` );
}
