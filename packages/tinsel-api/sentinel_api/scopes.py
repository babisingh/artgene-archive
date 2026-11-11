"""API key scopes: what a key is allowed to do.

The archive runs on closed service accounts. The point of these is the one
distinction that matters operationally: the Genome Watch agent may create and
amend catalogue drafts, and may not publish or revoke anything. That is a
permission checked on every request, not a convention in a prompt.

A key with no scopes can do nothing on any scoped route. New surface is scoped;
the older routes still use require_api_key and are unscoped, so adding scopes to
them is a deliberate follow-up rather than a silent breaking change.
"""

from __future__ import annotations

#: Read any published record. What the dashboard proxy carries.
READ_PUBLIC = "read:public"
#: Read the owning organisation's unpublished records.
READ_EMBARGOED = "read:embargoed"
#: Create and amend catalogue records in draft, staged or reviewed.
CATALOGUE_DRAFT = "catalogue:draft"
#: Move a catalogue record to published. Deliberately separate from the above.
CATALOGUE_PUBLISH = "catalogue:publish"
#: Deposit a first-party sequence through POST /register.
REGISTRY_DEPOSIT = "registry:deposit"
#: Revoke an issued certificate.
REGISTRY_REVOKE = "registry:revoke"
#: Key issuance and takedowns. Implies everything else.
ADMIN = "admin"

ALL_SCOPES = frozenset({
    READ_PUBLIC,
    READ_EMBARGOED,
    CATALOGUE_DRAFT,
    CATALOGUE_PUBLISH,
    REGISTRY_DEPOSIT,
    REGISTRY_REVOKE,
    ADMIN,
})

#: What the Genome Watch agent gets. Note the absence of CATALOGUE_PUBLISH: a
#: person moves a record to published, which is the editorial control.
AGENT_SCOPES = frozenset({READ_PUBLIC, CATALOGUE_DRAFT})

#: What an operator gets.
OPERATOR_SCOPES = frozenset(ALL_SCOPES)
