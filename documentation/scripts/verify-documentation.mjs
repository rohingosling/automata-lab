// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Documentation Artifact Verification
// Version: 1.0.0
// Date:    2026-08-25
// Author:  Rohin Gosling
//
// Description:
//
//   Verifies stable routes, links, fragments, local search, CSP, local runtime assets, and public
//   safety for both the standalone and combined documentation artifacts.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, extname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY        = dirname ( fileURLToPath ( import.meta.url ) );
const DOCUMENTATION_DIRECTORY = resolve ( SCRIPT_DIRECTORY, ".." );
const OUTPUT_DIRECTORY        = process.argv [ 2 ] === undefined
    ? resolve ( DOCUMENTATION_DIRECTORY, ".vitepress/dist" )
    : resolve ( DOCUMENTATION_DIRECTORY, process.argv [ 2 ] );
const APPLICATION_BASE_PATH   = "/automata-lab/";
const DOCUMENTATION_BASE_PATH = "/automata-lab/docs/";

const REQUIRED_OUTPUT_PATHS =
[
    "notices/third-party-documentation.txt",
    "index.html",
    "user-guide/index.html",
    "user-guide/getting-started.html",
    "user-guide/state-machine-concepts.html",
    "user-guide/application-shell.html",
    "user-guide/editor.html",
    "user-guide/state-chart.html",
    "user-guide/solver.html",
    "user-guide/server-and-revisions.html",
    "user-guide/simulator.html",
    "user-guide/files-and-data-exchange.html",
    "user-guide/printing-and-export.html",
    "user-guide/application-settings.html",
    "user-guide/accessibility.html",
    "user-guide/console-and-diagnostics.html",
    "user-guide/troubleshooting.html",
    "user-guide/limits-privacy-and-security.html",
    "user-guide/user-reference.html",
    "developer-guide/index.html",
    "developer-guide/development-setup.html",
    "developer-guide/public-repository-structure.html",
    "developer-guide/architecture.html",
    "developer-guide/document-and-domain-model.html",
    "developer-guide/file-and-data-contracts.html",
    "developer-guide/command-architecture.html",
    "developer-guide/state-chart-architecture.html",
    "developer-guide/solver-architecture.html",
    "developer-guide/server-and-simulator-architecture.html",
    "developer-guide/presentation-architecture.html",
    "developer-guide/configuration-and-preferences.html",
    "developer-guide/printing-architecture.html",
    "developer-guide/testing.html",
    "developer-guide/security-and-privacy.html",
    "developer-guide/building-and-deployment.html",
    "developer-guide/writing-the-documentation.html",
    "developer-guide/contributing.html",
    "developer-guide/developer-reference.html",
    "developer-guide/licenses-and-acknowledgements.html",
];

const FORBIDDEN_TEXT_PATTERNS =
[
    { description: "a Windows drive path", pattern: /\b[A-Z]:\\/u },
    { description: "a POSIX user path", pattern: /\/(?:Users|home)\/[^/\s]+/u },
    { description: "private design-source paths", pattern: /\bprivate[\\/]docs[\\/]/iu },
    { description: "agent guidance", pattern: /\b(?:AGENTS|CLAUDE)\.md\b/iu },
    { description: "source maps", pattern: /sourceMappingURL=/u },
    { description: "a PEM block", pattern: /-----BEGIN [A-Z0-9][A-Z0-9 ]*-----/u },
    { description: "the build-only application-link sentinel", pattern: /application\.automata-lab\.invalid/iu },
];

const REQUIRED_CONTENT_SECURITY_POLICY_DIRECTIVES =
[
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "media-src 'self'",
    "manifest-src 'self'",
    "form-action 'none'",
];

const INLINE_SCRIPT_PATTERN = /<script(?<attributes>[^>]*)>(?<content>[\s\S]*?)<\/script>/gu;

async function collectFiles ( directory )
{
    const entries = await readdir ( directory, { withFileTypes: true } );
    const files   = [];

    for ( const entry of entries.toSorted ( ( left, right ) => left.name.localeCompare ( right.name, "en" ) ) )
    {
        const entryPath = join ( directory, entry.name );

        if ( entry.isDirectory () )
        {
            files.push ( ...await collectFiles ( entryPath ) );
        }
        else if ( entry.isFile () )
        {
            files.push ( entryPath );
        }
        else
        {
            throw new Error ( `Documentation artifact entry is not a regular file or directory: ${ entryPath }.` );
        }
    }

    return files;
}

function assertIncludes ( content, expectedText, artifactPath )
{
    if ( !content.includes ( expectedText ) )
    {
        throw new Error ( `${ artifactPath } does not contain '${ expectedText }'.` );
    }
}

function routeOutputPath ( routePath )
{
    const normalizedPath = posix.normalize ( routePath ).replace ( /^\.\//u, "" );

    if ( normalizedPath === "." || normalizedPath === "" )
    {
        return "index.html";
    }

    if ( normalizedPath.endsWith ( "/" ) )
    {
        return `${ normalizedPath }index.html`;
    }

    return posix.extname ( normalizedPath ) === "" ? `${ normalizedPath }.html` : normalizedPath;
}

function resolveDocumentationReference ( artifactPath, reference )
{
    if ( reference.startsWith ( "#" ) )
    {
        return { fragment: reference.slice ( 1 ), outputPath: artifactPath };
    }

    if ( /^(?:https?:|mailto:)/iu.test ( reference ) )
    {
        return null;
    }

    if ( /^[A-Za-z][A-Za-z0-9+.-]*:/u.test ( reference ) || reference.startsWith ( "//" ) )
    {
        throw new Error ( `${ artifactPath } contains unsupported link target '${ reference }'.` );
    }

    const [ pathAndQuery, fragment = "" ] = reference.split ( "#", 2 );
    const pathOnly                        = pathAndQuery.split ( "?", 1 ) [ 0 ];

    if ( pathOnly === APPLICATION_BASE_PATH )
    {
        return null;
    }

    let routePath;

    if ( pathOnly.startsWith ( DOCUMENTATION_BASE_PATH ) )
    {
        routePath = pathOnly.slice ( DOCUMENTATION_BASE_PATH.length );
    }
    else if ( pathOnly.startsWith ( "/" ) )
    {
        throw new Error ( `${ artifactPath } escapes the application/documentation base: '${ reference }'.` );
    }
    else
    {
        routePath = posix.join ( posix.dirname ( artifactPath ), pathOnly );
    }

    return { fragment: decodeURIComponent ( fragment ), outputPath: routeOutputPath ( routePath ) };
}

function verifyContentSecurityPolicy ( artifactPath, htmlContent )
{
    const policyMatch = htmlContent.match (
        /<meta http-equiv="Content-Security-Policy" content="(?<policy>[^"]+)">/u,
    );

    if ( policyMatch?.groups?.policy === undefined )
    {
        throw new Error ( `${ artifactPath } has no Content Security Policy.` );
    }

    const policy          = policyMatch.groups.policy;
    const scriptDirective = policy.split ( ";" )
        .map ( directive => directive.trim () )
        .find ( directive => directive.startsWith ( "script-src " ) );

    for ( const requiredDirective of REQUIRED_CONTENT_SECURITY_POLICY_DIRECTIVES )
    {
        assertIncludes ( policy, requiredDirective, artifactPath );
    }

    if ( scriptDirective === undefined || scriptDirective.includes ( "'unsafe-inline'" ) ||
        scriptDirective.includes ( "'unsafe-eval'" ) )
    {
        throw new Error ( `${ artifactPath } does not use a strict script-src policy.` );
    }

    for ( const match of htmlContent.matchAll ( INLINE_SCRIPT_PATTERN ) )
    {
        if ( /\bsrc\s*=/iu.test ( match.groups?.attributes ?? "" ) )
        {
            continue;
        }

        const hash = createHash ( "sha256" )
            .update ( match.groups?.content ?? "", "utf8" )
            .digest ( "base64" );

        assertIncludes ( scriptDirective, `'sha256-${ hash }'`, artifactPath );
    }
}

function verifyHtmlReferences ( artifactPath, htmlContent, outputPathSet, htmlContentByPath )
{
    const referencePattern = /<a\b[^>]*\bhref="(?<reference>[^"]+)"/gu;

    for ( const match of htmlContent.matchAll ( referencePattern ) )
    {
        const resolvedReference = resolveDocumentationReference ( artifactPath, match.groups?.reference ?? "" );

        if ( resolvedReference === null )
        {
            continue;
        }

        if ( !outputPathSet.has ( resolvedReference.outputPath ) )
        {
            throw new Error (
                `${ artifactPath } links to missing artifact '${ resolvedReference.outputPath }'.`,
            );
        }

        if ( resolvedReference.fragment !== "" )
        {
            const targetContent = htmlContentByPath.get ( resolvedReference.outputPath ) ?? "";
            const expectedId    = `id="${ resolvedReference.fragment.replaceAll ( "&", "&amp;" ) }"`;

            assertIncludes ( targetContent, expectedId, `${ artifactPath } link target` );
        }
    }

    const runtimeAssetPattern = /<(?:script|link)\b[^>]*\b(?:src|href)="(?<reference>[^"]+)"/gu;

    for ( const match of htmlContent.matchAll ( runtimeAssetPattern ) )
    {
        const reference = match.groups?.reference ?? "";

        if ( !reference.startsWith ( DOCUMENTATION_BASE_PATH ) )
        {
            throw new Error ( `${ artifactPath } loads a non-local runtime asset '${ reference }'.` );
        }
    }
}

async function verifyDocumentation ()
{
    const outputFiles         = await collectFiles ( OUTPUT_DIRECTORY );
    const relativeOutputPaths = outputFiles.map (
        outputPath => relative ( OUTPUT_DIRECTORY, outputPath ).replaceAll ( "\\", "/" ),
    );
    const outputPathSet       = new Set ( relativeOutputPaths );
    const htmlContentByPath   = new Map ();

    for ( const requiredOutputPath of REQUIRED_OUTPUT_PATHS )
    {
        if ( !outputPathSet.has ( requiredOutputPath ) )
        {
            throw new Error ( `Required documentation route output is missing: ${ requiredOutputPath }.` );
        }
    }

    for ( const outputPath of outputFiles.filter ( filePath => extname ( filePath ) === ".html" ) )
    {
        htmlContentByPath.set (
            relative ( OUTPUT_DIRECTORY, outputPath ).replaceAll ( "\\", "/" ),
            await readFile ( outputPath, "utf8" ),
        );
    }

    const homeContent = htmlContentByPath.get ( "index.html" ) ?? "";

    assertIncludes ( homeContent, `${ DOCUMENTATION_BASE_PATH }user-guide/`, "index.html" );
    assertIncludes ( homeContent, `${ DOCUMENTATION_BASE_PATH }developer-guide/`, "index.html" );
    assertIncludes ( homeContent, APPLICATION_BASE_PATH, "index.html" );

    const javaScriptFiles = outputFiles.filter ( outputPath => extname ( outputPath ) === ".js" );
    const localSearchFile = javaScriptFiles.find (
        outputPath => relative ( OUTPUT_DIRECTORY, outputPath ).includes ( "localSearchIndex" ),
    );

    if ( localSearchFile === undefined )
    {
        throw new Error ( "The local-search JavaScript artifact is missing." );
    }

    for ( const [ artifactPath, htmlContent ] of htmlContentByPath )
    {
        verifyContentSecurityPolicy ( artifactPath, htmlContent );
        verifyHtmlReferences ( artifactPath, htmlContent, outputPathSet, htmlContentByPath );
    }

    for ( const outputPath of outputFiles )
    {
        if ( extname ( outputPath ) === ".map" )
        {
            throw new Error ( `Source map output is forbidden: ${ relative ( OUTPUT_DIRECTORY, outputPath ) }.` );
        }

        const extension = extname ( outputPath );

        if ( ![ ".css", ".html", ".js", ".json", ".svg", ".txt", ".xml" ].includes ( extension ) )
        {
            continue;
        }

        const artifactPath = relative ( OUTPUT_DIRECTORY, outputPath ).replaceAll ( "\\", "/" );
        const content      = await readFile ( outputPath, "utf8" );

        for ( const forbiddenText of FORBIDDEN_TEXT_PATTERNS )
        {
            if ( forbiddenText.pattern.test ( content ) )
            {
                throw new Error ( `Documentation artifact contains ${ forbiddenText.description }: ${ artifactPath }.` );
            }
        }
    }

    process.stdout.write ( `Verified ${ outputFiles.length } documentation artifact files.\n` );
}

await verifyDocumentation ();
