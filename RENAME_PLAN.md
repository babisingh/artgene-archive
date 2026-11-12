# Retiring the three naming suppressions

Plan for removing the `N815`, `N802` and `N999` entries from
`pyproject.toml`, written 2026-11-12 after verifying each claim against the
code and a real PostgreSQL 16 database.

## The three are not equally expensive

They were suppressed together, which made them look like one problem. They are
not.

| Rule | What it names | Reaches stored data or a client? | Cost to fix |
|---|---|---|---|
| `N802` | the function `run_secureDNA_screen` | **No** | 3 lines, no migration |
| `N999` | the module `adapters/gate2/secureDNA.py` | **No** | a file move, 2 imports |
| `N815` | the four `secureDNA_*` fields of `Gate2Result` | **Yes** | migration + client release |

The first two are internal identifiers. The stored audit trail records the
literal strings `"SecureDNA DOPRF"` and `"doprf_30mer_mock"` as *values* in
`db_entry` (`adapters/gate2/secureDNA.py:109`), never the Python identifier, so
renaming the function and the module changes no data and no API response. An
earlier note in `pyproject.toml` said the function name appeared in the audit
trail. That was wrong, and it is corrected there now.

Only `N815` is a real contract, for one specific reason: `Gate2Result` is a
pydantic model, so each attribute name *is* a JSON key, and
`routes/certificates.py` serves `cert.consequence_report` straight out of the
JSONB column without re-serialising it (lines 117, 235, 378, 455). **The keys
in the database are the client contract.**

## Why the timing decides the cost, not the work

The field rename is cheap exactly once. Today:

- The API has been returning HTTP 500 since roughly 2026-07, so nothing can be
  deposited and no client is reading a live record.
- `CHECKLIST.md` records that the registry has never held a record, and
  `AG-2026-000001` is still to be minted as the paper's first deposit.
- The dashboard's SecureDNA panel opens with
  `if (!gate2.secureDNA_checked) return null`, so against a record that lacks
  the key it renders nothing rather than breaking.

After the first live AG-ID exists and is cited in the paper, the same rename
rewrites the JSONB of a published, citable certificate and needs the API and
the dashboard deployed in lockstep. The work does not grow much. The care
required grows a lot.

That makes this a decision to take before `DEPLOY.md` is executed, not after.

## Two ways to satisfy `N815`

Both were tested, not reasoned about.

### Option A: pydantic alias, keep the JSON keys

Rename the Python attributes to `secure_dna_*` and pin the wire format with
`Field(alias=...)` plus `populate_by_name=True`. Verified behaviour:

```
attribute access   : g.secure_dna_checked          -> True
dump by_alias=True : {"secureDNA_checked": true}   <- storage format unchanged
dump default       : {"secure_dna_checked": true}  <- silently different
old row parses     : Report.model_validate({"secureDNA_checked": true})  -> ok
```

No migration, no client change, and old rows keep parsing. `ruff` is satisfied
because `N815` looks at the attribute, not the alias string.

The third line is the problem. There is exactly one serialisation site today,
`report_dict = report.model_dump()` at `routes/register.py:387`, which would
become `model_dump(by_alias=True)`. Any future `model_dump()` added anywhere
would silently change the stored key names with no test failing. Option A is
only safe with a test that asserts the stored keys, and that test is then
load-bearing forever.

### Option B: rename everything, including the stored keys

One spelling in the Python, the JSONB, the API response and the client. No
alias, no footgun. Needs a data migration and the nine TypeScript references
updated.

## Recommendation

**Option B, now, as a prerequisite to the deploy runbook.** Option A trades a
one-off migration for a permanent inconsistency plus a trap, and it buys
nothing while the registry is empty. The window in which B costs almost
nothing closes the moment the API is restored and the first certificate is
minted.

If the deploy should not grow any scope before the paper, Option A is a sound
fallback, and leaving the suppression in place is defensible too: it is
documented and it breaks nothing. What is not sound is doing B casually later.

Either way, `N802` and `N999` should go now. They are free.

## Steps

**Phase 1, free, no data or client impact.**

1. Rename `run_secureDNA_screen` to `run_secure_dna_screen`
   (`adapters/gate2/secureDNA.py:109`, imported at `chained.py:35`, called at
   `chained.py:74`). Leave the `db_entry` string values alone: they are the
   vendor's name and belong in the audit trail as written.
2. `git mv` the module to `adapters/gate2/secure_dna.py` and update the two
   imports.
3. Drop the `N802`/`N999` entry from `pyproject.toml`.
4. `ruff check packages/` and the full suite.

**Phase 2, the four fields.** Do this while the registry is empty.

5. Rename the declarations at `consequence.py:83-86` and the four keyword
   arguments at `chained.py:147-150` to `secure_dna_checked`,
   `secure_dna_windows_screened`, `secure_dna_hits`, `secure_dna_status`.
6. Add migration `014`, with the SQL below, and a downgrade using its inverse.
7. Update the nine TypeScript references: `lib/api.ts:85-88` and
   `app/sequences/[id]/page.tsx:306, 307, 308, 317, 338`.
8. Drop the `N815` entry and the explanatory comment from `pyproject.toml`.
9. Record in `CHECKLIST.md` that the suppression is gone and why it was safe to
   remove when it was.

**Phase 3, deploy order.** The API must be writing the new keys before the
dashboard expects them, but because the panel returns null on a missing key,
either order degrades to a blank panel rather than an error. Deploy the API
first anyway.

## The migration SQL

Tested on PostgreSQL 16 against a clone of the local database carrying one real
certificate, one synthetic certificate with populated SecureDNA values and
nested hit objects, and one certificate with no `gate2` block at all.

```sql
UPDATE certificates
SET consequence_report = jsonb_set(
        consequence_report,
        '{gate2}',
        (consequence_report -> 'gate2')
            - 'secureDNA_checked'
            - 'secureDNA_windows_screened'
            - 'secureDNA_hits'
            - 'secureDNA_status'
        || COALESCE(
               (
                   SELECT jsonb_object_agg(
                              CASE key
                                  WHEN 'secureDNA_checked'          THEN 'secure_dna_checked'
                                  WHEN 'secureDNA_windows_screened' THEN 'secure_dna_windows_screened'
                                  WHEN 'secureDNA_hits'             THEN 'secure_dna_hits'
                                  WHEN 'secureDNA_status'           THEN 'secure_dna_status'
                              END,
                              value
                          )
                   FROM jsonb_each(consequence_report -> 'gate2')
                   WHERE key IN (
                       'secureDNA_checked',
                       'secureDNA_windows_screened',
                       'secureDNA_hits',
                       'secureDNA_status'
                   )
               ),
               '{}'::jsonb
           )
    )
WHERE jsonb_typeof(consequence_report -> 'gate2') = 'object'
  AND (
      consequence_report -> 'gate2' ? 'secureDNA_checked'
   OR consequence_report -> 'gate2' ? 'secureDNA_windows_screened'
   OR consequence_report -> 'gate2' ? 'secureDNA_hits'
   OR consequence_report -> 'gate2' ? 'secureDNA_status'
  );
```

The downgrade is the same statement with the two spellings swapped in the
`CASE`, the `-` list and the `WHERE`.

What the test established:

- The four keys are renamed and every other key in `gate2` is untouched: the
  key count stayed at 18.
- Values survive by type, not just by presence: `true` stayed boolean, `1487`
  stayed an integer, and the two nested hit objects kept their `score`,
  `window` and `organism` members.
- Idempotent in both directions. A second run reports `UPDATE 0`.
- A certificate with no `gate2` block is not touched.
- Up followed by down returns byte-identical JSONB
  (`consequence_report = snapshot.consequence_report` was true for every row
  snapshotted in its original state).

## Tests to add with the change

- Assert the **stored** key spelling, reading the JSONB back after a deposit.
  This is the test that would have caught the problem the suppression was
  guarding against, and it is required under either option.
- A migration test over three rows: populated, absent `gate2`, already
  migrated.
- Under Option A only: a test that `model_dump()` and `model_dump(by_alias=True)`
  disagree, so the footgun is documented where someone will see it.

## Rollback

`alembic downgrade` to the previous revision runs the inverse statement, which
round-trips byte-identically. The dashboard is a separate deploy and can be
reverted on its own. Because the panel returns null on a missing key, a
half-rolled-back state shows no SecureDNA panel rather than an error.

## What I could not verify

**The production row count.** `artgene-archive.org/api/proxy/health` and
`/api/proxy/certificates` both return HTTP 500, so the live database cannot be
queried from here. `CHECKLIST.md` says the registry has never held a record,
and the API being down means nothing new can arrive, but the API being down is
not proof that the database is empty: rows could predate the outage.

So before running migration `014`, run the count first:

```sql
SELECT count(*) AS total,
       count(*) FILTER (WHERE consequence_report -> 'gate2' ? 'secureDNA_checked') AS needing_rename
  FROM certificates;
```

If `needing_rename` is zero, Phase 2 is a code and client change with a no-op
migration, which is the cheap case this plan assumes. If it is not zero, the
migration is still correct, but the deploy stops being casual: take a backup
first, and treat Phase 3's ordering as mandatory rather than advisory.
