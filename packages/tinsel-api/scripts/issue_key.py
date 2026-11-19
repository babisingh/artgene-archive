"""Issue an API key with explicit scopes, and print it once.

Until now there was no way to issue a key at all. `seed_prod.py` creates one
key, on first boot, with no scopes, and that is the whole of it. So the key the
archive runs on can read and draft on the unscoped routes and can do nothing on
a scoped one: it cannot publish a catalogue record, which is the one thing the
`/review` page exists to do.

This is the missing half of that. It issues a key against an existing
organisation, with the scopes named on the command line, and prints the raw key
exactly once because only its SHA3-256 hash is stored. Lose it and the remedy
is to issue another and revoke this one; there is no recovery, by design.

Three named sets stand in for the common cases:

    review    read, draft and publish. What a person needs to walk a record
              from draft to published on /review, and nothing more.
    operator  everything, `admin` included. The repository's own definition of
              an operator, in scopes.py.
    agent     what Genome Watch holds: read and draft. Notably not publish.

Any comma-separated list of real scope names works too, and an unknown name is
refused rather than quietly dropped: a key that silently lacks a scope fails
later, somewhere less obvious.

Run it where DATABASE_URL points at the database you mean, for example inside
the deployed container:

    python scripts/issue_key.py --label "babita laptop" --scopes review

Nothing about this is idempotent. Each run issues a new key.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import secrets
import sys
import uuid
from datetime import UTC, datetime, timedelta

from sentinel_api.db.connection import async_session_factory
from sentinel_api.db.models import APIKey, Organisation
from sentinel_api.scopes import (
    AGENT_SCOPES,
    ALL_SCOPES,
    CATALOGUE_DRAFT,
    CATALOGUE_PUBLISH,
    OPERATOR_SCOPES,
    READ_EMBARGOED,
    READ_PUBLIC,
)
from sqlalchemy import select

#: The scopes the /review page needs, and no others. Not `admin`, not
#: `registry:revoke`: publishing a record does not require the authority to
#: issue keys or tear up a certificate, and a key kept in a browser tab should
#: carry the least that does the job.
REVIEW_SCOPES = frozenset(
    {READ_PUBLIC, READ_EMBARGOED, CATALOGUE_DRAFT, CATALOGUE_PUBLISH}
)

NAMED_SETS: dict[str, frozenset[str]] = {
    "review": REVIEW_SCOPES,
    "operator": OPERATOR_SCOPES,
    "agent": AGENT_SCOPES,
}


def resolve_scopes(given: str) -> list[str]:
    """Turn a named set or a comma-separated list into sorted scope names."""
    if given in NAMED_SETS:
        return sorted(NAMED_SETS[given])

    asked = [part.strip() for part in given.split(",") if part.strip()]
    if not asked:
        raise SystemExit("--scopes was empty.")

    unknown = sorted(set(asked) - ALL_SCOPES)
    if unknown:
        raise SystemExit(
            f"Not a scope: {', '.join(unknown)}.\n"
            f"  Named sets  : {', '.join(sorted(NAMED_SETS))}\n"
            f"  Real scopes : {', '.join(sorted(ALL_SCOPES))}"
        )
    return sorted(set(asked))


async def issue(
    org_name: str, label: str, scopes: list[str], description: str | None, days: int | None
) -> None:
    async with async_session_factory() as db:
        result = await db.execute(
            select(Organisation).where(Organisation.name == org_name)
        )
        org = result.scalars().first()
        if org is None:
            raise SystemExit(
                f"No organisation named {org_name!r}. "
                "The production seed creates one called 'default'."
            )

        raw_key = secrets.token_urlsafe(32)
        key = APIKey(
            id=uuid.uuid4(),
            org_id=org.id,
            key_prefix=raw_key[:8],
            key_hash=hashlib.sha3_256(raw_key.encode()).hexdigest(),
            label=label,
            scopes=scopes,
            description=description,
            created_by="scripts/issue_key.py",
            expires_at=(
                datetime.now(UTC) + timedelta(days=days) if days is not None else None
            ),
        )
        db.add(key)
        await db.commit()

    print("=" * 68)
    print(f"  Organisation : {org_name}")
    print(f"  Label        : {label}")
    print(f"  Scopes       : {', '.join(scopes)}")
    print(f"  Expires      : {f'in {days} days' if days is not None else 'never'}")
    print("")
    print(f"  KEY          : {raw_key}")
    print("")
    print("  This is the only time it is shown. Only its hash is stored.")
    print("  Paste it into the archive dashboard at /review, or keep it in a")
    print("  password manager. Do not commit it.")
    print("=" * 68)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Issue a scoped API key and print it once.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Named scope sets:\n"
            + "\n".join(
                f"  {name:9s} {', '.join(sorted(members))}"
                for name, members in NAMED_SETS.items()
            )
        ),
    )
    parser.add_argument(
        "--label", required=True, help="Short name for the key, shown in the database"
    )
    parser.add_argument(
        "--scopes",
        required=True,
        help="A named set (review, operator, agent) or a comma-separated list",
    )
    parser.add_argument("--description", help="Who or what holds this key, in words")
    parser.add_argument("--org", default="default", help="Organisation name")
    parser.add_argument(
        "--expires-days",
        type=int,
        help="Let the key lapse after this many days (default: never)",
    )
    parser.add_argument(
        "--show",
        action="store_true",
        help="Print what would be issued and stop, without touching the database",
    )
    args = parser.parse_args()

    scopes = resolve_scopes(args.scopes)

    if args.show:
        print(f"Would issue a key for organisation {args.org!r}")
        print(f"  label  : {args.label}")
        print(f"  scopes : {', '.join(scopes)}")
        print("Nothing was written.")
        return

    asyncio.run(
        issue(args.org, args.label, scopes, args.description, args.expires_days)
    )


if __name__ == "__main__":
    try:
        main()
    except SystemExit as stop:
        if stop.code not in (0, None):
            print(f"\n{stop.code}\n", file=sys.stderr)
            raise SystemExit(1) from None
        raise
