// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Documentation Artifact Hardening
// Version: 1.0.0
// Date:    2026-08-26
// Author:  Rohin Gosling
//
// Description:
//
//   Adds a page-specific hash-based Content Security Policy to every generated VitePress page.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY        = dirname ( fileURLToPath ( import.meta.url ) );
const DOCUMENTATION_DIRECTORY = resolve ( SCRIPT_DIRECTORY, ".." );
const OUTPUT_DIRECTORY        = process.argv [ 2 ] === undefined
    ? resolve ( DOCUMENTATION_DIRECTORY, ".vitepress/dist" )
    : resolve ( DOCUMENTATION_DIRECTORY, process.argv [ 2 ] );

const APPLICATION_BASE_PATH              = "/automata-lab/";
const APPLICATION_LINK_SENTINEL           = "https://application.automata-lab.invalid/";
const MISNORMALIZED_APPLICATION_LINK_PATH = "/automata-lab/docs/automata-lab/";

const INLINE_SCRIPT_PATTERN = /<script(?<attributes>[^>]*)>(?<content>[\s\S]*?)<\/script>/gu;

async function collectHtmlFiles ( directory )
{
    const entries   = await readdir ( directory, { withFileTypes: true } );
    const htmlFiles = [];

    for ( const entry of entries.toSorted ( ( left, right ) => left.name.localeCompare ( right.name, "en" ) ) )
    {
        const entryPath = join ( directory, entry.name );

        if ( entry.isDirectory () )
        {
            htmlFiles.push ( ...await collectHtmlFiles ( entryPath ) );
        }
        else if ( entry.isFile () && extname ( entryPath ) === ".html" )
        {
            htmlFiles.push ( entryPath );
        }
    }

    return htmlFiles;
}

async function normalizeArtifactApplicationLinks ( directory )
{
    const entries = await readdir ( directory, { withFileTypes: true } );

    for ( const entry of entries )
    {
        const entryPath = join ( directory, entry.name );

        if ( entry.isDirectory () )
        {
            await normalizeArtifactApplicationLinks ( entryPath );
        }
        else if ( entry.isFile () && [ ".html", ".js", ".json" ].includes ( extname ( entryPath ) ) )
        {
            const artifactContent = await readFile ( entryPath, "utf8" );

            if ( artifactContent.includes ( APPLICATION_LINK_SENTINEL ) )
            {
                await writeFile (
                    entryPath,
                    artifactContent.replaceAll ( APPLICATION_LINK_SENTINEL, APPLICATION_BASE_PATH ),
                    "utf8",
                );
            }
        }
    }
}
function contentSecurityPolicy ( htmlContent )
{
    const scriptHashes = Array.from ( htmlContent.matchAll ( INLINE_SCRIPT_PATTERN ) )
        .filter ( match => !/\bsrc\s*=/iu.test ( match.groups?.attributes ?? "" ) )
        .map ( match => createHash ( "sha256" )
            .update ( match.groups?.content ?? "", "utf8" )
            .digest ( "base64" ) )
        .map ( hash => `'sha256-${ hash }'` );

    if ( scriptHashes.length === 0 )
    {
        throw new Error ( "A generated documentation page contains no inline bootstrap scripts." );
    }

    return [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-src 'none'",
        `script-src 'self' ${ scriptHashes.join ( " " ) }`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "worker-src 'self' blob:",
        "media-src 'self'",
        "manifest-src 'self'",
        "form-action 'none'",
    ].join ( "; " );
}

async function hardenDocumentation ()
{
    await normalizeArtifactApplicationLinks ( OUTPUT_DIRECTORY );

    const htmlFiles = await collectHtmlFiles ( OUTPUT_DIRECTORY );

    if ( htmlFiles.length === 0 )
    {
        throw new Error ( `No generated documentation pages were found in ${ OUTPUT_DIRECTORY }.` );
    }

    for ( const htmlPath of htmlFiles )
    {
        const htmlContent = await readFile ( htmlPath, "utf8" );

        if ( /http-equiv="Content-Security-Policy"/iu.test ( htmlContent ) )
        {
            throw new Error ( `${ htmlPath } already contains a Content Security Policy.` );
        }

        const applicationLinkNormalizer = [
            "(()=>{",
            `const s='${ MISNORMALIZED_APPLICATION_LINK_PATH }',d='${ APPLICATION_BASE_PATH }';`,
            "const n=()=>document.querySelectorAll(`a[href=\"${s}\"]`).forEach(a=>a.setAttribute('href',d));",
            "new MutationObserver(n).observe(document.documentElement,{attributes:true,childList:true,subtree:true});",
            "window.addEventListener('DOMContentLoaded',n,{once:true});",
            "})();",
        ].join ( "" );
        const contentWithLandmark = htmlContent.includes ( 'id="VPContent"' )
            ? htmlContent.replace ( 'id="VPContent"', 'id="VPContent" role="main"' )
            : htmlContent.replace ( '<div id="app">', '<div id="app" role="main">' );
        const linkedHtmlContent = contentWithLandmark.replace (
            "</head>",
            `<script id="normalize-application-link">${ applicationLinkNormalizer }</script>\n</head>`,
        );
        const policy       = contentSecurityPolicy ( linkedHtmlContent );
        const hardenedHtml = linkedHtmlContent.replace (
            "<head>",
            `<head>\n    <meta http-equiv="Content-Security-Policy" content="${ policy }">`,
        );

        if ( !htmlContent.includes ( "<head>" ) || !htmlContent.includes ( "</head>" ) ||
            !linkedHtmlContent.includes ( 'role="main"' ) )
        {
            throw new Error ( `${ htmlPath } does not contain the expected VitePress page structure.` );
        }

        await writeFile ( htmlPath, hardenedHtml, "utf8" );
    }

    process.stdout.write ( `Hardened ${ htmlFiles.length } documentation pages with hash-based CSP.\n` );
}

await hardenDocumentation ();
