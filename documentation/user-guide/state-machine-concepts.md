# State-Machine Concepts

Automata Lab models deterministic state transducers: an event can move the machine from one state to another, and the
states report ordered action names as the machine leaves and enters them. This chapter explains the model independently
of any particular editing surface.

## States

A state represents one named condition of the machine. Every valid model has at least one state, and exactly one of its
declared states is selected as the initial state.

Each state has a unique name within the state catalog and may have a description. Names are case-sensitive, so
`state_off` and `state_Off` are different states. Prefixing names with `state_` is optional but can make larger models
easier to read.

The order of states affects how they are displayed, not how the machine executes. Moving a state up or down in the
Editor therefore does not change transition behavior.

## Events

An event is a named input symbol that the runtime can consume. Events are declared once in the model and reused by
transitions and saved event sequences.

Event matching is exact and case-sensitive. The event catalog's display order has no runtime meaning. Prefixing event
names with `event_` is optional but useful when names appear beside state and action tokens.

The runtime distinguishes two exceptional inputs:

- An **unknown event** is an event name that the model does not declare; and
- A **missing transition** occurs when the event is declared but the current state has no transition for it.

In both cases, the runtime consumes the event, records a warning, leaves the state unchanged, emits no actions, and
continues with later events.

## Actions

An action is a reusable named output symbol. Actions are inert data: Automata Lab reports their names but never executes
them as code.

The action catalog declares each action once. A state may then refer to a declared action in its Entry Actions list, its
Exit Actions list, or both. Prefixing names with `action_` is optional.

Reordering action declarations changes only their display order. Output order comes from the action lists assigned to
each state.

## Entry and Exit Actions

Every state owns two independent ordered action lists:

- **Entry Actions** are reported after the runtime enters the state.
- **Exit Actions** are reported before the runtime leaves the state.

The same declared action may appear several times in either list. Repetitions are meaningful and are reported in their
stored positions. Moving an assignment up or down therefore changes runtime output order.

A model may use only entry actions, only exit actions, both kinds, or no actions. The action catalog itself is not split
into entry and exit catalogs; the list in which a state uses an action determines its schedule.

## Transitions

A transition contains three references:

| Field | Meaning |
|---|---|
| **State** | The source state in which the event is handled. |
| **Event** | The declared input that selects the transition. |
| **Next State** | The destination state entered after the event. |

The transition function is deterministic. A model can contain at most one destination for a particular source-state
and event pair. The same event may still have different destinations in different source states.

A transition may return to its source. This is a self-transition, and it still reports the state's complete exit list
followed by its complete entry list.

Transition row order is cosmetic. Moving rows changes their display order without changing which transition the runtime
selects.

## Initial State

The initial state is the state selected when a runtime session is reset or created. Reset clears the traces, selects
that state, and leaves its entry actions pending. The first **Run** or **Step** reports the complete initial entry-action
list exactly once before attempting the first event; Reset itself reports no actions.

An authoring draft may temporarily have no states or no initial state. Such a structurally sound draft can be saved after
an explicit warning, but it cannot be hosted or simulated until it has at least one state, a declared initial state, and
no blocking validation errors.

## Initial and Terminal Chart Indicators

The Chart uses UML-style indicators, but the two indicator kinds have different semantic roles.

The single **Initial Indicator** is a filled dot. When connected to a state, it is the visible notation for the semantic
initial state; the state does not repeat that identity with an Initial badge. Connecting the indicator to another state
changes the model's initial state atomically. The indicator may instead remain visibly orphaned in open Chart space. An
orphan has no state attachment and does not change an independently selected initial state.

A **Terminal Indicator** is a filled dot enclosed by a ring. Any number may appear, and several states may have visual
relations to an indicator. These indicators and relations are Chart notation only. They do not classify terminal states,
stop execution, change Solver evidence, create transitions, or affect Simulator sessions.

## Partial Transition Tables

Automata Lab does not require every state-and-event combination to have a transition. The transition table is
deliberately partial so a model can define behavior only where it is meaningful.

For each event consumed in the current state, the runtime follows this decision:

1. If the event name is undeclared, record `UNKNOWN_EVENT` and remain in the current state.
2. If the event is declared but the state has no matching transition, record `NO_TRANSITION` and remain in the current
   state.
3. Otherwise, execute the one matching deterministic transition.

Warnings do not end a buffered run. The next event is still considered.

## Runtime Execution Order

For a matching transition, the runtime always performs the same sequence:

1. Report the source state's Exit Actions in stored order.
2. Change the current state to the transition's Next State.
3. Report the destination state's Entry Actions in stored order.

For example, suppose `state_off` has exit action `action_click`, and the `event_toggle` transition leads to `state_on`,
whose entry actions are `action_power` and `action_light`. Consuming the event reports:

| Step | Result |
|---|---|
| 1 | `action_click` from `state_off` |
| 2 | Current state changes to `state_on` |
| 3 | `action_power`, then `action_light` from `state_on` |

The current state remains selected after an event sequence ends. A later Run or Step continues from that state unless
the session is reset.

Previous: [Getting Started](./getting-started)

Next: [Application Shell](./application-shell)
