# Hackathon research update — November 7, 2026

This extends the November 3 workbook and independent review. The recommendation remains a narrow agent-permission project for a generalist team, but its differentiation must be much more modest. The strongest new feasibility finding is that Broome's transit feed is downloadable and parseable. The strongest research correction is that both permission enforcement and adversarial feature-label testing have very close published precedents.

Evidence status: primary-source abstracts and documentation were inspected; public endpoints were queried and two payloads inspected. Paper results were not reproduced. No model inference, user study, routing experiment, or security benchmark was run. Team size, compute access, and the missing Hacker Guide remain unconfirmed. The original documents are preserved.

## 1. What changed

| Earlier uncertainty | New evidence | Decision consequence |
|---|---|---|
| Agent ledger overlaps CaMeL and authorization engines | Progent explicitly checks tool names AND arguments, and distinguishes narrowing from approval-required expansion. IntentCap addresses task intent, field ownership, and short-lived leases. | A scoped grant is not the novelty. Compete on a concrete approval/revocation workflow and measured usability. |
| Feature audit might depend on top examples only | The checked GPT-2 feature has 60 contexts, including 25 whose maximum activation is zero. All 60 have token and activation arrays. | A cached positive/negative prediction pilot is feasible. Sampling provenance and independence from explanation generation are still unresolved. |
| Broome GTFS download failed | HTTP 200 with an explicit research user agent; ZIP parsed into actual schedule tables. | Reopen transit scenario ideas. Do not equate accessible schedules with real-time reliability or a validated router. |
| Consumer checker and flood metadata access | Greenhouse returned 675 job records; NOAA returned its layer metadata. | Both access paths still work; neither resolves user demand or analytical validity. |

Raw observations are recorded in [access_checks.json](research/2026-11-07/access_checks.json), [gtfs_inspection.json](research/2026-11-07/gtfs_inspection.json), and [neuronpedia_sampling.json](research/2026-11-07/neuronpedia_sampling.json).

## 2. Closest prior work missing from our review

These are source-supported descriptions, followed by our project implications. Published performance claims are author-reported, not our measurements.

| Primary source | What overlaps | What we can reasonably contribute |
|---|---|---|
| [Progent, revised May 2026](https://arxiv.org/abs/2504.11703) | Symbolic policies over tool names and arguments; deterministic enforcement; an SMT check distinguishes narrowing from expansions requiring approval. | A smaller, comprehensible calendar grant interface and an empirical comparison of approval burden. No claim to invent argument enforcement or monotonic permissions. |
| [AgentSpec, ICSE 2026](https://arxiv.org/abs/2503.18666) | Runtime constraints using triggers, predicates, and enforcement actions. | A specific workflow evaluation, not a new general guardrail language. |
| [CapScope, September 2026](https://arxiv.org/abs/2609.08371) | Trusted task authority, capabilities held outside model context, and per-agent checks. | A single-user lifecycle demo. Multi-agent isolation would expand scope into an already studied area. |
| [IntentCap, September 2026](https://arxiv.org/abs/2609.14631) | Task-scoped authority assembled from sources with field ownership, short-lived leases, and deterministic checks before side effects. | Explain exactly who supplied each approved field and demonstrate stale approval handling. This is specialization, not an originality claim. |
| [Do SAEs Identify Reasoning Features?, ICML 2026](https://arxiv.org/abs/2601.05679) | Token injection and counterexample construction test whether apparent reasoning features instead track superficial cues. | A small reproduction or teaching experiment with named features, explicit controls, and reproducible records. “We falsify feature labels” alone is already covered. |
| [Descriptive Collision, May 2026](https://arxiv.org/abs/2605.12874) | Different SAE features can share explanations; ordinary detection scores can miss failure to discriminate among features. | A label-ambiguity lesson or a bounded comparison of human predictions across features. Cross-feature data and a fair evaluation would still need validation. |

The practical consequence is not to abandon these ideas: a hackathon can reward excellent application and evaluation. It does mean the pitch must identify an observed benefit rather than presenting established mechanisms as new research.

## 3. Sharpen the ledger into an approval lifecycle experiment

**Proposed question:** Can a person approve a small amount of calendar work once, understand its limits, and revoke remaining authority without sacrificing legitimate completion?

Keep one local calendar, synthetic invitations, one model adapter, and a deterministic gateway. Use an explicit grant form with stable calendar/attendee IDs, a time interval, fixed or restricted text fields, expiration, and use limit. Model-generated suggestions remain proposals until the user approves them.

The memorable demo is a three-step sequence:

1. Approve one legitimate meeting; execute it and show the actual calendar state.
2. Introduce an invitation that requests a different attendee. Show the rejected proposed mutation and the exact approved constraint it violates.
3. Queue a valid proposal, revoke the grant, then attempt execution. Show that the queued proposal no longer has permission.

**New evaluation emphasis:** compare the grant workflow with per-action confirmation as well as prompt-only and tool-name filtering. A confirm-every-action baseline is directly relevant to the claimed reduction in interruption. Use the same trusted approval mechanism and simulated state across conditions; do not assume every human confirmation is correct.

Measure unauthorized state changes, valid completions, confirmations per completed task, and whether testers can predict which actions a grant permits. A teammate pilot is exploratory, not representative user evidence. Separate direct malformed-call tests from model-generated attacks.

Add lifecycle cases to the old review's suite: expiry while queued; revocation before execution; two concurrent uses of a one-use grant; retry after success; edited arguments after approval; a too-broad grant that legitimately permits an unwanted action. Validate and consume a grant atomically with the local mutation. Revocation prevents later execution; it does not undo a committed action. External calendar transaction semantics are outside this prototype.

**Decision:** still the strongest generalist demo if a real model adapter is available quickly. Its contribution is implementation plus a measured workflow tradeoff. A generic firewall with a trace viewer is insufficient differentiation.

## 4. Interpretability: a feasible pilot, with a narrower claim

The checked [Neuronpedia feature](https://www.neuronpedia.org/api/feature/gpt2-small/0-res-jb/0) has explanations describing military units. Its 60 stored contexts include 35 with positive maximum activation and 25 with zero maximum activation. Every record includes tokens and values. This resolves the narrow question of whether this endpoint contains any negative examples.

It does **not** establish a random corpus sample or unseen evaluation set. The inspected bin metadata is null, and the data-index field does not distinguish the contexts in this payload. Do not use that field alone to split examples. Check normalized text/token duplicates and source provenance before choosing a split. No claim that the label is wrong has been established.

Start with a prediction exercise: show the label and a cached context, record a prediction, then reveal the activation and token position. Compare with a frozen lexical baseline and base-rate baseline. Predeclare the activation threshold and show threshold sensitivity. Do not report population precision from the selected contexts.

For a stronger experiment, add held-out fresh inference or documented independently sampled records. [Neuronpedia's API documentation](https://docs.neuronpedia.org/api-and-data/api) distinguishes public data retrieval from inference-enabled sources and directs bulk users to exports. Neither fresh inference nor broader sampling was tested here.

**Decision:** retain as the low-infrastructure fallback, but call it an educational pilot until independence and sampling are resolved. The newly found falsification and collision papers should be cited in the pitch.

## 5. Local infrastructure: a real blocker is now smaller

The [official Broome GTFS archive](https://broomecountyny.gov/sites/default/files/dept/transit/BCT_GTFS.zip) parsed successfully. Observed table sizes:

| Table | Rows |
|---|---:|
| Routes | 23 |
| Stops | 797 |
| Trips | 834 |
| Stop times | 27,977 |
| Shape points | 22,687 |
| Transfers | 60 |

Feed metadata identifies version `20260822`, with advertised coverage from August 21, 2026 through December 31, 2027. Individual service calendars have different ranges, including university-specific service ending sooner. Those metadata dates do not certify correctness or guarantee all services operate throughout that interval. A default Python request returned 403 while the explicit research user agent succeeded; plan for access fragility.

**Reopened project:** “What happens to a student's scheduled trip if one connection becomes unavailable?” Restrict it to a small set of origins and destinations and compare the original schedule with one explicitly simulated closure. This is a more defensible first scope than a full flood evacuation router.

Before committing: apply calendar exceptions for the selected date, verify trip/stop/service references, inspect transfer semantics, and manually check a handful of itineraries against official schedules. No such routing validation was completed in this pass. Do not infer accessible walking links from stop proximity or treat a route shape as a drivable road network.

The [NOAA map service](https://mapservices.weather.noaa.gov/static/rest/services/NWS_FIM/FIM_bngn6/MapServer) is still accessible, but combining it with transit introduces additional assumptions. A stop or line intersecting a flood polygon does not establish an operational closure. Keep flood impact as a separately labeled scenario extension until stage/elevation and network semantics are checked.

**Decision:** transit moves from an access-blocked idea to a viable data investigation. It does not yet displace the ledger: routing correctness, user value, and whether AI adds useful functionality remain open.

## 6. Event facts and selection now

The [official event page](https://hackathon.binghamton.org/) confirms November 7–8, 2026, the four tracks, and responsibility, technical depth, and real-world impact as judging themes. It does not supply the full rulebook. Do not import rules from the separate March HackBU event surfaced in searches. The guide referenced in the original workbook is still absent from this workspace.

| Choose this | When |
|---|---|
| Calendar permission lifecycle | Generalist builders, working text-model access, and a desire for a clear interactive security demo. |
| Feature-label prediction pilot | Limited infrastructure, interest in interpretability, and willingness to make narrow claims about cached examples. |
| Transit disruption scenario | A builder comfortable with GTFS/routing and a reachable student or planner with a specific access question. |
| Job consistency receipt | A consumer-facing product is preferred; validate understanding of “listing matches” versus “sender authenticated.” The public job API remains available. |
| Causal feature microscope | Only after the exact model/intervention stack and a reproducible target behavior work. This pass did not resolve that prerequisite. |

The next decision should follow a short feasibility experiment on one of these paths, not another expansion of the 36-idea list. My default remains the calendar lifecycle project, with an explicit acknowledgment that its enforcement mechanism applies existing research.
