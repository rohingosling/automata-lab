// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Terminal State Notation Contract
// Version: 1.0.0
// Date:    2026-09-16
// Author:  Rohin Gosling
//
// Description:
//
//   Inspects semantic membership against prepared notation without mutating the document.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

import type { AuthoringDraft } from "./contracts.js";

export interface TerminalStateNotationChanges
{
    readonly missingRelationStates:     readonly string[];
    readonly nonterminalRelationStates: readonly string[];
}

// Input integrity is validated before this inspection. References and uniqueness remain owned
// by the ordinary document validator; this contract identifies only repairable contradictions.

export function inspectTerminalStateNotation ( draft: AuthoringDraft ): TerminalStateNotationChanges
{
    const relatedStates  = new Set ( draft.chart.indicators.terminalStateTransitions.map (
        relation => relation.state,
    ) );
    const terminalStates = new Set ( draft.stateMachine.states.filter ( state => state.terminalState )
        .map ( state => state.name ) );

    return {
        missingRelationStates: draft.stateMachine.states.filter ( state =>
            state.terminalState && !relatedStates.has ( state.name ) ).map ( state => state.name ),
        nonterminalRelationStates: draft.chart.indicators.terminalStateTransitions.filter (
            relation => !terminalStates.has ( relation.state ),
        ).map ( relation => relation.state ),
    };
}

export function hasCoherentTerminalStateNotation ( draft: AuthoringDraft ): boolean
{
    const changes = inspectTerminalStateNotation ( draft );

    return changes.missingRelationStates.length === 0 && changes.nonterminalRelationStates.length === 0;
}
