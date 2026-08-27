// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Fluent Icon Management
// Version: 1.0.0
// Date:    2026-08-12
// Author:  Rohin Gosling
//
// Description:
//
//   Imports the project-owned Fluent icon subset from an external master collection and verifies
//   the committed subset without making normal development, verification, or publication depend on
//   that external collection.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, rename, rm } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory      = dirname ( fileURLToPath ( import.meta.url ) );
const packageDirectory     = dirname ( scriptDirectory );
const privateDirectory     = dirname ( packageDirectory );
const manifestPath         = join ( privateDirectory, "assets", "images", "icons", "fluent-icons.json" );
const curatedIconDirectory = join ( privateDirectory, "assets", "images", "icons", "fluent" );

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
// Function: parseArguments
//
// Description:
//
//   Parses arguments.
//
// Parameters:
//
//   - argumentsToParse:
//     The arguments to parse supplied to the operation.
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

function parseArguments ( argumentsToParse )
{
    // Initialize the local values needed by this operation.

    const [ command, ...options ] = argumentsToParse;
    let sourceDirectory = process.env.AUTOMATA_FLUENT_ICON_SOURCE;

    // Repeat the operation across the bounded iteration range.

    for ( let i = 0; i < options.length; i += 1 )
    {
        // Initialize the local values needed by this operation.

        const option = options [ i ];

        // Handle the case where option matches "--source".

        if ( option === "--source" )
        {
            // Calculate the value value from the current inputs.

            const value = options [ i + 1 ];

            assert ( value !== undefined && value.length > 0, "--source requires a directory path." );
            sourceDirectory = value;
            i += 1;
            continue;
        }

        throw new Error ( `Unknown option: ${ option }` );
    }

    assert ( command === "check" || command === "import", "Usage: manage-fluent-icons.mjs <check|import> [--source <directory>]" );

    // Handle the case where command matches "import".

    if ( command === "import" )
    {
        assert ( sourceDirectory !== undefined && sourceDirectory.trim ().length > 0, "Import requires --source or AUTOMATA_FLUENT_ICON_SOURCE." );
    }

    // Return the assembled result.

    return { command, sourceDirectory };
}

//--------------------------------------------------------------------------------------------------
// Function: validateRelativePath
//
// Description:
//
//   Validates relative path.
//
// Parameters:
//
//   - path:
//     The path supplied to the operation.
//
//   - label:
//     The label supplied to the operation.
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

function validateRelativePath ( path, label )
{
    // Initialize the local values needed by this operation.

    const normalizedPath = normalize ( path );

    assert ( path.length > 0, `${ label } must not be empty.` );
    assert ( !isAbsolute ( path ), `${ label } must be relative.` );
    assert ( normalizedPath !== ".." && !normalizedPath.startsWith ( `..${ sep }` ), `${ label } must stay within its root.` );

    // Return the normalized path.

    return normalizedPath;
}

//--------------------------------------------------------------------------------------------------
// Function: validateManifest
//
// Description:
//
//   Validates manifest.
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

function validateManifest ( value )
{
    assert ( typeof value === "object" && value !== null && !Array.isArray ( value ), "The Fluent icon manifest must be an object." );
    assert ( value.schema_version === 1, "The Fluent icon manifest schema_version must be 1." );
    assert ( value.source === "Microsoft Fluent UI System Icons", "The Fluent icon manifest source is invalid." );
    assert ( Array.isArray ( value.icons ) && value.icons.length > 0, "The Fluent icon manifest must select at least one icon." );

    // Initialize the local values needed by this operation.

    const sourcePaths      = new Set ();
    const destinationNames = new Set ();

    const icons = value.icons.map ( ( icon, index ) =>
    {
        assert ( typeof icon === "object" && icon !== null && !Array.isArray ( icon ), `Icon entry ${ index } must be an object.` );
        assert ( typeof icon.source === "string", `Icon entry ${ index } source must be a string.` );
        assert ( typeof icon.destination === "string", `Icon entry ${ index } destination must be a string.` );
        assert ( typeof icon.sha256 === "string" && /^[0-9a-f]{64}$/u.test ( icon.sha256 ), `Icon entry ${ index } sha256 must be lowercase hexadecimal.` );

        // Initialize the local values needed by this operation.

        const sourcePath      = validateRelativePath ( icon.source, `Icon entry ${ index } source` );
        const destinationName = validateRelativePath ( icon.destination, `Icon entry ${ index } destination` );

        assert ( destinationName === basename ( destinationName ), `Icon entry ${ index } destination must be one file name.` );
        assert ( destinationName.endsWith ( ".svg" ), `Icon entry ${ index } destination must be an SVG file.` );
        assert ( !sourcePaths.has ( sourcePath ), `Duplicate Fluent source path: ${ sourcePath }` );
        assert ( !destinationNames.has ( destinationName ), `Duplicate Fluent destination name: ${ destinationName }` );

        sourcePaths.add ( sourcePath );
        destinationNames.add ( destinationName );

        // Return the assembled result.

        return { destinationName, hash: icon.sha256, sourcePath };
    } );

    // Return the to sorted result.

    return icons.toSorted ( ( left, right ) => left.destinationName.localeCompare ( right.destinationName, "en" ) );
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

async function readManifest ()
{
    // Initialize the local values needed by this operation.

    const text = await readFile ( manifestPath, "utf8" );

    // Return the validate manifest result.

    return validateManifest ( JSON.parse ( text ) );
}

//--------------------------------------------------------------------------------------------------
// Function: calculateHash
//
// Description:
//
//   Calculates hash.
//
// Parameters:
//
//   - path:
//     The path supplied to the operation.
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

async function calculateHash ( path )
{
    // Initialize the local values needed by this operation.

    const content          = await readFile ( path, "utf8" );
    const canonicalContent = content.replace ( /\r\n?/gu, "\n" );

    // Return the digest result.

    return createHash ( "sha256" ).update ( canonicalContent, "utf8" ).digest ( "hex" );
}

//--------------------------------------------------------------------------------------------------
// Function: verifyFile
//
// Description:
//
//   Verifies the file.
//
// Parameters:
//
//   - path:
//     The path supplied to the operation.
//
//   - expectedHash:
//     The expected hash supplied to the operation.
//
//   - label:
//     The label supplied to the operation.
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

async function verifyFile ( path, expectedHash, label )
{
    // Initialize the local values needed by this operation.

    const actualHash = await calculateHash ( path );

    assert ( actualHash === expectedHash, `${ label } has SHA-256 ${ actualHash }; expected ${ expectedHash }.` );
}

//--------------------------------------------------------------------------------------------------
// Function: listFiles
//
// Description:
//
//   Derives the list files.
//
// Parameters:
//
//   - directory:
//     The directory supplied to the operation.
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

async function listFiles ( directory )
{
    // Initialize the local values needed by this operation.

    const entries = await readdir ( directory, { withFileTypes: true } );

    assert ( entries.every ( entry => entry.isFile () ), `Only files may exist in ${ directory }.` );

    // Return the to sorted result.

    return entries.map ( entry => entry.name ).toSorted ( ( left, right ) => left.localeCompare ( right, "en" ) );
}

//--------------------------------------------------------------------------------------------------
// Function: checkCuratedIcons
//
// Description:
//
//   Handles the check curated icons behavior.
//
// Parameters:
//
//   - icons:
//     The icons supplied to the operation.
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

async function checkCuratedIcons ( icons )
{
    // Initialize the local values needed by this operation.

    const expectedNames = icons.map ( icon => icon.destinationName );
    const actualNames   = await listFiles ( curatedIconDirectory );

    assert ( JSON.stringify ( actualNames ) === JSON.stringify ( expectedNames ), "The curated Fluent icon directory does not exactly match fluent-icons.json." );

    // Process each icon from the icons collection in order.

    for ( const icon of icons )
    {
        await verifyFile ( join ( curatedIconDirectory, icon.destinationName ), icon.hash, `Curated icon ${ icon.destinationName }` );
    }

    console.log ( `Verified ${ icons.length } curated Fluent icons.` );
}

//--------------------------------------------------------------------------------------------------
// Function: importCuratedIcons
//
// Description:
//
//   Handles the import curated icons behavior.
//
// Parameters:
//
//   - icons:
//     The icons supplied to the operation.
//
//   - sourceDirectoryArgument:
//     The source directory argument supplied to the operation.
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

async function importCuratedIcons ( icons, sourceDirectoryArgument )
{
    // Initialize the local values needed by this operation.

    const sourceDirectory            = resolve ( sourceDirectoryArgument );
    const destinationParentDirectory = dirname ( curatedIconDirectory );
    const temporaryDirectory         = join ( destinationParentDirectory, `.fluent-import-${ process.pid }` );

    // Process each icon from the icons collection in order.

    for ( const icon of icons )
    {
        // Initialize the local values needed by this operation.

        const sourcePath     = resolve ( sourceDirectory, icon.sourcePath );
        const pathFromSource = relative ( sourceDirectory, sourcePath );

        assert ( pathFromSource !== ".." && !pathFromSource.startsWith ( `..${ sep }` ) && !isAbsolute ( pathFromSource ), `Fluent source escapes the master directory: ${ icon.sourcePath }` );
        await verifyFile ( sourcePath, icon.hash, `Master icon ${ icon.sourcePath }` );
    }

    await rm ( temporaryDirectory, { force: true, recursive: true } );
    await mkdir ( temporaryDirectory, { recursive: true } );

    // Run the operation that may report a recoverable failure.

    try
    {
        // Process each icon from the icons collection in order.

        for ( const icon of icons )
        {
            await copyFile ( resolve ( sourceDirectory, icon.sourcePath ), join ( temporaryDirectory, icon.destinationName ) );
        }

        await rm ( curatedIconDirectory, { force: true, recursive: true } );
        await rename ( temporaryDirectory, curatedIconDirectory );
    }
    catch ( error )
    {
        // Recover from the reported failure without hiding its outcome.

        await rm ( temporaryDirectory, { force: true, recursive: true } );
        throw error;
    }

    await checkCuratedIcons ( icons );
    console.log ( `Imported the curated subset from ${ sourceDirectory }.` );
}

//--------------------------------------------------------------------------------------------------
// Function: main
//
// Description:
//
//   Runs the command-line workflow.
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

async function main ()
{
    // Initialize the local values needed by this operation.

    const { command, sourceDirectory } = parseArguments ( process.argv.slice ( 2 ) );
    const icons = await readManifest ();

    // Handle the case where command matches "check".

    if ( command === "check" )
    {
        await checkCuratedIcons ( icons );

        // Return control to the caller.

        return;
    }

    await importCuratedIcons ( icons, sourceDirectory );
}

main ().catch ( error =>
{
    console.error ( error instanceof Error ? error.message : String ( error ) );
    process.exitCode = 1;
} );
