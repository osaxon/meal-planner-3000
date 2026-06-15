# 0004 — Use native libsql client on Fly, web client on serverless

**Status:** Accepted  
**Date:** 2026-05-21

## Context

The app connects to Turso (remote SQLite) via `@libsql/client`. Two variants exist:

- **`@libsql/client`** (default) — uses a persistent WebSocket connection via the native `libsql` binary (`@libsql/linux-x64-gnu` on Linux). Low per-query latency once connected.
- **`@libsql/client/web`** — pure JS, HTTP-based, no native binary. Works anywhere but opens a new HTTP connection per query (~150–300ms overhead per request in cross-region serverless).

When deployed to Netlify serverless functions, the native client caused a runtime crash:

```
Error: Cannot find module '@libsql/linux-x64-gnu'
```

Root cause: Nitro's Node File Tracer cannot trace the dynamic `require('@libsql/${platform}')` in `libsql/index.js`, so the Linux binary is never included in the function bundle. Additionally, `drizzle-orm/libsql` had a static import of `@libsql/client` that pulled in the native dependency even when `factory.ts` used the `/web` import. Fix required switching both imports to their `/web` variants (`@libsql/client/web` + `drizzle-orm/libsql/web`).

## Decision

Use **`@libsql/client`** (native WebSocket) on Fly, where the Linux binary is available in the container and connections persist across requests.

Use **`@libsql/client/web`** + **`drizzle-orm/libsql/web`** if the app is ever moved back to a serverless/edge platform.

## Consequences

- Persistent WebSocket to Turso: connection established at process start, not per-request. Per-query latency drops significantly.
- If the deployment target ever changes back to serverless, both imports in `src/db/factory.ts` must be switched to their `/web` variants, and the bundler must not externalize `@libsql/client`.
- The native binary (`@libsql/linux-x64-gnu`) must be present in the Docker image. Using a standard `node:22` base image on Linux x64 satisfies this — npm installs the correct optional dependency automatically.
