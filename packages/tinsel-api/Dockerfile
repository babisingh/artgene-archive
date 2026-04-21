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

# Make startup script executable
RUN chmod +x /app/packages/tinsel-api/scripts/start.sh

# start.sh: runs `alembic upgrade head` then starts uvicorn on $PORT (Railway injects this)
CMD ["/app/packages/tinsel-api/scripts/start.sh"]
