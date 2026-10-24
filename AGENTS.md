# Repo setup notes for the Base44 sandbox

## How this app runs
The whole app is **one process**: `npm run dev` runs `tsx server.ts` — an Express server that
mounts Vite in middleware mode and serves the SPA, the `/api/*` routes and the socket.io
endpoint on port 3000. There is no separate API or frontend service, and no local database.

Run it with:
```bash
docker compose -f docker-compose.base44.yml up -d --build
```
- Source is bind-mounted at `/app`; `node_modules` is a named volume (`app_node_modules`)
  installed with `npm ci` from `package-lock.json` on first start.
- **After changing `package.json`/`package-lock.json`**, re-sync dependencies in the running
  container: `docker compose -f docker-compose.base44.yml exec app npm ci` (the startup
  command only installs when the volume is empty).
- `restart: on-failure` is set; the compose healthcheck calls the existing `GET /api/health`.

Quick checks:
```bash
curl -s http://localhost:3000/api/health   # {"status":"ok"}
curl -s http://localhost:3000/ | head      # SPA shell with /@vite/client (dev server, live source)
```

## Environment variables
`.env.base44-defaults` (committed) holds **placeholders only**, so the app boots before any
credentials exist. It is listed **first** in the compose `env_file:` list, and the
platform-managed `/run/base44/app.env` is listed **last**, so dashboard values always win.

- `GEMINI_API_KEY` — needed by `server.ts` (`/api/ai/chat`, `/api/ai/solve`) **and** by the
  client. `vite.config.ts` inlines it into the bundle via `define`, and Vite's `loadEnv`
  picks it up from `process.env`, so the value must be present in the *container* env — a
  repo-local `.env` file is not required.
- `GOOGLE_MAPS_PLATFORM_KEY` — optional; only the marketplace map view uses it and falls
  back to its list view without it.
- `FIREBASE_API_KEY` — see below.

## Firebase (auth + Firestore)
`firebase-applet-config.json` ships with a **masked `apiKey`**, so Google sign-in and every
Firestore-backed screen cannot work as committed. In the sandbox the key can be supplied
through the environment instead: `src/lib/firebase.ts` uses `FIREBASE_API_KEY` when
`BASE44_PREVIEW_MODE === '1'`, and falls back to the committed config for any other value
(including unset), so normal deployments are unchanged. The rest of the committed config
(project, database id, auth domain) is untouched and still points at the real project.

Note: everything except the landing page is gated behind Google sign-in, so an anonymous
preview only ever shows the landing page.

## Sandbox-only overrides
- `server.ts` mounts Vite's HMR websocket on the app's own HTTP server, so live reload works
  through the preview proxy. With AI Studio's `DISABLE_HMR=true` it stays disabled.
- `BASE44_PREVIEW_MODE=1` (set by the platform, passed through by compose) enables the
  `FIREBASE_API_KEY` override above. Unset or any other value = original behavior.
- Vite accepts the preview hostname through `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS`
  (passed through by compose); no host allowlist is hardcoded.
