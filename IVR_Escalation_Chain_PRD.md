# IVR Escalation Chain — customer-initiated call routing

| | | | |
|---|---|---|---|
| **Owner** — Ashish Raj (PM) | **Reviewer** — Rahul (Eng Lead) | **Status** — Signed off | **Sign-off** — Signed off · 4 Aug 2026 |
| **Version** — v1.1 · 4 Aug 2026 | | | |

---

## 1. Objective & Definition of Success

**Objective.** A customer who calls about their installation, restore or pickup ticket reaches a person at their own CSP — if the assigned executor does not answer, the call moves on by itself to that CSP's manager and then its owner, and the customer's chances of getting connected to a CSP user increase.

**Boundary.** This spec governs **customer-initiated** IVR calls on Install, Service (restore) and Pickup tickets — every ticket family the IVR serves — at every CSP where IVR 2.0 is live. It leaves unchanged:

- **CSP-initiated calls** to customers — a separate PRD covers reaching the customer on a second number (AC-REG-1).
- **Calls on a ticket with no executor assigned** — today's behaviour stands, untouched (T6, AC-REG-2).
- **Bridge-rate behaviour** — caller identification, PIN entry and dead-end handling are governed by the existing IVR product spec and its Phase-1 RCA (AC-REG-3).
- **What the answering person is told about the call** — no ticket context, customer name or escalation indicator is delivered to any rung. Out of scope (AC-REG-4).
- **Ring durations** — how long each rung rings, and the total ringing a customer hears, are Exotel applet configuration, not parameters of this spec (see Overrides).

### Guardrails — promises that hold on every path

| ID | Guardrail | One line | Anchors |
|---|---|---|---|
| G1 | **Invisible escalation** | The chain advances on its own; the customer never presses a key, redials or is told to try again. | R1 · AC-GRD-1 · MQ-2 |
| G2 | **The executor is always first** | Every chain starts at the person assigned to the job, so escalation never becomes the normal route into a CSP. | R2 · AC-GRD-2 · MQ-3 · MQ-7 |
| G3 | **One dial per person** | No person is dialled twice in the same chain, however many roles they hold. | R3 · AC-GRD-3 · MQ-4 |
| G4 | **Never outside the ticket's CSP** | The chain only ever dials users of the CSP that owns the ticket — no other CSP's staff, no Wiom staff. | R6 · AC-GRD-4 · MQ-6 |

### Success metrics

Ticket-level connect rate is defined in §8. A ticket where the customer hung up before any rung answered **counts as not connected** (T5, MQ-5). All figures below are customer-initiated, Phase-1 cohort, 2 Jul – 3 Aug 2026.

| ID | Metric | Baseline | Target | Source |
|---|---|---|---|---|
| M1 | Ticket-level connect rate — **Service** (restore) | 50.2% | 69.0% | MQ-1 |
| M2 | Ticket-level connect rate — **Pickup** | 51.1% | 69.0% | MQ-1 |
| M3 | Ticket-level connect rate — **Install** | 69.0% | ≥ 69.0% — any gain is upside; a fall below baseline is a regression | MQ-1 |
| M4 | Share of in-scope tickets that connect at **rung 1** — the assigned executor | 50.2% Service · 51.1% Pickup · 69.0% Install — today every connect is the executor, because there is no second rung | No family falls below its own baseline | MQ-3 |

**Where the 69.0% comes from, and why it does not move.** 69.0% is what install tickets achieved on customer-initiated calls in the window above — **before** this spec ships. It is the closest thing to a ceiling this direction is known to reach, so Service and Pickup aim at it. It is frozen as a historical mark: install is itself in scope (§1 Boundary), so install's own rate should climb past 69.0% and must not be allowed to redefine M1 and M2's target as it does. The benchmark is also direction-matched on purpose — install's all-directions figure (79.6%) mixes in CSP-initiated calls, and its CSP-initiated figure (75.8%) belongs to the customer-side PRD, so neither can be used here.

Install has the least room to gain of the three families, and that is expected. It is in scope because the chain costs nothing extra to apply there and any gain is worth having.

**M4 is the counter-metric for M1, M2 and M3.** Connect rate rising while M4 falls means executors have stopped answering and managers and owners are absorbing the calls — connect rate would improve while service got worse, because an owner answering does not restore anyone's line.

**Do not derive the targets from independence.** Three rungs each answering at ~50% gives 87.5% only if the three failures are unrelated. If a common cause suppresses all three, the chain moves connect rate very little. MQ-3 measures per-rung answer rate so this is known within a month of launch rather than assumed.

**Invariant (not a metric):** G2 — chains where an assigned executor was not rung 1 = 0, zero tolerance. Monitored via MQ-7, not trended.

**Invariant (not a metric):** G4 — people dialled who do not belong to the ticket's CSP = 0, zero tolerance. Monitored via MQ-6, not trended.

---

## 2. User Stories & Rules

| ID | Story | MUST | MUST NOT |
|---|---|---|---|
| R1 | As a customer whose internet is down, when I call about my ticket I want to reach *someone* at my provider, not hear ringing and give up. | **(a)** Advance to the next rung by itself when the current rung does not answer. **(b)** Bridge the call to the first rung that answers. | **(a)** Ask the customer to press a key, hold, redial or call another number. **(b)** Tell the customer that escalation is happening or which rung is ringing. |
| R2 | As a CSP owner, I want the person actually assigned to the job to get the call first, so escalation stays the exception. | Dial the assigned executor as rung 1 on every chain, whatever role that person holds (G2). | Skip, reorder or bypass the executor when one is assigned and has a number. |
| R3 | As a CSP owner who is also the executor on my own jobs, I do not want my phone rung three times for one call. | Dial each distinct person once; where two or three rungs resolve to the same person, shorten the chain (G3). | Dial the same person more than once in one chain. |
| R4 | As a customer at a CSP that has no manager, I still want the chain to reach the owner. | Skip a rung that has no user or no number, and continue to the next rung that exists. | Fail, end or shorten the call because a rung is vacant. |
| R5 | As an executor who missed a call, I want the next call on that ticket to reach me first. | Treat every inbound call as a new chain that starts at the executor. | Resume a later call part-way down the chain, or remember which rungs already failed. |
| R6 | As a customer, I want my ticket discussed only with people at my own provider. | Restrict every rung to users of the CSP that owns the ticket (G4). | Dial another CSP's users, a Wiom call centre, or any number not held against this CSP. |
| R7 | As a customer whose line dies at night, I want the chain to work then too. | Run the full chain at every hour of the day, every day. | Suppress, shorten or delay the chain outside working hours. |

---

## 3. System Behaviour

### 3a. System flow chart

```mermaid
flowchart TD
    A["Customer-initiated call bridged, caller resolved to a ticket"] --> B{"Ticket family served by the IVR?"}
    B -- "No" --> C["Existing IVR routing — outside this spec (§1 Boundary)"]
    B -- "Yes" --> D{"Chain enabled? (C-04)"}
    D -- "No" --> C
    D -- "Yes" --> E{"Executor assigned?"}
    E -- "No" --> F["T6 — today's behaviour, unchanged (§1 Boundary)"]
    E -- "Yes" --> G{"Role list resolvable?"}
    G -- "No" --> H["T8 — dial executor only"]
    G -- "Yes" --> I{"Distinct people after dedupe?"}
    I -- "One" --> J["T7 — single-rung chain"]
    I -- "Two or three" --> K["T1 — dial rung 1"]
    K --> L{"Rung answers?"}
    J --> L
    H --> L
    L -- "Yes" --> M["T2 — connected"]
    L -- "No" --> N{"Customer still on the line?"}
    N -- "No" --> O["T5 — abandoned"]
    N -- "Yes" --> P{"A further distinct rung exists?"}
    P -- "Yes" --> Q["T3 — dial next rung"]
    Q --> L
    P -- "No" --> R["T4 — exhausted"]
```

**Precedence — customer hangup beats escalation.** If the customer disconnects while a rung is ringing, the chain ends there and no further rung is dialled (T5, AC-RACE-1).

**Precedence — first answer wins.** If a rung answers at the same instant the chain advances, the call bridges to the rung that answered and the other dial is dropped; the customer is never bridged to two people (T2, AC-RACE-2).

**Precedence — a ticket closing mid-chain does not stop it.** A chain already ringing when its ticket closes runs to completion; ticket closure is evaluated at caller resolution, not per rung (AC-RACE-3).

### 3b. State transition table — canon

Lifecycle of an **escalation chain** (created when a customer-initiated call is bridged and the caller resolves to an in-scope ticket). **Each inbound call creates its own chain; no state carries between calls (R5).** The ticket's own lifecycle, the caller-identification and PIN flow, and the CSP-initiated call direction are out of scope; they appear only where a chain is affected.

| ID | From | Action / Trigger | Rule / Check | To | Side-effects |
|---|---|---|---|---|---|
| T1 | — | Customer-initiated call bridged, caller resolved to an in-scope ticket | Chain enabled (C-04); executor assigned with a number; role list resolves to 2 or 3 distinct people after dedupe (R3) and after skipping vacant rungs (R4) | Ringing rung 1 | Assigned executor dialled (R2, G2). Chain length after dedupe recorded (MQ-4). |
| T2 | Ringing rung N | The ringing rung answers | — | Connected | Call bridged to that person (R1b). Answering rung index recorded (MQ-2, MQ-3). Terminal state. |
| T3 | Ringing rung N | The ringing rung does not answer, is busy, or the dial fails | A further distinct rung exists | Ringing rung N+1 | Next distinct person dialled (R3), and not before the current rung's dial has finished unanswered. No customer action and no announcement (R1a, R1 must-not(b), G1). |
| T4 | Ringing rung N | The ringing rung does not answer, is busy, or the dial fails | No further rung exists | Exhausted | Existing unconnected-call handling applies, unchanged (§1 Boundary). Ticket counted as not connected (M1, M2, M3, MQ-5). Terminal state. |
| T5 | Ringing rung N | Customer disconnects | — | Abandoned | Chain ends immediately; no further rung is dialled. Ticket counted as not connected (M1, M2, M3, MQ-5). Terminal state. |
| T6 | — | Customer-initiated call bridged, caller resolved to an in-scope ticket | No executor assigned to the ticket | Outside this spec | Today's routing runs unchanged; no chain is created (§1 Boundary, AC-REG-2). |
| T7 | — | Customer-initiated call bridged, caller resolved to an in-scope ticket | Executor, manager-tier user and owner resolve to one person after dedupe (R3) | Ringing rung 1 | That person dialled once (G3). No answer routes to T4, not T3. |
| T8 | — | Customer-initiated call bridged, caller resolved to an in-scope ticket | Role list cannot be resolved | Ringing rung 1 | **Failure envelope:** the call is never failed for want of a role list — it degrades to dialling the assigned executor alone, which is today's behaviour. No answer routes to T4. How resolution is retried inside the call is the implementer's. |

---

## 4. Screen Requirements

**Not applicable — this feature has no screen.** The whole call happens on the phone network, and G1 requires the escalation be invisible: R1's must-not bars any announcement, indicator or customer action. The Customer App, CSP App and Technician App are all untouched (AC-GRD-1). Ticket context for the answering rung is out of scope (§1 Boundary, AC-REG-4).

No design file is needed, because there is nothing to design.

§6 states what the shipped system must be able to answer. Where those answers are read — dashboard, report or query — is the implementer's, not this spec's.

---

## 5. Configurability

| ID | Parameter | Default | Range | Who changes it |
|---|---|---|---|---|
| C-04 | Chain enabled — kill switch (T1) | On, wherever IVR 2.0 is live | On / Off | Product + Eng |

**This spec owns one parameter, and only one.** Everything else about the chain's reach is inherited, not tuned here:

- **Which CSPs get it** is wherever IVR 2.0 is already live. Rollout is the IVR service's own, and this spec does not add a second cohort control on top of it.
- **Which ticket families get it** is every family the IVR serves — install, service and pickup, which is all of them. There is no subset to configure.
- **The rung order** — assigned executor, then manager-tier user, then owner — is system behaviour, stated in §3b and defined in §8. It is not a tunable.

So C-04 is a straight off switch for the whole feature, and nothing narrower.

**No window interaction note applies.** This spec owns no clocks. Per-rung ring duration and the total ringing a customer hears are Exotel applet configuration and deliberately not C-ids (see Overrides), so there are no two windows here to specify a state between. Customer wait is still measured — MQ-8 — because it is the abandonment risk this design carries.

---

## 6. Measurement

| ID | The system must be able to answer… | Feeds |
|---|---|---|
| MQ-1 | Of in-scope tickets with at least one customer-initiated call, what share had at least one call where a person answered — split by ticket family. Abandoned chains count as not connected. | M1 · M2 · M3 |
| MQ-2 | For each chain, which rung answered — 1, 2, 3, or none — and whether that answer happened on the same inbound call the customer made. | G1 · M4 |
| MQ-3 | For each rung, the share of dials to that rung that were answered. | M4 · G2 · the independence check in §1 |
| MQ-4 | How many chains were shortened by dedupe, and to what length. | G3 · R3 |
| MQ-5 | How many chains ended Connected, Exhausted or Abandoned. | M1, M2, M3 definition · T4 · T5 |
| MQ-6 | Whether any person dialled in a chain did not belong to the ticket's CSP. | G4 invariant (R6) |
| MQ-7 | Whether any chain dialled a rung other than the assigned executor first, where an executor was assigned and had a number. | G2 invariant (R2) |
| MQ-8 | The time from bridge to answer or to customer disconnect, by the rung reached. | Abandonment risk behind M1, M2, M3 · R7 |
| MQ-9 | For connected calls, the spread of how long the customer and the answering person actually talked, by the rung that answered. | The honesty of M1, M2, M3 · M4 · G2 |
| MQ-10 | For one inbound call, the outcome of **every** rung dialled, one row each — which person was dialled, at which rung position, and whether they answered, did not answer, were busy or could not be reached — with every row tied to that call's chain by a single identifier, and to the ticket. | M4 · G2 · G3 · G4 · underpins MQ-2 · MQ-3 · MQ-4 |

---

## 7. Acceptance Criteria

**Example data used throughout** — CSP `CSP-4412`: technician Ravi (09811100011), Manager Anil (09811100012), Owner Suresh (09811100013). Service ticket `TKT-88231` for customer Meena (09811100022), with Ravi as its assigned executor. Calls on 12 Aug 2026.

### CHN — Chain creation and rung 1 (T1, T7, T8)

| AC | Given / When / Then | Verifies | Status |
|---|---|---|---|
| AC-CHN-1 | **Given** `TKT-88231` with Ravi as executor and Anil and Suresh on `CSP-4412`, **When** Meena calls at 15:20 and is resolved to that ticket, **Then** a chain of 3 rungs exists and Ravi's 09811100011 is the first and only number dialled. | R2 · T1 · G2 | Settled |
| AC-CHN-2 | **Given** `TKT-88231` where Suresh is both the owner and its assigned executor, and Anil is the manager, **When** Meena calls, **Then** the chain has 2 rungs — Suresh then Anil — and 09811100013 is dialled exactly once. | R3 · T1 · G3 | Settled |
| AC-CHN-3 | **Given** `CSP-4412` with no manager-tier user and no Manager Plus, **When** Meena calls, **Then** the chain has 2 rungs — Ravi then Suresh — and no dial is attempted against a vacant rung. | R4 · T1 | Settled |
| AC-CHN-4 | **Given** a CSP where the executor, manager and owner are all Suresh, **When** Meena calls, **Then** the chain has exactly 1 rung, 09811100013 is dialled once, and on no answer the chain ends Exhausted rather than advancing. | R3 · T7 · G3 | Settled |
| AC-CHN-5 | **Given** Ravi is the executor on `TKT-88231` but has no phone number on `CSP-4412`, **When** Meena calls, **Then** rung 1 is skipped without a dial and Anil's 09811100012 is dialled first. | R4 · T1 | Settled |
| AC-CHN-6 | **Given** a Pickup ticket for Meena at `CSP-4412`, **When** she calls, **Then** the chain is created — Pickup is in scope. | T1 · §1 Boundary | Settled |
| AC-CHN-7 | **Given** `TKT-88231` where Anil the manager is its assigned executor, **When** Meena calls, **Then** the chain has 2 rungs — Anil then Suresh — and Anil's 09811100012 is dialled first, not Ravi's. | R2 · R3 · T1 · G2 | Settled |
| AC-CHN-8 | **Given** an install ticket for Meena at `CSP-4412` with Ravi as executor, **When** she calls, **Then** the chain is created — install is in scope. | T1 · §1 Boundary | Settled |

### ESC — Escalation and connection (T2, T3)

| AC | Given / When / Then | Verifies | Status |
|---|---|---|---|
| AC-ESC-1 | **Given** the 3-rung chain from AC-CHN-1 with Ravi ringing, **When** Ravi answers, **Then** Meena is bridged to Ravi, no further number is dialled, and the answering rung is recorded as 1. | R1b · T2 · MQ-2 | Settled |
| AC-ESC-2 | **Given** the same chain, **When** Ravi does not answer, **Then** Anil's 09811100012 is dialled next without Meena pressing any key, hearing any announcement, or the call dropping. | R1a · T3 · G1 | Settled |
| AC-ESC-3 | **Given** Anil is then ringing, **When** Anil answers, **Then** Meena is bridged to Anil, Suresh is never dialled, and the answering rung is recorded as 2. | R1b · T2 · T3 | Settled |
| AC-ESC-4 | **Given** Anil is ringing, **When** Anil's line is busy, **Then** the chain advances to Suresh — busy is treated the same as no answer. | T3 | Settled |
| AC-ESC-5 | **Given** Anil is ringing, **When** the dial to Anil fails outright, **Then** the chain advances to Suresh rather than ending. | T3 | Settled |
| AC-ESC-6 | **Given** the chain has reached Suresh, **When** Suresh answers, **Then** Meena is bridged to Suresh and the answering rung is recorded as 3. | T2 · MQ-2 | Settled |
| AC-ESC-7 | **Given** the 3-rung chain from AC-CHN-1, **When** Ravi's phone is ringing, **Then** neither Anil's nor Suresh's phone has rung — the rungs are dialled one after another, never together. | R2 · T3 · G2 | Settled |

### END — Chain endings (T4, T5)

| AC | Given / When / Then | Verifies | Status |
|---|---|---|---|
| AC-END-1 | **Given** the 3-rung chain with Suresh ringing as rung 3, **When** Suresh does not answer, **Then** the chain ends Exhausted, existing unconnected-call handling runs unchanged, and `TKT-88231` counts as not connected. | T4 · M1 · MQ-5 | Settled |
| AC-END-2 | **Given** Anil is ringing as rung 2, **When** Meena hangs up, **Then** the chain ends Abandoned, Suresh is never dialled, and `TKT-88231` counts as not connected. | T5 · M1 · MQ-5 | Settled |
| AC-END-3 | **Given** the single-rung chain from AC-CHN-4, **When** Suresh does not answer, **Then** the chain ends Exhausted after one dial. | T7 · T4 | Settled |

### WF — Workflows (T1 → T3 → T2; T1 → T3 → T4)

| AC | Given / When / Then | Verifies | Status |
|---|---|---|---|
| AC-WF-1 | **Given** `TKT-88231` with Ravi as executor, Anil and Suresh, **When** Meena calls at 15:20, Ravi does not answer and Anil does, **Then** Meena has spoken to Anil on one call, was never asked to redial or press a key, and `TKT-88231` counts as connected at rung 2. | R1 · T1 · T3 · T2 · G1 | Settled |
| AC-WF-2 | **Given** the same setup, **When** none of Ravi, Anil or Suresh answers, **Then** exactly three numbers were dialled in that order, the chain ends Exhausted, and `TKT-88231` counts as not connected. | T1 · T3 · T4 · M1 | Settled |
| AC-WF-3 | **Given** Meena's call at 15:20 ended Exhausted, **When** she calls again at 15:45, **Then** a new chain starts at Ravi — not at Anil or Suresh. | R5 · T1 | Settled |
| AC-WF-4 | **Given** the 3-rung chain on `TKT-88231`, **When** Meena calls at 15:20, Ravi does not answer and Anil does, **Then** that call's record holds **two** rung rows — Ravi at rung 1, not answered; Anil at rung 2, answered — both carrying the same chain identifier and the same ticket, and Suresh has no row at all. | MQ-10 · T3 · T2 | Settled |
| AC-WF-5 | **Given** the same chain, **When** none of Ravi, Anil or Suresh answers, **Then** the record holds **three** rung rows in dial order, each naming its person, position and outcome, all under one chain identifier — so the call shows three separate misses, not one. | MQ-10 · T3 · T4 | Settled |
| AC-WF-6 | **Given** Meena's 15:20 call reached Anil and her 15:45 call reached Ravi, **When** both calls are examined, **Then** each has its own chain identifier and its rung rows belong to exactly one of them — the two calls' rungs are never mixed. | MQ-10 · R5 · T1 | Settled |

### FAIL — Failure envelopes (T8)

| AC | Given / When / Then | Verifies | Status |
|---|---|---|---|
| AC-FAIL-1 | **Given** the source of CSP roles cannot be reached when Meena calls, **When** the call is bridged, **Then** Ravi alone is dialled — the call is bridged, never failed or dropped for want of a role list. | T8 | Settled |
| AC-FAIL-2 | **Given** the same failure and Ravi does not answer, **When** the dial completes unanswered, **Then** the chain ends Exhausted and existing unconnected-call handling runs — no rung 2 is invented. | T8 · T4 | Settled |

### REG — Regression (§1 Boundary)

| AC | Given / When / Then | Verifies | Status |
|---|---|---|---|
| AC-REG-1 | **Given** `TKT-88231`, **When** Ravi calls Meena from the CSP App, **Then** routing is exactly as before this spec — one destination, Meena's registered number, no chain. | §1 Boundary | Settled |
| AC-REG-2 | **Given** a Service ticket at `CSP-4412` with no executor assigned, **When** Meena calls, **Then** routing is exactly as before this spec and no chain is created. | T6 · §1 Boundary | Settled |
| AC-REG-3 | **Given** Meena calls the masked number and enters a wrong PIN, **When** the call reaches the dead end, **Then** the existing caller-identification and dead-end behaviour is unchanged — this spec begins only after a caller resolves to a ticket. | §1 Boundary | Settled |
| AC-REG-4 | **Given** Anil answers as rung 2 on `TKT-88231`, **When** the call bridges, **Then** Anil receives no ticket reference, customer name or escalation indicator — unchanged from today. | §1 Boundary | Settled |

### RACE — Simultaneity (§3a precedence rules)

| AC | Given / When / Then | Verifies | Status |
|---|---|---|---|
| AC-RACE-1 | **Given** Anil's phone is ringing as rung 2, **When** Meena hangs up at the same instant the chain would advance to Suresh, **Then** Suresh is not dialled and the chain ends Abandoned. | T5 · precedence 1 | Settled |
| AC-RACE-2 | **Given** the chain is advancing from Anil to Suresh, **When** Anil answers at that same instant, **Then** Meena is bridged to exactly one person and is never on a call with both. | T2 · precedence 2 | Settled |
| AC-RACE-3 | **Given** Anil is ringing as rung 2 on `TKT-88231`, **When** `TKT-88231` is closed at that instant, **Then** the chain continues to completion and Meena is still bridged if Anil answers. | precedence 3 | Settled |

### DUP — Duplicate triggers

| AC | Given / When / Then | Verifies | Status |
|---|---|---|---|
| AC-DUP-1 | **Given** Meena calls at 15:20 and is bridged to Anil at rung 2, **When** she calls again at 15:22, **Then** a second, independent chain starts at Ravi. | R5 · T1 | Settled |
| AC-DUP-2 | **Given** Meena has two calls in flight on the same ticket at once, **When** both chains run, **Then** each chain dials its own rungs independently and neither shortens or skips because of the other. | R5 · T1 | Settled |
| AC-DUP-3 | **Given** two different customers of `CSP-4412` call at the same moment on two Service tickets both assigned to Ravi, **When** both chains start, **Then** both dial Ravi as rung 1 and each advances on its own outcome. | R2 · T1 · T3 | Settled |

### BV — Boundary values (chain length)

| AC | Given / When / Then | Verifies | Status |
|---|---|---|---|
| AC-BV-1 | **Given** a CSP resolving to exactly 1 distinct person, **When** Meena calls, **Then** 1 dial is made and no escalation occurs. | R3 · T7 | Settled |
| AC-BV-2 | **Given** a CSP resolving to exactly 2 distinct people, **When** neither answers, **Then** exactly 2 dials were made and the chain ends Exhausted — no third dial. | R3 · R4 · T4 | Settled |
| AC-BV-3 | **Given** a CSP resolving to 3 distinct people, **When** none answers, **Then** exactly 3 dials were made and no fourth rung exists — the chain never extends past the owner. | T4 · §8 Rung | Settled |

### CFG — Configurability

| AC | Given / When / Then | Verifies | Status |
|---|---|---|---|
| AC-CFG-1 | **Given** the chain is switched off (C-04), **When** Meena calls, **Then** only Ravi is dialled, no escalation occurs, and routing is identical to AC-REG-2's pre-spec behaviour for every in-scope ticket. | C-04 | Settled |
| AC-CFG-2 | **Given** the chain is switched off (C-04) and Ravi does not answer, **When** the dial completes unanswered, **Then** neither Anil nor Suresh is dialled and existing unconnected-call handling runs — the off switch removes the whole feature, not just its first rung. | C-04 | Settled |

### GRD — Guardrails

| AC | Given / When / Then | Verifies | Status |
|---|---|---|---|
| AC-GRD-1 | **Given** any chain that reaches rung 2 or rung 3, **When** the call is reviewed end to end, **Then** the customer heard no announcement, pressed no key, and the call was never disconnected and re-established. | G1 · R1 | Settled |
| AC-GRD-2 | **Given** 1,000 chains across the cohort, **When** the first dial of each is checked, **Then** every one dialled the assigned executor where an executor was assigned and had a number — whatever role that executor held. | G2 · R2 · MQ-7 | Settled |
| AC-GRD-3 | **Given** any chain at a CSP where one person is both the executor and a later rung, **When** the dial list is checked, **Then** no person appears twice. | G3 · R3 · MQ-4 | Settled |
| AC-GRD-4 | **Given** any chain on `TKT-88231`, **When** every number dialled is checked against `CSP-4412`'s user list, **Then** all of them belong to `CSP-4412` and none is a Wiom or other-CSP number. | G4 · R6 · MQ-6 | Settled |
| AC-GRD-5 | **Given** a Service ticket where Meena calls at 23:40, **When** Ravi does not answer, **Then** the chain advances to Anil and then Suresh exactly as it would at 15:20. | R7 | Settled |

---

## 8. Glossary

| Term | Meaning | Owner (domain) |
|---|---|---|
| Assigned executor | **Canonical definition:** the partner user assigned to carry out a ticket. Any role can be the executor — owner, Manager, Manager Plus or technician — so the executor's role is not fixed, and the executor may also be a later rung, in which case dedupe shortens the chain (R3). Always rung 1 (G2). | Partner Platform |
| Escalation chain | **Canonical definition:** the ordered list of distinct people dialled for one inbound customer call, and the act of moving down it when a person does not answer. Created per call, never carried between calls (R5). Carries: **its own identifier**, the ticket it belongs to, the ordered rungs after dedupe, the chain length, the answering rung index if any, and the end state (Connected / Exhausted / Abandoned). Each rung dialled carries its own outcome — who was dialled, at which position, and what happened — and every one of those rows is joined to the chain by that identifier, so a call where the executor missed and the manager answered shows both people separately rather than one summary (MQ-10). | — |
| Rung | **Canonical definition:** one position in an escalation chain, and the one person dialled at that position. There are exactly three, in this order: rung 1 the assigned executor, rung 2 the manager-tier user, rung 3 the owner. The order and the depth are system behaviour, not configuration — no chain ever extends past the owner (AC-BV-3). | — |
| Manager-tier user | The CSP user holding the Manager or the Manager Plus role. A CSP cannot hold both at once by design, so this is always at most one person, and rung 2 is whichever of the two exists. | Partner Platform |
| Ticket-level connect rate | **Canonical definition:** of tickets that had at least one call in the chosen direction and window, the share where at least one of those calls was answered by a person. A ticket counts once however many calls it had. **Any answered call counts, however short** — this matches how the rate is measured today, so baselines and targets compare like with like. A very short call still counts, so MQ-9 reports how long people actually talked: if answered calls get shorter as the chain rolls out, the rate is rising on calls that helped nobody. Not to be confused with call-level connect rate, which is per call. Comparisons must never mix the two grains. | — |
| Exhausted | A chain where every rung was dialled and none answered. Counts as not connected. | — |
| Abandoned | A chain where the customer disconnected before any rung answered. Counts as not connected. | — |
| Install ticket | The new-connection installation ticket family. | — |
| Service ticket | The restore ticket family — a live customer whose connection needs restoring. Called "Service" in the ops dashboard's ticket-type filter. | — |
| Pickup ticket | The netbox-recovery (NBREC) ticket family — collecting equipment from a customer. | — |
| Phase-1 cohort | The CSPs on which IVR 2.0 is live — 99 of them when this spec's baselines were measured — and so this spec's launch scope. It is the IVR service's own rollout scope, not a parameter this spec sets (§5). | — |

---

## 9. Notes for System Capabilities

What the platform must be able to do for this feature to exist. Whether these are one system or several, and how they interact, is the implementer's design.

| Capability | Needed by |
|---|---|
| For a ticket, resolve its assigned executor whatever role that person holds, plus the CSP's manager-tier user and its owner, each with a dialable number, restricted to that CSP. | T1 · R2 · R4 · R6 · G4 |
| Reduce a resolved rung list to distinct people before any dial, preserving rung order. | T1 · T7 · R3 · G3 |
| Dial an ordered list of destinations for one inbound call, advancing to the next on no answer, busy or dial failure, without the caller acting and without dropping the call. | T1 · T3 · R1 · G1 |
| End a chain the moment the caller disconnects, dialling nothing further. | T5 · precedence 1 |
| Bridge to exactly one person per call, even when an answer and an advance coincide. | T2 · precedence 2 |
| Fall back to dialling the assigned executor alone when the rung list cannot be resolved, without failing the call. | T8 |
| Give each chain an identifier, and record one row per rung dialled against it — the person, the rung position and that rung's outcome — so every person dialled on a call is separately visible and attributable, not just the one who answered. | MQ-10 · G2 · G3 · G4 |
| Record, per call, the chain length after dedupe, the rung that answered if any, the end state, and the caller's wait before answer or hangup. | MQ-2 · MQ-3 · MQ-4 · MQ-5 · MQ-8 · MQ-9 |
| Turn the chain off without a release, everywhere at once. | C-04 |

---

## Overrides

| Rule | What was done instead | Rationale | Approved by |
|---|---|---|---|
| §5 — every number that could change gets a C-id, including customer-experience latency targets even where engineering owns them | Per-rung ring duration and the total ringing the customer hears are **not** C-ids and appear nowhere in §5 | Ring behaviour is Exotel App Bazaar applet configuration, not a parameter of this service. Consistent with the June 2026 decision to drop `ES_CSPIVR_CALL_BRIDGE_MAX_RING_SECONDS` from the IVR spec for the same reason. Customer wait is still measured via MQ-8. | Ashish Raj (PM), 3 Aug 2026 |
| Header — name consulted parties by domain | No consulted parties are named; the header carries Owner, Reviewer, Status, Sign-off and Version only | PM removed all three consulted slots. The spec changes no other team's surface: it reads existing partner-role data and dials through the existing telephony integration. | Ashish Raj (PM), 3 Aug 2026 |
| §5 — every number that could change gets a C-id; every number outside §5 is a C-id | §5 holds one parameter, C-04. Ticket families, the CSP cohort and the rung order were C-ids and are now plain facts stated in §1, §3b and §8 — including the count of CSPs in §8's Phase-1 cohort entry | None of the three is this spec's to set. Cohort and families follow the IVR service's own rollout, so a second control here would only let the two disagree. Rung order is system behaviour, and it was already "Fixed in V1" — a parameter nobody can change is not a parameter. C-04 remains as a straight off switch. | Ashish Raj (PM), 4 Aug 2026 |
| §4 — one block per screen the feature touches, internal screens included, each with states, freshness, an elements table and a design link | §4 carries no screen block at all — only a statement that the feature has no screen | The feature is invisible by design (G1), so no app screen changes. An internal ops view was drafted and removed at the PM's instruction: §6 already states what the system must answer, and where those answers are read is the implementer's. | Ashish Raj (PM), 4 Aug 2026 |
| §1 — "what does the customer see between two windows" | No in-between state specified | This spec owns no clocks, so no gap between windows exists. | Ashish Raj (PM), 3 Aug 2026 |
