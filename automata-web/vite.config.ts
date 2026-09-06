// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Vite Configuration
// Version: 1.0.0
// Date:    2026-08-06
// Author:  Rohin Gosling
//
// Description:
//
//   Configures deterministic, source-map-free static builds beneath the Automata Lab GitHub Pages
//   subpath.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import react from "@vitejs/plugin-react";
import { realpathSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import type { Plugin } from "vite";

const DEFAULT_BASE_PATH                      = "/automata-lab/";
const DEFAULT_APPLICATION_DEVELOPMENT_PORT   = 5_173;
const DEFAULT_DOCUMENTATION_DEVELOPMENT_PORT = 5_174;
const packageDirectory                       = dirname ( fileURLToPath ( import.meta.url ) );
const fluentIconDirectory                    = resolve ( packageDirectory, "../assets/images/icons/fluent" );

// Development file-serving roots.
//
// Vite resolves module identifiers through `fs.realpathSync.native`, which on Windows rewrites a
// `subst` drive to the volume behind it while the configured root keeps whichever drive letter the
// dev server was launched from. Vite compensates for `net use` network mappings by parsing that
// command's output, but a `subst` alias never appears there, so every Web Worker module resolves to
// a path outside its own root, fails the file-serving check, and is answered with the SPA fallback
// HTML. A worker then dies parsing HTML as JavaScript, which surfaces only as an unhelpful "worker
// crashed" message.
//
// Serving both spellings of the project root keeps development working from either path. The
// project root rather than the package directory is required in any case, because the Server Worker
// imports the bundled example document and the icon plugin reads the curated Fluent assets, and
// both live beside the package rather than inside it.

//--------------------------------------------------------------------------------------------------
// Function: nativeRealPath
//
// Description:
//
//   Derives the native real path.
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

function nativeRealPath ( directory: string ): string
{
    // Run the operation that may report a recoverable failure.

    try
    {
        // Return the native result.

        return realpathSync.native ( directory );
    }
    catch
    {
        // Recover from the reported failure without hiding its outcome.

        return directory;
    }
}

const projectDirectory        = resolve ( packageDirectory, ".." );
const projectRealDirectory    = nativeRealPath ( projectDirectory );
const developmentServingRoots = projectRealDirectory === projectDirectory
    ? [ projectDirectory ]
    : [ projectDirectory, projectRealDirectory ];

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

function normalizeBasePath ( basePath: string | undefined ): string
{
    // Initialize the local values needed by this operation.

    const value            = basePath?.trim () || DEFAULT_BASE_PATH;
    const withLeadingSlash = value.startsWith ( "/" ) ? value : `/${value}`;

    // Return the result selected by the current condition.

    return withLeadingSlash.endsWith ( "/" ) ? withLeadingSlash : `${withLeadingSlash}/`;
}


//--------------------------------------------------------------------------------------------------
// Function: normalizeDevelopmentPort
//
// Description:
//
//   Normalizes one loopback development-server port.
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
//   - Invalid environment values are rejected before a server starts.
//
//--------------------------------------------------------------------------------------------------

function normalizeDevelopmentPort ( value: string | undefined, fallback: number ): number
{
    // Initialize the local value needed by this operation.

    const port = value === undefined ? fallback : Number ( value );

    // Reject an invalid port rather than silently selecting another server endpoint.

    if ( !Number.isSafeInteger ( port ) || port < 1 || port > 65_535 )
    {
        throw new Error ( `Invalid development-server port '${ value ?? "" }'.` );
    }

    // Return the validated port.

    return port;
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

async function readFluentIconNames (): Promise<readonly string[]>
{
    // Initialize the local values needed by this operation.

    const entries   = await readdir ( fluentIconDirectory, { withFileTypes: true } );
    const iconNames = entries
        .filter ( entry => entry.isFile () && entry.name.endsWith ( ".svg" ) )
        .map ( entry => entry.name )
        .toSorted ( ( left, right ) => left.localeCompare ( right, "en" ) );

    // Handle the case where icon names length matches 0.

    if ( iconNames.length === 0 )
    {
        throw new Error ( `No curated Fluent icons were found in ${ fluentIconDirectory }.` );
    }

    // Return the icon names.

    return iconNames;
}

//--------------------------------------------------------------------------------------------------
// Function: fluentIconAssets
//
// Description:
//
//   Derives the fluent icon assets.
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

function fluentIconAssets (): Plugin
{
    // Initialize the local values needed by this operation.

    let basePath = DEFAULT_BASE_PATH;

    // Return the assembled result.

    return {
        name: "automata-lab-fluent-icon-assets",

        //------------------------------------------------------------------------------------------
        // Method: configResolved
        //
        // Description:
        //
        //   Handles the config resolved behavior.
        //
        // Parameters:
        //
        //   - configuration:
        //     The configuration supplied to the operation.
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
        //------------------------------------------------------------------------------------------

        configResolved ( configuration )
        {
            basePath = configuration.base;
        },

        //------------------------------------------------------------------------------------------
        // Method: configureServer
        //
        // Description:
        //
        //   Configures the server.
        //
        // Parameters:
        //
        //   - server:
        //     The server supplied to the operation.
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
        //------------------------------------------------------------------------------------------

        configureServer ( server )
        {
            server.middlewares.use ( ( request, response, next ) =>
            {
                // Initialize the local values needed by this operation.

                const requestPath    = new URL ( request.url ?? "/", "http://localhost" ).pathname;
                const iconPathPrefix = `${ basePath }icons/fluent/`;

                // Handle the case where the starts with result condition is not satisfied.

                if ( !requestPath.startsWith ( iconPathPrefix ) )
                {
                    next ();

                    // Return control to the caller.

                    return;
                }

                let iconName: string;

                // Run the operation that may report a recoverable failure.

                try
                {
                    iconName = decodeURIComponent ( requestPath.slice ( iconPathPrefix.length ) );
                }
                catch
                {
                    // Recover from the reported failure without hiding its outcome.

                    response.statusCode = 400;
                    response.end ( "Invalid Fluent icon path." );

                    // Return control to the caller.

                    return;
                }

                // Handle the case where at least one branch condition is satisfied.

                if ( iconName !== basename ( iconName ) || !iconName.endsWith ( ".svg" ) )
                {
                    response.statusCode = 404;
                    response.end ( "Fluent icon not found." );

                    // Return control to the caller.

                    return;
                }

                readFile ( join ( fluentIconDirectory, iconName ) )
                    .then ( content =>
                    {
                        response.statusCode = 200;
                        response.setHeader ( "Content-Type", "image/svg+xml; charset=utf-8" );
                        response.end ( content );
                    } )
                    .catch ( () =>
                    {
                        response.statusCode = 404;
                        response.end ( "Fluent icon not found." );
                    } );
            } );
        },

        //------------------------------------------------------------------------------------------
        // Method: buildStart
        //
        // Description:
        //
        //   Builds start.
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
        //------------------------------------------------------------------------------------------

        async buildStart ()
        {
            // Initialize the local values needed by this operation.

            const iconNames = await readFluentIconNames ();

            // Process each icon name from the icon names collection in order.

            for ( const iconName of iconNames )
            {
                this.addWatchFile ( join ( fluentIconDirectory, iconName ) );
            }
        },

        //------------------------------------------------------------------------------------------
        // Method: generateBundle
        //
        // Description:
        //
        //   Generates the bundle.
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
        //------------------------------------------------------------------------------------------

        async generateBundle ()
        {
            // Initialize the local values needed by this operation.

            const iconNames = await readFluentIconNames ();

            // Process each icon name from the icon names collection in order.

            for ( const iconName of iconNames )
            {
                this.emitFile (
                    {
                        fileName: `icons/fluent/${ iconName }`,
                        source: await readFile ( join ( fluentIconDirectory, iconName ) ),
                        type: "asset",
                    }
                );
            }
        },
    };
}

const applicationBasePath          = normalizeBasePath ( process.env [ "AUTOMATA_BASE_PATH" ] );
const applicationDevelopmentPort   = normalizeDevelopmentPort (
    process.env [ "AUTOMATA_APPLICATION_DEV_PORT" ],
    DEFAULT_APPLICATION_DEVELOPMENT_PORT,
);
const documentationDevelopmentPort = normalizeDevelopmentPort (
    process.env [ "AUTOMATA_DOCUMENTATION_DEV_PORT" ],
    DEFAULT_DOCUMENTATION_DEVELOPMENT_PORT,
);

export default defineConfig (
    {
        base: applicationBasePath,
        define:
        {
            __AUTOMATA_CHART_ROUTING_PERFORMANCE_DIAGNOSTICS_ENABLED__: "false",
        },
        build:
        {
            assetsDir: "assets",
            emptyOutDir: true,
            sourcemap: false,
            target: "es2024",
        },
        plugins: [ react (), fluentIconAssets () ],
        preview:
        {
            proxy: {},
        },
        server:
        {
            host:       "127.0.0.1",
            port:       applicationDevelopmentPort,
            strictPort: true,
            proxy:
            {
                [ `${ applicationBasePath }docs` ]:
                {
                    target: `http://127.0.0.1:${ documentationDevelopmentPort }`,
                    ws:     true,
                },
            },
            fs:
            {
                allow: developmentServingRoots,
            },
        },
    }
);
