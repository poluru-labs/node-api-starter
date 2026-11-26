# node-api-starter

TypeScript starter for a JSON API, with health checks, tests, CI, and a container image.

The folders beside this file are small JSON APIs built from that starter. Each one documents its routes in its own README, keeps state in memory, and ships a fixture file under `mocks/`. These services check, score, or route data you send them. They do not call a live model, a package registry, or an outside data feed. Open a project README for request shapes, scripts, and the mock API.

Created by [Subrahmanyam Poluru](https://polurus.com).

## Projects
### Accessibility

- [Accessibility Auditor](node-ai-accessibility-auditor/README.md) checks HTML against a documented WCAG subset and stores a score with findings. The rules cover language, title, alternative text, names, labels, landmarks, heading order, viewport, and tabindex. Checks are deterministic and do not call a model.
- [Document Accessibility](node-ai-document-accessibility/README.md) checks a structured document for a title, language, image alternative text, heading order, table headers, and named links. The score starts at 100 and drops by impact. The document itself is not stored.
### Reading and plain language

- [Assistive Reading](node-ai-assistive-reading/README.md) grades a passage with Flesch–Kincaid, flags long sentences and hard words, and replaces a fixed set of difficult phrases when the grade is above the requested target.
- [Plain Language API](node-ai-plain-language-api/README.md) flags long sentences, passive forms, and a fixed jargon list, then replaces those phrases. A general audience uses a 20-word sentence limit. An expert audience uses 30.
### Learning

- [Adaptive Learning](node-ai-adaptive-learning/README.md) records learner attempts against a fixed skill catalog. The next recommendation is the lowest-mastery skill, with difficulty from 1 to 5.
- [Skills Assessment](node-ai-skills-assessment/README.md) scores a learner on a fixed competency rubric and reports the average, whether the target level was met, and the skills still below it.
- [Teacher Feedback](node-ai-teacher-feedback/README.md) turns rubric scores into strength, developing, and practice comments. The essay itself is not stored.
### Agents

- [Agent Observability](node-ai-agent-observability/README.md) records a run and appends llm, tool, retrieval, and handoff events, then returns a latency and error summary. Attribute keys that look like secrets are stored as `[redacted]`.
- [Agent Replay](node-ai-agent-replay/README.md) stores a baseline sequence of tool or model steps and compares a later run. Object key order does not affect equality. A diff names the step and the field that changed.
- [Tool Permissions](node-ai-tool-permissions/README.md) registers agent tools with a risk and scopes, then allows, denies, or requires approval for a requested call. The service does not execute the tool.
- [Human Approval](node-ai-human-approval/README.md) queues an agent action for review. Low risk is approved by policy. Medium, high, and critical stay pending until a person approves or rejects them. A critical approval needs a reason, and secret-like payload fields are stored as `[redacted]`.
### Review and verification

- [Annotation Review](node-ai-annotation-review/README.md) collects labels for an item, replaces a repeat vote from the same annotator, and reports majority, conflicts, pairwise agreement, and corpus Fleiss' kappa.
- [Answer Verification](node-ai-answer-verification/README.md) splits an answer into sentences and scores each one against the supplied sources with token overlap. This is a lexical check. Cite a source as `[sourceId]` in the sentence. The verdict is supported, partial, or unsupported.
- [Output Validation](node-ai-output-validation/README.md) checks a JSON value against a contract for type, enum, range, length, required properties, and extra properties. The raw output is not stored.
- [API Contract Monitor](node-ai-api-contract-monitor/README.md) declares the status, required fields, JSON types, and latency budget for an operation. Each observation is checked against that contract. The response body is not retained after the check.
### APIs and code

- [BFF Starter](node-ai-bff-starter/README.md) puts named JSON resources behind one view so a client can read a screen in a single response. A missing optional part comes back as null with partial set. A missing required part sets ok to false. The service does not call arbitrary upstream URLs.
- [Code Review](node-ai-code-review/README.md) scans submitted files for secrets, dynamic code execution, debugger statements, empty catches, loose equality, console logging, long lines, and long files. Finding messages do not repeat secret values.
- [Documentation Checker](node-ai-documentation-checker/README.md) reviews a README, API page, changelog, or contributing guide for required sections, an unclosed code fence, empty links, images without alternative text, and leftover TODO or FIXME notes.
- [Test Gap Analyzer](node-ai-test-gap-analyzer/README.md) compares source files with test files and reports functions whose names never appear in a test. File contents are not stored.
- [Legacy Code Explorer](node-ai-legacy-code-explorer/README.md) scans submitted files for long files, long functions, deep brace nesting, TODO or FIXME notes, goto, and import or require dependencies. The scan is lexical and does not execute the code.
### Research

- [Citation Checker](node-ai-citation-checker/README.md) finds Author (Year) and (Author, Year) citations, then reports references that are never cited, citations with no reference, and DOIs that are not `10.xxxx/suffix`.
- [Literature Discovery](node-ai-literature-discovery/README.md) indexes papers you provide and ranks them by overlap with a query. A term in the title counts more than a keyword, and a keyword counts more than an abstract term. The service does not call an external library.
- [Systematic Review](node-ai-systematic-review/README.md) screens study records against include and exclude terms and returns PRISMA-style counts. The service does not search an external library.
- [Research Artifact Index](node-ai-research-artifact-index/README.md) stores papers, datasets, code, models, and protocols, then links them with cites, uses, or derives. Search matches title terms. URLs are not fetched.
- [Research Reproducibility](node-ai-research-reproducibility/README.md) scores a study for data, code, a pinned environment, a seed, a command, hardware notes, and a license. The badge is reusable when data, code, environment, command, and license are present, and functional when code and a command are present.
### Cost and dependencies

- [Cloud Cost Advisor](node-ai-cloud-cost-advisor/README.md) stores hourly USD rates, prices a usage submission, and compares it with the previous submission for the same account. Advice covers unknown SKUs, idle quantity, spend spikes, and a single SKU that dominates the bill.
- [Dependency Triage](node-ai-dependency-triage/README.md) scores a dependency list for security advisories, deprecated packages, licenses outside an allow list, outdated versions, and duplicate installs. The service does not call a package registry.
### Community and public information

- [Community Resource Matcher](node-ai-community-resource-matcher/README.md) stores resources with needs and an optional region or coordinates. A match request ranks resources that share a need, prefers the same region, and lowers the score by distance.
- [Public Service Search](node-ai-public-service-search/README.md) indexes services you provide and ranks them by overlap with a query. A term in the name counts more than the category, and the category counts more than eligibility. A service in a different area is left out when both sides name an area.
- [Disaster Information](node-ai-disaster-information/README.md) stores hazard bulletins and answers a place-and-time query with the active ones plus standard protective actions. Expired bulletins are left out. The service does not fetch a live government feed.
- [Nonprofit Impact](node-ai-nonprofit-impact/README.md) records a program and its activities, then sums beneficiaries and cost. Cost per beneficiary divides total cost by the sum of activity beneficiaries. Activities without an outcome are reported separately.
### Data

- [Data Provenance](node-ai-data-provenance/README.md) records an artifact by content or by SHA-256 digest, then records which artifacts were inputs to a derivation. Lineage walks upstream. A derivation that would create a cycle is rejected.
- [Dataset Quality](node-ai-dataset-quality/README.md) profiles up to 500 object rows for missing values, observed types, uniqueness, numeric outliers, duplicate rows, and violations of an optional string, number, or boolean schema.
- [Synthetic Data Validator](node-ai-synthetic-data-validator/README.md) checks generated rows against declared types, ranges, and categories, and flags duplicate rows and values that look like direct identifiers. Row values are not stored.
### Forecasting and monitoring

- [Energy Forecasting](node-ai-energy-forecasting/README.md) stores a daily series in kWh, kW, or MWh. Fourteen or more points use a 7-day seasonal naive forecast. Shorter series use a straight line. Points far from the median are reported as anomalies.
- [Food Waste Forecasting](node-ai-food-waste-forecasting/README.md) summarizes prepared, sold, and wasted amounts by item. A high waste rate recommends preparing less. Frequent stockouts recommend preparing more. The suggested amount follows the trailing mean of units sold.
- [Water Anomaly Monitor](node-ai-water-anomaly-monitor/README.md) flags negative readings, turbidity above a threshold, sudden spikes, and flat stretches in a local series. It does not connect to a sensor network.
### Model evaluation

- [Evaluation Datasets](node-ai-evaluation-datasets/README.md) reviews items for duplicate ids, empty fields, repeated inputs, the same input in two splits, a missing split, a small set, and a rare classification label. Item text is not stored.
- [Fairness Testing](node-ai-fairness-testing/README.md) compares binary predictions across groups and reports selection rate, base rate, true positive rate, false positive rate, the four-fifths ratio, and the equal-opportunity gap. A group under 30 rows is marked unreliable.
- [Model Evaluation](node-ai-model-evaluation/README.md) scores labeled predictions. Classification reports accuracy, per-class precision, recall, F1, macro F1, and a confusion list. Regression reports MAE, RMSE, and bias. Rows are not stored.
### Operations

- [Incident Investigator](node-ai-incident-investigator/README.md) records a timeline of deploys, alerts, metrics, logs, and notes. The service suggests a recent deploy, an error burst, or more than one service when the timestamps support it.
- [Inference Benchmarks](node-ai-inference-benchmarks/README.md) summarizes successful-request latency percentiles, output tokens per second, and success rate. A run fails its objective when p95 is above the latency limit or the success rate is below the reliability limit.
- [Model Routing](node-ai-model-routing/README.md) registers model cards and chooses the cheapest one that has the requested capabilities, accepts sensitive input when required, and stays inside the cost and latency caps. Ties break toward lower latency, then name. The service does not call a model.
- [Multilingual Quality](node-ai-multilingual-quality/README.md) compares source and target segments for an empty target, an unchanged translation, placeholder drift, missing numbers, a large length change, and whitespace differences. Segment text is not stored.
### Prompts, retrieval, and sensitive data

- [Open Source Triage](node-ai-open-source-triage/README.md) classifies an issue or pull request as needs-info, ready, a small documentation change, or a security report. Similar titles are attached with a token overlap score. Security reports are marked for private disclosure, and the body is not stored.
- [Prompt Injection Lab](node-ai-prompt-injection-lab/README.md) scans user, retrieved, or tool text for instruction override, role replacement, requests for hidden instructions, and fake chat delimiters. A high-risk scan returns a block action. The submitted text is not stored and is not repeated in the response. The service does not generate attacks.
- [Prompt Regression](node-ai-prompt-regression/README.md) saves prompt cases with baseline outputs, then compares a new run. Text matches after trimming and collapsing whitespace. JSON objects and arrays match by value, ignoring key order. A missing or unexpected case fails the run.
- [RAG Evaluation](node-ai-rag-evaluation/README.md) scores an answer against retrieved contexts with lexical faithfulness, answer relevance, and context relevance. Citations use bracket ids such as `[c1]`. This is a lexical score, not a model judge.
- [Retrieval Benchmarks](node-ai-retrieval-benchmarks/README.md) averages precision@k, recall@k, mean reciprocal rank, nDCG@k, and hit rate over labeled rankings. Relevance is binary. Ranked lists are not stored.
- [Sensitive Data Filter](node-ai-sensitive-data-filter/README.md) detects and redacts emails, phone numbers, Social Security numbers, payment card numbers, and secrets before text is logged or sent onward. Findings report the kind and count. The original values are not stored.
