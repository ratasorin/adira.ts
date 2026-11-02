# syntax=docker/dockerfile:1.7
FROM node:24-bookworm-slim AS dependencies
WORKDIR /workspace/examples/invoice
COPY packages/core/package.json /workspace/packages/core/package.json
COPY packages/backend/package.json /workspace/packages/backend/package.json
COPY packages/client/package.json /workspace/packages/client/package.json
COPY packages/generator/package.json /workspace/packages/generator/package.json
COPY examples/invoice/package.json examples/invoice/package-lock.json ./
COPY examples/invoice/scripts/sync-adira.mjs ./scripts/sync-adira.mjs
COPY examples/invoice/backend/package.json ./backend/package.json
COPY examples/invoice/backend/shared/package.json ./backend/shared/package.json
COPY examples/invoice/frontend/package.json ./frontend/package.json
RUN node scripts/sync-adira.mjs
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

FROM dependencies AS build
COPY packages /workspace/packages
COPY examples/invoice/backend/src ./backend/src
COPY examples/invoice/backend/scripts ./backend/scripts
COPY examples/invoice/backend/tsconfig.json examples/invoice/backend/config.adira.json ./backend/
COPY examples/invoice/frontend/src ./frontend/src
COPY examples/invoice/frontend/public ./frontend/public
COPY examples/invoice/frontend/tsconfig.json examples/invoice/frontend/tsconfig.app.json examples/invoice/frontend/tsconfig.node.json ./frontend/
COPY examples/invoice/frontend/index.html examples/invoice/frontend/tailwind.config.js examples/invoice/frontend/postcss.config.js examples/invoice/frontend/vite.config.ts ./frontend/
RUN npm run sync:adira && npm run build

FROM nginxinc/nginx-unprivileged:1.28-alpine AS runtime
COPY examples/invoice/frontend/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /workspace/examples/invoice/frontend/dist /usr/share/nginx/html
ENV BACKEND_UPSTREAM=backend:5000
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
