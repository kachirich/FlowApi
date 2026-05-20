# ──────────────────────────────────────────────────────────────────────────────
# Stage 1 — Install production dependencies
# ──────────────────────────────────────────────────────────────────────────────
FROM node:18-alpine AS deps

WORKDIR /app

# Copy only the files needed for `npm ci` so this layer is cached unless
# package.json or package-lock.json change.
COPY package.json package-lock.json ./

RUN npm ci --omit=dev

# ──────────────────────────────────────────────────────────────────────────────
# Stage 2 — Production image
# ──────────────────────────────────────────────────────────────────────────────
FROM node:18-alpine AS production

# Security: run as a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy production node_modules from the deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# Drop privileges
USER appuser

EXPOSE 3000

# Healthcheck — matches the /health endpoint in routes/index.js
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
