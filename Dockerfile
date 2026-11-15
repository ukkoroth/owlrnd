# owlrnd production image: the Next.js app and its background worker in one process.
# Build: docker build -t owlrnd:<tag> .   Run: see deploy/compose.yml.

FROM node:22.20.0-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Next.js loads server modules while building; these placeholders satisfy the settings check for this step only
# (nothing connects at build time, and they are not part of the final image).
RUN DATABASE_URL=postgres://build:build@localhost:5432/build AUTH_SECRET=build-time-placeholder-not-a-secret-000 \
    npm run build \
 && node_modules/.bin/esbuild scripts/migrate.ts --bundle --platform=node --target=node22 --format=cjs \
      --external:pg-native --outfile=dist/migrate.cjs

FROM node:22.20.0-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
# Certificates for a verified TLS connection to the managed database (Lightsail/RDS).
ADD --chmod=644 https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /app/certs/rds-global-bundle.pem
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/dist/migrate.cjs ./migrate.cjs
COPY --from=build --chown=node:node /app/src/server/db/migrations ./migrations
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
