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
