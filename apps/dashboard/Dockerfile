# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

# NEXT_PUBLIC_ vars are baked into the client bundle at build time.
# The browser talks directly to localhost:8000, so this must be the
# host-side URL, not the internal docker service name.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
# Bind to all interfaces so the container is reachable from the host
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static     ./.next/static
COPY --from=builder /app/public           ./public

EXPOSE 3000
CMD ["node", "server.js"]
