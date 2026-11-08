# Independent review of the NYCAIRR hackathon research

**Verdict: C overall. Build a narrowly scoped permission ledger for an agent, with an inspectable action trace.** The workbook is a good brainstorming and evaluation guide, but an incomplete selection study. Its recommendation to start with a feature-to-failure microscope is driven more by tool interests than by demonstrated user need, a prior-work gap, or a verified implementation path. My safest fallback is a substantially sharpened **neuron-label stress test**. My most ambitious research bet remains the **feature-to-failure microscope**, conditional on expertise, compute, and an early controlled intervention succeeding.

The recommended project is specifically **a user-approved, revocable permission grant enforced on the arguments of a local calendar agent’s tool calls**, evaluated against both prompt-only protection and a tool-name allowlist. A generic agent firewall or another trace viewer would not justify this recommendation. Existing capability-based defenses substantially limit the novelty claim; the opportunity is a clear, usable workflow and an honest measurement of security versus task completion.

Review date: **November 3, 2026, America/New_York.** This report assesses ideas at the proposal stage. No candidate loses points merely because it has not been built. All proposed performance thresholds below are acceptance criteria, **not measured results**.

## Scope, evidence status, and resource assumptions

I read the complete 322-line [NYCAIRR_Hackathon_Idea_Research.md](/Users/lukauljaj/nysairr/NYCAIRR_Hackathon_Idea_Research.md), including its sources, 36 numbered ideas, combinations, scorecard, feasibility checks, and recommendation. It was the only research file in this workspace. The Hacker Guide described at [research line 290](/Users/lukauljaj/nysairr/NYCAIRR_Hackathon_Idea_Research.md:290) was **not present**. Neither an earlier “Echo Receipt” document nor supporting interviews, datasets, experiments, or code were present. I have not treated references to absent material as evidence I inspected. The original research is unchanged.

Throughout this review:

- **Verified** means supported by an inspected primary source or the specific public read-only request described here. Documentation establishes a documented capability, not that this team has successfully integrated it.
- **Inference** means my technical or judging assessment based on those facts.
- **Unresolved** means an assumption needing a test, resource confirmation, or user evidence. A promising hypothesis is not promoted to a verified fact.

The base case is **three builders**, approximately **20–24 productive hours each** over the weekend: one comfortable with frontend work, one with Python/backend integration, and a third sharing evaluation, data preparation, and presentation. Assume competent generalists, **no established mechanistic-interpretability or GIS specialist**, ordinary laptops, no guaranteed GPU or institutional cluster access, and a hypothetical **$50 total API/hosting ceiling**. This is a planning assumption, not a statement of available funds or authorization to spend. Use public or synthetic data. No partner, proprietary dataset, recruited study population, or paid software license is assumed.

With one or two builders and no model API access, the cached-data label audit rises to first place. With an experienced interpretability researcher and an already working local model/intervention stack, the microscope becomes a serious contender. With a GIS specialist and a local planning partner, the flood-access project could pass the ledger. Those are changes in resources and evidence, not rewards for having already built something.

## 1. Grade the research

| Dimension | Grade | Independent assessment |
|---|---|---|
| Accuracy | B | Most checked public statistics and methodological cautions are correct. Several capability and event claims are insufficiently qualified or not independently auditable. |
| Evidence | C | Strong sources establish broad problems and tool availability. They rarely establish demand for the proposed workflow or its incremental benefit. |
| Coverage | D | No systematic competitor comparison. Important direct precedents for the favored ideas are missing. Alternatives are often deferred until after selection. |
| Feasibility | C | The document knows what should be checked, but has not checked enough of it to support its recommendation. Data access, model/SAE identity, controls, labor, and compute remain underspecified. |
| Decision usefulness | C | Useful candidate generation and metrics menu; weak elimination, no completed scores, and little evidence explaining why one project should beat another. |

**Overall C**, rather than an average mechanically computed from these letters. The study is not careless or broadly fabricated. It repeatedly distinguishes national stakes from prototype impact and warns against causal overclaiming. Those are real strengths. But the requested decision is “what should we build this weekend?” and the decisive comparison is mostly left as future work. As a brainstorming workbook it is closer to B; as a build-selection study it earns C.

### The five most consequential weaknesses

1. **Prior art is acknowledged, then postponed instead of used to eliminate weak pitches.** The research tells the builder to inspect prior art at [lines 264–270](/Users/lukauljaj/nysairr/NYCAIRR_Hackathon_Idea_Research.md:264), after offering 36 directions. The microscope at [lines 44–46](/Users/lukauljaj/nysairr/NYCAIRR_Hackathon_Idea_Research.md:44) overlaps established behavior-debugging tools; the ledger at [lines 74–76](/Users/lukauljaj/nysairr/NYCAIRR_Hackathon_Idea_Research.md:74) omits capability/data-flow defenses; the flood overlay at [lines 176–178](/Users/lukauljaj/nysairr/NYCAIRR_Hackathon_Idea_Research.md:176) omits flood-impact GIS. Relevant precedents include [Transformer Debugger](https://github.com/openai/transformer-debugger), [CaMeL](https://arxiv.org/abs/2503.18813), and [Esri Flood Impact Analysis](https://www.esri.com/en-us/industries/blog/articles/discover-the-arcgis-solutions-for-flood-simulation-hydrology-and-impact-analysis). The consequence is overstated opportunity, even without an explicit claim of invention.

2. **“Verified capability” is not a verified end-to-end dependency chain.** The tool table at [lines 16–22](/Users/lukauljaj/nysairr/NYCAIRR_Hackathon_Idea_Research.md:16) bundles models, feature datasets, intervention tools, and image localization too loosely. A Qwen checkpoint loading does not establish a matching SAE, a compatible activation space, or supported hosted inference. Current TypeSafe documentation marks images/Box experimental; current TransformerLens has explicit Qwen3 adapters, so the workbook’s Qwen2-centered compatibility evidence is incomplete. The transit page is discoverable but its linked download failed in this review. The original does disclose some of these risks at [lines 266–269](/Users/lukauljaj/nysairr/NYCAIRR_Hackathon_Idea_Research.md:266); disclosure does not resolve them.

3. **Problem magnitude substitutes for evidence that the proposed intervention is useful.** The statistics at [lines 24–36](/Users/lukauljaj/nysairr/NYCAIRR_Hackathon_Idea_Research.md:24) are mostly sound. They do not establish that another scam explainer will change behavior, that a planner needs this particular flood interface, or that feature dashboards help developers diagnose failures. The named users at [lines 100–110](/Users/lukauljaj/nysairr/NYCAIRR_Hackathon_Idea_Research.md:100) and [lines 128–154](/Users/lukauljaj/nysairr/NYCAIRR_Hackathon_Idea_Research.md:128) are hypothetical personas, not discovery evidence. There are no observed workflows, interviews, current-tool comparisons, or demonstrated bottlenecks. “Millions affected” does not identify a reachable user or an adoption reason.

4. **The selection mechanism is not actually applied, and event-specific assumptions are not auditable.** There is a detailed scorecard at [lines 225–241](/Users/lukauljaj/nysairr/NYCAIRR_Hackathon_Idea_Research.md:225), but no completed comparison. The recommendation explicitly favors tool taste and possible Empire AI access at [lines 273–283](/Users/lukauljaj/nysairr/NYCAIRR_Hackathon_Idea_Research.md:273). The supplied-workbook claims about judging and rules at [lines 10](/Users/lukauljaj/nysairr/NYCAIRR_Hackathon_Idea_Research.md:10), [213](/Users/lukauljaj/nysairr/NYCAIRR_Hackathon_Idea_Research.md:213), and [283–290](/Users/lukauljaj/nysairr/NYCAIRR_Hackathon_Idea_Research.md:283) depend partly on an absent guide. Also, “a working vertical slice exists” at [line 218](/Users/lukauljaj/nysairr/NYCAIRR_Hackathon_Idea_Research.md:218) is a submission gate, not a fair idea-stage selection gate. The useful question now is whether that slice can realistically be built.

5. **Metrics are named without enough experimental design to make their results persuasive.** Twenty to fifty prompt pairs at [line 46](/Users/lukauljaj/nysairr/NYCAIRR_Hackathon_Idea_Research.md:46) do not solve feature-selection bias, multiple comparisons, token alignment, or intervention-induced degradation. The calibration proposal at [lines 52–54](/Users/lukauljaj/nysairr/NYCAIRR_Hackathon_Idea_Research.md:52) does not define a common outcome or independent labels. Detecting planted anomalies at [lines 168–170](/Users/lukauljaj/nysairr/NYCAIRR_Hackathon_Idea_Research.md:168) does not establish energy waste. Reproducing an index at [lines 172–174](/Users/lukauljaj/nysairr/NYCAIRR_Hackathon_Idea_Research.md:172) does not validate outreach effectiveness. The research has the right vocabulary; it needs controls, locked test cases, explicit rejection thresholds, and an account of what each experiment cannot show.

### Decision-critical verification

| Claim or dependency | Finding and status | Effect on selection |
|---|---|---|
| Event date and broad fit | **Verified:** the [official event page](https://hackathon.binghamton.org/) identifies November 7–8, 2026, the four named tracks, and responsibility, technical depth, and real-world impact as judging themes. | Use these public themes for the 5% event-fit score. |
| Detailed rules, judging formula, public-code/AI-disclosure requirements, hacking window, team limits, and November 5 compute credentials | **Unresolved:** these details rely on the absent Hacker Guide. Targeted searches did not locate an accessible full official rulebook. The public page does not establish the workbook’s five-item detailed judging rubric or credential promise. | Do not count promised cluster access as available compute. Confirm the guide before building/submitting; no claim here that the workbook’s guide summary is false. |
| Qwen3-4B license and size | **Verified:** the [model card](https://huggingface.co/Qwen/Qwen3-4B) identifies Apache-2.0, 4.0B parameters, and model/template requirements. **Inference:** two-byte weights alone occupy roughly 8 GB decimal, before caches, activations, framework overhead, or an SAE. | Local inference is plausible; full interpretability on an unspecified laptop is not guaranteed. A 16–24 GB GPU would be a useful planning target for short, selective experiments, not a certified requirement or available resource. |
| TransformerLens compatibility | **Verified:** current docs contain a [Qwen3 dense-model adapter](https://transformerlensorg.github.io/TransformerLens/generated/code/transformer_lens.model_bridge.supported_architectures.qwen3.html). The [analysis guide](https://transformerlensorg.github.io/TransformerLens/content/analysis_tools.html) recommends TransformerBridge for new experiments and warns that model support does not establish every analysis method’s support. | The workbook is too conservative about family support, but still lacks checkpoint/method execution evidence. Pin a release and test output equivalence, hooks, and the actual intervention. |
| Neuronpedia data versus hosted execution | **Verified:** [API documentation](https://docs.neuronpedia.org/api-and-data/api) distinguishes public GET data from inference-enabled sources. A direct GET of [one GPT-2 SAE feature](https://www.neuronpedia.org/api/feature/gpt2-small/0-res-jb/0) returned HTTP 200, two explanations, and 60 activation records without a key. | A cached label audit has a real low-resource path. This does not establish fresh inference, balanced sampling, or compatibility with Qwen. |
| Jev typed text judgments | **Verified:** [quickstart](https://docs.typesafe.ai/introduction/quickstart) documents Choice, Score, Noul and API-key setup. [Noul documentation](https://docs.typesafe.ai/primitives/noul.md) defines its probability output. No inference request was made. | A possible optional classifier; no measured accuracy, calibration, latency, account access, or team credits established. Returned probabilities are not application-specific calibration evidence. |
| Jev image localization | **Verified but incompletely represented in the workbook:** [Box](https://docs.typesafe.ai/primitives/box) and [images](https://docs.typesafe.ai/images) are “Dreamer-ready,” require an explicit experimental header, and may change. | Not a blocker for a weekend experiment. It is a material dependency risk for #26 and should not appear alongside stable text primitives without qualification. |
| Binghamton flood data | **Verified:** [NOAA MapServer](https://mapservices.weather.noaa.gov/static/rest/services/NWS_FIM/FIM_bngn6/MapServer) and its [raster layer metadata](https://mapservices.weather.noaa.gov/static/rest/services/NWS_FIM/FIM_bngn6/MapServer/1) are accessible. [NWPS gauge JSON](https://api.water.noaa.gov/nwps/v1/gauges/bngn6) returned HTTP 200. The [shapefile directory](https://water.noaa.gov/resources/downloads/fim/bgm/bngn6/shapefile/) exposes an archive; HEAD returned HTTP 200 and 152,588,567 bytes. | Display is realistic; extracting defensible exposure/dependency results requires more work. Archive contents were not validated; a full download was stopped. |
| Flood stage, elevation, and map semantics | **Verified:** layer names include 833.0 and 850.0, the service uses EPSG:3857, and the gauge API supplies a NAVD88 datum value of 821.02. **Unresolved:** an authoritative layer-to-stage lookup for the exact downloaded data. The [SRBC information sheet](https://www.srbc.gov/our-work/programs/planning-operations/flooding/inundation-maps/assets/docs/susquehanna-river-binghamton-mapping-tool.pdf) directs users to NWPS stage selection. | Do not label 833.0 as an 833-foot gauge stage, or infer a datum conversion without checking agreement. The geographic study boundary is not all of Binghamton. |
| Broome GTFS | **Partially verified:** the [official page](https://broomecountyny.gov/transit/gtfs/) lists an August 24, 2026 update and a ZIP. Requests to the linked `/sites/default/files/dept/transit/BCT_GTFS.zip` returned 404 and, on a later attempt, 403. | A published listing is not a validated working feed. Calendar validity, stop/trip contents, and real-time data remain unverified. #23/#24 need a feed-access gate. |
| Official careers data | **Verified:** [Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html) documents unauthenticated GET access. A public [Anthropic board request](https://boards-api.greenhouse.io/v1/boards/anthropic/jobs) returned HTTP 200 and 680 job records during this review. | #16 can start with a small, fixed set of supported employers. This does not authenticate a recruiter or establish a company’s canonical board automatically. |

These were source checks, not full integrations. No model weights were downloaded, GPU job started, Jev inference called, benchmark run, or user study conducted.

### Numerical accuracy and evidence boundaries

- The CDC values in the research—over 14 million older adults reporting falls and a 21% increase in the age-adjusted death rate from 2018 to 2024—match the inspected [CDC page](https://www.cdc.gov/falls/data-research/index.html). They do not validate any image-based hazard detector.
- The FTC numbers are supported: the [2024 data book, printed page 10](https://www.ftc.gov/system/files/ftc_gov/pdf/csn-annual-data-book-2024.pdf) gives 2,600,678 fraud reports, 987,520 with reported loss, and $12,537,194,708 total loss. Its introduction also says reports are unverified and detailed Sentinel access is restricted to law enforcement. #17 cannot assume public complaint narratives are available from Sentinel. The [FTC summary](https://consumer.ftc.gov/consumer-alerts/2025/03/top-scams-2024) supports the job-loss and investment-loss figures; investment median-loss wording should specify the relevant loss-reporting population.
- The inspected [NOAA assessment](https://www.ncei.noaa.gov/news/national-climate-202413) supports 27 events, $182.7 billion, and approximately $1.4 trillion over 2015–24. These are the cited assessment’s historical estimates, not a claim to the latest revised disaster-loss accounting. They add almost nothing to choosing between two local GIS workflows.
- The [NHTSA release](https://www.nhtsa.gov/press-releases/nhtsa-estimates-39345-traffic-fatalities-2024) supports the distinction between final 2023 data and early 2024 estimates. National crash totals do not establish street-level pedestrian exposure or local sidewalk conditions.
- The [C2PA explainer](https://spec.c2pa.org/specifications/specifications/2.2/explainer/Explainer.html) supports the provenance-versus-truth warning. Correctly explaining this distinction is useful, but a separate product needs to beat existing credential viewers or improve comprehension measurably.

### Important missing comparisons and constraints

The missing comparisons are consequential, not a demand for an exhaustive literature review:

| Idea family | Prior work or alternative the workbook should confront | Consequence |
|---|---|---|
| #1–#7 interpretability | [Neuronpedia Auto-Interp](https://docs.neuronpedia.org/sparse-autoencoders/auto-interp), [automated-interpretability](https://github.com/openai/automated-interpretability), [Transformer Debugger](https://github.com/openai/transformer-debugger), [SAEBench](https://github.com/adamkarvonen/SAEBench), and [CHIVE](https://alignment.anthropic.com/2026/chive/) | Feature displays, label scoring, and behavior investigations already exist. The contribution must be a specific test, workflow advantage, or finding. |
| #8/#9/#13 agent safety | [CaMeL](https://arxiv.org/abs/2503.18813), [Interbolt’s authors’ AgentDojo evaluation](https://github.com/deconvolute-labs/interbolt-agentdojo), [Cedar authorization](https://docs.cedarpolicy.com/overview/terminology.html), and AgentDojo’s existing defenses | Typed scope enforcement is an application of established security ideas. Tool-name filtering is a baseline, not a novel defense. |
| #14–#16 scam assistance | [Norton’s current scam protection](https://us.norton.com/feature/ai-scam-protection) and [LinkedIn job verification](https://news.linkedin.com/en-us/2026/LinkedIn-Job-Search-Safety-Pulse) | “Paste suspicious text and get warnings” is crowded. Cross-source evidence and cautious uncertainty are a stronger angle than another scam score. |
| #22/#32 flooding | NWPS’s existing viewer, [Esri Flood Impact Analysis](https://www.esri.com/en-us/industries/blog/articles/discover-the-arcgis-solutions-for-flood-simulation-hydrology-and-impact-analysis), and [Google Flood Hub’s broader forecasting work](https://ai.google/sustainability/) | A slider and asset overlay are established. A small, reproducible service-access consequence is a more credible extension. |
| #23/#24 transit | [OpenTripPlanner](https://docs.opentripplanner.org/en/latest/) and [r5py accessibility analysis](https://r5py.readthedocs.io/stable/) | Do not build a routing engine. Existing routing/accessibility analysis must be the baseline; feed validity and service-calendar exceptions matter. |
| #25/#26 accessibility | [Project Sidewalk](https://makeabilitylab.cs.washington.edu/project/sidewalk/) | Vision-assisted sidewalk mapping is established. Image rights, local coverage, dated imagery, and validation with mobility users matter more than bounding-box polish. |
| #19 content credentials | The existing [Content Credentials Verify entry point](https://contentcredentials.org/verify) | A new viewer alone is weak. Its application required JavaScript and was not functionally tested here; the redirect verifies its existence, not usability or performance. |

Other unresolved constraints include trustworthy labels and class prevalence for scam triage; source syndication and missing links for #18; causal assumptions in fairness counterfactuals for #20; weather/occupancy controls for #30; destination opening hours for access projects; and actual donor/pantry commitments for #33. These are central to the claim, not optional polish.

## 2. Screen every idea

“Shortlist” means worth an immediate bounded feasibility test, not an unconditional commitment. Confidence describes my verdict on the specified weekend version, not a statistical probability. “Promising with changes” means the direction needs the stated scope or evidence change. The overlap groupings preserve all 36 individual verdicts.

### Interpretability: #1–#7

| # / Idea | What it actually does | Strongest reason to build | Biggest weakness or blocker | Verdict | Confidence |
|---|---|---|---|---|---|
| 1. Feature-to-failure microscope | Changes an internal activation and tests whether an answer changes. | Potentially compelling controlled causal experiment. | Finding a useful intervention and matching the exact model/feature stack can consume the weekend. | promising with changes | Medium |
| 2. Refusal boundary cartographer | Maps refusal behavior across related prompts. | Clear over-refusal versus under-refusal tradeoff. | Mostly a behavioral benchmark unless internal signals improve held-out prediction. | promising with changes | High |
| 3. Confidence calibration dashboard | Compares probabilities or signals against correct labels. | Can expose expensive overconfidence. | No common task specified; three heterogeneous signals add integration without assured insight. | promising with changes | High |
| 4. Neuron label stress test | Tests whether feature descriptions predict activation on difficult examples. | Accessible data and a falsifiable, bounded question. | Existing label scorers; top-example sampling can make the result circular. | shortlist | Medium–high |
| 5. Causal evidence versus explanation | Tests whether explanations help people predict interventions. | Useful epistemic question. | Overlaps #1/#4 and CHIVE; independent human evaluation is substantial work. | promising with changes | Medium |
| 6. Interpreter’s side-effect radar | Checks unrelated behaviors after model steering. | Regressions make a steering demo more substantive. | Needs a working intervention and reliable outcome labels; small suites cannot certify safety. | promising with changes | Medium–high |
| 7. Circuit claim notebook | Packages a claim and reproducible experiment. | Makes evidence auditable. | Weak standalone demand or novelty; best used inside #1/#4. | deprioritize | High |

### Model and agent behavior: #8–#13

| # / Idea | What it actually does | Strongest reason to build | Biggest weakness or blocker | Verdict | Confidence |
|---|---|---|---|---|---|
| 8. Permission ledger | Restricts agent tool calls to an explicit user grant. | Visible prevention of an unauthorized action while a legitimate task still works. | Scope extraction, argument checking, bypasses, and close prior art. | shortlist | High for a narrow version |
| 9. Prompt-injection flight recorder | Shows the origin and execution path of agent actions. | Easy diagnosis and demo comprehension. | Logging alone provides no protection; existing tracing is a strong alternative. | promising with changes | High |
| 10. Abstention switchboard | Answers or asks for help based on error costs. | Useful selective-prediction behavior. | No specific decision/task; abstention gains can be trivial reductions in coverage. | promising with changes | High |
| 11. Answer verifier | Checks claims against passages in supplied documents. | Clear user task and readily labeled examples. | Crowded; citation relevance is weaker than entailment and omitted-context checks. | promising with changes | High |
| 12. Hidden assumption detector | Highlights unsupported steps in an agent plan. | Can improve approval decisions. | Subjective ground truth and checklist fatigue; cannot enforce permissions. | promising with changes | Medium–high |
| 13. Local red team in a box | Runs safety cases against a model and defense. | Reproducible comparisons. | Generic benchmark wrapper overlaps mature tools; needs a concrete deployment question. | deprioritize | High |

### Market and information tools: #14–#21

| # / Idea | What it actually does | Strongest reason to build | Biggest weakness or blocker | Verdict | Confidence |
|---|---|---|---|---|---|
| 14. Scam message evidence coach | Highlights suspicious wording and safer next steps. | Understandable, important consumer problem. | Norton and ordinary assistants already cover much of this workflow; weak outcome evidence. | promising with changes | High |
| 15. Investment pitch claim checker | Extracts promises and unsupported assertions. | Good bounded extraction task. | Financial truth requires external evidence; rhetoric detection alone is a thin product. | deprioritize | High |
| 16. Job listing consistency checker | Compares a job message with a verified employer source. | Concrete evidence beyond a chatbot’s impression. | Genuine jobs can be impersonated; absent listings are not proof of fraud. | shortlist | Medium–high |
| 17. Consumer complaint pattern explainer | Counts and explains changes in complaints. | Transparent public-interest data analysis. | Sentinel narratives are restricted; aggregate charts have little AI-specific advantage. | deprioritize | High |
| 18. Source concentration map | Shows when articles trace back to the same source. | Strong visual correction to apparent corroboration. | Hidden syndication and unlinked copying; root counts are lower bounds. | promising with changes | Medium |
| 19. Content credential explainer | Reads signed media provenance and explains its limits. | Good media-literacy demonstration. | Existing viewers and uncertain AI need; user comprehension must be the contribution. | deprioritize | High |
| 20. Lending-style fairness stress test | Compares prediction errors and attribute sensitivity. | Makes conflicting fairness choices visible. | Standard tutorial territory; implausible attribute flips cannot establish causal fairness. | deprioritize | High |
| 21. Price disparity receipt | Matches listings and compares complete prices. | Useful, verifiable arithmetic and entity matching. | Scraping/freshness and ordinary product-comparison competition; no basis for discrimination claims. | deprioritize | Medium–high |

### Infrastructure and access: #22–#28

| # / Idea | What it actually does | Strongest reason to build | Biggest weakness or blocker | Verdict | Confidence |
|---|---|---|---|---|---|
| 22. Binghamton flood-stage explainer | Displays an official scenario and explains it. | Local relevance and available map service. | Existing official viewer already performs the central task. | promising with changes | High |
| 23. Transit access audit | Measures scheduled access to selected destinations. | A concrete local planning question. | Advertised feed retrieval failed; routing setup and existing accessibility engines. | promising with changes | Medium |
| 24. Access loss under disruption | Recomputes access after a simulated trip/transfer removal. | A stronger decision question than another trip planner. | Same feed gate; calendars, transfers, and destination hours can invalidate results. | promising with changes | Medium–high |
| 25. Safer walking route | Trades route length against hazard proxies. | Understandable route comparison. | No validated local risk surface; “safer” claim exceeds proxy evidence. | deprioritize | High |
| 26. Street-image accessibility audit | Detects a few visible sidewalk issues. | Useful assistance to manual audits. | Existing Project Sidewalk, imagery/data rights, and incomplete accessibility inference. | promising with changes | Medium |
| 27. Emergency message translator | Simplifies/translates an alert and checks key facts. | Language access and explicit source fidelity. | Requires fluent review; automated self-checks can share the same errors. | promising with changes | Medium |
| 28. Road-work/crash deduplicator | Groups repeated incident notices. | Feasible semantic matching with clear ground truth. | No verified local feed or demonstrated workflow pain; timestamps/status may matter more than similarity. | promising with changes | Medium |

### Environment: #29–#36

| # / Idea | What it actually does | Strongest reason to build | Biggest weakness or blocker | Verdict | Confidence |
|---|---|---|---|---|---|
| 29. Grid constraint checker | Rejects infeasible recommendations in a toy grid. | Strong deterministic validation and a clear bad-plan/good-plan demo. | Three simple inequalities plus an LLM explanation is too shallow; realistic constraints need expertise. | promising with changes | Medium–high |
| 30. Building energy anomaly scout | Flags departures from expected meter usage. | Accessible statistical baselines and measurable alerts. | Injected anomaly success does not establish real waste or savings. | promising with changes | High |
| 31. Heat outreach prioritizer | Ranks areas and allocates a few outreach sites. | Potentially useful resource-allocation problem. | Reproducing a vulnerability index is not validating an intervention; partner and spatial data needed. | promising with changes | Medium |
| 32. Flood infrastructure dependency map | Links flood exposure to a modeled service-access consequence. | Strong local before/after with concrete affected connections. | Datum, geometry, network validity, and exposure-to-closure assumptions. | shortlist, conditional on data gate | Medium |
| 33. Food-rescue routing | Schedules surplus pickups under timing uncertainty. | Useful optimization with a real partner. | No partner demand/capacity/expiry data; synthetic kilograms are not demonstrated rescue. | deprioritize under base assumptions | High |
| 34. Carbon receipt | Shows an emissions factor and its calculation. | Auditable provenance and arithmetic. | Familiar calculator; factor selection dominates and AI is usually unnecessary. | deprioritize | High |
| 35. Smoke school-day aid | Applies a school policy to official air-quality data. | Concrete decision and deterministic rules. | Existing guidance largely supplies the answer; no verified local workflow gap or historical replay integration. | promising with changes | Medium–high |
| 36. Climate claim evidence table | Matches numeric claims to datasets and checks units/time. | Clear evidence-alignment task. | Broad retrieval and source harmonization are too large; narrow to one dataset family. | promising with changes | High |

The combinations in the workbook are extensions, not eight extra independent projects. Use #9 as the explanation interface for #8; #6/#7 as evaluation/reporting components of #1; #22 as the display layer for #32; and #14’s coaching as a small output within #16. #23/#24 are one routing/data stack. Preserve the individual verdicts above: an extension can improve a stronger core without being worth building alone.

## 3. Investigate five candidates

These five span an agent system, an inexpensive interpretability audit, a consumer workflow, local infrastructure analysis, and a higher-risk causal research project. The overlooked challengers are #4 and #16; neither was in the original shortlist. #32 is a stronger version of the original flood candidate rather than a separate second flood entry.

### A. Permission ledger with an action trace — #8, incorporating #9

**User and problem.** A developer building an assistant that reads invitations and writes calendar events. The user wants “schedule this meeting with Alice next week,” not permission for text inside an email to invite an attacker, switch calendars, or create repeated events. The measurable problem is incorrect side effects within a defined workflow, not all prompt injection.

**Why use it instead of existing tools or a chatbot?** A chatbot’s reassurance is not an enforcement boundary. An action-specific grant can bind permitted attendees, calendar, time bounds, allowed payload fields, expiry, and maximum uses. The operator can inspect and revoke that grant. A plain tool-name allowlist cannot express most of these restrictions. Whether this interface is easier than configuring an existing authorization layer is an unresolved product hypothesis.

**Closest work.** [AgentDojo](https://github.com/ethz-spylab/agentdojo) already supplies agent-security environments and defenses. [CaMeL](https://arxiv.org/abs/2503.18813) uses trusted control/data flows and capabilities to enforce policies. [Cedar](https://docs.cedarpolicy.com/overview/terminology.html) provides ordinary fine-grained authorization. [Interbolt’s authors](https://github.com/deconvolute-labs/interbolt-agentdojo) publish provenance-gated tool-call experiments and utility costs. Those author-reported results were not reproduced here. They establish close prior art, not comparative superiority for this proposal.

**Distinctiveness.** Limited algorithmic novelty. The defensible contribution is a compact, user-readable grant lifecycle and an evaluation of argument-level enforcement, revocation, duplicate calls, and legitimate-task retention in one workflow. Do not claim to invent capabilities, provenance controls, or prompt-injection defense.

**Does AI add necessary value?** AI is useful for extracting a proposal from varied invitation text. It is unnecessary for deciding whether a structured call satisfies an approved scope. Keep grant approval and enforcement outside model control. Jev could label a trace for explanation, but must not authorize the call. A parser-only baseline should reveal whether the chosen input variety actually requires a model.

**Smallest convincing weekend prototype.** A local invitation inbox, one model-to-JSON adapter, a calendar-state simulator, an explicit grant editor, and a single tool gateway. No real mail sending, OAuth, browser extension, shell, or generalized agent framework. The model sees untrusted invitation text and proposes an action. The gateway validates every write against a trusted grant and records the determining fields. Consume a one-use grant atomically; revocation must affect subsequent calls. Disallow unapproved free-text payload fields in this narrow version, so the demonstration does not silently permit data leakage through a description.

**Live demo.** The judge chooses a valid meeting and approves its scope. An invitation includes an instruction to add an attacker as an attendee. Show the same proposed call accepted by a tool-name-only policy and rejected by the argument policy, then complete the correct meeting. Revoke a grant and retry a queued call; show denial and the unchanged calendar. The visible result is calendar state, not a model saying “blocked.” Include a too-broad grant that the system cannot rescue.

**Measurable test.** Before tuning, write a small task distribution: 20 benign invitations and 20 attacked variants, grouped by original invitation so paraphrases do not cross train/test boundaries. Reserve half the groups for the final test. Include attendee substitutions, calendar switches, dates outside bounds, duplicate/replayed calls, and revoked grants. Compare the same model and inputs under (1) prompt-only warnings, (2) a tool-name allowlist, and (3) the grant gateway. Check actual state mutations with deterministic assertions. Report attack successes/counts, legitimate task completion under attack and without attack, false blocks, confirmations/task, latency, and repeated-attempt results.

The build target is **zero unauthorized mutations on the specified test suite, at least 90% of benign tasks completed, and at least 80% retention of the undefended system’s otherwise successful benign tasks**. A small zero-failure count is not a universal security guarantee. Include attacks adapted to this policy rather than only known strings, consistent with [NIST’s evaluation guidance](https://www.nist.gov/news-events/news/2025/01/technical-blog-strengthening-ai-agent-hijacking-evaluations).

**Data, tools, hardware, integrations.** Synthetic invitations with expected state changes; Python or TypeScript; JSON schema validation; a minimal web UI; one accessible text model API or a compact local model. No GPU is required with an API, but access and cost remain unconfirmed. A local replay trace is useful for inspection but cannot substitute for a live agent in the final demonstration. Reuse AgentDojo only if integration is quick; otherwise call the suite local and publish its cases, not an official benchmark score.

**Most likely failure.** Permission is inferred from the same untrusted text, or enforcement checks only the recipient/tool and misses other channels. Another likely failure is a defense that “wins” by blocking useful tasks. Authenticating Alice’s real identity is outside a simulator; use stable supplied IDs and state that boundary.

**Reject it if:** there is a write path outside the gateway; a retrieved document can grant itself authority; an in-scope call can smuggle forbidden data through allowed fields; benign retention fails the threshold; or the team cannot articulate any workflow advantage over an existing policy engine beyond a renamed wrapper. These are implementation/value rejection conditions, not objections that the project is unbuilt.

### B. Adversarial neuron-label audit — #4, the overlooked low-resource challenger

**User and problem.** A researcher deciding whether an SAE feature’s readable label is reliable enough to guide further investigation. Top activations can make a broad label look convincing without exposing counterexamples or selection effects.

**Why use it?** Neuronpedia is excellent for exploration; this prototype would package an adversarial audit receipt: the original label, a frozen sampling protocol, human predictions, false positives/negatives, and uncertainty. A chatbot cannot establish activation ground truth by inventing examples and declaring them matches.

**Closest work.** [Neuronpedia Auto-Interp](https://docs.neuronpedia.org/sparse-autoencoders/auto-interp) already supports explanation scoring, decoys, and intrusion tests. [OpenAI’s automated-interpretability repository](https://github.com/openai/automated-interpretability) releases neuron explanations and activation datasets; [SAEBench](https://github.com/adamkarvonen/SAEBench) provides a broader SAE evaluation suite. Therefore “score feature labels” alone is not distinctive. Neurons, SAE latents, and attention heads are different objects; this prototype should explicitly choose SAE features.

**Distinctiveness.** Focus on **human overgeneralization under distribution shift**, with four test categories: label-consistent/high activation, label-consistent/low activation, label-inconsistent/high activation, and label-inconsistent/low activation. Ask whether label-only predictions improve on lexical similarity and whether the audit makes users better calibrated. This is an incremental evaluation workflow, not discovery of a semantic unit’s true meaning.

**Does AI add necessary value?** The subject is an AI representation. Another generative model is optional. Human labels, cached activations, transparent sampling, and baseline predictors are enough for a serious audit. Jev can be an additional predictor only if its labels are not used as the truth it is scored against.

**Smallest convincing weekend prototype.** One SAE source, three features, roughly 20 evaluation contexts per feature, a prediction interface with labels initially hidden or shown under a controlled condition, and a downloadable result table. Cache public source records with exact model/source/feature IDs and origin URLs. Require either random/quantile activation records not used to write the label, or fresh activation inference on a verified supported source. A cached-top-examples-only version is a useful educational pilot, but must narrow its claim to those selected records.

**Live demo.** Show a readable label, let the judge predict whether a context activates the feature, then reveal the recorded activation and token location. Include a plausible semantic match with low activation and a lexical confound with high activation. End with a clearly labeled selection-bias panel rather than a red “false neuron” badge. If fresh inference works, the judge can supply one text; otherwise state that the demo uses cached cases.

**Measurable test.** Freeze a feature-level split, not a random token split from the same passage. Independently annotate whether the labeled concept is present; activation is a second measured variable, not a human semantic label. Compare label-based predictions against majority/base-rate and keyword or embedding-similarity predictors. Use balanced accuracy and a confusion table for predicting a preregistered activation threshold; show raw activation distributions and sensitivity to the threshold. Do not estimate population precision from a case-control sample without correcting the sampling design. A few blinded reviewers can provide exploratory accuracy/confidence results; three teammates are not a user study.

To justify the sharper product, require either reproducible label-failure patterns across more than one feature or clear evidence the audit improves held-out activation prediction over the label-only presentation. If neither occurs, present a useful negative result, but do not pretend the audit is a demonstrated improvement.

**Data, tools, hardware, integrations.** The verified public feature GET provides a starting dataset on an ordinary laptop. Broader exports or inference-enabled sources need separate checks. Python/dataframes plus a small web interface suffice. No SAE training or local model inference is necessary for the cached version. Check source-specific licensing before redistributing contexts.

**Most likely failure.** Using the same high-activation contexts that generated the explanation, then “validating” that explanation on them. Other failures are threshold fishing, sampling only dramatic counterexamples, and conflating activation correlation with causal function.

**Reject it if:** only top activations are obtainable and the team insists on a generalization claim; annotation disagreement makes “fits the label” uninterpretable; or the result adds nothing beyond an existing Neuronpedia score and a new chart. This is the safest infrastructure fallback, not a promise of novel research findings.

### C. Official-source job listing consistency checker — #16

**User and problem.** A student receives an internship listing or recruiter message and wants to know whether its concrete claims match an independently selected employer source before sharing information or taking a requested action.

**Why use it?** The useful output is not “87% scam.” It is a receipt: claimed employer, role, location, canonical listing link, timestamp, exact inconsistencies, and what cannot be checked. The improvement over a basic chatbot is controlled source retrieval and auditable field comparison. A real role being listed does not authenticate the person who contacted the student.

**Closest work.** [Norton Scam Protection](https://us.norton.com/feature/ai-scam-protection) covers AI-assisted scam warnings, and [LinkedIn](https://news.linkedin.com/en-us/2026/LinkedIn-Job-Search-Safety-Pulse) offers job/company/recruiter verification signals and recommends checking official sources. [Greenhouse](https://docs.greenhouse.io/job-board.html) exposes published listing data. The gap, if users want it, is a portable cross-source consistency receipt for outreach that arrives outside a verified platform. This is not a new fraud-detection paradigm.

**Distinctiveness.** Restrict the weekend build to three manually verified employers using one job-board API. Separate four outcomes: supported match, specific contradiction, no current match found, and source unavailable. Preserve a fifth independent statement: recruiter identity not verified. A signed or timestamped receipt could help a campus advisor inspect evidence, but do not spend the weekend building a universal crawler.

**Does AI add necessary value?** It can extract claims and normalize paraphrased roles/locations from messy messages. Retrieval, domain allowlists, exact job IDs, dates, URLs, and arithmetic belong in code. If exact-title and location matching perform equally well, keep the deterministic version and be honest that model value was marginal. Jev and Qwen are interchangeable candidates for extraction, not mandatory components.

**Smallest convincing weekend prototype.** Paste message; select a supported employer from a trusted list; retrieve public jobs; extract and compare role/location/application URL; display the receipt and a source-availability status. Independently configure the employer-to-board mapping rather than trusting a URL inside the suspicious message. Read only; do not apply, contact recruiters, or collect identity documents.

**Live demo.** Three messages about a real listed role: a faithful paraphrase, a location/application-domain substitution, and an impersonation using accurate job details. The first matches; the second exposes an explicit discrepancy; the third says job details match but sender legitimacy remains unknown. Disconnect the source and show “unavailable,” not “fraud.” That third case demonstrates better judgment than a binary scam detector.

**Measurable test.** Freeze approximately 15 authentic listing snapshots and 15 controlled alterations; add 10 legitimate paraphrases, expired listings, and unsupported-employer cases. Keep base listings disjoint between development and held-out evaluation. These alterations validate consistency detection, not real-world scam recall. Compare with exact-title/ID matching and a model given only the message. Measure field extraction F1, contradiction precision/recall, correct uncertainty on missing/unavailable sources, and evidence-link accuracy. A reasonable build target is at least 90% precision on explicit-contradiction flags, zero confident fraud verdicts from source absence, and useful recall on changed location/domain/role fields. Report small denominators. A later real scam corpus would be a different validation step.

**Data, tools, hardware, integrations.** Public Greenhouse GET data, manually verified canonical employer/board mappings, dated local snapshots, URL parsing, one text model, and a web UI. An ordinary laptop is enough; model API access is unconfirmed. The successful public API request verifies a path, not all employers or data-reuse terms. No LinkedIn scraping or recruiter-account integration is needed.

**Most likely failure.** A matching listing gives false reassurance about a fraudulent sender, or a legitimate removed role triggers a fraud warning. ATS migrations, localized titles, and nonpublic vacancies produce legitimate mismatches.

**Reject it if:** users cannot distinguish “job exists” from “sender is genuine” in a short comprehension check; the system cannot abstain on unavailable data; almost all value comes from opening the official careers page; or extraction fails to improve materially over simple field matching. Product value needs testing with students or advisors; FTC totals alone do not prove it.

### D. Binghamton flood exposure to service-access scenarios — #32, incorporating #22

**User and problem.** A campus resilience analyst or local planner wants to inspect how one modeled flood scenario could affect access to a small set of essential facilities. The concrete question is “which connections become vulnerable under this explicit assumption?” rather than “is my home safe?”

**Why use it?** The official flood viewer already answers much of #22. A useful extension follows one exposed connection through a small network and explains which destination loses modeled access. A generic chatbot cannot reliably do the spatial join or network calculation. A GIS professional can; the possible benefit is a focused, reproducible local workflow with accessible evidence.

**Closest work.** [NWPS/NOAA](https://mapservices.weather.noaa.gov/static/rest/services/NWS_FIM/FIM_bngn6/MapServer) already supplies the local scenarios; [SRBC](https://www.srbc.gov/our-work/programs/planning-operations/flooding/inundation-maps/index.html) lists the library. [Esri Flood Impact Analysis](https://www.esri.com/en-us/industries/blog/articles/discover-the-arcgis-solutions-for-flood-simulation-hydrology-and-impact-analysis) already overlays flood depths with infrastructure and quantifies effects. [Google’s flood work](https://ai.google/sustainability/) is an adjacent forecast product, not an exact substitute for this local network analysis.

**Distinctiveness.** Low novelty for flood display or asset counts. A defensible weekend contribution is one local dependency question: the difference between assets exposed and destinations disconnected, with explicit alternative assumptions and an auditable calculation. A local dataset is specialization, not methodological novelty.

**Does AI add necessary value?** Not to the core calculation. Spatial operations, network traversal, and source citation should be deterministic. A language model could translate a query into an allowlisted scenario or explain structured results; keep it only if a comprehension/accessibility test justifies it. This weakens AI-event fit relative to a similarly strong agent project, but does not make the planning tool useless.

**Smallest convincing weekend prototype.** One gauge, three validated scenario layers, a manually checked network of perhaps 20–50 relevant road links, and three facilities. Use a small network with known limitations rather than promise complete city coverage. Inspect the source shapefile schema and geometry; if using rasters, perform actual raster sampling or a defensible extent operation, not a screenshot/color heuristic. Show the data’s study boundary and “outside coverage” explicitly. Resolve the layer-to-stage mapping against the official viewer before presenting any slider.

**Live demo.** The judge changes scenario; an exposed link is highlighted; a second panel shows a destination that becomes disconnected in the modeled network. Toggle the assumption that exposed links are unavailable, and show the resulting sensitivity. Include a bridge crossing where ground-level flood extent alone cannot determine deck passability. Make clear that neither the network nor the closure rule is operational guidance.

**Measurable test.** Validate at least 20–30 point/link-stage classifications against source geometries or official map inspection, with independent GIS checks where available. Verify network results on hand-computable toy graphs before interpreting local results. Baselines: the official viewer plus a manual asset tally, and asset exposure without connectivity. Measure exposure agreement, count consistency, graph-reachability correctness, and time to answer the specific dependency question. The build gate is correct stage/CRS handling, no false “dry/safe” claim for missing data, and reproducible counts across all selected stages. A human speed comparison is exploratory unless independently run. This demonstrates scenario-analysis fidelity, not avoided flood losses or accurate road-closure prediction.

**Data, tools, hardware, integrations.** NOAA layers/downloads, NWPS metadata, manually verified facility coordinates, a bounded open/manual road network, GeoPandas/Shapely or equivalent, NetworkX, and Leaflet/MapLibre. Raster work may require Rasterio/GDAL. Use an ordinary laptop; no GPU needed. The 153 MB advertised archive is manageable in principle but has not been fully inspected. Broome GTFS is not required for this narrowed road-network proof. Adding transit, census weighting, real-time evacuation routing, or citywide geocoding is out of scope.

**Most likely failure.** A technically correct overlay becomes a false claim about passability or safety. Bridge elevations, levees, drainage, outdated facilities, and unmodeled road links can reverse the conclusion. Also, a complete service-access analysis can quietly turn into a full routing project.

**Reject it if:** stage/datum mapping cannot be resolved; usable geometry cannot be extracted; the available network has no credible alternate paths; only an ordinary asset overlay can be built; or there is no plausible user question beyond the official map. A map service responding is insufficient to clear this gate.

### E. Feature-to-failure microscope — #1, with #6 regression checks

**User and problem.** A model researcher investigating one repeatable failure, such as distractor sensitivity on a constrained answer task. The real goal is to identify an intervention whose behavioral effect is specific and reproducible, rather than to generate an attractive explanation of an arbitrary bad answer.

**Why use it?** A successful experiment offers something a chatbot cannot: intervention data from the actual target model. But existing interpretability tools already enable such experiments. The project needs either a useful new finding or a workflow that materially speeds investigation; a UI around patching alone is weak differentiation.

**Closest work.** [Transformer Debugger](https://github.com/openai/transformer-debugger) investigates model behaviors with interpretability tools; [Neuronpedia steering](https://docs.neuronpedia.org/steering) already offers visible output changes; [activation-patching guidance](https://arxiv.org/abs/2404.15255) explains methodological pitfalls. [CHIVE](https://alignment.anthropic.com/2026/chive/), published August 2026, is particularly relevant: in its studied setting, activation-reading tools did not improve counterfactual behavioral predictions over transcript-only access. That is evidence for including a behavioral-only baseline, not evidence that all interpretability is useless.

**Distinctiveness.** At most incremental until the team identifies a specific failure and establishes a controlled effect. “We found the deception neuron,” “this is the model’s reasoning,” and “the patch fixed alignment” would be unsupported. Feature causality on a task is narrower than a semantic label being globally correct.

**Does AI add necessary value?** Yes: the object being investigated is the model itself. An additional AI evaluator is optional and should not be the sole source of ground truth. Prefer a constrained task with deterministic answer scoring. Qwen is one possible target; use another supported small checkpoint if it makes the experiment reliable.

**Smallest convincing weekend prototype.** One compact checkpoint, one constrained behavior, short prompts, selective activation hooks, and one candidate intervention. First show the original behavior is stable. If using an SAE, pin the exact model revision, source, layer/hook, tokenizer, normalization convention, and weights; feature index 123 in a different source has no transferable meaning. If using a residual or head patch without an SAE, call it that rather than claiming a labeled feature discovery. Do not train an SAE or trace a full circuit during the weekend.

**Live demo.** Run a clean/corrupt prompt pair; show baseline answers and a predefined answer metric. Apply the selected patch, rerun the corrupt prompt, then show a held-out paraphrase and an unrelated control. A judge should see both a successful intervention and a case where it fails. A heatmap can explain where to look but is not the result.

**Measurable test.** Use roughly 20 development pairs, 20 untouched test pairs from distinct templates, and 20 unrelated control prompts. Select the component and strength only on development data. Compare with no intervention, a sham hook, norm-matched random interventions at comparable sites, and a simple prompt rewrite. Report raw answer accuracy and target logit differences, not only normalized recovery ratios that can explode when the clean/corrupt gap is small. Repeat stochastic generations or use a specified deterministic scoring path. Use paired uncertainty estimates and disclose component/strength search breadth.

A proposed go criterion is a held-out target-accuracy gain of at least 20 percentage points, a clearly larger effect than matched random controls, and no more than a 10-point decline on the chosen unrelated-task suite. These are practical weekend thresholds, not universal scientific standards; small samples will be inconclusive in some cases. Report that inconclusiveness. Passing these tests supports a local causal claim about the intervention under the tested setup; it does not validate a global circuit, a human-readable concept, or general model safety. A prompt rewrite matching the gain does not invalidate the causal finding, but sharply reduces its product advantage.

**Data, tools, hardware, integrations.** Authored clean/corrupt tasks with exact answers; PyTorch/Transformers; compatible TransformerLens/TransformerBridge or carefully checked native hooks; optional matching SAE; scoring script; minimal UI. Full activation sweeps are much more expensive than a single inference. Quantized inference availability does not establish equivalence of an intervention workflow. Hosted generation APIs generally do not supply the arbitrary internal hooks needed here. Empire AI availability, installation rights, queue time, and checkpoint transfer remain unresolved.

**Most likely failure.** The patch changes output by degrading or saturating the model, the selected result fails on new templates, or feature labels from a different model/source are treated as if they apply. Token-position mismatch and template/tokenizer differences can also invalidate an apparently successful patch.

**Reject it if:** forward-equivalence/sham-hook checks fail; the base behavior is not repeatable; the exact activation/SAE match cannot be established; held-out benefit is indistinguishable from controls; or general answer quality collapses. If only correlations or precomputed visualizations work, pivot explicitly to #4 rather than retain the causal microscope claim.

## 4. Rank the finalists

Scores assess the narrowed versions above under the stated base resources. They are judgment aids, not measurements of objective quality. The small middle-rank differences are not meaningful precision. A score of 5 means particularly strong for this weekend setting, not guaranteed success. Conditional blockers are listed separately and override the total.

Formula: **total = 5F + 4U + 4D + 3N + 3T + E**, where each input is 1–5. This is the requested weighting: feasibility 25%, user value/problem evidence 20%, demo 20%, differentiation 15%, technical substance/validation 15%, verified event fit 5%.

| Rank / finalist | F: feasibility | U: user value | D: demo | N: differentiation | T: substance/test | E: event fit | Total / 100 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1. #8 Permission ledger + trace | 5 | 4 | 5 | 2 | 4 | 5 | **84** |
| 2. #4 Adversarial neuron-label audit | 5 | 3 | 4 | 2 | 4 | 5 | **76** |
| 3. #16 Official-source job checker | 4 | 4 | 5 | 2 | 3 | 4 | **75** |
| 4. #32 Flood dependency scenario | 3 | 4 | 5 | 2 | 4 | 4 | **73** |
| 5. #1 Feature-to-failure microscope | 3 | 3 | 4 | 2 | 5 | 5 | **69** |

### Why each score was assigned

| Finalist | Feasibility justification | User-value justification | Demo justification | Differentiation justification | Substance/validation justification | Event-fit justification |
|---|---|---|---|---|---|---|
| Ledger | **5:** local state, one gateway, no special compute or OAuth; feasible code scope. | **4:** documented failure class and concrete developer task; adoption benefit untested. | **5:** judge-triggered unauthorized mutation is visibly stopped while the task completes. | **2:** CaMeL, ordinary authorization, and provenance gates are close precedents. | **4:** state assertions and utility/security tradeoffs are strong; not new security theory. | **5:** directly tests safe agent execution and responsibility. |
| Label audit | **5:** public cached records, ordinary laptop, no training. | **3:** real interpretability concern but small audience and no discovery interviews. | **4:** prediction/reveal is clear; abstract features need explanation. | **2:** scoring already exists; adversarial human-calibration protocol is incremental. | **4:** held-out predictions and sampling analysis are substantive; no causal claim. | **5:** directly evaluates interpretability reliability. |
| Job checker | **4:** one public API and three employers are feasible; source matching/normalization take work. | **4:** concrete user decision and official problem evidence; prevention/adoption unproven. | **5:** contradiction, matching-role impersonation, and unavailable-source cases are immediately legible. | **2:** existing scam assistants, verification signals, and manual checking. | **3:** useful extraction/matching evaluation; narrow synthetic edits limit external validity. | **4:** information transparency and responsible uncertainty, but limited new AI method. |
| Flood scenario | **3:** tractable bounded network, but geometry/datum/GIS integration is a real setup risk. | **4:** concrete public-system scenario; no local partner confirms priority. | **5:** stage change and lost connection make a strong visual consequence. | **2:** existing impact GIS; local dependency question is specialization. | **4:** spatial/network correctness and sensitivity tests have substance; no closure prediction validated. | **4:** public infrastructure and environmental relevance; AI’s added role is uncertain. |
| Microscope | **3:** one compact controlled experiment is possible; discovery and stack setup compete for time. | **3:** research relevance is clear; practical debugging benefit is not established. | **4:** before/after can be striking but controls take time to explain. | **2:** patching and behavior-debugging tools are established. | **5:** causal controls and falsifiable held-out findings provide the strongest research upside. | **5:** safety/interpretability investigation fits the public agent track description. |

The 5% event-fit score uses only the public themes verified above. It does not assume a particular judge, sponsor preference, private scoring formula, prize, or compute allocation.

### Blockers that the averages must not hide

| Finalist | Unresolved dependency or gate | What clears it | If it fails |
|---|---|---|---|
| Ledger | Accessible real model; complete control of simulated write path; useful approved scope. | One valid model proposal completes a task; direct and agent-originated writes pass through one gateway; revoked grant prevents mutation. | Cached traces can support a policy-tool demo but weaken the agent claim. Move to #4 if no viable inference path. |
| Label audit | Enough independent evaluation contexts; permission to redistribute/cache them. | Verify source sampling metadata or an inference-enabled source and a usable test split. | Limit claims to the cached distribution; if only circular top examples exist, it is not a validated audit. |
| Job checker | Verified employer-to-board mapping and sufficiently current snapshots. | Read-only retrieval plus manually verified official source links; correct unavailable-source behavior. | Restrict employers or reject. A real matching job still never authenticates a sender. |
| Flood scenario | Layer/stage mapping, extractable geometry, plausible bounded network. | One stage reproduced against the official viewer and one exposure-to-connectivity calculation checked manually. | Fall back to a modest #22 visual explainer, which is a weaker entry, or switch projects. |
| Microscope | Compute, exact checkpoint/hook/SAE compatibility, repeatable failure, and a controlled effect. | Output-equivalence check, sham hook, short intervention, held-out mini-test. | Use #4. A high technical score cannot substitute for unavailable activations. |

None of these blockers is “not implemented yet.” They are dependencies or risky assumptions that determine whether the proposed weekend scope is plausible.

### Sensitivity to team and resources

- **Solo builder or two generalists:** #4 is the safest choice. Keep three features and cached data; avoid a hosted-model stack. The ledger remains possible with an existing inference account, but UI, policy correctness, and evaluation compete for one person’s time.
- **Interpretability specialist plus usable 16–24 GB GPU:** the microscope’s feasibility could move from 3 to 4 and demo from 4 to 5, bringing it to **78**, before any additional evidence of differentiation. A named nontrivial failure and convincing pilot could change the decision more than hardware alone.
- **GIS specialist and confirmed planning user:** flood feasibility from 3 to 4 and user value from 4 to 5 brings it to **82**. A demonstrated advantage over the existing viewer could raise differentiation and make it first.
- **Very strong novelty weighting:** none of these concepts currently has a large verified novelty moat. The ledger’s ranking comes from buildability, demonstration, and validation. A competition demanding original research would favor a falsifiable #1/#4 investigation over a polished generic policy layer, provided its prerequisites are available.

## 5. Decision and first experiment

### What to build

**Best overall: #8 permission ledger with #9’s inspectable trace, narrowed to one calendar workflow.** It gives the team the best chance to demonstrate an AI-specific failure, an executable boundary, useful completion, and a measured tradeoff in one weekend. The claim should be: “This approved scope prevents these unauthorized state changes while preserving these legitimate tasks in our evaluated workflow.” Do not pitch “we solved prompt injection.”

**Safest fallback: #4 adversarial neuron-label audit.** Public data is demonstrably readable without a GPU. It can produce an honest result even when a label performs well or the hypothesis fails. Its risk is shallow differentiation and biased sampling, so the audit protocol is the project, not the visualization.

**Most ambitious research bet: #1 feature-to-failure microscope.** Pursue it first only with a team member who can implement and interpret activation interventions, an actual working compute path, and a bounded behavior. The original recommendation makes this the default before establishing those conditions; I would reverse that order.

**Best consumer-product prospect among these finalists: #16 job consistency receipts**, conditional on evidence that students/advisors value the receipt and understand its limits. **Best local public-interest prospect: #32**, conditional on a planner’s real question and data/network validation. These distinctions matter:

| Category | Strongest current choice | What would count as success |
|---|---|---|
| Interesting research | #1 for upside; #4 for a manageable audit | A specific finding survives controls, or a well-designed negative result narrows a claim. |
| Useful product | #16, provisionally | Users make a better verification decision than with an official-site link and checklist. |
| Strong weekend hackathon entry | #8 | A clear live failure/prevention/completion sequence plus credible held-out evaluation. |

### Impressive-sounding weak choices

- **A generic feature microscope or steering slider:** existing tools already do the visual part; an output changing is not a new mechanism or a useful repair. Keep only if the controlled finding is the center.
- **A “safer route” map based on crash dots (#25):** proxy exposure, reporting bias, and missing local infrastructure do not validate route safety. A safety label would outrun the evidence.
- **A local red-team wrapper (#13):** running someone else’s benchmark is useful engineering, but a weak standalone entry without a specific defense tradeoff or new test question.
- **An investment/scam oracle (#14/#15 in their generic form):** a large loss statistic plus fluent warnings is not differentiation from current assistants or proof of behavioral benefit. #16’s official-source comparison is a better bounded task.
- **A content-credential viewer (#19):** a polished demonstration of an existing standard has low technical differentiation unless a comprehension experiment establishes a meaningful improvement.
- **A flood chatbot or an energy-waste dashboard (#22/#30 in superficial form):** map labels and injected anomalies are not evidence of prevented harm or energy savings. The bounded analysis can be useful; inflated impact cannot rescue a weak prototype.
- **Synthetic food-rescue optimization (#33) without a partner:** optimization on invented inputs demonstrates an algorithm, not operational usefulness or rescued food. Reconsider if actual pickup, capacity, and timing constraints become available.

### First 60-minute experiment for the ledger

Run this at the permitted start of implementation; the full event’s prework rules remain unverified. The aim is to test the core mechanism and model path, not build the interface or claim a benchmark result.

| Time | Action | Evidence to retain |
|---|---|---|
| 0–10 minutes | Define a local calendar state and an explicit structured grant: one calendar, an exact attendee set, an allowed date/time window, permitted fields, expiry, a one-use limit, and a grant ID. The user approves it directly. | Grant schema, initial state, and deterministic allowed/denied examples. |
| 10–25 minutes | Write one gateway and a local `create_event` function. Route every write through the gateway. Reject unknown fields, out-of-scope arguments, revoked grants, and replays; consume permission atomically. | State assertions for a valid call, an extra attendee, an out-of-window time, a replay, and revocation. |
| 25–40 minutes | Connect an available model to produce structured proposals from five benign invitations. Use a parser to validate the schema. Do not let the model create or approve grants. | Actual proposals, valid-call rate, latency, and final calendar state. |
| 40–55 minutes | Add five invitation variants that attempt an extra attendee, calendar switch, invalid time, duplicate action, or unapproved payload. Compare a tool-name allowlist with the grant gateway using the same proposals. | Accepted/rejected actions and actual state differences for both policies. |
| 55–60 minutes | Revoke a grant and retry a previously valid proposal. Record what failed, how much legitimate work completed, and whether the difference is understandable without the UI. | A short feasibility receipt and a decision to proceed, reduce scope, or pivot. |

**Pass only if all of the following hold:**

1. A real model path runs, and at least **4/5 benign tasks complete correctly** through the gateway.
2. **0/5 unauthorized mutations** occur through the gateway, including the replay/revocation checks. Test direct malformed calls as well as model proposals; a model refusing an attack does not test enforcement.
3. At least **three out-of-scope proposals that pass the tool-name allowlist are rejected by the argument gateway**. If the real model never produces them, supply clearly marked direct proposals to validate the mechanism, and retain the unresolved agent-attack result separately. Do not label scripted proposals as model attacks.
4. The single write boundary can be inspected in minutes, and the state transition demonstrates more than “block every write.”

**Fail the first-hour gate** if the model/integration path is still unavailable, ordinary tasks mostly fail, any forbidden mutation slips through, or the team cannot isolate the permission boundary. A policy bug discovered here is fixable; cap another repair attempt at 30 minutes before committing the weekend. If the only achievement is a static rejection animation, pivot to #4. Passing is evidence of prototype feasibility, not security validation; the held-out suite still comes next.

### Information most likely to change this recommendation

1. **Actual team capabilities and working compute/API access.** An experienced interpretability builder with a supported checkpoint changes the microscope’s feasibility much more than an unconfirmed credential email does.
2. **The full official Hacker Guide.** Verify precise criteria, team eligibility/size, allowed prework, implementation window, code/disclosure requirements, and any mandatory technology before treating them as constraints. These could change event fit and practical scope.
3. **One observed user workflow and current-tool comparison.** A planner with a concrete unmet flood-access question, or students consistently misled by role-matching evidence, would change the value ranking.
4. **A tiny measured head-to-head result.** Benign-task retention for the ledger, an out-of-distribution label failure beyond existing scores, or a microscope effect beating random interventions would be stronger decision evidence than another national statistic.
5. **Validated local data access.** A usable, current Broome GTFS feed, resolved flood-stage metadata, and checked road/facility layers could elevate the infrastructure candidates substantially.

## Source-access and verification limits

All cited competitor capabilities are from primary documentation, research papers, official project repositories, or the vendor/institution’s own account. Their existence is verified; comparative performance and usability were not independently benchmarked. The shortlist is my inference from that evidence and the declared resource assumptions.

The missing Hacker Guide could not be reviewed. The public event page was accessible; searches did not recover detailed official rules. TypeSafe Markdown pages initially failed in the browser tool because of content-type/access handling; direct HTTP retrieval succeeded for quickstart/Noul/Box, and HTML documentation was also inspected. No private API keys were accessed.

The Broome HTML page was accessible through browsing and a later HTTP request; the actual advertised ZIP returned 404/403 and was not validated. NOAA service metadata and gauge JSON were retrieved. The shapefile directory and archive HEAD were available; a long full-archive download was stopped, so no claim here depends on inspected archive contents. No model or tool compatibility was execution-tested.

An initial incorrect SAEBench repository path returned 404; the author-maintained [adamkarvonen/SAEBench](https://github.com/adamkarvonen/SAEBench) repository was then located and inspected. A guessed Neuronpedia API-documentation path failed; the documentation-linked [API page](https://docs.neuronpedia.org/api-and-data/api) succeeded. An older Project Sidewalk site failed through the browser tool; the [University of Washington project page](https://makeabilitylab.cs.washington.edu/project/sidewalk/) provided primary evidence. Content Credentials Verify exposed a JavaScript-only app. A Grid2Op documentation URL was inaccessible and is not used as evidence for a verified integration. None of these failures is evidence that the underlying service is unavailable to all users.

The source checks support a decision to test a narrow project. They do not establish adoption, real-world harm reduction, universal defenses, or validated model mechanisms. Those claims require evidence the weekend prototypes have not yet produced.
