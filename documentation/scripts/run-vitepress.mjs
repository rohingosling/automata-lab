// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    VitePress Launcher
// Version: 1.0.0
// Date:    2026-08-26
// Author:  Rohin Gosling
//
// Description:
//
//   Starts VitePress from the documentation package's canonical filesystem path so Windows mapped
//   drives and subst aliases cannot split source discovery and relative-link validation across two
//   equivalent path spellings.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { spawn } from "node:child_process";
import { realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY        = dirname ( fileURLToPath ( import.meta.url ) );
const DOCUMENTATION_DIRECTORY = realpathSync.native ( resolve ( SCRIPT_DIRECTORY, ".." ) );
const VITEPRESS_ENTRY_PATH    = join (
    DOCUMENTATION_DIRECTORY,
    "node_modules",
    "vitepress",
    "bin",
    "vitepress.js",
);
const argumentsList = process.argv.slice ( 2 );

// Reject an empty invocation because VitePress would otherwise enter an unintended command mode.

if ( argumentsList.length === 0 )
{
    throw new Error ( "A VitePress command is required." );
}

// Start VitePress without a shell and from one canonical source-root identity.

const vitePressProcess = spawn (
    process.execPath,
    [ VITEPRESS_ENTRY_PATH, ...argumentsList ],
    {
        cwd:         DOCUMENTATION_DIRECTORY,
        env:         process.env,
        stdio:       "inherit",
        windowsHide: true,
    },
);

// Wait for VitePress to finish and preserve its command result.

const exitCode = await new Promise ( ( resolveExitCode, rejectStart ) =>
{
    vitePressProcess.once ( "error", rejectStart );
    vitePressProcess.once ( "exit", ( processExitCode, signal ) =>
    {
        resolveExitCode ( signal === null ? ( processExitCode ?? 1 ) : 1 );
    } );
} );

process.exitCode = exitCode;
