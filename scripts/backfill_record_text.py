#!/usr/bin/env python3
"""Push the backfill drafts' text and classification into the catalogue API.

The drafts in ``artgene_backfill_drafts/`` are where the archive records what
it read in a paper. Nothing has ever moved them into the API, so a record can
be classified and summarised in the repository while the live site shows a
bare title. This closes that gap.

What it sends, per record:

* ``subtitle``           the draft's ``subtitle``, one or two lines
* ``technical_summary``  the "What was done" and "What they made and
                         measured" paragraphs, joined
* ``summary``            the "In plain words" paragraph
* ``function_class`` / ``subject_class``  the classification

Usage::

    export ARTGENE_API_URL=https://...        # no trailing slash
    export ARTGENE_API_KEY=...                # needs catalogue:draft
    python3 scripts/backfill_record_text.py --dry-run
    python3 scripts/backfill_record_text.py

Matching is by DOI, which is the only identifier a draft and a record share;
the script reads the catalogue, builds a DOI index, and skips any draft whose
paper is not in it rather than guessing. ``--dry-run`` prints what it would
send and touches nothing, and is the default way to check a run before making
it.

The key is read from the environment and never logged. Nothing here deletes
or publishes: both endpoints only set fields on an existing record.
"""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import re
import sys
import urllib.error
import urllib.request

DRAFTS = pathlib.Path(__file__).resolve().parent.parent / "artgene_backfill_drafts"

# The body paragraphs that make up the technical summary, in order.
TECHNICAL_SECTIONS = ("What was done.", "What they made and measured.")
PLAIN_SECTION = "In plain words."


def front_matter(text: str) -> dict:
    """Parse the draft's YAML front matter without a YAML dependency.

    Only the handful of flat scalars this script needs are read, so the
    nested blocks (authors, accessions) are skipped rather than modelled.
    """
    _, front, _ = text.split("---", 2)
    out: dict[str, str] = {}
    for line in front.splitlines():
        m = re.match(r"^(\s*)([a-z_]+):\s*(.*)$", line)
        if not m:
            continue
        indent, key, value = m.groups()
        if len(indent) > 2:
            continue
        value = value.strip()
        if value.startswith(("'", '"')) and value.endswith(("'", '"')) and len(value) > 1:
            value = value[1:-1]
        if value in {">-", "|", "|-", ">"}:
            continue
        out.setdefault(key, value)
    return out


def section(body: str, heading: str) -> str | None:
    """The paragraph introduced by ``**heading**``, without its lead-in."""
    marker = f"**{heading}**"
    if marker not in body:
        return None
    start = body.index(marker) + len(marker)
    end = body.find("\n\n", start)
    para = (body[start:] if end == -1 else body[start:end]).strip()
    return para or None


def payloads(path: pathlib.Path) -> tuple[dict, dict, str]:
    text = path.read_text()
    meta = front_matter(text)
    body = text.split("---", 2)[2]

    technical = [section(body, h) for h in TECHNICAL_SECTIONS]
    technical_summary = "\n\n".join(p for p in technical if p) or None

    summaries = {
        "subtitle": meta.get("subtitle") or None,
        "summary": section(body, PLAIN_SECTION),
        "technical_summary": technical_summary,
        "reason": f"backfill from {path.name}",
    }
    classification = {
        "function_class": meta.get("function_class") or None,
        "subject_class": meta.get("subject_class") or None,
        "reason": f"backfill from {path.name}",
    }
    return summaries, classification, meta.get("doi", "")


def request(url: str, key: str, method: str = "GET", body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    # The API reads X-API-Key (sentinel_api/dependencies.py), not a bearer
    # token. Sending the wrong header fails every call with a 422 for a
    # missing required header, which looks nothing like an auth problem.
    req.add_header("X-API-Key", key)
    if data:
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=60) as resp:  # noqa: S310 - fixed scheme
        return json.loads(resp.read())


def doi_index(base: str, key: str) -> dict[str, str]:
    """Every record the caller can see, keyed by the DOI of its source."""
    index: dict[str, str] = {}
    offset = 0
    while True:
        page = request(f"{base}/api/v1/catalogue?limit=200&offset={offset}", key)
        items = page.get("items", [])
        for item in items:
            record = request(
                f"{base}/api/v1/catalogue/{item['registry_id']}", key
            )
            doi = (record.get("source") or {}).get("doi")
            if doi:
                index[doi.lower()] = item["registry_id"]
        offset += len(items)
        if not items or offset >= page.get("count", 0):
            return index


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="print what would be sent and change nothing",
    )
    args = parser.parse_args()

    base = os.environ.get("ARTGENE_API_URL", "").rstrip("/")
    key = os.environ.get("ARTGENE_API_KEY", "")
    if not args.dry_run and not (base and key):
        print("Set ARTGENE_API_URL and ARTGENE_API_KEY, or pass --dry-run.")
        return 2

    drafts = sorted(DRAFTS.glob("*.md"))
    if not drafts:
        print(f"No drafts found in {DRAFTS}")
        return 1

    index: dict[str, str] = {}
    if not args.dry_run:
        print("Reading the catalogue to match drafts by DOI.")
        index = doi_index(base, key)
        print(f"  {len(index)} record(s) with a DOI.")

    sent = skipped = 0
    for path in drafts:
        summaries, classification, doi = payloads(path)
        missing = [k for k in ("subtitle", "summary", "technical_summary") if not summaries[k]]

        if args.dry_run:
            print(f"\n{path.name}")
            print(f"  doi               {doi or '(none)'}")
            print(f"  subtitle          {(summaries['subtitle'] or '')[:72]}")
            print(f"  summary           {(summaries['summary'] or '')[:72]}")
            print(f"  technical_summary {(summaries['technical_summary'] or '')[:72]}")
            print(f"  function/subject  {classification['function_class'] or '-'}"
                  f" / {classification['subject_class'] or '-'}")
            if missing:
                print(f"  MISSING: {', '.join(missing)}")
            continue

        registry_id = index.get(doi.lower()) if doi else None
        if not registry_id:
            print(f"skip {path.name}: no catalogue record with doi {doi or '(none)'}")
            skipped += 1
            continue

        try:
            request(
                f"{base}/api/v1/catalogue/{registry_id}/summaries",
                key,
                "PUT",
                summaries,
            )
            request(
                f"{base}/api/v1/catalogue/{registry_id}/classification",
                key,
                "PUT",
                classification,
            )
        except urllib.error.HTTPError as exc:
            print(f"FAILED {registry_id} ({path.name}): {exc.code} {exc.read().decode()[:200]}")
            return 1
        print(f"sent {registry_id}  {path.name}")
        sent += 1

    if not args.dry_run:
        print(f"\n{sent} record(s) updated, {skipped} skipped.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
