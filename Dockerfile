FROM node:22-slim AS builder

WORKDIR /app

# Match the npm that produced package-lock.json (node:22 ships npm 10.x, but the
# lockfile — with nitro-nightly's tree — only validates cleanly under npm 11).
RUN npm install -g npm@11.12.0

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

RUN npm install -g npm@11.12.0

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/fly-server.mjs ./fly-server.mjs
COPY package*.json ./
RUN npm ci --omit=dev

EXPOSE 8080

CMD ["node", "fly-server.mjs"]
