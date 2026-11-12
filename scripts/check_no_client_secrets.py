#!/usr/bin/env python3
"""Fail if a credential could reach the browser.

Generic secret scanners catch a key that was committed. They do not catch the
architectural mistake this project actually made, which is a key that is read
on the client and therefore inlined into the JavaScript bundle at build time.
Next inlines every NEXT_PUBLIC_* variable that exists when the build runs, so
`process.env.NEXT_PUBLIC_API_KEY` in a component is a published credential the
moment that variable is set in the deployment environment.

That path was live in lib/providers.tsx. It happened to leak nothing, because
the variable was never set, which is luck rather than design. These four checks
make the regression impossible to merge.

Run from the repository root:

    python3 scripts/check_no_client_secrets.py

Exit status 0 if every check passes, 1 otherwise. Wired into .github/workflows/ci.yml,
and worth adding to the dashboard image build so check 2 sees the build
environment.
"""

from __future__ import annotations

import os
import re
import sys

# Words that mark an environment variable or identifier as carrying a secret.
# Deliberately broad: a false positive costs one rename, a false negative costs
# a published credential.
SECRET_WORDS = r"(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL|PRIVATE|SIGNING)"

# Directories holding code that is compiled into the client bundle.
CLIENT_DIRS = ("apps",)

# Extensions worth reading. Lockfiles and images are not client source.
CLIENT_EXTS = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".svelte", ".vue")

# Paths excluded from the source scans: build output, dependencies, and this
# script's own documentation of the patterns it looks for.
EXCLUDE_PARTS = ("node_modules", ".next", "dist", "build", ".turbo")

# The proxy must keep an allowlist. Named here so the check fails loudly if the
# constant is renamed, rather than silently passing.
PROXY_PATH = os.path.join(
    "apps", "dashboard", "app", "api", "proxy", "[...path]", "route.ts"
)
PROXY_ALLOWLIST_SYMBOL = "PUBLIC_GET_PATHS"


def client_source_files():
    """Yield paths of client source files, skipping build output and deps."""
    for root_dir in CLIENT_DIRS:
        for dirpath, dirnames, filenames in os.walk(root_dir):
            dirnames[:] = [d for d in dirnames if d not in EXCLUDE_PARTS]
            for name in filenames:
                if name.endswith(CLIENT_EXTS):
                    yield os.path.join(dirpath, name)


def read(path):
    try:
        with open(path, encoding="utf-8", errors="replace") as handle:
            return handle.read()
    except OSError:
        return ""


def check_client_reads_of_public_secrets():
    """Check 1: no component may read a NEXT_PUBLIC_* variable that names a secret.

    This is the exact mistake that was in providers.tsx. Reading the variable is
    the whole problem, because the value is substituted at build time.
    """
    pattern = re.compile(r"NEXT_PUBLIC_[A-Z0-9_]*" + SECRET_WORDS + r"[A-Z0-9_]*")
    problems = []
    for path in client_source_files():
        for line_no, line in enumerate(read(path).splitlines(), start=1):
            match = pattern.search(line)
            if match:
                problems.append(
                    "%s:%d reads %s, which Next inlines into the client bundle"
                    % (path, line_no, match.group(0))
                )
    return problems


def check_build_environment():
    """Check 2: the current environment defines no secret-shaped NEXT_PUBLIC_* var.

    Only meaningful where the build actually runs. Harmless elsewhere, because a
    developer shell will not normally define one either.
    """
    pattern = re.compile(r"^NEXT_PUBLIC_[A-Z0-9_]*" + SECRET_WORDS)
    problems = []
    for name, value in os.environ.items():
        if pattern.match(name) and value.strip():
            problems.append(
                "environment defines %s with a non-empty value: it would be "
                "compiled into the bundle and served to every visitor" % name
            )
    return problems


def check_literal_credentials():
    """Check 3: no long literal assigned to a secret-shaped identifier.

    Scoped to identifiers whose name claims they hold a credential, which keeps
    it precise: minified vendor code and long class names do not match.
    """
    pattern = re.compile(
        r"""(?ix)
        \b([A-Za-z_][A-Za-z0-9_]*""" + SECRET_WORDS + r"""[A-Za-z0-9_]*)
        \s*[:=]\s*
        ["'`]([A-Za-z0-9_\-/+=]{20,})["'`]
        """
    )
    problems = []
    for path in client_source_files():
        for line_no, line in enumerate(read(path).splitlines(), start=1):
            match = pattern.search(line)
            if match:
                problems.append(
                    "%s:%d assigns a %d-character literal to %s"
                    % (path, line_no, len(match.group(2)), match.group(1))
                )
    return problems


def check_proxy_allowlist():
    """Check 4: the server-side proxy still restricts which paths get its key.

    The proxy runs on the server, so any key it attaches is effectively public.
    It previously attached one to every path and method. An allowlist is the
    control; this check fails if the allowlist disappears.
    """
    if not os.path.exists(PROXY_PATH):
        return ["%s is missing: the proxy allowlist check cannot run" % PROXY_PATH]

    source = read(PROXY_PATH)
    problems = []
    if PROXY_ALLOWLIST_SYMBOL not in source:
        problems.append(
            "%s no longer defines %s: the proxy must only attach a server key "
            "to an allowlist of public GET paths"
            % (PROXY_PATH, PROXY_ALLOWLIST_SYMBOL)
        )
    # The original defect, verbatim: an unconditional fallback to the server key.
    if re.search(r"""get\(\s*["']x-api-key["']\s*\)\s*\|\|\s*\w*API_KEY""", source):
        problems.append(
            "%s falls back to the server API key unconditionally, which makes "
            "every authenticated endpoint reachable anonymously" % PROXY_PATH
        )
    return problems


CHECKS = (
    ("client reads of secret NEXT_PUBLIC_* variables", check_client_reads_of_public_secrets),
    ("secret-shaped NEXT_PUBLIC_* in the environment", check_build_environment),
    ("credential literals in client source", check_literal_credentials),
    ("server proxy path allowlist", check_proxy_allowlist),
)


def main():
    failed = 0
    for label, check in CHECKS:
        problems = check()
        if problems:
            failed += 1
            print("FAIL  %s" % label)
            for problem in problems:
                print("        %s" % problem)
        else:
            print("ok    %s" % label)

    if failed:
        print("\n%d of %d checks failed." % (failed, len(CHECKS)))
        return 1
    print("\nAll %d checks passed." % len(CHECKS))
    return 0


if __name__ == "__main__":
    sys.exit(main())
