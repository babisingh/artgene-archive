FROM python:3.12-slim

WORKDIR /app

# Copy all workspace packages (build context = repo root)
COPY packages/tinsel-core/  packages/tinsel-core/
COPY packages/tinsel-gates/ packages/tinsel-gates/
COPY packages/tinsel-api/   packages/tinsel-api/

# Install in dependency order
RUN pip install --no-cache-dir \
        packages/tinsel-core \
        packages/tinsel-gates \
        packages/tinsel-api

# Default: run the API server directly
# docker-compose overrides this with the alembic migration prefix
CMD ["uvicorn", "sentinel_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
