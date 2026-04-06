FROM public.ecr.aws/lambda/python:3.12 AS base

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

# ── Lambda entry-point ────────────────────────────────────────────────────
# Override for local uvicorn: docker-compose sets its own CMD
CMD ["sentinel_api.main.handler"]
