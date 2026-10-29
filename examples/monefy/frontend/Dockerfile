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
COPY examples/monefy/frontend/src ./frontend/src
COPY examples/monefy/frontend/public ./frontend/public
COPY examples/monefy/frontend/tsconfig.json examples/monefy/frontend/tsconfig.app.json examples/monefy/frontend/tsconfig.node.json ./frontend/
COPY examples/monefy/frontend/index.html examples/monefy/frontend/tailwind.config.js examples/monefy/frontend/postcss.config.js examples/monefy/frontend/vite.config.ts ./frontend/
RUN npm run sync:adira && npm run build

FROM nginxinc/nginx-unprivileged:1.28-alpine AS runtime
COPY examples/monefy/frontend/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /workspace/examples/monefy/frontend/dist /usr/share/nginx/html
ENV BACKEND_UPSTREAM=backend:5000
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
