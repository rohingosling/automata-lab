// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Development Server Orchestrator
// Version: 1.0.0
// Date:    2026-08-26
// Author:  Rohin Gosling
//
// Description:
//
//   Starts the loopback-only application development server and hardened documentation preview as
//   one lifecycle. Vite proxies the documentation subpath to VitePress so Help uses the production
//   URL shape without exposing the documentation source through its development server.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY                      = dirname ( fileURLToPath ( import.meta.url ) );
const APPLICATION_DIRECTORY                 = resolve ( SCRIPT_DIRECTORY, ".." );
const DOCUMENTATION_DIRECTORY               = resolve ( APPLICATION_DIRECTORY, "../documentation" );
const DEFAULT_APPLICATION_DEVELOPMENT_PORT   = 5_173;
const DEFAULT_DOCUMENTATION_DEVELOPMENT_PORT = 5_174;

//--------------------------------------------------------------------------------------------------
// Function: normalizeDevelopmentPort
//
// Description:
//
//   Normalizes one development-server port from the environment.
//
// Parameters:
//
//   - value:
//     The optional environment value supplied to the operation.
//
//   - fallback:
//     The fallback port supplied to the operation.
//
// Returns:
//
//   The selected TCP port.
//
// Preconditions:
//
//   - The supplied fallback is a valid TCP port.
//
// Postconditions:
//
//   - Invalid environment values are rejected before either server starts.
//
//--------------------------------------------------------------------------------------------------

function normalizeDevelopmentPort ( value, fallback )
{
    // Initialize the local value needed by this operation.

    const port = value === undefined ? fallback : Number ( value );

    // Reject an invalid port rather than silently selecting another endpoint.

    if ( !Number.isSafeInteger ( port ) || port < 1 || port > 65_535 )
    {
        throw new Error ( `Invalid development-server port '${ value ?? "" }'.` );
    }

    // Return the validated port.

    return port;
}

//--------------------------------------------------------------------------------------------------
// Function: startServer
//
// Description:
//
//   Starts one Node-based development server.
//
// Parameters:
//
//   - name:
//     The diagnostic server name supplied to the operation.
//
//   - entryPath:
//     The absolute Node entry path supplied to the operation.
//
//   - argumentsList:
//     The command arguments supplied to the operation.
//
//   - workingDirectory:
//     The working directory supplied to the operation.
//
// Returns:
//
//   The started child process.
//
// Preconditions:
//
//   - The package-local dependency installation exists.
//
// Postconditions:
//
//   - The child shares the parent terminal and never opens a separate window.
//
//--------------------------------------------------------------------------------------------------

function startServer ( name, entryPath, argumentsList, workingDirectory )
{
    // Start the server without a shell so signals target the actual Node process.

    const server = spawn (
        process.execPath,
        [ entryPath, ...argumentsList ],
        {
            cwd:         workingDirectory,
            env:         process.env,
            stdio:       "inherit",
            windowsHide: true,
        },
    );

    server.once ( "error", error =>
    {
        console.error ( `${ name } development server failed to start: ${ error.message }` );
    } );

    // Return the started server.

    return server;
}

//--------------------------------------------------------------------------------------------------
// Function: waitForExit
//
// Description:
//
//   Waits for one child process to finish.
//
// Parameters:
//
//   - server:
//     The child process supplied to the operation.
//
// Returns:
//
//   A promise that resolves after the process exits.
//
// Preconditions:
//
//   - The supplied process was started by this orchestrator.
//
// Postconditions:
//
//   - An already-exited process resolves immediately.
//
//--------------------------------------------------------------------------------------------------

function waitForExit ( server )
{
    // Return immediately when the server has already stopped.

    if ( server.exitCode !== null || server.signalCode !== null )
    {
        return Promise.resolve ();
    }

    // Return a promise for the remaining process lifetime.

    return new Promise ( resolveExit => server.once ( "exit", resolveExit ) );
}

const applicationDevelopmentPort = normalizeDevelopmentPort (
    process.env [ "AUTOMATA_APPLICATION_DEV_PORT" ],
    DEFAULT_APPLICATION_DEVELOPMENT_PORT,
);
const documentationDevelopmentPort = normalizeDevelopmentPort (
    process.env [ "AUTOMATA_DOCUMENTATION_DEV_PORT" ],
    DEFAULT_DOCUMENTATION_DEVELOPMENT_PORT,
);
const documentationServer = startServer (
    "Documentation preview",
    join ( DOCUMENTATION_DIRECTORY, "node_modules", "vitepress", "bin", "vitepress.js" ),
    [
        "preview",
        ".",
        "--host",
        "127.0.0.1",
        "--port",
        String ( documentationDevelopmentPort ),
        "--strictPort",
    ],
    DOCUMENTATION_DIRECTORY,
);
const applicationServer = startServer (
    "Application",
    join ( APPLICATION_DIRECTORY, "node_modules", "vite", "bin", "vite.js" ),
    [
        "--host",
        "127.0.0.1",
        "--port",
        String ( applicationDevelopmentPort ),
        "--strictPort",
    ],
    APPLICATION_DIRECTORY,
);
const servers = [ applicationServer, documentationServer ];

let finishRequested = false;

const requestedExitCode = await new Promise ( resolveExitCode =>
{
    // Resolve the shared lifecycle when either server exits unexpectedly.

    for ( const server of servers )
    {
        server.once ( "error", () =>
        {
            if ( !finishRequested )
            {
                finishRequested = true;
                resolveExitCode ( 1 );
            }
        } );
        server.once ( "exit", ( exitCode, signal ) =>
        {
            if ( !finishRequested )
            {
                finishRequested = true;
                resolveExitCode ( signal === "SIGINT" || signal === "SIGTERM" ? 0 : ( exitCode ?? 1 ) );
            }
        } );
    }

    // Convert terminal shutdown into one orderly shared-server stop.

    for ( const signal of [ "SIGINT", "SIGTERM" ] )
    {
        process.once ( signal, () =>
        {
            if ( !finishRequested )
            {
                finishRequested = true;
                resolveExitCode ( 0 );
            }
        } );
    }
} );

// Stop every remaining server and wait for its process to finish.

for ( const server of servers )
{
    if ( server.exitCode === null && server.signalCode === null )
    {
        server.kill ( "SIGTERM" );
    }
}

await Promise.all ( servers.map ( waitForExit ) );

process.exitCode = requestedExitCode;
