// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Combined Pages Artifact Builder
// Version: 1.0.0
// Date:    2026-08-26
// Author:  Rohin Gosling
//
// Description:
//
//   Builds the verified application, records its exact files, adds the verified documentation
//   beneath docs/, and proves that documentation assembly changed no application file.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY        = dirname ( fileURLToPath ( import.meta.url ) );
const APPLICATION_DIRECTORY   = resolve ( SCRIPT_DIRECTORY, ".." );
const PRIVATE_DIRECTORY       = resolve ( APPLICATION_DIRECTORY, ".." );
const DOCUMENTATION_DIRECTORY = resolve ( PRIVATE_DIRECTORY, "documentation" );
const DISTRIBUTION_DIRECTORY  = resolve ( APPLICATION_DIRECTORY, "dist" );
const IS_WINDOWS             = process.platform === "win32";
const NPM_EXECUTABLE         = IS_WINDOWS ? ( process.env.ComSpec ?? "cmd.exe" ) : "npm";

function runCommand ( argumentsList, workingDirectory )
{
    const executableArguments = IS_WINDOWS
        ? [ "/d", "/s", "/c", "npm.cmd", ...argumentsList ]
        : argumentsList;
    const result = spawnSync ( NPM_EXECUTABLE, executableArguments, {
        cwd:      workingDirectory,
        encoding: "utf8",
        stdio:    "inherit",
    } );

    if ( result.error !== undefined )
    {
        throw result.error;
    }

    if ( result.status !== 0 )
    {
        throw new Error ( `npm ${ argumentsList.join ( " " ) } failed with exit code ${ result.status }.` );
    }
}

async function collectFileHashes ( directory, excludedTopLevelDirectory = undefined )
{
    const hashes = new Map ();

    async function visit ( currentDirectory )
    {
        const entries = await readdir ( currentDirectory, { withFileTypes: true } );

        for ( const entry of entries.toSorted ( ( left, right ) => left.name.localeCompare ( right.name, "en" ) ) )
        {
            const entryPath    = join ( currentDirectory, entry.name );
            const relativePath = relative ( directory, entryPath ).replaceAll ( "\\", "/" );

            if ( currentDirectory === directory && entry.name === excludedTopLevelDirectory )
            {
                continue;
            }

            if ( entry.isDirectory () )
            {
                await visit ( entryPath );
            }
            else if ( entry.isFile () )
            {
                const content = await readFile ( entryPath );

                hashes.set ( relativePath, createHash ( "sha256" ).update ( content ).digest ( "hex" ) );
            }
            else
            {
                throw new Error ( `Combined artifact entry '${ relativePath }' is not a regular file or directory.` );
            }
        }
    }

    await visit ( directory );

    return hashes;
}

function assertMapsEqual ( expected, actual )
{
    if ( expected.size !== actual.size )
    {
        throw new Error ( `Documentation assembly changed the application file count from ${ expected.size } to ${ actual.size }.` );
    }

    for ( const [ applicationPath, expectedHash ] of expected )
    {
        if ( actual.get ( applicationPath ) !== expectedHash )
        {
            throw new Error ( `Documentation assembly changed or omitted application file '${ applicationPath }'.` );
        }
    }
}

async function buildPagesArtifact ()
{
    runCommand ( [ "run", "build" ], APPLICATION_DIRECTORY );

    const applicationHashes = await collectFileHashes ( DISTRIBUTION_DIRECTORY );

    runCommand ( [ "run", "build:combined" ], DOCUMENTATION_DIRECTORY );
    runCommand ( [ "run", "test:combined" ], DOCUMENTATION_DIRECTORY );

    const assembledApplicationHashes = await collectFileHashes ( DISTRIBUTION_DIRECTORY, "docs" );
    const documentationHashes        = await collectFileHashes ( join ( DISTRIBUTION_DIRECTORY, "docs" ) );

    assertMapsEqual ( applicationHashes, assembledApplicationHashes );

    if ( documentationHashes.size === 0 )
    {
        throw new Error ( "The combined Pages artifact contains no documentation files." );
    }

    process.stdout.write (
        `Verified combined Pages artifact: ${ applicationHashes.size } application files and ` +
        `${ documentationHashes.size } documentation files.\n`,
    );
}

await buildPagesArtifact ();
