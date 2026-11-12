"""There must be no way for this service to send a message.

The licence enquiry design has one rule above the others: no agent ever sends
an email. The archive detects, queues and drafts; a person reads the draft and
sends it from their own mail client.

A configuration flag would be the wrong way to guarantee that, because a flag
can be flipped and a default can drift. The guarantee is that the capability is
absent: no mail library is imported and none is declared as a dependency. This
test fails if that changes, which makes the rule structural rather than
documented.

It also covers outbound HTTP to the mail-as-a-service providers, since "we do
not import smtplib" means little if something posts to a send endpoint.
"""

from __future__ import annotations

import pathlib
import re

import pytest

PACKAGE_ROOT = pathlib.Path(__file__).resolve().parents[1] / "sentinel_api"
PYPROJECT = pathlib.Path(__file__).resolve().parents[1] / "pyproject.toml"

#: Libraries whose only purpose is sending mail.
MAIL_MODULES = (
    "smtplib",
    "aiosmtplib",
    "sendgrid",
    "mailgun",
    "mailjet",
    "resend",
    "postmarker",
    "sparkpost",
    "mandrill",
)

#: Send endpoints, in case something reaches a provider over plain HTTP.
SEND_ENDPOINTS = (
    "api.sendgrid.com",
    "api.mailgun.net",
    "api.resend.com",
    "api.postmarkapp.com",
    "email.us-east-1.amazonaws.com",
)

IMPORT_RE = re.compile(
    r"^\s*(?:from|import)\s+(" + "|".join(MAIL_MODULES) + r")\b", re.MULTILINE
)
CALL_RE = re.compile(r"\.sendmail\s*\(|\bSMTP(?:_SSL)?\s*\(|\bsend_message\s*\(")


def _sources() -> list[pathlib.Path]:
    return sorted(PACKAGE_ROOT.rglob("*.py"))


def test_there_are_python_sources_to_scan() -> None:
    """Guard the guard: a path typo would make every assertion below vacuous."""
    assert len(_sources()) > 10


@pytest.mark.parametrize("module", MAIL_MODULES)
def test_no_mail_library_is_imported(module: str) -> None:
    offenders = [
        str(path.relative_to(PACKAGE_ROOT))
        for path in _sources()
        if re.search(rf"^\s*(?:from|import)\s+{module}\b", path.read_text(), re.MULTILINE)
    ]
    assert not offenders, (
        f"{module} is imported in {offenders}. The archive must not be able to "
        "send messages: it drafts a letter for a person to send."
    )


def test_no_smtp_call_anywhere() -> None:
    offenders = [
        str(path.relative_to(PACKAGE_ROOT))
        for path in _sources()
        if CALL_RE.search(path.read_text())
    ]
    assert not offenders, f"A message-sending call appears in {offenders}."


@pytest.mark.parametrize("endpoint", SEND_ENDPOINTS)
def test_no_provider_send_endpoint(endpoint: str) -> None:
    offenders = [
        str(path.relative_to(PACKAGE_ROOT))
        for path in _sources()
        if endpoint in path.read_text()
    ]
    assert not offenders, f"{endpoint} appears in {offenders}."


def test_no_mail_dependency_is_declared() -> None:
    """A dependency that is not imported today is one import away from being."""
    declared = PYPROJECT.read_text().lower()
    found = [m for m in MAIL_MODULES if f'"{m}' in declared or f"'{m}" in declared]
    assert not found, f"pyproject declares mail libraries: {found}"


def test_the_letter_is_returned_rather_than_sent() -> None:
    """The enquiry module renders text and says so."""
    from sentinel_api import enquiries

    assert hasattr(enquiries, "render_letter")
    assert not any(
        hasattr(enquiries, name) for name in ("send_letter", "send", "deliver", "smtp")
    )
