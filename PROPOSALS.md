# ArtGene Archive: proposed user experience enhancements

The audit and backfill have revealed several opportunities to streamline ingest,
discovery and citation. All are ranked by impact. The list is for your review; none
are implemented.

## High-impact (ingest + discovery pain points)

### P1: search-by-accession shortcut
Current: DOI search now works via `q` (the main search box). But PDB, GenBank and
UniProt IDs require the ingest user to know they can filter by `accessions` in the
source code or build a detailed query.

Proposal: add a `/?accession=<id>` route that resolves `PDB:7abc`, `GenBank:NC_000001`,
`UniProt:P12345` etc to the matching records. Accession resolvers are cheaper than a
full catalogue search and feed discovery directly (a Zenodo/figshare link, a PDB
structure ID). This is how a wet-lab reader arriving from a Methods reference link
("see structures in PDB:1xyz") gets to the archive. The route should 404 on unknown
formats and 200-with-empty on no matches.

Effort: add a new GET `/api/v1/catalogue/lookup` returning `{records: […] | null}`
and filter logic for each accession database.

### P2: accession context in the list view
Current: the web UI shows title, authors, date, molecule type. The accessions are
stuffed in the archive metadata.

Proposal: surface the most significant accession (a structure, a sequence record) in
the list card next to the title. If a record has PDB, show that; else GenBank; else
UniProt. A researcher scanning the list can immediately see "oh, this designed
binder has a structure" without opening the record. Hover reveals all accessions.

Effort: 2–3 hours on the dashboard; query already has accessions, just UI.

### P3: smart date filter and sorting
Current: list supports filtering by `status`, `molecule_type`, `biosafety_class`.

Proposal: add date-range filtering (`from=YYYY-MM-DD&to=…`) and a `sort` parameter
supporting `date-asc`, `date-desc` (default), `title` (A-Z), `authors` (last-name
A-Z), `citations` (count descending, via the OpenAlex API when available). Many
researchers look for recent work in a category; this is table-stake for discovery.

Effort: schema + route filter, 2 hours. The citation count requires an async OpenAlex
call per record (or a batch call), which adds latency unless cached.

### P4: licence compliance banner per record
Current: article and data licences are stored and filterable, but invisible in the
web view.

Proposal: show a 1-line banner under the record title: 
  "Article: CC-BY-4.0 (OA) | Data: CC0-1.0 | Sequences: not deposited"
This is essential for a researcher deciding whether to reuse design data or cite the
work.

Effort: 1 hour on the dashboard; licence data already in the API.

## Medium-impact (ingest quality and citation)

### P5: batch ingest status page
Current: `genome-watch` tools validate and deposit one draft at a time. A person or
bot handling 20+ papers gets no summary of which passed, which rejected and why.

Proposal: add a `genome-watch/ingest_batch.py` that takes a folder of drafts,
validates all with `check_draft`, attempts to deposit all that pass, and returns a
summary table: title | status | reason | archive_id | url. This runs in the CI or
on a local machine to backfill the archive in bulk.

Effort: 1-2 hours; glues existing tools with a summary reporter.

### P6: DOI → ArtGene redirect
Current: when a researcher publishes a paper that **uses** a designed sequence from
the archive, they cite it by DOI. The DOI resolves to the full record on the
archive.

Proposal: register with Crossref as a data-citations registrant, and issue DOIs to
records (e.g., 10.5281/zenodo.123456 for AGC-2026-000001). A researcher cites the
archive record as a data publication and gets credit attribution. Citing becomes a
one-liner in the paper's reference list.

Effort: Crossref integration + a DOI-minting service (Zenodo, DataCite). 4-6 hours
to glue them. Requires upfront Crossref account setup and policy alignment (is the
archive an institutional member?).

### P7: author notification on new similar designs
Current: when a person submits a record, the archive queues an editorial enquiry to
the corresponding author (via the deposit route). No other notifications go out.

Proposal: add a subscription feature where researchers can opt-in to digests of
new designs in a category or by a keyword. E.g., "notify me of new binders" or
"notify me of designs using RFdiffusion". Digest frequency: daily, weekly, or
real-time. This drives traffic and community engagement.

Effort: add a `subscriptions` table, an email renderer, and a scheduler. 6-8 hours.

## Lower-impact (operational ease)

### P8: dark mode
Current: the dashboard is light-only.

Proposal: add a Tailwind dark: variant toggle in the navbar. Many researchers
prefer dark mode late-night.

Effort: 1-2 hours.

### P9: quick-start guides per molecule type
Current: homepage is minimal. A researcher looking to design binders, enzymes or
AAV capsids gets no on-ramp.

Proposal: add expandable quick-start cards on the homepage: 
  - "Binders: see [X] records; example methods: RFdiffusion, ProteinMPNN"
  - "Enzymes: see [Y] records; example methods: ProtGNN, ESMFold"
  - etc.
Each links to a filtered list. This is simple landing-page marketing for the
archive.

Effort: 1 hour on the dashboard.

### P10: API rate-limiting and usage analytics
Current: the API has no public rate limits documented and no usage dashboard.

Proposal: add a simple in-process rate limiter (100 req/min per IP) and log hits
to a table. Surface anonymised analytics on the dashboard: total hits, top-hit
routes, top-hit molecule types. This shows value to funders and informs roadmap
priorities.

Effort: 2-3 hours.

## Recommended next steps
Prioritise by your use case:
- Research discovery: **P2** (accession context) → **P3** (date/sort filters) → **P4**
  (licence banner). These make the archive a credible data source.
- Scaling ingest: **P5** (batch ingest status) → **P1** (accession lookup). These
  speed up backfilling and let you ingest 100+ records per batch.
- Community adoption: **P7** (subscriptions) → **P6** (DOI citations). These turn
  the archive into a citable resource that researchers depend on.
- Operations: **P10** (rate-limiting) on day 1 for any public launch.

## Out of scope (for now)
- Automated ingest from bioRxiv/arXiv using abstract screening: fun, but over-fits
  to the current dataset. Wait for 50+ records and stable gates before automating
  candidate selection.
- Full-text indexing with Elasticsearch: overkill until the catalogue grows
  10x. The current SQL `q` search is good enough.
- GraphQL API: REST works fine. Add GraphQL when you have specific clients that
  need batching.
