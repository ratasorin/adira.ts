# syntax=docker/dockerfile:1.7
FROM node:24-bookworm-slim AS dependencies
WORKDIR /workspace/examples/monefy
COPY packages/core/package.json /workspace/packages/core/package.json
COPY packages/backend/package.json /workspace/packages/backend/package.json
COPY packages/client/package.json /workspace/packages/client/package.json
COPY packages/generator/package.json /workspace/packages/generator/package.json
COPY examples/monefy/package.json examples/monefy/package-lock.json ./
COPY examples/monefy/scripts/sync-adira.mjs ./scripts/sync-adira.mjs
COPY examples/monefy/backend/package.json ./backend/package.json
COPY examples/monefy/backend/shared/package.json ./backend/shared/package.json
COPY examples/monefy/frontend/package.json ./frontend/package.json
RUN node scripts/sync-adira.mjs
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

FROM dependencies AS build
COPY packages /workspace/packages
COPY examples/monefy/backend/src ./backend/src
COPY examples/monefy/backend/scripts ./backend/scripts
COPY examples/monefy/backend/tsconfig.json examples/monefy/backend/config.adira.json ./backend/
RUN npm run sync:adira && npm run build -w @n/adira.core.ts && npm run build -w @n/adira.backend.ts && npm run build -w @monefy/backend

FROM dependencies AS production-dependencies
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --workspace=@monefy/backend --workspace=@n/adira.backend.ts --workspace=@n/adira.core.ts --include-workspace-root=false --no-audit --no-fund

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=5000 PDF_ARTIFACT_DIR=/data/previews ASSET_DIR=/data/assets
WORKDIR /app
COPY --from=production-dependencies --chown=node:node /workspace/examples/monefy/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/examples/monefy/.adira/core/package.json ./.adira/core/package.json
COPY --from=build --chown=node:node /workspace/examples/monefy/.adira/core/dist ./.adira/core/dist
COPY --from=build --chown=node:node /workspace/examples/monefy/.adira/backend/package.json ./.adira/backend/package.json
COPY --from=build --chown=node:node /workspace/examples/monefy/.adira/backend/dist ./.adira/backend/dist
COPY --from=build --chown=node:node /workspace/examples/monefy/backend/package.json ./backend/package.json
COPY --from=build --chown=node:node /workspace/examples/monefy/backend/dist ./backend/dist
RUN mkdir -p /data/previews /data/assets && chown node:node /data/previews /data/assets
USER node
EXPOSE 5000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s CMD node -e "fetch('http://127.0.0.1:5000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "backend/dist/src/index.js"]
