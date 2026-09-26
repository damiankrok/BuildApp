# The analyzer HTTP API as a container.
#
#   docker build -f apps/analyzer-api/Dockerfile -t buildapp-analyzer .
#   docker run -p 8080:8080 -v analyzer-data:/data buildapp-analyzer
#
# Built from the repository root: the service bundles the workspace packages
# (TypeScript source) into two ES modules, and the runtime image carries Node
# and those two files — no node_modules, no sources, no reference data.

FROM node:22-bookworm-slim AS build
WORKDIR /repo
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 CI=true
# every workspace manifest, so `npm ci` sees the same tree the lockfile describes
COPY package.json package-lock.json .npmrc ./
COPY packages ./packages
COPY apps/analyzer-api ./apps/analyzer-api
COPY apps/web/package.json ./apps/web/package.json
COPY apps/android/package.json ./apps/android/package.json
COPY tests/architecture/package.json ./tests/architecture/package.json
COPY tests/benchmark/package.json ./tests/benchmark/package.json
RUN npm ci --ignore-scripts --no-audit --no-fund
RUN npm run build --workspace apps/analyzer-api

FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=8080 \
    ANALYZER_DATA_DIR=/data \
    ANALYZER_EXECUTOR=worker
WORKDIR /app
COPY --from=build /repo/apps/analyzer-api/dist/server.mjs /repo/apps/analyzer-api/dist/worker.mjs ./
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "server.mjs"]
