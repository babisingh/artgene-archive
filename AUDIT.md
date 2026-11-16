# Genome Watch and ArtGene Archive: defect audit and repair

Date: 2026-11-16. Scope: the `genome-watch` tools that feed the archive, and the
archive-side catalogue ingest path they target. Every defect below was
reproduced with a concrete input before it was fixed and re-verified after.

The local stack was stood up to do this: 261 archive tests pass across
`tinsel-api`, `tinsel-core` and `tinsel-gates`; the Alembic chain is linear to
head `016`; the API answers `/api/v1/health` with `db: connected` and serves the
catalogue, certificates and enquiry routes. A real Postgres server could not run
in the audit sandbox (shared memory and TCP binding are both blocked), so the
API was exercised in-process over the repo's own SQLite path with its JSONB
compatibility patch, which is the same harness the project's test suite uses.
Postgres remains the delivery target via docker-compose on the user's machine.

## genome-watch defects

### GW-1 check_draft passed a draft with an archive field in the wrong block
`check_front_matter` tested archive-field presence with the regex
`^\s+<field>\s*:`, which is indentation-blind. Moving `biosafety_class` out of
`archive:` and into `credit:` left the regex satisfied while the field was no
longer where a deposit reads it. A deposit would then silently default
`biosafety_class` to `none`, which is the gate-7 answer, so a misfiled hazard
class would pass unnoticed.

Fix: archive-field presence is now checked against the parsed YAML block in
`check_structure`, so a field under the wrong parent is reported missing. The
regex path remains only as a fallback for when PyYAML is absent, and is
documented as a floor rather than the authority.

Evidence: fixture `field_in_wrong_block.md` went from PASS to
`archive block is missing 'biosafety_class'`.

### GW-2 check_draft read a different value than the deposit would, on a duplicate key
YAML keeps the last of a duplicated mapping key; the validator's status regex
matched the first. A draft carrying `status: proposed` near the top and
`status: artgene-verified` lower down validated against the first spelling while
`deposit_draft.py`, which parses the YAML, would act on the second. The check
and the deposit disagreed about the same file.

Fix: `check_structure` now parses the front matter with a loader that refuses
duplicate mapping keys, and the authoritative status check runs on the parsed
value, not a regex. A duplicated key is a hard failure.

Evidence: fixture `duplicate_status.md` now fails with
`front matter is not valid YAML: duplicate key 'status' in front matter`.

### GW-3 status vocabulary (requested change, not a latent bug)
The tools recognised a single draft status, `needs-review`, and
`deposit_draft.py` would only deposit `status: published`. That conflated three
different states: the agent's unread draft, a draft a person has verified against
the paper, and a draft cleared for the archive.

Change: the status tiers are now `proposed` -> `reviewed` -> `artgene-verified`,
with `needs-review` accepted as a legacy synonym for `proposed` so existing
drafts keep validating. `check_draft.py` accepts all four; `deposit_draft.py`
deposits only `reviewed` and `artgene-verified`. `AGENT_INSTRUCTIONS.md` and
`README.md` were updated to match, and the front-matter template now says
`status: proposed`.

Evidence: `deposit_draft.py` refuses `proposed`, `needs-review` and `published`,
and builds the payload for `reviewed` and `artgene-verified`.

### What was checked and found correct
- `stage_sequences.py`: fetched live from RCSB, NCBI efetch and UniProt; good
  accessions staged, bad ones failed with the error recorded in the manifest.
  The not-FASTA guard correctly rejected RCSB's HTTP-200 error sentence, and a
  path-traversal probe did not escape the staging directory. No change needed.
- `deposit_draft.py` payload: reconciled field by field with the catalogue
  route's Pydantic schema. Names, types and enums all match. A live POST
  returned `201 AGC-2026-000001` with the licence resolved to metadata-only
  hosting and an enquiry queued to the corresponding author.

## Archive-side findings

### AG-1 catalogue `q` search did not match the DOI (enhancement, applied)
The list route's text search covered title, source title, container and
generating model, but not the DOI. A pasted DOI, which is how an ingest caller
finds its own earlier record and how a reader arrives from a citation, returned
nothing. `ARCHIVE_INGEST.md` item 9 had flagged DOI lookup as missing.

Change: `Source.doi` is now included in the `q` search. The DOI is not a
withheld field, so unlike `design_target` this discloses nothing a restricted
record hides. Two regression tests were added; the catalogue suite passes at 23.

### AG-2 licence vocabulary must be seeded before the first catalogue POST (operational note, not a code change)
`POST /api/v1/catalogue` validates the article and data licences against the
`licenses` table, which migration `010` seeds. On a database built by running
the migrations this is automatic. The in-process SQLite audit harness builds
tables from the ORM metadata, which does not run the data-seeding migration, so
the vocabulary had to be applied by hand there. The bring-up script for the real
stack runs migrations, so this does not affect the delivered deployment; it is
recorded so the next person using the SQLite harness is not surprised by an
`UNKNOWN_LICENSE` 422.

## Regression tests added
`genome-watch/tests/test_tools.py`: 16 tests over the three tools (good draft,
legacy and new status tiers, unknown status, duplicate key, misplaced archive
field, mapping-vs-list accessions, banned dash, short body, deposit payload
build, deposit status refusals, prose-authors refusal, FASTA detection). All
pass. `requirements-dev.txt` adds pytest.
