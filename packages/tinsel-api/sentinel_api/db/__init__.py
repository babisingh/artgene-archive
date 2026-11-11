"""Database package: connection pool and ORM models.

The catalogue models are imported here, not in models.py, so that importing
anything under sentinel_api.db registers every table on Base.metadata. Doing it
the other way round would make models.py import catalogue and catalogue import
models.py for Base, which is a cycle.
"""

from sentinel_api.db import catalogue as catalogue  # noqa: F401  registers tables
from sentinel_api.db import enquiry as enquiry  # noqa: F401  registers tables
