# NYCAIRR Hackathon Idea Research and Selection Workbook

**Prepared November 3, 2026 for the November 7–8 hackathon**  
**Purpose:** build a research-grounded pool of project directions, adjacent ideas, evidence and measurable selection criteria. This is an idea-generation document, not a claim that any concept below is novel or that a prototype would solve the full societal problem.

## How to use this workbook

The strongest hackathon pitch usually joins four things: a specific person with a real problem, evidence that the problem matters, a convincing live demonstration, and a measured result from the prototype. A large national statistic can make the stakes legible, but it is not the number your project has fixed. Say “14 million older adults report a fall each year; our prototype flagged 18 of 20 scripted hazards in this test,” rather than implying the prototype prevented 14 million falls. The latter would be a false impact claim.

The event’s guide calls for responsible AI, source code available publicly, an honest AI-use disclosure, a clear demo, and a project started in the hacking window. The four event tracks are Agentic Development, Markets & Networks, Improving Infrastructure, and Environment. A helpful concept should fit at least one track cleanly and have a small, testable core.

The names below are working labels I coined to make the ideas easy to discuss. The underlying problem areas, tools, data, and statistics are tied to sources listed at the end. Treat the product concepts as hypotheses to check against existing tools before claiming novelty.

## What the three tool interests contribute

| Tool or area | Verified capability | Good role in a weekend prototype | Constraint to check |
|---|---|---|---|
| **Jev / TypeSafe** | Jev answers typed questions about supplied state, including Choice, Noul (truth probability), Score, and Box. Its guidance recommends exposing judgments to the application and keeping consequential rules in ordinary code. | Classify a document, rank evidence against a claim, locate a relevant object in an image, or score a visible property. Compare with a small language model or a transparent baseline. | Do not pitch it as a general agent or calculator. Any live API experiment sends the supplied state to TypeSafe and may use an API key, so check the current docs, data sensitivity, and available credits first. No live call has been made for this research. |
| **Neuron exploration / interpretability** | Neuronpedia provides public feature/activation data and tools for exploring SAE features, attention heads, steering, circuit tracing, and APIs. TransformerLens supports causal activation interventions on supported models; current docs list Qwen2 among architectures for some patching operations. | Let a judge inspect a feature or activation, change it, and see a behavioral difference. Better still, test whether that difference generalizes to held-out examples and whether it has unwanted side effects. | A feature label or pretty activation map is not proof of a causal mechanism. Support depends on the exact model, weights, hooks, and method. Confirm the selected Qwen checkpoint is supported before committing. |
| **Open-weight Qwen** | Qwen3-4B’s model card reports an Apache-2.0 license. Open weights make local inference and access to activations feasible. | Use a compact checkpoint to compare behavior before and after an intervention, or compare model outputs with Jev’s structured judgments. | Check the exact model card, tokenizer, prompt template, quantization, context length, GPU memory, and interpretability bridge. Model family support does not guarantee that every method works on every checkpoint. |

Source notes: [TypeSafe documentation index](https://docs.typesafe.ai/llms.txt), [Neuronpedia docs](https://docs.neuronpedia.org/), [TransformerLens analysis-tool compatibility](https://transformerlensorg.github.io/TransformerLens/content/analysis_tools.html), [Qwen3-4B model card](https://huggingface.co/Qwen/Qwen3-4B). The user’s tool interests are a useful design constraint, not a requirement. Many strong ideas below can use one, several, or none of them.

## The headline numbers, with honest framing

| Problem area | Public evidence | What the statistic does and does not say |
|---|---|---|
| Older adult falls | CDC says more than **14 million** U.S. adults 65+ report falling each year. The age-adjusted fall-death rate increased **21%** from 2018 to 2024. | National stakes; a hackathon demo cannot claim to reduce the national count. Build around hazard detection, accessibility, or screening support and measure a bounded task. |
| Consumer fraud | FTC’s 2024 data book reports **2.6 million fraud reports**, **987,520** reports with a reported loss, and **$12.537 billion** in reported losses. FTC says reported job-scam losses rose from **$90 million in 2020 to $501 million in 2024**. | Self-reported data, not a full count of fraud. Good motivation for testing warning explanations, evidence extraction, or scam-message triage. |
| Extreme weather | NOAA counted **27** U.S. weather/climate disasters costing at least $1 billion each in 2024, with estimated costs of **$182.7 billion**. Its 2015–24 total was approximately **$1.4 trillion** across 190 disasters. | Climate and disaster planning are high-impact areas. NOAA updates estimates as costs arrive. This supports resilience tools, not a claim of avoided losses. |
| Local flood planning | The Susquehanna River Basin Commission lists an online inundation map for the **Susquehanna at Binghamton**. NOAA’s map service exposes stage-specific modeled depth layers and an API link. | Concrete local data and a striking map demo. NOAA says the map is approximate and for planning reference, not navigation or permitting. |
| Transit access | Broome County has an official GTFS schedule listing for developers. The U.S. DOT notes static GTFS alone cannot establish service reliability. | Local routes are available to build on, but historic or real-time delay data needs separate verification. A simulated delay must be labeled as a simulation. |
| Road safety | NHTSA’s 2023 fatality data and 2024 estimates provide official crash totals and breakdowns. | For a project, use an explicit geographic/time subset and compare a detector or explainer against labeled cases. Avoid claiming hypothetical prediction prevents crashes. |
| Content provenance | C2PA is an open standard for content history and provenance. The standard and government explainers explicitly caution that provenance metadata alone cannot establish whether content is true. | A project can teach users to interpret evidence of origin, including missing metadata, without presenting a “real/fake” oracle. |

Sources: [CDC older adult falls](https://www.cdc.gov/falls/data-research/index.html), [FTC 2024 Consumer Sentinel Data Book](https://www.ftc.gov/system/files/ftc_gov/pdf/csn-annual-data-book-2024.pdf), [FTC job-scam and consumer summary](https://consumer.ftc.gov/consumer-alerts/2025/03/top-scams-2024), [NOAA 2024 climate assessment](https://www.ncei.noaa.gov/news/national-climate-202413), [SRBC inundation maps](https://www.srbc.gov/our-work/programs/planning-operations/flooding/inundation-maps/index.html), [NOAA Binghamton flood service](https://mapservices.weather.noaa.gov/static/rest/services/NWS_FIM/FIM_bngn6/MapServer), [Broome County GTFS listing](https://broomecountyny.gov/transit/gtfs), [U.S. DOT Learning Agenda](https://www.transportation.gov/sites/dot.gov/files/2024-11/DOT_Learning_Agenda_FY_2024-2026.pdf), [NHTSA fatality release](https://www.nhtsa.gov/press-releases/nhtsa-estimates-39345-traffic-fatalities-2024), [C2PA explainer](https://c2pa.org/specifications/specifications/2.2/explainer/Explainer.html).

## Idea bank

Each idea names a user, a demo, a weekend-sized test, and the most relevant research/tool angle. “New” means a candidate angle worth checking, not verified originality. Every project should show at least one failure case and state the limits of its data.

### Interpretability as a user-facing capability

#### 1. Feature-to-failure microscope

**Track:** Agentic Development. **User:** a model developer trying to understand a harmful or brittle answer. **Demo:** show one Qwen answer that changes under a controlled prompt variation, surface candidate Neuronpedia features or activation changes, then patch or ablate one supported component and rerun the pair. **Test:** 20–50 matched prompt pairs, held-out paraphrases, and at least one unrelated behavior check. Measure whether the intervention changes the target answer, its generalization rate, and collateral changes. **Why it could land:** a judge can see a causal intervention, not just an interpretability visualization. **Risk:** “feature X means deception” is too strong unless validated. **Tools:** Qwen, TransformerLens or Neuronpedia, possibly Jev to label semantic outcomes independently.

#### 2. Refusal boundary cartographer

**Track:** Agentic Development. **User:** an evaluator checking whether an assistant refuses harmful requests consistently. **Demo:** vary one attribute at a time across benign, ambiguous, and disallowed prompts; show output changes and activation/feature differences. **Test:** measure harmful-request refusal rate, benign-request false refusal rate, and consistency across paraphrases. Use a public safety dataset or a small transparently authored set. **Research angle:** investigate whether a candidate internal signal predicts the actual behavioral boundary on held-out prompts. **Limit:** do not present a single neuron as a universal refusal switch; monitor for over-refusal and prompt leakage.

#### 3. Confidence calibration dashboard for internal signals

**Track:** Agentic Development. **User:** an evaluator deciding when to trust an automated label. **Demo:** compare Jev’s typed probabilities, a Qwen classifier’s verbal confidence, and an interpretable feature score on the same labeled cases. **Test:** Brier score, calibration bins, abstention coverage, and error severity on a held-out split. **Research angle:** does the feature add evidence beyond output confidence? **Limit:** confidence numbers from different systems may not mean the same thing; calibrate each against outcomes.

#### 4. Neuron label stress test

**Track:** Agentic Development. **User:** a researcher browsing SAE explanations. **Demo:** select a public feature description, retrieve activating and non-activating examples, and let the judge guess which examples truly fit before showing the label. **Test:** human agreement, precision/recall against hand labels, and stability across paraphrases and domains. **Research angle:** quantify how often a readable label overstates what the feature detects. **Why it matters:** interpretability tools invite people to anthropomorphize terse labels. **Limit:** label quality depends on the chosen model and available feature dataset.

#### 5. Causal evidence versus compelling explanation

**Track:** Agentic Development. **User:** a model auditor. **Demo:** place an LLM-generated explanation beside a causal patching result and an adversarial counterexample. **Test:** ask blinded reviewers to predict which intervention changes the output; measure accuracy and confidence. **Research angle:** do explanation text and causal evidence agree on the cases they purport to explain? **Limit:** activation patching has known methodological subtleties, so define the metric and paired prompts carefully. [Activation-patching methodology paper](https://arxiv.org/abs/2404.15255).

#### 6. Interpreter’s side-effect radar

**Track:** Agentic Development. **User:** someone applying a steering vector or feature intervention. **Demo:** tune a vector to improve one behavior, then show a dashboard of side effects on unrelated safety, helpfulness, and style prompts. **Test:** target score gain minus regressions across a preregistered evaluation suite; show all metrics, not only the win. **Tools:** Neuronpedia steering or local activation hooks with Qwen. **Research question:** can small tests warn about broad behavioral drift? **Limit:** the test suite is only a proxy for real-world behavior.

#### 7. Circuit claim notebook

**Track:** Agentic Development. **User:** student learning mechanistic interpretability. **Demo:** an interactive notebook that records a claim, evidence, intervention, counterexample, and confidence for one Qwen behavior. **Test:** another student follows the notebook and reproduces the effect; record rerun success and agreement. **Pitch value:** gives judges an auditable mini research artifact. **Limit:** more educational tool than direct societal intervention, so tie it to reproducibility and responsible AI.

### Safer model and agent behavior

#### 8. Permission ledger for tool-using agents

**Track:** Agentic Development. **User:** an assistant user who wants actions limited to their request. **Demo:** an agent reads untrusted email or web text, proposes calendar/email actions, and a deterministic permission layer rejects actions outside a compact user-granted scope. **Test:** use AgentDojo tasks or a local synthetic suite; report attack success, task completion, false blocks, and how often confirmation is needed. **Evidence:** NIST describes indirect prompt injection and emphasizes adaptive, task-specific evaluation. **Novelty caveat:** AgentDojo already evaluates attacks and defenses; the contribution needs a precise new policy or evaluation question. [NIST](https://www.nist.gov/news-events/news/2025/01/technical-blog-strengthening-ai-agent-hijacking-evaluations) · [AgentDojo](https://github.com/ethz-spylab/agentdojo).

#### 9. Prompt-injection “flight recorder”

**Track:** Agentic Development. **User:** developer debugging a risky agent run. **Demo:** replay a run as a timeline separating user instruction, retrieved text, model proposal, policy check, and tool call. **Test:** give reviewers a set of safe and hijacked traces and ask them to identify the source of each action; measure diagnosis time and accuracy. **Tools:** Qwen can generate a local trace; Jev can classify whether a step is supported by the original request. **Risk:** classifying a trace alone does not secure the agent; enforce tool permissions in code.

#### 10. The abstention switchboard

**Track:** Agentic Development. **User:** a person using an AI assistant in an ambiguous or high-impact situation. **Demo:** let the user set error cost and observe the system answer, ask a clarifying question, or hand off to a human. **Test:** risk-coverage curve, accuracy among answered cases, unnecessary abstentions, and performance on adversarial ambiguity. **Tools:** Jev’s structured judgments are a plausible classifier; a Qwen model can provide a comparison. **Pitch:** responsible behavior becomes measurable as the tradeoff between coverage and errors.

#### 11. “Show me the evidence” answer verifier

**Track:** Agentic Development. **User:** someone reading an AI answer about a supplied document. **Demo:** highlight the exact passage supporting each extracted claim, then flag unsupported claims and missing context. **Test:** citation precision, claim coverage, and unsupported-claim detection on a small set of reports. **Tools:** retrieval plus Jev’s relevance judgments, Qwen for the draft answer, deterministic citation matching. **Risk:** passage relevance is not proof of entailment; score each atomic claim and include a “not enough evidence” path.

#### 12. Hidden assumption detector for agent plans

**Track:** Agentic Development. **User:** an operator approving a multi-step agent plan. **Demo:** show the plan with assumptions such as identity, authorization, recipient, and reversibility exposed as checkboxes. **Test:** seed plans with known missing assumptions, measure recall, false alarms, and whether reviewers catch the risky step faster. **Tools:** Jev for atomic judgments, code for rule table, Qwen for plan drafting. **Limit:** generated checklist must be evaluated against expert-authored cases.

#### 13. Local model “red team in a box”

**Track:** Agentic Development. **User:** developer checking a small open-weight model before deployment. **Demo:** run a curated set of prompt-injection and policy-violation cases against Qwen and compare a baseline with a simple defense. **Test:** attack success by scenario type, benign task success, and reproducible JSON traces. **Research footing:** published AgentDojo and government evaluations establish this as an active research problem. **Differentiator needed:** focus on a use case or a defense tradeoff that current benchmarks don’t capture.

### Market fairness, financial information, and scams

#### 14. Scam message evidence coach

**Track:** Markets & Networks. **User:** student or older adult unsure whether a text/email is a scam. **Demo:** paste a message, get a few concrete warning signs with highlighted evidence and a safe next step, such as independently contacting the institution. **Scale:** FTC logged 2.6 million fraud reports and $12.5 billion in reported losses in 2024. **Test:** balanced legitimate/scam set; measure recall of high-risk messages, false alarms, evidence citation accuracy, and time to a safe choice. **Tools:** Jev can make typed judgments about urgency, impersonation, payment request, and evidence; code combines judgments. **Limit:** never claim to determine truth from wording alone; scammers and legitimate messages vary.

#### 15. Investment pitch claim checker

**Track:** Markets & Networks. **User:** novice investor reading an investment promotion. **Demo:** extract promises, projected returns, time pressure, and claims of guaranteed income; show which claims are factual and which need independent evidence. **Scale:** FTC reports $5.7B in reported investment-scam losses in 2024, with a median loss over $9,000 among reports. **Test:** evaluate extraction against hand labels and test if users distinguish a factual claim from a persuasion tactic. **Risk:** avoid individualized investment advice; present education and sources, not a verdict on an offering.

#### 16. Job listing consistency checker

**Track:** Markets & Networks. **User:** job seeker evaluating a listing. **Demo:** compare listing details with a company’s official careers page and flag suspicious requests for payment, checks, personal data, or off-platform contact. **Scale:** FTC-reported job-scam losses grew from $90M in 2020 to $501M in 2024. **Test:** provenance/source verification accuracy, false-positive rate on real listings, and warning comprehension. **Tools:** retrieval and deterministic comparison; Jev may extract request types. **Limit:** source freshness and lookalike domains are difficult; don’t label a company a scam based on a weak match.

#### 17. Consumer complaint pattern explainer

**Track:** Markets & Networks. **User:** consumer advocate or local reporter. **Demo:** search FTC aggregate complaint data or an open complaint dataset and show emerging patterns with a transparent denominator and time range. **Test:** reproduce counts from source CSV, identify change points on held-out dates, and show sampling/under-reporting notes. **Tools:** no LLM needed for calculations; Jev could classify text only if public complaint text is available and allowed. **Risk:** complaint volume does not prove wrongdoing or prevalence.

#### 18. Source concentration map for viral claims

**Track:** Markets & Networks. **User:** reader assessing whether several articles independently corroborate a claim. **Demo:** map citation, quotation, and link relationships across a small article collection; show shared roots and missing primary sources. **Test:** precision/recall of known citation relationships, number of genuinely independent roots, and user calibration. **Adjacent to the prior “Echo Receipt” idea**, but grounded as a provenance graph, not a promise of truth detection. **Tools:** document extraction; Jev can judge whether a cited passage supports an atomic claim. **Limit:** separate origin evidence from truth.

#### 19. Content credential explainer

**Track:** Markets & Networks. **User:** person receiving a photo/video online. **Demo:** inspect a C2PA-signed sample and a metadata-stripped copy; explain exactly what the credential says and what it cannot establish. **Test:** before/after user comprehension questions on source, edit history, and truth. **Evidence:** C2PA explicitly says provenance is not a misinformation cure-all. **Risk:** absence of metadata must never be called proof that content is fake or human-made. [C2PA explainer](https://c2pa.org/specifications/specifications/2.2/explainer/Explainer.html).

#### 20. Fairness stress test for a lending-style classifier

**Track:** Markets & Networks. **User:** reviewer inspecting a toy credit-risk model. **Demo:** flip one protected or proxy attribute while holding the rest fixed, then show prediction changes and feature effects. **Test:** subgroup false-positive/false-negative rates, calibration, and counterfactual sensitivity on a public benchmark. **Tools:** Qwen/Neuron exploration could inspect text models, but a transparent tabular baseline may make the fairness claim stronger. **Limit:** fairness metrics conflict and dataset labels encode history. Define the harm and metric before optimizing.

#### 21. Price disparity receipt

**Track:** Markets & Networks. **User:** consumer comparing public prices across identical product listings. **Demo:** normalize product, shipping, fees, quantity, and date, then show comparable price spreads with citations. **Test:** matching precision and total-price computation on a hand-labeled set. **Tools:** Jev can help judge whether two descriptions denote the same product; code should compute the actual price comparison. **Risk:** public offers aren’t proof of discriminatory pricing.

### Infrastructure, local service access, and safety

#### 22. Flood-stage explainer for Binghamton

**Track:** Improving Infrastructure or Environment. **User:** resident or student planning around a river-stage scenario. **Demo:** select a river level, map modeled depth layers, and answer “what does this map cover here?” with source links and uncertainty visible. **Data:** NOAA provides a Binghamton gauge/API link and depth layers; SRBC maintains the map library. **Test:** validate rendered layer selection against official maps and check that claims cite the correct stage. **Strong local hook:** use historical 2011 flood context from the NWS Binghamton office. **Limit:** NOAA classifies the map as approximate planning reference, not operational evacuation or navigation guidance. [NOAA](https://mapservices.weather.noaa.gov/static/rest/services/NWS_FIM/FIM_bngn6/MapServer) · [NWS 2011 flood account](https://www.weather.gov/bgm/pastfloodseptember072011).

#### 23. “Can I reach it?” transit access audit

**Track:** Improving Infrastructure. **User:** local planner checking access to a hospital, food pantry, or campus. **Demo:** compute transit travel time from a grid of neighborhoods at several departure times and compare access by scenario. **Data:** Broome County publishes GTFS; OpenTripPlanner is a mature open-source routing engine. **Test:** validate a sample of routes manually, measure time to destination and neighborhood coverage, then simulate one canceled trip. **Limit:** unless verified, schedule-only data does not demonstrate real-world reliability. **Novelty check:** focus on a specific access gap or transparent uncertainty, not generic route planning. [Broome GTFS](https://broomecountyny.gov/transit/gtfs) · [DOT reliability note](https://www.transportation.gov/sites/dot.gov/files/2024-11/DOT_Learning_Agenda_FY_2024-2026.pdf) · [OpenTripPlanner](https://docs.opentripplanner.org/en/latest/).

#### 24. Access loss under service disruption

**Track:** Improving Infrastructure. **User:** transit planner. **Demo:** compare who loses access to essential destinations when a trip or transfer is removed from a published schedule. **Test:** number of reachable destinations before/after, affected population by census tract if matching data is feasible, and reroute time. **Differentiator:** maps the consequence of a disruption rather than presenting another trip planner. **Limit:** call it a scenario simulation unless real delay/cancellation data is obtained.

#### 25. Safer walking route with transparent tradeoffs

**Track:** Improving Infrastructure. **User:** pedestrian choosing a route to transit, campus, or a service. **Demo:** compare shortest route with an alternative using sidewalk/lighting/crash indicators and let the user see why edges receive a penalty. **Test:** route length, hazard exposure proxies, accessibility coverage, and expert review of assumptions. **Evidence:** NHTSA has official fatality and crash data. **Limit:** crash records lag and risk proxies can stigmatize neighborhoods; never market a route as safe without validation.

#### 26. Accessible route audit from street images

**Track:** Improving Infrastructure. **User:** wheelchair user or accessibility advocate. **Demo:** identify a sidewalk obstruction, curb ramp, or missing crossing from a photo and link it to the street segment. **Test:** precision/recall on labeled images and subgroup performance across lighting, weather, mobility devices, and camera angles. **Tools:** Jev Box can locate visual objects; a vision model could be benchmarked. **Limit:** image-based detection is not a substitute for lived-experience validation or a complete accessibility audit.

#### 27. Emergency message translator with fidelity checks

**Track:** Improving Infrastructure. **User:** resident reading a flood or severe-weather alert in plain language or another language. **Demo:** simplify an official alert, preserve timing/location/action, and highlight each sentence’s source span. **Test:** compare extracted facts with official alert, readability, translation review by fluent speakers, and omission rate. **Tools:** Qwen draft plus typed factual checks. **Risk:** a false or missing instruction is high cost; use a narrow data set and never claim official status.

#### 28. Road-work and crash notice deduplicator

**Track:** Improving Infrastructure. **User:** commuter or city operations team. **Demo:** group duplicate reports from public notices and show one normalized incident with source/time. **Test:** duplicate-clustering precision, missed-event rate, time-to-correct-status. **Tools:** Jev can judge semantic sameness; code handles timestamps/geography. **Limit:** use open, permitted feeds and show stale status.

### Environment, energy, and climate

#### 29. Grid recommendation constraint checker

**Track:** Improving Infrastructure or Environment. **User:** grid operator reviewing a model recommendation. **Demo:** feed a toy dispatch recommendation into physics/business constraints and flag violations with an explanation. **Test:** detect deliberately infeasible cases and preserve feasible cases; quantify false alarms. **Research context:** the Center’s public agenda explicitly connects physics-informed ML to energy systems. **Tools:** a small Qwen model can explain a deterministic checker’s result; it should not perform the physical constraint calculation. **Limit:** toy grid only; clearly state that no operational system is being controlled.

#### 30. “What is this building wasting?” energy anomaly scout

**Track:** Environment. **User:** facilities manager. **Demo:** identify unusual consumption in public building energy time series and point to the period and comparison baseline. **Test:** injected anomaly detection precision, lead time, and false alerts per building-month. **Tools:** interpretable statistics or time-series baseline first; Qwen can turn evidence into a concise explanation. **Limit:** anomaly does not automatically equal waste; weather, occupancy, and meter errors matter.

#### 31. Heat-risk outreach prioritizer

**Track:** Environment. **User:** local public-health or community group deciding where to offer cooling resources. **Demo:** combine public heat indicators and vulnerability data to explain which areas face elevated exposure. **Test:** reproduce a transparent index, run sensitivity analyses over weights, and compare ranking changes. **Metric:** coverage of high-heat census blocks per outreach location. **Limit:** avoid individual-level inference; community validation and data age matter.

#### 32. Flood map to infrastructure dependency map

**Track:** Environment / Improving Infrastructure. **User:** local planner identifying assets potentially exposed under a river-stage scenario. **Demo:** overlay NOAA inundation layers with open roads, transit stops, or public facilities and reveal which connections could be affected. **Test:** verify GIS overlays and feature counts against source layers. **Novelty candidate:** join official flood depth with service accessibility, rather than just visualizing flood extent. **Limit:** exposure is not failure probability; keep the map’s planning-only caution visible.

#### 33. Food-rescue routing with uncertainty

**Track:** Environment. **User:** food pantry or volunteer driver allocating surplus pickups. **Demo:** match donated food quantity/expiry to pantry need and travel distance; show how uncertainty in pickup timing changes waste. **Test:** simulated pickup scenarios, kilograms delivered before expiry, missed pickups, and fairness across pantry sites. **Limit:** actual partner data and food-safety rules are essential; with no partner, label scenario data as synthetic.

#### 34. Personal carbon “receipt” with evidence trail

**Track:** Environment. **User:** person or campus group checking the source of an emissions estimate. **Demo:** select an activity and show factor, unit, year, and calculation rather than a black-box score. **Test:** hand-check arithmetic and compare factor provenance; evaluate whether users understand uncertainty. **Tools:** code for calculations, Jev only to classify ambiguous descriptions. **Limit:** a precise-looking estimate can hide uncertain lifecycle assumptions.

#### 35. Wildfire smoke school-day decision aid

**Track:** Environment. **User:** school administrator choosing indoor/outdoor activity under smoke conditions. **Demo:** show an official air-quality observation/forecast, cited threshold, and an editable policy rule. **Test:** replay historic days and compare decisions with the selected public guidance; measure source accuracy and delay. **Limit:** public-health guidance changes; consult current authoritative sources, and do not let a model invent thresholds.

#### 36. Climate claim evidence table

**Track:** Environment or Markets & Networks. **User:** reader checking a climate headline. **Demo:** split the headline into numeric claims, retrieve primary datasets, and show units, base period, and source date. **Test:** numeric extraction exact match, citation accuracy, and whether the evidence answers the same geographic/time claim. **Tools:** Jev can rank evidence passages; code verifies arithmetic/units. **Limit:** don’t reduce scientific uncertainty to true/false without context.

## Adjacencies and useful combinations

These are combinations worth exploring after choosing one core problem. They add depth when they support a measurable question, but can become scope traps if treated as separate products.

| Core idea | Adjacent extension | Why it may strengthen the pitch | Keep it bounded by |
|---|---|---|---|
| Feature-to-failure microscope | Red-team generator for the feature’s claimed meaning | Tests whether the label survives adversarial counterexamples | A fixed set of generated and human-checked cases |
| Flood-stage explainer | Add transit stops, road links, or public buildings | Makes impact concrete for local infrastructure | One gauge, several stages, a small set of asset layers |
| Scam evidence coach | Add a “teach me the warning sign” mini lesson | Measures learning and transfers beyond one message | Pre/post comprehension on a small blinded set |
| Permission ledger | Add interpretable trace of why each tool action was allowed | Connects agent safety with auditability | A handful of actions and one permission policy |
| Transit access audit | Add a route disruption counterfactual | Shows how brittle access can be | Published schedule plus clearly marked simulations |
| Content credential explainer | Add a provenance graph across a handful of sources | Shows origin and repost chains | Provenance claim only; no authenticity verdict |
| Interpretability steering | Add regression tests for unintended side effects | Converts a one-off demo into a safety workflow | Small fixed suite and one supported checkpoint |
| Grid constraint checker | Add natural-language explanation of failed constraints | Combines dependable computation with accessible output | Keep the checker deterministic and the model advisory |

## What tends to make a hackathon entry convincing

The guide’s judging criteria are originality, design, utility/impact, execution, and technical complexity. The rubric below turns these into observable evidence. It also adds hard gates, because a polished claim without a working, reproducible test is difficult to judge fairly.

### Hard gates before scoring

1. **Problem and affected user are specific.** State who encounters it, in what situation, and what they do today.
2. **A working vertical slice exists.** A judge can use it end-to-end without the team manually faking the result.
3. **The project has a baseline.** Compare against a no-AI rule, an existing tool, or a simple model. Explain why the baseline is fair.
4. **Evaluation cases are held out.** Keep some examples untouched until final measurement. Include ordinary, edge, negative, and failure cases.
5. **The risk is surfaced.** Demonstrate at least one miss or limitation and what the system does when uncertain.
6. **Reproducibility is real.** Public repository, readable run instructions, sample data, pinned model/checkpoint and versions, and a few meaningful commits during the event.
7. **AI usage and data handling are disclosed.** Follow the event guide. Do not upload private or identifying data to an external model without authorization.

### Weighted idea scorecard

Score each dimension from 1 to 5, multiply by its weight, and divide by five for a 100-point total. A high total helps compare options; it does not override a failed hard gate.

| Criterion | Weight | 1 point | 3 points | 5 points |
|---|---:|---|---|---|
| **Evidence of a real problem** | 15 | Vague claim, no credible source | Credible source and a clear affected group | Primary source, defined population/time/place, and a direct user scenario |
| **Impact story and denominator** | 10 | Big statistic with no causal connection | Statistic is relevant but local reach is uncertain | Clear number at risk, reachable subset, and careful statement of what the prototype changes |
| **Demo clarity** | 12 | Needs long explanation or staged outputs | One clear flow with a visible result | Judge can trigger a meaningful before/after and understand why it matters in under a minute |
| **Measurable performance** | 15 | Anecdotal examples only | Baseline and a small test set | Held-out cases, meaningful metrics, uncertainty/error analysis, and a fair baseline |
| **Technical depth** | 12 | Thin wrapper or static dashboard | Several components integrated | Strong technical question, causal or systems-level evidence, reproducible implementation |
| **Responsible-AI fit** | 12 | AI included without need or guardrails | Risks identified and basic handling shown | Human impact, uncertainty, privacy, failure handling, and misuse are tested in the design |
| **Weekend feasibility** | 10 | Depends on inaccessible data, partners, or heavy compute | Working demo possible with a stub or sample data | Core can be built in hours with available tools and has graceful fallback paths |
| **Distinctiveness / prior-work gap** | 8 | Existing product already does the same thing | Useful specialization, unclear difference | A named, sourced gap and a test that demonstrates a distinct contribution |
| **Pitch and source credibility** | 6 | Unsourced claims and unclear demo story | Sources and limits are present | One evidence-backed headline, transparent calculation, memorable live test, and clear credits |

**Useful decision rule:** advance only ideas scoring at least 3 on feasibility, evaluation, and responsible-AI fit. A project with a very large headline number but weak testability should usually lose to a smaller problem with a stronger demonstration.

### Metrics menu by project type

| Project type | Minimum useful metrics | Better test |
|---|---|---|
| Classifier / triage | Precision, recall, false-positive rate, abstention rate | Calibration, subgroup results, error cost by class |
| Evidence retrieval / claim checking | Recall@k, citation precision, unsupported-claim rate | Claim-level human review, evidence entailment, source freshness |
| Vision locator | IoU or box accuracy, precision/recall | Performance by image conditions, missed-object cost, human review agreement |
| Agent safety | Attack success rate, benign task completion | By attack family, impact severity, false blocks, attempts-to-success |
| Interpretability intervention | Target behavior change, held-out generalization | Causal patch effect with uncertainty, side-effect regression suite |
| Routing/accessibility | Route length/time, destinations reachable, exposed assets | Counterfactual closures, neighborhoods/groups, schedule vs real-time data |
| Flood/energy/environment dashboard | Source-data fidelity, calculation agreement | Scenario validation, uncertainty ranges, user comprehension |
| Human-facing warnings | Comprehension, decision time, correct action | Pre/post randomized study, calibration, over-reliance rate |

### Big-number pitch formula

Use this structure and fill only with verified values:

> **[Source] reports [number] [people/events/dollars] during [time period] in [scope]. Our prototype targets [specific subset or step]. On [N] held-out cases, it [measured result] compared with [baseline]. It still fails on [known case], so it [abstains/escalates/shows the evidence].**

Keep the numerator and denominator in the demo. For example, “18/20 scripted cases caught” is more credible than “90% safer” unless the test and outcome justify that broad statement. Distinguish the public-scale burden from the prototype-scale effect every time.

## Research and feasibility checks to do before committing

1. **Verify the exact model/checkpoint.** Pick a Qwen model that fits the actual GPU or local machine, inspect its license, tokenizer/chat template, activation-hook support, and compatibility with the chosen interpretability tools. TransformerLens docs currently list Qwen2 for some activation-patching paths; test Qwen3 compatibility before making it a dependency.
2. **Try a tiny vertical slice on Friday or at the start.** One model forward, one activation capture or Jev call, one visible result, one scoring script. If this fails, switch to a precomputed open interpretability dataset or a smaller supported model.
3. **Inspect prior art.** Search GitHub, papers, Neuronpedia, challenge leaderboards, and existing public tools for the exact workflow. Keep a one-paragraph “what already exists / what this adds” note in the README.
4. **Check local data access and reuse terms.** Broome’s GTFS page is available through search, but direct retrieval returned an error during this research. Download and validate the feed before building. NOAA flood maps are accessible, but operational claims exceed their stated planning scope.
5. **Design the test before the UI.** Write 10 representative cases, 5 edge cases, 5 cases where the right response is “unknown/abstain,” plus a baseline. Keep several cases hidden until final run.
6. **Choose the one-minute demo moment.** A judge should cause a concrete state change and see a measurable consequence: an injected instruction rejected, a flood stage changed, a feature intervention reversed, or an unsupported claim highlighted.

## Shortlist based on current evidence

These are starting hypotheses, not final rankings. The user’s taste for Jev, neuron exploration, interpretability, and Qwen makes the first and second especially aligned, while the third has strong local relevance and accessible official map layers.

| Candidate | Why it fits | A 22-hour minimum viable proof | Main risk |
|---|---|---|---|
| **Feature-to-failure microscope** | Most directly combines open Qwen with interpretability and a visible experiment | One behavior, one supported checkpoint, matched prompt pairs, one causal intervention, held-out paraphrases and side-effect checks | Unsupported architecture or overclaiming what a feature means |
| **Permission ledger for tool agents** | Clear public-interest issue, research precedent, easy attack/defense demo | Local simulated tools, narrow permission policy, 20–40 attack/benign tasks, baseline and measured outcomes | Crowded prior art; defense needs precise novelty |
| **Binghamton flood-stage explainer** | Strong Binghamton connection, official local stage layers, visual demo | One gauge, 3–5 stages, map layer, cited explanation and manual validation | Source map is approximate and planning-only |

**My present recommendation is to prototype the feature-to-failure microscope first, with the flood explainer as a strong pivot if model compatibility or GPU access is uncertain.** The microscope directly matches the stated interests, and the event guide says eligible early registrants may receive Empire AI credentials on November 5. A tiny compatibility test should decide within 30–60 minutes whether it is feasible. The pitch must make a falsifiable claim such as “this intervention changes the target behavior on held-out examples without crossing our regression thresholds,” not “we discovered the model’s true internal reasoning.”

## Sources and notes

### Event and tools

- Hackathon public site and track descriptions: https://hackathon.binghamton.org/
- User-provided Hacker Guide: attached file titled “Hacker Guide HackBU 2026 – NYCAIRR”. Schedule, prizes, submission expectations, and compute access summarized above come from that guide.
- TypeSafe docs index and Jev capabilities: https://docs.typesafe.ai/llms.txt
- Neuronpedia documentation: https://docs.neuronpedia.org/
- TransformerLens analysis tools and model compatibility caveats: https://transformerlensorg.github.io/TransformerLens/content/analysis_tools.html
- TransformerLens patching API: https://transformerlensorg.github.io/TransformerLens/generated/code/transformer_lens.patching.html
- Qwen3-4B model card/license: https://huggingface.co/Qwen/Qwen3-4B
- AgentDojo research implementation: https://github.com/ethz-spylab/agentdojo
- NIST agent hijacking evaluation guidance: https://www.nist.gov/news-events/news/2025/01/technical-blog-strengthening-ai-agent-hijacking-evaluations
- Activation patching methodology limitations: https://arxiv.org/abs/2404.15255

### Public-interest problem evidence and data

- CDC fall frequency and trend: https://www.cdc.gov/falls/data-research/index.html
- CDC fall facts and healthcare burden: https://www.cdc.gov/falls/data-research/facts-stats/
- FTC Consumer Sentinel 2024 Data Book: https://www.ftc.gov/system/files/ftc_gov/pdf/csn-annual-data-book-2024.pdf
- FTC 2024 scam summary including investment and job losses: https://consumer.ftc.gov/consumer-alerts/2025/03/top-scams-2024
- NOAA 2024 billion-dollar disasters: https://www.ncei.noaa.gov/news/national-climate-202413
- NHTSA 2023 fatality data and 2024 estimate: https://www.nhtsa.gov/press-releases/nhtsa-estimates-39345-traffic-fatalities-2024
- SRBC’s basin inundation maps, including Binghamton: https://www.srbc.gov/our-work/programs/planning-operations/flooding/inundation-maps/index.html
- NOAA Binghamton flood-inundation MapServer and data links: https://mapservices.weather.noaa.gov/static/rest/services/NWS_FIM/FIM_bngn6/MapServer
- NWS Binghamton report on the 2011 flood: https://www.weather.gov/bgm/pastfloodseptember072011
- Broome County transit GTFS listing: https://broomecountyny.gov/transit/gtfs
- U.S. DOT statement about GTFS and reliability: https://www.transportation.gov/sites/dot.gov/files/2024-11/DOT_Learning_Agenda_FY_2024-2026.pdf
- OpenTripPlanner docs: https://docs.opentripplanner.org/en/latest/
- C2PA explainer: https://c2pa.org/specifications/specifications/2.2/explainer/Explainer.html
- HHS Office of Research Integrity content provenance guidance: https://ori.hhs.gov/content-provenance

### Research integrity notes

- The “100k people a year” style is useful only when the source, population, period, and meaning are explicit. The sources here often count reports, estimated losses, or people who self-report an event. They are not interchangeable.
- The ideas are synthesized from known problems and tools. No novelty search can certify that an idea has never been built. A targeted prior-art pass is part of selecting a finalist.
- Numerical estimates copied into a pitch should be rechecked against the linked primary source on demo day. Some annual disaster and fraud totals are revised as data arrives.
- Project impact should be stated as the team’s measured prototype result, separate from the public-scale burden statistic.
