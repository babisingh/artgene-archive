# Contributing to ArtGene-Archive

ArtGene-Archive is operated as public-interest biosafety infrastructure by the
**ArtGene Consortium**. Contributions are welcome from researchers, engineers,
biosecurity practitioners, and policy experts. This document explains how to
contribute effectively and what governance rules apply to the project.

---

## Table of Contents

- [Who governs this project](#who-governs-this-project)
- [Scope of the public repository](#scope-of-the-public-repository)
- [How to contribute](#how-to-contribute)
- [Types of contribution](#types-of-contribution)
- [Biosafety gate contributions](#biosafety-gate-contributions)
- [Licensing of contributions](#licensing-of-contributions)
- [Code of conduct](#code-of-conduct)
- [Contact](#contact)

---

## Who governs this project

ArtGene-Archive is governed by the **ArtGene Consortium**, a voluntary body of
researchers and institutions committed to open, auditable infrastructure for
AI-generated biological sequences. The Consortium operates under the
[ArtGene Charter v1.0](https://artgene-archive.org/about).

The founding maintainer is **Babita Singh** (Genethropic, Barcelona).
Governance documents, including the technical advisory board composition and
the biosafety review panel charter, are maintained at
[artgene-archive.org/about](https://artgene-archive.org/about).

All significant architectural decisions are made publicly via GitHub
Discussions before implementation. There are no private roadmaps.

---

## Scope of the public repository

This repository contains the following components, all of which are open for
contribution:

| Package | Contents |
|---|---|
| `tinsel-core` | Data models, TINSEL encoder/decoder, Reed-Solomon codec |
| `tinsel-gates` | Four-gate biosafety pipeline, gate adapters, mock stubs |
| `tinsel-api` | FastAPI application, PostgreSQL migrations, WOTS+ signing |
| `dashboard` | Next.js 16 frontend: submit, browse, verify, certificate detail |
| `docs/` | Technical specification, API reference, charter documents |

**Not in this repository:** The production spreading key vault, the Verify
Source decoder server logic, and production API credentials. These are
server-side only and are never distributed. The algorithm is public; the
cryptographic keys are not. This is standard practice for any deployed
cryptographic system.

---

## How to contribute

### 1. Open an issue first

For any non-trivial change, open an issue before writing code. This prevents
duplicate effort and allows the maintainers to flag scope or biosafety
concerns early. Use the appropriate issue template:

- **Bug report** -- something is broken or producing incorrect output
- **Gate improvement** -- proposal to modify or extend a biosafety gate
- **New feature** -- architectural addition to the registry or pipeline
- **Documentation** -- corrections, clarifications, translations
- **Policy / governance** -- questions about the charter or data-access rules

### 2. Fork and branch

Fork the repository and create a descriptive branch:

```bash
git checkout -b fix/gate-beta-gravy-threshold
git checkout -b feat/orcid-identity-integration
git checkout -b docs/api-reference-update
```

### 3. Run the test suite before opening a pull request

```bash
# Python backend
cd tinsel-core && pytest -v          # 51 unit tests
cd tinsel-gates && pytest -v
cd tinsel-api && pytest -v

# Full stack (requires Docker)
docker compose up --build
```

All 51 unit tests must pass. Pull requests that break the test suite will not
be merged.

### 4. Open a pull request

Pull requests should:

- Reference the issue they address (e.g. `Closes #42`)
- Include a clear description of what changed and why
- Add or update tests for any changed logic
- Not introduce new external dependencies without prior discussion

---

## Types of contribution

### Biosafety gate contributions

Gate-level changes require extra scrutiny because incorrect thresholds could
cause unsafe sequences to pass screening, or safe sequences to be incorrectly
rejected. The following rules apply to any pull request that modifies
`tinsel-gates/`:

1. The change must be accompanied by a literature citation or empirical data
   justifying the new threshold or method.
2. The PR description must include test cases covering both pass and fail
   outcomes near the decision boundary.
3. Gate changes require review and approval from at least one member of the
   biosafety review panel before merge. Tag `@artgene-biosafety-panel` in your
   PR.

### Registry and API contributions

Changes to `tinsel-api/` that affect certificate schema, audit log structure,
or the deduplication logic require a discussion issue to be resolved before
the PR is opened. These changes affect the immutability guarantees of the
registry and must be handled carefully.

### Documentation and translations

Documentation improvements and translations into additional languages are
always welcome and do not require a prior issue. The archive currently serves
content in English, French, Spanish, Chinese, and Japanese. Corrections to
any language version can be submitted directly as a pull request.

---

## Licensing of contributions

By submitting a pull request to this repository, you agree that your
contribution is licensed under the **Apache License 2.0**, the same license
that governs the project. You confirm that:

- You have the right to submit the contribution under this license.
- The contribution does not include proprietary code belonging to a third
  party without their explicit written permission.

No separate Contributor License Agreement (CLA) is currently required.
This policy may be updated as the Consortium governance formalises.

---

## Code of conduct

ArtGene-Archive follows the
[Contributor Covenant Code of Conduct v2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).
Biosafety infrastructure requires a community built on mutual respect and
rigorous scientific standards. Conduct that undermines either will result in
removal from the project.

Report conduct issues to: b@genethropic.com

---

## Contact

| Channel | Use |
|---|---|
| [GitHub Issues](https://github.com/babisingh/artgene-archive/issues) | Bugs, features, gate proposals |
| [GitHub Discussions](https://github.com/babisingh/artgene-archive/discussions) | Architecture questions, governance |
| b@genethropic.com | Sensitive biosafety concerns, institutional partnerships |
| [artgene-archive.org](https://artgene-archive.org) | General registry information |

---

*ArtGene Consortium · artgene-archive.org · Apache 2.0*
