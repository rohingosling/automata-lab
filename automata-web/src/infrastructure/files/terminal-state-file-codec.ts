// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Terminal State File Codec
// Version: 1.0.0
// Date:    2026-09-16
// Author:  Rohin Gosling
//
// Description:
//
//   Validates and migrates files through the shared atomic notation preparation boundary.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { ErrorObject } from "ajv";
import type { DocumentCodecPort } from "../../application/ports/contracts.js";
import type
{
    TerminalStatePreparationPort,
    TerminalStatePreparationSummary,
} from "../../application/ports/terminal-state-preparation.js";
import type
{
    AuthoringDraft,
    AutomataDocument,
    FileDocumentV1,
    FileDocumentV1_4,
    JsonValue,
} from "../../domain/model/contracts.js";
import
{
    decodeFileDocumentV1,
    decodeTerminalStateFileDocument,
    encodeFileDocumentV1_4,
    serializeCanonicalHostedContent,
} from "../../domain/model/canonicalization.js";
import { DEFAULT_CHART_STATE_HEIGHT } from "../../domain/model/limits.js";
import { hasCoherentTerminalStateNotation } from "../../domain/model/terminal-states.js";
import
{
    validateAuthoringDraft,
    validatePersistableAuthoringDraft,
} from "../../domain/model/validation.js";
import type { DomainDiagnostic } from "../../domain/model/diagnostics.js";
import { openDocument } from "./file-codec.js";
import type { FileOpenResult } from "./file-codec.js";
import validateLegacyFile from "./generated/file-schema-v1-validator.js";
import validateModernFile from "./generated/file-schema-v1-4-validator.js";

export type TerminalStateFileNotice =
    | {
        readonly kind: "legacy_migration";
        readonly sourceVersion: FileDocumentV1["file_version"];
        readonly convertedStateCount: number;
        readonly message: string;
    }
    | {
        readonly kind: "notation_repair";
        readonly summary: TerminalStatePreparationSummary;
        readonly message: string;
    };

export type TerminalStateFileResult<DocumentType extends AuthoringDraft = AuthoringDraft> =
    | {
        readonly isSuccessful: true;
        readonly document: DocumentType;
        readonly diagnostics: readonly DomainDiagnostic[];
        readonly notices: readonly TerminalStateFileNotice[];
    }
    | { readonly isSuccessful: false; readonly diagnostics: readonly DomainDiagnostic[] };

export type TerminalStateFileSaveResult = Extract<TerminalStateFileResult, { readonly isSuccessful: false }>
    | ( Extract<TerminalStateFileResult, { readonly isSuccessful: true }> & { readonly text: string } );

function preparationFailure ( message: string ): TerminalStateFileResult
{
    return {
        isSuccessful: false,
        diagnostics: [ {
            code: "TERMINAL_STATE_PREPARATION_REQUIRED", severity: "error", source: "file",
            message,
            remediation: "Prepare terminal notation atomically before accepting or saving the document.",
        } ],
    };
}

function schemaFailure ( errors: readonly ErrorObject[] | null | undefined ): FileOpenResult<AuthoringDraft>
{
    return {
        isSuccessful: false,
        diagnostics: ( errors ?? [] ).map ( error => ( {
            code: "FILE_SCHEMA_INVALID", severity: "error", source: "schema",
            path: error.instancePath || "/",
            message: ( error.instancePath || "/" ) + " " +
                ( error.message ?? "does not satisfy the file schema" ) + ".",
            remediation: "Correct the reported property and try opening the file again.",
        } ) ),
    };
}

export class TerminalStateDocumentCodec implements DocumentCodecPort
{
    public constructor ( private readonly preparation: TerminalStatePreparationPort ) {}

    private prepare ( document: AuthoringDraft ): TerminalStateFileResult
    {
        const validation = validatePersistableAuthoringDraft ( document );

        if ( !validation.isValid )
        {
            return { isSuccessful: false, diagnostics: validation.diagnostics };
        }

        const prepared = this.preparation.prepare ( document );

        if ( !prepared.isSuccessful )
        {
            return prepared;
        }

        const preparedValidation = validatePersistableAuthoringDraft ( prepared.document );

        if ( !preparedValidation.isValid )
        {
            return { isSuccessful: false, diagnostics: preparedValidation.diagnostics };
        }

        if ( !hasCoherentTerminalStateNotation ( prepared.document ) ||
            serializeCanonicalHostedContent ( document ) !==
                serializeCanonicalHostedContent ( prepared.document ) )
        {
            return preparationFailure ( "Terminal preparation left inconsistent notation or changed model content." );
        }

        const summary = prepared.summary;
        const hasRepair = summary.addedIndicatorCount + summary.addedRelationCount +
            summary.removedRelationCount > 0;

        return {
            isSuccessful: true,
            document: prepared.document,
            diagnostics: preparedValidation.diagnostics,
            notices: hasRepair ? [ {
                kind: "notation_repair", summary,
                message: "Terminal notation repaired: " + summary.addedIndicatorCount + " indicator(s), " +
                    summary.addedRelationCount + " added relation(s), " +
                    summary.removedRelationCount + " removed relation(s).",
            } ] : [],
        };
    }

    private parseVersion ( value: JsonValue, modern: boolean ): TerminalStateFileResult
    {
        let fileDocument: FileDocumentV1 | FileDocumentV1_4;

        if ( modern )
        {
            if ( !validateModernFile ( value ) )
            {
                const failure = schemaFailure ( validateModernFile.errors );
                return { isSuccessful: false, diagnostics: failure.diagnostics };
            }

            fileDocument = value;
        }
        else
        {
            if ( !validateLegacyFile ( value ) )
            {
                const failure = schemaFailure ( validateLegacyFile.errors );
                return { isSuccessful: false, diagnostics: failure.diagnostics };
            }

            fileDocument = value;
        }

        // Validate the original references before deriving membership or removing contradictions.

        const original = decodeFileDocumentV1 ( { ...fileDocument, file_version: "1.3.0" } );
        const originalValidation = validatePersistableAuthoringDraft ( original );

        if ( !originalValidation.isValid )
        {
            return { isSuccessful: false, diagnostics: originalValidation.diagnostics };
        }

        const migrated = decodeTerminalStateFileDocument ( fileDocument );
        const prepared = this.prepare ( migrated );

        if ( !prepared.isSuccessful || fileDocument.file_version === "1.4.0" )
        {
            return prepared;
        }

        const convertedStateCount = migrated.stateMachine.states.filter ( state => state.terminalState ).length;

        return {
            ...prepared,
            notices: [ {
                kind: "legacy_migration", sourceVersion: fileDocument.file_version, convertedStateCount,
                message: "Loaded file " + fileDocument.file_version + "; migrated " + convertedStateCount +
                    " terminal state(s). The next Save will write format 1.4.0.",
            }, ...prepared.notices ],
        };
    }

    public openAuthoring ( text: string ): TerminalStateFileResult
    {
        let notices: readonly TerminalStateFileNotice[] = [];
        const parse = ( value: JsonValue, modern: boolean ) =>
        {
            const result = this.parseVersion ( value, modern );
            if ( result.isSuccessful )
            {
                notices = result.notices;
            }
            return result;
        };
        const result = openDocument ( text, new Map ( [
            ...[ "1.0.0", "1.1.0", "1.2.0", "1.3.0" ].map ( version =>
                [ version, ( value: JsonValue ) => parse ( value, false ) ] as const ),
            [ "1.4.0", ( value: JsonValue ) => parse ( value, true ) ],
        ] ) );

        return result.isSuccessful ? { ...result, notices } : result;
    }

    public open ( text: string ): TerminalStateFileResult<AutomataDocument>
    {
        const opened = this.openAuthoring ( text );

        if ( !opened.isSuccessful )
        {
            return opened;
        }

        const validation = validateAuthoringDraft ( opened.document );

        return validation.isValid
            ? { ...opened, document: validation.document, diagnostics: validation.diagnostics }
            : { isSuccessful: false, diagnostics: validation.diagnostics };
    }

    // The application must commit a changed prepared snapshot before starting its normal immutable
    // Save capture and destination workflow. This headless method never changes live history.

    public serialize (
        document: AuthoringDraft,
        expandedStateMinimumHeight = DEFAULT_CHART_STATE_HEIGHT,
    ): TerminalStateFileSaveResult
    {
        const prepared = this.prepare ( document );

        if ( !prepared.isSuccessful )
        {
            return prepared;
        }

        return {
            ...prepared,
            text: JSON.stringify ( encodeFileDocumentV1_4 (
                prepared.document, expandedStateMinimumHeight,
            ), null, 2 ) + "\n",
        };
    }
}
