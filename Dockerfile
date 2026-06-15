FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/fly-server.mjs ./fly-server.mjs
COPY package*.json ./
RUN npm ci --omit=dev

EXPOSE 8080

CMD ["node", "fly-server.mjs"]
