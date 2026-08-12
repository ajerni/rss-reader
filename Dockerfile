# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY styles ./styles
COPY public ./public
COPY src ./src
COPY tsconfig.json ./
RUN npm run build:css \
  && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/reader.db
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 reader \
  && useradd --system --uid 1001 --gid reader --home-dir /app --shell /usr/sbin/nologin reader \
  && mkdir -p /data \
  && chown reader:reader /data
COPY --from=build --chown=reader:reader /app/node_modules ./node_modules
COPY --from=build --chown=reader:reader /app/package.json ./
COPY --from=build --chown=reader:reader /app/public ./public
COPY --from=build --chown=reader:reader /app/src ./src
COPY --from=build --chown=reader:reader /app/tsconfig.json ./
USER reader
EXPOSE 3000
VOLUME ["/data"]
CMD ["npx", "tsx", "src/index.tsx"]
