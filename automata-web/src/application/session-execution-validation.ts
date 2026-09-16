// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Session Execution Validation
// Version: 1.0.0
// Date:    2026-09-16
// Author:  Rohin Gosling
//
// Description:
//
//   Validates correlated execution results before application state or event cursors change.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { RuntimeExecutionPolicy } from "../domain/runtime/contracts.js";
import type { HostedSessionDto, HostedSessionOperationResult } from "./server-contracts.js";

export function isSessionInitializationValid (
    session: HostedSessionDto,
    executionPolicy: RuntimeExecutionPolicy,
    previous: HostedSessionDto | null = null,
): boolean
{
    return session.executionPolicy.enableTerminalStates === executionPolicy.enableTerminalStates &&
        session.executionStatus.kind === "active" && session.initialEntryActionsPending &&
        session.processedEventCount === 0 && !session.traceTruncated &&
        session.transitionTrace.length === 0 && session.actionTrace.length === 0 &&
        ( previous === null || session.sessionId === previous.sessionId &&
            session.modelRevision === previous.modelRevision );
}

export function isSessionAdvancementValid (
    previous: HostedSessionDto,
    result: HostedSessionOperationResult,
    submittedEventCount: number,
    isStep: boolean,
): boolean
{
    const session       = result.session;
    const consumedCount = result.consumedEventCount;
    const maximumCount  = isStep ? Math.min ( 1, submittedEventCount ) : submittedEventCount;
    if ( previous.executionStatus.kind !== "active" ||
        session.sessionId !== previous.sessionId || session.modelRevision !== previous.modelRevision ||
        session.executionPolicy.enableTerminalStates !== previous.executionPolicy.enableTerminalStates ||
        session.initialEntryActionsPending || !Number.isSafeInteger ( consumedCount ) ||
        consumedCount < 0 || consumedCount > maximumCount ||
        session.processedEventCount !== Math.min (
            Number.MAX_SAFE_INTEGER, previous.processedEventCount + consumedCount,
        ) )
    {
        return false;
    }
    if ( session.executionStatus.kind === "active" )
    {
        return consumedCount === maximumCount;
    }
    if ( !session.executionPolicy.enableTerminalStates ||
        session.executionStatus.reason !== "terminal_state" ||
        session.executionStatus.state !== session.currentState )
    {
        return false;
    }
    // Zero consumption is reserved for initial entry; termination never synthesizes trace rows.

    return consumedCount !== 0 || previous.initialEntryActionsPending &&
        session.currentState === previous.currentState && result.warnings.length === 0 &&
        session.transitionTrace.length === 0;
}
