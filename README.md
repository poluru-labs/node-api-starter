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
